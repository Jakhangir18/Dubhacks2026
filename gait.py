"""Side-view gait analysis utility (MediaPipe Pose). Whole person must be visible from the side.

    from gait import GaitTracker, open_camera
    g = GaitTracker()                           # model="lite" | "full" (default) | "heavy"
    cap = open_camera("iphone")                 # or cv2.VideoCapture("walk.mp4")
    while True:
        ok, frame = cap.read()
        if not ok: break
        legs = g.update(frame, t)               # t = seconds, increasing (time.time() - start, or frame_idx / fps)
        g.draw(frame)                           # optional overlay
        print(legs.get("L"))                    # Leg or None per side; angle 180 = straight knee
    print(g.summary())                          # timing, joint angles, lengths, curves (None if too little data)
    g.save_csv("walk.csv")                      # every frame: all 33 landmarks (pixels + meters) and derived angles

Demo:  python gait.py --video walk.mp4   |   python gait.py --camera-name iphone     (q to stop)
Use one GaitTracker per video stream. Check:  python test_gait.py

Events follow Zeni et al. 2008: heel strike = ankle furthest in front of the hip, toe-off = toe furthest behind it.
Lengths are in cm, scaled by MediaPipe's own 3D (world) leg length, so expect roughly 10% absolute error;
trends and left/right asymmetry are the trustworthy part.
"""
import argparse
import atexit
import csv
import math
import os
import statistics
import subprocess
import time
import urllib.request
from dataclasses import dataclass

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

from feet import open_camera  # noqa: F401  (re-exported so callers need one import)

MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
             "pose_landmarker_{0}/float16/latest/pose_landmarker_{0}.task")  # lite ~6 MB, full ~9 MB, heavy ~30 MB
