"""HTTP API for the therapist panel and the game: players and limits, live coach, plan, sessions, rewards."""

from __future__ import annotations

import os
import time
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from server import therapist
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
    )


# ---------------------------------------------------------------- live coach and plan
class CoachIn(BaseModel):
    player: str = "Player"
    summary: dict[str, Any]


@router.post("/coach")
async def coach(inp: CoachIn) -> dict[str, Any]:
    limits = store.player(inp.player)["limits"]
    return await therapist.coach(inp.summary, limits)


@router.get("/plan/{name}")
async def plan(name: str) -> dict[str, Any]:
    player = store.player(name)
    return await therapist.plan(player, store.sessions(name, limit=5))


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
    player = store.player(name)
    assistant_id = await therapist.remember(player, summary)
    if assistant_id and assistant_id != player.get("assistantId"):
        store.update_player(name, assistantId=assistant_id)


@router.post("/session")
async def session(inp: SessionIn, background: BackgroundTasks) -> dict[str, Any]:
    name = inp.player.strip()[:40] or "Player"
    player = store.player(name)
    earlier = store.sessions(name, limit=5)
    note = await therapist.report(inp.summary, earlier)
    store.add_session(name, inp.summary, inp.verified, note["note"])
    background.add_task(remember_later, name, inp.summary)   # Backboard memory, off the response path
    out: dict[str, Any] = {"note": note["note"], "noteSource": note["source"], "reward": None, "receipt": None}
    long_enough = (inp.summary.get("seconds") or 0) >= 20   # the short judge demo is about 30 s
    if inp.verified and long_enough and inp.summary.get("act") == "home":
        reward = await therapist.pick_reward(inp.summary, player.get("rewards", []))
        if reward:
            out["reward"] = reward
            out["receipt"] = visa_checkout(reward, name)
    return out


@router.get("/sessions/{name}")
def sessions(name: str) -> list[dict[str, Any]]:
    return store.sessions(name, limit=30)
