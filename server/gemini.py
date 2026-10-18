"""One Gemini call for the whole server: a JSON object back, or None with the reason. Every caller has a rule-based
fallback, so no key, no network or a bad reply never stops the game."""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import httpx

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def model_name(override_env: str | None = None) -> str:
    """The model for a caller: its own variable first (for example GEMINI_REVIEW_MODEL), then GEMINI_MODEL."""
    return (override_env and os.environ.get(override_env)) or os.environ.get("GEMINI_MODEL", "gemini-flash-latest")


def parse_json(text: str) -> dict[str, Any] | None:
    """The reply text as a JSON object; tolerates a ```json fence around it."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rsplit("```", 1)[0]
    try:
        out = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return None
    return out if isinstance(out, dict) else None


async def generate_json(system: str, user: str, *, schema: dict[str, Any] | None = None, model: str | None = None,
                        timeout: float = 4, temperature: float = 0.5) -> tuple[dict[str, Any] | None, str | None]:
    """(reply object, None) or (None, reason). With a schema the reply is constrained to it; a model or endpoint
    that rejects the schema (HTTP 400) is asked once more without it, and the caller's checks still apply."""
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None, "no GEMINI_API_KEY"
    model = model or model_name()
    config: dict[str, Any] = {"responseMimeType": "application/json", "temperature": temperature}
    body: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {**config, **({"responseSchema": schema} if schema else {})},
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            url = GEMINI_URL.format(model=model)
            r = await client.post(url, params={"key": key}, json=body)
            if r.status_code != 200 and schema:
                # A rejected (400) or overloaded (503) schema call is asked once more without the schema: the
                # callers check every field anyway, and a big nested schema is what the model trips on.
                if r.status_code >= 500:
                    await asyncio.sleep(1.5)
                body["generationConfig"] = config
                r = await client.post(url, params={"key": key}, json=body)
            if r.status_code >= 500:   # still overloaded: one more try after a pause
                await asyncio.sleep(2)
                r = await client.post(url, params={"key": key}, json=body)
            if r.status_code != 200:
                return None, f"Gemini HTTP {r.status_code}"
            parts = r.json()["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
    except httpx.TimeoutException:
        return None, "Gemini timed out"
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as e:
        return None, f"Gemini call failed ({type(e).__name__})"
    out = parse_json(text)
    return (out, None) if out is not None else (None, "Gemini reply was not a JSON object")


async def generate_text(system: str, parts: list[dict[str, Any]], *, model: str | None = None, timeout: float = 8,
                        temperature: float = 0.6) -> tuple[str | None, str | None]:
    """(plain-text reply, None) or (None, reason). `parts` are Gemini content parts: {"text": ...} or
    {"inlineData": {"mimeType": "image/jpeg", "data": <base64>}}, so a caller can show the model pictures."""
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None, "no GEMINI_API_KEY"
    body = {"systemInstruction": {"parts": [{"text": system}]}, "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {"temperature": temperature}}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(GEMINI_URL.format(model=model or model_name()), params={"key": key}, json=body)
            if r.status_code != 200:
                return None, f"Gemini HTTP {r.status_code}"
            reply = r.json()["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in reply if not p.get("thought")).strip()
    except httpx.TimeoutException:
        return None, "Gemini timed out"
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as e:
        return None, f"Gemini call failed ({type(e).__name__})"
    return (text, None) if text else (None, "Gemini reply was empty")
