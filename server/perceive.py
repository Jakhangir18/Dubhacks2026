"""Perceptron Mk1.5 as a second pair of eyes (Perceptron perception track).

The game decides every step in real time. Perceptron then checks a few timestamped frames and answers in a fixed
JSON shape. The frames come from one of two views: "overhead", feet.py's camera above the belt (shoes and the projected
flowers from above, never a face), used whenever its pictures reach the game; or "legs", the game window's own camera
cropped below the knees.
- step check: did the named foot really step onto the flower, or lift over the seed, in these frames?
- form check: is the player on the pad, holding the rail, walking steadily?
Frames are sent only when the player's therapist panel has Perceptron consent switched on.
"""

from __future__ import annotations

import asyncio
import html
import json
import math
import os
import re
import time
from collections import deque
from typing import Any

import httpx

URL = "https://api.perceptron.inc/v1/chat/completions"
MODEL = os.environ.get("PERCEPTRON_MODEL", "perceptron-mk1.5")
MAX_FRAMES = 8
MAX_SESSION_FRAMES = 32
MAX_FRAME_CHARS = 400_000   # a 320 px wide JPEG data URL is far below this
CALLS_PER_MINUTE = 40       # one game sends about 30; the endpoint has no login, so cap the spend (per process: run one worker)
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


def clean_frames(frames: list[dict[str, Any]], cap: int = MAX_FRAMES) -> list[dict[str, Any]]:
    """Keep at most cap JPEG or PNG data URLs with increasing integer timestamps."""
    out: list[dict[str, Any]] = []
    last = -1
    for f in frames[: cap * 4]:   # look a little further than the cap so bad frames do not eat it
        if len(out) == cap:
            break
        if not isinstance(f, dict):
            continue
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


VIEWS = {"legs", "overhead"}
OVERHEAD = ("These timestamped frames are a top-down view of a walking belt seen from a camera above it. A game is "
            "projected onto the floor in front of the walker: glowing flowers move towards the feet, and the walker "
            "steps onto them. The camera may be rotated or mirrored, so do not rely on left and right in the picture. ")


def step_question(foot: str, kind: str, view: str = "legs") -> str:
    side = "left" if foot == "L" else "right"
    if view == "overhead":
        if kind == "flower":
            ask = ("Answer whether a shoe comes down on, or covers, the glowing flower as it reaches the feet "
                   f"(it is in the walker's {side} lane).")
        else:
            ask = f"Answer whether both shoes stay clear of the projected seed ball as it reaches the feet (it is in the walker's {side} lane)."
        return OVERHEAD + ask + " Use 'unclear' when the shoes or the flower are hidden or the frames do not show it."
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
FORM_QUESTION_OVERHEAD = (OVERHEAD + "Are both feet on the belt, are the hands holding a rail or support (answer 'unclear' "
                          "when no hands are in the picture), and are the steps steady and even?")


async def ask(frames: list[dict[str, Any]], question: str, schema: dict[str, Any], timeout: float = 12) -> dict[str, Any] | None:
    key = os.environ.get("PERCEPTRON_API_KEY")
    if not key or len(frames) < 2:   # the API needs at least two frames of the same size
        return None
    if not allow_call():   # counted here, so only requests that go out use the budget
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


async def check_step(frames: list[dict[str, Any]], foot: str, kind: str, view: str = "legs") -> dict[str, Any]:
    out = await ask(frames, step_question(foot, kind, view), STEP_SCHEMA)
    if not out or out.get("verdict") not in {"yes", "no", "unclear"}:
        return {"verdict": "skipped", "source": "off"}
    return {"verdict": out["verdict"], "footVisible": bool(out.get("footVisible")),
            "note": str(out.get("note", ""))[:140], "source": "perceptron"}


async def check_form(frames: list[dict[str, Any]], view: str = "legs") -> dict[str, Any]:
    out = await ask(frames, FORM_QUESTION_OVERHEAD if view == "overhead" else FORM_QUESTION, FORM_SCHEMA)
    if not out:
        return {"source": "off"}
    pick = lambda k: out.get(k) if out.get(k) in {"yes", "no", "unclear"} else "unclear"
    return {"onPad": pick("onPad"), "holdingRail": pick("holdingRail"), "steady": pick("steady"),
            "note": str(out.get("note", ""))[:140], "source": "perceptron"}


