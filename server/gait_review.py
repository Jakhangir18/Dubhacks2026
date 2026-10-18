"""The AI therapist's review of one walk: the side camera's gait numbers and the game's results in, a review out.

Only numbers go to Gemini, and only with the player's aiReviewConsent: no video, frames or names. Code decides what the
model may trust before it sees anything: units are made clinical (knee flexion = 180 - the inside angle gait.py logs),
the leg nearer the side camera is trusted over the far one, and values a walking body cannot produce are withheld with
the reason. The model must cite metric ids for every strength and finding; anything citing nothing measured is dropped,
the wording is checked, and suggested settings are clamped to the therapist's ranges. Without consent, a key or a usable
reply, the rule-based review answers in the same shape, and it fills any field the model got wrong.
"""

from __future__ import annotations

import json
import math
import re
import statistics
import time
from typing import Any

from server import gemini, therapist

SIDES = ("L", "R")
NAME = {"L": "left", "R": "right"}
ACTS = ("walk", "garden", "storm")
ACT_NAME = {"walk": "steady walking", "garden": "the flowers", "storm": "the seeds"}
BANNED = re.compile(r"diagnos|disease|disorder|palsy|syndrome|injur|patient|patholog|\bcure|\btreat|prescri", re.IGNORECASE)
AREAS = ["pace", "timing", "symmetry", "knee", "hip", "ankle", "foot landing", "foot clearance", "step length",
         "balance", "posture", "arm swing", "game targets", "other"]
MODEL_ENV = "GEMINI_REVIEW_MODEL"   # falls back to GEMINI_MODEL


def _num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _get(d: Any, *path: str) -> float | None:
    for k in path:
        if not isinstance(d, dict):
            return None
        d = d.get(k)
    return float(d) if _num(d) else None


def _flex(v: float | None) -> float | None:   # gait.py logs the inside knee angle (180 = straight)
    return None if v is None else 180 - v


def _neg(v: float | None) -> float | None:
    return None if v is None else -v


# Rough typical values for adult walking on the ground, so the model compares against numbers we chose instead of its
# memory; a slow walking pad lowers cadence and step length. Replace with a cited table (for example Perry & Burnfield,
# Gait Analysis) before showing this to a clinician. The range after each is what a walking body can produce at all;
# outside it the number is a tracking error and is withheld.
SIDE_METRICS = [
    ("knee_flexion_peak", "knee bend in swing", "deg", lambda s, x: _flex(_get(s, "knee", x, "peak_bend")), "about 60 deg", (10, 100)),
    ("knee_range", "knee range of motion", "deg", lambda s, x: _get(s, "knee", x, "rom"), "about 60 deg", (5, 100)),
    ("hip_flexion_peak", "hip flexion (thigh forward)", "deg", lambda s, x: _get(s, "hip", x, "peak_flexion"), "about 30 deg", (-10, 80)),
    ("hip_extension_peak", "hip extension (thigh back)", "deg", lambda s, x: _neg(_get(s, "hip", x, "peak_extension")), "about 10-20 deg", (-30, 50)),
    ("ankle_dorsiflexion_peak", "ankle toes-up angle", "deg", lambda s, x: _get(s, "ankle", x, "peak_dorsi"), "about 10 deg", (-25, 45)),
    ("ankle_plantarflexion_peak", "ankle push-off angle", "deg", lambda s, x: _neg(_get(s, "ankle", x, "peak_plantar")), "about 15-20 deg", (-25, 60)),
    ("stride_time", "stride time", "s", lambda s, x: _get(s, "stride", x), "about 1.0-1.2 s", (0.5, 3.0)),
    ("stride_variability", "stride time variability", "%", lambda s, x: _get(s, "stride_cv", x), "under about 5%", (0, 60)),
    ("step_time", "step time", "s", lambda s, x: _get(s, "step_time", x), "about 0.5-0.6 s", (0.2, 1.6)),
    ("step_length", "step length", "cm", lambda s, x: _get(s, "step_length_cm", x), "about 60-75 cm on the ground, shorter on a slow pad", (5, 130)),
    ("stance", "time on the ground per stride", "%", lambda s, x: _get(s, "stance_pct", x), "about 60%", (35, 85)),
    ("toe_lift", "toe height in swing", "cm", lambda s, x: _get(s, "toe_lift_cm", x), None, (0, 40)),
    ("heel_first", "steps landing heel first", "%", lambda s, x: _get(s, "heel_first_pct", x), "most steps land heel first", (0, 100)),
    ("foot_angle_at_strike", "foot angle at landing (+ = toes up)", "deg", lambda s, x: _get(s, "foot_strike_deg", x), None, (-40, 50)),
    ("pelvis_bounce", "hip up-and-down movement", "cm", lambda s, x: _get(s, "pelvis_bounce_cm", x), None, (0, 15)),
    ("arm_swing", "arm swing", "cm", lambda s, x: _get(s, "arm_swing_cm", x), None, (0, 120)),
]
GLOBAL_METRICS = [
    ("cadence", "cadence (side camera)", "steps/min", lambda s: _get(s, "cadence"), "about 100-120 steps/min on the ground, lower on a slow pad", (30, 200)),
    ("stride_length", "stride length", "cm", lambda s: _get(s, "stride_length_cm"), None, (10, 260)),
    ("speed", "walking speed", "m/s", lambda s: _get(s, "speed_m_s"), None, (0.1, 2.5)),
    ("double_support", "time with both feet down", "%", lambda s: _get(s, "double_support_pct"), "about 20%", (0, 60)),
    ("trunk_lean", "trunk lean (+ = forward)", "deg", lambda s: _get(s, "trunk_lean", "mean"), "a few deg forward", (-30, 45)),
    ("trunk_sway", "trunk lean range", "deg", lambda s: _get(s, "trunk_lean", "range"), None, (0, 40)),
]
ASYM_METRICS = [("stride", "stride time"), ("step_time", "step time"), ("step_length", "step length"),
                ("stance", "time on the ground"), ("knee_rom", "knee range"), ("toe_lift", "toe height"), ("arm_swing", "arm swing")]
