# Team plan: Sat Oct 17 night to Sun Oct 18, 10:00

What works today, what to test now, the known problems, and who owns what. Interfaces between the parts are in `vision/CONTRACT.md`; keep to them and the parts fit without anyone waiting.

## What works today

- The game in the browser: three acts and Home, portrait field warped onto the marked zone (Z), sound, clip and QR.
- Foot events from the phone camera in the browser (MediaPipe, `web/vision.js`), the keyboard, or any sender to `/api/events`.
- Perceptron: step and form checks during play, and the Perceptron lab report at Home (live key on the demo server).
- Therapist panel (`/therapist.html`): limits, rewards, sessions, Perceptron consent and lab.
- Coach, notes and memory run on rule-based fallbacks until the Gemini, Backboard and MongoDB keys are in.

## Test on the pad now (about 15 minutes)

1. Open the game, press Z, mark the zone: front corners at the far end of the pad (towards the projector), back corners under your feet.
2. Press V, pick the iPhone camera, walk on the pad. Write down the live lift values for left and right at a normal step and at a high step.
3. Lift only the left foot high: the left pad must flash. If the right one flashes, the camera image is mirrored.
4. Play `?demo=1` to the end. Note every missed stomp, every stomp that counted without a high step, and every time the world stopped while you were walking.
5. In the therapist panel tick Perceptron consent, play again, check the Perceptron lab section.
6. Scan the QR at Home with a phone.

## Known problems

- The step detector is tuned on recordings, not on the real pad: thresholds need the values from test step 2.
- A moving belt pulls the feet backwards; seen from the front this can look like a lift. Watch for false stomps.
- The QR link points at the tailnet address, so a judge's phone without Tailscale cannot open the clip. Needs a public link (owner decides).
- Gemini, Backboard and MongoDB keys are missing on the demo server, so the MLH tracks are not live yet.
- The side-camera gait code (`gait.py`, `feet.py`) is not connected to the server yet.

## Who owns what

| Owner | Part | Done when |
|---|---|---|
| Feet AI (alcj3) | `gait.py` / `feet.py` side camera: send `lift` and `strike` events to `/api/events` and the gait summary to `/api/gait` (`vision/CONTRACT.md`). Measure how often it agrees with the browser detector on the same walk. | A walk on the pad with only the side camera moves and scores the game, and the saved session shows `sideCamera`. |
| Therapist AI | `server/therapist.py`: use `summary.sideCamera` (knee bend, stride times, asymmetry) and the Perceptron gait note in the note for the therapist; coach cues that name the weak side; plan from Backboard memory. Tests in `tests/test_api.py`. | With the Gemini key, a session note mentions the side-camera numbers; without keys the rule fallback still answers. |
| Owner | Hardware and room (dark room, projector, phone stand), the pad test above, keys in `.env`, Devpost text and demo video. | Devpost submitted, video recorded. |
| Claude (with Codex and Fable) | Game, integration, reviews, deploys, new art in the chosen style (concept E), detector tuning from the test values. | Every part merged to `main` and live on the demo server. |

Branch from `main`, open a PR, keep `pytest` and `npm test` green. Ask in the team chat before changing an endpoint in `vision/CONTRACT.md`.
