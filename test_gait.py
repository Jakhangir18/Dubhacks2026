"""Check for the gait math (no camera or model needed). Run: python test_gait.py"""
import math

from gait import analyze, asym, knee_angle

rows = []
for i in range(300):  # 10 s at 30 fps; ankles swing once per second, R half a cycle behind: 120 steps/min
    t = i / 30
    row = {"t": t}
    for s, ph in (("L", 0), ("R", 0.5)):
        row.update({f"{s}_hip_x": 100, f"{s}_ankle_x": 100 + 40 * math.sin(2 * math.pi * (t - ph)),
                    f"{s}_heel_x": 90, f"{s}_toe_x": 120, f"{s}_knee": 150 - 20 * math.sin(2 * math.pi * (t - ph))})
    rows.append(row)
res = analyze(rows)
assert res["direction"] == "right"
assert abs(res["cadence"] - 120) < 6, res["cadence"]
assert abs(res["stride"]["L"] - 1.0) < 0.1 and abs(res["stride"]["R"] - 1.0) < 0.1
assert asym(res["flexion"]["L"], res["flexion"]["R"]) < 5 and res["asymmetry"]["flexion"] < 5
assert abs(knee_angle((0, 0), (0, 1), (0, 2)) - 180) < 1e-6 and abs(knee_angle((0, 0), (0, 1), (1, 1)) - 90) < 1e-6
assert analyze([]) is None
print("ok")
