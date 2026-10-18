"""Local highlight uploads and QR codes; no model services or network needed."""

import re
import xml.etree.ElementTree as ET

import pytest
from fastapi.testclient import TestClient

from server import app as server


@pytest.fixture
def clips(monkeypatch, tmp_path):
    directory = tmp_path / "data" / "clips"
    monkeypatch.setattr(server, "CLIPS", directory)
    monkeypatch.setattr(server, "lan_ip", lambda: "192.168.4.12")
    return TestClient(server.app, base_url="http://localhost:8000"), directory


@pytest.mark.parametrize(("media_type", "suffix", "body"), [
    ("video/webm;codecs=vp8,opus", ".webm", b"\x1a\x45\xdf\xa3webm-container"),
    ("video/mp4", ".mp4", b"\x00\x00\x00\x18ftypisom"),
])
def test_upload_stores_and_serves_clip_with_lan_url(clips, media_type, suffix, body):
    client, directory = clips
    response = client.post("/api/clip", content=body, headers={"content-type": media_type})
    assert response.status_code == 201
    result = response.json()
    assert re.fullmatch(r"[0-9a-f]{32}", result["id"])
    assert result["url"] == f"http://192.168.4.12:8000/clips/{result['id']}"
    assert list(directory.iterdir()) == [directory / f"{result['id']}{suffix}"]
    assert (directory / f"{result['id']}{suffix}").read_bytes() == body
    video = client.get(f"/clips/{result['id']}")
    assert video.status_code == 200
    assert video.headers["content-type"] == media_type.split(";")[0]
    assert video.content == body


@pytest.mark.parametrize(("media_type", "body"), [
    ("image/png", b"\x89PNG"), ("text/plain", b"hello"),
    ("video/webm", b"<html>not video</html>"), ("video/mp4", b""),
])
def test_rejects_other_types_and_mismatched_containers(clips, media_type, body):
    client, directory = clips
    response = client.post("/api/clip", content=body, headers={"content-type": media_type})
    assert response.status_code == 415
    assert not list(directory.glob("*")) if directory.exists() else True


def test_rejects_oversize_declared_and_streamed_bodies(clips, monkeypatch):
    client, directory = clips
    assert server.MAX_CLIP_BYTES == 30 * 1024 * 1024
    monkeypatch.setattr(server, "MAX_CLIP_BYTES", 16)
    body = b"\x1a\x45\xdf\xa3" + b"x" * 13
    # Exercise both the early Content-Length check and the actual byte-count limit.
    for content in (body, iter([body[:4], body[4:]])):
        response = client.post("/api/clip", content=content, headers={"content-type": "video/webm"})
        assert response.status_code == 413
        assert not list(directory.glob("*")) if directory.exists() else True


def test_qr_is_local_svg_and_missing_clips_are_404(clips):
    client, _ = clips
    response = client.get("/api/qr", params={"url": "http://192.168.4.12:8000/clips/" + "a" * 32})
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/svg+xml"
    root = ET.fromstring(response.content)
    assert root.tag == "{http://www.w3.org/2000/svg}svg"
    assert root.find(".//{http://www.w3.org/2000/svg}path") is not None
    assert client.get("/clips/" + "a" * 32).status_code == 404
    assert client.get("/clips/not-an-id").status_code == 404



def test_clip_url_uses_the_host_the_page_was_opened_with(clips):
    client, _ = clips
    r = client.post("/api/clip", content=b"\x1a\x45\xdf\xa3webm",
                    headers={"content-type": "video/webm", "host": "vps-worker.example.ts.net:8443",
                             "x-forwarded-proto": "https"})
    assert r.status_code == 201
    assert r.json()["url"].startswith("http://vps-worker.example.ts.net:8443/clips/")   # forwarded proto ignored: not from a local proxy


def test_forwarded_host_is_ignored_from_untrusted_clients_and_ipv6_hosts_parse(clips):
    from server.app import host_name
    assert host_name("[::1]:8000") == "::1"
    assert host_name("a.ts.net:8443") == "a.ts.net"
    assert host_name("0.0.0.0:8000") == "0.0.0.0"
    client, _ = clips
    r = client.post("/api/clip", content=b"\x1a\x45\xdf\xa3webm",
                    headers={"content-type": "video/webm", "x-forwarded-host": "evil.example"})
    assert "evil.example" not in r.json()["url"]


def test_old_clips_are_pruned(clips, monkeypatch):
    client, directory = clips
    monkeypatch.setattr(server, "MAX_CLIPS", 2)
    for _ in range(4):
        assert client.post("/api/clip", content=b"\x1a\x45\xdf\xa3webm", headers={"content-type": "video/webm"}).status_code == 201
    assert len(list(directory.glob("*.webm"))) == 2
