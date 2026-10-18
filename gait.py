"""Side-view gait analysis utility (MediaPipe Pose). Whole person must be visible from the side.

    from gait import GaitTracker, open_camera
    g = GaitTracker()
    cap = open_camera("iphone")                 # or cv2.VideoCapture("walk.mp4")
    while True:
        ok, frame = cap.read()
        if not ok: break
        legs = g.update(frame, t)               # t = seconds, increasing (time.time() - start, or frame_idx / fps)
        g.draw(frame)                           # optional overlay
        print(legs.get("L"))                    # Leg or None per side; angle 180 = straight knee
    print(g.summary())                          # cadence, stride times, knee bend, strikes (None if too little data)
    g.save_csv("walk.csv")

Demo:  python gait.py --video walk.mp4   |   python gait.py --camera-name iphone     (q to stop)
Send the result to the dashboard server:  add  --server http://localhost:8000 --player Alex   (or call post_gait)
Use one GaitTracker per video stream. Check:  python test_gait.py
"""
import argparse
import atexit
import csv
import json
import math
import os
import statistics
import time
import urllib.error
import urllib.request
from dataclasses import dataclass

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

from feet import open_camera  # noqa: F401  (re-exported so callers need one import)

MODEL = "models/pose_landmarker_lite.task"  # downloaded on first use (~6 MB)
MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
             "pose_landmarker_lite/float16/latest/pose_landmarker_lite.task")
SIDES = {"L": (23, 25, 27, 29, 31), "R": (24, 26, 28, 30, 32)}  # hip, knee, ankle, heel, toe
FIELDS = ("hip_x", "knee", "ankle_x", "heel_x", "toe_x")
MIN_VIS = 0.5  # leg joints below this confidence are ignored


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


def analyze(rows):
    """rows: dicts with t and {L,R}_{hip_x,knee,ankle_x,heel_x,toe_x} (None if not visible). None if too little data."""
    side_rows = {s: [r for r in rows if r[f"{s}_knee"] is not None] for s in SIDES}
    # facing direction: toes point where we walk
    dx = [r[f"{s}_toe_x"] - r[f"{s}_heel_x"] for s in SIDES for r in side_rows[s]]
    if len(dx) < 10:
        return None
    direction = 1 if statistics.median(dx) > 0 else -1
    res = {"direction": "right" if direction > 0 else "left", "strikes": {}, "stride": {}, "flexion": {}}
    for s, rs in side_rows.items():
        ts = [r["t"] for r in rs]
        res["strikes"][s] = find_strikes(ts, [direction * (r[f"{s}_ankle_x"] - r[f"{s}_hip_x"]) for r in rs]) if rs else []
        st = res["strikes"][s]
        res["stride"][s] = statistics.mean(b - a for a, b in zip(st, st[1:])) if len(st) > 1 else None
        angles = sorted(r[f"{s}_knee"] for r in rs)
        res["flexion"][s] = angles[len(angles) // 20] if angles else None  # 5th percentile: peak bend, outlier-safe
    allst = sorted(res["strikes"]["L"] + res["strikes"]["R"])
    res["cadence"] = (len(allst) - 1) / (allst[-1] - allst[0]) * 60 if len(allst) > 2 else None
    res["asymmetry"] = {"stride": asym(res["stride"]["L"], res["stride"]["R"]),
                        "flexion": asym(res["flexion"]["L"], res["flexion"]["R"])}  # percent
    return res


def asym(a, b):
    return None if a is None or b is None else 100 * abs(a - b) / ((a + b) / 2)


def report(res):
    """Print a summary() result."""
    if res is None:
        return print("Not enough pose data. Is the whole person visible from the side?")
    f = lambda v, u="": "n/a" if v is None else f"{v:.1f}{u}"
    print(f"\nWalking direction: {res['direction']}")
    print(f"Foot strikes: L {len(res['strikes']['L'])}, R {len(res['strikes']['R'])}")
    print(f"Cadence: {f(res['cadence'], ' steps/min')}")
    for s in SIDES:
        print(f"{s}: stride time {f(res['stride'][s], ' s')}, peak knee bend {f(res['flexion'][s], ' deg (lower = more bend)')}")
    print(f"Asymmetry: stride time {f(res['asymmetry']['stride'], '%')}, knee bend {f(res['asymmetry']['flexion'], '%')}")


def post_gait(server, player, summary, rows):
    """Send a finished walk to the game server (POST /api/gait). Returns {id, ts, frames}.
    Raises RuntimeError if there is nothing to send or the server cannot be reached."""
    if summary is None:
        raise RuntimeError("Not enough pose data to send.")
    body = json.dumps({"player": player, "summary": summary, "rows": rows}).encode()
    req = urllib.request.Request(server.rstrip("/") + "/api/gait", body, {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.load(resp)
    except (urllib.error.URLError, OSError) as e:
        raise RuntimeError(f"Could not send to {server}: {e}") from e


class GaitTracker:
    def __init__(self):
        if not os.path.exists(MODEL):
            os.makedirs(os.path.dirname(MODEL), exist_ok=True)
            print("Downloading pose model (one time)...")
            urllib.request.urlretrieve(MODEL_URL, MODEL)
        self.landmarker = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO))
        self.rows = []     # one dict per frame, the raw data behind summary() and save_csv()
        self.found = False  # was a person found in the last frame
        self._seen = []    # (side, points, confidence) of the last frame, for draw()

    def update(self, frame, t):
        """Process one BGR frame at time t (seconds, must increase). Returns {"L": Leg, "R": Leg}, only confident sides."""
        h, w = frame.shape[:2]
        rgb = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        result = self.landmarker.detect_for_video(rgb, int(t * 1000))
        lm = result.pose_landmarks[0] if result.pose_landmarks else None
        self.found, self._seen = lm is not None, []
        row, legs = {"t": round(t, 3)}, {}
        for s, ids in SIDES.items():
            vis = min(lm[i].visibility for i in ids) if lm else 0
            if lm:
                xy = [(lm[i].x * w, lm[i].y * h) for i in ids]
                self._seen.append((s, xy, vis))
            if vis >= MIN_VIS:
                legs[s] = Leg(*xy, angle=knee_angle(*xy[:3]))
                row.update({f"{s}_{k}": v for k, v in zip(FIELDS, (xy[0][0], legs[s].angle, xy[2][0], xy[3][0], xy[4][0]))})
            else:
                row.update({f"{s}_{k}": None for k in FIELDS})
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
        """Cadence, stride time, knee bend, asymmetry over everything seen so far (None if too little data)."""
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
    p.add_argument("--server", help="game server to send the result to, e.g. http://localhost:8000")
    p.add_argument("--player", default="Player", help="player name the walk is saved under (with --server)")
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

    g, start, n = GaitTracker(), time.time(), 0
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
    if args.server:
        try:
            print("Sent to server:", post_gait(args.server, args.player, g.summary(), g.rows))
        except RuntimeError as e:
            print(e)


if __name__ == "__main__":
    main()
