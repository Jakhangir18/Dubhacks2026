"""Check for the gait math (no camera or model needed). Run: python test_gait.py"""
import contextlib
import io
import json
import math
import os
import tempfile
import threading
import time
import types
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import gait
from gait import (
    SessionFollower,
    act_windows,
    analyze,
    asym,
    clock_offset,
    final_payload,
    joint_angles,
    json_safe,
    knee_angle,
    session_span,
    session_window,
    summarize,
    to_recording,
)

S = lambda x: math.sin(2 * math.pi * x)


def walk(seconds, fps=30):
    """Walking right; each foot cycles once per second, R half a cycle behind."""
    rows = []
    for i in range(int(seconds * fps)):
        t = i / fps
        row = {"t": t, "frame": i, "cm_per_px": 0.5, "trunk_lean": 5}
        for s, ph in (("L", 0), ("R", 0.5)):
            c = t - ph
            ax = 300 + 40 * S(c)                          # ankle peaks forward at c = .25 (strike), toe back at .75 (toe-off)
            toe_y = 500 - 10 * max(0, S(c - 0.75))         # 10 px = 5 cm lift during swing
            row.update({f"{s}_hip_x": 300, f"{s}_hip_y": 300 + 4 * S(2 * t), f"{s}_knee_x": 300, f"{s}_knee_y": 400,
                        f"{s}_ankle_x": ax, f"{s}_ankle_y": 490, f"{s}_heel_x": ax - 5, f"{s}_heel_y": toe_y,
                        f"{s}_toe_x": ax + 20, f"{s}_toe_y": toe_y, f"{s}_knee": 150 - 20 * S(c), f"{s}_hip": 20 * S(c),
                        f"{s}_ankle": 10 * S(c), f"{s}_shoulder_x": 300, f"{s}_wrist_x": 300 - 30 * S(c)})
        rows.append(row)
    return rows


rows = walk(10)
res = analyze(rows)
near = lambda v, want, tol: abs(v - want) < tol or print(v, "!=", want)
assert res["direction"] == "right"
assert near(res["cadence"], 120, 6) and near(res["cadence_steps"], 120, 6)
assert near(res["fps"], 30, 0.5) and res["glitch_frames"] == 0
for s in "LR":
    assert near(res["stride"][s], 1.0, 0.1) and res["stride_cv"][s] < 5
    assert near(res["step_time"][s], 0.5, 0.1)
    assert near(res["stance_pct"][s], 50, 8)
    assert near(res["step_length_cm"][s], 40, 4)
    assert near(res["toe_lift_cm"][s], 5, 1)
    assert near(res["pelvis_bounce_cm"][s], 4, 1)
    assert near(res["arm_swing_cm"][s], 30, 3)
    assert near(res["knee"][s]["rom"], 40, 6) and near(res["hip"][s]["rom"], 40, 6)
    assert near(res["foot_strike_deg"][s], 0, 2) and res["heel_first_pct"][s] == 0
    assert len(res["curves"][s]["knee"]) == 51
assert near(res["stride_length_cm"], 80, 8) and near(res["speed_m_s"], 0.8, 0.1)
assert res["double_support_pct"] < 10 and res["trunk_lean"]["mean"] == 5
assert all(v is None or v < 5 for v in res["asymmetry"].values()), res["asymmetry"]
assert asym(res["flexion"]["L"], res["flexion"]["R"]) < 5

# glitch frames (a flipped skeleton, a foot jumping across the frame) are blanked, not averaged in
bad = [dict(r) for r in rows]
bad[100].update(trunk_lean=-170, L_toe_y=0)
bad[200]["R_ankle_x"] += 5000
res = analyze(bad)
assert res["glitch_frames"] == 2, res["glitch_frames"]
assert near(res["toe_lift_cm"]["L"], 5, 1) and res["trunk_lean"]["mean"] == 5

# a tracking gap does not drag cadence down (the old formula counted the gap as walking time)
res = analyze([r for r in rows if not 4 <= r["t"] < 6])
assert near(res["cadence"], 120, 6) and near(res["cadence_steps"], 120, 6)

# a long session is analysed in windows, fast, and keeps a per-window trend
long = walk(300)
start = time.time()
res = summarize(long)
took = time.time() - start
assert len(res["windows"]) == 10 and took < 15, (len(res["windows"]), took)
assert near(res["cadence"], 120, 6) and near(res["toe_lift_cm"]["L"], 5, 1)
assert len(res["strikes"]["L"]) > 280 and res["windows"][0]["start"] == 0
assert json.loads(json.dumps(res, allow_nan=False))["cadence"] == res["cadence"]  # the summary file must be plain JSON
assert all(v is None or v < 5 for v in res["asymmetry"].values()), res["asymmetry"]

