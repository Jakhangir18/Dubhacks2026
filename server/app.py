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

import io
import json
import math
import os
import re
import socket
import uuid
from pathlib import Path
from typing import Any

import segno
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, Response
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


# ---------------------------------------------------------------- therapist, players, sessions, rewards
from server import api  # imported after load_env() so the store sees MONGODB_URI

app.include_router(api.router)


# ---------------------------------------------------------------- local canvas highlights (no camera uploads)
CLIPS = ROOT / "data" / "clips"
MAX_CLIP_BYTES = 30 * 1024 * 1024
CLIP_TYPES = {"video/webm": ".webm", "video/mp4": ".mp4"}


def lan_ip() -> str:
    """Ask the routing table for a LAN address; UDP connect sends no packets."""
    if host := os.environ.get("CLIP_HOST"):
        return host
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("10.255.255.255", 1))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def save_clip(clip_id: str, suffix: str, body: bytearray) -> None:
    CLIPS.mkdir(parents=True, exist_ok=True)
    (CLIPS / f"{clip_id}{suffix}").write_bytes(body)


@app.post("/api/clip", status_code=201)
async def post_clip(request: Request) -> dict[str, str]:
    media_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if media_type not in CLIP_TYPES:
        raise HTTPException(415, "Only video/webm and video/mp4 are accepted")
    length = request.headers.get("content-length")
    if length is not None:
        try:
            size = int(length)
        except ValueError:
            raise HTTPException(400, "Invalid content-length") from None
        if size > MAX_CLIP_BYTES:
            raise HTTPException(413, "Clip exceeds 30 MB")
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_CLIP_BYTES:
            raise HTTPException(413, "Clip exceeds 30 MB")
        body.extend(chunk)
    valid = (body[:4] == b"\x1a\x45\xdf\xa3" if media_type == "video/webm"
             else len(body) >= 12 and body[4:8] == b"ftyp")
    if not valid:
        raise HTTPException(415, "Body does not match the video container")
    clip_id = uuid.uuid4().hex
    await run_in_threadpool(save_clip, clip_id, CLIP_TYPES[media_type], body)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    hostname = host.split(":")[0]
    if hostname and hostname not in {"localhost", "127.0.0.1", "::1"}:
        # Opened by a real name (Tailscale serve, a LAN IP): phones reach the same address.
        scheme = request.headers.get("x-forwarded-proto") or request.url.scheme
        return {"id": clip_id, "url": f"{scheme}://{host}/clips/{clip_id}"}
    port = request.url.port or (443 if request.url.scheme == "https" else 80)
    return {"id": clip_id, "url": f"{request.url.scheme}://{lan_ip()}:{port}/clips/{clip_id}"}


@app.get("/clips/{clip_id}")
def get_clip(clip_id: str) -> FileResponse:
    if not re.fullmatch(r"[0-9a-f]{32}", clip_id):
        raise HTTPException(404, "Clip not found")
    for media_type, suffix in CLIP_TYPES.items():
        path = CLIPS / f"{clip_id}{suffix}"
        if path.is_file():
            return FileResponse(path, media_type=media_type, filename=f"walk-{clip_id}{suffix}",
                                content_disposition_type="inline")
    raise HTTPException(404, "Clip not found")


@app.get("/api/qr")
def qr(url: str) -> Response:
    if len(url) > 1024 or not url.startswith(("http://", "https://")):
        raise HTTPException(400, "Expected an HTTP URL of at most 1024 characters")
    svg = io.BytesIO()
    segno.make(url, micro=False, error="m").save(svg, kind="svg", scale=6, border=4, light="white")
    return Response(svg.getvalue(), media_type="image/svg+xml")


# ---------------------------------------------------------------- static game
@app.get("/")
def index() -> FileResponse:
    return FileResponse(WEB / "index.html")


app.mount("/", StaticFiles(directory=WEB), name="web")
