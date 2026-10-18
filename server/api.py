"""HTTP API for the therapist panel and the game: players and limits, live coach, plan, sessions, rewards."""

from __future__ import annotations

import math
import os
import re
import time
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from server import gait_review, gemini, maya, perceive, therapist, tts
from server.store import Store

router = APIRouter(prefix="/api")
store = Store()


@router.get("/status")
def status() -> dict[str, Any]:
    """Which sponsor integrations are live; the panel shows this so the team knows what runs for real."""
    return {
        "gemini": bool(os.environ.get("GEMINI_API_KEY")),
        "backboard": bool(os.environ.get("BACKBOARD_API_KEY")),
        "storage": store.backend,
        "visa": os.environ.get("VISA_MODE", "mock"),
        "perceptron": bool(os.environ.get("PERCEPTRON_API_KEY")),
        "voice": tts.available(),   # the coach speaks with Gemini's voice; the browser's own voice otherwise
    }


# ---------------------------------------------------------------- the coach's voice (server/tts.py)
class TtsIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    player: str | None = None   # set when the line is about this player's walk: then it needs their AI consent


@router.post("/tts")
async def speak(inp: TtsIn) -> Response:
    """One coach line as WAV. Story lines carry nothing personal; a line about a player's walk goes to Gemini only with
    that player's AI consent, and never with their name in it."""
    text = " ".join(inp.text.split())[: tts.MAX_CHARS]
    if inp.player is not None:
        player = await run_in_threadpool(store.player, inp.player)
        if not player.get("aiReviewConsent"):
            raise HTTPException(403, "no AI consent for this player: the browser voice speaks this line")
        text = tts.strip_name(text, player["name"])
    if not text:
        raise HTTPException(422, "nothing to say")
    audio, reason = await tts.synthesize(text)
    if audio is None:
        raise HTTPException(503, reason or "no audio")
    return Response(audio, media_type="audio/wav", headers={"Cache-Control": "private, max-age=86400"})


class MayaIn(BaseModel):
    player: str = "Player"
    sessionId: str | None = None
    message: str = Field(min_length=1, max_length=maya.MAX_MESSAGE)
    history: list[dict[str, str]] = Field(default_factory=list, max_length=maya.MAX_HISTORY)


@router.post("/maya")
async def ask_maya(inp: MayaIn) -> dict[str, Any]:
    """Maya's chat answer about one walk (the latest without a sessionId), with the side camera's pictures when the
    player has the AI gait review consent; the rules answer when the model does not."""
    name = inp.player.strip()[:40] or "Player"
    player = await run_in_threadpool(store.player, name)
    if inp.sessionId and SESSION_ID.fullmatch(inp.sessionId):
        session = await run_in_threadpool(store.session, inp.sessionId)
    else:
        rows = await run_in_threadpool(store.sessions, name, 1)
        session = rows[0] if rows else None
    if session and session.get("player") != name:
        raise HTTPException(404, "no such session for this player")
    history = [{"role": h.get("role", "user"), "text": h.get("text", "")} for h in inp.history if h.get("role") in ("user", "maya")]
    out = await maya.ask(inp.message, session, bool(player.get("aiReviewConsent")), history, name)
    return {"reply": out["reply"], "source": out["source"], "usedPhotos": out["usedPhotos"], "photos": out["photos"],
            "sessionId": (session or {}).get("id")}


@router.get("/health")
async def health() -> dict[str, Any]:
    """Real calls, for the panel's Check button only (the game reads /status, which must stay instant).
    Each entry: {"ok": bool, "detail": str}. Perceptron is not called: every call is paid."""
    _, gemini_err = await gemini.generate_json("Reply with JSON only.", 'Return {"ok": true}.', timeout=10, temperature=0)
    checks = {
        "gemini": gemini_err,
        "mongodb": await run_in_threadpool(store.ping),
        "backboard": await therapist.backboard_ping(),
        "perceptron": None if os.environ.get("PERCEPTRON_API_KEY") else "no PERCEPTRON_API_KEY",
    }
    return {k: {"ok": err is None, "detail": err or ("key set, not called" if k == "perceptron" else "answered")}
            for k, err in checks.items()}


# ---------------------------------------------------------------- players and therapist limits
@router.get("/players")
def players() -> list[str]:
    return store.players()


@router.get("/player/{name}")
def get_player(name: str, reports: bool = False) -> dict[str, Any]:
    player = store.player(name)
    if not reports:
        player.pop("perceptronReports", None)   # key frames are heavy; only the therapist panel asks for them
    return player


