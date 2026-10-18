// Original garden tale. These strings only change presentation, never the rules.
export const ACTS = {
  walk: {
    title: 'ACT 1 · BEDTIME, GUS!',
    intro: ['Gus needs bed before sunrise.', 'His slippers disagree.'],
    hint: 'Keep a steady pace. Home before sunrise!',
    how: 'Walk steady, both feet, keep the pace up',
  },
  garden: {
    title: 'ROUND 1 · PETAL PATROL',
    intro: ['The garden’s flowers fight back.', 'Stomp the grumps!'],
    hint: 'High step onto the glowing flower',
    how: 'Step on the flower when it reaches your foot',
  },
  rest: {
    title: 'ROUND DONE · CATCH YOUR BREATH',
    intro: ['Nice round!', 'Walk when you are ready.'],
    hint: 'Walk in place to start the next round',
    how: 'Walk in place to start the next round',
  },
  storm: {
    title: 'ACT 3 · PIP’S HICCUPS',
    intro: ['Rosa’s pod has seed hiccups.', 'Lift over the seeds!'],
    hint: 'Lift the foot the seed is aiming at',
    how: 'Keep your foot out of the seed\u2019s lane',
  },
};

export const ENDING = 'Home before sunrise! Maya is cheering for you.';
export const ENDING_SECONDS = 6;

// Presentation only: every round still uses the same flower judging and golden/bouquet rules.
export const ROUND_LINES = {
  2: 'Round two! Pea spitters ahead. Stomp the plants. The flying peas are just for fun! Golden plants count triple.',
  3: 'Round three! Crush the spike patch. One last stretch to Maya’s house. Fill the bouquet!',
};

export function roundStory(round) {
  if (round === 2) return { title: 'ROUND 2 · PEA SPITTERS', intro: ['The pea spitters are awake!', 'Stomp the plants. Flying peas are just for fun.'], hint: 'High step onto the glowing spitter', how: 'Step on the spitter when it reaches your foot' };
  if (round >= 3) return { title: `ROUND ${round} · SPIKE PATCH`, intro: ['One last patch before home.', 'Crush the spikes!'], hint: 'High step onto the glowing spikes', how: 'Step on the spikes when they reach your foot' };
  return ACTS.garden;
}

export function actStory(act, round) {
  if (act === 'garden') return roundStory(round);
  if (act === 'rest') return { ...ACTS.rest, title: `ROUND ${round - 1} DONE` };
  return ACTS[act];
}

export function targetTexture(round, id) {
  return round === 2 ? 'spitter' : round >= 3 ? 'spikeweed' : ['flower', 'flower-bell', 'flower-rose'][(id - 1) % 3];
}

// Only measured values appear; missing camera measurements must never become zeroes.
export function coachNumbers(s) {
  if (!s) return '';
  const lines = [];
  if (Number.isFinite(s.cadence)) lines.push(`${s.cadence} steps/min`);
  if (Number.isFinite(s.asymmetryPct)) lines.push(`Even L/R ${Math.max(0, 100 - s.asymmetryPct)}%`);
  if (Number.isFinite(s.formPct)) lines.push(`Form ${s.formPct}%`);
  if (s.thisRound?.n) lines.push(`${s.thisRound.hit}/${s.thisRound.n} plants stomped`);
  const pair = (label, values, unit) => {
    if (values && (Number.isFinite(values.L) || Number.isFinite(values.R))) lines.push(`${label}: L ${values.L ?? '—'} / R ${values.R ?? '—'} ${unit}`);
  };
  pair(s.shoeMode ? 'Swing' : 'High step', s.shoeMode ? s.swingCm : s.highLiftAvgCm, 'cm');
  pair('Timing', s.timingS, 's');
  pair('Placement', s.placementCm, 'cm');
  const side = s.sideCamera;
  if (side) {
    if (Number.isFinite(side.cadence)) lines.push(`Side camera ${side.cadence} steps/min`);
    pair('Toe lift', side.toe_lift_cm, 'cm');
    pair('Step length', side.step_length_cm, 'cm');
    if (Number.isFinite(side.speed_m_s)) lines.push(`Speed ${side.speed_m_s} m/s`);
  }
  return lines.join(' · ');
}
