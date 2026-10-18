"""Side-view gait analysis utility (MediaPipe Pose). Whole person must be visible from the side.

    from gait import GaitTracker, open_camera
    g = GaitTracker(csv_path="walk.csv")        # model="lite" | "full" (default) | "heavy"; csv: every frame, all 33 landmarks
    cap = open_camera("iphone")                 # or cv2.VideoCapture("walk.mp4")
    while True:
        ok, frame = cap.read()
        if not ok: break
        legs = g.update(frame, t)               # t = seconds, increasing (time.monotonic() - start, or frame_idx / fps)
        g.draw(frame)                           # optional overlay
        print(legs.get("L"))                    # Leg or None per side; angle 180 = straight knee
    print(g.summary(start, end))                # timing, joint angles, lengths, curves (None if too little data)
    g.close()

Demo:  python gait.py --video walk.mp4   |   python gait.py --camera-name iphone [--server http://localhost:8000 [--player Mia] [--once]]
Replay a recorded walk as one game session:  python gait.py --video walk.mp4 --server URL --session-id <id> [--offset S]
The demo reads the camera on one thread and writes the raw video (no overlay) at the measured frame rate, runs the pose
model on a second thread, and only previews on the main thread, so a slow window never costs camera frames.
With --server it follows the game's sessions (vision/CONTRACT.md): it sees each session start on the server, sends a
live summary every 15 s, and when the session ends sends the session's gait, cut by act, for the AI review
(also saved as out/gait_<time>_<session id>.json). It keeps recording for the next game until q (--once: stops after
the first). Without --server press q, and the first and last seconds are dropped (stepping on, walking to the laptop).
It saves out/gait_<time>.json (the summary of the whole recording), .csv (every frame) and .mp4 (raw video).
Use one GaitTracker per video stream. Check:  python test_gait.py

Events follow Zeni et al. 2008: heel strike = ankle furthest in front of the hip, toe-off = toe furthest behind it.
Lengths are in cm, scaled by MediaPipe's own 3D (world) leg length, so expect roughly 10% absolute error;
trends and left/right asymmetry are the trustworthy part.
"""
import argparse
import bisect
import csv
import json
import math
import os
import queue
import statistics
import subprocess
import threading
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

from feet import ShoeSender, open_camera

MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
             "pose_landmarker_{0}/float16/latest/pose_landmarker_{0}.task")  # lite ~6 MB, full ~9 MB, heavy ~30 MB
NAMES = [m.name.lower() for m in vision.PoseLandmark]  # the 33 MediaPipe landmarks, logged raw every frame
SIDES = {"L": (23, 25, 27, 29, 31, 11, 15), "R": (24, 26, 28, 30, 32, 12, 16)}  # hip knee ankle heel toe shoulder wrist
LEG = ("hip", "knee", "ankle", "heel", "toe")
MIN_VIS = 0.5     # joints below this confidence are ignored
CURVE_PTS = 51    # samples per normalised gait cycle (0, 2, ..., 100 %)
WINDOW = 30       # s; long sessions are analysed in windows of about this length, then merged (median)
MAX_LEAN = 45     # deg; a trunk leaning further is a flipped skeleton or a person turning away
MAX_HIP_SHIFT = 25    # cm from the usual hip height: bending over, stepping out, or a lost skeleton
MAX_FOOT_SPEED = 800  # cm/s between frames; faster is the skeleton jumping, not a step
PREVIEW_W = 960   # px; the live preview is shrunk so showing it stays cheap
VALS = [f"{j}_{a}" for j in LEG for a in "xy"] + ["knee", "hip", "ankle", "shoulder_x", "wrist_x"]  # per side
KEEP = ["t", "frame", "cm_per_px", "trunk_lean"] + [f"{s}_{k}" for s in SIDES for k in VALS]  # what analyze() reads


@dataclass
class Leg:
    hip: tuple
    knee: tuple
    ankle: tuple
    heel: tuple
    toe: tuple      # all (x, y) in pixels
    angle: float    # knee angle in degrees, 180 = straight


def knee_angle(hip, knee, ankle):
    """Interior angle at the knee in degrees (180 = straight leg)."""
    a = abs(math.degrees(math.atan2(hip[1] - knee[1], hip[0] - knee[0])
                         - math.atan2(ankle[1] - knee[1], ankle[0] - knee[0]))) % 360
    return 360 - a if a > 180 else a


def turn(u, v):
    """Signed angle in degrees from vector u to v, image coords (y down): positive = clockwise on screen."""
    return math.degrees(math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]))


def joint_angles(p, facing):
    """p: {hip, knee, ankle, heel, toe, shoulder: (x, y)}; facing +1 = walking right on screen.
    Returns (hip flexion, ankle dorsiflexion) in degrees; hip None without a shoulder.
    Hip: thigh vs trunk line, + = knee in front. Ankle: 0 = foot square to shin, + = toes up, - = pointed."""
    sub = lambda a, b: (a[0] - b[0], a[1] - b[1])
    hip = None
    if p.get("shoulder"):
        hip = -facing * turn(sub(p["hip"], p["shoulder"]), sub(p["knee"], p["hip"]))
    shin, foot = sub(p["knee"], p["ankle"]), sub(p["toe"], p["heel"])
    between = abs(turn(shin, foot))
    return hip, 90 - between


def foot_pitch(heel, toe):
    """Foot angle vs horizontal in degrees, + = toes up."""
    return math.degrees(math.atan2(heel[1] - toe[1], abs(toe[0] - heel[0])))


def find_strikes(ts, sig, window=0.3):
    """Times where sig peaks (foot furthest forward = about to land), above-median and >= window s apart.
    ts must increase; each sample is only compared with its own +-window, so hours of frames stay fast."""
    med = statistics.median(sig)
    out = []
    for i, v in enumerate(sig):
        lo, hi = bisect.bisect_left(ts, ts[i] - window), bisect.bisect_right(ts, ts[i] + window)
        if v > med and v >= max(sig[lo:hi]) and (not out or ts[i] - out[-1] > window):
            out.append(ts[i])
    return out


