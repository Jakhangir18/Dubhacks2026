"""Players, therapist limits, sessions and rewards. MongoDB Atlas when MONGODB_URI is set (MLH Best Use of
MongoDB Atlas), otherwise a local JSON file so the demo runs offline."""

from __future__ import annotations

import json
import math
import os
import threading
import time
import uuid
from pathlib import Path
from typing import Any

DATA = Path(__file__).resolve().parent.parent / "data"

# Therapist limits the game and the coach must stay inside; the panel edits them per player.
DEFAULT_LIMITS: dict[str, Any] = {
    "minCadence": 80,
    "walkSeconds": 45,
    "gardenPlants": 12,
    "stormSeeds": 0,     # 0 leaves the seed act out: flowers only
    "liftCm": 10,
    "liftRange": [6, 18],
    "spacingCm": 140,
    "spacingRange": [90, 220],
    "sessionMinutes": 17,
    "speedScale": 0.7,   # how fast plants come, times the walking speed; 1 felt too fast on the pad
    "rounds": 2,         # flowers (then seeds, when there are any), this many times, before home
}


def clean_limits(raw: dict[str, Any]) -> dict[str, Any]:
    """Keep known keys, coerce numbers, keep ranges ordered and values inside them."""
    out = dict(DEFAULT_LIMITS)
    for key, default in DEFAULT_LIMITS.items():
        if key not in raw:
            continue
        try:
            if isinstance(default, list):
                lo, hi = float(raw[key][0]), float(raw[key][1])
                if not (math.isfinite(lo) and math.isfinite(hi)):
                    continue
                out[key] = [min(lo, hi), max(lo, hi)]
            else:
                v = float(raw[key])
                if not math.isfinite(v):
                    continue
                out[key] = min(max(v, 0.0), 10000.0)
        except (TypeError, ValueError, IndexError):
            continue
    out["liftCm"] = min(max(out["liftCm"], out["liftRange"][0]), out["liftRange"][1])
    out["spacingCm"] = min(max(out["spacingCm"], out["spacingRange"][0]), out["spacingRange"][1])
    out["speedScale"] = min(max(out["speedScale"], 0.3), 2.0)
    for key in ("walkSeconds", "gardenPlants", "minCadence", "rounds"):
        out[key] = max(1, round(out[key]))
    out["stormSeeds"] = max(0, round(out["stormSeeds"]))
    return out


