"""Gait review tests: what the model may see, the rule-based review, and the checks on a model's reply.
Everything runs offline; the model call is replaced where a test needs it."""

import copy
import json
from pathlib import Path

from server import gait_review, gemini

SHORT = json.loads((Path(__file__).parent / "fixtures" / "gait_short_walk.json").read_text())
LIMITS = {"minCadence": 80, "liftCm": 10, "liftRange": [6, 18], "spacingCm": 140, "spacingRange": [90, 220]}


def good_summary():
    """A steady walk to the left of the picture (left leg nearer the camera), every value plausible."""
    s = copy.deepcopy(SHORT["summary"])
    s.update({"strike_counts": {"L": 40, "R": 41}, "stride": {"L": 1.1, "R": 1.12}, "stride_cv": {"L": 3.0, "R": 2.5},
              "stance_pct": {"L": 62, "R": 61}, "pelvis_bounce_cm": {"L": 4, "R": 4}, "double_support_pct": 22,
              "heel_first_pct": {"L": 90, "R": 95}, "toe_lift_cm": {"L": 9, "R": 10}, "step_length_cm": {"L": 50, "R": 52},
              "stride_length_cm": 102, "speed_m_s": 0.9, "cadence": 104, "cadence_steps": 103,
              "ankle": {"L": {"peak_dorsi": 10, "peak_plantar": -15, "rom": 25}, "R": {"peak_dorsi": 11, "peak_plantar": -16, "rom": 27}},
              "asymmetry": {"stride": 2, "step_time": 3, "step_length": 4, "stance": 2, "knee_rom": 20, "toe_lift": 10, "arm_swing": 9}})
    s.pop("strikes")
    return s


def game(**over):
    g = {"seconds": 240, "steps": 400, "cadence": 100, "asymmetryPct": 6, "stompPct": 70, "dodgePct": 80, "formPct": 85,
         "shoeMode": True, "rounds": 2, "stepsByFoot": {"L": 200, "R": 200},
         "byLane": {"flower": {"L": [3, 8], "R": [8, 8]}, "seed": {"L": [5, 6], "R": [6, 6]}},
         "placementCm": {"L": 30, "R": 12}, "timingS": None, "swingCm": {"L": 40, "R": 44},
         "timeline": [{"t": 15 * i, "cadence": c, "evenPct": 95, "act": "garden"} for i, c in enumerate([104, 102, 100, 88, 86, 84])]}
    g.update(over)
    return g


def view(gait=None, history=(), player=None, **game_over):
    gait = gait if gait is not None else {"summary": good_summary(), "quality": {"fps": 30, "framesCaptured": 7000, "framesAnalysed": 6900, "framesSkipped": 100}}
    return gait_review.build_view(game(**game_over), gait, list(history), player or {"name": "Mia", "limits": LIMITS, "notes": ""})


def ids(v):
    return {m["id"]: m for m in v["metrics"]}


# ---------------------------------------------------------------- what the model may see
def test_a_short_glitchy_walk_is_poor_and_withholds_impossible_values():
    v = gait_review.build_view({}, {"summary": SHORT["summary"], "quality": SHORT["quality"]}, [], {"limits": LIMITS})
    assert v["dataQuality"]["level"] == "poor"            # one stride of the near leg
    assert v["near"] == "L"                               # walking to the left shows the left side
    m = ids(v)
    assert m["knee_flexion_peak_L"]["value"] == 43.8      # 180 - the inside angle gait.py logs
    assert m["knee_flexion_peak_L"]["trust"] == "good" and m["knee_flexion_peak_R"]["trust"] == "low"
    withheld = {w["id"] for w in v["withheld"]}
    assert {"pelvis_bounce_L", "double_support", "stance_R", "ankle_plantarflexion_peak_R"} <= withheld
    assert not withheld & set(m)


def test_no_side_camera_summary_still_gives_a_game_view():
    v = gait_review.build_view(game(), {"summary": None}, [], {"limits": LIMITS})
    assert v["dataQuality"]["level"] == "poor" and v["near"] is None
    assert all(x["group"] == "game" for x in v["metrics"])


def test_game_numbers_lanes_halves_and_asymmetry_trust():
    m = ids(view())
    assert m["flowers_hit_L"]["value"] == 37.5 and "3 of 8" in m["flowers_hit_L"]["label"]
    assert m["game_cadence_first_half"]["value"] > m["game_cadence_second_half"]["value"]
    assert m["game_even_lr"]["value"] == 94
    assert m["asym_step_length"]["trust"] == "low"
    assert "high_lift_L" not in m                         # shoe mode: no lift heights