# trimming keeps only the requested part
res = summarize(rows, 2, 8)
assert all(2 <= t <= 8 for s in "LR" for t in res["strikes"][s])
assert session_window(rows, None, 0, 1, 2)[:2] == (1, rows[-1]["t"] - 2)
assert session_window(rows, (1000 + 3, 1000 + 7), 1000, 1, 2) == (3, 7, "game session")

assert abs(knee_angle((0, 0), (0, 1), (0, 2)) - 180) < 1e-6 and abs(knee_angle((0, 0), (0, 1), (1, 1)) - 90) < 1e-6
leg = {"shoulder": (0, -50), "hip": (0, 0), "knee": (30, 30), "ankle": (30, 80), "heel": (25, 90), "toe": (45, 85)}
hip, ankle = joint_angles(leg, 1)                     # facing right: knee in front = flexion, toes up = dorsiflexion
assert abs(hip - 45) < 1e-6 and 0 < ankle < 20, (hip, ankle)
assert abs(joint_angles(leg, -1)[0] + 45) < 1e-6      # same picture facing left = knee behind = extension
assert analyze([]) is None
assert summarize([]) is None

# ---------------------------------------------------------------- game sessions (vision/CONTRACT.md)
# the server's clock 5 s ahead: its startedAt lands on the recording clock all the same
off = clock_offset(105.1, 100.0, 100.2)
assert abs(off - 5.0) < 1e-9 and abs(to_recording(1105.0, off, 1000.0) - 100.0) < 1e-9

# segments to act windows: shifted to the session start, pauses cut out, short pieces and junk dropped
segs = [{"act": "walk", "round": 1, "startS": 0, "endS": 40}, {"act": "garden", "round": 1, "startS": 40, "endS": 80},
        {"act": "storm", "round": 1, "startS": 80, "endS": 120}, {"act": "garden", "round": 2, "startS": 120, "endS": 125},
        {"act": "storm", "round": 2, "startS": 125, "endS": 170}, {"act": "home", "startS": 170, "endS": 171},
        {"act": "garden", "startS": None, "endS": 3}, "junk"]
pauses = [[30, 35], [140, 150], ["x", 1]]
w = act_windows(segs, pauses, start=10)
assert w == {"walk": [(10, 40)], "garden": [(50, 90)], "storm": [(90, 130), (135, 150), (160, 180)]}, w
assert act_windows(segs, pauses, start=10, end=175)["storm"][-1] == (160, 175)
assert act_windows(segs, pauses, start=10, end=165)["storm"] == [(90, 130), (135, 150)]   # 5 s left: dropped
assert act_windows(None) == {}

# the game's own length beats the moment the active session vanished (after the server's note and reward)
assert session_span(5, {"wallSeconds": 60}, 80) == (5, 65)
assert session_span(5, {"wallSeconds": 60}, 50) == (5, 50)
assert session_span(5, {"segments": segs[:3]}, 200) == (5, 125)
assert session_span(5, None, 70) == (5, 70) and session_span(5, None) == (5, None)

# the final payload: whole-session summary with curves, each act merged across rounds without curves or windows
long = walk(180)
game = {"wallSeconds": 180, "pauses": [], "segments": [
    {"act": "walk", "startS": 0, "endS": 40}, {"act": "garden", "startS": 40, "endS": 80},
    {"act": "storm", "startS": 80, "endS": 120}, {"act": "garden", "startS": 120, "endS": 150},
    {"act": "storm", "startS": 150, "endS": 180}]}
pay = final_payload("abc123", long, 0, 180, game, 5410, 10)
assert pay["sessionId"] == "abc123" and pay["source"] == "side-camera"
assert pay["quality"] == {"fps": 30.0, "framesCaptured": 5410, "framesAnalysed": len(long), "framesSkipped": 10}, pay["quality"]
assert set(pay["perAct"]) == {"walk", "garden", "storm"}
assert all("curves" not in a and "windows" not in a for a in pay["perAct"].values())
assert "curves" in pay["summary"] and "windows" in pay["summary"]
assert len(pay["perAct"]["garden"]["strikes"]["L"]) > 60          # both garden rounds (70 s) in one entry
assert near(pay["perAct"]["storm"]["cadence"], 120, 6)
json.dumps(pay, allow_nan=False)                                   # plain JSON for the server
assert pay["summary"]["seen_frames"] == {"L": len(long), "R": len(long)}   # how often each leg was seen (near side)

