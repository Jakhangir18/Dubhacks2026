"""Zombie Walk Home server: serves the game, relays camera events, runs the AI therapist, stores sessions.

Run from the repo root:
    python3 -m venv .venv && .venv/bin/pip install -r server/requirements.txt
    .venv/bin/uvicorn server.app:app --host 0.0.0.0 --port 8000      # on the laptop; open http://localhost:8000

Environment (.env next to this repo root, never committed):
    GEMINI_API_KEY      coach cues and reports (MLH Best Use of Gemini API); rule-based without it
    GEMINI_MODEL        default gemini-flash-latest
    GEMINI_REVIEW_MODEL the gait review's model (pin one; "-latest" aliases can change); default GEMINI_MODEL
    BACKBOARD_API_KEY   long-term therapist memory per player (MLH Best Use of Backboard)
    MONGODB_URI         players and sessions in MongoDB Atlas; a local JSON file without it
    VISA_MODE           mock (default) until Visa sandbox credentials exist
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import math
import os
import re
import socket
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Any

import segno
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, RedirectResponse, Response
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
        value = re.split(r"\s+#", value, maxsplit=1)[0] if value.lstrip()[:1] not in {'"', "'"} else value
        value = value.strip()   # README examples carry inline comments; KEY=#abc stays a value
        if value[:1] in {'"', "'"}:
            value = value[1:].split(value[0], 1)[0]
        os.environ.setdefault(key.strip(), value)


load_env()
from server.perceive import MAX_FRAME_CHARS, MAX_FRAMES, MAX_SESSION_FRAMES

app = FastAPI(title="Zombie Walk Home")
MAX_PERCEIVE_BYTES = MAX_FRAMES * MAX_FRAME_CHARS + 100_000
MAX_SESSION_BYTES = MAX_SESSION_FRAMES * MAX_FRAME_CHARS + 100_000
MAX_GAIT_BYTES = 2_000_000   # a whole-session gait summary with per-act parts is well under this


@app.middleware("http")
async def cap_perceive_body(request: Request, call_next):
    """Perception routes relay to a paid API: refuse a huge body before it is read."""
    limits = {"/api/perceive": MAX_PERCEIVE_BYTES, "/api/perceive/session": MAX_SESSION_BYTES, "/api/events": MAX_EVENTS_BYTES,
              "/api/gait/final": MAX_GAIT_BYTES}
    if request.method == "POST" and request.url.path in limits:
        size = request.headers.get("content-length")
        if size is None or not size.isdigit() or int(size) > limits[request.url.path]:   # every sender declares a length
            return Response(status_code=413)
    return await call_next(request)

# ---------------------------------------------------------------- event relay (Raspberry Pi -> game)
game_clients: set[WebSocket] = set()
VALID_KINDS = {"strike", "lift"}
MAX_SHOES = 4   # boxes per "shoes" sighting from feet.py
MAX_FEED_FRAME_CHARS = 200_000   # a feet.py preview JPEG (long side 480 px, quality 60) is well under this
MAX_EVENTS_PER_BATCH = 50
MAX_EVENTS_BYTES = 1_000_000


def clean_shoes(ev: dict[str, Any]) -> dict[str, Any] | None:
    """feet.py sighting: up to MAX_SHOES boxes [x1, y1, x2, y2, conf], coordinates as fractions of the frame."""
    boxes = ev.get("boxes")
    if not isinstance(boxes, list):
        return None
    out = []
    for box in boxes[: MAX_SHOES * 4]:   # look a little further than the cap so bad boxes do not eat it
        if len(out) == MAX_SHOES:
            break
        if not isinstance(box, list) or len(box) != 5 or any(isinstance(v, bool) for v in box):
            continue
        try:
            nums = [float(v) for v in box]
        except (TypeError, ValueError):
            continue
        if not all(math.isfinite(v) for v in nums):
            continue
        x1, y1, x2, y2, conf = (max(0.0, min(1.0, v)) for v in nums)
        if x2 > x1 and y2 > y1:
            out.append([x1, y1, x2, y2, conf])
    return {"kind": "shoes", "boxes": out, "source": str(ev.get("source", "feet"))[:20]}


def clean_event(ev: Any) -> dict[str, Any] | None:
    if not isinstance(ev, dict):
        return None
    if ev.get("kind") == "shoes":
        return clean_shoes(ev)
    if ev.get("kind") == "marks":
        marks = ev.get("marks")
        if not isinstance(marks, list):
            return None
        kept: list[Any] = []
        for m in marks[:8]:
            if not isinstance(m, list) or len(m) != 5 or not isinstance(m[0], str) or m[0] not in {"cyan", "magenta"}:
                continue
            if any(isinstance(v, bool) for v in m[1:]):
                continue
            try:
                nums = [float(v) for v in m[1:]]
            except (TypeError, ValueError):
                continue
            if all(math.isfinite(v) for v in nums):
                kept.append([m[0]] + [max(0.0, min(1.0, v)) for v in nums])
        return {"kind": "marks", "marks": kept, "source": str(ev.get("source", "feet"))[:20]}
    if ev.get("kind") == "frame":
        jpeg = ev.get("jpeg")
        if not isinstance(jpeg, str) or not jpeg.startswith("data:image/jpeg;base64,") or len(jpeg) > MAX_FEED_FRAME_CHARS:
            return None
        return {"kind": "frame", "jpeg": jpeg, "source": str(ev.get("source", "feet"))[:20]}
    if ev.get("foot") not in {"L", "R"} or ev.get("kind") not in VALID_KINDS:
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
            await broadcast(clean_batch(batch))
    except (WebSocketDisconnect, RuntimeError, KeyError):
        return


def clean_batch(batch: list[Any]) -> list[dict[str, Any]]:
    """At most MAX_EVENTS_PER_BATCH events, and one preview frame: the newest."""
    events = [e for e in (clean_event(x) for x in batch[:MAX_EVENTS_PER_BATCH]) if e]
    frames = [e for e in events if e["kind"] == "frame"]
    return [e for e in events if e["kind"] != "frame"] + frames[-1:]


# ---------------------------------------------------------------- run log (what the game judged), kept in memory
run_log: deque[dict[str, Any]] = deque(maxlen=300)


@app.post("/api/log")
async def post_log(request: Request) -> dict[str, Any]:
    body = await request.body()
    if len(body) > 2000:
        raise HTTPException(413)
    try:
        entry = json.loads(body)
    except json.JSONDecodeError as e:
        raise HTTPException(422) from e
    if isinstance(entry, dict):
        run_log.append({"ts": round(time.time(), 1), **{str(k)[:20]: (v if isinstance(v, (int, float, bool, dict)) else str(v)[:60]) for k, v in list(entry.items())[:12]}})
    return {"ok": True}


@app.get("/api/log")
def get_log(n: int = 50) -> list[dict[str, Any]]:
    return list(run_log)[-max(1, min(n, 300)):]


class EventsIn(BaseModel):
    events: list[dict[str, Any]]


@app.post("/api/events")
async def post_events(inp: EventsIn) -> dict[str, Any]:
    events = clean_batch(inp.events)
    listeners = await broadcast(events)
    return {"accepted": len(events), "listeners": listeners}


# ---------------------------------------------------------------- the phone as the side camera (web/phone.html)
# The phone posts JPEG pictures; gait.py on this host pulls them one by one (long poll) and the dashboard gets
# two a second as "frame" events with source "side". One picture is kept in memory, never on disk.
MAX_SIDEFRAME_BYTES = 400_000
side_frame: dict[str, Any] = {"seq": 0, "jpeg": b"", "ts": 0.0}
side_cond = asyncio.Condition()
side_shown_at = 0.0


@app.post("/api/sideframe")
async def post_sideframe(request: Request) -> dict[str, Any]:
    global side_shown_at
    body = await request.body()
    if not body.startswith(b"\xff\xd8") or len(body) > MAX_SIDEFRAME_BYTES:
        raise HTTPException(413 if len(body) > MAX_SIDEFRAME_BYTES else 415)
    async with side_cond:
        side_frame.update(seq=side_frame["seq"] + 1, jpeg=body, ts=time.time())
        side_cond.notify_all()
    if time.time() - side_shown_at >= 0.5:
        side_shown_at = time.time()
        await broadcast([{"kind": "frame", "source": "side", "jpeg": "data:image/jpeg;base64," + base64.b64encode(body).decode()}])
    return {"seq": side_frame["seq"]}


@app.get("/api/sideframe")
async def get_sideframe(after: int = 0, wait: float = 1.0) -> Response:
    """The next phone picture after `after` (long poll up to `wait` s, at most 5); 204 when none came."""
    async with side_cond:
        if side_frame["seq"] <= after:
            try:
                await asyncio.wait_for(side_cond.wait_for(lambda: side_frame["seq"] > after), timeout=max(0.0, min(5.0, wait)))
            except TimeoutError:
                return Response(status_code=204)
        return Response(content=side_frame["jpeg"], media_type="image/jpeg",
                        headers={"X-Seq": str(side_frame["seq"]), "X-Ts": f"{side_frame['ts']:.3f}"})


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


MAX_CLIPS = 50                       # keep the newest clips only, so uploads can never fill the disk
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0", ""}


def prune_clips() -> None:
    files = sorted((p for p in CLIPS.glob("*") if p.suffix in {".webm", ".mp4"}), key=lambda p: p.stat().st_mtime)
    for old in files[:-MAX_CLIPS]:
        old.unlink(missing_ok=True)


def host_name(host: str) -> str:
    """Hostname part of a Host header, IPv6 aware: '[::1]:8000' -> '::1', 'a.ts.net:8443' -> 'a.ts.net'."""
    host = host.strip()
    if host.startswith("["):
        return host[1:host.find("]")] if "]" in host else host
    return host.rsplit(":", 1)[0] if host.count(":") == 1 else host


def clip_url(request: Request, clip_id: str) -> str:
    # PUBLIC_URL (for example a Tailscale Funnel or tunnel address) wins: a judge's phone is not on the tailnet.
    if public := os.environ.get("PUBLIC_URL", "").strip().rstrip("/"):
        return f"{public}/clips/{clip_id}"
    # Forwarded headers count only from a proxy on this machine (Tailscale serve); anyone else could spoof them.
    via_local_proxy = request.client is not None and request.client.host in {"127.0.0.1", "::1"}
    fwd_host = request.headers.get("x-forwarded-host", "").split(",")[0].strip() if via_local_proxy else ""
    host = fwd_host or request.headers.get("host", "")
    if host_name(host) not in LOCAL_HOSTS:
        # Opened by a real name (Tailscale serve, a LAN IP): phones reach the same address.
        proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip() if via_local_proxy else ""
        return f"{proto or request.url.scheme}://{host}/clips/{clip_id}"
    port = request.url.port or (443 if request.url.scheme == "https" else 80)
    return f"{request.url.scheme}://{lan_ip()}:{port}/clips/{clip_id}"


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
    CLIPS.mkdir(parents=True, exist_ok=True)
    clip_id = uuid.uuid4().hex
    part = CLIPS / f"{clip_id}.part"
    size = 0
    head = b""
    try:
        # Stream to disk instead of holding up to 30 MB per upload in memory.
        with part.open("wb") as out:
            async for chunk in request.stream():
                size += len(chunk)
                if size > MAX_CLIP_BYTES:
                    raise HTTPException(413, "Clip exceeds 30 MB")
                if len(head) < 12:
                    head = (head + chunk)[:12]
                out.write(chunk)
        valid = (head[:4] == b"\x1a\x45\xdf\xa3" if media_type == "video/webm"
                 else len(head) >= 12 and head[4:8] == b"ftyp")
        if not valid:
            raise HTTPException(415, "Body does not match the video container")
        part.rename(CLIPS / f"{clip_id}{CLIP_TYPES[media_type]}")
    finally:
        part.unlink(missing_ok=True)
    await run_in_threadpool(prune_clips)
    return {"id": clip_id, "url": clip_url(request, clip_id)}


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


DASHBOARD = ROOT / "dashboard" / "dist"   # built with `npm run build` in dashboard/; served once it exists, no restart


@app.get("/dashboard", include_in_schema=False)
def dashboard_root() -> RedirectResponse:
    return RedirectResponse("/dashboard/")   # the build's asset paths are relative to the slash


@app.api_route("/dashboard/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
def dashboard(path: str) -> FileResponse:
    """The results dashboard (dashboard/). Unknown paths get its page, so /dashboard/?session=<id> always opens it."""
    root = DASHBOARD.resolve()
    if not (root / "index.html").is_file():
        raise HTTPException(404, "dashboard not built: cd dashboard && npm install && npm run build")
    file = (root / path).resolve()
    if not file.is_relative_to(root) or not file.is_file():
        file = root / "index.html"
    return FileResponse(file)


app.mount("/", StaticFiles(directory=WEB), name="web")