# Annotation markup is not HTML: in particular, <track> must retain its children.
NUMBER = r"-?\d+(?:\.\d+)?"
PAIR = re.compile(rf"\(\s*({NUMBER})\s*,\s*({NUMBER})\s*\)")


def attributes(markup: str) -> dict[str, str]:
    return {k: html.unescape(v) for k, _, v in re.findall(r'''([\w_]+)\s*=\s*(["'])(.*?)\2''', markup, re.DOTALL)}


def times(value: str) -> list[float]:
    return [float(n) for n in re.findall(rf"({NUMBER})\s*seconds?\b", value)]


COLLECTION = re.compile(r"<collection\b([^>]*)>(.*?)</collection\s*>", re.DOTALL)


def grouped(content: str) -> list[tuple[str | None, str]]:
    """(mention, body) pairs: the live API wraps repeated clips and tracks in a <collection> and names only that."""
    parts: list[tuple[str | None, str]] = [(attributes(tag).get("mention"), body) for tag, body in COLLECTION.findall(content)]
    parts.append((None, COLLECTION.sub("", content)))
    return parts


def parse_clips(content: str) -> list[dict[str, Any]]:
    clips = []
    for group, tag in ((g, t) for g, body in grouped(content) for t in re.findall(r"<clip\b([^>]*)/?>", body)):
        attrs = attributes(tag)
        ts = times(attrs.get("t", ""))
        if attrs.get("asset_idx", "0") != "0" or not 1 <= len(ts) <= 2:
            continue
        if not all(math.isfinite(t) and t >= 0 for t in ts) or ts[-1] < ts[0]:
            continue
        clips.append({"mention": attrs.get("mention") or group or "high step", "t0": ts[0], "t1": ts[-1]})
    clips.sort(key=lambda c: c["t0"])
    return clips


def parse_tracks(content: str) -> dict[str, list[dict[str, Any]]]:
    tracks: dict[str, list[dict[str, Any]]] = {}
    found = ((g, t, b) for g, part in grouped(content) for t, b in re.findall(r"<track\b([^>]*)>(.*?)</track\s*>", part, re.DOTALL))
    for group, tag, body in found:
        attrs = attributes(tag)
        mention = attrs.get("mention") or group or ""
        if attrs.get("asset_idx", "0") != "0" or mention not in {"left foot", "right foot"}:
            continue
        points = []
        for point_tag, coords in re.findall(r"<point_box\b([^>]*)>(.*?)</point_box\s*>", body, re.DOTALL):
            point_attrs = attributes(point_tag)
            ts = times(point_attrs.get("t", ""))
            pairs = PAIR.findall(coords)
            if point_attrs.get("asset_idx", "0") != "0" or len(ts) != 1 or len(pairs) != 2:
                continue
            box = [float(n) for pair in pairs for n in pair]
            if (not math.isfinite(ts[0]) or ts[0] < 0 or not all(0 <= n <= 1000 for n in box)
                    or box[0] > box[2] or box[1] > box[3]):
                continue
            points.append({"t": ts[0], "box": box})
        tracks.setdefault(mention, []).extend(points)
    for points in tracks.values():
        points.sort(key=lambda p: p["t"])
    return tracks


def parse_points(result: dict[str, Any]) -> list[dict[str, Any]]:
    points = []
    for detection in result["detections"]:
        try:
            x, y = float(detection["point"]["x"]), float(detection["point"]["y"])
            if not (0 <= x <= 320 and 0 <= y <= 240):
                continue
            points.append({"mention": str(detection["mention"]), "point": {"x": x * 1000 / 320, "y": y * 1000 / 240}})
        except (KeyError, TypeError, ValueError):
            continue
    return points


def parse_multilook(result: dict[str, Any]) -> dict[str, str | None]:
    fields = ["caption", "gaitNote", "safety"]
    out: dict[str, str | None] = dict.fromkeys(fields)
    for item in result["results"]:
        try:
            index = item["prompt_index"]
            if item.get("error") or type(index) is not int or not 0 <= index < len(fields):
                continue
            content = item["completions"][0]["message"]["content"]
            if isinstance(content, str) and content.strip():
                out[fields[index]] = content.strip()
        except (KeyError, IndexError, TypeError):
            continue
    return out


