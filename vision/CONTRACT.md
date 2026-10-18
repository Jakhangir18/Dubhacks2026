# Foot event contract

Any camera pipeline (the Raspberry Pi, a phone app, a second laptop) drives the game by sending foot events to the laptop server. The game does the rest: timing, scoring, the therapist.

## Events

```json
{"foot": "L", "kind": "lift", "liftCm": 12.5, "source": "pi"}
{"foot": "L", "kind": "strike", "source": "pi"}
```

| Field | Values | Meaning |
|---|---|---|
| `foot` | `L` or `R` | the player's left or right foot |
| `kind` | `lift` | the top of one swing; send once per step, when the foot starts coming down |
| | `strike` | the foot landed |
| `liftCm` | number, cm | for `lift`: height of the **lowest point of the foot** above that foot's own ground level (the heel alone rises far in a normal step; do not use it) |
| `source` | short text | who sent it, for debugging |

Send `lift` before the `strike` of the same step. The game stamps the time when an event arrives, so send each event as soon as it happens (latency under about 100 ms keeps the timing windows fair). The game measures each player's normal step height in act 1, so absolute accuracy matters less than consistency.

## Transport

- HTTP: `POST http://<laptop-ip>:8000/api/events` with body `{"events": [ ... ]}`. Reply: `{"accepted": n, "listeners": n}`; `listeners` is the number of open game pages.
- WebSocket: `ws://<laptop-ip>:8000/ws/events`, one event or a list per message (lower latency).

Run the server on the laptop with `--host 0.0.0.0` so the Pi can reach it, and find the laptop IP on the same Wi-Fi or phone hotspot.

## Side-camera gait summary

A side-view camera (for example `gait.py` on a second laptop or the Pi) can also send its gait summary, which the therapist note and the saved session use:

- `POST http://<laptop-ip>:8000/api/gait` with body `{"player": "Mia", "source": "side-camera", "summary": {...}}`.
- `player` must be the name the game and the therapist panel use; an unknown name gets 404.
- `summary` is `GaitTracker.summary()` from `gait.py` as JSON (its keys: `direction`, `strikes`, `stride`, `flexion`, `cadence`, `asymmetry`): numbers, short strings, booleans and small nested objects. Anything else is dropped. When `summary()` returns `None` (too little seen), the reply is `{"ok": false}`.
- Send it every 10 to 20 s while the player walks; the newest one wins. The next session saved at Home takes it once; a summary older than 30 minutes is ignored.
- The session saved at Home then carries it as `summary.sideCamera`, and `therapist.report()` receives it.
- Optional `"sessionId"`: the id of the game session being played (see below). It tells the server a side camera is recording that session, so the session saved at Home waits for its review. A post naming the active session needs no saved player.

## Session-linked gait review (the AI therapist after a game)

The game, `gait.py` and the server share one session id, so the side camera's whole walk lands on the session it belongs to and Gemini reviews the gait and the game together.

```
game Play starts --POST /api/session/start--> server: active session {id, player}
gait.py polls GET /api/session/active every 1 s: sees the id, marks the start; every 15 s POST /api/gait (with sessionId)
game Home --POST /api/session {id, summary}--> saved; gaitReview {status: waiting} when a side camera checked in
gait.py sees the active session end --GET /api/session/{id}--> act segments --POST /api/gait/final--> server
server, in the background: checked metrics + game results + history --Gemini (numbers only, with consent)--> session.gaitReview
home card, dashboard (/therapist.html?session=<id>) read GET /api/session/{id}
```

### Session endpoints

- `POST /api/session/start` with `{"player": "Mia"}`. Reply `{"id": "<hex>", "player": "Mia", "startedAt": <server epoch s>}`. It becomes the active session and replaces any earlier one.
- `GET /api/session/active`. Reply `{"id", "player", "startedAt", "serverTime"}`, or only `{"serverTime"}` when nothing is active. An active session expires 90 minutes after its start (a closed tab). `serverTime` lets a sender on another clock convert `startedAt` to its own.
- `POST /api/session` takes an optional `"id"`; the reply adds `"id"`. The active session is cleared only after the session is saved, so a sender that sees it end can fetch it at once.
- `GET /api/session/{id}`. Reply: the saved session `{"id", "player", "ts", "summary", "verified", "note", "rewarded", "gait"?, "gaitReview"?}`; 404 when unknown.

