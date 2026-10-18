"""The coach's voice: Gemini text-to-speech, cached on disk. The game falls back to the browser's own voice when this
answers nothing in time.

Lines are spoken at the start, between rounds and at Home, so a second's round trip is fine. Every line is cached by its
text, voice, style and model, so a story line is synthesised once and the free tier lasts; a rate-limited key rests for
a minute instead of failing every line. The player's name is taken out of anything sent ("Welcome back Mia!" is spoken
as "Welcome back!"), and api.py sends lines about a player's walk only with that player's AI consent.

Environment: GEMINI_API_KEY; GEMINI_TTS_MODEL (default gemini-3.8-flash-tts), GEMINI_TTS_VOICE (default Sulafat, warm),
GEMINI_TTS_STYLE (how the coach sounds), GEMINI_TTS_FALLBACK_MODEL (the generateContent model tried when the
Interactions endpoint is not there, default gemini-2.5-flash-preview-tts).
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import os
import re
import struct
import time
from pathlib import Path
from typing import Any

import httpx

BASE = "https://generativelanguage.googleapis.com/v1beta"
CACHE = Path(__file__).resolve().parent.parent / "data" / "tts"
MAX_CHARS = 400             # a coach line is a sentence or two
RATE = 24000                # Gemini TTS: 24 kHz, mono, 16-bit PCM
COOLDOWN_S = 60             # after a 429 the key rests this long; the game speaks with the browser voice meanwhile
STYLE = ("Warm, upbeat and encouraging, like a friendly coach cheering on a child who is walking. "
         "Clear and unhurried, with a smile in the voice.")

_lock = asyncio.Lock()      # one call at a time: the free tier counts requests per minute
_resting_until = 0.0


def settings() -> tuple[str, str, str]:
    return (os.environ.get("GEMINI_TTS_MODEL") or "gemini-3.8-flash-tts", os.environ.get("GEMINI_TTS_VOICE") or "Sulafat",
            os.environ.get("GEMINI_TTS_STYLE") or STYLE)


def available() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY"))


def strip_name(text: str, name: str | None) -> str:
    """The line without the player's name: "Welcome back Mia! ..." -> "Welcome back! ...", "Mia, step on it" -> "Step on it"."""
    if not name or not name.strip():
        return text
    out = re.sub(rf"[ ,]*\b{re.escape(name.strip())}\b[ ,]*(?=[!?.,;:]|$)", "", text, flags=re.IGNORECASE)   # "back Mia!" -> "back!"
    out = re.sub(rf"\b{re.escape(name.strip())}\b[ ,]*", "", out, flags=re.IGNORECASE)                       # "Mia, step" -> "step"
    out = re.sub(r"\s{2,}", " ", out).strip().lstrip(",;: ")
    return out[:1].upper() + out[1:] if out else out


def cache_path(text: str, model: str, voice: str, style: str) -> Path:
    return CACHE / f"{hashlib.sha256(f'{model}|{voice}|{style}|{text}'.encode()).hexdigest()[:32]}.wav"


def pcm_to_wav(pcm: bytes, rate: int = RATE) -> bytes:
    """Headerless 16-bit mono PCM into a playable WAV."""
    header = b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVE" + b"fmt " + \
        struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16) + b"data" + struct.pack("<I", len(pcm))
    return header + pcm


def as_wav(data: bytes) -> bytes:
    return data if data[:4] == b"RIFF" else pcm_to_wav(data)


def from_interaction(reply: Any) -> bytes | None:
    """The last audio block of an Interactions reply: steps[type=model_output].content[type=audio].data (base64)."""
    blocks = [c for s in (reply or {}).get("steps") or [] if isinstance(s, dict) and s.get("type") == "model_output"
              for c in s.get("content") or [] if isinstance(c, dict) and c.get("type") == "audio" and c.get("data")]
    return base64.b64decode(blocks[-1]["data"]) if blocks else None


def from_generate(reply: Any) -> bytes | None:
    """generateContent's audio: candidates[0].content.parts[].inlineData.data (base64 PCM)."""
    try:
        parts = reply["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError):
        return None
    for p in parts:
        data = (p.get("inlineData") or p.get("inline_data") or {}).get("data") if isinstance(p, dict) else None
        if data:
            return base64.b64decode(data)
    return None


async def _call(client: httpx.AsyncClient, key: str, text: str, model: str, voice: str, style: str) -> tuple[bytes | None, str | None, int]:
    """(audio, reason, last HTTP status). The documented Interactions endpoint first; generateContent if it is missing."""
    headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
    body = {
        "model": model,
        "input": [{"type": "user_input", "content": [{"type": "text", "text": text,
                                                       "annotations": [{"type": "speech_metadata", "style": style}]}]}],
        "response_format": {"type": "audio"},
        "generation_config": {"speech_config": [{"voice": voice}]},
    }
    r = await client.post(f"{BASE}/interactions", headers=headers, json=body)
    if r.status_code == 200:
        audio = from_interaction(r.json())
        return (audio, None, 200) if audio else (None, "Gemini TTS reply had no audio", 200)
    if r.status_code not in (400, 404):
        return None, f"Gemini TTS HTTP {r.status_code}", r.status_code
    fallback = os.environ.get("GEMINI_TTS_FALLBACK_MODEL") or "gemini-2.5-flash-preview-tts"
    r = await client.post(f"{BASE}/models/{fallback}:generateContent", headers=headers, json={
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {"responseModalities": ["AUDIO"],
                             "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}},
    })
    if r.status_code != 200:
        return None, f"Gemini TTS HTTP {r.status_code}", r.status_code
    audio = from_generate(r.json())
    return (audio, None, 200) if audio else (None, "Gemini TTS reply had no audio", 200)


async def synthesize(text: str, timeout: float = 20) -> tuple[bytes | None, str | None]:
    """(WAV bytes, None) or (None, reason). Cached lines never call the API."""
    global _resting_until
    model, voice, style = settings()
    path = cache_path(text, model, voice, style)
    if path.is_file():
        return path.read_bytes(), None
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None, "no GEMINI_API_KEY"
    async with _lock:
        if path.is_file():   # another request made it while this one waited
            return path.read_bytes(), None
        if time.time() < _resting_until:
            return None, "Gemini TTS is rate limited; resting"
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                audio, reason, status = await _call(client, key, text, model, voice, style)
        except httpx.TimeoutException:
            return None, "Gemini TTS timed out"
        except (httpx.HTTPError, ValueError, TypeError) as e:
            return None, f"Gemini TTS failed ({type(e).__name__})"
        if status == 429:
            _resting_until = time.time() + COOLDOWN_S
        if audio is None:
            return None, reason
        wav = as_wav(audio)
        CACHE.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(wav)
        os.replace(tmp, path)
        return wav, None