class Store:
    def __init__(self) -> None:
        self.mongo = None
        uri = os.environ.get("MONGODB_URI")
        if uri:
            try:
                from pymongo import MongoClient

                client: Any = MongoClient(uri, serverSelectionTimeoutMS=4000)
                client.admin.command("ping")
                self.mongo = client[os.environ.get("MONGODB_DB", "zombiewalk")]
            except Exception as e:  # noqa: BLE001 - any connection problem falls back to the file
                print(f"MongoDB unavailable, using the local file: {e}")
        if self.mongo is not None:
            # Not unique: an old duplicate must never stop the server from starting.
            for coll, keys in (("players", [("name", 1)]), ("sessions", [("id", 1)]),
                               ("sessions", [("player", 1), ("ts", -1)]), ("settings", [("key", 1)])):
                try:
                    self.mongo[coll].create_index(keys)
                except Exception as e:  # noqa: BLE001 - a missing index only makes queries slower
                    print(f"MongoDB index on {coll} {keys} skipped: {e}")
        self.lock = threading.Lock()
        self.file = DATA / "store.json"

    @property
    def backend(self) -> str:
        return "mongodb" if self.mongo is not None else "file"

    def ping(self) -> str | None:
        """None when MongoDB answers, else the reason (also when MONGODB_URI is set but the file is in use)."""
        if self.mongo is None:
            return "MONGODB_URI set but the connection failed at startup" if os.environ.get("MONGODB_URI") else "no MONGODB_URI"
        try:
            self.mongo.command("ping")
            return None
        except Exception as e:  # noqa: BLE001
            return f"MongoDB ping failed ({type(e).__name__})"

    def import_file(self, path: Path) -> dict[str, int]:
        """Copy a local store.json into MongoDB: a player already in MongoDB is kept, sessions are added once by id."""
        if self.mongo is None:
            raise RuntimeError("MongoDB is not connected: set MONGODB_URI")
        db = json.loads(path.read_text())
        for name, doc in db.get("players", {}).items():
            self.mongo.players.update_one({"name": name}, {"$setOnInsert": {**doc, "name": name}}, upsert=True)
        added = 0
        for doc in db.get("sessions", []):
            if doc.get("id") and self.mongo.sessions.update_one(
                    {"id": doc["id"]}, {"$setOnInsert": doc}, upsert=True).upserted_id is not None:
                added += 1
        for key, value in db.get("settings", {}).items():
            self.mongo.settings.update_one({"key": key}, {"$setOnInsert": {"key": key, **value}}, upsert=True)
        return {"players": len(db.get("players", {})), "sessions": added}

    # ---------- file backend ----------
    def _load(self) -> dict[str, Any]:
        if not self.file.exists():
            return {"players": {}, "sessions": []}
        try:
            return json.loads(self.file.read_text())
        except json.JSONDecodeError:
            return {"players": {}, "sessions": []}

    def _save(self, db: dict[str, Any]) -> None:
        DATA.mkdir(exist_ok=True)
        tmp = self.file.with_suffix(".tmp")   # write then rename: a crash mid-write never leaves half a file
        tmp.write_text(json.dumps(db, indent=1))
        os.replace(tmp, self.file)

    # ---------- settings (one document per key, for the shoe calibration and the like) ----------
    def setting(self, key: str) -> dict[str, Any] | None:
        if self.mongo is not None:
            doc = self.mongo.settings.find_one({"key": key}, {"_id": 0, "key": 0})
            return doc or None
        with self.lock:
            return self._load().get("settings", {}).get(key)

    def set_setting(self, key: str, value: dict[str, Any]) -> None:
        if self.mongo is not None:
            self.mongo.settings.update_one({"key": key}, {"$set": {"key": key, **value}}, upsert=True)
            return
        with self.lock:
            db = self._load()
            db.setdefault("settings", {})[key] = value
            self._save(db)

    # ---------- players ----------
    def player(self, name: str) -> dict[str, Any]:
        name = name.strip()[:40] or "Player"
        if self.mongo is not None:
            doc = self.mongo.players.find_one({"name": name}, {"_id": 0})
        else:
            with self.lock:
                doc = self._load()["players"].get(name)
        doc = doc or {}
        return {"name": name, "limits": clean_limits(doc.get("limits", {})), "rewards": doc.get("rewards", []),
                "assistantId": doc.get("assistantId"), "notes": doc.get("notes", ""),
                "perceptronConsent": bool(doc.get("perceptronConsent", False)),
                "aiReviewConsent": bool(doc.get("aiReviewConsent", False)),
                "perceptronReports": doc.get("perceptronReports", []), "gait": doc.get("gait")}

    def update_player(self, name: str, **fields: Any) -> dict[str, Any]:
        """Set only the given fields, so two writers (the panel and the memory task) never overwrite each other."""
        name = name.strip()[:40] or "Player"
        changes = {k: v for k, v in fields.items() if v is not None}
        if "limits" in changes:
            changes["limits"] = clean_limits(changes["limits"])
        if self.mongo is not None:
            self.mongo.players.update_one({"name": name}, {"$set": {"name": name, **changes}}, upsert=True)
        else:
            with self.lock:
                db = self._load()
                doc = db["players"].get(name, {"name": name})
                doc.update(changes)
                db["players"][name] = doc
                self._save(db)
        return self.player(name)

    def players(self) -> list[str]:
        if self.mongo is not None:
            return sorted(d["name"] for d in self.mongo.players.find({}, {"name": 1}))
        with self.lock:
            return sorted(self._load()["players"].keys())

    # ---------- sessions ----------
    def add_session(self, name: str, summary: dict[str, Any], verified: bool, note: str = "",
                    rewarded: bool = False, session_id: str | None = None, **extra: Any) -> dict[str, Any]:
        doc = {"id": session_id or uuid.uuid4().hex, "player": name, "summary": summary, "verified": verified,
               "note": note, "rewarded": rewarded, "ts": time.time(), **extra}
        if self.mongo is not None:
            self.mongo.sessions.insert_one(dict(doc))
        else:
            with self.lock:
                db = self._load()
                db["sessions"].append(doc)
                self._save(db)
        return doc

    def session(self, session_id: str) -> dict[str, Any] | None:
        if self.mongo is not None:
            return self.mongo.sessions.find_one({"id": session_id}, {"_id": 0})
        with self.lock:
            return next((r for r in self._load()["sessions"] if r.get("id") == session_id), None)

    def update_session(self, session_id: str, **fields: Any) -> dict[str, Any] | None:
        """Set only the given fields on one session (the gait summary and its review arrive after the save)."""
        if self.mongo is not None:
            self.mongo.sessions.update_one({"id": session_id}, {"$set": fields})
            return self.session(session_id)
        with self.lock:
            db = self._load()
            doc = next((r for r in db["sessions"] if r.get("id") == session_id), None)
            if doc is None:
                return None
            doc.update(fields)
            self._save(db)
            return doc

    def sessions(self, name: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        if self.mongo is not None:
            q = {"player": name} if name else {}
            return list(self.mongo.sessions.find(q, {"_id": 0}).sort("ts", -1).limit(limit))
        with self.lock:
            rows = self._load()["sessions"]
        rows = [r for r in rows if not name or r["player"] == name]
        return sorted(rows, key=lambda r: r["ts"], reverse=True)[:limit]


if __name__ == "__main__":   # python -m server.store [data/store.json]: copy the offline file into MongoDB Atlas
    import sys

    from server.app import load_env

    load_env()
    print(Store().import_file(Path(sys.argv[1]) if len(sys.argv) > 1 else DATA / "store.json"))