class PlayerIn(BaseModel):
    limits: dict[str, Any] | None = None
    rewards: list[dict[str, Any]] | None = None
    notes: str | None = None
    perceptronConsent: bool | None = None   # the parent or therapist allows leg-only frames to go to Perceptron
    aiReviewConsent: bool | None = None     # ... and the side camera's gait numbers (no video) to go to Gemini


def clean_rewards(rewards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for r in rewards[:20]:
        name = str(r.get("name", "")).strip()[:60]
        try:
            usd = round(max(0.0, min(100.0, float(r.get("usd", 0)))), 2)
        except (TypeError, ValueError):
            continue
        if name:
            out.append({"name": name, "usd": usd})
    return out


@router.put("/player/{name}")
def put_player(name: str, inp: PlayerIn) -> dict[str, Any]:
    return store.update_player(
        name,
        limits=inp.limits,
        rewards=clean_rewards(inp.rewards) if inp.rewards is not None else None,
        notes=inp.notes[:500] if inp.notes is not None else None,
        perceptronConsent=inp.perceptronConsent,
        aiReviewConsent=inp.aiReviewConsent,
    )


# ---------------------------------------------------------------- live coach and plan
class CoachIn(BaseModel):
    player: str = "Player"
    summary: dict[str, Any]


@router.post("/coach")
async def coach(inp: CoachIn) -> dict[str, Any]:
    # Store calls run in the threadpool so a slow database never stalls the foot-event relay.
    player = await run_in_threadpool(store.player, inp.player)
    gait = player.get("gait") or {}
    live = gait_review.live_view(gait.get("summary")) if time.time() - float(gait.get("ts") or 0) < LIVE_GAIT_S else None
    return await therapist.coach(inp.summary, player["limits"], live, share_side=player.get("aiReviewConsent", False))


@router.get("/plan/{name}")
async def plan(name: str) -> dict[str, Any]:
    player = await run_in_threadpool(store.player, name)
    recent = await run_in_threadpool(store.sessions, name, 5)
    return await therapist.plan(player, recent)


# ---------------------------------------------------------------- session end: save, remember, report, reward
class SessionIn(BaseModel):
    player: str = "Player"
    summary: dict[str, Any]
    verified: bool = True
    id: str | None = None   # from /api/session/start; the side camera's review attaches to it


def visa_checkout(item: dict[str, Any], player: str) -> dict[str, Any]:
    """Visa Reimagine Shopping: the reward is bought for the player. A labelled mock until Visa Acceptance
    sandbox credentials exist (VISA_MODE=sandbox then calls the real payment link API)."""
    return {
        "id": f"mock-{uuid.uuid4().hex[:10]}",
        "network": "Visa sandbox (mock)",
        "item": item["name"],
        "amountUsd": item.get("usd", 0),
        "for": player,
        "status": "approved (mock, no real payment)",
        "ts": time.time(),
    }


async def remember_later(name: str, summary: dict[str, Any]) -> None:
    player = await run_in_threadpool(store.player, name)
    assistant_id = await therapist.remember(player, summary)
    if assistant_id and assistant_id != player.get("assistantId"):
        await run_in_threadpool(store.update_player, name, assistantId=assistant_id)


REWARDS_PER_DAY = 2   # a child cannot farm rewards by replaying; the parent list is small anyway


def rewards_today(rows: list[dict[str, Any]]) -> int:
    day_ago = time.time() - 86400
    return sum(1 for r in rows if r.get("ts", 0) >= day_ago and r.get("rewarded"))


@router.post("/session")
async def session(inp: SessionIn, background: BackgroundTasks) -> dict[str, Any]:
    name = inp.player.strip()[:40] or "Player"
    player = await run_in_threadpool(store.player, name)
    earlier = await run_in_threadpool(store.sessions, name, 200)   # enough history for the per-day reward cap
    inp.summary.pop("sideCamera", None)   # only the server attaches side-camera data, cleaned
    # The note and the memory are written by outside models: gait numbers go to them only with the AI review consent.
    side = fresh_gait(player) if player.get("aiReviewConsent") else None
    if side:
        inp.summary["sideCamera"] = side   # the therapist note and the stored session both see it
        await run_in_threadpool(store.update_player, name, gait={"used": True})   # one walk, one summary
    note = await therapist.report(inp.summary, earlier)
    out: dict[str, Any] = {"note": note["note"], "noteSource": note["source"], "reward": None, "receipt": None}
    long_enough = (inp.summary.get("seconds") or 0) >= 20   # the short judge demo is about 30 s
    eligible = inp.verified and long_enough and inp.summary.get("act") == "home" and rewards_today(earlier) < REWARDS_PER_DAY
    if eligible:
        reward = await therapist.pick_reward(inp.summary, player.get("rewards", []))
        if reward:
            out["reward"] = reward
    # Save first, so a finished walk is never lost if the checkout fails.
    sid = inp.id if inp.id and SESSION_ID.fullmatch(inp.id) and not await run_in_threadpool(store.session, inp.id) else None
    extra = {"gaitReview": {"status": "waiting", "ts": time.time()}} if sid and side_camera_on(sid) else {}
    doc = await run_in_threadpool(store.add_session, name, inp.summary, inp.verified, note["note"], out["reward"] is not None,
                                  sid, **extra)
    out["id"] = doc["id"]
    out["gaitReview"] = extra.get("gaitReview")
    if sid and (active_session() or {}).get("id") == sid:
        await run_in_threadpool(store.set_setting, ACTIVE_KEY, NO_SESSION)   # only now, so the side camera finds it saved
    if out["reward"]:
        try:
            out["receipt"] = visa_checkout(out["reward"], name)
        except Exception:  # noqa: BLE001 - a payment error must not lose the session
            out["receipt"] = {"network": "Visa", "status": "checkout failed, try again from the panel"}
    background.add_task(remember_later, name, inp.summary)   # Backboard memory, off the response path
    return out


# ---------------------------------------------------------------- side-camera gait (vision/CONTRACT.md)
GAIT_FRESH_S = 30 * 60   # a side-camera summary older than this does not belong to the walk being saved


def clean_gait(value: Any, depth: int = 0) -> Any:
    """Numbers, short strings, booleans and small nested objects or lists only; anything else is dropped."""
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, int):
        return value if abs(value) < 2**53 else None   # fits a float and MongoDB's 8-byte int
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, str):
        return value[:200]
    if depth < 3 and isinstance(value, dict):
        return {str(k)[:40]: clean_gait(v, depth + 1) for k, v in list(value.items())[:40]}
    if depth < 3 and isinstance(value, list):
        return [clean_gait(v, depth + 1) for v in value[:60]]
    return None