PER_ACT = ("cadence", "step_length", "toe_lift", "knee_flexion_peak", "stance", "stride_variability")


# ---------------------------------------------------------------- what the model may see
def near_side(s: Any) -> str | None:
    """The leg nearer the side camera: the one MediaPipe saw confidently more often, which holds for a mirrored camera
    too; when both were seen alike, the walking direction (walking to the right of the picture shows the right side)."""
    if not isinstance(s, dict) or not s.get("direction"):
        return None
    seen = s.get("seen_frames") if isinstance(s.get("seen_frames"), dict) else {}
    left, right = seen.get("L"), seen.get("R")
    if _num(left) and _num(right) and max(left, right) > 1.15 * min(left, right):
        return "L" if left > right else "R"
    return "R" if s["direction"] == "right" else "L"


def data_quality(gait: dict[str, Any]) -> tuple[str, list[str], str | None, bool]:
    """(level good | ok | poor, issues, near side, cadence trusted). The first issues decide the level; the last one,
    about the far leg, is always true of one side camera."""
    s = gait.get("summary")
    if not isinstance(s, dict) or not s.get("direction"):
        return "poor", ["The side camera saw too little of the walk to measure it."], None, False
    near = near_side(s) or "L"
    far = "R" if near == "L" else "L"
    counts = s.get("strike_counts") or {x: len((s.get("strikes") or {}).get(x) or []) for x in SIDES}
    strides = max(0, int(counts.get(near) or 0) - 1)
    q = gait.get("quality") or {}
    issues, severe = [], False
    if strides < 5:
        issues.append(f"Only {strides} {'stride' if strides == 1 else 'strides'} of the {NAME[near]} leg "
                      f"{'was' if strides == 1 else 'were'} seen; "
                      "a minute or more of steady walking gives steadier numbers.")
        severe = True
    fps = _get(s, "fps") or _get(q, "fps")
    if fps is not None and fps < 15:
        issues.append(f"The pose model ran at {fps:.0f} frames a second, so quick foot movements may be missed.")
        severe = severe or fps < 10
    captured, analysed, skipped = _get(q, "framesCaptured"), _get(q, "framesAnalysed"), _get(q, "framesSkipped")
    if captured and skipped and skipped / captured > 0.3:
        issues.append(f"{round(100 * skipped / captured)}% of the camera frames were skipped by a busy computer.")
    if analysed and analysed < 0.5 * (captured or analysed):
        severe = True
    glitches = _get(s, "glitch_frames")
    if analysed and glitches and glitches / analysed > 0.15:
        issues.append(f"The skeleton glitched on {round(100 * glitches / analysed)}% of the frames (blanked before measuring).")
    c, cs = _get(s, "cadence"), _get(s, "cadence_steps")
    cadence_ok = not (c and cs and abs(c - cs) > 0.25 * cs)
    if not cadence_ok:
        issues.append("Two ways of counting steps disagree by more than a quarter: foot strikes were missed or the legs were mixed up.")
    level = "poor" if severe else "ok" if issues else "good"
    issues.append(f"The {NAME[far]} leg is farther from the camera, so its numbers and the left-right differences are less certain.")
    return level, issues, near, cadence_ok


