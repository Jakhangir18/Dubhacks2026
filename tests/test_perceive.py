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


def test_requests_that_never_reach_the_api_spend_no_budget():
    client.put("/api/player/Mia", json={"perceptronConsent": True})
    for _ in range(perceive.CALLS_PER_MINUTE + 5):
        client.post("/api/perceive", json={"player": "Mia", "kind": "form", "frames": frames()})   # no key set
    assert perceive.allow_call()


async def test_spent_budget_stops_the_paid_call(monkeypatch):
    monkeypatch.setenv("PERCEPTRON_API_KEY", "k")
    posts = []

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def post(self, *a, **k):
            posts.append(1)
            raise AssertionError("the paid API must not be called")
    monkeypatch.setattr(perceive.httpx, "AsyncClient", FakeClient)
    for _ in range(perceive.CALLS_PER_MINUTE):
        assert perceive.allow_call()
    assert await perceive.check_form(perceive.clean_frames(frames())) == {"source": "off"}
    assert posts == []


def test_huge_or_unsized_body_is_refused():
    assert client.post("/api/perceive", content=b"{}", headers={"content-length": "999999999"}).status_code == 413
    chunked = client.post("/api/perceive", content=iter([b"{}"]), headers={"content-type": "application/json"})
    assert chunked.status_code == 413   # no length: refused, never streamed in
    assert client.get("/api/perceive").status_code != 413   # only POST bodies are capped


def test_clip_parser():
    assert perceive.parse_clips('''<collection mention="high steps">
      <clip mention="left high step" asset_idx="0" t="3.2 seconds" />
      <clip mention="right high step" t="4.0 seconds, 4.8 seconds" />
      <clip mention="other asset" asset_idx="1" t="5.0 seconds" />
      <clip mention="bad time" t="unknown" />
    </collection>''') == [
        {"mention": "left high step", "t0": 3.2, "t1": 3.2},
        {"mention": "right high step", "t0": 4.0, "t1": 4.8},
    ]


def test_track_parser():
    assert perceive.parse_tracks('''<collection mention="feet">
      <track mention="left foot" asset_idx="0">
        <point_box t="0.0 seconds"> (100,150) (180,230) </point_box>
        <point_box t="1.5 seconds"> (110,160) (190,240) </point_box>
      </track>
      <track mention="right foot"><point_box t="0.0 seconds"> (500,150) (580,230) </point_box></track>
      <track mention="left foot" asset_idx="1"><point_box t="0.0 seconds"> (0,0) (10,10) </point_box></track>
    </collection>''') == {
        "left foot": [{"t": 0.0, "box": [100, 150, 180, 230]}, {"t": 1.5, "box": [110, 160, 190, 240]}],
        "right foot": [{"t": 0.0, "box": [500, 150, 580, 230]}],
    }


def test_detect_parser():
    assert perceive.parse_points({"detections": [
        {"mention": "foot", "point": {"x": 160, "y": 60}},
        {"mention": "flower", "point": {"x": 320, "y": 240}},
        {"mention": "invalid", "point": {"x": float("nan"), "y": 1}},
    ]}) == [{"mention": "foot", "point": {"x": 500, "y": 250}},
            {"mention": "flower", "point": {"x": 1000, "y": 1000}}]


def test_multilook_parser():
    assert perceive.parse_multilook({"results": [
        {"prompt_index": 2, "completions": [{"message": {"content": " Rail not visible. "}}]},
        {"prompt_index": 0, "completions": [{"message": {"content": "A bright walk home!"}}]},
        {"prompt_index": 1, "error": "unavailable"},
    ]}) == {"caption": "A bright walk home!", "gaitNote": None, "safety": "Rail not visible."}


def test_session_consent_budget_and_body_cap(monkeypatch):
    monkeypatch.setenv("PERCEPTRON_API_KEY", "k")
    posts = []

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def post(self, *a, **k):
            posts.append(1)
            raise AssertionError("no paid request allowed")

    monkeypatch.setattr(perceive.httpx, "AsyncClient", FakeClient)
    body = {"player": "Mia", "frames": frames(32)}
    assert client.post("/api/perceive/session", json=body).json() == {"source": "no-consent"}
    assert not perceive._calls
    client.put("/api/player/Mia", json={"perceptronConsent": True})
    for _ in range(perceive.CALLS_PER_MINUTE):
        assert perceive.allow_call()
    assert client.post("/api/perceive/session", json=body).json() == {"source": "off"}
    assert not posts
    assert client.get("/api/player/Mia").json()["perceptronReports"] == []
    for path in ("/api/perceive", "/api/perceive/session"):
        assert client.post(path, content=b"{}", headers={"content-length": "999999999"}).status_code == 413
        assert client.post(path, content=iter([b"{}"]), headers={"content-type": "application/json"}).status_code == 413
    # A session can exceed the live-check body cap, but not its own cap.
    from server.app import MAX_PERCEIVE_BYTES, MAX_SESSION_BYTES
    assert client.post("/api/perceive/session", json=body,
                       headers={"content-length": str(MAX_PERCEIVE_BYTES + 1)}).status_code == 200
    assert client.post("/api/perceive/session", json=body,
                       headers={"content-length": str(MAX_SESSION_BYTES + 1)}).status_code == 413


