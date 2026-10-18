import { trusted } from "./review.ts";
import type { Session } from "./types";

export interface Metric {
  label: string;
  unit: string;
  better: "up" | "down" | null; // null: a change worth seeing, not better or worse by itself
  lowTrust?: boolean; // depends on the leg farther from the side camera
  get: (s: Session) => number | null;
}

const avg = (a: number | null, b: number | null) => (a === null || b === null ? null : (a + b) / 2);
const review = (id: string) => (s: Session) => trusted(s.gaitReview?.metrics, id)?.value ?? null;

export const METRICS: Metric[] = [
  { label: "Cadence", unit: "steps/min", better: "up", get: (s) => s.summary.cadence },
  { label: "Form", unit: "%", better: "up", get: (s) => s.summary.formPct },
  { label: "Flowers hit", unit: "%", better: "up", get: (s) => s.summary.stompPct },
  { label: "Golden flowers", unit: "%", better: "up", get: (s) => s.summary.goldenPct ?? null },
  { label: "Seeds dodged", unit: "%", better: "up", get: (s) => (s.summary.seedAct === false ? null : s.summary.dodgePct) },
  { label: "High-step lift", unit: "cm", better: "up", get: (s) => (s.summary.shoeMode ? null : avg(s.summary.highLiftAvgCm.L, s.summary.highLiftAvgCm.R)) },
  // From the AI gait review: the leg nearer the side camera only.
  { label: "Knee bend in swing", unit: "deg", better: null, get: review("knee_flexion_peak") },
  { label: "Step length", unit: "cm", better: null, get: review("step_length") },
  { label: "Stride variability", unit: "%", better: "down", get: review("stride_variability") },
  { label: "Stride asymmetry", unit: "%", better: "down", lowTrust: true, get: (s) => review("asym_stride")(s) ?? s.gait?.asymmetry.stride ?? null },
];

export interface Change {
  metric: Metric;
  now: number | null;
  delta: number | null; // now minus before; null if either is missing
  improved: boolean | null; // null when unchanged, unknown, or neither better nor worse
}

/** How each metric moved from the previous session to the current one; metrics neither session has are left out. */
export function compare(now: Session, before: Session): Change[] {
  return METRICS.flatMap((metric) => {
    const a = metric.get(now);
    const b = metric.get(before);
    if (a === null && b === null) return [];
    const delta = a === null || b === null ? null : Math.round((a - b) * 10) / 10;
    const improved = delta === null || delta === 0 || metric.better === null ? null : delta > 0 === (metric.better === "up");
    return [{ metric, now: a === null ? null : Math.round(a * 10) / 10, delta, improved }];
  });
}
