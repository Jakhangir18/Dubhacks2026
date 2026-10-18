"""Perceptron Mk1.5 as a second pair of eyes (Perceptron perception track).

The browser detector decides every step in real time. Perceptron then checks a few timestamped frames
of the lower legs (cropped below the knee, no face) and answers in a fixed JSON shape:
- step check: did the named foot really step onto the flower, or lift over the seed, in these frames?
- form check: is the player on the pad, holding the rail, walking steadily?
Frames are sent only when the player's therapist panel has Perceptron consent switched on.
"""

from __future__ import annotations

import json
import os
import time
from collections import deque
from typing import Any

import httpx

URL = "https://api.perceptron.inc/v1/chat/completions"
MODEL = os.environ.get("PERCEPTRON_MODEL", "perceptron-mk1.5")
MAX_FRAMES = 8
MAX_FRAME_CHARS = 400_000   # a 320 px wide JPEG data URL is far below this
CALLS_PER_MINUTE = 40       # one game sends about 30; the endpoint has no login, so cap the spend
_calls: deque[float] = deque()

STEP_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["verdict", "footVisible", "note"],
    "properties": {
        "verdict": {"type": "string", "enum": ["yes", "no", "unclear"]},
        "footVisible": {"type": "boolean"},
        "note": {"type": "string", "maxLength": 140},
    },
}

FORM_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["onPad", "holdingRail", "steady", "note"],
    "properties": {
        "onPad": {"type": "string", "enum": ["yes", "no", "unclear"]},
        "holdingRail": {"type": "string", "enum": ["yes", "no", "unclear"]},
        "steady": {"type": "string", "enum": ["yes", "no", "unclear"]},
        "note": {"type": "string", "maxLength": 140},
    },
}


def allow_call(now: float | None = None) -> bool:
    now = time.monotonic() if now is None else now
    while _calls and now - _calls[0] > 60:
        _calls.popleft()
    if len(_calls) >= CALLS_PER_MINUTE:
        return False
    _calls.append(now)
    return True


def clean_frames(frames: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep at most MAX_FRAMES JPEG or PNG data URLs with increasing integer timestamps."""
    out: list[dict[str, Any]] = []
    last = -1
    for f in frames[: MAX_FRAMES * 4]:   # look a little further than the cap so bad frames do not eat it
        if len(out) == MAX_FRAMES:
            break
        url = str(f.get("url", ""))
        try:
            ts = int(f.get("tsMs", -1))
        except (TypeError, ValueError, OverflowError):
            continue
        if not url.startswith(("data:image/jpeg;base64,", "data:image/png;base64,")) or len(url) > MAX_FRAME_CHARS:
            continue
        if ts <= last:
            continue
        last = ts
        out.append({"image_url": {"url": url}, "timestamp_ms": ts})
    return out


def step_question(foot: str, kind: str) -> str:
    side = "left" if foot == "L" else "right"
    if kind == "flower":
        action = (f"the {side} knee is raised clearly higher than in a normal walking step "
                  "and the foot then comes down onto the bright projected flower in its lane")
    else:
        action = f"the {side} foot is lifted clearly off the floor as the projected seed ball reaches it"
    return ("These timestamped frames show a person's lower legs on a walking pad with a game projected on the floor. "
            f"Answer whether {action}. Use 'unclear' when the foot is hidden or the frames do not show it.")


FORM_QUESTION = ("These timestamped frames show a person's lower legs on a walking pad with a game projected on the floor. "
                 "Is the person on the pad, are they holding a rail or support, and are they stepping steadily? "
                 "Use 'unclear' when the frames do not show it.")


async def ask(frames: list[dict[str, Any]], question: str, schema: dict[str, Any], timeout: float = 12) -> dict[str, Any] | None:
    key = os.environ.get("PERCEPTRON_API_KEY")
    if not key or len(frames) < 2:   # the API needs at least two frames of the same size
        return None
    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": [
            {"type": "video_frames", "video_frames": {"frames": frames}},
            {"type": "text", "text": question},
        ]}],
        "response_format": {"type": "json_schema", "json_schema": {"name": "answer", "schema": schema, "strict": True}},
        "temperature": 0,
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(URL, headers={"Authorization": f"Bearer {key}"}, json=body)
            r.raise_for_status()
            out = json.loads(r.json()["choices"][0]["message"]["content"])
            return out if isinstance(out, dict) else None
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return None


async def check_step(frames: list[dict[str, Any]], foot: str, kind: str) -> dict[str, Any]:
    out = await ask(frames, step_question(foot, kind), STEP_SCHEMA)
    if not out or out.get("verdict") not in {"yes", "no", "unclear"}:
        return {"verdict": "skipped", "source": "off"}
    return {"verdict": out["verdict"], "footVisible": bool(out.get("footVisible")),
            "note": str(out.get("note", ""))[:140], "source": "perceptron"}


async def check_form(frames: list[dict[str, Any]]) -> dict[str, Any]:
    out = await ask(frames, FORM_QUESTION, FORM_SCHEMA)
    if not out:
        return {"source": "off"}
    pick = lambda k: out.get(k) if out.get(k) in {"yes", "no", "unclear"} else "unclear"
    return {"onPad": pick("onPad"), "holdingRail": pick("holdingRail"), "steady": pick("steady"),
            "note": str(out.get("note", ""))[:140], "source": "perceptron"}
