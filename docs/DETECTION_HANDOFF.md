# Foot detection: handoff to the feet-AI owner

The game needs exactly two kinds of event per foot, on time. Everything else (timing windows, scoring, the therapist, Perceptron) is already built and waits for these events. This page says what to send, where, how the game judges it, how to place the camera, and how to know it works.

## What to send

Per step of each foot, in this order (full contract: `vision/CONTRACT.md`):

```json
{"foot": "L", "kind": "lift", "liftCm": 12.5, "source": "gait"}
{"foot": "L", "kind": "strike", "source": "gait"}
```

- `lift`: once per swing, when the foot has passed its highest point and starts coming down. `liftCm` = how high the **lowest point of the foot** rose above **that foot's own ground level** (the heel alone rises a lot in every normal step; do not use the heel).
- `strike`: when that foot lands.
- `foot` is the player's own left or right, not the image's.
- Send each event as soon as it happens. The game stamps events with its own clock on arrival, so latency must stay under about 100 ms. A detector that finds steps afterwards (peak picking over a finished recording, like `find_strikes` in `gait.py`) is too late for the game; it is fine for the therapist summary.

## Where to send

- HTTP: `POST https://vps-worker.taild24189.ts.net:8443/api/events` with `{"events": [ ... ]}` (the laptop must be on the team tailnet), or the same path on a local server.
- WebSocket (lower latency): `wss://vps-worker.taild24189.ts.net:8443/ws/events`, one event or a list per message.
- `vision/pi_sender.py` is a working sender to copy; `python3 vision/pi_sender.py --server <url> --demo` sends a fake walk.
- Reply `{"accepted": n, "listeners": n}`: `listeners` is the number of open game windows. 0 means the game is not connected.

## How the game judges the events (web/logic.js, unchanged)

- Act 1 (walking): the game learns each foot's **normal lift** from the `liftCm` values. Absolute accuracy matters less than consistency: a lift that is 20 % too high every time is fine.
- Act 2 (flowers): a stomp counts when a `lift` of that foot reaches **normal + 4 cm** within **0.6 s before to 0.35 s after** the flower reaches the line.
- Act 3 (seeds): a dodge counts when a `lift` reaches **normal + 7 cm** (and at least the therapist's lift target) in the same window.
- Pace: `strike` events of **both** feet must keep the cadence at or above the therapist's minimum (80 steps per minute by default), or the world stops.
- Each event is used once.

So the two things that matter most: a `lift` for every real step with a stable `liftCm`, and a clearly larger `liftCm` when the player lifts the knee high.

## Camera placement

- **Side view (best for lift height)**: at the side of the pad, perpendicular to the walking direction, 1.5 to 2.5 m away, lens at knee height, both whole lower legs and the pad surface in frame. On a pad the player stays in place, so the side view is stable. The far leg hides behind the near leg at times: use the near leg's ground level for both if needed, and check left and right are not swapped (a mirrored camera swaps them).
- **Front-side at about 45 degrees (best for keeping left and right apart)**: in front of the pad and to one side, knee height, both feet visible and separate. This is what the browser detector (`web/vision.js`) assumes.
- Keep the camera out of the projector beam and do not aim it into the lens; projected light on the legs is fine, but a bright floor behind the feet hurts contrast. Light the legs from the side if the room is dark.
- 30 fps or more; 60 fps is better for short lifts.

## What exists today

- `web/vision.js` (browser, MediaPipe Pose lite): per-foot ground level, lowest foot point, shank length for cm. The owner reports it reacts too fast and misses steps on the pad; the moving belt pulling the foot back is a likely cause in a front view.
- `gait.py` (side view, MediaPipe, full metrics): measures well but after the fact; it does not send live events yet.
- `/camera.html` on the laptop shows every event as it arrives (from any source), the lift graph and what the game does with it: use it to test.

## Done when

1. `listeners` is 1 and the camera window's event list shows a `lift` and a `strike` for every step, both feet, during 30 s of normal walking on the pad, with no extra events while standing still.
2. Normal steps give a steady `liftCm` (spread under about 3 cm); deliberate high steps give at least 6 cm more.
3. `/?demo=1` played on the pad: at least 4 of 5 deliberate high steps on a flower count, and no flower counts during normal walking.
4. Left and right are correct: lifting only the left foot lights the left lane.

## Plan B if live events are not ready by morning

Keep the browser detector for the game and run the side camera for the therapist summary only (`POST /api/gait`, see `vision/CONTRACT.md`), plus the Perceptron review in `docs/research/perceptron-gait-design.md`.
