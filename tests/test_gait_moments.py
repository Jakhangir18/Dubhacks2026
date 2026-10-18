"""gait.py's live feed, without a camera or a model: stride peaks from synthetic knee angles, which moments the
judge tells and how often, the drawn picture, and the whole feed from frames to the poster. Skipped where the
side-camera stack (OpenCV, MediaPipe) is not installed."""

import base64
import math
import types

import pytest

gait = pytest.importorskip("gait")
np = pytest.importorskip("numpy")
cv2 = pytest.importorskip("cv2")


def walk(peak, seconds=10, fps=30, phase=0.0, swing_px=40, gap=None):
    """(t, ankle ahead of the hip px, knee flexion deg) of a synthetic walk to the right: a strike each second at
    t = k + .25 + phase, the knee peaking mid-swing at t = k + phase. gap = (a, b): no frames in that time."""
    out = []
    for i in range(int(seconds * fps)):
        t = i / fps
        if gap and gap[0] <= t < gap[1]:
            continue
        c = t - phase
        out.append((t, swing_px * math.sin(2 * math.pi * c), 5 + (peak - 5) * max(0.0, math.sin(2 * math.pi * (c - 0.75)))))
    return out


def strides(frames):
    w = gait.StrideWatcher()
    return [got for t, fwd, flex in frames if (got := w.add(t, fwd, 25.0, flex, 200.0))]


def test_each_stride_reports_its_swing_peak_and_when_it_was():
    got = strides(walk(60))
    assert 7 <= len(got) <= 9, got                         # ten 1 s strides: the first needs two strikes, the last its confirmation
    for peak, at in got:
        assert abs(peak - 60) < 1.5 and min(at % 1, 1 - at % 1) < 0.05, (peak, at)
    low = strides(walk(30, fps=10, phase=0.03))             # the phone's rate, the peak between two frames
    assert len(low) >= 7 and all(abs(p - 30) < 3 for p, _ in low), low
    assert strides(walk(60, swing_px=3)) == []              # standing still, the knee only twitching: no strides
    gapped = strides(walk(60, gap=(4, 6)))
    assert len(gapped) >= 5 and not any(4 < at < 6 for _, at in gapped)   # strides across lost tracking are not counted
    facing_left = [(t, -fwd, flex) for t, fwd, flex in walk(60)]
    w = gait.StrideWatcher()
    assert len([1 for t, fwd, flex in facing_left if w.add(t, fwd, -25.0, flex, 200.0)]) >= 7


def test_judge_tells_low_good_and_uneven_with_the_throttles():
    j = gait.MomentJudge()
    low = [m for t in range(60) for m in j.stride("L", 30.0, float(t))]        # a low left stride every second
    assert low == [{"kind": "knee_low", "side": "L", "valueDeg": 30.0, "targetDeg": gait.KNEE_LOW_DEG, "t": t} for t in (0.0, 20.0, 40.0)]
    j = gait.MomentJudge()
    good = [m for t in range(130) for s in ("L", "R") for m in j.stride(s, 58.0, t + (0.5 if s == "R" else 0.0))]
    assert [(m["kind"], m["t"]) for m in good] == [("good", 0.0), ("good", 60.0), ("good", 120.0)]   # once a minute, either leg
    j = gait.MomentJudge()
    told = []
    for t in range(1, 30):
        told += j.stride("L", 50.0, t - 0.5) + j.stride("R", 30.0, float(t))   # the right knee lifts 20 deg less
    kinds = [(m["kind"], m["side"], m["t"]) for m in told]
    assert kinds[:3] == [("knee_low", "R", 1.0), ("uneven", "R", 2.0), ("knee_low", "R", 21.0)]   # uneven needs two strides a side
    uneven = [m for m in told if m["kind"] == "uneven"]
    assert uneven[0]["valueDeg"] == 30.0 and uneven[0]["targetDeg"] == 50.0 and [m["t"] for m in uneven] == [2.0, 22.0]
    j = gait.MomentJudge()
    capped = [m for t in range(600) for m in j.stride("L", 30.0, float(t))]
    assert len(capped) == gait.MAX_MOMENTS


def legs_at(t, peak=30.0):
    """update()'s legs for a synthetic frame: both legs below one hip, the knee forward and the ankle swinging."""
    out = {}
    for s, phase in (("L", 0.0), ("R", 0.5)):
        c = t - phase
        flex = 5 + (peak - 5) * max(0.0, math.sin(2 * math.pi * (c - 0.75)))
        ax = 320 + 40 * math.sin(2 * math.pi * c)
        out[s] = gait.Leg(hip=(320.0, 170.0), knee=(320 + 1.2 * flex, 290.0), ankle=(ax, 400.0),
                          heel=(ax - 10, 420.0), toe=(ax + 25, 420.0), angle=180 - flex)
    return out


