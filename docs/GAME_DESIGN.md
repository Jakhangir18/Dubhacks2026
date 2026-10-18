# Game design

The product is the coach; the game is how the exercises get done. Evidence: [research/kids-evidence.md](research/kids-evidence.md), [research/kids-design.md](research/kids-design.md), [research/therapist.md](research/therapist.md).

## The player and the world

- The player is a zombie walking through a garden. Plants come towards the player in two lanes, one per foot.
- **Floor mode (core, children):** the garden is projected onto a firm floor or a white mat; plants scroll towards the player while the child walks in place or steps forward onto them.
- **Walking-pad mode (optional, teens and adults 14+, supervised):** the player walks on the pad; the garden is shown on a screen or wall in front (the V-TIME set-up), scrolling at the measured belt speed. Nothing is projected onto the belt.

## Mechanics mapped to exercises

| What the player sees | What it practises | What is measured |
|---|---|---|
| **Sunflower** in the left or right lane: step on it with that foot | step placement, coordination | heel strike position and timing against the target |
| **Cactus** spits a seed at one foot: lift that foot high | foot clearance, balance | lift height of the lowest point of the foot, in cm |
| **Sign** with a question ("7 + 5?"): answer aloud | dual-task movement | speech recognition |
| **Ghost footprints** glowing one step ahead | where and when to step | none; the coach is showing the way |
| **Waves** get denser | progression | coach sets spacing, obstacle rate and lift threshold |

Scoring: a hit counts only inside a short window around arrival (about 0.25 s for sunflowers), each foot event is used once, and in walking-pad mode nothing counts unless walking is verified.

## The coach

- **Every frame (code, not a model):** step events, lift height per foot, left-right symmetry, hits and misses.
- **Game feedback on every step for children** (sound, splat, sparkle), faded slowly as they improve: children given reduced feedback retained less and need feedback reduced more gradually.
- **Spoken cues:** at most one every 20 to 30 seconds, at most 12 words, one instruction, aimed at a target ("clear the cactus"), saying what to do.
- **Inside the therapist's limits:** the therapist (or a preset) sets the exercise mix, the lift range and the session length; the coach adapts only within them. Change one setting at a time; step back a level after a failure (level up at 8 of 10 successes, down at 4 of 10, tunable).
- **Session length:** default about 16.5 minutes (the average dose of effective parent-run home programmes for cerebral palsy), then the game locks until the next session; the therapist may change it.
- **Stop rules:** pain, dizziness, "stop", a stumble; in walking-pad mode also drifting to the rear of the deck.
- **Accessibility:** adjustable game speed, adjustable sensitivity, larger targets for children with motor impairments.
- **Wording:** wellness terms only (coordination, balance, strength, endurance, general mobility); no disease names or recovery claims.

## Parents, therapist, rewards and Visa

- After each session: a report for the parent and the therapist (minutes played, hit rates, lift height per foot and its trend, symmetry).
- **Family reward pool:** a parent funds rewards; completed sessions unlock them; a generative-AI host picks a reward the child chose and checks it out through Visa (sandbox for the demo). This mirrors the 2025 DubHacks Visa winner, a kids' habit app with parent-controlled rewards.
- **Family league** for older players: each person is scored against their own baseline, so siblings and parents compete fairly.
- Business story: verified sessions let a therapist see real adherence; a family, a clinic or an insurer can pay per verified session.

## Demo (90 seconds)

1. A judge steps onto the projected garden; ten-second calibration.
2. Sunflowers and cacti arrive; the judge steps and lifts; the screen shows "lift 14 cm"; the coach speaks one cue.
3. The judge answers a sign aloud.
4. Report card, the therapist's limits screen, and a reward unlocked and paid through the Visa sandbox.