def perceptron_check(game: dict[str, Any]) -> dict[str, Any] | None:
    """Perceptron's per-walk agreement with the game's own step judging (web/perceive.js), or None when it did not run."""
    p = game.get("perceptron")
    if not isinstance(p, dict) or not isinstance(p.get("checked"), (int, float)) or p["checked"] <= 0:
        return None
    checked, agree = int(p["checked"]), int(p.get("agree") or 0)
    return {"stepsChecked": checked, "agreedWithGame": agree, "agreePct": round(100 * agree / checked),
            "view": "camera above the belt" if p.get("view") == "overhead" else "leg camera",
            "meaning": "a second model looked at pictures of the feet around each scored step; disagreement means the "
                       "game's camera was unsure there, not that the player did it wrong"}


def build_view(game: dict[str, Any], gait: dict[str, Any], history: list[dict[str, Any]], player: dict[str, Any]) -> dict[str, Any]:
    """Every number the review may use, each with an id, unit, typical value and trust; plus what was withheld."""
    level, issues, near, cadence_ok = data_quality(gait)
    metrics: list[dict[str, Any]] = []
    withheld: list[dict[str, Any]] = []

    def add(mid, label, group, side, value, unit, typical=None, trust="good", plausible=None):
        if value is None:
            return
        if plausible and not plausible[0] <= value <= plausible[1]:
            withheld.append({"id": mid, "reason": f"{value:.1f} {unit} is outside what walking produces "
                                                  f"({plausible[0]} to {plausible[1]}): a tracking error"})
            return
        digits = 2 if unit in ("s", "m/s") else 1
        metrics.append({"id": mid, "label": label, "group": group, "side": side, "value": round(value, digits),
                        "unit": unit, "typical": typical, "trust": trust, "prev": None})

    def add_gait(s, group, suffix="", only=None):
        for mid, label, unit, get, typical, rng in SIDE_METRICS:
            if only and mid not in only:
                continue
            for x in SIDES:
                add(f"{mid}_{x}{suffix}", f"{NAME[x].capitalize()} {label}", group, x, get(s, x), unit, typical,
                    "good" if x == near else "low", rng)
        for mid, label, unit, get, typical, rng in GLOBAL_METRICS:
            if only and mid not in only:
                continue
            add(f"{mid}{suffix}", label.capitalize(), group, None, get(s), unit, typical,
                "good" if mid != "cadence" or cadence_ok else "low", rng)

    summary = gait.get("summary") if isinstance(gait.get("summary"), dict) else None
    if summary and near:
        add_gait(summary, "gait")
        for key, label in ASYM_METRICS:
            add(f"asym_{key}", f"Left-right difference in {label}", "gait", None, _get(summary, "asymmetry", key),
                "%", "under about 10%", "low", (0, 150))
        for act in ACTS:
            part = (gait.get("perAct") or {}).get(act)
            if isinstance(part, dict) and part.get("direction"):
                add_gait(part, f"gait@{act}", f"@{act}", PER_ACT)

    # The game's own results: what it judged, so they are trusted as they are.
    add("game_seconds", "Game time", "game", None, _get(game, "seconds"), "s")
    add("game_steps", "Steps counted by the game", "game", None, _get(game, "steps"), "steps")
    cads = [p["cadence"] for p in game.get("timeline") or [] if isinstance(p, dict) and _num(p.get("cadence")) and p["cadence"] > 0]
    add("game_cadence", "Cadence in the game", "game", None, statistics.mean(cads) if cads else _get(game, "cadence"), "steps/min")
    if len(cads) >= 4:
        half = len(cads) // 2
        add("game_cadence_first_half", "Cadence in the first half of the game", "game", None, statistics.mean(cads[:half]), "steps/min")
        add("game_cadence_second_half", "Cadence in the second half of the game", "game", None, statistics.mean(cads[half:]), "steps/min")
    asym = _get(game, "asymmetryPct")
    add("game_even_lr", "Left-right evenness of step timing in the game", "game", None, None if asym is None else max(0.0, 100 - asym), "%")
    add("flowers_hit", "Flowers stepped on", "game", None, _get(game, "stompPct"), "%")
    add("seeds_dodged", "Seeds avoided", "game", None, _get(game, "dodgePct"), "%")
    add("form", "Time with good form in the game", "game", None, _get(game, "formPct"), "%")
    for kind, mid, label in (("flower", "flowers_hit", "flowers stepped on"), ("seed", "seeds_dodged", "seeds avoided")):
        for x in SIDES:
            pair = ((game.get("byLane") or {}).get(kind) or {}).get(x)
            if isinstance(pair, list) and len(pair) == 2 and all(_num(v) for v in pair) and pair[1] > 0:
                add(f"{mid}_{x}", f"{NAME[x].capitalize()} lane {label} ({int(pair[0])} of {int(pair[1])})", "game", x,
                    100 * pair[0] / pair[1], "%")
    for x in SIDES:
        add(f"steps_{x}", f"{NAME[x].capitalize()} foot steps counted by the game", "game", x, _get(game, "stepsByFoot", x), "steps")
        add(f"placement_{x}", f"{NAME[x].capitalize()} shoe distance from the flower's centre", "game", x, _get(game, "placementCm", x), "cm")
        add(f"timing_{x}", f"{NAME[x].capitalize()} foot timing at the line (+ = late)", "game", x, _get(game, "timingS", x), "s")
        add(f"swing_{x}", f"{NAME[x].capitalize()} forward swing per step on the belt", "game", x, _get(game, "swingCm", x), "cm")
        if not game.get("shoeMode"):
            add(f"high_lift_{x}", f"{NAME[x].capitalize()} lift on high steps", "game", x, _get(game, "highLiftAvgCm", x), "cm")

    # The same ids from earlier reviews: their mean is the trend line.
    earlier: dict[str, list[float]] = {}
    for h in history[:5]:
        for m in (h.get("gaitReview") or {}).get("metrics") or []:
            if isinstance(m, dict) and _num(m.get("value")):
                earlier.setdefault(m.get("id"), []).append(m["value"])
    for m in metrics:
        if m["id"] in earlier:
            m["prev"] = round(statistics.mean(earlier[m["id"]]), 2 if m["unit"] in ("s", "m/s") else 1)

    focus = []
    for h in history[:3]:
        text = (((h.get("gaitReview") or {}).get("review") or {}).get("focus") or {}).get("text")
        if text:
            focus.append(f"{time.strftime('%Y-%m-%d', time.localtime(h.get('ts') or 0))}: {text}")
    limits = player.get("limits") or {}
    context = {   # numbers and fixed words only: the therapist's free-text notes may hold names, so they stay here
        "setting": "walking pad; a camera over the belt finds the shoes for the game; a side camera measures the walk"
                   if game.get("shoeMode") else "walking pad; a side camera measures the walk",
        "acts": "walk = steady walking; garden = step onto the flowers with the matching foot; storm = keep feet clear "
                "of the seeds; the flowers and seeds repeat for each round",
        "rounds": game.get("rounds"),
        "nearSide": NAME.get(near or "", "unknown"),
        "shoeMode": bool(game.get("shoeMode")),
        "therapistLimits": {k: limits.get(k) for k in ("minCadence", "liftCm", "liftRange", "spacingCm", "spacingRange")},
        "perceptronCheck": perceptron_check(game),
    }
    return {"near": near, "dataQuality": {"level": level, "issues": issues}, "metrics": metrics, "withheld": withheld,
            "context": context, "earlierFocus": focus}


