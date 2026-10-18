"""Send foot events to the Zombie Walk Home server. Standard library only, so it runs on a Raspberry Pi as is.

Use as a library from your pose code:
    from pi_sender import Sender
    s = Sender("http://192.168.1.20:8000")
    s.lift("L", 12.5)
    s.strike("L")

Or run a demo walk to test the link:
    python3 pi_sender.py --server http://192.168.1.20:8000 --demo
"""

from __future__ import annotations

import argparse
import http.client
import json
import time
from urllib.parse import urlparse


class Sender:
    """Keeps one HTTP connection open (no handshake per step) and never raises into the caller's pose loop."""

    def __init__(self, server: str, source: str = "pi", timeout: float = 0.5) -> None:
        u = urlparse(server)
        self.host, self.port = u.hostname or "localhost", u.port or (443 if u.scheme == "https" else 80)
        self.https = u.scheme == "https"
        self.source = source
        self.timeout = timeout
        self.conn: http.client.HTTPConnection | None = None
        self.errors = 0

    def _connect(self) -> http.client.HTTPConnection:
        cls = http.client.HTTPSConnection if self.https else http.client.HTTPConnection
        return cls(self.host, self.port, timeout=self.timeout)

    def send(self, events: list[dict]) -> dict | None:
        body = json.dumps({"events": events})
        for attempt in range(2):
            try:
                if self.conn is None:
                    self.conn = self._connect()
                self.conn.request("POST", "/api/events", body=body, headers={"content-type": "application/json"})
            except (BrokenPipeError, ConnectionResetError, http.client.RemoteDisconnected):
                # Writing failed on a stale kept-alive connection: nothing reached the server, safe to resend once.
                self._drop()
                if attempt == 0:
                    continue
                break
            except (OSError, http.client.HTTPException):
                self._drop()
                break
            # The request is written. From here never resend: the server may already have the events.
            try:
                return json.loads(self.conn.getresponse().read())
            except (OSError, http.client.HTTPException, ValueError):
                self._drop()
                break
        self.errors += 1
        return None

    def _drop(self) -> None:
        if self.conn is not None:
            self.conn.close()
        self.conn = None

    def lift(self, foot: str, lift_cm: float) -> dict | None:
        return self.send([{"foot": foot, "kind": "lift", "liftCm": round(lift_cm, 1), "source": self.source}])

    def strike(self, foot: str) -> dict | None:
        return self.send([{"foot": foot, "kind": "strike", "source": self.source}])


def demo(server: str, seconds: float, spm: float) -> None:
    s = Sender(server, source="demo")
    gap = 60.0 / spm
    foot = "L"
    end = time.time() + seconds
    n = 0
    while time.time() < end:
        high = n % 6 == 5  # a high step every sixth step
        print(s.lift(foot, 16.0 if high else 4.0))
        time.sleep(0.12)
        s.strike(foot)
        foot = "R" if foot == "L" else "L"
        n += 1
        time.sleep(max(0.0, gap - 0.12))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--server", default="http://localhost:8000")
    ap.add_argument("--demo", action="store_true", help="send a steady walk")
    ap.add_argument("--seconds", type=float, default=60)
    ap.add_argument("--spm", type=float, default=100, help="steps per minute for the demo")
    a = ap.parse_args()
    if a.demo:
        demo(a.server, a.seconds, a.spm)
    else:
        ap.print_help()