def test_per_act_numbers_and_earlier_sessions():
    part = {k: v for k, v in good_summary().items() if k not in ("curves", "windows")}
    gait = {"summary": good_summary(), "perAct": {"walk": part, "garden": {**part, "cadence": 96}}, "quality": {}}
    history = [{"ts": 1, "gaitReview": {"status": "done", "metrics": [{"id": "cadence", "value": 90}, {"id": "cadence", "value": 100}],
                                        "review": {"focus": {"text": "Land on the heel"}}}}]
    v = view(gait, history)
    m = ids(v)
    assert m["cadence@garden"]["value"] == 96 and m["cadence@garden"]["group"] == "gait@garden"
    assert "stride_length@walk" not in m                  # per act: the short list only
    assert m["cadence"]["prev"] == 95
    assert v["earlierFocus"][0].endswith("Land on the heel")


def test_no_free_text_leaves_only_numbers_and_fixed_words():
    v = view(player={"name": "Mia", "limits": LIMITS, "notes": "Mia tires on the left; mom Sarah watches"})
    sent = json.dumps(gait_review.model_input(v))
    assert "Mia" not in sent and "Sarah" not in sent


def test_near_side_follows_what_the_camera_saw_then_the_direction():
    assert gait_review.near_side({"direction": "left"}) == "L"
    assert gait_review.near_side({"direction": "right"}) == "R"
    assert gait_review.near_side({"direction": "right", "seen_frames": {"L": 900, "R": 400}}) == "L"   # mirrored camera
    assert gait_review.near_side({"direction": "left", "seen_frames": {"L": 500, "R": 480}}) == "L"    # alike: direction
    assert gait_review.near_side(None) is None


def test_live_view_names_the_near_leg_only():
    live = gait_review.live_view(good_summary())
    assert live["nearSide"] == "L" and live["kneeBendDeg"] == 43.8 and live["toeLiftCm"] == 9
    assert gait_review.live_view(None) is None


# ---------------------------------------------------------------- rule-based review
def test_rules_review_finds_the_weak_lane_and_the_fading_pace():
    v = view()
    r = gait_review.rules_review(v, LIMITS)
    areas = {f["area"] for f in r["findings"]}
    assert {"knee", "game targets", "pace"} <= areas      # the near (left) knee bends 43.8 degrees at most
    assert r["focus"]["text"] == "Bend the left knee a little more each step"
    assert all(set(f["evidence"]) <= set(ids(v)) for f in r["findings"] + r["strengths"])
    assert r["nextSession"] == {"liftCm": None, "spacingCm": None, "minCadence": None, "why": "No change: today's targets fit well."}
    assert len(r["cues"]) == 3 and all(len(c.split()) <= 12 for c in r["cues"])


def test_rules_review_of_a_poor_walk_makes_no_gait_findings():
    v = gait_review.build_view(game(), {"summary": SHORT["summary"], "quality": SHORT["quality"]}, [], {"limits": LIMITS})
    r = gait_review.rules_review(v, LIMITS)
    assert all(not ids(v)[e]["group"].startswith("gait") for f in r["findings"] for e in f["evidence"])
    assert "too little" in r["overview"]
    assert "strides" in r["nextRecording"]


def test_rules_flag_a_game_with_few_hits_and_name_a_target_focus():
    v = gait_review.build_view(game(stompPct=0, dodgePct=20, byLane={}), {"summary": None}, [], {"limits": LIMITS})
    r = gait_review.rules_review(v, LIMITS)
    assert [f["evidence"] for f in r["findings"]][:2] == [["flowers_hit"], ["seeds_dodged"]]
    assert r["focus"]["text"] == "Step right onto each flower as it reaches your foot"
    assert "steady" not in r["focus"]["why"]


def test_rules_suggest_easier_flowers_inside_the_range():
    r = gait_review.rules_review(view(stompPct=40), {**LIMITS, "spacingCm": 210})
    assert r["nextSession"]["spacingCm"] == 220            # 210 + 30, capped by the therapist's range


# ---------------------------------------------------------------- checks on the model's reply
def reply(**over):
    out = {"overview": "A steady walk with good aim on the right.",
           "strengths": [{"text": "Even timing", "evidence": ["stride_variability_R"]}],
           "findings": [{"area": "symmetry", "side": "both", "text": "Steps may differ", "evidence": ["asym_step_length"], "confidence": "high"},
                        {"area": "knee", "side": "R", "text": "Made up", "evidence": ["no_such_metric"], "confidence": "high"},
                        {"area": "game targets", "side": "L", "text": "This patient missed", "evidence": ["flowers_hit_L"], "confidence": "high"}],
           "gameVsGait": [], "actComparison": "", "trend": "",
           "focus": {"text": "Aim the left foot onto the flower", "why": "Left lane misses", "evidence": ["flowers_hit_L"]},
           "nextSession": {"liftCm": None, "spacingCm": 500, "minCadence": 200, "why": "More room"},
           "cues": ["Left foot onto the flower", "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen"],
           "playerFeedback": "Great job!", "parentNote": "A good walk.", "therapistNote": "cadence 104", "nextRecording": "Worked well."}
    out.update(over)
    return out