NAMES = [m.name.lower() for m in vision.PoseLandmark]  # the 33 MediaPipe landmarks, logged raw every frame
SIDES = {"L": (23, 25, 27, 29, 31, 11, 15), "R": (24, 26, 28, 30, 32, 12, 16)}  # hip knee ankle heel toe shoulder wrist
LEG = ("hip", "knee", "ankle", "heel", "toe")
MIN_VIS = 0.5     # joints below this confidence are ignored
CURVE_PTS = 51    # samples per normalised gait cycle (0, 2, ..., 100 %)


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
    ponytail: O(n^2) scan, fine for minutes of video; use numpy/scipy find_peaks for hours."""
    med = statistics.median(sig)
    out = []
    for i, v in enumerate(sig):
        if v > med and all(v >= s for t, s in zip(ts, sig) if abs(t - ts[i]) <= window) \
                and (not out or ts[i] - out[-1] > window):
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


def analyze(rows):
    """rows: per-frame dicts from GaitTracker (t, cm_per_px and {L,R}_<joint>_x/_y, _knee, _hip, _ankle,
    _shoulder_x, _wrist_x; None where not visible). Returns a dict of metrics, or None if too little data."""
    side_rows = {s: [r for r in rows if r.get(f"{s}_knee") is not None] for s in SIDES}
    dx = [r[f"{s}_toe_x"] - r[f"{s}_heel_x"] for s in SIDES for r in side_rows[s]]
    if len(dx) < 10:
        return None
    d = 1 if statistics.median(dx) > 0 else -1  # facing direction: toes point where we walk
    scales = [r["cm_per_px"] for r in rows if r.get("cm_per_px")]
    cm = statistics.median(scales) if scales else None
    to_cm = lambda px: None if cm is None or px is None else px * cm
    res = {"direction": "right" if d > 0 else "left", "cm_per_px": cm, "strikes": {}, "toe_offs": {},
           "stride": {}, "stride_cv": {}, "flexion": {}, "knee": {}, "hip": {}, "ankle": {}, "stance_pct": {},
           "toe_lift_cm": {}, "pelvis_bounce_cm": {}, "arm_swing_cm": {}, "foot_strike_deg": {},
           "heel_first_pct": {}, "step_time": {}, "step_length_cm": {}, "curves": {}}
    stance = {}
    for s, rs in side_rows.items():
        ts = [r["t"] for r in rs]
        col = lambda k: [r[f"{s}_{k}"] for r in rs]
        st = find_strikes(ts, smooth([d * (r[f"{s}_ankle_x"] - r[f"{s}_hip_x"]) for r in rs])) if rs else []
        to = find_strikes(ts, smooth([-d * (r[f"{s}_toe_x"] - r[f"{s}_hip_x"]) for r in rs])) if rs else []
        res["strikes"][s], res["toe_offs"][s] = st, to
        strides = [b - a for a, b in zip(st, st[1:])]
        typical = statistics.median(strides) if strides else None
        cycles = [(a, b) for a, b in zip(st, st[1:]) if b - a < 1.6 * typical]  # drop cycles spanning tracking gaps
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
    allst = [t for t, _ in events]
    res["cadence"] = (len(allst) - 1) / (allst[-1] - allst[0]) * 60 if len(allst) > 2 else None
    sl, stl = res["step_length_cm"], [res["stride"][s] for s in SIDES]
    res["stride_length_cm"] = sl["L"] + sl["R"] if sl["L"] and sl["R"] else None
    res["speed_m_s"] = res["stride_length_cm"] / 100 / mean(stl) if res["stride_length_cm"] and mean(stl) else None

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

    pair = lambda k, sub=None: asym(*[(res[k][s] if sub is None else (res[k][s] or {}).get(sub)) for s in SIDES])
    res["asymmetry"] = {"stride": pair("stride"), "flexion": pair("flexion"), "step_time": pair("step_time"),
                        "step_length": pair("step_length_cm"), "stance": pair("stance_pct"),
                        "knee_rom": pair("knee", "rom"), "hip_rom": pair("hip", "rom"),
                        "ankle_rom": pair("ankle", "rom"), "toe_lift": pair("toe_lift_cm"),
                        "arm_swing": pair("arm_swing_cm")}  # percent
    return _plain(res)


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
    print(f"\nWalking direction: {res['direction']}   scale: {f(res['cm_per_px'], ' cm/px')}")
    print(f"Foot strikes: L {len(res['strikes']['L'])}, R {len(res['strikes']['R'])}")
    print(f"Cadence {f(res['cadence'], ' steps/min')}   speed {f(res['speed_m_s'], ' m/s')}   "
          f"stride length {f(res['stride_length_cm'], ' cm')}   double support {f(res['double_support_pct'], '%')}")
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


class GaitTracker:
    def __init__(self, model="full"):
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
        self.rows = []     # one dict per frame, the raw data behind summary() and save_csv()
        self.found = False  # was a person found in the last frame
        self._seen = []    # (side, points, confidence) of the last frame, for draw()

    def update(self, frame, t):
        """Process one BGR frame at time t (seconds, must increase). Returns {"L": Leg, "R": Leg}, only confident sides."""
        h, w = frame.shape[:2]
        rgb = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        result = self.landmarker.detect_for_video(rgb, int(t * 1000))
        lm = result.pose_landmarks[0] if result.pose_landmarks else None
        wl = result.pose_world_landmarks[0] if result.pose_world_landmarks else None
        self.found, self._seen = lm is not None, []
        row, legs, facings, scales = {"t": round(t, 3)}, {}, [], []
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
            vals = dict.fromkeys([f"{j}_{a}" for j in LEG for a in "xy"] + ["knee", "hip", "ankle", "shoulder_x", "wrist_x"])
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
        self.rows.append(row)
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

    def summary(self):
        """All gait metrics over everything seen so far (None if too little data). See analyze()."""
        return analyze(self.rows)

    def save_csv(self, path):
        if self.rows:
            with open(path, "w", newline="") as fh:
                wr = csv.DictWriter(fh, fieldnames=list(self.rows[0]))
                wr.writeheader()
                wr.writerows(self.rows)


def main():
    p = argparse.ArgumentParser(description="Gait analysis demo (q to stop)")
    p.add_argument("--video", help="recorded side-view video")
    p.add_argument("--camera", type=int, help="camera index (overrides --camera-name)")
    p.add_argument("--camera-name", help="substring of camera name, e.g. iphone")
    p.add_argument("--model", default="full", choices=("lite", "full", "heavy"),
                   help="heavy is most accurate but slow live; fine for recorded video")
    args = p.parse_args()

    if args.video:
        cap = cv2.VideoCapture(args.video)
        if not cap.isOpened():
            raise SystemExit(f"Could not open video {args.video}")
    else:
        try:
            cap = open_camera(args.camera_name, args.camera)
        except RuntimeError as e:
            raise SystemExit(e)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    size = (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
    os.makedirs("out", exist_ok=True)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    writer = cv2.VideoWriter(f"out/gait_{stamp}.mp4", cv2.VideoWriter_fourcc(*"mp4v"), fps, size)
    atexit.register(writer.release)

    g, start, n = GaitTracker(args.model), time.time(), 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            g.update(frame, n / fps if args.video else time.time() - start)
            n += 1
            g.draw(frame)
            writer.write(frame)
            cv2.imshow("gait (q to stop)", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    except KeyboardInterrupt:
        pass
    cap.release()
    cv2.destroyAllWindows()

    g.save_csv(f"out/gait_{stamp}.csv")
    print(f"Saved out/gait_{stamp}.csv and out/gait_{stamp}.mp4\n{n} frames")
    report(g.summary())


if __name__ == "__main__":
    main()
