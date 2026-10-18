"""The game's state to the dashboard, and the dashboard's commands to the game, both through the server."""

import time
from collections import deque

import pytest
from fastapi.testclient import TestClient

from server import app as app_module
from server.app import app, clean_event

client = TestClient(app)

STATE = {"kind": "gamestate", "scene": "play", "act": "garden", "round": 2, "rounds": 3, "paused": False, "score": 120,
         "stompPct": 83.3, "t": 41.5, "sessionId": "abc123def456", "voice": True, "speed": 0.7}


@pytest.fixture(autouse=True)
def fresh_game(monkeypatch):
    monkeypatch.setattr(app_module, "game_state", {"state": None, "ts": 0.0})
    monkeypatch.setattr(app_module, "control_times", deque(maxlen=app_module.CONTROL_PER_S))


def test_gamestate_is_validated_stored_and_broadcast():
    assert client.get("/api/game/state").json() == {"state": None, "ageS": None, "connected": False}
    with client.websocket_connect("/ws/game") as game:
        r = client.post("/api/events", json={"events": [{**STATE, "extra": "dropped"}]})
        assert r.json() == {"accepted": 1, "listeners": 1}
        assert game.receive_json() == [STATE]
    s = client.get("/api/game/state").json()
    assert s["state"] == STATE and s["connected"] is True and 0 <= s["ageS"] < 2
    later = app_module.game_status(now=time.time() + 10)
    assert later["connected"] is False and 9 < later["ageS"] < 12 and later["state"] == STATE


def test_only_the_newest_state_of_a_batch_is_kept_and_relayed():
    with client.websocket_connect("/ws/game") as game:
        client.post("/api/events", json={"events": [{**STATE, "scene": "intro"}, {**STATE, "scene": "home"}]})
        got = game.receive_json()
    assert [e["scene"] for e in got] == ["home"]
    assert client.get("/api/game/state").json()["state"]["scene"] == "home"


def test_gamestate_fields_are_checked():
    assert clean_event({"kind": "gamestate", "scene": "menu"}) is None
    assert clean_event({"kind": "gamestate"}) is None
    loose = clean_event({"kind": "gamestate", "scene": "title", "act": "fly", "round": "2", "rounds": 2.0, "paused": "yes",
                         "score": "9", "stompPct": 150, "t": -5, "sessionId": "../x", "voice": 1, "speed": "fast"})
    assert loose == {"kind": "gamestate", "scene": "title", "act": None, "round": None, "rounds": 2, "paused": False, "score": 0,
                     "stompPct": 100.0, "t": 0.0, "sessionId": None, "voice": False, "speed": None}
    odd = clean_event({"kind": "gamestate", "scene": "ready", "round": True, "rounds": float("nan"), "score": float("inf"),
                       "stompPct": float("nan"), "t": 1e9, "sessionId": 12, "speed": 99})
    assert odd["round"] is None and odd["rounds"] is None and odd["score"] == 0 and odd["stompPct"] is None
    assert odd["t"] == 86_400.0 and odd["sessionId"] is None and odd["speed"] == 5.0
    assert client.post("/api/events", json={"events": [{"kind": "gamestate", "scene": "nowhere"}]}).json()["accepted"] == 0
    assert client.get("/api/game/state").json()["state"] is None


def test_control_is_broadcast_and_answered_with_the_game_connection():
    with client.websocket_connect("/ws/game") as game:
        r = client.post("/api/game/control", json={"cmd": "start"})
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True and body["gameConnected"] is False and len(body["id"]) == 8
        got = game.receive_json()
        assert got == [{"kind": "control", "cmd": "start", "id": body["id"], "t": got[0]["t"]}] and got[0]["t"] > 1e9
    client.post("/api/events", json={"events": [STATE]})
    answer = client.post("/api/game/control", json={"cmd": "pause"}).json()
    assert answer["ok"] is True and answer["gameConnected"] is True
    assert client.post("/api/game/control", json={"cmd": "pause"}).json()["id"] != answer["id"]


def test_unknown_control_is_rejected():
    assert client.post("/api/game/control", json={"cmd": "explode"}).status_code == 422
    assert client.post("/api/game/control", json={"cmd": "START"}).status_code == 422
    assert client.post("/api/game/control", json={"cmd": ""}).status_code == 422
    assert client.post("/api/game/control", json={"cmd": "x" * 50}).status_code == 422
    assert client.post("/api/game/control", json={}).status_code == 422
    with client.websocket_connect("/ws/game") as game:   # nothing was relayed for the bad ones
        client.post("/api/game/control", json={"cmd": "voice"})
        assert game.receive_json()[0]["cmd"] == "voice"


def test_control_is_rate_limited_and_its_body_capped():
    codes = [client.post("/api/game/control", json={"cmd": "voice"}).status_code for _ in range(7)]
    assert codes == [200] * 5 + [429, 429]
    app_module.control_times.clear()
    big = b'{"cmd": "' + b"a" * 300 + b'"}'
    assert client.post("/api/game/control", content=big, headers={"content-type": "application/json"}).status_code == 413
    assert client.post("/api/game/control", json={"cmd": "end"}).status_code == 200


def test_a_control_event_cannot_be_injected_through_the_relay():
    assert clean_event({"kind": "control", "cmd": "end", "id": "fake", "t": 1}) is None
    with client.websocket_connect("/ws/game"):
        assert client.post("/api/events", json={"events": [{"kind": "control", "cmd": "end"}]}).json()["accepted"] == 0