def test_validate_keeps_only_cited_safe_items_and_clamps_settings():
    v = view()
    rules = gait_review.rules_review(v, LIMITS)
    r, filled = gait_review.validate(reply(), v, LIMITS, rules)
    assert [f["text"] for f in r["findings"]] == ["Steps may differ"]      # unknown id and banned word dropped
    assert r["findings"][0]["confidence"] == "low"                         # it cites only low-trust numbers
    assert r["nextSession"]["spacingCm"] == 220 and r["nextSession"]["minCadence"] is None   # one change at a time
    assert r["cues"] == ["Left foot onto the flower"]
    assert r["gameVsGait"] == [] and r["actComparison"] == ""              # honest empties stand
    assert filled == []


def test_validate_fills_failed_fields_from_the_rules():
    v = view()
    rules = gait_review.rules_review(v, LIMITS)
    r, filled = gait_review.validate(reply(overview="This disease...", strengths=[{"text": "x", "evidence": []}], cues="no"),
                                     v, LIMITS, rules)
    assert r["overview"] == rules["overview"] and r["strengths"] == rules["strengths"] and r["cues"] == rules["cues"]
    assert set(filled) == {"overview", "strengths", "cues"}


def test_validate_drops_gait_findings_when_the_data_is_poor():
    v = gait_review.build_view(game(), {"summary": SHORT["summary"], "quality": SHORT["quality"]}, [], {"limits": LIMITS})
    out = reply(strengths=[{"text": "Knee bends well", "evidence": ["knee_flexion_peak_L"]}],
                findings=[{"area": "knee", "side": "L", "text": "Knee bends well", "evidence": ["knee_flexion_peak_L"], "confidence": "high"},
                          {"area": "game targets", "side": "L", "text": "Left lane misses", "evidence": ["flowers_hit_L"], "confidence": "high"}])
    rules = gait_review.rules_review(v, LIMITS)
    r, _ = gait_review.validate(out, v, LIMITS, rules)
    assert [f["text"] for f in r["findings"]] == ["Left lane misses"]
    assert r["strengths"] == rules["strengths"]                            # the gait strength went too


def test_a_reply_of_the_wrong_shape_never_breaks_the_review():
    v = view()
    rules = gait_review.rules_review(v, LIMITS)
    r, filled = gait_review.validate(reply(cues=5, focus="x", nextSession=[1], findings={"a": 1}), v, LIMITS, rules)
    assert r["cues"] == rules["cues"] and r["focus"] == rules["focus"] and {"cues", "focus", "nextSession", "findings"} <= set(filled)


# ---------------------------------------------------------------- the whole review
async def test_review_without_consent_uses_the_rules_and_says_why():
    out = await gait_review.review(game(), {"summary": good_summary()}, [], {"name": "Mia", "limits": LIMITS})
    assert out["status"] == "done" and out["source"] == "rules" and "consent" in out["reason"]
    assert out["metrics"] and out["review"]["focus"]["text"]


async def test_review_with_consent_but_no_key_says_so():
    out = await gait_review.review(game(), {"summary": good_summary()}, [], {"name": "Mia", "limits": LIMITS, "aiReviewConsent": True})
    assert out["source"] == "rules" and out["reason"] == "no GEMINI_API_KEY"


async def test_review_with_a_model_reply(monkeypatch):
    seen = {}

    async def fake(system, user, **kw):
        seen.update(user=json.loads(user), **kw)
        return reply(), None
    monkeypatch.setattr(gemini, "generate_json", fake)
    out = await gait_review.review(game(), {"summary": good_summary()}, [], {"name": "Mia", "limits": LIMITS, "aiReviewConsent": True})
    assert out["source"] == "gemini" and out["reason"] is None and out["filledByRules"] == []
    assert seen["schema"] is gait_review.REVIEW_SCHEMA
    assert "Mia" not in json.dumps(seen["user"])                            # numbers only, no names
    assert {"context", "dataQuality", "metrics", "withheld", "earlierFocus"} == set(seen["user"])


async def test_a_reply_that_fails_most_checks_falls_back(monkeypatch):
    async def fake(system, user, **kw):
        return {"overview": 3}, None
    monkeypatch.setattr(gemini, "generate_json", fake)
    out = await gait_review.review(game(), {"summary": good_summary()}, [], {"name": "Mia", "limits": LIMITS, "aiReviewConsent": True})
    assert out["source"] == "rules" and "failed the checks" in out["reason"]


def test_gemini_reply_parsing_tolerates_a_fence():
    assert gemini.parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert gemini.parse_json("[1, 2]") is None
