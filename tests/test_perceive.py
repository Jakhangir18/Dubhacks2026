"""Perceptron second opinion: consent gate, frame cleaning, request shape, fallbacks. No network."""

import json

from fastapi.testclient import TestClient

from server import perceive
from server.app import app

client = TestClient(app)
JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD"


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
    assert "left knee" in seen["question"] and "flower" in seen["question"]
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


def test_bad_timestamps_are_skipped_not_fatal():
    bad = [{"tsMs": float("inf"), "url": JPEG}, {"tsMs": "x", "url": JPEG}, {"tsMs": 5, "url": JPEG}]
    assert [f["timestamp_ms"] for f in perceive.clean_frames(bad)] == [5]


def test_call_budget_per_minute():
    assert all(perceive.allow_call(now=100.0) for _ in range(perceive.CALLS_PER_MINUTE))
    assert not perceive.allow_call(now=100.5)
    assert perceive.allow_call(now=161.0)   # a minute later the budget is back


def test_oversized_frame_list_is_rejected():
    client.put("/api/player/Mia", json={"perceptronConsent": True})
    r = client.post("/api/perceive", json={"player": "Mia", "kind": "form", "frames": frames(perceive.MAX_FRAMES * 4 + 1)})
    assert r.status_code == 422
