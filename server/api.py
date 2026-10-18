"""HTTP API for the therapist panel and the game: players and limits, live coach, plan, sessions, rewards."""

from __future__ import annotations

import os
import time
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from server import perceive, therapist
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
    }


# ---------------------------------------------------------------- players and therapist limits
@router.get("/players")
def players() -> list[str]:
    return store.players()


@router.get("/player/{name}")
def get_player(name: str) -> dict[str, Any]:
    return store.player(name)


class PlayerIn(BaseModel):
    limits: dict[str, Any] | None = None
    rewards: list[dict[str, Any]] | None = None
    notes: str | None = None
    perceptronConsent: bool | None = None   # the parent or therapist allows leg-only frames to go to Perceptron


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
    )


# ---------------------------------------------------------------- live coach and plan
class CoachIn(BaseModel):
    player: str = "Player"
    summary: dict[str, Any]


@router.post("/coach")
async def coach(inp: CoachIn) -> dict[str, Any]:
    # Store calls run in the threadpool so a slow database never stalls the foot-event relay.
    player = await run_in_threadpool(store.player, inp.player)
    return await therapist.coach(inp.summary, player["limits"])


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
    note = await therapist.report(inp.summary, earlier)
    out: dict[str, Any] = {"note": note["note"], "noteSource": note["source"], "reward": None, "receipt": None}
    long_enough = (inp.summary.get("seconds") or 0) >= 20   # the short judge demo is about 30 s
    eligible = inp.verified and long_enough and inp.summary.get("act") == "home" and rewards_today(earlier) < REWARDS_PER_DAY
    if eligible:
        reward = await therapist.pick_reward(inp.summary, player.get("rewards", []))
        if reward:
            out["reward"] = reward
    # Save first, so a finished walk is never lost if the checkout fails.
    await run_in_threadpool(store.add_session, name, inp.summary, inp.verified, note["note"], out["reward"] is not None)
    if out["reward"]:
        try:
            out["receipt"] = visa_checkout(out["reward"], name)
        except Exception:  # noqa: BLE001 - a payment error must not lose the session
            out["receipt"] = {"network": "Visa", "status": "checkout failed, try again from the panel"}
    background.add_task(remember_later, name, inp.summary)   # Backboard memory, off the response path
    return out


@router.get("/sessions/{name}")
def sessions(name: str) -> list[dict[str, Any]]:
    return store.sessions(name, limit=30)


@router.get("/limits/{name}")
def limits(name: str) -> dict[str, Any]:
    return store.player(name)["limits"]


# ---------------------------------------------------------------- Perceptron second opinion
class PerceiveIn(BaseModel):
    player: str = "Player"
    kind: str                 # "step" or "form"
    foot: str | None = None   # for step: "L" or "R"
    thing: str | None = None  # for step: "flower" or "seed"
    frames: list[dict[str, Any]] = Field(max_length=perceive.MAX_FRAMES * 4)


@router.post("/perceive")
async def perceive_frames(inp: PerceiveIn) -> dict[str, Any]:
    player = await run_in_threadpool(store.player, inp.player)
    if not player.get("perceptronConsent"):
        return {"source": "no-consent"}   # nothing leaves the laptop without consent
    if not perceive.allow_call():
        return {"source": "busy"}   # caps spend on the paid API from any client on the network
    frames = perceive.clean_frames(inp.frames)
    if inp.kind == "step" and inp.foot in {"L", "R"} and inp.thing in {"flower", "seed"}:
        return await perceive.check_step(frames, inp.foot, inp.thing)
    if inp.kind == "form":
        return await perceive.check_form(frames)
    return {"source": "bad-request"}
