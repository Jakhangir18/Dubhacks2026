"""The coach's voice (server/tts.py, POST /api/tts). Gemini is replaced by a fake client: no key is used or needed."""

import base64
import json

import pytest
from fastapi.testclient import TestClient

from server import tts
from server.app import app

client = TestClient(app)
PCM = b"\x01\x00\x02\x00" * 50
WAV = tts.pcm_to_wav(PCM)


class Resp:
    def __init__(self, status, body):
        self.status_code, self._body = status, body

    def json(self):
        return self._body


def fake_client(replies, sent):
    """An httpx.AsyncClient stand-in answering each POST with the next reply."""
    class Fake:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def post(self, url, headers, json):
            sent.append({"url": url, "body": json, "headers": headers})
            return replies.pop(0)
    return Fake


@pytest.fixture(autouse=True)
def fresh(monkeypatch, tmp_path):
    monkeypatch.setattr(tts, "CACHE", tmp_path / "tts")
    monkeypatch.setattr(tts, "_resting_until", 0.0)
    for k in ("GEMINI_TTS_MODEL", "GEMINI_TTS_VOICE", "GEMINI_TTS_STYLE", "GEMINI_TTS_FALLBACK_MODEL"):
        monkeypatch.delenv(k, raising=False)


def interaction(audio: bytes):
    return {"steps": [{"type": "user_input"}, {"type": "model_output", "content": [
        {"type": "text", "text": "x"}, {"type": "audio", "data": base64.b64encode(audio).decode()}]}]}


def test_names_never_go_out():
    assert tts.strip_name("Welcome back Mia! Last time you walked 108 steps.", "Mia") == "Welcome back! Last time you walked 108 steps."
    assert tts.strip_name("Hi mia! Let us walk home together.", "Mia") == "Hi! Let us walk home together."
    assert tts.strip_name("Mia, step onto the flower", "Mia") == "Step onto the flower"
    assert tts.strip_name("Great job, Mia, keep going", "Mia") == "Great job, keep going"
    assert tts.strip_name("Miami is far", "Mia") == "Miami is far"           # whole words only
    assert tts.strip_name("Nice round", None) == "Nice round"


def test_wav_header_and_reply_shapes():
    assert WAV[:4] == b"RIFF" and WAV[8:12] == b"WAVE" and len(WAV) == 44 + len(PCM)
    assert tts.as_wav(WAV) is WAV and tts.as_wav(PCM)[:4] == b"RIFF"
    assert tts.from_interaction(interaction(WAV)) == WAV
    assert tts.from_interaction({"steps": []}) is None
    generate = {"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "audio/L16;rate=24000", "data": base64.b64encode(PCM).decode()}}]}}]}
    assert tts.from_generate(generate) == PCM
    assert tts.from_generate({"candidates": []}) is None


async def test_a_line_is_made_once_then_comes_from_the_cache(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    sent = []
    monkeypatch.setattr(tts.httpx, "AsyncClient", fake_client([Resp(200, interaction(WAV))], sent))
    audio, reason = await tts.synthesize("Grandma Rosa's flowers fight back.")
    assert audio == WAV and reason is None
    body = sent[0]["body"]
    assert sent[0]["url"].endswith("/v1beta/interactions") and sent[0]["headers"]["x-goog-api-key"] == "k"
    assert body["model"] == "gemini-3.8-flash-tts" and body["generation_config"]["speech_config"] == [{"voice": "Sulafat"}]
    assert body["input"][0]["content"][0]["annotations"][0]["type"] == "speech_metadata"
    again, _ = await tts.synthesize("Grandma Rosa's flowers fight back.")   # no second call: the fake has no reply left
    assert again == WAV and len(sent) == 1


async def test_without_the_interactions_endpoint_generate_content_answers(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    sent = []
    pcm_reply = {"candidates": [{"content": {"parts": [{"inlineData": {"data": base64.b64encode(PCM).decode()}}]}}]}
    monkeypatch.setattr(tts.httpx, "AsyncClient", fake_client([Resp(404, {}), Resp(200, pcm_reply)], sent))
    audio, _ = await tts.synthesize("Round two!")
    assert audio == WAV                                                      # raw PCM wrapped as WAV
    assert sent[1]["url"].endswith("/models/gemini-2.5-flash-preview-tts:generateContent")
    assert sent[1]["body"]["generationConfig"]["responseModalities"] == ["AUDIO"]


async def test_a_rate_limited_key_rests_instead_of_failing_every_line(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    sent = []
    monkeypatch.setattr(tts.httpx, "AsyncClient", fake_client([Resp(429, {})], sent))
    assert (await tts.synthesize("One"))[1] == "Gemini TTS HTTP 429"
    assert (await tts.synthesize("Two"))[1].startswith("Gemini TTS is rate limited") and len(sent) == 1


async def test_no_key_no_call():
    assert await tts.synthesize("Hello") == (None, "no GEMINI_API_KEY")


def test_endpoint_story_lines_personal_lines_and_consent(monkeypatch):
    said = []

    async def fake(text, timeout=20):
        said.append(text)
        return WAV, None
    monkeypatch.setattr(tts, "synthesize", fake)
    r = client.post("/api/tts", json={"text": "Gus needs bed before sunrise."})            # a story line: nothing personal
    assert r.status_code == 200 and r.headers["content-type"] == "audio/wav" and r.content == WAV
    assert client.post("/api/tts", json={"text": "Welcome back Mia!", "player": "Mia"}).status_code == 403   # no consent yet
    client.put("/api/player/Mia", json={"aiReviewConsent": True})
    assert client.post("/api/tts", json={"text": "Welcome back Mia! Today: land on the heel.", "player": "Mia"}).status_code == 200
    assert said[-1] == "Welcome back! Today: land on the heel."                            # the name stayed home
    assert client.post("/api/tts", json={"text": "Mia", "player": "Mia"}).status_code == 422   # nothing left to say


def test_endpoint_says_why_when_there_is_no_audio():
    r = client.post("/api/tts", json={"text": "Hello"})
    assert r.status_code == 503 and json.loads(r.text)["detail"] == "no GEMINI_API_KEY"