### What the game adds to the summary

All times are wall-clock seconds since the game sent `/api/session/start` (pauses included), so a side camera can cut its recording by act.

| Key | Value |
|---|---|
| `segments` | `[{"act": "walk" \| "garden" \| "storm", "round": 1, "startS": 0.0, "endS": 41.2}]`, in order |
| `pauses` | `[[startS, endS], ...]` |
| `wallSeconds` | seconds from the start to Home |
| `stepsByFoot` | `{"L": n, "R": n}` |
| `byLane` | `{"flower": {"L": [hit, n], "R": [hit, n]}, "seed": {"L": [hit, n], "R": [hit, n]}}` |
| `placementCm` | `{"L": cm, "R": cm}` or null: shoe mode, mean distance from the shoe's centre to the flower while it crossed |
| `timingS` | `{"L": s, "R": s}` or null: lift mode, mean time from the plant reaching the line to the lift that counted (+ = late) |
| `swingCm` | `{"L": cm, "R": cm}` or null: shoe mode, mean forward swing per step |
| `timeline` | `[{"t": game s, "cadence": n, "evenPct": n \| null, "act": "garden"}]`, every 15 game seconds, at most 120 |

### Final gait summary

`POST /api/gait/final` once the session has ended:

```json
{"sessionId": "<hex>", "source": "side-camera",
 "quality": {"fps": 29.8, "framesCaptured": 5400, "framesAnalysed": 5210, "framesSkipped": 190},
 "summary": {"...": "summarize() over the session window"},
 "perAct": {"walk": {"...": "summarize() of the walk segments, combined"}, "garden": {}, "storm": {}}}
```

- `summary` and each `perAct` entry are `gait.py` `summarize()` results (`perAct` without `curves` and `windows`); a missing act is left out.
- Reply 202 `{"status": "reviewing"}`; 404 for an unknown session. A second post replaces the first and is reviewed again.
- The server stores it as `session.gait` and writes `session.gaitReview`:

```json
{"status": "waiting | reviewing | done | failed", "source": "gemini | rules", "model": "<name> | null",
 "reason": "why the rules answered, or null",
 "dataQuality": {"level": "good | ok | poor", "issues": ["..."]},
 "metrics": [{"id": "knee_flexion_peak_L", "label": "Left knee bend in swing", "group": "gait | game | gait@walk | gait@garden | gait@storm",
              "side": "L | R | null", "value": 52.3, "unit": "deg", "typical": "about 60 deg | null", "trust": "good | low", "prev": 49.0}],
 "withheld": [{"id": "...", "reason": "..."}],
 "review": {"overview": "...", "strengths": [{"text": "...", "evidence": ["<metric id>"]}],
            "findings": [{"area": "...", "side": "L | R | both | none", "text": "...", "evidence": ["..."], "confidence": "high | medium | low"}],
            "gameVsGait": [{"text": "...", "evidence": ["..."]}], "actComparison": "...", "trend": "...",
            "focus": {"text": "...", "why": "...", "evidence": ["..."]},
            "nextSession": {"liftCm": 10, "spacingCm": 150, "minCadence": 80, "why": "..."},
            "cues": ["..."], "playerFeedback": "...", "parentNote": "...", "therapistNote": "...", "nextRecording": "..."},
 "ts": 1760000000.0}
```

- Only numbers go to Gemini, and only when the player's `aiReviewConsent` is on (therapist panel); otherwise the rule-based review answers. The same consent gates the live numbers in the coach's Gemini call, `summary.sideCamera` in the session note and the Backboard memory. The therapist's free-text notes never leave.
- The trusted leg is the one nearer the side camera: the leg MediaPipe saw confidently more often (`summary.seen_frames`), else the walking direction (walking to the right of the picture shows the right side). Every strength and finding cites metric ids; the server drops any that cite nothing it measured. `nextSession` is a suggestion inside the therapist's ranges; the panel applies it only when the therapist presses the button.

## Test without a camera

```bash
python3 vision/pi_sender.py --server http://<laptop-ip>:8000 --demo
```

sends a steady walk with a high step now and then; the game should move and score.
