"""Every test runs offline: no API keys, a fresh store file and moments folder, an empty Perceptron call budget."""

import pytest

from server import api, moments, perceive
from server.store import Store


@pytest.fixture(autouse=True)
def offline(monkeypatch, tmp_path):
    for key in ("GEMINI_API_KEY", "BACKBOARD_API_KEY", "MONGODB_URI", "PERCEPTRON_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    fresh = Store()
    fresh.file = tmp_path / "store.json"
    monkeypatch.setattr(api, "store", fresh)
    monkeypatch.setattr(moments, "DIR", tmp_path / "moments")
    perceive._calls.clear()
    return fresh
