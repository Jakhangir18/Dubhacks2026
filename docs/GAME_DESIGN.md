# Game design

The product is the therapist; the game is how the therapy is delivered. Every mechanic maps to a training method with published evidence (sources in [research/evidence.md](research/evidence.md)).

## The player and the world

- The player is a zombie walking through a garden. Walking slowly is the theme, not a failure.
- The belt has two lanes, one per foot. In projector mode the garden is painted onto the belt from above and scrolls at the measured belt speed, so plants look fixed to the belt. In screen mode (no projector yet) the same game is shown as a road on a TV in front of the treadmill, which is the set-up the V-TIME trial used.

## Mechanics mapped to therapy

| What the player sees | What it trains | What is measured |
|---|---|---|
| **Sunflower** in the left or right lane: step on it with that foot | step placement and step length (step training) | heel strike position and timing against the target |
| **Cactus** spits a seed at one foot: lift that foot high | obstacle clearance (V-TIME obstacles) | lift height of the lowest point of the foot, in cm |
| **Sign** with a question ("7 + 5?"): answer aloud | dual-task walking | speech recognition |
| **Ghost footprints** glowing one step ahead | where and when to step | none; this is the therapist showing the way |
| **Waves** get denser | progressive difficulty | coach sets spacing, obstacle rate and lift threshold |

Scoring: a hit is counted only inside a short time window around arrival (about 0.25 s for sunflowers), each foot event can be used once, and nothing counts unless walking is verified (both feet stepping, step length matching belt speed).

## The AI therapist

- **Every frame (code, not a model):** step events, step length, lift height per foot, left-right symmetry, hits and misses.
- **Every 20 to 30 seconds (language model):** reads a summary, speaks one cue of at most 12 words with an external focus ("clear the cactus" rather than "bend your knee"), then sets the next wave: target spacing, obstacle rate, lift threshold. It suggests speed changes; the person presses the remote.
- **Safety rules outside the model:** speed suggestions capped, automatic pause when steps stop or the walker drifts back, a stop button, a conservative start.
- **After the session:** a report for the family and the clinician: distance, hit rates, lift height per foot and its trend, symmetry, dual-task accuracy, one flag when a pattern worsens.
- Coaching rules from [research/therapist.md](research/therapist.md):
  - Screen every player with PAR-Q+ first; any "yes" means no unsupervised session.
  - Start the belt at about 80% of the player's normal floor walking speed. Change one difficulty setting at a time, step back a level after a failure, and raise belt speed only between sessions (at most 10% a week, as in V-TIME).
  - Introduce elements in stages, as the C-Mill protocol did: plain walking, then targets, then obstacles, then speed changes.
  - A sound on every target and obstacle; at most one spoken cue every 20 to 30 seconds; a short summary after each walking bout. Cues are at most 12 words, one instruction, aimed at a target on the belt, saying what to do.
  - Stop the belt and end the session on chest pain, dizziness, breathlessness, lasting joint pain, "stop", a stumble, or drifting to the rear of the deck.
  - Wellness wording only: no disease names, no fall-risk scores, no clinical cut-offs; "evaluation by a healthcare professional may be helpful" is allowed.
- Defaults the research did not settle (marked "Design" in the brief and tunable): starting lift threshold 5 to 15 cm, level-up at 8 of 10 successes, level-down at 4 of 10.

## Family league and Visa

- Each family member plays; the weekly table scores each person against their own baseline, so a grandmother and a teenager compete fairly.
- A sponsor (a parent or grandparent) funds a weekly pool; the pool is split by points; nobody stakes or loses money.
- A generative-AI host announces the table, explains each person's progress, picks a reward for the winner and checks it out through Visa (sandbox for the demo).
- Business story: once every session is verified, a family, an employer or an insurer can pay per verified session.

## Demo (90 seconds)

1. The judge steps on; 10-second calibration; plants start scrolling.
2. The judge steps on sunflowers and lifts a foot over a cactus spit; the screen shows "lift 14 cm".
3. The coach speaks a cue; the judge answers a sign aloud.
4. Report card, family table, and the round winner's reward paid through the Visa sandbox.
