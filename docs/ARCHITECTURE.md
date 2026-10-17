# Architecture

Status: draft for the team, Sat Oct 17. Decisions below follow [research/hardware.md](research/hardware.md).

## Decisions from the hardware brief

- **Pose runs on the laptop**, in the browser with MediaPipe Pose: measured about 81 to 92 fps on a laptop versus about 10 fps on a Raspberry Pi 4 and 17 fps on a Pi 5. The Pi is not needed for the camera.
- **Camera:** a USB webcam on the laptop, side view; 30 fps is enough, 60 fps is better.
- **Projector:** standard throw (throw ratio about 1.25 to 1.7) with at least 3,000 lumens, on a light stand with a boom; not a short-throw and not a 300 to 500 lumen mini. Tilting a lamp projector steeply down is undocumented and an Epson manual warns about tilt over 3 degrees: prefer an LED projector rated for any angle, or keep the projector level and use a 45-degree mirror.
- **Sound module (KY-037/038):** skip it; it is only a threshold comparator. Optional: one piezo under the deck on the ESP32 as a "foot landed" trigger; left and right come from the camera.
- The sections below still show the Pi and the sensors as options; the decisions above take precedence.

## Physical layout

```
            [ projector on a stand with a boom, pointing down ]
                              |
                              v
   [ support rail ]   ===== walking pad belt =====   [ side camera on the Raspberry Pi, at foot height ]
                       piezo/sound sensor under left edge, right edge  ->  ESP32
   [ TV or wall in front: screen mode until the projector arrives ]
   [ laptop: game in Chrome + local server ]   [ stop button ]
```

- **Walking pad:** speed set by its handheld remote; the software never controls the motor directly.
- **Projector:** above the pad, image covering the belt (about 40-50 cm by 100-120 cm). Four-corner calibration in the browser maps the game onto the pad outline.
- **Camera on the Raspberry Pi:** side view at foot height, both lower legs in frame. Side view measures step timing and step length far better than a front view.
- **Footstep sensors (optional):** a piezo disc or the sound module under each side of the deck gives exact heel-strike timing and which side struck; the camera gives lift height. **Decision:** keep or drop after a 30-minute test.
- **Belt speed:** two or three bright tape stripes across the belt; the camera times them passing a fixed box.
- **ESP32 (optional):** a big physical stop button; a servo on the remote only if time allows.

## Software components

| Component | Runs on | Job |
|---|---|---|
| Capture and pose | Raspberry Pi or laptop (**Decision**) | camera frames, pose landmarks (heel, toe, ankle, knee per side) |
| Gait events | same place as pose | turns landmarks into events: heel strike, swing peak with lift height |
| Belt meter | laptop browser | stripe crossings to belt speed; manual km/h fallback |
| Game engine | laptop browser | plants, lanes, scrolling at belt speed, hit judging, scoring, anti-cheat |
| Renderer | laptop browser | screen mode (road view) and projector mode (top-down, warped to the pad) |
| Coach | local server + Gemini API | summary in, one spoken cue and next-wave parameters out; rule-based fallback |
| Voice | laptop browser | speech recognition for answers, speech synthesis for cues |
| League and Visa | local server | sessions, weekly table, sponsor pool payout through the Visa sandbox (mock offline) |

**Decision, where pose runs:** either the Pi runs pose and sends only events (light network, Pi may be slow), or the Pi streams video and the laptop runs pose in the browser (faster model, more bandwidth). Pick after the fps numbers in the hardware brief.

## Data flow

```
camera -> pose -> gait events --\
piezo  -> ESP32 -> strike events -+--> game engine --> renderer --> projector / TV
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