def live_view(summary: Any) -> dict[str, Any] | None:
    """The few live numbers the coach may use while the game runs (near leg only), or None."""
    if not isinstance(summary, dict) or not summary.get("direction"):
        return None
    near = near_side(summary) or "L"
    knee, toe = _flex(_get(summary, "knee", near, "peak_bend")), _get(summary, "toe_lift_cm", near)
    return {"nearSide": near, "cadence": _get(summary, "cadence"),
            "kneeBendDeg": round(knee, 1) if knee is not None and 10 <= knee <= 100 else None,
            "toeLiftCm": round(toe, 1) if toe is not None and 0 <= toe <= 40 else None}


# ---------------------------------------------------------------- rule-based review (no model, same shape)
FOCUS = {"timing": "Keep a steady, even rhythm", "foot landing": "Land each step on the heel",
         "foot clearance": "Lift the toes clear of the belt", "symmetry": "Make left and right steps the same length",
         "pace": "Keep the pace steady right to the end"}
CUE = {"timing": "Step, step, step: keep the beat steady", "foot landing": "Heel down first, then roll through",
       "foot clearance": "Lift your toes over the belt", "symmetry": "Same size steps, left and right",
       "pace": "Keep that pace going to the end"}


def clamp_next(s: Any, limits: dict[str, Any]) -> dict[str, Any]:
    """A suggested next-session setting kept inside the therapist's ranges; null means no change."""
    s = s if isinstance(s, dict) else {}
    out = therapist.clamp_params({k: s[k] for k in ("liftCm", "spacingCm") if _num(s.get(k))}, limits)
    for k in ("liftCm", "spacingCm"):
        if k in out and limits.get(k) is not None and abs(out[k] - float(limits[k])) < 1e-6:
            out.pop(k)
    mc, cur = s.get("minCadence"), float(limits.get("minCadence", 80))
    cadence = round(max(40.0, cur - 15, min(160.0, cur + 15, float(mc)))) if _num(mc) else None
    if cadence is not None and cadence != round(cur):
        out["minCadence"] = cadence
    keep = next((k for k in ("spacingCm", "liftCm", "minCadence") if k in out), None)   # one change at a time
    why = s.get("why") if isinstance(s.get("why"), str) and not BANNED.search(s["why"]) else ""
    return {k: out[k] if k == keep else None for k in ("liftCm", "spacingCm", "minCadence")} | {"why": " ".join(why.split())[:300]}


