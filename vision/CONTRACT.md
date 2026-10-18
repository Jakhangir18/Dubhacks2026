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

## Test without a camera

```bash
python3 vision/pi_sender.py --server http://<laptop-ip>:8000 --demo
```

sends a steady walk with a high step now and then; the game should move and score.
