# Gait review: the AI therapist after each game

While the player walks the game on the pad, a side camera measures their gait with MediaPipe. When the game reaches Home, the server joins the side camera's numbers with the game's results and asks Gemini for a therapist-style review: what went well, findings with the numbers behind them, how the game and the gait relate, a focus and settings for next time, and notes for the player, the parent and the therapist. Contract: [vision/CONTRACT.md](../vision/CONTRACT.md), section "Session-linked gait review".

## Run it on one Mac

Two cameras: the one over the belt for `feet.py` (the game's shoes) and one at the side of the pad, at knee height, whole body in view, for `gait.py`.

```bash
.venv/bin/uvicorn server.app:app --host 0.0.0.0 --port 8000                       # 1. server (GEMINI_API_KEY in .env)
python feet.py --server http://localhost:8000 --camera-name <belt camera>           # 2. shoes for the game
python gait.py --server http://localhost:8000 --camera-name <side camera>           # 3. gait, follows every game
open http://localhost:8000/ http://localhost:8000/dashboard.html                    # 4. game and dashboard
```

- In the dashboard's Settings, pick the player and tick **AI gait review** (consent: only numbers, never video, names or the therapist's notes, go to Gemini). Without it the rule-based review still runs on the laptop, and no side-camera number reaches Gemini or Backboard.
- `gait.py` waits for a game to start, records it, posts a live summary every 15 s (the coach may use the near leg's knee bend and toe height for its cues), and posts the whole walk, cut by act, when the game saves the session. It keeps running for the next game; `--once` stops after one, `--player NAME` follows one player only.
- The home card shows "The coach is reviewing your walk…", then the player's feedback, spoken. The dashboard (`/dashboard.html?session=<id>`, or **P** in the game) shows the full review; **Apply suggested settings** puts the suggestion into the player's limits.

Both detectors on one Mac compete for it. The review's data quality says when the side camera lost frames ("skipped by a busy computer"); then run `gait.py --model lite`, close the camera window's pose steps, and keep only the windows you need open.

## Without a camera

```bash
python gait.py --video out/gait_<time>.mp4 --server http://localhost:8000 --session-id <id> [--offset 0]
```

replays a recorded side video as the walk of an already saved session (the id is in the panel or the `/api/session` reply).

## How the review stays honest

- `server/gait_review.py` builds every number the model may see, each with an id, unit, rough typical value and trust. The leg nearer the side camera is trusted; the far leg and left-right differences are marked low trust. Values a walking body cannot produce are withheld with the reason, and a walk with too few strides is "poor": then no gait findings at all, only the game and how to film a better walk.
- The model must cite ids for every strength and finding; items citing nothing measured are dropped, wording with medical terms is dropped, suggested settings are clamped to the therapist's ranges, and any field that fails is filled from the rule-based review, which answers alone without consent, a key, or a usable reply.
- The typical values are rough adult references on the ground; replace them with a cited table before a clinician relies on them. Wellness observations, not a medical assessment.
- Pin the model with `GEMINI_REVIEW_MODEL` (default `GEMINI_MODEL`); the review records which model wrote it, or why the rules did.