def rules_review(view: dict[str, Any], limits: dict[str, Any]) -> dict[str, Any]:
    m = {x["id"]: x for x in view["metrics"]}
    v = lambda mid: (m.get(mid) or {}).get("value")
    good = lambda mid: mid in m and m[mid]["trust"] == "good"
    near, poor = view["near"], view["dataQuality"]["level"] == "poor"
    nn = NAME.get(near or "", "")
    strengths: list[dict[str, Any]] = []
    findings: list[dict[str, Any]] = []
    if (v("flowers_hit") or 0) >= 75:
        strengths.append({"text": f"Stepped on {v('flowers_hit'):.0f}% of the flowers: good aim with the feet.", "evidence": ["flowers_hit"]})
    if (v("seeds_dodged") or 0) >= 75:
        strengths.append({"text": f"Kept clear of {v('seeds_dodged'):.0f}% of the seeds.", "evidence": ["seeds_dodged"]})
    if (v("game_even_lr") or 0) >= 90:
        strengths.append({"text": f"Left and right steps were evenly timed ({v('game_even_lr'):.0f}%).", "evidence": ["game_even_lr"]})
    if near and not poor:
        sv, hf, kf, tl = (f"{k}_{near}" for k in ("stride_variability", "heel_first", "knee_flexion_peak", "toe_lift"))
        if good(sv) and v(sv) <= 5:
            strengths.append({"text": f"Very even timing from stride to stride ({v(sv)}% variability).", "evidence": [sv]})
        if good(hf) and v(hf) >= 80:
            strengths.append({"text": f"Most steps land heel first ({v(hf):.0f}% on the {nn} side).", "evidence": [hf]})
        if good(sv) and v(sv) > 8:
            findings.append({"area": "timing", "side": near, "confidence": "medium", "evidence": [sv],
                             "text": f"Step timing changed from stride to stride ({v(sv)}% on the {nn} leg); a steady rhythm comes next."})
        if good(kf) and v(kf) < 45:
            findings.append({"area": "knee", "side": near, "confidence": "medium", "evidence": [kf],
                             "text": f"The {nn} knee bent up to {v(kf):.0f} degrees in swing; a little more bend helps the foot clear the belt."})
        if good(hf) and v(hf) < 50:
            findings.append({"area": "foot landing", "side": near, "confidence": "medium", "evidence": [hf],
                             "text": f"{v(hf):.0f}% of {nn} steps landed heel first; most steps usually do."})
        if good(tl) and v(tl) < 4:
            findings.append({"area": "foot clearance", "side": near, "confidence": "medium", "evidence": [tl],
                             "text": f"The {nn} toes rose about {v(tl)} cm in swing, close to the belt."})
        if (v("asym_step_length") or 0) > 15:
            findings.append({"area": "symmetry", "side": "both", "confidence": "low", "evidence": ["asym_step_length"],
                             "text": f"Left and right steps may differ in length by about {v('asym_step_length'):.0f}% "
                                     "(less certain: one leg is farther from the camera)."})
    stomp, dodge, shoes = v("flowers_hit"), v("seeds_dodged"), view["context"].get("shoeMode")
    if stomp is not None and stomp < 50:
        findings.append({"area": "game targets", "side": "both", "confidence": "high", "evidence": ["flowers_hit"],
                         "text": f"{stomp:.0f}% of the flowers were stepped on; landing on them is the next step."})
    fl, fr = v("flowers_hit_L"), v("flowers_hit_R")
    if fl is not None and fr is not None and abs(fl - fr) >= 25:
        worse = "L" if fl < fr else "R"
        findings.append({"area": "game targets", "side": worse, "confidence": "high", "evidence": ["flowers_hit_L", "flowers_hit_R"],
                         "text": f"Flowers in the {NAME[worse]} lane were stepped on less often ({min(fl, fr):.0f}% against {max(fl, fr):.0f}%)."})
    if dodge is not None and dodge < 50:
        findings.append({"area": "game targets", "side": "both", "confidence": "high", "evidence": ["seeds_dodged"],
                         "text": f"{dodge:.0f}% of the seeds were avoided."})
    c1, c2 = v("game_cadence_first_half"), v("game_cadence_second_half")
    if c1 and c2 and c2 < 0.9 * c1:
        findings.append({"area": "pace", "side": "none", "confidence": "high", "evidence": ["game_cadence_first_half", "game_cadence_second_half"],
                         "text": f"The pace eased from about {c1:.0f} to {c2:.0f} steps a minute in the second half."})
    strengths, findings = strengths[:4], findings[:5]

    if findings:
        f0 = findings[0]
        side = NAME.get(f0["side"], "")
        seeds = "seeds_dodged" in f0["evidence"]
        seed_text = ("Keep your feet clear of the seeds", "Feet clear of the seeds") if shoes \
            else ("Lift the foot the seed is aiming at", "Lift that foot over the seed")
        target = (f"Aim the {side} foot right onto the flower", f"{side.capitalize()} foot onto the flower") if side \
            else seed_text if seeds else ("Step right onto each flower as it reaches your foot", "Step onto the flower as it arrives")
        text, cue = {"knee": (f"Bend the {side} knee a little more each step", f"Bend your {side} knee as you step"),
                     "game targets": target}.get(f0["area"]) or (FOCUS.get(f0["area"], "Keep walking steady and even"),
                                                                 CUE.get(f0["area"], "Nice and steady, both feet"))
        focus = {"text": text, "why": f0["text"], "evidence": f0["evidence"]}
    else:
        focus = {"text": "Keep walking steady and even", "why": "Today's numbers look steady; the same rhythm again is the goal.",
                 "evidence": strengths[0]["evidence"] if strengths else []}
        cue = "Nice and steady, both feet"

    spacing, lift = float(limits.get("spacingCm", 140)), float(limits.get("liftCm", 10))
    if stomp is not None and stomp < 60:
        nxt = {"spacingCm": spacing + 30, "why": "The flowers were hard to reach: a little more space between them."}
    elif stomp is not None and stomp > 85:
        nxt = {"spacingCm": spacing - 20, "why": "The flowers were easy: a little closer together."}
    elif dodge is not None and dodge < 60 and not shoes:
        nxt = {"liftCm": lift - 1, "why": "The seeds were hard: a slightly lower lift target."}
    elif dodge is not None and dodge > 85 and not shoes:
        nxt = {"liftCm": lift + 1, "why": "The seeds were easy: a slightly higher lift target."}
    else:
        nxt = {"why": "No change: today's targets fit well."}
    next_session = clamp_next(nxt, limits)

    minutes = round((v("game_seconds") or 0) / 60, 1)
    played = (f"{minutes} minutes on the walking pad: {v('game_steps') or 0:.0f} steps at about {v('game_cadence') or 0:.0f} steps a minute"
              + (f", {stomp:.0f}% of the flowers stepped on" if stomp is not None else "")
              + (f" and {dodge:.0f}% of the seeds avoided" if dodge is not None else "") + ".")
    camera = (" The side camera saw too little to judge the walk itself, so these notes are about the game." if poor or not near
              else f" The side camera measured the walk; the {nn} leg, nearer the camera, is measured best.")
    acts = []
    for mid, label, unit in (("knee_flexion_peak", "knee bend", "degrees"), ("step_length", "step length", "cm")):
        key = f"{mid}_{near}" if near else mid
        vals = [(ACT_NAME[a], v(f"{key}@{a}")) for a in ACTS if v(f"{key}@{a}") is not None]
        if len(vals) >= 2 and not poor:
            acts.append(f"{nn.capitalize()} {label}: " + ", ".join(f"{x:.0f} {unit} during {a}" for a, x in vals) + ".")
    trend = []
    for mid in ("game_cadence", "flowers_hit", f"step_length_{near}" if near else ""):
        if mid in m and m[mid]["prev"] is not None:
            trend.append(f"{m[mid]['label']}: {m[mid]['value']} {m[mid]['unit']} today against {m[mid]['prev']} before.")
    key_ids = [x for x in view["metrics"] if x["group"] == "gait" and x["trust"] == "good"][:12]
    therapist_note = "; ".join(f"{x['id']} {x['value']} {x['unit']}" for x in key_ids) or "No usable side-camera numbers."
    real_issues = view["dataQuality"]["issues"][:-1] if near else view["dataQuality"]["issues"]
    if real_issues:
        therapist_note += ". Data: " + " ".join(real_issues)
    first = strengths[0]["evidence"][0] if strengths else None
    praise = {"flowers_hit": "You stepped on lots of flowers!", "seeds_dodged": "You dodged lots of seeds!",
              "game_even_lr": "Your left and right steps were nice and even!",
              "stride_variability": "Your steps had a lovely steady rhythm!",
              "heel_first": "Your steps landed heel first, just right!"}.get((first or "").rsplit("_", 1)[0] if first and first[-2:] in ("_L", "_R") else first,
                                                                            "You kept walking the whole game!")
    strongest = f"Strongest today: {strengths[0]['text'][0].lower()}{strengths[0]['text'][1:]}" if strengths else "They kept walking the whole game."
    return {
        "overview": played + camera,
        "strengths": strengths,
        "findings": findings,
        "gameVsGait": [],
        "actComparison": " ".join(acts),
        "trend": " ".join(trend),
        "focus": focus,
        "nextSession": next_session,
        "cues": [cue, "Eyes on the glow, step right on it", "Nice and steady, both feet"][:3] if cue != "Nice and steady, both feet"
        else [cue, "Eyes on the glow, step right on it", "Keep that pace going to the end"],
        "playerFeedback": f"Great walking today! {praise} Next time: {focus['text'].lower()}.",
        "parentNote": f"{played} {strongest} Next time the focus is: {focus['text'].lower()}. Thank you for walking together!",
        "therapistNote": therapist_note,
        "nextRecording": (" ".join(real_issues) + " Keep the side camera at knee height with the whole body in view.") if real_issues
        else "Same camera place next time: side on, knee height, the whole body in view.",
    }


