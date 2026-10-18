# Side camera + Perceptron: design for Sat night

gait.py measures; Perceptron looks without seeing the numbers; code compares the two. Facts below were checked against docs.perceptron.inc on 2026-10-18 (Mk1.5 pages unless marked Mk1).

## What Perceptron can and cannot do here

- `perceptron-mk1.5` (released 2026-09-25, changelog) takes text, images, video and audio and returns text, points, boxes, polygons, clips and tracks; context 36,864 tokens; $0.15 / $1.50 per million input / output tokens.
- No pose, keypoint or health product. Point annotations will put a named point on "knee" or "heel" one frame at a time, with no accuracy spec: a check on gait.py, never a replacement.
- "2 fps video sampling" is documented only for Mk1. For Mk1.5 the docs say "Frame sampling can miss brief events". So we choose the frames ourselves with `video_frames` (at least 2 frames, same size, integer `timestamp_ms`; each frame is one of the 256 media units per request).
- Keep a JSON-schema answer and annotation markup in separate calls ("Keep native annotation markup and a constrained JSON report as distinct output contracts"); Multilook does not support `response_format`; tools cannot be combined with a schema.
- Chat requests have a 120 s budget, Multilook 300 s; 300 and 150 requests per minute. No latency figure is published: measure it.

## Frame selection (gait.py)

- New pure function `stride_events(rows, side, direction)` per stride:
  - IC (landing): the `find_strikes` peak of `direction*(ankle_x - hip_x)`.
  - TO (push-off): the trough of the same signal.
  - PF (deepest knee bend): the minimum knee angle in (TO, next IC), with its angle.
  - MSw (mid-swing): first forward zero crossing of the signal after PF (fallback: midpoint of PF and next IC).
  - Property test: IC < TO < PF < MSw < next IC for every stride, and PF's angle is the minimum in [TO, next IC].
- Near side = "R" when walking towards the right of the image, else "L" (unmirrored camera; checked on the recordings in `out/`, where the near leg has the higher visibility and the smaller world z). `server/gait_review.near_side()` prefers the leg MediaPipe saw confidently more often (`seen_frames` in the gait.py summary), which also holds for a mirrored camera.
- Steady window: at least 4 near strides with stride-time CV under 15 % (a pad has no turns, so no model call is needed to find it).
- Strides: A near-leg median knee bend, B near-leg least bend, C far-leg median, D far-leg least bend.
- Frames: a pair of adjacent frames (about 33 ms apart) at each event: 4 strides x 4 events x 2 = 32 frames. Sort by time, drop duplicates.
- Crop: one fixed square box for the whole review, from hip height down to the lowest toe, both legs, 10 % padding, resized to 512 x 512 JPEG q85 (about 40 KB). Hips down, never a face.

## Pipeline

- The side-camera laptop runs gait.py, keeps a RAM-only ring buffer of about 20 s of frames with landmarks, picks keyframes and crops. Raw video never leaves it; full-body mp4 recording becomes opt-in.
- `gait.py --server URL --player NAME`: post `/api/gait` every 15 s (already in `vision/CONTRACT.md`) and `/api/gait/review` every 30 s from a background thread. `--video walk.mp4` runs the same path for the demo fallback.
- New `POST /api/gait/review` (side laptop to server):

```json
{"player": "Mia", "direction": "right", "nearSide": "L", "fps": 30,
 "window": {"t0": 12.0, "t1": 32.0, "summary": {"...": "analyze() on the window"}},
 "strides": [{"id": "A", "side": "L", "near": true, "strideS": 1.02, "peakKneeDeg": 121.4,
              "events": {"landing": [12034, 12067], "pushOff": [12600, 12633],
                         "deepestBend": [12733, 12767], "midSwing": [12867, 12900]}}],
 "frames": [{"tsMs": 12034, "url": "data:image/jpeg;base64,...",
             "mp": {"hip": [560, 40], "knee": [612, 388], "ankle": [640, 702], "heel": [611, 760], "toe": [702, 768]}}],
 "crop": {"x": 412, "y": 300, "size": 640, "out": 512}}
```

- Server: consent gate (no consent, no send, no storage); `clean_frames(frames, cap=32)`; `perceive.review_gait(...)`; store the compact result in its own player field `gaitReview` (not `gait`, which `/api/gait` overwrites every 15 s, and not through `clean_gait`, which cuts nesting at depth 3) and the latest 3 full reviews with their 16 evidence frames in `gaitReviews`. Add both to the `store.player()` whitelist. `fresh_gait()` merges the review in, `session()` marks it used, `get_player` hides `gaitReviews` unless `reports=true`.

## Call 1: findings (chat completions, blind, strict schema)

- System: "You review side-view walking frames for a movement game used by children and teens. The frames show the body from the hips down only. Describe only what is visible, because a therapist will compare your answer with a separate camera measurement. Answer 'unclear' when the leg or foot is hidden, blurred or out of frame; an honest 'unclear' is more useful than a guess. Use everyday words about walking and do not name conditions or give medical advice."
- User: the `video_frames` part, then text naming each step's event timestamps (Step A near leg: landing 12034,12067 ms; push-off ...; Step C far leg ...) and asking per step for `legVisible`, `landing`, `kneeBend`, `toeClearance`, plus `holdingSupport`, `framesUsable`, `note`.
- Schema (build it in code; inline the step object if `$ref` is rejected in strict mode):
  - `framesUsable`: yes | partly | no; `holdingSupport`: yes | no | unclear; `note`: string up to 160.
  - per step A-D: `legVisible` yes | partly | no; `landing` heel first | whole foot | toes first | unclear; `kneeBend` clearly bent | a little bent | nearly straight | unclear; `toeClearance` clear of the floor | close to the floor | touching or dragging | unclear.
