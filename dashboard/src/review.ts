// Pure helpers for the AI gait review (session.gaitReview), shared by the page and its tests. Same wording as
// web/report.html, so the dashboard and the printable report say the same thing.
import type { GaitReview, Review, ReviewMetric } from "./types";

export type Tone = "ok" | "wait" | "bad" | "none";

/** Where the review is: shown as a chip on the session and in the history. */
export function reviewState(g: GaitReview | null | undefined): { label: string; tone: Tone } {
  if (!g) return { label: "No gait review", tone: "none" };
  if (g.status === "waiting") return { label: "Waiting for the side camera", tone: "wait" };
  if (g.status === "reviewing") return { label: "The coach is reviewing", tone: "wait" };
  if (g.status === "failed") return { label: `Review failed${g.reason ? `: ${g.reason}` : ""}`, tone: "bad" };
  return { label: g.source === "gemini" ? "AI review · Gemini" : "Review · rules", tone: "ok" };
}

export const isPending = (g: GaitReview | null | undefined) => g?.status === "waiting" || g?.status === "reviewing";

/** Who wrote the review, and why the rules did when they did. */
export function sourceLine(g: GaitReview): string {
  const source = g.source === "gemini" ? `Reviewed by Gemini${g.model ? ` (${g.model})` : ""}` : `Rule-based review${g.reason ? ` (${g.reason})` : ""}`;
  const filled = g.source === "gemini" && g.filledByRules?.length ? `; some parts written by the rules: ${g.filledByRules.join(", ")}` : "";
  return source + filled;
}

export const fmt = (v: number | null | undefined) => (typeof v === "number" ? String(Math.round(v * 10) / 10) : "—");
export const sideName = (s: string | null | undefined) => (s === "L" ? "left" : s === "R" ? "right" : s === "both" ? "both sides" : "");

/** The metric a review id refers to, for the evidence chips. */
export const metricIndex = (metrics: ReviewMetric[] | undefined) => new Map((metrics ?? []).map((m) => [m.id, m]));

/** A whole-walk number by id; for a per-leg id (knee_flexion_peak) the leg the side camera saw well. */
export function trusted(metrics: ReviewMetric[] | undefined, base: string): ReviewMetric | null {
  const list = metrics ?? [];
  return list.find((m) => m.id === base) ??
    list.find((m) => m.group === "gait" && m.trust === "good" && (m.id === `${base}_L` || m.id === `${base}_R`)) ?? null;
}

const GROUPS: Record<string, string> = {
  gait: "Side camera, whole walk", game: "Game", "gait@walk": "Side camera, steady walking",
  "gait@garden": "Side camera, flowers", "gait@storm": "Side camera, seeds",
};

/** The measurements table: metrics grouped, whole walk first, then the game, then each act. */
export function groupMetrics(metrics: ReviewMetric[] | undefined): { key: string; name: string; rows: ReviewMetric[] }[] {
  const groups = new Map<string, ReviewMetric[]>();
  for (const m of metrics ?? []) groups.set(m.group, [...(groups.get(m.group) ?? []), m]);
  const order = Object.keys(GROUPS);
  const keys = [...order.filter((k) => groups.has(k)), ...[...groups.keys()].filter((k) => !order.includes(k))];
  return keys.map((key) => ({ key, name: GROUPS[key] ?? key, rows: groups.get(key)! }));
}

/** The settings the review suggests for next time (null means no change). */
export function suggestions(next: Review["nextSession"] | undefined): { label: string; value: number; unit: string }[] {
  if (!next) return [];
  const all = [["liftCm", "lift target", "cm"], ["spacingCm", "flower spacing", "cm"], ["minCadence", "minimum pace", "steps/min"]] as const;
  return all.flatMap(([key, label, unit]) => (Number.isFinite(next[key]) ? [{ label, value: next[key] as number, unit }] : []));
}
