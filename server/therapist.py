"""The AI therapist: live cues (Gemini), long-term memory (Backboard), reports and the reward host.

Every function has a rule-based fallback, so the game works with no keys and no network.
Safety lives here, not in the model: the model only proposes; limits clamp everything it returns.
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

from server import gemini

BACKBOARD_URL = "https://app.backboard.io/api"

COACH_SYSTEM = (
    "You are the voice of a warm physical-therapy coach inside a walking game for children, teenagers and adults. "
    "The player walks in place. Act 1: keep a steady pace. Act 2: high-step onto flowers with the matching foot. "
    "Act 3 (only when the summary says seedAct is true): lift the foot a seed is aiming at. "
    "Act rest: the player stands between rounds; thisRound has the round just played (hit of n flowers): say what went "
    "well and one thing to fix next round, two short sentences, then end with Next round in three! "
    "You get a summary of the last stretch and the therapist's limits. Flowers come an odd number of steps apart "
    "(the summary's beatCm, in steps of stepCm): change spacingCm by two steps or leave it, a smaller change does nothing. "
    "Reply with JSON only: {\"say\": \"<one cue, at most 12 words, one instruction, about a target in the game, "
    "saying what to do, encouraging>\", \"params\": {\"liftCm\": <number>, \"spacingCm\": <number>}}. "
    "Make it easier (lower liftCm, larger spacingCm) when success is below 60 percent, harder above 85 percent, "
    "change one thing at a time. Never name a disease or condition, never give medical advice, never mention scores "
    "as clinical results."
)

REPORT_SYSTEM = (
    "You write a short session note for a child's parent and physical therapist after a walking game. "
    "Wellness language only: coordination, balance, steady walking, lifting the feet. No diagnoses, no disease names, "
    "no clinical cut-offs. Three sentences: what went well, one thing to practise next, one encouraging line for the "
    "player. If earlier sessions are given, mention the trend. Reply with JSON only: {\"note\": \"...\"}."
)

REWARD_SYSTEM = (
    "You are the cheerful host of a family reward game. A child finished a walking session. Pick one reward from the "
    "wishlist that fits the effort (bigger effort, nicer reward) and announce it in one "
    "sentence. Reply with JSON only: {\"reward\": \"<exact wishlist item name>\", \"line\": \"...\"}."
)

MEMORY_SYSTEM = (
    "You remember one player's walking-game sessions for their physical-therapy coach. Keep the trend: pace, "
    "flowers and seeds, left and right steps, the focus for next time. Wellness words only, never a diagnosis."
)


def clamp(v: Any, lo: float, hi: float, default: float) -> float:
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------- Gemini
async def gemini_json(system: str, user: str, timeout: float = 4) -> dict[str, Any] | None:
    out, _ = await gemini.generate_json(system, user, timeout=timeout)
    return out


# ---------------------------------------------------------------- Backboard memory
async def backboard(content: str, assistant_id: str | None, memory: str, timeout: float = 20) -> tuple[str, str | None] | None:
    """Send one message to Backboard. memory: 'Auto' writes and reads, 'Readonly' only reads.
    Returns (reply text, assistant id) or None. One assistant per player keeps each player's memory apart:
    it is created on the first call, and every message goes to a new thread of it (memory spans its threads)."""
    key = os.environ.get("BACKBOARD_API_KEY")
    if not key:
        return None
    headers = {"X-API-Key": key}
    try:
        async with httpx.AsyncClient(base_url=BACKBOARD_URL, headers=headers, timeout=timeout) as client:
            if not assistant_id:
                r = await client.post("/assistants", json={"name": "Zombie Walk Home coach", "system_prompt": MEMORY_SYSTEM})
                r.raise_for_status()
                assistant_id = r.json()["assistant_id"]
            r = await client.post(f"/assistants/{assistant_id}/threads", json={})
            r.raise_for_status()
            r = await client.post(f"/threads/{r.json()['thread_id']}/messages",
                                  json={"content": content, "memory": memory, "stream": False})
            r.raise_for_status()
            return str(r.json().get("content") or ""), assistant_id
    except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError):
        return None


async def backboard_ping(timeout: float = 5) -> str | None:
    """None when the key works, else the reason. Lists one assistant: no message, no memory written."""
    key = os.environ.get("BACKBOARD_API_KEY")
    if not key:
        return "no BACKBOARD_API_KEY"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(f"{BACKBOARD_URL}/assistants", headers={"X-API-Key": key}, params={"limit": 1})
        return None if r.status_code == 200 else f"Backboard HTTP {r.status_code}"
    except httpx.HTTPError as e:
        return f"Backboard call failed ({type(e).__name__})"


# ---------------------------------------------------------------- live coach
def rule_cue(summary: dict[str, Any], limits: dict[str, Any], side: dict[str, Any] | None = None) -> dict[str, Any]:
    """side: the side camera's live numbers (gait_review.live_view), when it is recording this walk."""
    act = summary.get("act")
    cadence = summary.get("cadence") or 0
    asym = summary.get("asymmetryPct")
    # Adjust from the game's current targets (the summary carries them), not from the base limits,
    # so repeated cues keep stepping in the same direction until the range stops them.
    lift = float(summary.get("liftTargetCm") or limits.get("liftCm", 10))
    spacing = float(summary.get("beatCm") or summary.get("spacingCm") or limits.get("spacingCm", 140))
    # The game spaces flowers an odd number of steps apart, so a change smaller than two steps does nothing: one notch
    # of spacing is two steps. The game reports its step (its plant speed may be set on the laptop, not here).
    notch = 2 * float(summary.get("stepCm") or 50 * float(limits.get("speedScale") or 0.7))
    if cadence < float(limits.get("minCadence", 80)):
        return {"say": "Keep stepping, a little faster, nice and steady", "params": {}}
    if asym is not None and asym > 20:
        return {"say": "Make left and right steps the same", "params": {}}
    shoes = bool(summary.get("shoeMode"))   # shoe mode: it is where the foot lands, not how high it goes
    if act == "rest":   # between rounds: the round just played (the game already counts the next round)
        r = summary.get("thisRound") or {}
        done, hit, n = int(r.get("round") or 1) - 1, int(r.get("hit") or 0), int(r.get("n") or 0)
        good = n and hit / n >= 0.6
        return {"say": f"Round {done} done, {hit} of {n} flowers. "
                       + ("Lovely rhythm. Next round in three!" if good else "Next round, land on the flower right at the line. Next round in three!"),
                "params": {}}
    if act == "garden":
        pct = summary.get("stompPct")
        if pct is not None and pct < 60:
            say = "Step right onto the glowing flower" if shoes else "Knee up high, then stomp the glowing flower"
            return {"say": say, "params": {"spacingCm": spacing + notch}}
        if pct is not None and pct > 85:
            return {"say": "Great stomping! Flowers are coming faster", "params": {"spacingCm": spacing - notch}}
    if act == "storm":
        pct = summary.get("dodgePct")
        if pct is not None and pct < 60:
            if shoes:
                return {"say": "Keep that foot out of the seed's lane", "params": {}}
            return {"say": "Lift the foot higher over the seed", "params": {"liftCm": lift - 1}}
        if pct is not None and pct > 85:
            return {"say": "Super lifts! Let us go a bit higher", "params": {"liftCm": lift + 1}}
    if side:
        # Only the leg nearer the side camera is measured well enough to name it.
        name = {"L": "left", "R": "right"}.get(side.get("nearSide"), "")
        knee, toe = side.get("kneeBendDeg"), side.get("toeLiftCm")
        if knee is not None and knee < 40:
            return {"say": f"Bend your {name} knee a little more each step", "params": {}}
        if toe is not None and toe < 4:
            return {"say": f"Lift your {name} toes a little higher each step", "params": {}}
    return {"say": "Great walking, keep it up", "params": {}}