class GaitIn(BaseModel):
    player: str = "Player"
    source: str = "side-camera"
    summary: dict[str, Any] | None   # gait.py GaitTracker.summary(); None when it saw too little
    sessionId: str | None = None     # the game session the side camera is recording


@router.post("/gait")
def post_gait(inp: GaitIn) -> dict[str, Any]:
    name = inp.player.strip()[:40] or "Player"
    active = active_session()
    if inp.sessionId and active and active["id"] == inp.sessionId:
        name = active["player"]   # the game named the player when it started the session
        store.set_setting(CHECKIN_KEY, {"sessionId": inp.sessionId, "ts": time.time()})
    elif name not in store.players():
        raise HTTPException(404, f"no player {name!r}: use the name from the therapist panel")
    if not inp.summary:
        return {"ok": False, "reason": "empty summary"}
    gait = {"ts": time.time(), "source": inp.source[:40], "summary": clean_gait(inp.summary)}
    store.update_player(name, gait=gait)
    return {"ok": True}


def fresh_gait(player: dict[str, Any]) -> dict[str, Any] | None:
    gait = player.get("gait")
    if not isinstance(gait, dict) or not isinstance(gait.get("summary"), dict):
        return None
    return gait["summary"] if time.time() - float(gait.get("ts") or 0) < GAIT_FRESH_S else None


@router.get("/sessions/{name}")
def sessions(name: str) -> list[dict[str, Any]]:
    rows = [settle_review(r) for r in store.sessions(name, limit=30)]
    for r in rows:   # the full gait summary is heavy; the list keeps where it came from, /api/session/{id} has it all
        if isinstance(r.get("gait"), dict):
            r["gait"] = {k: r["gait"].get(k) for k in ("source", "quality", "ts")}
    return rows


# ---------------------------------------------------------------- one session id for the game, the side camera and the review
ACTIVE_KEY, CHECKIN_KEY = "activeSession", "gaitCheckin"
NO_SESSION = {"id": None, "player": None, "startedAt": 0}   # settings merge in MongoDB, so clearing writes empty values
ACTIVE_TTL_S = 90 * 60     # a session still active after this was left in a closed tab
CHECKIN_FRESH_S = 60       # the side camera posts every 15 s while it records a session
LIVE_GAIT_S = 45           # live side-camera numbers older than this are not this moment's walk
WAIT_TIMEOUT_S = 5 * 60    # a review still waiting this long after the save will not come (the side camera stopped)
REVIEW_TIMEOUT_S = 3 * 60  # a review still running this long died with a server restart
SESSION_ID = re.compile(r"[0-9a-f]{8,40}")