# ---------------------------------------------------------------- the model and its checks
REVIEW_SYSTEM = (
    "You are a physical-therapy assistant reviewing one session of a walking game played on a walking pad, for the "
    "player's therapist and parent. You get numbers only, each with an id: gait metrics from a side camera "
    "(MediaPipe pose), the game's results (stepping onto flowers with the matching foot, keeping clear of seeds, pace), "
    "the same gait metrics per act (ids ending @walk, @garden, @storm), data quality, and 'prev', the mean of earlier "
    "sessions. Rules: use only the numbers given and cite their ids; every strength, finding and game-gait link needs "
    "at least one id. Never invent a number; any number you write must be one of the given values, rounded. Metrics "
    "with trust 'low' (the leg farther from the camera, left-right differences) are uncertain: mention them only with "
    "'may' and confidence 'low'. If dataQuality.level is 'poor', make no gait findings: write about the game and how "
    "to record a better walk. 'typical' values are rough adult references on the ground; a slow walking pad lowers "
    "cadence and step length, so never treat them as cut-offs. Link the game to the gait where the numbers support it "
    "(for example misses in one lane and a shorter step on that side), compare steady walking with the flower and "
    "seed acts when per-act numbers exist, and describe the trend when 'prev' values exist. Wellness language only: coordination, balance, steady walking, step length, lifting the feet. No "
    "diagnoses, no disease or condition names, no medical advice, no clinical cut-offs. nextSession: at most one "
    "change inside the therapist's limits, or nulls for no change. Audiences: playerFeedback speaks to the player in "
    "one or two short, warm sentences (at most 40 words); parentNote is plain and warm (three or four sentences); "
    "therapistNote is concise and technical, with numbers and ids; cues are three spoken cues for the next session, "
    "at most 12 words each, one instruction each; nextRecording says how to film a better walk, or that the setup "
    "worked. Reply with JSON only, in the given schema."
)

