// Data shapes the dashboard consumes: built from GET /api/sessions and /api/session/{id} (src/seed.ts when offline).

/** Game summary, as sent by the game to POST /api/session (see web/game.js, server/therapist.py). */
export interface GameSummary {
  seconds: number;
  steps: number;
  cadence: number | null; // steps per minute
  stompPct: number | null; // flowers hit
  dodgePct: number | null; // seeds dodged
  formPct: number | null;
  highLiftAvgCm: { L: number | null; R: number | null };
}

/** Output of GaitTracker.summary() in gait.py, as stored by POST /api/gait. */
export interface GaitSummary {
  cadence: number | null;
  stride: { L: number | null; R: number | null }; // seconds
  flexion: { L: number | null; R: number | null }; // degrees, lower = more knee bend
  asymmetry: { stride: number | null; flexion: number | null }; // percent
}

/** One walking game session: a GET /api/sessions/{player} row, plus its gait walk and recordings. */
export interface Session {
  player: string;
  ts: number; // unix seconds
  verified: boolean;
  note: string; // coach note written after the session
  summary: GameSummary;
  gait: GaitSummary | null;
  videos: { game: string | null; gait: string | null }; // URLs; null until recordings are linked to sessions
  review?: string | null; // the AI gait review's overview, when one finished
}