class StartIn(BaseModel):
    player: str = "Player"


@router.post("/session/start")
def session_start(inp: StartIn) -> dict[str, Any]:
    active = {"id": uuid.uuid4().hex, "player": inp.player.strip()[:40] or "Player", "startedAt": time.time()}
    store.set_setting(ACTIVE_KEY, active)
    return active


def active_session() -> dict[str, Any] | None:
    s = store.setting(ACTIVE_KEY) or {}
    return s if s.get("id") and time.time() - float(s.get("startedAt") or 0) < ACTIVE_TTL_S else None


def side_camera_on(session_id: str) -> bool:
    c = store.setting(CHECKIN_KEY) or {}
    return c.get("sessionId") == session_id and time.time() - float(c.get("ts") or 0) < CHECKIN_FRESH_S


@router.get("/session/active")
def session_active() -> dict[str, Any]:
    active = active_session()
    return {**({k: active[k] for k in ("id", "player", "startedAt")} if active else {}), "serverTime": time.time()}


def settle_review(doc: dict[str, Any]) -> dict[str, Any]:
    """A review that can no longer finish reads as failed, with the reason, instead of waiting for ever."""
    review = doc.get("gaitReview")
    if isinstance(review, dict):
        age = time.time() - float(review.get("ts") or 0)
        if review.get("status") == "waiting" and age > WAIT_TIMEOUT_S:
            doc["gaitReview"] = {**review, "status": "failed", "reason": "the side camera did not send the walk"}
        elif review.get("status") == "reviewing" and age > REVIEW_TIMEOUT_S:
            doc["gaitReview"] = {**review, "status": "failed", "reason": "the review stopped (server restart)"}
    return doc


@router.get("/session/{session_id}")
def get_session(session_id: str) -> dict[str, Any]:
    doc = store.session(session_id) if SESSION_ID.fullmatch(session_id) else None
    if not doc:
        raise HTTPException(404, "no such session")
    return settle_review(doc)


def clean_json(value: Any, depth: int = 0) -> Any:
    """Like clean_gait, deep enough for a whole gait.py summary (per-side curves, per-window trends)."""
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, int):
        return value if abs(value) < 2**53 else None
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, str):
        return value[:200]
    if depth < 6 and isinstance(value, dict):
        return {str(k)[:40]: clean_json(v, depth + 1) for k, v in list(value.items())[:80]}
    if depth < 6 and isinstance(value, list):
        return [clean_json(v, depth + 1) for v in value[:300]]
    return None


def clean_summary(summary: Any) -> dict[str, Any] | None:
    """A gait.py summary for storage: strike times become counts (thousands in a long walk, never read again)."""
    if not isinstance(summary, dict):
        return None
    s = dict(summary)
    strikes = s.pop("strikes", None)
    s.pop("toe_offs", None)
    if isinstance(strikes, dict):
        s["strike_counts"] = {k: len(v) for k, v in strikes.items() if k in ("L", "R") and isinstance(v, list)}
    return clean_json(s)


class GaitFinalIn(BaseModel):
    sessionId: str
    source: str = "side-camera"
    quality: dict[str, Any] = Field(default_factory=dict)
    summary: dict[str, Any] | None = None   # None when the side camera saw too little; the game is still reviewed
    perAct: dict[str, Any] = Field(default_factory=dict)


@router.post("/gait/final", status_code=202)
async def gait_final(inp: GaitFinalIn, background: BackgroundTasks) -> dict[str, Any]:
    doc = await run_in_threadpool(store.session, inp.sessionId) if SESSION_ID.fullmatch(inp.sessionId) else None
    if not doc:
        raise HTTPException(404, "no such session: the game saves it at Home")
    gait = {"source": inp.source[:40], "quality": clean_json(inp.quality), "summary": clean_summary(inp.summary),
            "perAct": {a: clean_summary(v) for a, v in inp.perAct.items() if a in gait_review.ACTS and isinstance(v, dict)},
            "ts": time.time()}
    await run_in_threadpool(store.update_session, inp.sessionId, gait=gait,
                            gaitReview={"status": "reviewing", "ts": time.time()})
    background.add_task(review_later, inp.sessionId)
    return {"status": "reviewing"}


