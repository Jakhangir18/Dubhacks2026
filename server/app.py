"""Zombie Walk Home server: serves the game, relays camera events, runs the AI therapist, stores sessions.

Run from the repo root:
    python3 -m venv .venv && .venv/bin/pip install -r server/requirements.txt
    .venv/bin/uvicorn server.app:app --host 0.0.0.0 --port 8000      # on the laptop; open http://localhost:8000

Environment (.env next to this repo root, never committed):
    GEMINI_API_KEY      coach cues and reports (MLH Best Use of Gemini API); rule-based without it
    GEMINI_MODEL        default gemini-flash-latest
    BACKBOARD_API_KEY   long-term therapist memory per player (MLH Best Use of Backboard)
    MONGODB_URI         players and sessions in MongoDB Atlas; a local JSON file without it
    VISA_MODE           mock (default) until Visa sandbox credentials exist
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"


def load_env(path: Path = ROOT / ".env") -> None:
    """Minimal .env reader so no extra dependency is needed; real environment variables win."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env()
app = FastAPI(title="Zombie Walk Home")

# ---------------------------------------------------------------- event relay (Raspberry Pi -> game)
game_clients: set[WebSocket] = set()
VALID_KINDS = {"strike", "lift"}


def clean_event(ev: Any) -> dict[str, Any] | None:
    if not isinstance(ev, dict) or ev.get("foot") not in {"L", "R"} or ev.get("kind") not in VALID_KINDS:
        return None
    out: dict[str, Any] = {"foot": ev["foot"], "kind": ev["kind"], "source": str(ev.get("source", "pi"))[:20]}
    if ev["kind"] == "lift":
        raw = ev.get("liftCm", 0)
        if isinstance(raw, bool):
            return None
        try:
            value = float(raw)
        except (TypeError, ValueError):
            return None
        if not math.isfinite(value):  # NaN or Infinity would become a perfect 80 cm step
            return None
        out["liftCm"] = max(0.0, min(80.0, value))
    return out


async def broadcast(events: list[dict[str, Any]]) -> int:
    if not events:
        return 0
    dead = []
    for ws in list(game_clients):  # copy: clients may join or leave while we await a send
        try:
            await ws.send_json(events)
        except Exception:  # noqa: BLE001 - a closed socket raises several types
            dead.append(ws)
    for ws in dead:
        game_clients.discard(ws)
    return len(game_clients)


@app.websocket("/ws/game")
async def ws_game(ws: WebSocket) -> None:
    await ws.accept()
    game_clients.add(ws)
    try:
        while True:
            await ws.receive()  # the game only listens; keep the socket open
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        game_clients.discard(ws)


@app.websocket("/ws/events")
async def ws_events(ws: WebSocket) -> None:
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue  # one garbled frame must not cut the Pi off
            batch = msg if isinstance(msg, list) else [msg]
            await broadcast([e for e in (clean_event(x) for x in batch) if e])
    except (WebSocketDisconnect, RuntimeError, KeyError):
        return


class EventsIn(BaseModel):
    events: list[dict[str, Any]]


@app.post("/api/events")
async def post_events(inp: EventsIn) -> dict[str, Any]:
    events = [e for e in (clean_event(x) for x in inp.events) if e]
    listeners = await broadcast(events)
    return {"accepted": len(events), "listeners": listeners}


# ---------------------------------------------------------------- static game
@app.get("/")
def index() -> FileResponse:
    return FileResponse(WEB / "index.html")


app.mount("/", StaticFiles(directory=WEB), name="web")
