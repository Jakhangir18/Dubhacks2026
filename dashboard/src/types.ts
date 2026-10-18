// Data shapes the dashboard will consume. Nothing here is fetched yet.

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

/** One finished game, as returned by GET /api/sessions/{player}. */
export interface Session {
  summary: GameSummary;
  // TODO: confirm remaining row fields (timestamp, coach note) against server/store.py
}

/** Output of GaitTracker.summary() in gait.py. There is no server endpoint for this yet. */
export interface GaitSummary {
  direction: "left" | "right";
  cadence: number | null; // steps per minute
  stride: { L: number | null; R: number | null }; // seconds
  flexion: { L: number | null; R: number | null }; // degrees, lower = more knee bend
  asymmetry: { stride: number | null; flexion: number | null }; // percent
}
