// Data shapes the dashboard consumes: built from GET /api/sessions and /api/session/{id} (src/seed.ts when offline).
// The review shapes follow vision/CONTRACT.md, section "Session-linked gait review".

/** Game summary, as sent by the game to POST /api/session (see web/logic.js summary(), server/therapist.py). */
export interface GameSummary {
  seconds: number;
  steps: number;
  cadence: number | null; // steps per minute
  stompPct: number | null; // flowers hit
  dodgePct: number | null; // seeds dodged
  formPct: number | null;
  highLiftAvgCm: { L: number | null; R: number | null };
  asymmetryPct?: number | null;
  goldenPct?: number | null; // golden flowers hit
  petals?: number;
  score?: number;
  rounds?: number;
  shoeMode?: boolean;
  seedAct?: boolean; // false: the game had no seed act
  wallSeconds?: number;
  stepsByFoot?: { L: number; R: number };
  byLane?: { flower?: Lanes; seed?: Lanes };
  placementCm?: Sides | null;
  timingS?: Sides | null;
  swingCm?: Sides | null;
  perceptron?: PerceptronAgreement | null;
}

/** The game's count of Perceptron's step checks (web/perceive.js summary()): unclear ones are not counted. */
export interface PerceptronAgreement {
  checked: number;
  agree: number;
  agreePct: number | null;
  view?: "overhead" | "legs";
  form?: { onPad: string; holdingRail: string; steady: string } | null;
}

/** Perceptron's report on the whole walk (session.perceptron, from POST /api/perceive/session). */
export interface PerceptronLook {
  view?: "overhead" | "legs";
  clips?: { mention: string; t0: number; t1: number }[] | null;
  points?: { mention: string; point: { x: number; y: number } }[] | null;   // 0-1000 across the key frame
  keyFrame?: string | null;
  caption?: string | null;
  gaitNote?: string | null;
  safety?: string | null;
}
export type Sides = { L: number | null; R: number | null };
export type Lanes = { L: [number, number]; R: [number, number] }; // [hit, total] per lane

/** Output of GaitTracker.summary() in gait.py, as stored by POST /api/gait/final (the parts the dashboard reads). */
export interface GaitSummary {
  cadence: number | null;
  stride: { L: number | null; R: number | null }; // seconds
  flexion: { L: number | null; R: number | null }; // degrees, lower = more knee bend
  asymmetry: { stride: number | null; flexion: number | null }; // percent
}

/** One number the review may use: an id the review cites, with its unit, rough typical value and how far to trust it. */
export interface ReviewMetric {
  id: string;
  label: string;
  group: string; // gait | game | gait@walk | gait@garden | gait@storm
  side: "L" | "R" | null;
  value: number;
  unit: string;
  typical: string | null;
  trust: "good" | "low";
  prev: number | null; // the mean of earlier reviews
}

export interface Cited { text: string; evidence: string[] }
export interface Finding extends Cited { area: string; side: "L" | "R" | "both" | "none"; confidence: "high" | "medium" | "low" }

export interface Review {
  overview: string;
  strengths: Cited[];
  findings: Finding[];
  gameVsGait: Cited[];
  actComparison: string;
  trend: string;
  focus: { text: string; why: string; evidence: string[] };
  nextSession: { liftCm: number | null; spacingCm: number | null; minCadence: number | null; why: string };
  cues: string[];
  playerFeedback: string;
  parentNote: string;
  therapistNote: string;
  nextRecording: string;
}

/** session.gaitReview: the AI therapist's review of one walk. */
export interface GaitReview {
  status: "waiting" | "reviewing" | "done" | "failed";
  source?: "gemini" | "rules";
  model?: string | null;
  reason?: string | null;
  dataQuality?: { level: "good" | "ok" | "poor"; issues: string[] };
  metrics?: ReviewMetric[];
  withheld?: { id: string; reason: string }[];
  review?: Review;
  filledByRules?: string[];
  ts?: number;
}

/** One walking game session: a GET /api/sessions/{player} row, plus its gait walk and recordings. */
export interface Session {
  id?: string; // older sessions have none
  player: string;
  ts: number; // unix seconds
  verified: boolean;
  note: string; // coach note written after the session
  summary: GameSummary;
  gait: GaitSummary | null;
  videos: { game: string | null; gait: string | null }; // URLs; null until recordings are linked to sessions
  gaitReview?: GaitReview | null;
  perceptron?: PerceptronLook | null;
}
