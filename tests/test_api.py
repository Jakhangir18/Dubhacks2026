"""Therapist API tests. Keys and MongoDB are switched off, so everything runs on the rule-based fallbacks
and a temporary JSON store; the model calls are replaced where a test needs them."""

from fastapi.testclient import TestClient

from server import api, therapist
from server.app import app
from server.store import clean_limits

client = TestClient(app)


def summary(**over):
    s = {"seconds": 300, "act": "home", "steps": 420, "cadence": 96, "asymmetryPct": 8, "stompPct": 75,
         "dodgePct": 60, "formPct": 82, "highLiftAvgCm": {"L": 12, "R": 10}}
    s.update(over)
    return s


def test_status_reports_fallbacks():
    assert client.get("/api/status").json() == {"gemini": False, "backboard": False, "storage": "file", "visa": "mock", "perceptron": False}


def test_limits_are_cleaned_and_kept_inside_their_ranges():
    lim = clean_limits({"liftCm": 50, "liftRange": [14, 6], "walkSeconds": "30", "junk": 1})
    assert lim["liftRange"] == [6.0, 14.0]
    assert lim["liftCm"] == 14.0
    assert lim["walkSeconds"] == 30
    assert "junk" not in lim


def test_player_round_trip_with_rewards():
    r = client.put("/api/player/Mia", json={"limits": {"liftCm": 9}, "rewards": [{"name": "ice cream", "usd": 4},
                                                                              {"name": "", "usd": 1}, {"name": "x", "usd": "?"}]})
    assert r.json()["rewards"] == [{"name": "ice cream", "usd": 4.0}]
    p = client.get("/api/player/Mia").json()
    assert p["limits"]["liftCm"] == 9.0
    assert client.get("/api/players").json() == ["Mia"]


def test_coach_rules_stay_inside_the_therapist_range():
    client.put("/api/player/Mia", json={"limits": {"liftCm": 12, "liftRange": [6, 12]}})
    out = client.post("/api/coach", json={"player": "Mia", "summary": summary(act="storm", dodgePct=95)}).json()
    assert out["source"] == "rules"
    assert out["params"]["liftCm"] == 12          # rules asked for 13, the range caps it


def test_coach_model_output_is_clamped(monkeypatch):
    async def fake(system, user, timeout=8):
        return {"say": "lift " * 30, "params": {"liftCm": 99, "spacingCm": 1}}
    monkeypatch.setattr(therapist, "gemini_json", fake)
    out = client.post("/api/coach", json={"player": "Mia", "summary": summary(act="storm")}).json()
    assert out["source"] == "gemini"
    assert out["params"] == {"liftCm": 18.0, "spacingCm": 90.0}
    assert len(out["say"].split()) <= 14


def test_plan_uses_history():
    assert "Hi Mia" in client.get("/api/plan/Mia").json()["say"]
    client.post("/api/session", json={"player": "Mia", "summary": summary(dodgePct=40, stompPct=80)})
    plan = client.get("/api/plan/Mia").json()
    assert plan["source"] == "history"
    assert "seeds" in plan["say"]


def test_full_session_saves_note_unlocks_reward_and_remembers(monkeypatch):
    calls = []

    async def fake_backboard(content, assistant_id, memory):
        calls.append((memory, assistant_id))
        return ("noted", "asst-1")
    monkeypatch.setattr(therapist, "backboard", fake_backboard)
    client.put("/api/player/Mia", json={"rewards": [{"name": "sticker", "usd": 1}, {"name": "movie night", "usd": 8}]})
    out = client.post("/api/session", json={"player": "Mia", "summary": summary(formPct=85)}).json()
    assert out["note"]
    assert out["reward"]["name"] == "movie night"     # high effort picks the bigger reward
    assert out["receipt"]["network"] == "Visa sandbox (mock)"
    assert calls == [("Auto", None)]
    assert client.get("/api/player/Mia").json()["assistantId"] == "asst-1"
    rows = client.get("/api/sessions/Mia").json()
    assert rows[0]["note"] == out["note"]


