"""Maya's chat: an answer about one walk, grounded in the session's numbers, the gait review and the side camera's
moment pictures (sent to Gemini as inline images), with a rule-based answer when the model is unavailable."""

from __future__ import annotations

import base64
from typing import Any

from server import gemini

MAX_PHOTOS = 4
MAX_MESSAGE = 500
MAX_HISTORY = 8
TIMEOUT_S = 8
SYSTEM = (
    "You are Maya, the warm AI walking coach of Zombie Walk Home, a projected floor game on a walking pad for gait "
    "practice. You talk to the player (often a child) and their parent. Answer in 2 to 4 short sentences with one "
    "concrete thing to do on the next walk. Use only the numbers given and what you can see in the pictures: each "
    "picture is a leg crop from the side camera with the skeleton drawn, the knee angle and a dashed target line. "
    "When pictures are given, say what you see in them (which knee, how high, the gap to the target). Never diagnose, "
    "name a condition or give medical advice; wellness language only: steady pace, even steps, lifting the knee. If "
    "something is not measured, say so briefly instead of guessing. Plain text, no lists, no markdown."
)


def facts(session: dict[str, Any] | None) -> str:
    if not session:
        return "No walk is on record yet."
    s = session.get("summary") or {}
    gait = (session.get("gait") or {}).get("summary") or {}
    knee = gait.get("knee") or {}
    bend = {k: (None if not isinstance((knee.get(k) or {}).get("peak_bend"), (int, float)) else round(180 - knee[k]["peak_bend"]))
            for k in ("L", "R")}
    lines = [f"seconds on the pad: {s.get('seconds')}", f"steps: {s.get('steps')}", f"cadence steps/min: {s.get('cadence')}",
             f"flowers stepped on %: {s.get('stompPct')}", f"golden flowers %: {s.get('goldenPct')}",
             f"left-right evenness %: {None if s.get('asymmetryPct') is None else max(0, 100 - s['asymmetryPct'])}",
             f"knee bend in swing, degrees, left/right: {bend['L']}/{bend['R']}",
             f"toe lift cm left/right: {gait.get('toe_lift_cm')}", f"reached home: {s.get('act') == 'home'}"]
    review = ((session.get("gaitReview") or {}).get("review")) or {}
    for key in ("overview", "playerFeedback"):
        if review.get(key):
            lines.append(f"review {key}: {review[key]}")
    focus = (review.get("focus") or {}).get("text")
    if focus:
        lines.append(f"review focus for next time: {focus}")
    for item in (review.get("findings") or [])[:3]:
        lines.append(f"finding: {item.get('text')}")
    return "\n".join(lines)


def photos(session_id: str | None, consent: bool) -> list[tuple[dict[str, Any], bytes]]:
    """Up to MAX_PHOTOS moment pictures of the session, newest first; none without the AI review consent."""
    from server import moments  # moments imports the api module, which imports this one

    if not session_id or not consent:
        return []
    out = []
    for row in reversed(moments.load(session_id)):
        try:
            data = (moments.folder(session_id) / f"{row['id']}.jpg").read_bytes()
        except (OSError, KeyError, ValueError):
            continue
        out.append((row, data))
        if len(out) == MAX_PHOTOS:
            break
    return out


def rules_reply(message: str, session: dict[str, Any] | None, shots: list[tuple[dict[str, Any], bytes]]) -> str:
    """Maya without the model: the pictures' own explanations, then the review's focus, then the numbers."""
    q = message.lower()
    if any(w in q for w in ("hurt", "pain", "sore", "dizzy")):
        return ("Please stop if something hurts, swells or feels sharp. I look at how you walk, not at pain: tell the care "
                "team and wait for them before the next walk.")
    if not session:
        return "Finish a walk on the pad and I will have something specific to say. Until then: steady pace, even steps."
    s = session.get("summary") or {}
    review = ((session.get("gaitReview") or {}).get("review")) or {}
    if shots:
        row = next((r for r, _ in shots if r.get("momentKind") != "good"), shots[0][0])
        good = sum(1 for r, _ in shots if r.get("momentKind") == "good")
        return (f"In your pictures I see this: {row['title'].lower()}. {row['explain']} "
                + (f"{good} of the {len(shots)} pictures show a strong step, so you can do it. " if good else "")
                + "Next walk: lift the knee as if stepping over a curb, on both sides.")
    focus = (review.get("focus") or {}).get("text")
    stomp = s.get("stompPct")
    head = f"You stepped on {stomp}% of the flowers" if stomp is not None else "You kept walking the whole game"
    nxt = focus or "keep the pace steady and the steps even"
    return f"{head} and took {s.get('steps') or 'your'} steps. Next time: {nxt[0].lower() + nxt[1:]}. I had no side-camera pictures for this walk."


async def ask(message: str, session: dict[str, Any] | None, consent: bool, history: list[dict[str, str]],
              player: str = "Player") -> dict[str, Any]:
    message = " ".join(message.split())[:MAX_MESSAGE]
    shots = photos((session or {}).get("id"), consent)
    parts: list[dict[str, Any]] = [{"text": f"The player's latest walk, numbers and review:\n{facts(session)}"}]
    for row, data in shots:
        parts.append({"text": f"Picture: {row['title']} ({row.get('side') or 'side unknown'} knee, {row['valueDeg']}° measured, "
                              f"target {row['targetDeg']}°, at {row['t']} s): {row['explain']}"})
        parts.append({"inlineData": {"mimeType": "image/jpeg", "data": base64.b64encode(data).decode()}})
    chat = "\n".join(f"{'Player' if h.get('role') == 'user' else 'Maya'}: {h.get('text', '')[:300]}" for h in history[-MAX_HISTORY:])
    if chat:
        parts.append({"text": f"Earlier in this chat:\n{chat}"})
    parts.append({"text": f"The player asks: {message}\nAnswer as Maya."})
    if consent or not session:
        text, err = await gemini.generate_text(SYSTEM, parts, timeout=TIMEOUT_S)
    else:
        text, err = None, "no AI consent for this player"
    if text:
        return {"reply": " ".join(text.split())[:900], "source": "gemini", "usedPhotos": len(shots), "reason": None,
                "photos": [row for row, _ in shots]}
    return {"reply": rules_reply(message, session, shots), "source": "rules", "usedPhotos": len(shots), "reason": err,
            "photos": [row for row, _ in shots]}