- `reasoning_effort` low, `max_completion_tokens` 2048, `temperature` 0; parse only when `finish_reason == "stop"`.
- The model never sees the gait.py numbers, so agreement means something.

## Call 2: evidence (Multilook, point annotations)

- One prompt per keyframe (first frame of each event pair: 16 prompts, the Multilook maximum), each carrying its own image; `vision_config.annotation_format` "point", `reasoning_effort` none, `max_completion_tokens` 400.
- Prompt: "Point to the near leg's knee, ankle, heel and toe tip, with the mentions 'knee', 'ankle', 'heel', 'toe'. If that foot touches the floor, add one point with the mention 'floor contact'." (far-leg prompts say "far leg").
- New `parse_point_tags(content)` next to the existing parsers, 0-1000 range check.

## Agreement, in code

- Knee: bin gait.py's peak bend per stride (interior angle, 180 = straight): up to 135 "clearly bent", 135-160 "a little bent", above 160 "nearly straight"; compare with `kneeBend`. These are comparison bands, not clinical thresholds.
- Landmarks: per keyframe and part, distance between Perceptron's point and the MediaPipe point on the 0-1000 grid; report median and the count within 40 units.
- If the far leg is mostly hidden (`legVisible` no for C and D, or far-leg distances above 80), mark gait.py's left-right asymmetry as low confidence.

## Therapist panel

- "Side camera review" card in the Perceptron lab: one row per stride event ("Near (left) knee, deepest bend · 121° (gait.py) | Perceptron: clearly bent ✓ | 12.73 s ▸"); ▸ draws the keyframe with MediaPipe dots (green) and Perceptron dots (yellow) joined by a line; footer with landmark agreement, low-confidence flags and "Wellness observations, not a medical assessment."
- `therapist.describe()` gets one compact line, for example "Side camera + Perceptron look (near leg): knee bend agrees 2/2, landing heel first 2/2, toes clear 2/2; far leg hidden 3/4, so the asymmetry number is uncertain."

## Build order tonight

| # | Work | Owner | Hours |
|---|---|---|---|
| 0 | Fixture `tests/fixtures/gait_review_payload.json` from a recorded walk, so nobody waits | Claude | 0.5 |
| 1 | `stride_events` + property test, `review_payload` (window, strides A-D, 32 frames, crop, landmarks to 0-1000) | Feet AI | 3 |
| 2 | `perceive.review_gait` call 1, schema in code, `finish_reason` check, knee agreement; mocked-httpx tests | Therapist AI | 2 |
| 3 | `POST /api/gait/review`, store fields, `fresh_gait` merge, mark used, CONTRACT.md, tests | Claude | 1.5 |
| 4 | Panel card: number + frame + both sets of dots | Claude | 2 |
| 5 | Call 2 Multilook evidence, `parse_point_tags`, landmark distances | Therapist AI | 1.5 |
| 6 | gait.py `--server --player`, background review thread, `--video` mode | Feet AI | 1 |
| 7 | Demo fallback: one recorded 40 s side walk through the pipeline, cached and labelled "recorded walk" | Claude | 0.5 |
| 8 | Prompt check on the pad: normal, toes first, scuffing one foot, stiff knee, holding the rail, legs half out of frame; each twice and with two wordings; report the range | Owner + Feet AI | 0.5 |
| 9 | `describe()` review line with a rules-fallback test | Therapist AI | 0.5-1 |
| 10 | Optional: `heel_y`, `toe_y` in rows for a landing cross-check | Feet AI | 0.5 |

Cut in this order if short: 10, then 5, then 6 (one review at the end of the walk).

## Risks

- gait.py's `find_strikes` needs the foot to travel forward relative to the hip: fine on the moving pad, noise when stepping in place on the floor. Demo on the pad; an `--in-place` mode on heel height is about 1 h more.
- Latency: the review runs off the game path, in parallel, 60 s client timeout; the panel shows gait.py numbers at once and "Perceptron is looking…" until done; fall back to 16 frames, no reasoning, or skip call 2; the cached recorded walk covers the live demo.
- Our own limiter (`perceive.allow_call`, 40 per minute shared with the step checks) can starve reviews: give reviews their own small budget.
- Accuracy: blurred swing feet, a hidden far leg, MediaPipe L/R swaps. "unclear" is allowed everywhere, the model never sees our numbers, disagreements are shown, no millimetre claims.
- Privacy: hips-down crop, consent gate on the server, only 16 evidence frames from the last 3 reviews kept and dropped when consent is turned off, frames sent inline (nothing in the Perceptron Files API), gait.py's full-body mp4 recording becomes opt-in.

## Devpost paragraph

Perceptron Mk1.5 is the second pair of eyes on our side camera, not its ruler. MediaPipe in gait.py measures every frame at 30 fps: step timing, cadence, and how far each knee bends on every stride. From those measurements we pick the exact moments that matter (landing, push-off, deepest knee bend, mid-swing) and send just those hips-down frames, with their timestamps, to `perceptron-mk1.5` as `video_frames` with a strict JSON schema. Perceptron does not see our numbers. It says independently whether the foot lands heel-first or toes-first, whether the knee is clearly bent, whether the toes clear the floor, and whether the far leg is even visible. A second Multilook call points at the knee, heel and toe on each keyframe. The therapist panel shows every measurement next to Perceptron's look and the frame with both sets of points, so agreement, disagreement and "unclear" are all visible. When Perceptron reports the far leg as hidden, we label the left-right asymmetry number as uncertain instead of presenting it as fact. Frames leave the laptop only with the family's consent, never show a face, and every note uses wellness words; it is not a medical device.