def clamp_params(params: Any, limits: dict[str, Any]) -> dict[str, float]:
    out: dict[str, float] = {}
    if not isinstance(params, dict):
        return out
    lr, sr = limits.get("liftRange", [6, 18]), limits.get("spacingRange", [90, 220])
    if "liftCm" in params:
        out["liftCm"] = clamp(params["liftCm"], lr[0], lr[1], float(limits.get("liftCm", 10)))
    if "spacingCm" in params:
        out["spacingCm"] = clamp(params["spacingCm"], sr[0], sr[1], float(limits.get("spacingCm", 140)))
    return out


async def coach(summary: dict[str, Any], limits: dict[str, Any], side: dict[str, Any] | None = None,
                share_side: bool = False) -> dict[str, Any]:
    """side: live side-camera numbers; they go to the model only with share_side (the player's AI review consent)."""
    body: dict[str, Any] = {"summary": summary, "limits": limits}
    if side and share_side:
        body["sideCamera"] = side
    out = await gemini_json(COACH_SYSTEM, json.dumps(body))
    source = "gemini"
    if not out or not isinstance(out.get("say"), str):
        out, source = rule_cue(summary, limits, side), "rules"
    # A cue while walking is one short instruction; the rest between rounds says what went well, one fix and to walk
    # when ready, so it gets room for its two sentences instead of being cut off mid-sentence.
    say = " ".join(str(out["say"]).split()[: 32 if summary.get("act") == "rest" else 14])
    return {"say": say, "params": clamp_params(out.get("params"), limits), "source": source}


