# Round types

The garden act repeats once per round. Each round has a type that decides what comes down the lanes. Everything in a garden round is stepped on; only the storm act's seeds (off by default) are kept clear of. The beat never changes: step, step, thing, lanes alternating, each round a little faster (`RULES.roundSpeedUp`).

## The round plan

`limits.roundPlan` lists the round types in order. It wins over `limits.rounds`; without it the game plays `limits.rounds` rounds of flowers, exactly as before.

```js
newGame({ roundPlan: ['flowers', 'seedStomp', 'slippers'] })   // a 3-round demo
```

- An array, or text split at commas, semicolons or spaces (`'flowers, seedStomp, slippers'`). Blank entries are dropped; an unknown name plays flowers, so a typo never shortens the walk.
- On the laptop: `?rounds=flowers,seedStomp,slippers` in the game URL sets the plan for that browser (with `?demo=1` it replaces the demo's three flower rounds); `?rounds=3` sets three rounds of flowers.
- `plan(g)` returns `{ rounds, seeds, roundPlan }`; `g.roundType` is the current round's type; each thing carries `kind`, `target` and, in the garden act, `roundType`.
- With `stormSeeds > 0` every round still ends with the storm act, whatever its type.

## The three round types

| Type | Lore | Thing (`kind`) | Hit | Miss | Scoring |
|---|---|---|---|---|---|
| `flowers` | Rosa's flowers fight back: stomp the grumps | `flower` | SMASH! (yellow) | MISSED | `points.stomp`; every 4th golden (x3); each hit banks a petal |
| `seedStomp` | Pip has the hiccups again: squish the seeds before they sprout | `seed`, `target: true` | SQUISH! (pink) and a pink blot | ROLLED PAST | as flowers: stomp points, golden every 4th, petals |
| `slippers` | Rosa's slippers are lost in the garden: step into each one | `slipper`, with `pair` | LEFT! / RIGHT! (lavender) | MISSED | stomp points; both slippers of a pair: A PAIR FOR ROSA! and `points.pair` (20) |

Judging is the same for all three. With the camera's shoes it comes only from lane and distance: a shoe on the thing inside `[arriveT - shoeBeforeS, arriveT + shoeAfterS]` is a hit, nothing on it is a miss. Under the lift rules (no shoes) every target asks for the same stomp-high step as a flower, and the hints say so; the storm's seeds ask for the higher dodge (`needCm(g, thing, foot)`). The storm act's seeds are `kind: 'seed', target: false`: touched is a splat, untouched a dodge, as before.

Cues on the floor:

- Seed stomp: Pip's pods sit at the lane tops for the round and hiccup with every seed; each seed rolls in with a pulsing pink ring (gold when golden).
- Slippers: a lavender slipper drawn in code (`makeTextures`, keys `slipper-l` and `slipper-r`), a pulsing lavender ring, left slipper in the left lane, right in the right. A pair flashes both lanes lavender. Art files would need `ART` entries in `game.js` and this drawing removed; dropping a file into `web/art` alone changes nothing.
- Camera marks follow the rule, not the kind: cyan under everything to step on, magenta under the storm's seeds (`markHit`).
- Between rounds the game rests (`ACTS.rest`): `g.roundType` already names the next round there, and the round line ("Round two! ... Pip has the hiccups! ...") is said as the next garden act begins.

## Why slippers

The tale already sets them up: act 1 says "His slippers disagree" and the home card says "Rosa wants her slippers back". A slipper round lets the player bring them back, and the home card then counts the pairs ("Rosa got 2 pairs of slippers back"). With the camera it needs only lane and distance: one target per beat, one lane at a time, judged like a flower, no hands, no both feet at once, no narrower window. A pair is two consecutive slippers of a round, so by the alternation it is one in each lane, in the order the beat brings them (the first of a round may be the right one). With an odd `gardenPlants` the last slipper of a round has no partner. The left/right words on a hit name the foot, which is the exercise.

## Report fields

| Key | Meaning |
|---|---|
| `stompPct` | flowers stepped on, as before: the report, the coach and the gait review label it as flowers |
| `targetPct` | everything stepped on: flowers, seeds to squish, slippers |
| `dodgePct` | the storm's seeds kept clear of (null without a storm) |
| `roundPlan` | the round types as played |
| `roundTypePct` | `{flowers, seedStomp, slippers}`: hit share of each type's things, null for a type not played |
| `slipperPairs` | `[made, offered]` |
| `byLane` | `flower` and `seed` as before (`seed`: the storm's seeds only), plus `seedStomp` and `slippers`: `[hits, judged]` per lane |
| `placementCm` | shoe to flower, as before (flowers only) |

In a flowers-only walk every value is what it was before round types. The game log rows carry `target`, `roundType` and `pair`; the remote log line and the camera window's `resolved` message carry `target`.

## Not yet aware of round types (outside the game files)

- Server coach: `server/therapist.py:101-107` (`rule_cue`) answers the garden act from `stompPct`, the flowers, with "the glowing flower" lines, and `COACH_SYSTEM` (line 20) says act 2 is flowers. The game's own offline cue (`localCue`) already follows the round type.
- Labels and memory written for flowers: `server/therapist.py:154-158` (`describe`, which also feeds the Backboard memory), the greeting and fallback note around lines 176 and 202, `server/gait_review.py:25` (`ACT_NAME`) and 226 (`acts`). A walk without flower rounds has `stompPct` null; these read it safely, but `describe` prints "flowers None%".
- `web/camera-view.js:221`: the camera window's log line treats anything that is not a flower as a seed to dodge, so a squished seed or a slipper reads "dodged" and a missed one "hit by the seed"; it can read `m.th.target`.
- Perceptron: `server/api.py:414` accepts only flower and seed, and `server/perceive.py` `step_question` asks the lift question for every seed. The game therefore sends Perceptron only flowers and the storm's seeds; seed-stomp and slipper steps are not double-checked until those two learn a stomp question for them.
- `web/therapist.html:353`: the live walk card counts log rows whose `what` is flower or seed, so slippers are left out of it.
- The report and the gait review read only `byLane.flower` and `byLane.seed`; the per-lane split of the new types is recorded but not shown yet.
- The last slipper pair of a walk completes in the step that ends the walk, so it gets no floor flash; its bonus is in the score and the home card counts it.