def smooth(sig, k=5):
    """Centred moving average (k frames), same length; damps landmark jitter before peak finding."""
    if len(sig) < k:
        return list(sig)
    pad = np.pad(np.asarray(sig, float), k // 2, mode="edge")
    return list(np.convolve(pad, np.ones(k) / k, mode="valid"))


def mean(xs):
    xs = [x for x in xs if x is not None]
    return statistics.mean(xs) if xs else None


def cv(xs):
    return 100 * statistics.stdev(xs) / statistics.mean(xs) if len(xs) > 2 else None


def asym(a, b):
    return None if a is None or b is None or a + b == 0 else 100 * abs(a - b) / (abs(a + b) / 2)


def drop_glitches(rows, cm):
    """Copies of rows with leg and trunk values blanked on frames where the skeleton glitched: trunk flipped or
    turned away, hips far from their usual height, a toe above its hip, or a foot jumping faster than a step.
    Returns (rows, number of blanked frames)."""
    hip_y = lambda r: mean([r.get(f"{s}_hip_y") for s in SIDES])
    hips = [h for h in map(hip_y, rows) if h is not None]
    usual = statistics.median(hips) if hips else None
    out, bad, prev = [], 0, None  # prev: last good frame, so the frame after a glitch is not blamed for it
    for r in rows:
        h = hip_y(r)
        glitch = (r.get("trunk_lean") is not None and abs(r["trunk_lean"]) > MAX_LEAN) or \
            (cm is not None and h is not None and abs(h - usual) * cm > MAX_HIP_SHIFT)
        for s in SIDES:
            if r.get(f"{s}_toe_y") is not None and r[f"{s}_toe_y"] < r[f"{s}_hip_y"]:  # y grows downward
                glitch = True
            if cm and prev and r.get(f"{s}_ankle_x") is not None and prev.get(f"{s}_ankle_x") is not None \
                    and r["t"] > prev["t"] and \
                    abs(r[f"{s}_ankle_x"] - prev[f"{s}_ankle_x"]) * cm / (r["t"] - prev["t"]) > MAX_FOOT_SPEED:
                glitch = True
        if glitch:
            bad += 1
            r = {k: None if k[:2] in ("L_", "R_") or k == "trunk_lean" else v for k, v in r.items()}
        else:
            prev = r
        out.append(r)
    return out, bad


def analyze(rows):
    """rows: per-frame dicts from GaitTracker (t, cm_per_px and {L,R}_<joint>_x/_y, _knee, _hip, _ankle,
    _shoulder_x, _wrist_x; None where not visible). Glitch frames are blanked first (drop_glitches).
    Returns a dict of metrics, or None if too little data."""
    scales = [r["cm_per_px"] for r in rows if r.get("cm_per_px")]
    cm = statistics.median(scales) if scales else None
    rows, glitches = drop_glitches(rows, cm)
    side_rows = {s: [r for r in rows if r.get(f"{s}_knee") is not None] for s in SIDES}
    dx = [r[f"{s}_toe_x"] - r[f"{s}_heel_x"] for s in SIDES for r in side_rows[s]]
    if len(dx) < 10:
        return None
    d = 1 if statistics.median(dx) > 0 else -1  # facing direction: toes point where we walk
    to_cm = lambda px: None if cm is None or px is None else px * cm
    span = rows[-1]["t"] - rows[0]["t"]
    res = {"direction": "right" if d > 0 else "left", "cm_per_px": cm, "strikes": {}, "toe_offs": {},
           "stride": {}, "stride_cv": {}, "flexion": {}, "knee": {}, "hip": {}, "ankle": {}, "stance_pct": {},
           "toe_lift_cm": {}, "pelvis_bounce_cm": {}, "arm_swing_cm": {}, "foot_strike_deg": {},
           "heel_first_pct": {}, "step_time": {}, "step_length_cm": {}, "curves": {},
           "fps": (len(rows) - 1) / span if span > 0 else None, "glitch_frames": glitches,
           "seen_frames": {s: len(side_rows[s]) for s in SIDES}}  # the near leg is seen confidently more often
    stance, n_cycles = {}, {}
    for s, rs in side_rows.items():
        ts = [r["t"] for r in rs]
        col = lambda k: [r[f"{s}_{k}"] for r in rs]
        st = find_strikes(ts, smooth([d * (r[f"{s}_ankle_x"] - r[f"{s}_hip_x"]) for r in rs])) if rs else []
        to = find_strikes(ts, smooth([-d * (r[f"{s}_toe_x"] - r[f"{s}_hip_x"]) for r in rs])) if rs else []
        res["strikes"][s], res["toe_offs"][s] = st, to
        strides = [b - a for a, b in zip(st, st[1:])]
        typical = statistics.median(strides) if strides else None
        cycles = [(a, b) for a, b in zip(st, st[1:]) if b - a < 1.6 * typical]  # drop cycles spanning tracking gaps
        n_cycles[s] = len(cycles)
        res["stride"][s] = statistics.mean(b - a for a, b in cycles) if cycles else None
        res["stride_cv"][s] = cv([b - a for a, b in cycles])

        knees, hips, ankles = col("knee"), [h for h in col("hip") if h is not None], col("ankle")
        res["flexion"][s] = sorted(knees)[len(knees) // 20] if knees else None  # 5th pct: peak bend, outlier-safe
        rng = lambda xs: (np.percentile(xs, 95) - np.percentile(xs, 5)) if xs else None
        res["knee"][s] = {"peak_bend": res["flexion"][s], "rom": rng(knees)}
        res["hip"][s] = {"peak_flexion": np.percentile(hips, 95) if hips else None,
                         "peak_extension": np.percentile(hips, 5) if hips else None, "rom": rng(hips)}
        res["ankle"][s] = {"peak_dorsi": np.percentile(ankles, 95) if ankles else None,
                           "peak_plantar": np.percentile(ankles, 5) if ankles else None, "rom": rng(ankles)}

        ground = np.percentile(col("toe_y"), 95) if rs else None  # y grows downward: biggest y = floor
        stance[s], stance_pct, lifts, bounce, swing, curves, pitch_at, flat = [], [], [], [], [], [], [], []
        for a, b in cycles:
            frames = [r for r in rs if a <= r["t"] <= b]
            off = next((t for t in to if a < t < b), None)
            if len(frames) < 5:
                continue
            ph = [(r["t"] - a) / (b - a) * 100 for r in frames]
            grid = np.linspace(0, 100, CURVE_PTS)
            curves.append({k: np.interp(grid, ph, [r[f"{s}_{k}"] if r[f"{s}_{k}"] is not None else np.nan
                                                   for r in frames]) for k in ("knee", "hip", "ankle")})
            bounce.append(max(r[f"{s}_hip_y"] for r in frames) - min(r[f"{s}_hip_y"] for r in frames))
            arm = [d * (r[f"{s}_wrist_x"] - r[f"{s}_shoulder_x"]) for r in frames if r[f"{s}_wrist_x"] is not None]
            if len(arm) > 3:
                swing.append(max(arm) - min(arm))
            pitch_at.append(foot_pitch(*[(frames[0][f"{s}_{j}_x"], frames[0][f"{s}_{j}_y"]) for j in ("heel", "toe")]))
            if off is None:
                continue
            stance[s].append((a, off))
            stance_pct.append((off - a) / (b - a) * 100)
            lifts.append(ground - min(r[f"{s}_toe_y"] for r in frames if r["t"] >= off))
            mid = [r for r in frames if a + (off - a) * 0.3 <= r["t"] <= a + (off - a) * 0.6]  # mid-stance: foot flat
            flat += [foot_pitch((r[f"{s}_heel_x"], r[f"{s}_heel_y"]), (r[f"{s}_toe_x"], r[f"{s}_toe_y"])) for r in mid]
        res["stance_pct"][s] = mean(stance_pct)
        res["toe_lift_cm"][s] = to_cm(mean(lifts))
        res["pelvis_bounce_cm"][s] = to_cm(mean(bounce))
        res["arm_swing_cm"][s] = to_cm(mean(swing))
        flat0 = statistics.median(flat) if flat else 0
        res["foot_strike_deg"][s] = mean([p - flat0 for p in pitch_at])  # + = toes up at contact (heel first)
        res["heel_first_pct"][s] = 100 * sum(p - flat0 > 5 for p in pitch_at) / len(pitch_at) if pitch_at else None
        res["curves"][s] = {k: [None if math.isnan(v) else round(float(v), 1) for v in np.nanmean([c[k] for c in curves], 0)]
                            for k in ("knee", "hip", "ankle")} if curves else None

    # steps: alternate feet; step time/length belong to the foot that just landed
    events = sorted((t, s) for s in SIDES for t in res["strikes"][s])
    by_t = {r["t"]: r for r in rows}
    for s in SIDES:
        o = "R" if s == "L" else "L"
        times = [t - pt for (pt, ps), (t, ts_) in zip(events, events[1:])
                 if ts_ == s and ps == o and res["stride"][s] and t - pt < res["stride"][s]]
        lens = [d * (by_t[t][f"{s}_heel_x"] - by_t[t][f"{o}_heel_x"])
                for t in res["strikes"][s] if by_t[t].get(f"{o}_heel_x") is not None]
        res["step_time"][s] = mean(times)
        res["step_length_cm"][s] = to_cm(mean(lens))
    # cadence from same-foot stride time (one stride = two steps) on the side with the most clean cycles, the near
    # leg; counting all strikes over the whole span let tracking gaps and missed far-foot strikes drag it down
    stride = res["stride"][max(SIDES, key=lambda s: n_cycles[s])]
    res["cadence"] = 120 / stride if stride else None
    # cross-check: steps counted between consecutive strikes of either foot, leaving out gaps and near-double strikes
    # (one footfall given to both labels). Far from cadence means strikes were missed or labels mixed up.
    gaps = [b - a for (a, _), (b, _) in zip(events, events[1:])]
    med = statistics.median(gaps) if gaps else 0
    steps = [x for x in gaps if 0.5 * med <= x <= 1.5 * med]
    res["cadence_steps"] = 60 / statistics.mean(steps) if steps and med > 0 else None
    sl = res["step_length_cm"]
    res["stride_length_cm"] = sl["L"] + sl["R"] if sl["L"] and sl["R"] else None
    res["speed_m_s"] = res["stride_length_cm"] / 100 / stride if res["stride_length_cm"] and stride else None

    # double support: share of time both feet are on the ground, over the span both feet were tracked
    if stance["L"] and stance["R"]:
        lo, hi = max(stance["L"][0][0], stance["R"][0][0]), min(stance["L"][-1][1], stance["R"][-1][1])
        on = lambda s, t: any(a <= t <= b for a, b in stance[s])
        span = [r["t"] for r in rows if lo <= r["t"] <= hi]
        res["double_support_pct"] = 100 * sum(on("L", t) and on("R", t) for t in span) / len(span) if span else None
    else:
        res["double_support_pct"] = None
    lean = [r["trunk_lean"] for r in rows if r.get("trunk_lean") is not None]
    res["trunk_lean"] = {"mean": mean(lean), "range": (np.percentile(lean, 95) - np.percentile(lean, 5)) if lean else None}

    res["asymmetry"] = asymmetry(res)
    return _plain(res)


def asymmetry(res):
    """Left/right difference in percent for each paired metric of an analyze() result."""
    pair = lambda k, sub=None: asym(*[(res[k][s] if sub is None else (res[k][s] or {}).get(sub)) for s in SIDES])
    return {"stride": pair("stride"), "flexion": pair("flexion"), "step_time": pair("step_time"),
            "step_length": pair("step_length_cm"), "stance": pair("stance_pct"),
            "knee_rom": pair("knee", "rom"), "hip_rom": pair("hip", "rom"),
            "ankle_rom": pair("ankle", "rom"), "toe_lift": pair("toe_lift_cm"),
            "arm_swing": pair("arm_swing_cm")}


def combine(parts):
    """Merge analyze() results of consecutive windows: the median of every number (curves point by point), strikes
    and toe-offs joined, glitch frames summed, asymmetry recomputed from the merged sides."""
    parts = [p for p in parts if p]
    if len(parts) < 2:
        return parts[0] if parts else None

    def merge(vals):
        vals = [v for v in vals if v is not None]
        if not vals:
            return None
        if isinstance(vals[0], dict):
            return {k: merge([v.get(k) for v in vals]) for k in vals[0]}
        if isinstance(vals[0], list):
            return [merge(col) for col in zip(*vals)] if len({len(v) for v in vals}) == 1 else vals[0]
        if isinstance(vals[0], str):
            return max(set(vals), key=vals.count)
        return statistics.median(vals)

    res = merge(parts)
    for k in ("strikes", "toe_offs"):
        res[k] = {s: sorted(t for p in parts for t in p[k][s]) for s in SIDES}
    res["glitch_frames"] = sum(p["glitch_frames"] for p in parts)
    res["seen_frames"] = {s: sum((p.get("seen_frames") or {}).get(s, 0) for p in parts) for s in SIDES}
    res["asymmetry"] = asymmetry(res)
    return res


def summarize(rows, start=None, end=None):
    """analyze() over the rows with start <= t <= end, split into equal windows of about WINDOW s and merged
    (combine), plus a short per-window trend under "windows". Windows keep long sessions fast and let one bad
    stretch spoil only its own window. None if too little data."""
    rows = [r for r in rows if (start is None or r["t"] >= start) and (end is None or r["t"] <= end)]
    if not rows:
        return None
    ts = [r["t"] for r in rows]
    n = max(1, round((ts[-1] - ts[0]) / WINDOW))
    edges = [ts[0] + (ts[-1] - ts[0]) * i / n for i in range(n)] + [math.inf]
    parts, trend = [], []
    for a, b in zip(edges, edges[1:]):
        part = analyze(rows[bisect.bisect_left(ts, a):bisect.bisect_left(ts, b)])
        if part:
            parts.append(part)
            trend.append({"start": a, "end": min(b, ts[-1]), "cadence": part["cadence"], "stride": part["stride"],
                          "toe_lift_cm": part["toe_lift_cm"], "knee_rom": {s: part["knee"][s]["rom"] for s in SIDES},
                          "glitch_frames": part["glitch_frames"]})
    res = combine(parts)
    if res:
        res["windows"] = trend
    return res


def _plain(v):
    """numpy scalars -> float, so summary() is JSON-safe for the server/dashboard."""
    if isinstance(v, dict):
        return {k: _plain(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_plain(x) for x in v]
    return float(v) if isinstance(v, np.floating) else v


def report(res):
    """Print a summary() result."""
    if res is None:
        return print("Not enough pose data. Is the whole person visible from the side?")
    f = lambda v, u="": "n/a" if v is None else f"{v:.1f}{u}"
    side = lambda k, u="", sub=None: "  ".join(
        f"{s} {f(res[k][s] if sub is None else (res[k][s] or {}).get(sub), u)}" for s in SIDES)
    win = res.get("windows") or []
    print(f"\nWalking direction: {res['direction']}   scale: {f(res['cm_per_px'], ' cm/px')}")
    print(f"Frames analysed at {f(res.get('fps'), ' fps')}   glitch frames blanked: {res.get('glitch_frames', 0)}   "
          f"windows: {len(win) or 1}")
    print(f"Foot strikes: L {len(res['strikes']['L'])}, R {len(res['strikes']['R'])}")
    print(f"Cadence {f(res['cadence'], ' steps/min')}   speed {f(res['speed_m_s'], ' m/s')}   "
          f"stride length {f(res['stride_length_cm'], ' cm')}   double support {f(res['double_support_pct'], '%')}")
    c, cs = res["cadence"], res.get("cadence_steps")
    if c and cs and abs(c - cs) > 0.25 * cs:
        print(f"  CHECK: step count gives {cs:.1f} steps/min; strikes were missed or one leg's label caught both feet")
    for label, k, u, sub in [("Stride time", "stride", " s", None), ("Stride variability", "stride_cv", "%", None),
                             ("Step time", "step_time", " s", None), ("Step length", "step_length_cm", " cm", None),
                             ("Stance", "stance_pct", "%", None),
                             ("Knee peak bend (lower = more)", "knee", " deg", "peak_bend"),
                             ("Knee range", "knee", " deg", "rom"), ("Hip peak flexion", "hip", " deg", "peak_flexion"),
                             ("Hip peak extension", "hip", " deg", "peak_extension"), ("Hip range", "hip", " deg", "rom"),
                             ("Ankle peak dorsiflexion", "ankle", " deg", "peak_dorsi"),
                             ("Ankle peak plantarflexion", "ankle", " deg", "peak_plantar"),
                             ("Ankle range", "ankle", " deg", "rom"), ("Toe lift in swing", "toe_lift_cm", " cm", None),
                             ("Foot angle at strike (+ heel first)", "foot_strike_deg", " deg", None),
                             ("Heel-first strikes", "heel_first_pct", "%", None),
                             ("Pelvis bounce", "pelvis_bounce_cm", " cm", None), ("Arm swing", "arm_swing_cm", " cm", None)]:
        print(f"{label + ':':38} {side(k, u, sub)}")
    print(f"{'Trunk lean (+ forward):':38} mean {f(res['trunk_lean']['mean'], ' deg')}, range {f(res['trunk_lean']['range'], ' deg')}")
    print("Asymmetry: " + ", ".join(f"{k} {f(v, '%')}" for k, v in res["asymmetry"].items()))
    if len(win) > 1:
        a, b = win[0], win[-1]
        print(f"Trend, first -> last window: cadence {f(a['cadence'])} -> {f(b['cadence'])}, " + ", ".join(
            f"toe lift {s} {f(a['toe_lift_cm'][s])} -> {f(b['toe_lift_cm'][s], ' cm')}" for s in SIDES))


class GaitTracker:
    def __init__(self, model="full", csv_path=None):
        path = f"models/pose_landmarker_{model}.task"
        if not os.path.exists(path):
            os.makedirs(os.path.dirname(path), exist_ok=True)
            url = MODEL_URL.format(model)
            print(f"Downloading {model} pose model (one time)...")
            try:
                urllib.request.urlretrieve(url, path)
            except Exception:
                # Network proxy may block urllib TLS; fall back to curl.
                subprocess.run(["curl", "-fsSL", "-o", path, url], check=True)
        self.landmarker = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=path), running_mode=vision.RunningMode.VIDEO))
        self.rows = []     # one small dict per frame (the KEEP fields), the data behind summary(); 20 min fit in memory
        self.found = False  # was a person found in the last frame
        self._seen = []    # (side, points, confidence) of the last frame, for draw()
        self._ms = -1      # last timestamp given to MediaPipe, which needs them strictly increasing
        # every frame with all 33 landmarks streams to disk instead of memory
        self._csv = open(csv_path, "w", newline="", buffering=1) if csv_path else None
        self._csv_writer = None

    def update(self, frame, t, index=None):
        """Process one BGR frame at time t (seconds, must increase); index = its frame number in the source video
        (default: frames seen so far). Returns {"L": Leg, "R": Leg}, only confident sides."""
        h, w = frame.shape[:2]
        rgb = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        self._ms = max(int(t * 1000), self._ms + 1)
        result = self.landmarker.detect_for_video(rgb, self._ms)
        lm = result.pose_landmarks[0] if result.pose_landmarks else None
        wl = result.pose_world_landmarks[0] if result.pose_world_landmarks else None
        self.found, self._seen = lm is not None, []
        row, legs, facings, scales = {"t": round(t, 3), "frame": len(self.rows) if index is None else index}, {}, [], []
        for i, name in enumerate(NAMES):  # raw: pixels, confidence, and metric 3D (m, origin between the hips)
            p, q = (lm[i], wl[i]) if lm and wl else (None, None)
            row.update({f"{name}_x": p and round(p.x * w, 1), f"{name}_y": p and round(p.y * h, 1),
                        f"{name}_vis": p and round(p.visibility, 3), f"{name}_wx": q and round(q.x, 4),
                        f"{name}_wy": q and round(q.y, 4), f"{name}_wz": q and round(q.z, 4)})
        px = lambda i: (lm[i].x * w, lm[i].y * h)
        ok = lambda i: lm[i].visibility >= MIN_VIS
        for s, ids in SIDES.items():
            vis = min(lm[i].visibility for i in ids[:5]) if lm else 0
            if lm:
                self._seen.append((s, [px(i) for i in ids[:5]], vis))
            vals = dict.fromkeys(VALS)
            if vis >= MIN_VIS:
                p = dict(zip(LEG, (px(i) for i in ids[:5])))
                if ok(ids[5]):
                    p["shoulder"] = px(ids[5])
                facing = 1 if p["toe"][0] > p["heel"][0] else -1
                facings.append(facing)
                legs[s] = Leg(*[p[j] for j in LEG], angle=knee_angle(p["hip"], p["knee"], p["ankle"]))
                hip, ankle = joint_angles(p, facing)
                vals.update({f"{j}_{a}": round(p[j][k], 1) for j in LEG for k, a in enumerate("xy")})
                vals.update(knee=round(legs[s].angle, 1), hip=hip and round(hip, 1), ankle=round(ankle, 1),
                            shoulder_x=p.get("shoulder") and round(p["shoulder"][0], 1),
                            wrist_x=round(px(ids[6])[0], 1) if ok(ids[6]) else None)
                pix = math.dist(p["hip"], p["knee"]) + math.dist(p["knee"], p["ankle"])
                if wl and pix > 0:  # world legs are in meters: cm per pixel for this frame
                    world = math.dist(*[(wl[i].x, wl[i].y, wl[i].z) for i in ids[:2]]) + \
                            math.dist(*[(wl[i].x, wl[i].y, wl[i].z) for i in ids[1:3]])
                    scales.append(100 * world / pix)
            row.update({f"{s}_{k}": v for k, v in vals.items()})
        row["cm_per_px"] = round(statistics.median(scales), 4) if scales else None
        row["trunk_lean"] = None  # + = leaning toward the walking direction
        if lm and facings and all(ok(i) for i in (11, 12, 23, 24)):
            mid = lambda a, b: ((px(a)[0] + px(b)[0]) / 2, (px(a)[1] + px(b)[1]) / 2)
            sh, hp = mid(11, 12), mid(23, 24)
            row["trunk_lean"] = round(facings[0] * turn((0, -1), (sh[0] - hp[0], sh[1] - hp[1])), 1)
        if self._csv:
            if self._csv_writer is None:
                self._csv_writer = csv.DictWriter(self._csv, fieldnames=list(row))
                self._csv_writer.writeheader()
            self._csv_writer.writerow(row)
        self.rows.append({k: row[k] for k in KEEP})
        return legs

    def draw(self, frame):
        """Overlay the last frame's skeleton on `frame`. Green = used, red = low confidence (ignored)."""
        cv2.putText(frame, "person found" if self.found else "NO PERSON FOUND (full body, side view)", (10, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0) if self.found else (0, 0, 255), 2)
        for s, xy, vis in self._seen:
            color = (0, 255, 0) if vis >= MIN_VIS else (0, 0, 255)
            for a, b in zip(xy, xy[1:]):
                cv2.line(frame, tuple(map(int, a)), tuple(map(int, b)), color, 2)
            cv2.putText(frame, f"{s} vis {vis:.2f}", (int(xy[1][0]) + 8, int(xy[1][1])), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    def summary(self, start=None, end=None):
        """All gait metrics for start <= t <= end (default: everything seen), None if too little data.
        See summarize() and analyze()."""
        return summarize(self.rows, start, end)

    def close(self):
        if self._csv:
            self._csv.close()


class Recorder:
    """Live capture without lost frames. The capture thread timestamps every frame and writes it raw (no overlay);
    the analysis thread runs the GaitTracker on the same frames; the caller's thread only shows `preview`.
    Run serially, those steps took just over one frame time, so every second camera frame was lost (15 fps) and
    the saved video played at double speed. A live video is written at a constant rate by timestamp (a slow camera
    repeats frames, a burst skips some), so video time always equals t and each CSV row's `frame` is its video frame."""

    def __init__(self, cap, tracker, video_path, live):
        self.cap, self.g, self.path, self.live = cap, tracker, video_path, live
        self.fps = cap.get(cv2.CAP_PROP_FPS) or 30   # frame rate of the written video
        self.queue = queue.Queue(maxsize=120)          # about 4 s of frames waiting for the model
        self.stop = threading.Event()
        self.start_epoch = time.time()                 # wall clock at t = 0, to match the game server's timestamps
        self.frames = self.dropped = 0                 # captured; captured but never analysed (queue full)
        self.preview = None                            # last analysed frame with the skeleton drawn
        self._threads = [threading.Thread(target=self._capture, daemon=True),
                         threading.Thread(target=self._analyse, daemon=True)]

    def start(self):
        self.start_epoch, self._t0 = time.time(), time.monotonic()
        for th in self._threads:
            th.start()

    def capturing(self):
        return self._threads[0].is_alive()

    def now(self):
        """Seconds on the recording clock (the t of the rows) right now; live capture only."""
        return time.monotonic() - self._t0

    def finish(self):
        """Stop capturing, let the model catch up on queued frames, close the video."""
        self.stop.set()
        for th in self._threads:
            th.join()

    def _send(self, item, block):
        """Queue for the model. Without block a full queue drops the frame from analysis (it is still in the video);
        with block it waits, unless the analysis thread has died."""
        while True:
            try:
                return self.queue.put(item, timeout=0.5) if block else self.queue.put_nowait(item)
            except queue.Full:
                if not block or not self._threads[1].is_alive():
                    self.dropped += item is not None
                    return

    def _capture(self):
        writer, written = None, 0
        try:
            while not self.stop.is_set():
                ok, frame = self.cap.read()
                if not ok:
                    break
                t = time.monotonic() - self._t0 if self.live else self.frames / self.fps
                if writer is None:
                    h, w = frame.shape[:2]
                    writer = cv2.VideoWriter(self.path, cv2.VideoWriter_fourcc(*"mp4v"), self.fps, (w, h))
                index = round(t * self.fps) if self.live else self.frames   # this frame's place in the video
                while written <= index:   # written before the frame is queued, so the file stays raw
                    writer.write(frame)
                    written += 1
                self._send((index, t, frame), block=not self.live)  # a live camera never waits for the model
                self.frames += 1
        finally:
            if writer:
                writer.release()
            self._send(None, block=True)

    def _analyse(self):
        while (item := self.queue.get()) is not None:
            index, t, frame = item
            self.g.update(frame, t, index)
            self.g.draw(frame)
            self.preview = frame


# ---------------------------------------------------------------- game sessions (vision/CONTRACT.md)
ACTS = ("walk", "garden", "storm")
POLL = 1           # s between looks at the server's active session
LIVE_EVERY = 15    # s between live summaries while a session runs
LIVE_SPAN = 20     # s of walking in each live summary
MIN_SEGMENT = 8    # s; a shorter stretch of one act holds too few strides to measure
KEEP_S = 30 * 60   # s of rows kept in memory while following (about 1.6 KB a frame); longer than any session


def finite(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def clock_offset(server_time, sent, received):
    """Server clock minus local clock, from one reply: serverTime against the midpoint of the request."""
    return server_time - (sent + received) / 2


def to_recording(server_epoch, offset, start_epoch):
    """A server timestamp on the recording clock (the rows' t)."""
    return server_epoch - offset - start_epoch


def session_span(start, game, detected_end=None):
    """(start, end) of a session on the recording clock. The game's own length (wallSeconds, else the last segment's
    end) beats the moment the active session vanished, which comes after the server's note and reward calls."""
    game = game or {}
    length = game.get("wallSeconds")
    if not finite(length):
        ends = [s.get("endS") for s in game.get("segments") or [] if isinstance(s, dict) and finite(s.get("endS"))]
        length = max(ends) if ends else None
    end = start + length if length else detected_end
    if end is not None and detected_end is not None:
        end = min(end, detected_end)
    return start, end


def act_windows(segments, pauses=(), start=0.0, end=None, min_len=MIN_SEGMENT):
    """The game's segments (seconds since the session start) on the recording clock, pauses cut out, grouped by act:
    {"walk": [(a, b)], "garden": [(a, b), ...], "storm": [...]}. Pieces past end or shorter than min_len are dropped."""
    pauses = [(a, b) for a, b in (p for p in pauses or [] if isinstance(p, (list, tuple)) and len(p) == 2)
              if finite(a) and finite(b) and b > a]
    out = {}
    for seg in segments or []:
        if not isinstance(seg, dict) or seg.get("act") not in ACTS or not (finite(seg.get("startS")) and finite(seg.get("endS"))):
            continue
        pieces = [(seg["startS"], seg["endS"])]
        for pa, pb in pauses:   # keep what lies before and after each pause
            pieces = [q for x, y in pieces for q in ((x, min(y, pa)), (max(x, pb), y)) if q[1] > q[0]]
        for x, y in pieces:
            x, y = start + x, start + y if end is None else min(start + y, end)
            if y - x >= min_len:
                out.setdefault(seg["act"], []).append((x, y))
    return out


def slim(res):
    """A summary without its long per-cycle curves and per-window trend."""
    return None if res is None else {k: v for k, v in res.items() if k not in ("curves", "windows")}


def per_act(rows, windows):
    """summarize() of each act's stretches, merged across rounds (combine); acts with too little data are left out."""
    out = {}
    for act, spans in windows.items():
        res = combine([p for p in (slim(summarize(rows, a, b)) for a, b in spans) if p])
        if res:
            out[act] = res
    return out


def json_safe(v):
    """NaN and infinities become None, so the payload is plain JSON."""
    if isinstance(v, dict):
        return {k: json_safe(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [json_safe(x) for x in v]
    return None if isinstance(v, float) and not math.isfinite(v) else v


def final_payload(session_id, rows, start, end, game, captured, skipped, source="side-camera"):
    """POST /api/gait/final body. game = the saved session's summary, or None when it could not be fetched
    (then the session window only, and no acts). summary is None when too little was seen."""
    windows = act_windows(game.get("segments"), game.get("pauses"), start, end) if game else {}
    paused = [(start + a, start + b) for a, b in (p for p in (game or {}).get("pauses") or []
                                                  if isinstance(p, (list, tuple)) and len(p) == 2)
              if start is not None and finite(a) and finite(b) and b > a]
    rows = [r for r in rows if not any(a <= r["t"] <= b for a, b in paused)]
    n = sum(1 for r in rows if (start is None or r["t"] >= start) and (end is None or r["t"] <= end))
    span = (end - start - sum(min(b, end) - max(a, start) for a, b in paused if b > start and a < end)
            if start is not None and end is not None else None)   # walking time: the pauses' frames are gone
    quality = {"fps": round(n / span, 1) if span and span > 0 else None, "framesCaptured": captured,
               "framesAnalysed": n, "framesSkipped": skipped}
    return json_safe({"sessionId": session_id, "source": source, "quality": quality,
                      "summary": summarize(rows, start, end), "perAct": per_act(rows, windows)})


def get_json(url, timeout=2):
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.load(resp)


def post_json(url, body, timeout=5):
    req = urllib.request.Request(url, data=json.dumps(body, allow_nan=False).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, json.load(resp)


def fetch_session(server, session_id, tries=40):
    """The saved session (GET /api/session/{id}), or None. Usually there at once (the server clears the active session
    after the save), but a player who restarts at Home ends it before the save, which waits for the server's note and
    reward calls (the game gives it 25 s): so keep asking, once a second."""
    url = f"{server}/api/session/{urllib.parse.quote(session_id)}"
    for i in range(tries):
        try:
            return get_json(url, timeout=3)
        except (OSError, ValueError) as e:
            if i == tries - 1:
                print(f"Session {session_id[:8]}: could not fetch it ({e}); posting the window only")
            time.sleep(1)
    return None


def post_final(server, payload, path=None, player=None):
    """POST /api/gait/final (one retry), save the payload next to the recording, print the report."""
    sid = payload["sessionId"]
    deadline = time.monotonic() + 40   # a 404 means the game has not saved the session yet (see fetch_session)
    for i in range(30):
        try:
            status, _ = post_json(f"{server}/api/gait/final", payload, timeout=10)
            print(f"Session {sid[:8]}: gait summary sent ({status}); the server reviews it now")
            break
        except (OSError, ValueError) as e:
            waiting = getattr(e, "code", None) == 404 and time.monotonic() < deadline
            if not waiting and i >= 1:
                print(f"Session {sid[:8]}: could not send the gait summary ({e})")
                break
            time.sleep(2 if waiting else 1)
    if path:
        with open(path, "w") as fh:
            json.dump({**payload, "player": player}, fh, indent=1)
        print(f"Saved {path}")
    report(payload["summary"])


class SessionFollower:
    """Follows the game's sessions on the server (live camera): marks each session's start from its startedAt, posts
    a live summary every LIVE_EVERY s (also the check-in that makes the saved session wait for the review), and when
    the session ends posts the final summary from a worker thread, so recording goes on for the next game."""

    def __init__(self, server, rec, base, player=None, once=False):
        self.server, self.rec, self.base, self.player, self.once = server.rstrip("/"), rec, base, player, once
        self.offset, self.best_rtt = 0.0, math.inf   # server minus local clock, from the quickest reply so far
        self.current = None    # {"id", "player", "start", "frames", "dropped"} of the session being played
        self.seen = set()      # ids already followed, never started twice
        self.workers = []
        self.last_window = None   # (start, end, player) of the last finished session, recording clock
        self.down = False

    def active(self):
        """The server's active session ({} when none), or None when the server did not answer."""
        sent = time.time()
        try:
            got = get_json(f"{self.server}/api/session/active")
        except (OSError, ValueError) as e:
            if not self.down:
                print(f"Game server not answering ({e}); still recording")
            self.down = True
            return None
        received = time.time()
        if self.down:
            print("Game server back")
        self.down = False
        if finite(got.get("serverTime")) and received - sent < self.best_rtt:
            self.best_rtt, self.offset = received - sent, clock_offset(got["serverTime"], sent, received)
        return got

    def run(self):
        last_live = -math.inf
        while not self.rec.stop.wait(POLL):
            try:
                last_live = self.step(last_live)
            except Exception as e:  # noqa: BLE001 - keep following; the next poll tries again
                print(f"Session follower: {e}")

    def trim(self):
        """Forget rows older than KEEP_S that no session still needs (the CSV on disk keeps every frame)."""
        rows, now = self.rec.g.rows, self.rec.now()
        keep = now - KEEP_S if not self.current else min(now - KEEP_S, self.current["start"] - LIVE_SPAN)
        if rows and rows[0]["t"] < keep and not any(th.is_alive() for th in self.workers):
            del rows[:bisect.bisect_left([r["t"] for r in rows], keep)]

    def step(self, last_live):
        """One poll: start, end or keep up the session being played. Returns when the last live summary went."""
        self.trim()
        got = self.active()
        if got is None:
            return last_live   # no answer: keep the current session as it is
        sid = got.get("id") if not self.player or got.get("player") == self.player else None
        cur = self.current
        if cur and cur["id"] != sid:
            self.end(cur)
        if sid and sid not in self.seen and finite(got.get("startedAt")):
            self.seen.add(sid)
            start = to_recording(got["startedAt"], self.offset, self.rec.start_epoch)
            self.current = {"id": sid, "player": got.get("player"), "start": start,
                            "frames": self.rec.frames, "dropped": self.rec.dropped}
            print(f"Session {sid[:8]} for {got.get('player')}: recording its gait")
            last_live = -math.inf
        if self.current and self.rec.now() - last_live >= LIVE_EVERY:
            last_live = self.rec.now()
            self.live(self.current)
        return last_live

    def live(self, cur):
        rows = list(self.rec.g.rows)
        if not rows:
            return
        res = slim(summarize(rows, rows[-1]["t"] - LIVE_SPAN, rows[-1]["t"]))
        if res is None:   # nothing measurable yet: still check in, so the game knows a side camera follows this walk
            try:
                post_json(f"{self.server}/api/gait", {"player": cur["player"], "source": "side-camera", "summary": None, "sessionId": cur["id"]}, timeout=5)
            except Exception:
                pass
            return
        try:
            post_json(f"{self.server}/api/gait", json_safe({"player": cur["player"], "source": "side-camera",
                                                             "sessionId": cur["id"], "summary": res}))
        except (OSError, ValueError) as e:
            print(f"Live gait summary not sent ({e})")

    def end(self, cur):
        self.current = None
        snap = dict(cur, end=self.rec.now(), frames=self.rec.frames - cur["frames"], dropped=self.rec.dropped - cur["dropped"])
        th = threading.Thread(target=self.finish, args=(snap,), daemon=True)
        self.workers.append(th)
        th.start()

    def finish(self, cur):
        try:
            session = fetch_session(self.server, cur["id"])
            game = (session or {}).get("summary") or None
            start, end = session_span(cur["start"], game, cur["end"])
            deadline = time.monotonic() + 5   # the model can sit a few seconds behind the camera
            while self.rec.capturing() and time.monotonic() < deadline and \
                    (not self.rec.g.rows or self.rec.g.rows[-1]["t"] < end):
                time.sleep(0.2)
            payload = final_payload(cur["id"], list(self.rec.g.rows), start, end, game, cur["frames"], cur["dropped"])
            self.last_window = (start, end, cur["player"])
            post_final(self.server, payload, f"{self.base}_{cur['id'][:8]}.json", cur["player"])
        except Exception as e:  # noqa: BLE001 - one bad session must not take the recording down
            print(f"Session {cur['id'][:8]}: gait summary failed ({e})")
        if self.once:
            self.rec.stop.set()

    def wait(self, timeout=60):
        """Let finals still being sent finish (the main thread exits after this)."""
        for th in self.workers:
            th.join(timeout)
        if self.current:
            print(f"Session {self.current['id'][:8]} was still running; its gait summary was not sent")


def replay_final(server, session_id, rows, offset, base):
    """--video with --session-id: the video stands in for the camera of that session, which started at video t = offset."""
    server = server.rstrip("/")
    session = fetch_session(server, session_id, tries=2)
    game = (session or {}).get("summary") or None
    start, end = session_span(offset, game, rows[-1]["t"] if rows else None)
    n = sum(1 for r in rows if start <= r["t"] <= (end if end is not None else math.inf))
    payload = final_payload(session_id, rows, start, end, game, n, 0)   # a video is never ahead of the model
    post_final(server, payload, f"{base}_{session_id[:8]}.json", (session or {}).get("player"))


def session_window(rows, game, epoch0, trim_start, trim_end):
    """(start, end, source) in recording seconds: the game's session when the server reported one that overlaps
    the recording, else the recording without its first trim_start and last trim_end seconds."""
    if not rows:
        return None, None, None
    first, last = rows[0]["t"], rows[-1]["t"]
    if game:
        a, b = max(first, game[0] - epoch0), min(last, game[1] - epoch0)
        if b - a > 1:
            return a, b, "game session"
    return first + trim_start, last - trim_end, "trimmed"


def main():
    p = argparse.ArgumentParser(description="Gait analysis demo (q to stop)")
    p.add_argument("--video", help="recorded side-view video")
    p.add_argument("--camera", type=int, help="camera index (overrides --camera-name)")
    p.add_argument("--camera-name", help="substring of camera name, e.g. iphone")
    p.add_argument("--model", default="full", choices=("lite", "full", "heavy"),
                   help="heavy is most accurate but slow live; fine for recorded video")
    p.add_argument("--server", help="game server, e.g. http://localhost:8000: follow its game sessions and send each "
                                    "one's gait summary for the AI review (with --video: needs --session-id)")
    p.add_argument("--player", help="with --server: follow only this player's sessions (default: every player)")
    p.add_argument("--once", action="store_true", help="with --server: stop after the first finished session")
    p.add_argument("--no-preview", action="store_true", help="no preview window: with --server the dashboard shows the picture")
    p.add_argument("--session-id", help="with --video and --server: the game session this recording belongs to")
    p.add_argument("--offset", type=float, default=0.0,
                   help="with --session-id: video seconds at which that session started")
    p.add_argument("--trim-start", type=float, default=1.0, help="seconds dropped at the start without --server")
    p.add_argument("--trim-end", type=float, default=2.0, help="seconds dropped at the end without --server")
    args = p.parse_args()
    if args.video and args.server and not args.session_id:
        raise SystemExit("--video with --server replays one game session: add --session-id <id> (and --offset)")

    if args.video:
        cap = cv2.VideoCapture(args.video)
        if not cap.isOpened():
            raise SystemExit(f"Could not open video {args.video}")
    else:
        try:
            cap = open_camera(args.camera_name, args.camera)
        except RuntimeError as e:
            raise SystemExit(e)
    os.makedirs("out", exist_ok=True)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    g = GaitTracker(args.model, csv_path=f"out/gait_{stamp}.csv")
    base = f"out/gait_{stamp}"
    rec = Recorder(cap, g, f"{base}.mp4", live=not args.video)
    rec.start()
    follower = None
    if args.server and not args.video:
        follower = SessionFollower(args.server, rec, base, args.player, args.once)
        threading.Thread(target=follower.run, daemon=True).start()
    sender = ShoeSender(args.server, source="side") if args.server and not args.video else None   # the dashboard's side view
    last_post = 0.0
    try:
        while not rec.stop.is_set() and rec.capturing():
            frame = rec.preview
            if frame is None:
                time.sleep(0.03)
                continue
            if sender is not None and time.time() - last_post >= 0.5:   # two pictures a second, like feet.py
                sender.preview(frame)
                last_post = time.time()
            if args.no_preview:
                time.sleep(0.03)
                continue
            cv2.imshow("gait (q to stop)", cv2.resize(frame, (PREVIEW_W, PREVIEW_W * frame.shape[0] // frame.shape[1])))
            if cv2.waitKey(30) & 0xFF == ord("q"):
                break
    except KeyboardInterrupt:
        pass
    print("Finishing analysis...")
    rec.finish()
    cap.release()
    cv2.destroyAllWindows()
    g.close()
    if follower:
        follower.wait()
    if args.video and args.server:
        replay_final(args.server, args.session_id, g.rows, args.offset, base)

    # the whole recording, kept locally: the last followed session's window (as --once had it), else trimmed
    last = follower and follower.last_window
    game = (last[0] + rec.start_epoch, last[1] + rec.start_epoch) if last and last[1] is not None else None
    start, end, source = session_window(g.rows, game, rec.start_epoch, args.trim_start, args.trim_end)
    res = g.summary(start, end)
    with open(f"{base}.json", "w") as fh:  # the summary, not the per-frame CSV
        json.dump({"player": last[2] if last else args.player, "recorded_at": rec.start_epoch,
                   "analysed": {"start_s": start, "end_s": end, "source": source},
                   "files": {"video": f"{base}.mp4", "csv": f"{base}.csv"}, "video_fps": rec.fps,
                   "frames": {"captured": rec.frames, "analysed": len(g.rows), "skipped": rec.dropped},
                   "summary": res}, fh, indent=1)
    print(f"Saved {base}.json (summary), {base}.csv (every frame) and {base}.mp4 (raw, {rec.fps:.1f} fps)\n"
          f"{rec.frames} frames captured, {len(g.rows)} analysed, {rec.dropped} skipped by a busy model")
    if start is not None:
        print(f"Analysed ({source}): {start:.1f} s to {end:.1f} s of the recording")
    report(res)


if __name__ == "__main__":
    main()
