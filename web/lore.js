// Original garden tale. These strings only change presentation, never the rules.
export const ACTS = {
  walk: {
    title: 'ACT 1 · BEDTIME, GUS!',
    intro: ['Gus needs bed before sunrise.', 'His slippers disagree.'],
    hint: 'Keep a steady pace. Home before sunrise!',
    how: 'Walk steady, both feet, keep the pace up',
  },
  garden: {
    title: 'ACT 2 · PETAL PATROL',
    intro: ['Grandma Rosa’s flowers fight back.', 'Stomp the grumps!'],
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

// Each garden round has a type (limits.roundPlan, see ROUND_KINDS in logic.js); while it plays, its lines stand in
// for act 2's. Titles keep the 'ACT n · NAME' form: the HUD shows the part after the dot.
export const ROUND_ACTS = {
  flowers: ACTS.garden,
  seedStomp: {
    title: 'ACT 2 · SEED SQUISH',
    intro: ['Pip has the hiccups again!', 'Squish the seeds before they sprout!'],
    hint: 'High step onto the rolling pink seed',
    how: 'Step on the seed when it reaches your foot',
  },
  slippers: {
    title: 'ACT 2 · SLIPPER HUNT',
    intro: ['Rosa’s slippers are lost in the garden.', 'Step into each one, left and right!'],
    hint: 'High step into the slipper in your lane',
    how: 'Step on the slipper when it reaches your foot',
  },
};

export const ENDING = 'Home before sunrise! Rosa wants her slippers back.';

// The home card names each round type's hit share (summary().roundTypePct) when a walk had more than flowers.
export const ROUND_LABELS = { flowers: 'Flowers stomped', seedStomp: 'Seeds squished', slippers: 'Slippers found' };

// The home card's first line: after slipper rounds it says how many pairs Rosa got back (summary().slipperPairs), or
// that she got some back when the slippers found never made a pair (one slipper a round).
export function endingLine(summary) {
  const [made, offered] = Array.isArray(summary?.slipperPairs) ? summary.slipperPairs : [0, 0];
  const found = summary?.roundTypePct?.slippers;   // null or missing: no slipper round
  if (made) return `Home before sunrise! Rosa got ${made} ${made === 1 ? 'pair' : 'pairs'} of slippers back.`;
  if (found > 0) return 'Home before sunrise! Rosa got some of her slippers back.';
  if (offered || found === 0) return 'Home before sunrise! Rosa still wants her slippers back.';
  return ENDING;
}

// Spoken when a later round begins: its number and pace, then what this round brings (each round is a little faster;
// flowers and seeds to squish can be golden and fill the bouquet).
export const ROUND_STARTS = {
  2: 'Round two! A little faster.',
  3: 'Round three! Faster still.',
};
export const ROUND_LINES = {
  flowers: 'Golden flowers count triple. Fill the bouquet!',
  seedStomp: 'Pip has the hiccups! Squish the seeds before they sprout!',
  slippers: 'Rosa’s slippers! Step into each one, left and right!',
};
export function roundLine(round, roundType) {
  return `${ROUND_STARTS[round] ?? `Round ${round}! Faster still.`} ${ROUND_LINES[roundType] ?? ROUND_LINES.flowers}`;
}
