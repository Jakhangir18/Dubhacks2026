"""Perceptron second opinion: consent gate, frame cleaning, request shape, fallbacks. No network."""

import json

import pytest
from fastapi.testclient import TestClient

from server import api, perceive
from server.app import app
from server.store import Store

client = TestClient(app)
JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD"


@pytest.fixture(autouse=True)
def offline(monkeypatch, tmp_path):
    for key in ("GEMINI_API_KEY", "BACKBOARD_API_KEY", "MONGODB_URI", "PERCEPTRON_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    fresh = Store()
    fresh.file = tmp_path / "store.json"
    monkeypatch.setattr(api, "store", fresh)


def frames(n=3):
    return [{"tsMs": i * 200, "url": JPEG} for i in range(n)]


def test_nothing_is_sent_without_consent(monkeypatch):
    called = []

    async def spy(*a, **k):
        called.append(1)
        return {"verdict": "yes"}
    monkeypatch.setattr(perceive, "ask", spy)
    r = client.post("/api/perceive", json={"player": "Mia", "kind": "step", "foot": "L", "thing": "flower", "frames": frames()})
    assert r.json() == {"source": "no-consent"}
    assert called == []


def test_step_check_with_consent(monkeypatch):
    client.put("/api/player/Mia", json={"perceptronConsent": True})
    seen = {}

    async def fake(fr, question, schema, timeout=12):
        seen.update(frames=fr, question=question, schema=schema)
        return {"verdict": "yes", "footVisible": True, "note": "left foot lands on the flower"}
    monkeypatch.setattr(perceive, "ask", fake)
    r = client.post("/api/perceive", json={"player": "Mia", "kind": "step", "foot": "L", "thing": "flower", "frames": frames()})
    assert r.json()["verdict"] == "yes" and r.json()["source"] == "perceptron"
    assert "left foot" in seen["question"]
    assert seen["frames"][0] == {"image_url": {"url": JPEG}, "timestamp_ms": 0}


def test_frames_are_cleaned():
    bad = [{"tsMs": 0, "url": JPEG}, {"tsMs": 0, "url": JPEG}, {"tsMs": 5, "url": "http://x/y.jpg"},
           {"tsMs": "x", "url": JPEG}, {"tsMs": 10, "url": JPEG}] + frames(20)
    out = perceive.clean_frames(bad)
    assert [f["timestamp_ms"] for f in out] == [0, 10, 200, 400, 600, 800, 1000, 1200]


def test_no_key_falls_back_quietly():
    client.put("/api/player/Mia", json={"perceptronConsent": True})
    r = client.post("/api/perceive", json={"player": "Mia", "kind": "form", "frames": frames()})
    assert r.json() == {"source": "off"}


async def test_request_body_shape(monkeypatch):
    monkeypatch.setenv("PERCEPTRON_API_KEY", "k")
    sent = {}

    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": json.dumps({"onPad": "yes", "holdingRail": "no", "steady": "yes", "note": "ok"})}}]}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def post(self, url, headers, json):
            sent.update(url=url, headers=headers, body=json)
            return FakeResp()
    monkeypatch.setattr(perceive.httpx, "AsyncClient", FakeClient)
    out = await perceive.check_form(perceive.clean_frames(frames()))
    assert out["onPad"] == "yes" and out["source"] == "perceptron"
    part = sent["body"]["messages"][0]["content"][0]
    assert part["type"] == "video_frames" and len(part["video_frames"]["frames"]) == 3
    assert sent["body"]["response_format"]["type"] == "json_schema"
    assert sent["headers"]["Authorization"] == "Bearer k"