_S, _N = {"type": "STRING"}, {"type": "NUMBER", "nullable": True}
_IDS = {"type": "ARRAY", "items": _S}


def _obj(props: dict[str, Any]) -> dict[str, Any]:
    return {"type": "OBJECT", "properties": props, "required": list(props)}


REVIEW_SCHEMA = _obj({
    "overview": _S,
    "strengths": {"type": "ARRAY", "items": _obj({"text": _S, "evidence": _IDS})},
    "findings": {"type": "ARRAY", "items": _obj({
        "area": {"type": "STRING", "enum": AREAS}, "side": {"type": "STRING", "enum": ["L", "R", "both", "none"]},
        "text": _S, "evidence": _IDS, "confidence": {"type": "STRING", "enum": ["high", "medium", "low"]}})},
    "gameVsGait": {"type": "ARRAY", "items": _obj({"text": _S, "evidence": _IDS})},
    "actComparison": _S,
    "trend": _S,
    "focus": _obj({"text": _S, "why": _S, "evidence": _IDS}),
    "nextSession": _obj({"liftCm": _N, "spacingCm": _N, "minCadence": _N, "why": _S}),
    "cues": {"type": "ARRAY", "items": _S},
    "playerFeedback": _S,
    "parentNote": _S,
    "therapistNote": _S,
    "nextRecording": _S,
})


def model_input(view: dict[str, Any]) -> dict[str, Any]:
    return {"context": view["context"], "dataQuality": view["dataQuality"],
            "metrics": [{k: x[k] for k in ("id", "label", "group", "value", "unit", "typical", "trust", "prev")} for x in view["metrics"]],
            "withheld": view["withheld"], "earlierFocus": view["earlierFocus"]}


def _text(x: Any, limit: int) -> str | None:
    if not isinstance(x, str):
        return None
    t = " ".join(x.split())[:limit]
    return t if t and not BANNED.search(t) else None


