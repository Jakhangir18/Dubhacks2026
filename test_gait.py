"""Check for the gait math (no camera or model needed). Run: python test_gait.py"""
import math

from gait import analyze, asym, joint_angles, knee_angle

S = lambda x: math.sin(2 * math.pi * x)
rows = []
for i in range(300):  # 10 s at 30 fps, walking right; each foot cycles once per second, R half a cycle behind
    t = i / 30
    row = {"t": t, "cm_per_px": 0.5, "trunk_lean": 5}
    for s, ph in (("L", 0), ("R", 0.5)):
        c = t - ph
        ax = 300 + 40 * S(c)                          # ankle peaks forward at c = .25 (strike), toe back at .75 (toe-off)
        toe_y = 500 - 10 * max(0, S(c - 0.75))         # 10 px = 5 cm lift during swing
        row.update({f"{s}_hip_x": 300, f"{s}_hip_y": 300 + 4 * S(2 * t), f"{s}_knee_x": 300, f"{s}_knee_y": 400,
                    f"{s}_ankle_x": ax, f"{s}_ankle_y": 490, f"{s}_heel_x": ax - 5, f"{s}_heel_y": toe_y,
                    f"{s}_toe_x": ax + 20, f"{s}_toe_y": toe_y, f"{s}_knee": 150 - 20 * S(c), f"{s}_hip": 20 * S(c),
                    f"{s}_ankle": 10 * S(c), f"{s}_shoulder_x": 300, f"{s}_wrist_x": 300 - 30 * S(c)})
    rows.append(row)
res = analyze(rows)
near = lambda v, want, tol: abs(v - want) < tol or print(v, "!=", want)
assert res["direction"] == "right"
assert near(res["cadence"], 120, 6)
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

assert abs(knee_angle((0, 0), (0, 1), (0, 2)) - 180) < 1e-6 and abs(knee_angle((0, 0), (0, 1), (1, 1)) - 90) < 1e-6
leg = {"shoulder": (0, -50), "hip": (0, 0), "knee": (30, 30), "ankle": (30, 80), "heel": (25, 90), "toe": (45, 85)}
hip, ankle = joint_angles(leg, 1)                     # facing right: knee in front = flexion, toes up = dorsiflexion
assert abs(hip - 45) < 1e-6 and 0 < ankle < 20, (hip, ankle)
assert abs(joint_angles(leg, -1)[0] + 45) < 1e-6      # same picture facing left = knee behind = extension
assert analyze([]) is None
print("ok")