async def ask_session(url: str, body: dict[str, Any], usage: dict[str, int]) -> dict[str, Any] | None:
    key = os.environ.get("PERCEPTRON_API_KEY")
    if not key or not allow_call():
        return None
    usage["requests"] += 1
    try:
        async with httpx.AsyncClient(timeout=75) as client:
            response = await client.post(url, headers={"Authorization": f"Bearer {key}"}, json=body)
            response.raise_for_status()
            result = response.json()
            return result if isinstance(result, dict) else None
    except (httpx.HTTPError, ValueError):
        return None


# The walk report's questions for each view: what a camera above the belt can see differs from a side view of the legs.
REPORT = {
    "legs": {
        "clip": ("Mark every moment a foot is lifted clearly higher than a normal walking step; "
                 "mention 'left high step' or 'right high step'."),
        "categories": ["foot", "flower", "seed ball"],
        "note": ("Write a two-sentence gait note for the therapist on cadence, symmetry and high-step quality. "
                 "Describe only what these sampled lower-leg frames show; acknowledge uncertainty."),
        "safety": ("Write one safety line about holding a rail, stumbles and leaving the pad. "
                   "These frames show only lower legs; say when something is not visible rather than guessing."),
    },
    "overhead": {
        "clip": OVERHEAD + "Mark every moment a shoe lands on a glowing flower; mention 'flower stomp'.",
        "categories": ["shoe", "flower"],
        "note": (OVERHEAD + "Write a two-sentence note for the therapist on how evenly the feet step and how well they "
                 "land on the flowers. Describe only what these sampled top-down frames show; acknowledge uncertainty."),
        "safety": (OVERHEAD + "Write one safety line about staying in the middle of the belt and steady footing. "
                   "Say when something is not visible rather than guessing."),
    },
}


async def session_report(frames: list[dict[str, Any]], view: str = "legs") -> dict[str, Any]:
    if len(frames) < 2 or not os.environ.get("PERCEPTRON_API_KEY"):
        return {"source": "off"}
    ask_for = REPORT.get(view, REPORT["legs"])
    usage = {"requests": 0}
    video = {"type": "video_frames", "video_frames": {"frames": frames}}
    key_frame = frames[len(frames) // 2]["image_url"]["url"]

    async def annotation(kind: str, question: str) -> Any:
        result = await ask_session(URL, {
            "model": MODEL, "messages": [{"role": "user", "content": [video, {"type": "text", "text": question}]}],
            "vision_config": {"annotation_format": kind}, "reasoning_effort": "low", "max_completion_tokens": 2048,
        }, usage)
        if result is None:
            return None
        content = result["choices"][0]["message"]["content"]
        if not isinstance(content, str) or not content.strip():
            return None
        return parse_clips(content) if kind == "clip" else parse_tracks(content)

    async def detect() -> Any:
        result = await ask_session("https://api.perceptron.inc/v1/detect", {
            "media": {"type": "image", "image_url": key_frame}, "categories": ask_for["categories"],
            "config": {"output": "point", "reasoning_effort": "none"},
        }, usage)
        return parse_points(result) if result is not None else None

    async def multilook() -> Any:
        result = await ask_session(URL + "/multilook", {
            "model": MODEL, "context": [{"role": "user", "content": [video]}],
            "prompts": [
                "Write a one-sentence social caption for this walk clip. Keep it kid-friendly and use no names.",
                ask_for["note"],
                ask_for["safety"],
            ], "n": 1, "reasoning_effort": "none", "max_completion_tokens": 400,   # with reasoning, 512 tokens came back empty
        }, usage)
        return parse_multilook(result) if result is not None else None

    results = await asyncio.gather(
        annotation("clip", ask_for["clip"]),
        annotation("box", "Track both feet over these frames. Return one track per foot, with mentions "
                   "'left foot' and 'right foot', using timestamped point_box annotations."),
        detect(), multilook(), return_exceptions=True,
    )
    clips, tracks, points, looks = [None if isinstance(r, BaseException) else r for r in results]
    if all(r is None for r in (clips, tracks, points, looks)):
        return {"source": "off"}
    return {"source": "perceptron", "clips": clips, "tracks": tracks, "points": points, "keyFrame": key_frame,
            "caption": (looks or {}).get("caption"), "gaitNote": (looks or {}).get("gaitNote"),
            "safety": (looks or {}).get("safety"), "usage": usage, "view": view if view in VIEWS else "legs"}
