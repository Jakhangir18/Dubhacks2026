# Devpost draft: Zombie Walk Home

Paste into the Devpost draft before **Sat 22:30**. Add every teammate as a contributor (with their Discord) and declare the tracks below. Replace the bracketed parts.

## Name and tagline

**Zombie Walk Home** — an AI therapist that turns movement exercises into a projected game kids actually want to play.

## Tracks to declare

- Title track: **Community Kitchen** (accessibility, healthcare, community support).
- Sponsored side tracks (up to three): **Perceptron**, **SideShift**, **CloudForce: Most Viral** (VEYZL if the CloudForce brief does not fit).
- MLH: **Best Use of Gemini API**, **Best Use of Backboard**, **Best Use of MongoDB Atlas** (only those whose keys are live in the demo), Commit Fellowship (fill its form).

## Inspiration

Children and teens who are given movement exercises do most of them at home, and home programmes fall apart: across 13 studies, 34% to 79% of parents of children with cerebral palsy did not keep up the home exercise programme. About 1 in 345 US children has cerebral palsy and 5% to 6% of school-aged children have developmental coordination disorder. Games help when they are part of therapy, but an unsupervised home stepping game failed in a randomised trial in adults with Parkinson's disease. The missing piece is a therapist watching every step. We built that therapist, and hid it inside a game.

## What it does

A projector paints a garden on the floor. You are a zombie walking home.

1. **Walk home:** keep a steady pace; the game measures your normal step height.
2. **Stomp the flowers:** high-step onto the glowing flower in your foot's lane.
3. **Seed storm:** lift the foot a seed is aiming at.
4. **Home:** a report card, a note from the coach, and a reward from your family.

A phone camera watches your feet. Stomps and dodges count only for a timed lift above your own normal step, and only while you are really walking. The AI coach speaks one short cue at a time and adapts the game, but only inside limits your therapist sets in a panel. Perceptron Mk1.5 double-checks the camera: it watches a few leg-only frames around each stomp and dodge, answers in a fixed JSON shape, and the agreement rate goes into the report. The coach remembers every session (Backboard) and writes a note for parents and the therapist (Gemini). Every walk ends with a shareable game clip and a QR code, and a completed session unlocks a reward the parents chose.

## How we built it

- **Game:** Phaser 3 in the browser, own art drawn in code, high contrast for a dim projector; four-corner calibration warps the game onto the mat.
- **Camera:** MediaPipe Pose in the browser on a phone used as a webcam; our step detector turns landmarks into lift and strike events (per-foot ground level, clearance at the lowest point of the foot, scale from the player's height).
- **Perceptron:** after each flower or seed, up to eight timestamped frames of the lower legs (cropped at the knees, no face) go to `perceptron-mk1.5` as `video_frames` with a strict JSON schema; a second schema checks form every 10 s. Only with the parent's or therapist's consent.
- **Projection zone:** the player marks the walking zone's four corners on the floor at the start (front corners first); the game is warped into that trapezoid and an animated garden fills the rest of the projection.
- **Raspberry Pi path:** any camera computer can post the same foot events to the laptop server (HTTP or WebSocket).
- **Server:** FastAPI relays events, runs the coach, stores players and sessions (MongoDB Atlas), keeps long-term memory per player (Backboard), calls Perceptron, and serves the clip and QR code.
- **Safety and honesty:** limits clamp everything the model proposes; wellness wording only (coordination, balance, mobility); children play on the floor, never on a treadmill; camera video never leaves the device.
- **Tests:** [N] automated tests (game rules, step detector, server), end-to-end runs in headless Chromium.

## Challenges

- Walking in place lands every step in its own lane, so plain walking scored everything. We switched to timed high steps measured against each player's own normal step.
- A single camera cannot measure millimetre toe clearance, so we measure what it can (centimetre lifts, step timing) and say so.
- A 150-lumen projector in a lit hall: high-contrast art on a white mat.

## Accomplishments

- [fill in after testing: the first time the projected flower splashed under a real foot]
- A therapist's limits that the AI cannot exceed.

## What we learned

[fill in]

## What's next

Clinician pilots, Perceptron pointing at the projected target to confirm the foot landed on it, more exercises, and a real payment for the parents' rewards.

## Built with

phaser, mediapipe, perceptron, javascript, python, fastapi, gemini-api, backboard, mongodb-atlas, projector

## Links

- Code: https://github.com/Jakhangir18/Dubhacks2026
- Demo video: [link]
