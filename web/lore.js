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

export const ENDING = 'Home before sunrise! Rosa wants her slippers back.';

// Spoken when a later round of flowers begins (each round is a little faster; every fourth flower is golden).
export const ROUND_LINES = {
  2: 'Round two! A little faster. Golden flowers count triple!',
  3: 'Round three! Faster still. Fill the bouquet!',
};