async def review_later(session_id: str) -> None:
    """The AI therapist's review, off the request path: it can take a model call of up to a minute."""
    doc = await run_in_threadpool(store.session, session_id)
    if not doc:
        return
    name = doc["player"]
    player = await run_in_threadpool(store.player, name)
    earlier = await run_in_threadpool(store.sessions, name, 20)
    history = [r for r in earlier if r.get("id") != session_id and (r.get("gaitReview") or {}).get("status") == "done"][:5]
    try:
        result = await gait_review.review(doc.get("summary") or {}, doc.get("gait") or {}, history, player)
    except Exception as e:  # noqa: BLE001 - a broken review must say so, never stay "reviewing"
        result = {"status": "failed", "reason": f"review error ({type(e).__name__})", "ts": time.time()}
    await run_in_threadpool(store.update_session, session_id, gaitReview=result)
    focus = ((result.get("review") or {}).get("focus") or {}).get("text")
    if focus and player.get("assistantId") and player.get("aiReviewConsent"):   # memory for the next greeting
        await therapist.backboard(f"Gait review of the latest walk: next focus '{focus}'. "
                                  f"{(result.get('review') or {}).get('therapistNote', '')[:400]}",
                                  player["assistantId"], "Auto")


# ---------------------------------------------------------------- shoe calibration (camera -> field homography)
# Saved by the camera window and read by every game window, so one calibration serves the whole setup and can be
# set from anywhere (for example by hand from a camera frame) without touching the browser.
class ShoeCalIn(BaseModel):
    h: list[float]                            # 8 homography numbers, normalised camera coordinates to field pixels
    points: list[list[float]] | None = None   # the four clicked corners, fractions of the picture
    picture: str = "feed"


@router.get("/shoecal")
def get_shoecal() -> dict[str, Any]:
    return store.setting("shoecal") or {}


@router.put("/shoecal")
def put_shoecal(inp: ShoeCalIn) -> dict[str, Any]:
    if len(inp.h) != 8 or not all(math.isfinite(v) for v in inp.h):
        raise HTTPException(422, "h must be 8 finite numbers")
    points = inp.points or []
    if points and (len(points) != 4 or any(len(p) != 2 or not all(math.isfinite(v) for v in p) for p in points)):
        raise HTTPException(422, "points must be four [x, y] pairs")
    value = {"h": inp.h, "points": points, "picture": inp.picture[:20], "ts": time.time()}
    store.set_setting("shoecal", value)
    return value


@router.get("/limits/{name}")
def limits(name: str) -> dict[str, Any]:
    return store.player(name)["limits"]


# ---------------------------------------------------------------- Perceptron second opinion
class PerceiveIn(BaseModel):
    player: str = "Player"
    kind: str                 # "step" or "form"
    foot: str | None = None   # for step: "L" or "R"
    thing: str | None = None  # for step: "flower" or "seed"
    frames: list[Any] = Field(max_length=perceive.MAX_FRAMES * 4)   # bad frames are skipped one by one


@router.post("/perceive")
async def perceive_frames(inp: PerceiveIn) -> dict[str, Any]:
    player = await run_in_threadpool(store.player, inp.player)
    if not player.get("perceptronConsent"):
        return {"source": "no-consent"}   # nothing leaves the laptop without consent
    frames = perceive.clean_frames(inp.frames)
    if inp.kind == "step" and inp.foot in {"L", "R"} and inp.thing in {"flower", "seed"}:
        return await perceive.check_step(frames, inp.foot, inp.thing)
    if inp.kind == "form":
        return await perceive.check_form(frames)
    return {"source": "bad-request"}


class PerceiveSessionIn(BaseModel):
    player: str = "Player"
    frames: list[Any] = Field(max_length=perceive.MAX_SESSION_FRAMES * 4)


@router.post("/perceive/session")
async def perceive_session(inp: PerceiveSessionIn) -> dict[str, Any]:
    player = await run_in_threadpool(store.player, inp.player)
    if not player.get("perceptronConsent"):
        return {"source": "no-consent"}
    frames = perceive.clean_frames(inp.frames, cap=perceive.MAX_SESSION_FRAMES)
    report = await perceive.session_report(frames)
    if report["source"] == "perceptron":
        latest = await run_in_threadpool(store.player, inp.player)
        await run_in_threadpool(store.update_player, inp.player,
                                perceptronReports=[report, *latest.get("perceptronReports", [])][:5])
    return report