# ---------------------------------------------------------------- plan, memory, report
def describe(summary: dict[str, Any]) -> str:
    return (f"{summary.get('seconds', 0)} s, {summary.get('steps', 0)} steps, cadence {summary.get('cadence')} per min, "
            f"flowers {summary.get('stompPct')}%, "
            + ("no seed act, " if summary.get("seedAct") is False else f"seeds {summary.get('dodgePct')}%, ")
            + f"form {summary.get('formPct')}%, "
            f"high-step lift L {summary.get('highLiftAvgCm', {}).get('L')} cm R {summary.get('highLiftAvgCm', {}).get('R')} cm"
            + ("; shoe mode: the lift numbers are forward step swings seen by the camera, not heights" if summary.get("shoeMode") else "")
            + (f"; side camera gait: {json.dumps(summary['sideCamera'])[:600]}" if summary.get("sideCamera") else ""))


async def plan(player: dict[str, Any], recent: list[dict[str, Any]]) -> dict[str, Any]:
    """Greeting and focus for today, from long-term memory when Backboard is configured."""
    name = player["name"]
    if player.get("assistantId"):
        res = await backboard(
            f"{name} is starting a walking session now. In one or two short sentences, greet {name} and name one "
            "thing to focus on today, based on what you remember about earlier sessions. Wellness words only.",
            player["assistantId"], "Readonly", timeout=3)   # two calls; the game waits 8 s
        if res and res[0]:
            return {"say": res[0], "source": "backboard"}
    if recent:
        last = recent[0]["summary"]
        dodge = last.get("dodgePct")
        stomp = last.get("stompPct")
        weak = "the seeds" if dodge is not None and (stomp is None or dodge < stomp) else "the flowers"
        review = recent[0].get("gaitReview") or {}
        focus = ((review.get("review") or {}).get("focus") or {}).get("text") if review.get("status") == "done" else None
        today = focus.rstrip(".") if focus else f"focus on {weak}"   # the last gait review's focus beats the game's guess
        return {"say": f"Welcome back {name}! Last time you walked {last.get('steps', 0)} steps. Today: {today}.",
                "source": "history"}
    return {"say": f"Hi {name}! Let us walk home together.", "source": "rules"}


async def remember(player: dict[str, Any], summary: dict[str, Any]) -> str | None:
    """Write the session into the player's Backboard memory; returns the assistant id to keep."""
    res = await backboard(
        f"Session result for {player['name']}: {describe(summary)}. Therapist limits: lift target "
        f"{player['limits'].get('liftCm')} cm. Remember the trend for future sessions.",
        player.get("assistantId"), "Auto")
    return res[1] if res else None


async def report(summary: dict[str, Any], recent: list[dict[str, Any]]) -> dict[str, Any]:
    # The five latest only. Earlier side-camera numbers travel with them only while today's consent is on (today's
    # summary carries sideCamera only then), so a withdrawn consent also silences the stored history.
    share = "sideCamera" in summary
    history = [describe({k: v for k, v in r["summary"].items() if share or k != "sideCamera"}) for r in recent[:5]]
    # The save waits for the note and the reward; the game waits 25 s in all, so 10 + 6 s leaves room.
    out = await gemini_json(REPORT_SYSTEM, json.dumps({"today": describe(summary), "earlier": history}), timeout=10)
    if out and isinstance(out.get("note"), str):
        return {"note": out["note"], "source": "gemini"}
    dodge = summary.get("dodgePct")
    best = "lifting over the seeds" if dodge is not None and dodge >= (summary.get("stompPct") or 0) else "stomping the flowers"
    return {"note": f"Steady walking at {summary.get('cadence')} steps a minute with {summary.get('formPct')}% good form. "
                    f"Strongest today: {best}. Next time, practise even left and right steps. Great job!",
            "source": "rules"}


async def pick_reward(summary: dict[str, Any], wishlist: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not wishlist:
        return None
    effort = summary.get("formPct", 0)
    out = await gemini_json(REWARD_SYSTEM, json.dumps({"effortPct": effort, "wishlist": wishlist}), timeout=6)
    names = {w["name"]: w for w in wishlist}
    if out and isinstance(out.get("reward"), str) and out["reward"] in names:
        return {**names[out["reward"]], "line": str(out.get("line", ""))[:200], "source": "gemini"}
    affordable = sorted(wishlist, key=lambda w: w.get("usd", 0))
    choice = affordable[-1] if effort >= 70 else affordable[0]
    return {**choice, "line": f"You earned {choice['name']}!", "source": "rules"}
