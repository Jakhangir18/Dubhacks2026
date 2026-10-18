"""Server tests: the event relay from a sender (the Raspberry Pi) to the game page."""

from fastapi.testclient import TestClient

from server.app import app, clean_event

client = TestClient(app)


def test_post_events_reach_the_game_socket():
    with client.websocket_connect("/ws/game") as game:
        r = client.post("/api/events", json={"events": [
            {"foot": "L", "kind": "lift", "liftCm": 12.5, "source": "pi"},
            {"foot": "L", "kind": "strike"},
        ]})
        assert r.json() == {"accepted": 2, "listeners": 1}
        got = game.receive_json()
        assert got[0] == {"foot": "L", "kind": "lift", "liftCm": 12.5, "source": "pi"}
        assert got[1]["kind"] == "strike"


def test_websocket_sender_reaches_the_game_socket():
    with client.websocket_connect("/ws/game") as game, client.websocket_connect("/ws/events") as pi:
        pi.send_json({"foot": "R", "kind": "strike", "source": "pi"})
        assert game.receive_json() == [{"foot": "R", "kind": "strike", "source": "pi"}]


def test_bad_events_are_dropped():
    assert clean_event({"foot": "X", "kind": "strike"}) is None
    assert clean_event({"foot": "L", "kind": "jump"}) is None
    assert clean_event({"foot": "L", "kind": "lift", "liftCm": "high"}) is None
    assert clean_event({"foot": "L", "kind": "lift", "liftCm": 500})["liftCm"] == 80.0
    r = client.post("/api/events", json={"events": [{"foot": "Q", "kind": "strike"}]})
    assert r.json()["accepted"] == 0


def test_game_page_is_served():
    r = client.get("/")
    assert r.status_code == 200
    assert "Zombie Walk Home" in r.text


def test_non_finite_and_boolean_lifts_are_rejected():
    assert clean_event({"foot": "L", "kind": "lift", "liftCm": float("nan")}) is None
    assert clean_event({"foot": "L", "kind": "lift", "liftCm": float("inf")}) is None
    assert clean_event({"foot": "L", "kind": "lift", "liftCm": True}) is None


def test_garbled_websocket_frame_does_not_close_the_sender():
    with client.websocket_connect("/ws/game") as game, client.websocket_connect("/ws/events") as pi:
        pi.send_text("{not json")
        pi.send_json({"foot": "L", "kind": "strike"})
        assert game.receive_json() == [{"foot": "L", "kind": "strike", "source": "pi"}]


def test_load_env_drops_inline_comments(tmp_path, monkeypatch):
    from server.app import load_env
    f = tmp_path / "keys"
    f.write_text('A_KEY=abc\t# the README style\nD_KEY=   # optional\nE_KEY=#abc\nB_KEY="x # y"\n# C_KEY=no\n')
    for k in ("A_KEY", "B_KEY", "C_KEY", "D_KEY", "E_KEY"):
        monkeypatch.setenv(k, "")   # recorded as absent, so the values load_env sets are removed afterwards
        monkeypatch.delenv(k)
    load_env(f)
    import os
    assert os.environ["A_KEY"] == "abc"
    assert os.environ["B_KEY"] == "x # y"
    assert "C_KEY" not in os.environ
    assert os.environ["D_KEY"] == ""
    assert os.environ["E_KEY"] == "#abc"


def test_shoe_sightings_are_relayed_and_cleaned():
    with client.websocket_connect("/ws/game") as game:
        r = client.post("/api/events", json={"events": [{"kind": "shoes", "source": "feet", "boxes": [
            [0.1, 0.5, 0.3, 0.9, 0.8], [1.2, -0.1, 0.9, 0.4, 0.5], [0.5, 0.5, 0.4, 0.9, 0.9], "x",
            [0, 0, 0.1, 0.1, 0.1], [0, 0, 0.2, 0.2, 0.2], [0, 0, 0.3, 0.3, 0.3], [0, 0, 0.4, 0.4, 0.4],
        ]}]})
        assert r.json() == {"accepted": 1, "listeners": 1}
        got = game.receive_json()[0]
        assert got["kind"] == "shoes" and got["source"] == "feet"
        # inverted and junk boxes are dropped, the rest kept in order, at most four
        assert got["boxes"] == [[0.1, 0.5, 0.3, 0.9, 0.8], [0, 0, 0.1, 0.1, 0.1], [0, 0, 0.2, 0.2, 0.2], [0, 0, 0.3, 0.3, 0.3]]
    assert clean_event({"kind": "shoes", "boxes": "none"}) is None
    assert clean_event({"kind": "shoes", "boxes": [[True, 0, 1, 1, 1], [0, 0, 1, 1, float("nan")]]})["boxes"] == []


def test_camera_frames_are_relayed_within_a_size_cap():
    jpeg = "data:image/jpeg;base64,/9j/4AAQ"
    assert clean_event({"kind": "frame", "jpeg": jpeg}) == {"kind": "frame", "jpeg": jpeg, "source": "feet"}
    assert clean_event({"kind": "frame", "jpeg": "data:image/png;base64,AAAA"}) is None
    assert clean_event({"kind": "frame", "jpeg": "data:image/jpeg;base64," + "A" * 300_000}) is None


def test_marks_are_cleaned():
    got = clean_event({"kind": "marks", "marks": [["cyan", 0.5, 1.4, 0.1, 0.1], ["red", 0, 0, 0, 0], "x", ["magenta", "a", 0, 0, 0]]})
    assert got == {"kind": "marks", "marks": [["cyan", 0.5, 1.0, 0.1, 0.1]], "source": "feet"}
    assert clean_event({"kind": "marks", "marks": "no"}) is None


def test_old_dashboard_addresses_land_on_the_one_dashboard():
    go = lambda path: client.get(path, follow_redirects=False).headers["location"]
    assert go("/dashboard") == go("/therapist.html") == "/dashboard.html"
    assert go("/report.html?id=ab12") == go("/dashboard/?session=ab12") == "/dashboard.html?session=ab12"
    assert go("/report.html?id=a%26b") == "/dashboard.html?session=a%26b"   # an id cannot add parameters
    assert "Walk Dashboard" in client.get("/dashboard.html").text