def test_short_or_unverified_session_gets_no_reward():
    client.put("/api/player/Mia", json={"rewards": [{"name": "sticker", "usd": 1}]})
    short = client.post("/api/session", json={"player": "Mia", "summary": summary(seconds=10)}).json()
    unverified = client.post("/api/session", json={"player": "Mia", "summary": summary(), "verified": False}).json()
    unfinished = client.post("/api/session", json={"player": "Mia", "summary": summary(act="storm")}).json()
    assert short["reward"] is None and unverified["reward"] is None and unfinished["reward"] is None


def test_nan_and_infinite_limits_are_ignored():
    lim = clean_limits({"liftRange": ["nan", 18], "walkSeconds": "inf", "liftCm": 9})
    assert lim["liftRange"] == [6.0, 18.0]
    assert lim["walkSeconds"] == 45
    assert lim["liftCm"] == 9.0
    r = client.put("/api/player/Ann", json={"limits": {"liftRange": ["nan", 18]}})
    assert r.status_code == 200
    assert client.get("/api/player/Ann").status_code == 200


def test_rewards_are_capped_per_day():
    client.put("/api/player/Mia", json={"rewards": [{"name": "sticker", "usd": 1}]})
    got = [client.post("/api/session", json={"player": "Mia", "summary": summary()}).json()["reward"] for _ in range(4)]
    assert [bool(g) for g in got] == [True, True, False, False]


def test_rule_cue_steps_from_the_current_target():
    out = therapist.rule_cue(summary(act="storm", dodgePct=40, liftTargetCm=8), {"liftCm": 10, "liftRange": [6, 18]})
    assert out["params"]["liftCm"] == 7


def test_plan_handles_a_zero_dodge_rate():
    client.post("/api/session", json={"player": "Mia", "summary": summary(dodgePct=0, stompPct=50)})
    assert "seeds" in client.get("/api/plan/Mia").json()["say"]


def test_memory_task_does_not_overwrite_panel_edits(offline):
    offline.update_player("Mia", limits={"liftCm": 9}, rewards=[{"name": "a", "usd": 1}])
    offline.update_player("Mia", assistantId="asst-9")
    p = offline.player("Mia")
    assert p["limits"]["liftCm"] == 9.0 and p["rewards"] == [{"name": "a", "usd": 1}] and p["assistantId"] == "asst-9"


def test_side_camera_gait_reaches_the_saved_session():
    client.put("/api/player/Mia", json={"notes": ""})
    r = client.post("/api/gait", json={"player": "Mia", "summary": {"cadence": 98.5, "kneeBend": {"L": 52, "R": 47},
                                                                     "note": "x" * 500}})
    assert r.json() == {"ok": True}
    client.post("/api/session", json={"player": "Mia", "summary": summary(), "verified": True})
    saved = client.get("/api/sessions/Mia").json()[0]["summary"]["sideCamera"]
    assert saved["cadence"] == 98.5 and saved["kneeBend"] == {"L": 52, "R": 47} and len(saved["note"]) == 200


def test_stale_or_used_gait_is_not_attached(offline):
    offline.update_player("Mia", gait={"ts": 0, "source": "side-camera", "summary": {"cadence": 90}})
    client.post("/api/session", json={"player": "Mia", "summary": summary(sideCamera={"forged": 1}), "verified": True})
    assert "sideCamera" not in client.get("/api/sessions/Mia").json()[0]["summary"]
    client.post("/api/gait", json={"player": "Mia", "summary": {"cadence": 90}})
    for _ in range(2):
        client.post("/api/session", json={"player": "Mia", "summary": summary(), "verified": True})
    first, second = client.get("/api/sessions/Mia").json()[:2]
    assert "sideCamera" in second["summary"] and "sideCamera" not in first["summary"]   # newest first


def test_gait_rules():
    assert client.post("/api/gait", json={"player": "Nobody", "summary": {"cadence": 90}}).status_code == 404
    client.put("/api/player/Mia", json={"notes": ""})
    assert client.post("/api/gait", json={"player": "Mia", "summary": None}).json()["ok"] is False
    assert api.clean_gait({"big": 10**400, "nan": float("nan")}) == {"big": None, "nan": None}


def test_plant_speed_is_kept_between_its_bounds():
    assert clean_limits({"speedScale": 7})["speedScale"] == 2.0
    assert clean_limits({"speedScale": 0})["speedScale"] == 0.3
    assert clean_limits({})["speedScale"] == 0.7