def photo():
    """A 640x480 frame with a gradient and a figure, smooth like a camera picture rather than noise."""
    frame = np.zeros((480, 640, 3), np.uint8)
    frame[:, :, 0] = np.linspace(60, 180, 640, dtype=np.uint8)[None, :]
    frame[:, :, 1] = np.linspace(40, 160, 480, dtype=np.uint8)[:, None]
    frame[:, :, 2] = 90
    cv2.rectangle(frame, (0, 420), (640, 480), (70, 70, 70), -1)
    cv2.rectangle(frame, (290, 100), (350, 300), (120, 110, 100), -1)
    return frame


def test_moment_picture_is_a_small_jpeg_of_the_legs_with_the_leg_in_question_highlighted():
    jpg = gait.draw_moment(photo(), legs_at(1.0), "L", 28, 40)
    assert jpg[:2] == b"\xff\xd8" and len(jpg) < 60_000, len(jpg)
    img = cv2.imdecode(np.frombuffer(jpg, np.uint8), cv2.IMREAD_COLOR)
    assert max(img.shape[:2]) <= gait.MOMENT_PX and img.shape[0] < 400          # the legs, not the whole 480 px frame
    b, g, r = (img[:, :, i].astype(int) for i in range(3))
    assert np.sum((b < 140) & (g > 200) & (r > 200)) > 300                       # the yellow sticks and arc
    assert np.sum((b > 200) & (g > 200) & (r > 200)) > 100                       # the white ghost shin and its number
    big = gait.draw_moment(cv2.resize(photo(), (1280, 960)), {s: gait.Leg(*[(x * 2, y * 2) for x, y in (l.hip, l.knee, l.ankle, l.heel, l.toe)], l.angle)
                                                              for s, l in legs_at(1.0).items()}, "R", 57, 55)
    assert len(big) < 60_000 and max(cv2.imdecode(np.frombuffer(big, np.uint8), cv2.IMREAD_COLOR).shape[:2]) <= gait.MOMENT_PX
    assert gait.draw_moment(photo(), {"L": gait.Leg((700, 500), (700, 520), (700, 540), (700, 545), (710, 545), 170.0)}, "L", 20, 40) is None


def test_pose_points_are_the_twelve_named_landmarks_clamped():
    lm = [types.SimpleNamespace(x=i / 40, y=1.5 if i == 31 else -0.2 if i == 11 else 0.5, visibility=0.9) for i in range(33)]
    pts = gait.pose_points(lm)
    assert set(pts) == {"l_shoulder", "r_shoulder", "l_hip", "r_hip", "l_knee", "r_knee", "l_ankle", "r_ankle", "l_heel", "r_heel", "l_toe", "r_toe"}
    assert pts["l_hip"] == [0.575, 0.5, 0.9] and pts["l_toe"][1] == 1.0 and pts["l_shoulder"][1] == 0.0


class FakePoster:
    def __init__(self):
        self.poses, self.moments = [], []

    def send_pose(self, event):
        self.poses.append(event)

    def send_moment(self, body):
        self.moments.append(body)


def test_the_live_feed_posts_the_skeleton_and_the_moments_of_the_session():
    poster = FakePoster()
    pose = {"pts": {"l_hip": [0.5, 0.4, 0.9]}, "knee": {"L": 30.0, "R": None}}
    rec = types.SimpleNamespace(g=types.SimpleNamespace(pose=pose), start_epoch=1_700_000_000.0)
    follower = types.SimpleNamespace(current=None)
    feed = gait.LiveFeed(poster, rec, follower)
    frame = photo()
    for i in range(60):                                     # 2 s before the game: skeleton only
        feed.frame(i / 30, frame, legs_at(i / 30))
    assert not poster.moments and 7 <= len(poster.poses) <= 9
    assert poster.poses[0] == {"kind": "pose", "source": "side", "t": 1_700_000_000.0, **pose}
    follower.current = {"id": "ab" * 16, "player": "Mia", "start": 2.0}
    for i in range(60, 300):                                # 8 s of low knees in the game
        feed.frame(i / 30, frame, legs_at(i / 30))
    assert len(poster.poses) <= 41 and all(p["t"] - 1_700_000_000.0 <= 10 for p in poster.poses)
    kinds = [(m["kind"], m["side"]) for m in poster.moments]
    assert ("knee_low", "L") in kinds and ("knee_low", "R") in kinds and len(poster.moments) <= 4, kinds
    m = poster.moments[0]
    assert m["sessionId"] == "ab" * 16 and m["targetDeg"] == gait.KNEE_LOW_DEG and abs(m["valueDeg"] - 30) < 2
    frac = (m["t"] + 2.0 - (0.0 if m["side"] == "L" else 0.5)) % 1   # the peak, back on the recording clock: whole seconds left, half seconds right
    assert 0 <= m["t"] <= 8 and min(frac, 1 - frac) < 0.1, (m["side"], m["t"])
    jpg = base64.b64decode(m["jpg"])
    assert jpg[:2] == b"\xff\xd8" and len(jpg) < 60_000
    assert feed.judge.count == len(poster.moments)
    follower.current = {"id": "cd" * 16, "player": "Mia", "start": 10.0}   # the next game starts its own count
    feed.frame(10.0, frame, legs_at(10.0))
    assert feed.judge.count == 0
