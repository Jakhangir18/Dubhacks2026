"""The session-linked gait review over HTTP: one id from the game's start to the side camera's final summary
(vision/CONTRACT.md). Offline: the rule-based review answers unless a test replaces the model."""

import json
import time
from pathlib import Path

from fastapi.testclient import TestClient

from server import api, gemini
from server.app import app

client = TestClient(app)
SHORT = json.loads((Path(__file__).parent / "fixtures" / "gait_short_walk.json").read_text())


def summary(**over):
    s = {"seconds": 240, "act": "home", "steps": 400, "cadence": 100, "asymmetryPct": 6, "stompPct": 70, "dodgePct": 80,
         "formPct": 85, "shoeMode": True, "segments": [{"act": "walk", "round": 1, "startS": 0, "endS": 40}],
         "byLane": {"flower": {"L": [3, 8], "R": [8, 8]}}}
    s.update(over)
    return s


def start(player="Mia"):
    return client.post("/api/session/start", json={"player": player}).json()


def test_one_id_from_start_to_save():
    assert "id" not in client.get("/api/session/active").json()
    s = start()
    active = client.get("/api/session/active").json()
    assert active["id"] == s["id"] and active["player"] == "Mia" and active["serverTime"] >= s["startedAt"]
    out = client.post("/api/session", json={"player": "Mia", "summary": summary(), "id": s["id"]}).json()
    assert out["id"] == s["id"] and out["gaitReview"] is None          # no side camera checked in
    assert "id" not in client.get("/api/session/active").json()        # cleared once saved
    saved = client.get(f"/api/session/{s['id']}").json()
    assert saved["summary"]["segments"][0]["endS"] == 40 and "gaitReview" not in saved


def test_a_bad_or_reused_id_gets_a_fresh_one():
    first = client.post("/api/session", json={"player": "Mia", "summary": summary(), "id": "NOT-HEX"}).json()
    assert first["id"] != "NOT-HEX"
    again = client.post("/api/session", json={"player": "Mia", "summary": summary(), "id": first["id"]}).json()
    assert again["id"] != first["id"]
    assert client.get("/api/session/zzz").status_code == 404


def test_side_camera_walk_is_reviewed_after_the_save():
    s = start("Guest")                                                  # not a saved player: the active session names it
    live = {k: v for k, v in SHORT["summary"].items() if k != "curves"}
    assert client.post("/api/gait", json={"player": "x", "sessionId": s["id"], "summary": live}).json() == {"ok": True}
    out = client.post("/api/session", json={"player": "Guest", "summary": summary(), "id": s["id"]}).json()
    assert out["gaitReview"]["status"] == "waiting"
    assert client.get(f"/api/session/{s['id']}").json()["gaitReview"]["status"] == "waiting"

    r = client.post("/api/gait/final", json={"sessionId": s["id"], "summary": SHORT["summary"], "quality": SHORT["quality"],
                                             "perAct": {"walk": {k: v for k, v in SHORT["summary"].items() if k != "curves"}, "junk": {}}})
    assert r.status_code == 202 and r.json() == {"status": "reviewing"}
    doc = client.get(f"/api/session/{s['id']}").json()                  # the test client runs the background task
    assert doc["gait"]["summary"]["strike_counts"] == {"L": 2, "R": 2} and "strikes" not in doc["gait"]["summary"]
    assert set(doc["gait"]["perAct"]) == {"walk"}
    review = doc["gaitReview"]
    assert review["status"] == "done" and review["source"] == "rules" and "consent" in review["reason"]
    assert review["dataQuality"]["level"] == "poor" and review["review"]["playerFeedback"]
    listed = client.get("/api/sessions/Guest").json()[0]
    assert "summary" not in listed["gait"] and listed["gaitReview"]["status"] == "done"   # the list stays light


def test_final_for_an_unknown_session_is_404_and_null_summary_is_reviewed():
    assert client.post("/api/gait/final", json={"sessionId": "ab" * 16, "summary": None}).status_code == 404
    sid = client.post("/api/session", json={"player": "Mia", "summary": summary()}).json()["id"]
    assert client.post("/api/gait/final", json={"sessionId": sid, "summary": None}).status_code == 202
    review = client.get(f"/api/session/{sid}").json()["gaitReview"]
    assert review["status"] == "done" and "too little" in review["dataQuality"]["issues"][0]


def test_with_consent_the_model_reviews_numbers_only(monkeypatch):
    client.put("/api/player/Mia", json={"aiReviewConsent": True, "notes": "Mia prefers short cues"})
    assert client.get("/api/player/Mia").json()["aiReviewConsent"] is True
    sent = []

    async def fake(system, user, **kw):
        sent.append(user)
        return None, "Gemini HTTP 503"
    monkeypatch.setattr(gemini, "generate_json", fake)
    sid = client.post("/api/session", json={"player": "Mia", "summary": summary()}).json()["id"]
    client.post("/api/gait/final", json={"sessionId": sid, "summary": SHORT["summary"], "quality": SHORT["quality"]})
    review = client.get(f"/api/session/{sid}").json()["gaitReview"]
    assert review["source"] == "rules" and review["reason"] == "Gemini HTTP 503"
    reviews = [u for u in sent if '"metrics"' in u]   # the session note at Home asks the model too
    assert len(reviews) == 1 and "Mia" not in reviews[0]


def test_a_review_that_never_comes_reads_as_failed(offline):
    s = start()
    client.post("/api/gait", json={"sessionId": s["id"], "summary": SHORT["summary"]})
    client.post("/api/session", json={"player": "Mia", "summary": summary(), "id": s["id"]})
    offline.update_session(s["id"], gaitReview={"status": "waiting", "ts": time.time() - api.WAIT_TIMEOUT_S - 1})
    review = client.get(f"/api/session/{s['id']}").json()["gaitReview"]
    assert review["status"] == "failed" and "did not send" in review["reason"]


def test_coach_uses_live_side_camera_numbers(offline):
    s = start()
    live = {**SHORT["summary"], "knee": {"L": {"peak_bend": 125}, "R": {"peak_bend": 120}},
            "toe_lift_cm": {"L": 2, "R": 9}}                           # left leg nearer the camera, toes low
    client.post("/api/gait", json={"sessionId": s["id"], "summary": live})
    cue = client.post("/api/coach", json={"player": "Mia", "summary": {"act": "walk", "cadence": 100, "asymmetryPct": 5}}).json()
    assert cue["source"] == "rules" and cue["say"] == "Lift your left toes a little higher each step"


def test_next_greeting_uses_the_last_review_focus(offline):
    sid = client.post("/api/session", json={"player": "Mia", "summary": summary()}).json()["id"]
    offline.update_session(sid, gaitReview={"status": "done", "review": {"focus": {"text": "Land each step on the heel"}}})
    assert "Land each step on the heel" in client.get("/api/plan/Mia").json()["say"]


def test_an_active_session_expires():
    s = start()
    api.store.set_setting(api.ACTIVE_KEY, {**s, "startedAt": time.time() - api.ACTIVE_TTL_S - 1})
    assert "id" not in client.get("/api/session/active").json()
