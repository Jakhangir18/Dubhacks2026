"""Moments: the side camera's annotated leg pictures (gait.py) for one game session, with the plain-English title
and explanation the dashboard shows. Each session's moments live under data/moments/<sessionId>/: one JPEG per
moment and a sidecar moments.json with the list, so they survive a restart and need no database (the picture is
the point, and pictures do not belong in MongoDB)."""

from __future__ import annotations

import json
import os
import re
import threading
import uuid
from pathlib import Path
from typing import Any

from server.api import SESSION_ID
from server.store import DATA

DIR = DATA / "moments"
KINDS = ("knee_low", "uneven", "good")
MAX_PER_SESSION = 12       # gait.py stops at a dozen; the server holds the same line against a chatty sender
MAX_JPEG_BYTES = 200_000   # a leg crop of at most 480 px at quality 70 is a few tens of KB
ID = re.compile(r"[0-9a-f]{12}")
SIDE = {"L": "left", "R": "right"}
_lock = threading.Lock()   # one read-modify-write of a sidecar at a time


def describe(kind: str, side: str | None, value: float, target: float) -> tuple[str, str]:
    """(title, explain) for the player: what the knee did, what to aim for, in plain English."""
    leg = SIDE.get(side or "")
    whose = f"{leg} " if leg else ""
    if kind == "good":
        return f"Strong {leg} step" if leg else "Strong step", f"Your {whose}knee bent {round(value)}°. That is the lift to repeat."
    if kind == "uneven":
        gap = round(abs(target - value))
        if leg:
            other = SIDE["R" if side == "L" else "L"]
            return "Left and right differ", f"Your {other} knee lifts {gap}° more than your {leg}. Give the {leg} leg the same high step."
        return "Left and right differ", f"One knee lifts {gap}° more than the other. Give both legs the same high step."
    explain = (f"Your {whose}knee bent {round(value)}° at the top of the step. Aim for {round(target)}° or more: "
               "lift the knee as if stepping over a curb.")
    return f"{leg.capitalize()} knee stayed low" if leg else "Knee stayed low", explain


def folder(session_id: str) -> Path:
    """The session's folder; a session id is a server-made hex string, anything else never reaches the disk."""
    if not SESSION_ID.fullmatch(session_id):
        raise ValueError("bad session id")
    return DIR / session_id


def load(session_id: str) -> list[dict[str, Any]]:
    """The session's moments as they were broadcast, oldest first; [] when it has none."""
    try:
        rows = json.loads((folder(session_id) / "moments.json").read_text())
    except (OSError, ValueError):
        return []
    return rows if isinstance(rows, list) else []


def save(session_id: str, kind: str, side: str | None, value: float, target: float, t: float, jpeg: bytes) -> dict[str, Any] | None:
    """Store one moment (the picture as a file, the record appended to the sidecar) and return the record the game
    socket gets; None when the session already has MAX_PER_SESSION."""
    with _lock:
        rows = load(session_id)
        if len(rows) >= MAX_PER_SESSION:
            return None
        where = folder(session_id)
        where.mkdir(parents=True, exist_ok=True)
        moment_id = uuid.uuid4().hex[:12]
        title, explain = describe(kind, side, value, target)
        row = {"kind": "moment", "sessionId": session_id, "id": moment_id, "momentKind": kind, "side": side,
               "valueDeg": round(value, 1), "targetDeg": round(target, 1), "t": round(max(0.0, t), 2),
               "title": title, "explain": explain, "img": f"/api/moment/{session_id}/{moment_id}.jpg"}
        (where / f"{moment_id}.jpg").write_bytes(jpeg)
        tmp = where / "moments.tmp"   # write then rename, like the store: a crash never leaves half a list
        tmp.write_text(json.dumps([*rows, row], indent=1))
        os.replace(tmp, where / "moments.json")
        return row


def image(session_id: str, moment_id: str) -> Path | None:
    """The moment's JPEG, or None. Both ids are matched against their patterns before they touch a path."""
    if not SESSION_ID.fullmatch(session_id) or not ID.fullmatch(moment_id):
        return None
    path = DIR / session_id / f"{moment_id}.jpg"
    return path if path.is_file() else None
