# Architecture

Status: draft for the team, Sat Oct 17. Decisions below follow [research/hardware.md](research/hardware.md).

## Decisions from the hardware brief

- **Projector bought:** Vankyo Leisure 3W Flip (about 150 lumens on the box, flip stand). It can point at the floor from a table, so no boom stand is needed, but it is dim: project onto a white mat or board, keep the image small (about 1 m), use a dark corner and high-contrast art (bright plants on black). Screen mode stays the fallback. Test visibility in the hall first.
- **Pose runs on the laptop**, in the browser with MediaPipe Pose: measured about 81 to 92 fps on a laptop versus about 10 fps on a Raspberry Pi 4 and 17 fps on a Pi 5. The Pi is not needed.
- **Camera:** a USB webcam or an iPhone as a webcam (Continuity Camera on a Mac, an app such as Camo on Windows); 30 fps is enough, 60 fps is better. Floor mode: camera low at the side of the play area. Walking-pad mode: side view at foot height.
- **No footstep sensors:** the camera does it.
## Physical layout

```
FLOOR MODE (children, core)
   [ projector on a table or shelf, flipped to point at the floor ]
                         |
                         v
          [ white mat ~1 m: projected garden, two lanes ]      [ camera low at the side ]
   [ laptop: game in Chrome + local server ]   [ parent / therapist screen ]

WALKING-PAD MODE (teens and adults 14+, supervised)
   [ screen or wall in front: the garden ]
   [ support rail ]  ===== walking pad belt =====  [ side camera at foot height ]
   [ person beside the pad ]  [ stop button ]
```

- **Walking pad:** speed set by its handheld remote; the software never controls the motor directly.
- **Projector:** floor mode only; four-corner calibration in the browser maps the game onto the mat.
- **Camera:** side view; both lower legs in frame. Side view measures step timing and step length far better than a front view.
- **Belt speed (walking-pad mode):** two or three bright tape stripes across the belt; the camera times them passing a fixed box; manual km/h fallback.
- **ESP32 (optional):** a big physical stop button for walking-pad mode.

## Software components

| Component | Runs on | Job |
|---|---|---|
| Capture and pose | laptop browser | camera frames, pose landmarks (heel, toe, ankle, knee per side) |
| Gait events | laptop browser | turns landmarks into events: heel strike, swing peak with lift height |
| Belt meter | laptop browser | stripe crossings to belt speed; manual km/h fallback |
| Game engine | laptop browser | plants, lanes, scrolling at belt speed, hit judging, scoring, anti-cheat |
| Renderer | laptop browser | floor mode (top-down, warped onto the mat) and screen mode (road view for the walking pad) |
| Coach | local server + Gemini API | summary in, one spoken cue and next-wave parameters out; rule-based fallback |
| Voice | laptop browser | speech recognition for answers, speech synthesis for cues |
| Rewards and Visa | local server | sessions, parent-funded rewards, family table, checkout through the Visa sandbox (mock offline) |

## Data flow

```
camera -> pose -> gait events --\
                                  +--> game engine --> renderer --> projector (floor) / screen (walking pad)
stripes -> belt meter -----------/        |
                                          +--> summary every 20-30 s --> coach --> cue (speech) + wave parameters
                                          +--> session at finish --> league --> payout (Visa sandbox)
```

## Interfaces

Gait event (JSON, one per message):

```json
{"t": 12.43, "foot": "L", "kind": "strike", "source": "camera"}
{"t": 12.10, "foot": "R", "kind": "lift", "liftCm": 14, "source": "camera"}
```

`t` is seconds on the sender's clock; the game re-stamps events on arrival with its own clock, so the two clocks never mix.

Server endpoints:

| Endpoint | In | Out |
|---|---|---|
| `POST /api/coach` | session summary, walking status | `{say, params}`; params clamped server-side |
| `POST /api/session` | player, summary, verified seconds | stored session |
| `GET /api/league` | none | weekly table, points relative to each player's baseline |
| `POST /api/payout` | none | AI host message and Visa receipts (sandbox or mock) |

## Rules that keep it honest

- A hit counts only inside a short window and each foot event is used once.
- Lift height is the lowest point of the foot, not the heel (normal walking raises the heel well above 10 cm).
- Points count only while walking is verified: both feet stepping and step length consistent with belt speed; a stopped belt reads as stopped within about 2 seconds.
- Sessions shorter than 60 seconds do not enter the league.

## Offline behaviour

Pose, game, belt meter and league run locally. Only the coach (Gemini) and Visa need the network; the coach falls back to rule-based cues and the payout to a labelled mock.
