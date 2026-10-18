# Devpost draft: Zombie Walk Home

Paste into the Devpost draft before **Sat 22:30**. Add every teammate as a contributor (with their Discord) and declare the tracks below. Replace the bracketed parts.

## Name and tagline

**Zombie Walk Home** — an AI therapist that turns movement exercises into a projected game kids actually want to play.

## Tracks to declare

- Title track: **Community Kitchen** (accessibility, healthcare, community support).
- Sponsored side tracks (up to three): **Perceptron**, **SideShift**, **CloudForce: Most Viral** (VEYZL if the CloudForce brief does not fit).
- MLH: **Best Use of Gemini API**, **Best Use of Backboard**, Commit Fellowship (fill its form).
- Do not declare **Best Use of MongoDB Atlas**: the Atlas store in `server/store.py` is ready, but the live demo runs on the local JSON file.

## Inspiration

Children and teens who are given movement exercises do most of them at home, and home programmes fall apart: across 13 studies, 34% to 79% of parents of children with cerebral palsy did not keep up the home exercise programme. About 1 in 345 US children has cerebral palsy and 5% to 6% of school-aged children have developmental coordination disorder. Games help when they are part of therapy, but an unsupervised home stepping game failed in a randomised trial in adults with Parkinson's disease. The missing piece is a therapist watching every step. We built that therapist, and hid it inside a game.

## What it does

A projector paints a garden on the floor. You are a zombie walking home.

1. **Walk home:** keep a steady pace; the game measures your normal step height.
2. **Stomp the flowers:** high-step onto the glowing flower in your foot's lane.
3. **Seed storm:** lift the foot a seed is aiming at.
4. **Home:** a report card, a note from the coach, and a reward from your family.

A camera above the belt finds your shoes (YOLO-World), and a phone at the side measures your knees and steps (MediaPipe Pose). Stomps and dodges count only for a timed lift above your own normal step, and only while you are really walking. The AI coach (Gemini) speaks one short cue at a time and adapts the game, but only inside limits your therapist sets in a panel. With the family's Perceptron consent, Perceptron Mk1.5 double-checks the camera: it looks at a few frames of the feet around each stomp and dodge, answers in a fixed JSON shape, and the agreement count shows on the Home screen and in the therapist panel. The coach remembers each player across sessions (Backboard) and, after the walk, writes a gait review with notes for the player, the parent and the therapist (Gemini). Maya, the AI therapist on the dashboard, answers questions about the walk and, with consent, looks at the side camera's annotated leg photos. With sharing switched on (`?share=1`), the walk ends with a short game clip and a QR code; a completed session picks a reward the parents chose, through a Visa checkout that is a labelled mock (no payment).

## How we built it

- **Game:** Phaser 3 in the browser, own art drawn in code, high contrast for a dim projector; four-corner calibration warps the game onto the mat.
- **Cameras:** an overhead camera runs YOLO-World locally (`feet.py`) to find the shoes, with a bright-blob fallback for a dark room. A phone at the side streams frames to the server, where `gait.py` runs MediaPipe Pose: knee bend, stride, step time, left-right balance, a live skeleton for the dashboard, and annotated photos of notable steps. A browser MediaPipe tracker (`web/vision.js`) turns landmarks into lift and strike events when the game uses its own camera.
- **Gemini:** the coach's cues and rest-time coaching, the gait review (every point must cite a measured number, suggestions clamped to the therapist's ranges), Maya's chat, and the coach's voice (Gemini text-to-speech). Side-camera numbers and photos go to Gemini only with the family's consent; rule-based answers and the browser voice cover a missing key.
- **Perceptron:** after each flower or seed, up to eight timestamped frames of the feet (the overhead view, or the game camera cropped at the knees; no face) go to `perceptron-mk1.5` as `video_frames` with a strict JSON schema; a second schema checks form every 10 s. Only with the parent's or therapist's consent.
- **Perceptron lab:** at the end of a walk, with consent, a leg-only sample (up to 32 frames) goes through four Perceptron capabilities at once: video clipping marks every high step on a timeline, object tracking follows both feet, the Detect API points at feet, flowers and seeds on a key frame, and Multilook writes a share caption, a gait note for the therapist and a safety line. The therapist panel draws all of it on the frame.
- **Projection zone:** the player marks the walking zone's four corners on the floor at the start (front corners first); the game is warped into that trapezoid and an animated garden fills the rest of the projection.
- **Raspberry Pi path:** any camera computer can post the same foot events to the laptop server (HTTP or WebSocket).
- **Server:** FastAPI relays events, runs the coach, stores players and sessions (a local JSON file in the demo; MongoDB Atlas when `MONGODB_URI` is set), keeps long-term memory per player (Backboard), calls Perceptron, serves the Next.js dashboard at `/app/`, and serves the clip and QR code when sharing is on. Tailscale Funnel gives the demo its public HTTPS link.
- **Safety and honesty:** limits clamp everything the model proposes; wellness wording only (coordination, balance, mobility); on the walking pad only teens and adults within the pad's rated age, with a person beside them; the server keeps no video, and pictures leave the laptop only with consent (leg-only frames to Perceptron, annotated leg photos to Gemini for Maya).
- **Tests:** 142 server tests (offline, no keys) and 46 game-rule and step-detector tests.

## Challenges

- Walking in place lands every step in its own lane, so plain walking scored everything. We switched to timed high steps measured against each player's own normal step.
- A single camera cannot measure millimetre toe clearance, so we measure what it can (centimetre lifts, step timing) and say so.
- A 150-lumen projector in a lit hall: high-contrast art on a white mat.

## Accomplishments

- The first time a projected flower splashed under a real foot on the walking pad.
- Perceptron agreeing with our own camera step by step, from frames that never show a face.
- A therapist's limits that the AI cannot exceed.

## What we learned

A single phone camera cannot measure millimetres, but it can measure centimetre lifts and timing, and that is enough for a game. Grading a step against the player's own normal step is fairer than any fixed threshold. A second model that disagrees with your detector is more useful than one that agrees, because it shows where the camera is unsure.

## What's next

Clinician pilots, Perceptron pointing at the projected target to confirm the foot landed on it, more exercises, and a real payment for the parents' rewards.

## Built with

phaser, mediapipe, yolo-world, perceptron, javascript, typescript, python, fastapi, next.js, gemini-api, backboard, tailscale, projector

## Links

- Code: https://github.com/Jakhangir18/Dubhacks2026
- Demo video: [link]
