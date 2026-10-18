"""Moments over HTTP: the side camera's annotated leg pictures are kept for the active session's player only with
the AI review consent, listed oldest first with the server's plain-English text, served as JPEG, and their ids
never leave their folder."""

import base64

from fastapi.testclient import TestClient

from server import moments
from server.app import app

client = TestClient(app)
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64 + b"\xff\xd9"


def start(player="Mia", consent=True):
    client.put(f"/api/player/{player}", json={"aiReviewConsent": consent, "notes": ""})
    return client.post("/api/session/start", json={"player": player}).json()


def moment(sid, **over):
    body = {"sessionId": sid, "kind": "knee_low", "side": "L", "valueDeg": 28.4, "targetDeg": 40, "t": 12.5,
            "jpg": base64.b64encode(JPEG).decode()}
    body.update(over)
    return client.post("/api/gait/moment", json=body)


def test_a_moment_is_stored_broadcast_listed_and_served_for_a_consenting_player():
    s = start()
    with client.websocket_connect("/ws/game") as game:
        r = moment(s["id"])
        assert r.status_code == 201
        assert game.receive_json() == [r.json()]
    m = r.json()
    assert moments.ID.fullmatch(m["id"])
    assert m == {"kind": "moment", "sessionId": s["id"], "id": m["id"], "momentKind": "knee_low", "side": "L",
                 "valueDeg": 28.4, "targetDeg": 40.0, "t": 12.5, "title": "Left knee stayed low",
                 "explain": "Your left knee bent 28° at the top of the step. Aim for 40° or more: lift the knee as if stepping over a curb.",
                 "img": f"/api/moment/{s['id']}/{m['id']}.jpg"}
    good = moment(s["id"], kind="good", side="R", valueDeg=57, targetDeg=55, t=20).json()
    assert (good["title"], good["explain"]) == ("Strong right step", "Your right knee bent 57°. That is the lift to repeat.")
    assert client.get(f"/api/session/{s['id']}/moments").json() == {"moments": [m, good]}   # oldest first
    img = client.get(m["img"])
    assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg" and img.content == JPEG
    assert (moments.DIR / s["id"] / "moments.json").is_file()   # the sidecar list, next to the pictures


def test_uneven_text_names_the_leg_to_lift():
    s = start()
    m = moment(s["id"], kind="uneven", side="L", valueDeg=35, targetDeg=53).json()
    assert m["title"] == "Left and right differ"
    assert m["explain"] == "Your right knee lifts 18° more than your left. Give the left leg the same high step."
    assert moments.describe("uneven", None, 30, 48)[1] == "One knee lifts 18° more than the other. Give both legs the same high step."
    assert moments.describe("knee_low", None, 28, 40) == ("Knee stayed low", "Your knee bent 28° at the top of the step. Aim for 40° or more: lift the knee as if stepping over a curb.")
    assert moments.describe("good", None, 61, 55)[0] == "Strong step"


def test_without_consent_or_an_active_session_nothing_is_stored():
    s = start(consent=False)
    assert moment(s["id"]).status_code == 403
    assert client.get(f"/api/session/{s['id']}/moments").json() == {"moments": []}
    assert not (moments.DIR / s["id"]).exists()
    s = start()                                              # consent on, but the picture names another session
    assert moment("ab" * 16).status_code == 403
    assert not moments.DIR.exists()
    client.post("/api/session", json={"player": "Mia", "summary": {"seconds": 30, "act": "home"}, "id": s["id"]})
    assert moment(s["id"]).status_code == 403                # saved at Home: no longer active
    assert client.get(f"/api/session/{s['id']}/moments").json() == {"moments": []}


def test_bad_moments_are_refused_and_a_session_stops_at_a_dozen():
    s = start()
    assert moment(s["id"], kind="jump").status_code == 422
    assert moment(s["id"], side="X").status_code == 422
    assert moment(s["id"], valueDeg="nan").status_code == 422
    assert moment(s["id"], jpg="not base64!").status_code == 415
    assert moment(s["id"], jpg=base64.b64encode(b"GIF89a").decode()).status_code == 415
    assert moment(s["id"], jpg=base64.b64encode(b"\xff\xd8" + b"\x00" * moments.MAX_JPEG_BYTES).decode()).status_code == 413
    assert moment(s["id"], jpg=base64.b64encode(b"\xff\xd8" + b"\x00" * (2 * moments.MAX_JPEG_BYTES)).decode()).status_code == 413
    assert client.get(f"/api/session/{s['id']}/moments").json() == {"moments": []}
    assert [moment(s["id"]).status_code for _ in range(moments.MAX_PER_SESSION + 1)] == [201] * moments.MAX_PER_SESSION + [429]
    assert len(client.get(f"/api/session/{s['id']}/moments").json()["moments"]) == moments.MAX_PER_SESSION


def test_moment_ids_cannot_leave_their_folder():
    s = start()
    m = moment(s["id"]).json()
    (moments.DIR / "secret.jpg").write_bytes(JPEG)
    (moments.DIR / s["id"] / "moments.json").is_file()
    assert client.get(f"/api/moment/{s['id']}/..%2Fsecret.jpg").status_code == 404
    assert client.get(f"/api/moment/{s['id']}/moments.json").status_code == 404
    assert client.get(f"/api/moment/..%2Fsecret/{m['id']}.jpg").status_code == 404
    assert client.get(f"/api/moment/{s['id']}/{'0' * 12}.jpg").status_code == 404     # a well-formed unknown id
    assert client.get("/api/session/..%2F..%2Fstore/moments").status_code == 404
    assert moments.image(s["id"], "../secret") is None and moments.image("../x", m["id"]) is None
