"""Maya's chat: grounded in the walk and its pictures, with the model mocked."""

from fastapi.testclient import TestClient

from server import gemini, maya, moments
from server.app import app

client = TestClient(app)
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 40
SUMMARY = {"seconds": 68, "steps": 95, "cadence": 85, "stompPct": 94, "asymmetryPct": 9, "act": "home"}


def walk(offline, consent=True):
    offline.update_player("Kid", aiReviewConsent=consent)
    doc = offline.add_session("Kid", SUMMARY, True, "nice", False, "abc123def456abcd")
    return doc["id"]


def test_reply_with_photos(offline, monkeypatch):
    sid = walk(offline)
    moments.save(sid, "knee_low", "L", 31, 45, 12.5, JPEG)
    moments.save(sid, "good", "R", 52, 45, 20.0, JPEG)
    seen = {}

    async def fake(system, parts, **kw):
        seen["images"] = [p for p in parts if "inlineData" in p]
        seen["text"] = " ".join(p.get("text", "") for p in parts)
        return "I see your left knee at 31°, the dashed line is 45°: lift it like a curb next time.", None

    monkeypatch.setattr(gemini, "generate_text", fake)
    r = client.post("/api/maya", json={"player": "Kid", "sessionId": sid, "message": "Look at my photos", "history": [{"role": "user", "text": "hi"}]})
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "gemini" and body["usedPhotos"] == 2 and "31°" in body["reply"] and len(body["photos"]) == 2
    assert len(seen["images"]) == 2 and seen["images"][0]["inlineData"]["mimeType"] == "image/jpeg"
    assert "flowers stepped on %: 94" in seen["text"] and "Left knee stayed low" in seen["text"] and "Earlier in this chat" in seen["text"]


def test_rules_fallback_when_the_model_fails(offline, monkeypatch):
    sid = walk(offline)
    moments.save(sid, "knee_low", "L", 31, 45, 12.5, JPEG)

    async def down(system, parts, **kw):
        return None, "Gemini timed out"

    monkeypatch.setattr(gemini, "generate_text", down)
    body = client.post("/api/maya", json={"player": "Kid", "message": "How did my knees do?"}).json()
    assert body["source"] == "rules" and body["usedPhotos"] == 1 and "left knee stayed low" in body["reply"].lower()
    assert body["sessionId"] == sid   # the latest walk without a sessionId


def test_no_photos_without_moments_or_consent(offline, monkeypatch):
    sid = walk(offline, consent=False)
    moments.save(sid, "good", "R", 52, 45, 20.0, JPEG)
    calls = []

    async def fake(system, parts, **kw):
        calls.append(parts)
        return "ok", None

    monkeypatch.setattr(gemini, "generate_text", fake)
    body = client.post("/api/maya", json={"player": "Kid", "sessionId": sid, "message": "Look at my photos"}).json()
    assert body["usedPhotos"] == 0 and body["source"] == "rules" and calls == []   # no consent: no pictures, no model
    offline.update_player("Kid", aiReviewConsent=True)
    other = offline.add_session("Kid", SUMMARY, True, "", False, "ffffffffffffffff")["id"]
    body = client.post("/api/maya", json={"player": "Kid", "sessionId": other, "message": "Look at my photos"}).json()
    assert body["usedPhotos"] == 0 and body["source"] == "gemini" and not any("inlineData" in p for p in calls[-1])


def test_message_length_is_capped(offline):
    assert client.post("/api/maya", json={"player": "Kid", "message": "x" * 501}).status_code == 422
    assert client.post("/api/maya", json={"player": "Kid", "message": ""}).status_code == 422
    assert client.post("/api/maya", json={"player": "Kid", "message": "hello", "history": [{"role": "user", "text": "a"}] * 9}).status_code == 422
    body = client.post("/api/maya", json={"player": "Nobody", "message": "hello"}).json()
    assert body["source"] == "rules" and "Finish a walk" in body["reply"] and body["usedPhotos"] == 0


def test_facts_and_rules_without_a_review():
    assert maya.facts(None) == "No walk is on record yet."
    text = maya.rules_reply("pain", {"summary": SUMMARY}, [])
    assert "stop" in text.lower()
