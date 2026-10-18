# Zombie Walk Home (Stride Defense)

**A projected walking game that turns the exercises a physical therapist assigns into play, with an AI therapist that coaches every walk and reviews it for the player, the parent and the therapist.**

DubHacks '26, University of Washington, Oct 17–18 2026.

## The problem

- About 1 in 345 US children has cerebral palsy (CDC), and 5% to 6% of school-aged children have developmental coordination disorder (CMAJ 2015). Many more children and teens get movement exercises after sports injuries.
- Therapy happens mostly at home, and home programmes fall apart: across 13 studies, 34% to 79.2% of parents of children with cerebral palsy did not keep up the home exercise programme (PLOS ONE 2024).
- Access is thin: in one US region only 14% of the physical therapy clinics that answered a survey took children with Medicaid-type insurance (JPOSNA 2024).
- Games help when they are part of therapy: active video games improved gross motor skills in children with developmental disabilities (12 trials, g = 0.833; the authors ask for caution).

Sources and more numbers: [docs/research/kids-evidence.md](docs/research/kids-evidence.md).

## How a session works

1. **Set up.** The therapist or a parent opens the panel, picks the player, sets safe limits (pace, flowers, rounds, session length) and chooses which AI features may be used.
2. **Walk and play.** The player walks on a walking pad while the game is projected in front of their feet: Gus the zombie has to get home before sunrise, and the player steps onto the flowers in time with the beat. Each round is a little faster, with golden flowers worth more.
3. **See the feet.** A camera above the belt finds each shoe, so the game knows where every foot lands. Perceptron can double-check each step the game scores.
4. **Measure the walk.** A phone at the side films the walk; MediaPipe measures knee bend, stride, step time and left–right balance while they play.
5. **Coach live.** Gemini puts a short tip on screen every 20 seconds and, in the rest between rounds, says out loud (in Gemini's voice) what went well and one thing to fix. It only changes difficulty inside the therapist's limits.
6. **Review.** After the walk, Gemini writes a review from the numbers: what went well, what to work on, suggested settings, and a note each for the player, the parent and the therapist. It opens on the results dashboard.
7. **Remember.** Backboard keeps a memory for each player, so the next session starts with last time's focus.

## Architecture

```
 PLAYER AREA                         GAME SERVER (server/, FastAPI)                 WHAT PEOPLE SEE
 ┌────────────────────┐   shoes      ┌──────────────────────────────┐   steps     ┌──────────────────────────┐
 │ overhead camera    │────────────▶ │ live event relay (WebSocket) │───────────▶ │ the game (web/index.html)│
 │ feet.py, YOLO-World│   pictures   │                              │             │ projected on the pad     │
 └────────────────────┘              │ sessions, players, limits    │             └──────────────────────────┘
 ┌────────────────────┐   pictures   │ AI therapist: Gemini         │  review     ┌──────────────────────────┐
 │ phone side camera  │────────────▶ │   coach, review, voice (TTS) │───────────▶ │ therapist & parent panel │
 │ web/phone.html     │              │ memory: Backboard            │             │ web/therapist.html       │
 └────────────────────┘              │ second look: Perceptron      │             │ results dashboard        │
          │ gait.py (MediaPipe)      │ storage: MongoDB Atlas       │             │ dashboard/ → /dashboard/ │
          └─── gait numbers ───────▶ │   or a local file            │             │ printable report         │
                                     └──────────────────────────────┘             └──────────────────────────┘
```

| Part | Where | What it does |
|---|---|---|
| The game | `web/index.html`, `web/game.js`, `web/logic.js` | Phaser game for the projector. Takes steps from the cameras (or the keyboard), judges each flower at the hit line, keeps score, speaks the coach's lines, saves the session. |
| Overhead camera | `feet.py` | Finds the shoes from above (YOLO-World, with coloured marks under the flowers and a bright-blob fallback for a dark room) and sends them, plus a small preview picture, to the server. |
| Side camera | `web/phone.html`, `gait.py` | The phone streams pictures to the server; `gait.py --http-frames` pulls them, runs MediaPipe Pose, follows each game session, and sends live and final gait numbers. A webcam or iPhone works too. |
| Game server | `server/app.py`, `server/api.py` | Serves every page, relays camera events to the game, stores players, limits and sessions, and runs the AI parts below. |
| AI therapist | `server/therapist.py`, `server/gait_review.py`, `server/gemini.py` | Live coaching cues and rest-time coaching, the session note, the reward pick, and the full gait review. Every claim in a review must cite a measured number; medical terms are dropped; suggestions stay within the therapist's limits; fixed rules answer when Gemini cannot. |
| Coach's voice | `server/tts.py` | Gemini text-to-speech, cached per line; the browser's own voice is the fallback. |
| Memory | `server/therapist.py` | One Backboard assistant per player: what happened last time and what to work on. |
| Second look | `server/perceive.py`, `web/perceive.js` | Perceptron Mk1.5 checks camera pictures of the feet and lower legs: did the foot really land on the flower, are the steps steady, and a short report on the walk. |
| Storage | `server/store.py` | MongoDB Atlas when `MONGODB_URI` is set, otherwise `data/store.json`, so the demo also runs offline. |
| Therapist & parent panel | `web/therapist.html` | Both cameras live, the live numbers, the coach's latest line, the latest walk's review, past sessions, and the settings and consent switches. |
| Results dashboard | `dashboard/` (React, Vite) | Each walk with its full review and the change since the last session. Served by the game server at `/dashboard/` once built; the panel embeds it. |
| Printable report | `web/report.html` | The same review on one page, for printing or sharing. |
| Camera window | `web/camera.html` | Shoe calibration (click the projected corners in the camera picture) and the event log, for the laptop screen. |
| Family app prototype | `src/` (Next.js) | A design prototype of a family-facing app: tonight's walk, progress, and Maya the AI therapist, with Higgsfield art and `motion` animations. It runs on its own sample data in the browser and is not yet connected to the game server. |

Interfaces between the parts (events, sessions, the gait review): [vision/CONTRACT.md](vision/CONTRACT.md).

## Tracks

**Title track: Community Kitchen.** Home therapy that children actually want to do, with therapist-set limits the AI cannot exceed, a report for parents and therapists after every walk, and low-cost hardware (a small projector, a cardboard booth, a phone as the side camera).

| Track | What we built |
|---|---|
| **MLH: Best Use of Gemini API** | The coach's thinking and voice: a tip every 20 seconds, coaching between rounds, a review after every walk written from the gait numbers, notes for each reader, and the coach speaking in Gemini's voice. Gemini gets numbers only, with the family's consent, and every point it makes must be backed by a measurement. |
| **MLH: Best Use of Backboard** | A personal memory for each player. After each walk it stores how it went and what to work on; the next session opens with that focus, across sessions and devices. |
| **Perceptron** | A second pair of eyes: Perceptron checks the steps the game scores ("did the foot really land on the flower?"), watches that the steps stay steady, and sums up each walk. Its agreement with the game shows on the Home screen and in the panel. It sees only pictures of the feet and lower legs, never a face, and only with consent. |

Also in the code: MongoDB Atlas storage (optional) and a Visa reward checkout that is a labelled mock. More on each sponsor: [docs/SPONSORS.md](docs/SPONSORS.md) (written on day one; the table above is current).

## Run it

```bash
python3 -m venv .venv && .venv/bin/pip install -r server/requirements.txt -r requirements.txt
.venv/bin/uvicorn server.app:app --host 0.0.0.0 --port 8000          # 1. the game server
(cd dashboard && npm install && npm run build)                        # 2. the results dashboard, once
.venv/bin/python feet.py --server http://localhost:8000 --camera-name <belt camera>     # 3. overhead camera
# 4. side camera: open http://<server>:8000/phone.html on a phone at the side of the pad, then
.venv/bin/python gait.py --server http://localhost:8000 --http-frames http://localhost:8000 --no-preview
```

5. Open `http://localhost:8000/therapist.html`, pick or create the player, set limits and consent, press **Play as this player**.
6. In the game tab: mark the walking zone the first time (drag the four corners), press **F** for fullscreen, and walk to start.

Without cameras, `?demo=1` gives a short game and the keys play it: **A** / **D** small steps, **Q** / **E** high steps, **Space** pause, **R** play again, **M** voice, **P** reopen the last review, **V** the game's own camera, **O** the camera window, **Z** the walking zone, **K** all keys. More in [web/README.md](web/README.md); the full one-Mac setup is in [docs/GAIT_REVIEW.md](docs/GAIT_REVIEW.md).

### Settings (`.env` at the repo root)

| Variable | What it turns on |
|---|---|
| `GEMINI_API_KEY` | the coach, the review and the voice (fixed rules and the browser voice without it) |
| `GEMINI_REVIEW_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_TTS_VOICE` | pin the review model; choose the voice model and voice (default `gemini-3.8-flash-tts`, Sulafat) |
| `BACKBOARD_API_KEY` | the coach's memory per player |
| `PERCEPTRON_API_KEY` | Perceptron's second look |
| `MONGODB_URI` | MongoDB Atlas storage (a local file without it) |

The panel's **Check integrations** button makes a real call to each service and says which ones answer.

### Family app prototype

```bash
npm install && npm run dev        # http://127.0.0.1:4317
```

## Tests

```bash
.venv/bin/python -m pytest -q        # server: API, sessions, gait review, voice, Perceptron (offline, no keys)
npm test                             # game rules (web/logic.js)
(cd dashboard && npm test)           # results dashboard
.venv/bin/python test_gait.py        # gait analysis (needs MediaPipe and OpenCV)
```

## Repository map

| Path | What |
|---|---|
| `web/` | the game, the panel, the report, the camera window, the phone camera page |
| `server/` | the game server and the AI parts |
| `dashboard/` | results dashboard (React) |
| `src/` | family app prototype (Next.js) |
| `feet.py`, `gait.py` | overhead camera and side-camera gait analysis |
| `vision/` | the event contract and a sample sender (`pi_sender.py --demo`) |
| [docs/GAIT_REVIEW.md](docs/GAIT_REVIEW.md) | the AI therapist's review and how to run the whole setup |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md), [docs/FLOOR_LAYOUT.md](docs/FLOOR_LAYOUT.md) | mechanics and how the field fits the pad |
| [docs/VENUE_RIG.md](docs/VENUE_RIG.md), [docs/DETECTION_HANDOFF.md](docs/DETECTION_HANDOFF.md) | the projector booth and the camera setup |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | the day-one plan |
| [docs/research/](docs/research/) | research briefs in English and Russian (`*.ru.md`) |

## Safety, privacy and claims

- A tool for the therapist and the family: not a replacement for therapy and not a medical device. Wording stays inside the FDA general wellness terms (coordination, balance, strength, endurance, general mobility); no disease names or recovery claims in the app.
- On the walking pad: teens and adults within the pad's rated age (14+ on KingSmith manuals), with a person beside them, a low speed and a stop button.
- Gemini receives numbers only, and only with the family's consent; the player's name is taken out of anything spoken through Gemini's voice. Perceptron receives pictures of the feet and lower legs only, also only with consent. The server keeps no video; `gait.py`'s own recordings stay on the laptop. Under COPPA a child's video and movement patterns count as personal information.
