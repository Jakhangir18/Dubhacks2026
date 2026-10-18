// Run: npm test  (Node strips the types; no test framework needed)
import assert from "node:assert/strict";
import { compare } from "./improvements.ts";
import type { ReviewMetric, Session } from "./types.ts";

const metric = (id: string, value: number, trust: "good" | "low" = "good"): ReviewMetric =>
  ({ id, label: id, group: "gait", side: id.endsWith("_L") ? "L" : id.endsWith("_R") ? "R" : null, value, unit: "", typical: null, trust, prev: null });

const session = (cadence: number | null, asym: number | null, extra: Partial<Session["summary"]> = {}, metrics: ReviewMetric[] = []): Session => ({
  player: "A", ts: 0, verified: true, note: "",
  summary: { seconds: 60, steps: 100, cadence, stompPct: 50, dodgePct: 50, formPct: 50, highLiftAvgCm: { L: 10, R: 12 }, ...extra },
  gait: asym === null ? null : { cadence: null, stride: { L: null, R: null }, flexion: { L: null, R: null }, asymmetry: { stride: asym, flexion: null } },
  videos: { game: null, gait: null },
  gaitReview: metrics.length ? { status: "done", metrics } : null,
});

const by = (label: string, now: Session, before: Session) => compare(now, before).find((c) => c.metric.label === label);

assert.deepEqual([by("Cadence", session(96, 5), session(91, 8))!.delta, by("Cadence", session(96, 5), session(91, 8))!.improved], [5, true]);
assert.equal(by("Stride asymmetry", session(96, 5), session(91, 8))!.improved, true); // lower is better
assert.equal(by("Stride asymmetry", session(96, 9), session(91, 8))!.improved, false);
assert.equal(by("Stride asymmetry", session(96, 9), session(91, 8))!.metric.lowTrust, true); // the far leg is in it
assert.equal(by("Form", session(96, 5), session(91, 8))!.improved, null); // unchanged
assert.equal(by("Cadence", session(null, 5), session(91, 8))!.delta, null); // missing data
assert.equal(by("Stride asymmetry", session(96, 5), session(91, null))!.improved, null);
assert.equal(by("High-step lift", session(96, 5), session(91, 8))!.now, 11);

// what neither walk has is left out: no seed act, shoe mode (no lift heights), no review
const shoes = { shoeMode: true, seedAct: false };
assert.equal(by("Seeds dodged", session(96, 5, shoes), session(91, 8, shoes)), undefined);
assert.equal(by("High-step lift", session(96, 5, shoes), session(91, 8, shoes)), undefined);
assert.equal(by("Knee bend in swing", session(96, 5), session(91, 8)), undefined);

// review numbers come from the leg the side camera saw well; knee bend is a change, not better or worse
const now = session(96, 5, {}, [metric("knee_flexion_peak_L", 30, "low"), metric("knee_flexion_peak_R", 52), metric("stride_variability_R", 3)]);
const before = session(91, 8, {}, [metric("knee_flexion_peak_R", 48), metric("stride_variability_R", 6)]);
assert.deepEqual([by("Knee bend in swing", now, before)!.now, by("Knee bend in swing", now, before)!.delta, by("Knee bend in swing", now, before)!.improved], [52, 4, null]);
assert.equal(by("Stride variability", now, before)!.improved, true);
// the review's checked number wins over the raw gait.py one; shown to one decimal
const raw = session(96, 143.88281411182174);
assert.equal(by("Stride asymmetry", raw, session(91, 8))!.now, 143.9);
const checked = session(96, 50, {}, [metric("asym_stride", 12.3, "low")]);
assert.equal(by("Stride asymmetry", checked, session(91, 8))!.now, 12.3);
console.log("ok improvements");
