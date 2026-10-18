"""The AI therapist: live cues (Gemini), long-term memory (Backboard), reports and the reward host.

Every function has a rule-based fallback, so the game works with no keys and no network.
Safety lives here, not in the model: the model only proposes; limits clamp everything it returns.
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
BACKBOARD_URL = "https://app.backboard.io/api/threads/messages"

COACH_SYSTEM = (
    "You are the voice of a warm physical-therapy coach inside a walking game for children, teenagers and adults. "
    "The player walks in place. Act 1: keep a steady pace. Act 2: high-step onto flowers with the matching foot. "
    "Act 3: lift the foot a seed is aiming at. You get a summary of the last stretch and the therapist's limits. "
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


def clamp(v: Any, lo: float, hi: float, default: float) -> float:
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------- Gemini
async def gemini_json(system: str, user: str, timeout: float = 4) -> dict[str, Any] | None:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    model = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.5},
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(GEMINI_URL.format(model=model), params={"key": key}, json=body)
            r.raise_for_status()
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
            out = json.loads(text)
            return out if isinstance(out, dict) else None
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError, ValueError):
        return None


# ---------------------------------------------------------------- Backboard memory
async def backboard(content: str, assistant_id: str | None, memory: str, timeout: float = 20) -> tuple[str, str | None] | None:
    """Send one message to Backboard. memory: 'Auto' writes and reads, 'Readonly' only reads.
    Returns (reply text, assistant id) or None. One assistant per player keeps each player's memory apart."""
    key = os.environ.get("BACKBOARD_API_KEY")
    if not key:
        return None
    fields: dict[str, Any] = {"content": content, "memory": memory, "stream": False}
    if assistant_id:
        fields["assistant_id"] = assistant_id
    headers = {"X-API-Key": key}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(BACKBOARD_URL, headers=headers, json=fields)
            if r.status_code in (415, 422):  # the endpoint may expect form fields
                r = await client.post(BACKBOARD_URL, headers=headers, data={k: str(v) for k, v in fields.items()})
            r.raise_for_status()
            j = r.json()
            text = j.get("content") or j.get("message") or ""
            return str(text), j.get("assistant_id") or assistant_id
    except (httpx.HTTPError, ValueError, AttributeError):
        return None


# ---------------------------------------------------------------- live coach
def rule_cue(summary: dict[str, Any], limits: dict[str, Any]) -> dict[str, Any]:
    act = summary.get("act")
    cadence = summary.get("cadence") or 0
    asym = summary.get("asymmetryPct")
    # Adjust from the game's current targets (the summary carries them), not from the base limits,
    # so repeated cues keep stepping in the same direction until the range stops them.
    lift = float(summary.get("liftTargetCm") or limits.get("liftCm", 10))
    spacing = float(summary.get("spacingCm") or limits.get("spacingCm", 140))
    if cadence < float(limits.get("minCadence", 80)):
        return {"say": "Keep stepping, a little faster, nice and steady", "params": {}}
    if asym is not None and asym > 20:
        return {"say": "Make left and right steps the same", "params": {}}
    shoes = bool(summary.get("shoeMode"))   # shoe mode: it is where the foot lands, not how high it goes
    if act == "garden":
        pct = summary.get("stompPct")
        if pct is not None and pct < 60:
            say = "Step right onto the glowing flower" if shoes else "Knee up high, then stomp the glowing flower"
            return {"say": say, "params": {"spacingCm": spacing + 30}}
        if pct is not None and pct > 85:
            return {"say": "Great stomping! Flowers are coming faster", "params": {"spacingCm": spacing - 20}}
    if act == "storm":
        pct = summary.get("dodgePct")
        if pct is not None and pct < 60:
            if shoes:
                return {"say": "Keep that foot out of the seed's lane", "params": {}}
            return {"say": "Lift the foot higher over the seed", "params": {"liftCm": lift - 1}}
        if pct is not None and pct > 85:
            return {"say": "Super lifts! Let us go a bit higher", "params": {"liftCm": lift + 1}}
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


async def coach(summary: dict[str, Any], limits: dict[str, Any]) -> dict[str, Any]:
    out = await gemini_json(COACH_SYSTEM, json.dumps({"summary": summary, "limits": limits}))
    source = "gemini"
    if not out or not isinstance(out.get("say"), str):
        out, source = rule_cue(summary, limits), "rules"
    say = " ".join(str(out["say"]).split()[:14])
    return {"say": say, "params": clamp_params(out.get("params"), limits), "source": source}


# ---------------------------------------------------------------- plan, memory, report
def describe(summary: dict[str, Any]) -> str:
    return (f"{summary.get('seconds', 0)} s, {summary.get('steps', 0)} steps, cadence {summary.get('cadence')} per min, "
            f"flowers {summary.get('stompPct')}%, seeds {summary.get('dodgePct')}%, form {summary.get('formPct')}%, "
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
            player["assistantId"], "Readonly", timeout=4)
        if res and res[0]:
            return {"say": res[0], "source": "backboard"}
    if recent:
        last = recent[0]["summary"]
        dodge = last.get("dodgePct")
        stomp = last.get("stompPct")
        weak = "the seeds" if dodge is not None and (stomp is None or dodge < stomp) else "the flowers"
        return {"say": f"Welcome back {name}! Last time you walked {last.get('steps', 0)} steps. Today, focus on {weak}.",
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
    history = [describe(r["summary"]) for r in recent[:5]]   # the five latest only
    out = await gemini_json(REPORT_SYSTEM, json.dumps({"today": describe(summary), "earlier": history}))
    if out and isinstance(out.get("note"), str):
        return {"note": out["note"], "source": "gemini"}
    best = "lifting over the seeds" if (summary.get("dodgePct") or 0) >= (summary.get("stompPct") or 0) else "stomping the flowers"
    return {"note": f"Steady walking at {summary.get('cadence')} steps a minute with {summary.get('formPct')}% good form. "
                    f"Strongest today: {best}. Next time, practise even left and right steps. Great job!",
            "source": "rules"}


async def pick_reward(summary: dict[str, Any], wishlist: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not wishlist:
        return None
    effort = summary.get("formPct", 0)
    out = await gemini_json(REWARD_SYSTEM, json.dumps({"effortPct": effort, "wishlist": wishlist}))
    names = {w["name"]: w for w in wishlist}
    if out and isinstance(out.get("reward"), str) and out["reward"] in names:
        return {**names[out["reward"]], "line": str(out.get("line", ""))[:200], "source": "gemini"}
    affordable = sorted(wishlist, key=lambda w: w.get("usd", 0))
    choice = affordable[-1] if effort >= 70 else affordable[0]
    return {**choice, "line": f"You earned {choice['name']}!", "source": "rules"}