# a pause (Space or the zone setup) is left out of the whole-session numbers too, not only out of the acts
paused = final_payload("abc123", long, 0, 180, {**game, "pauses": [[50, 60]]}, 5410, 10)
assert paused["quality"]["framesAnalysed"] == len(long) - 301, paused["quality"]
assert near(paused["summary"]["cadence"], 120, 6)

# the session could not be fetched: the session window only, no acts; too little seen: summary None
pay = final_payload("abc123", long, 10, 70, None, 1800, 0)
assert pay["perAct"] == {} and near(pay["summary"]["cadence"], 120, 6) and pay["quality"]["framesAnalysed"] == 1801
pay = final_payload("abc123", [], 0, 60, game, 0, 0)
assert pay["summary"] is None and pay["perAct"] == {} and pay["quality"]["framesAnalysed"] == 0
assert json_safe({"a": [float("nan"), 1.5], "b": float("inf")}) == {"a": [None, 1.5], "b": None}


# follow mode against a fake server: one session starts, gets live summaries, ends, and its final is posted
class FakeServer(BaseHTTPRequestHandler):
    polls, gait, finals = 0, [], []

    def log_message(self, *a):
        pass

    def reply(self, body, status=200):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/api/session/active":
            FakeServer.polls += 1
            on = FakeServer.polls <= 4
            self.reply({"id": "s1d2e3f4a5", "player": "Mia", "startedAt": START, "serverTime": time.time()} if on
                       else {"serverTime": time.time()})
        elif self.path == "/api/session/s1d2e3f4a5":
            self.reply({"id": "s1d2e3f4a5", "player": "Mia", "summary": {"wallSeconds": 60, "segments": [
                {"act": "walk", "startS": 0, "endS": 30}, {"act": "garden", "startS": 30, "endS": 60}]}})
        else:
            self.reply({"detail": "Not Found"}, 404)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        (FakeServer.gait if self.path == "/api/gait" else FakeServer.finals).append(body)
        self.reply({"ok": True}, 202 if self.path == "/api/gait/final" else 200)


class FakeRec:
    def __init__(self, rows):
        self.stop, self.start_epoch, self.frames, self.dropped = threading.Event(), time.time(), 1900, 0
        self.g = types.SimpleNamespace(rows=rows)

    def now(self):
        return time.time() - self.start_epoch + 65   # the game ended a few seconds before the server cleared it

    def capturing(self):
        return False


gait.POLL, gait.LIVE_EVERY = 0.05, 0
http = ThreadingHTTPServer(("127.0.0.1", 0), FakeServer)
threading.Thread(target=http.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{http.server_address[1]}"
rec = FakeRec(walk(70))
START = rec.start_epoch                      # the session started with the recording
with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()):
    f = SessionFollower(url, rec, os.path.join(tmp, "gait_x"), once=True)
    runner = threading.Thread(target=f.run, daemon=True)
    runner.start()
    assert rec.stop.wait(10), "follow mode never finished the session"
    f.wait()
    runner.join(2)
    saved = os.path.exists(os.path.join(tmp, "gait_x_s1d2e3f4.json"))
    # a follower for another player leaves Mia's session alone
    FakeServer.polls = 0
    rec2 = FakeRec(walk(70))
    other = SessionFollower(url, rec2, os.path.join(tmp, "gait_y"), player="Bo")
    threading.Thread(target=other.run, daemon=True).start()
    time.sleep(0.5)
    rec2.stop.set()
http.shutdown()
assert saved and len(FakeServer.finals) == 1, FakeServer.finals
fin = FakeServer.finals[0]
assert fin["sessionId"] == "s1d2e3f4a5" and set(fin["perAct"]) == {"walk", "garden"}, fin.get("perAct", {}).keys()
assert near(fin["summary"]["cadence"], 120, 6) and abs(fin["quality"]["framesAnalysed"] - 1801) <= 1, fin["quality"]   # 0 to 60 s, not 65
assert FakeServer.gait and all(g["sessionId"] == "s1d2e3f4a5" and g["player"] == "Mia" for g in FakeServer.gait)
assert other.current is None and other.workers == []
print("ok")
