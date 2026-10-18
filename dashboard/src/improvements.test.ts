// Run: npm test  (Node strips the types; no test framework needed)
import assert from "node:assert/strict";
import { compare } from "./improvements.ts";
import type { Session } from "./types.ts";

const session = (cadence: number | null, asym: number | null): Session => ({
  player: "A", ts: 0, verified: true, note: "",
  summary: { seconds: 60, steps: 100, cadence, stompPct: 50, dodgePct: 50, formPct: 50, highLiftAvgCm: { L: 10, R: 12 } },
  gait: asym === null ? null : { cadence: null, stride: { L: null, R: null }, flexion: { L: null, R: null }, asymmetry: { stride: asym, flexion: null } },
  videos: { game: null, gait: null },
});

const by = (label: string, now: Session, before: Session) => compare(now, before).find((c) => c.metric.label === label)!;

assert.deepEqual([by("Cadence", session(96, 5), session(91, 8)).delta, by("Cadence", session(96, 5), session(91, 8)).improved], [5, true]);
assert.equal(by("Stride asymmetry", session(96, 5), session(91, 8)).improved, true); // lower is better
assert.equal(by("Stride asymmetry", session(96, 9), session(91, 8)).improved, false);
assert.equal(by("Form", session(96, 5), session(91, 8)).improved, null); // unchanged
assert.equal(by("Cadence", session(null, 5), session(91, 8)).delta, null); // missing data
assert.equal(by("Stride asymmetry", session(96, 5), session(91, null)).improved, null);
assert.equal(by("High-step lift", session(96, 5), session(91, 8)).now, 11);
console.log("ok");