def validate(out: dict[str, Any], view: dict[str, Any], limits: dict[str, Any],
             rules: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """The model's review with every check applied; a field that fails is taken from the rules review.
    Returns (review, the fields the rules filled)."""
    known = {x["id"]: x for x in view["metrics"]}
    poor = view["dataQuality"]["level"] == "poor"
    review: dict[str, Any] = {}
    filled: list[str] = []

    def put(key, value, empty_ok=False):
        if value is None or (not empty_ok and value in ("", [], {})):
            review[key] = rules[key]
            filled.append(key)
        else:
            review[key] = value

    def ids(x):
        return list(dict.fromkeys(i for i in x if isinstance(i, str) and i in known))[:6] if isinstance(x, list) else []

    def cited(item, extra=None):
        if not isinstance(item, dict):
            return None
        text, ev = _text(item.get("text"), 400), ids(item.get("evidence"))
        if not text or not ev:
            return None
        return {"text": text, "evidence": ev, **(extra(item, ev) if extra else {})}

    def finding(item, ev):
        low = all(known[i]["trust"] == "low" for i in ev)
        conf = item.get("confidence") if item.get("confidence") in ("high", "medium", "low") else "medium"
        return {"area": item.get("area") if item.get("area") in AREAS else "other",
                "side": item.get("side") if item.get("side") in ("L", "R", "both", "none") else "none",
                "confidence": "low" if low else conf}

    def items(key, n, extra=None, keep=lambda x: True):
        raw = out.get(key)
        if not isinstance(raw, list):
            return None
        kept = [x for x in (cited(i, extra) for i in raw) if x and keep(x)][:n]
        return kept if kept or not raw else None   # an honest empty list stands; a list that failed every check does not

    gait_only = lambda f: not (poor and any(known[i]["group"].startswith("gait") for i in f["evidence"]))   # a poor walk: no gait claims at all
    put("overview", _text(out.get("overview"), 700))
    put("strengths", items("strengths", 4, keep=gait_only), empty_ok=True)
    put("findings", items("findings", 6, finding, gait_only), empty_ok=True)
    put("gameVsGait", items("gameVsGait", 3, keep=gait_only), empty_ok=True)
    for key in ("actComparison", "trend"):
        raw = out.get(key)
        put(key, "" if raw == "" else _text(raw, 600), empty_ok=True)
    focus = out.get("focus") if isinstance(out.get("focus"), dict) else {}
    text = _text(focus.get("text"), 200)
    put("focus", {"text": text, "why": _text(focus.get("why"), 400) or "", "evidence": ids(focus.get("evidence"))} if text else None)
    put("nextSession", clamp_next(out.get("nextSession"), limits) if isinstance(out.get("nextSession"), dict) else None)
    raw_cues = out.get("cues") if isinstance(out.get("cues"), list) else []
    cues = [t for t in (_text(c, 100) for c in raw_cues) if t and len(t.split()) <= 14][:3]
    put("cues", cues)
    fb = _text(out.get("playerFeedback"), 400)
    put("playerFeedback", " ".join(fb.split()[:45]) if fb else None)
    put("parentNote", _text(out.get("parentNote"), 900))
    put("therapistNote", _text(out.get("therapistNote"), 1600))
    put("nextRecording", _text(out.get("nextRecording"), 500))
    return review, filled


async def review(game: dict[str, Any], gait: dict[str, Any], history: list[dict[str, Any]], player: dict[str, Any]) -> dict[str, Any]:
    """The finished gaitReview for one session (see vision/CONTRACT.md)."""
    view = build_view(game or {}, gait or {}, history, player)
    limits = player.get("limits") or {}
    rules = rules_review(view, limits)
    base = {"status": "done", "dataQuality": view["dataQuality"], "metrics": view["metrics"], "withheld": view["withheld"]}
    if not player.get("aiReviewConsent"):
        return {**base, "source": "rules", "model": None, "reason": "no AI review consent (therapist panel)", "review": rules, "ts": time.time()}
    model = gemini.model_name(MODEL_ENV)
    out, err = await gemini.generate_json(REVIEW_SYSTEM, json.dumps(model_input(view)), schema=REVIEW_SCHEMA, model=model,
                                          timeout=60, temperature=0.3)
    if out is None:
        return {**base, "source": "rules", "model": None, "reason": err, "review": rules, "ts": time.time()}
    try:
        checked, filled = validate(out, view, limits, rules)
    except (TypeError, ValueError, AttributeError, KeyError):   # a reply in a shape nobody expected
        checked, filled = rules, list(rules)
    if len(filled) >= 8:   # most of the reply failed the checks: the rules review is the honest answer
        return {**base, "source": "rules", "model": model, "reason": "the model's reply failed the checks", "review": rules, "ts": time.time()}
    return {**base, "source": "gemini", "model": model, "reason": None, "review": checked, "filledByRules": filled, "ts": time.time()}
