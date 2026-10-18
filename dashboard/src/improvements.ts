import type { Session } from "./types";

export interface Metric {
  label: string;
  unit: string;
  better: "up" | "down";
  get: (s: Session) => number | null;
}

const avg = (a: number | null, b: number | null) => (a === null || b === null ? null : (a + b) / 2);

export const METRICS: Metric[] = [
  { label: "Cadence", unit: "steps/min", better: "up", get: (s) => s.summary.cadence },
  { label: "Form", unit: "%", better: "up", get: (s) => s.summary.formPct },
  { label: "Flowers hit", unit: "%", better: "up", get: (s) => s.summary.stompPct },
  { label: "Seeds dodged", unit: "%", better: "up", get: (s) => s.summary.dodgePct },
  { label: "High-step lift", unit: "cm", better: "up", get: (s) => avg(s.summary.highLiftAvgCm.L, s.summary.highLiftAvgCm.R) },
  { label: "Stride asymmetry", unit: "%", better: "down", get: (s) => s.gait?.asymmetry.stride ?? null },
];

export interface Change {
  metric: Metric;
  now: number | null;
  delta: number | null; // now minus before; null if either is missing
  improved: boolean | null; // null when unchanged or unknown
}

/** How each metric moved from the previous session to the current one. */
export function compare(now: Session, before: Session): Change[] {
  return METRICS.map((metric) => {
    const a = metric.get(now);
    const b = metric.get(before);
    const delta = a === null || b === null ? null : Math.round((a - b) * 10) / 10;
    const improved = delta === null || delta === 0 ? null : delta > 0 === (metric.better === "up");
    return { metric, now: a, delta, improved };
  });
}
