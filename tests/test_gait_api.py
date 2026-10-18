"""Gait API tests: storing a walk posted by gait.py and reading it back. Runs on a temporary JSON store."""

import json

import pytest
from fastapi.testclient import TestClient

import gait
from server import api
from server.app import app
from server.store import Store

client = TestClient(app)


@pytest.fixture(autouse=True)
def offline(monkeypatch, tmp_path):
    monkeypatch.delenv("MONGODB_URI", raising=False)
    fresh = Store()
    fresh.file = tmp_path / "store.json"
    monkeypatch.setattr(api, "store", fresh)
    return fresh


SUMMARY = {"direction": "right", "cadence": 104.2, "strikes": {"L": [1.0], "R": [1.5]},
           "stride": {"L": 1.1, "R": 1.2}, "flexion": {"L": 150, "R": 148}, "asymmetry": {"stride": 8, "flexion": 1}, "junk": 1}
ROWS = [{"t": 0.0, "L_knee": 160.123, "R_knee": None, "evil": 1}, {"t": 0.03, "L_knee": float("inf"), "R_knee": "x"}]


def post(player="Alex", rows=ROWS, summary=SUMMARY):
    # json.loads(json.dumps(...)) keeps Infinity out of the request, as a real client would send null or a number
    return client.post("/api/gait", json={"player": player, "summary": summary, "rows": json.loads(json.dumps(rows, default=str).replace("Infinity", "null"))})


def test_round_trip_cleans_rows_and_summary():
    out = post()
    assert out.status_code == 201 and out.json()["frames"] == 2
    walks = client.get("/api/gait/Alex").json()
    assert len(walks) == 1 and "rows" not in walks[0] and "junk" not in walks[0]["summary"]
    full = client.get(f"/api/gait/Alex/{walks[0]['id']}").json()
    assert full["rows"][0]["L_knee"] == 160.12 and full["rows"][0]["R_knee"] is None and "evil" not in full["rows"][0]
    assert full["rows"][1]["L_knee"] is None and full["rows"][1]["R_knee"] is None


def test_walks_are_per_player_and_newest_first():
    post("Alex")
    post("Alex")
    post("Sam")
    assert len(client.get("/api/gait/Alex").json()) == 2 and len(client.get("/api/gait/Sam").json()) == 1
    ts = [w["ts"] for w in client.get("/api/gait/Alex").json()]
    assert ts == sorted(ts, reverse=True)
    assert client.get("/api/gait/Sam/nope").status_code == 404


def test_post_gait_helper_sends_json(monkeypatch):
    sent = {}

    class Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self): return b'{"id": "abc", "ts": 1, "frames": 1}'

    def fake_urlopen(req, timeout):
        sent["url"], sent["body"] = req.full_url, json.loads(req.data)
        return Resp()

    monkeypatch.setattr(gait.urllib.request, "urlopen", fake_urlopen)
    assert gait.post_gait("http://x:8000/", "Alex", {"cadence": 100}, [{"t": 0}])["id"] == "abc"
    assert sent["url"] == "http://x:8000/api/gait" and sent["body"]["player"] == "Alex"
    with pytest.raises(RuntimeError):
        gait.post_gait("http://x:8000", "Alex", None, [])
