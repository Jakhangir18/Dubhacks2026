import type { Session } from "./types";

// Seeded sessions, newest first (same order as GET /api/sessions). Replace with a fetch when the dashboard goes live.
const day = (d: number) => Date.UTC(2026, 9, d, 17, 30) / 1000;

export const SESSIONS: Session[] = [
  {
    player: "Alex", ts: day(17), verified: true,
    note: "Steadier rhythm today and higher steps onto the flowers. Next time, keep the same pace through the seeds.",
    summary: { seconds: 312, steps: 498, cadence: 96, stompPct: 81, dodgePct: 58, formPct: 84, highLiftAvgCm: { L: 13, R: 12 } },
    gait: { cadence: 97, stride: { L: 1.21, R: 1.27 }, flexion: { L: 112, R: 116 }, asymmetry: { stride: 4.8, flexion: 3.5 } },
    videos: { game: null, gait: null },
  },
  {
    player: "Alex", ts: day(15), verified: true,
    note: "Good effort on the walk home. The right foot lifted a little lower than the left on high steps.",
    summary: { seconds: 298, steps: 452, cadence: 91, stompPct: 74, dodgePct: 63, formPct: 79, highLiftAvgCm: { L: 12, R: 10 } },
    gait: { cadence: 92, stride: { L: 1.24, R: 1.34 }, flexion: { L: 115, R: 121 }, asymmetry: { stride: 7.8, flexion: 5.1 } },
    videos: { game: null, gait: null },
  },
  {
    player: "Alex", ts: day(12), verified: true,
    note: "A calm first full session. Pace stayed above the target for most of act one.",
    summary: { seconds: 276, steps: 401, cadence: 87, stompPct: 66, dodgePct: 55, formPct: 72, highLiftAvgCm: { L: 11, R: 9 } },
    gait: { cadence: 88, stride: { L: 1.3, R: 1.42 }, flexion: { L: 118, R: 125 }, asymmetry: { stride: 8.8, flexion: 5.8 } },
    videos: { game: null, gait: null },
  },
  {
    player: "Alex", ts: day(9), verified: false,
    note: "Short warm-up walk. Not counted toward rewards.",
    summary: { seconds: 94, steps: 120, cadence: 82, stompPct: null, dodgePct: null, formPct: 70, highLiftAvgCm: { L: null, R: null } },
    gait: null,
    videos: { game: null, gait: null },
  },
];
