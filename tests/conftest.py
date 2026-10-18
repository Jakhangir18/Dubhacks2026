"""Every test runs offline: no API keys, a fresh store file, an empty Perceptron call budget."""

import pytest

from server import api, perceive
from server.store import Store


@pytest.fixture(autouse=True)
def offline(monkeypatch, tmp_path):
    for key in ("GEMINI_API_KEY", "BACKBOARD_API_KEY", "MONGODB_URI", "PERCEPTRON_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    fresh = Store()
    fresh.file = tmp_path / "store.json"
    monkeypatch.setattr(api, "store", fresh)
    perceive._calls.clear()
    return fresh
