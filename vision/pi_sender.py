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
import json
import time
import urllib.request


class Sender:
    def __init__(self, server: str, source: str = "pi", timeout: float = 0.5) -> None:
        self.url = server.rstrip("/") + "/api/events"
        self.source = source
        self.timeout = timeout

    def send(self, events: list[dict]) -> dict:
        body = json.dumps({"events": events}).encode()
        req = urllib.request.Request(self.url, data=body, headers={"content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read())

    def lift(self, foot: str, lift_cm: float) -> dict:
        return self.send([{"foot": foot, "kind": "lift", "liftCm": round(lift_cm, 1), "source": self.source}])

    def strike(self, foot: str) -> dict:
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
