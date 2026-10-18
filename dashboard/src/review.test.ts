// Run: npm test
import assert from "node:assert/strict";
import { groupMetrics, isPending, reviewState, sourceLine, suggestions, trusted } from "./review.ts";
import type { ReviewMetric } from "./types.ts";

const m = (id: string, group: string, trust: "good" | "low" = "good"): ReviewMetric =>
  ({ id, label: id, group, side: null, value: 1, unit: "", typical: null, trust, prev: null });

// where a review is, in words
assert.deepEqual(reviewState(null), { label: "No gait review", tone: "none" });
assert.equal(reviewState({ status: "waiting" }).tone, "wait");
assert.equal(reviewState({ status: "failed", reason: "the side camera did not send the walk" }).label, "Review failed: the side camera did not send the walk");
assert.equal(reviewState({ status: "done", source: "gemini" }).label, "AI review · Gemini");
assert.equal(reviewState({ status: "done", source: "rules" }).label, "Review · rules");
assert.equal(isPending({ status: "reviewing" }), true);
assert.equal(isPending({ status: "done" }), false);

// who wrote it
assert.equal(sourceLine({ status: "done", source: "rules", reason: "no GEMINI_API_KEY" }), "Rule-based review (no GEMINI_API_KEY)");
assert.equal(sourceLine({ status: "done", source: "gemini", model: "m1", filledByRules: ["cues"] }), "Reviewed by Gemini (m1); some parts written by the rules: cues");

// the near leg's number; a whole-walk id as it is; nothing for a far-leg-only id
const metrics = [m("knee_flexion_peak_L", "gait", "low"), m("knee_flexion_peak_R", "gait"), m("cadence", "gait"), m("knee_flexion_peak_R@walk", "gait@walk"), m("toe_lift_L", "gait", "low")];
assert.equal(trusted(metrics, "knee_flexion_peak")?.id, "knee_flexion_peak_R");
assert.equal(trusted(metrics, "cadence")?.id, "cadence");
assert.equal(trusted(metrics, "toe_lift"), null);

// the measurements table: whole walk, game, then the acts in order
const grouped = groupMetrics([m("a", "gait@storm"), m("b", "game"), m("c", "gait"), m("d", "gait@walk"), m("e", "other")]);
assert.deepEqual(grouped.map((x) => x.key), ["gait", "game", "gait@walk", "gait@storm", "other"]);
assert.equal(grouped[0].name, "Side camera, whole walk");

// only the settings that change
assert.deepEqual(suggestions({ liftCm: null, spacingCm: 170, minCadence: null, why: "" }), [{ label: "flower spacing", value: 170, unit: "cm" }]);
assert.deepEqual(suggestions(undefined), []);
console.log("ok review");