def test_session_subcall_failure_keeps_other_results(monkeypatch):
    import asyncio

    import httpx

    monkeypatch.setenv("PERCEPTRON_API_KEY", "k")
    posts = []
    active = 0
    peak = 0

    class FakeResp:
        def __init__(self, result):
            self.result = result

        def raise_for_status(self):
            pass

        def json(self):
            return self.result

    class FakeClient:
        def __init__(self, *a, **k):
            assert k["timeout"] < 90

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def post(self, url, headers, json):
            nonlocal active, peak
            posts.append((url, json))
            assert headers["Authorization"] == "Bearer k"
            active += 1
            peak = max(peak, active)
            await asyncio.sleep(0.01)
            active -= 1
            if url.endswith("/detect"):
                assert json["media"]["image_url"] == JPEG + "middle"
                assert json["config"] == {"output": "point", "reasoning_effort": "none"}
                assert json["categories"] == ["foot", "flower", "seed ball"]
                return FakeResp({"detections": [{"mention": "foot", "point": {"x": 160, "y": 120}}]})
            assert "response_format" not in json
            if url.endswith("/multilook"):
                assert json["reasoning_effort"] == "none"   # reasoning left the answers empty on the live API
                assert json["max_completion_tokens"] == 400 and len(json["prompts"]) == 3
                assert len(json["context"][0]["content"][0]["video_frames"]["frames"]) == 32
                return FakeResp({"results": [
                    {"prompt_index": i, "completions": [{"message": {"content": text}}]}
                    for i, text in enumerate(["A happy walk!", "Even cadence. High steps are visible.", "Rail not visible."])
                ]})
            assert json["max_completion_tokens"] == 2048 and json["reasoning_effort"] == "low"
            assert len(json["messages"][0]["content"][0]["video_frames"]["frames"]) == 32
            if json["vision_config"]["annotation_format"] == "box":
                raise httpx.ReadTimeout("tracking unavailable")
            return FakeResp({"choices": [{"message": {"content": '<clip mention="left high step" t="3.2 seconds" />'}}]})

    monkeypatch.setattr(perceive.httpx, "AsyncClient", FakeClient)
    client.put("/api/player/Mia", json={"perceptronConsent": True, "notes": "keep these notes"})
    sample = frames(32)
    sample[16]["url"] += "middle"
    # Bad entries do not consume the session's valid-frame allowance.
    sample.insert(0, {"url": "https://invalid", "tsMs": 0})
    for _ in range(6):
        out = client.post("/api/perceive/session", json={"player": "Mia", "frames": sample}).json()
        assert out == {
            "source": "perceptron", "clips": [{"mention": "left high step", "t0": 3.2, "t1": 3.2}],
            "tracks": None, "points": [{"mention": "foot", "point": {"x": 500, "y": 500}}],
            "keyFrame": JPEG + "middle", "caption": "A happy walk!", "gaitNote": "Even cadence. High steps are visible.",
            "safety": "Rail not visible.", "usage": {"requests": 4},
        }
    assert peak == 4
    assert len(posts) == len(perceive._calls) == 24
    player = client.get("/api/player/Mia").json()
    assert len(player["perceptronReports"]) == 5
    assert player["perceptronReports"][0] == out
    assert player["notes"] == "keep these notes" and player["perceptronConsent"]


def test_collection_mention_reaches_its_children():
    # The shape the live API returned on 2026-10-18.
    content = ('<collection mention="left high step">\n <clip t="0 seconds 1.5 seconds" />\n <clip t="3 seconds" />\n</collection>\n'
               '<collection mention="left foot">\n <track>\n <point_box t="0.0 seconds"> (10,20) (30,40) </point_box>\n'
               ' </track>\n</collection>')
    assert [(c["mention"], c["t0"], c["t1"]) for c in perceive.parse_clips(content)] == [
        ("left high step", 0.0, 1.5), ("left high step", 3.0, 3.0)]
    assert perceive.parse_tracks(content) == {"left foot": [{"t": 0.0, "box": [10.0, 20.0, 30.0, 40.0]}]}
