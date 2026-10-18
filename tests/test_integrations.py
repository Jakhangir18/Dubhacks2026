"""Live-integration plumbing without the network: the health check, Backboard's call order, the Atlas import and the
public clip address. Remote services are replaced by fakes."""

import json

import httpx
from fastapi.testclient import TestClient

from server import api, therapist
from server.app import app
from server.store import Store

client = TestClient(app)


def test_health_without_keys_names_every_missing_key():
    h = client.get("/api/health").json()
    assert {k: v["ok"] for k, v in h.items()} == {"gemini": False, "mongodb": False, "backboard": False, "perceptron": False}
    assert h["gemini"]["detail"] == "no GEMINI_API_KEY" and h["mongodb"]["detail"] == "no MONGODB_URI"
    assert client.get("/api/status").json()["gemini"] is False   # the game's fast check is unchanged


def fake_backboard(monkeypatch, calls):
    def handler(request):
        calls.append((request.method, request.url.path, json.loads(request.content or b"{}")))
        path = request.url.path
        if path.endswith("/api/assistants") and request.method == "POST":
            return httpx.Response(200, json={"assistant_id": "a-new"})
        if path.endswith("/threads"):
            return httpx.Response(200, json={"thread_id": "t1"})
        if path.endswith("/threads/t1/messages"):
            return httpx.Response(200, json={"content": "Hi again!", "thread_id": "t1"})
        if path.endswith("/api/assistants"):
            return httpx.Response(200, json=[])
        return httpx.Response(404)

    real = httpx.AsyncClient
    monkeypatch.setattr(therapist.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    monkeypatch.setenv("BACKBOARD_API_KEY", "k")


async def test_backboard_creates_the_assistant_once_then_threads_into_it(monkeypatch):
    calls = []
    fake_backboard(monkeypatch, calls)
    assert await therapist.backboard("session 1", None, "Auto") == ("Hi again!", "a-new")
    assert [(m, p.removeprefix("/api")) for m, p, _ in calls] == [
        ("POST", "/assistants"), ("POST", "/assistants/a-new/threads"), ("POST", "/threads/t1/messages")]
    assert calls[-1][2] == {"content": "session 1", "memory": "Auto", "stream": False}
    calls.clear()
    assert await therapist.backboard("hello", "a-old", "Readonly") == ("Hi again!", "a-old")   # no new assistant
    assert calls[0][1].endswith("/assistants/a-old/threads")
    assert await therapist.backboard_ping() is None


async def test_backboard_failure_is_none_not_an_error(monkeypatch):
    monkeypatch.setenv("BACKBOARD_API_KEY", "k")
    monkeypatch.setattr(therapist, "BACKBOARD_URL", "http://127.0.0.1:9")   # nothing listens there
    assert await therapist.backboard("x", None, "Auto", timeout=1) is None
    assert (await therapist.backboard_ping(timeout=1)).startswith("Backboard call failed")


class FakeColl:
    """Just enough of a pymongo collection for import_file."""
    def __init__(self):
        self.docs = []

    def update_one(self, flt, update, upsert=False):
        doc = next((d for d in self.docs if all(d.get(k) == v for k, v in flt.items())), None)
        if doc is None:
            self.docs.append({**flt, **update.get("$setOnInsert", {}), **update.get("$set", {})})
        else:
            doc.update(update.get("$set", {}))
        return type("R", (), {"upserted_id": None if doc else 1})()


def test_import_file_copies_once_and_keeps_what_atlas_has(tmp_path):
    store = Store()
    store.mongo = type("DB", (), {"players": FakeColl(), "sessions": FakeColl(), "settings": FakeColl()})()
    store.mongo.players.docs.append({"name": "Alex", "notes": "newer, in Atlas"})
    path = tmp_path / "store.json"
    path.write_text(json.dumps({"players": {"Alex": {"notes": "old"}, "Sam": {"notes": "file"}},
                                "sessions": [{"id": "s1", "player": "Sam"}, {"id": "s2", "player": "Alex"}],
                                "settings": {"shoecal": {"h": [1] * 8}}}))
    assert store.import_file(path) == {"players": 2, "sessions": 2}
    assert store.import_file(path) == {"players": 2, "sessions": 0}   # running it twice adds nothing
    assert [d["notes"] for d in store.mongo.players.docs] == ["newer, in Atlas", "file"]
    assert len(store.mongo.sessions.docs) == 2 and store.mongo.settings.docs[0]["key"] == "shoecal"


def test_public_url_wins_for_clip_links(monkeypatch, tmp_path):
    from server import app as server
    monkeypatch.setattr(server, "CLIPS", tmp_path)
    monkeypatch.setenv("PUBLIC_URL", "https://walk.example.ts.net/")
    url = TestClient(server.app).post("/api/clip", content=b"\x1a\x45\xdf\xa3webm", headers={"content-type": "video/webm"}).json()["url"]
    assert url.startswith("https://walk.example.ts.net/clips/")


def test_health_reports_a_working_store(monkeypatch):
    monkeypatch.setattr(api.store, "ping", lambda: None)
    assert client.get("/api/health").json()["mongodb"] == {"ok": True, "detail": "answered"}
