import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, step, addEvent, addShoes, shoesLive, resetShoes, pace, form, applyParams, summary, needCm, startAt, speedScale } from '../web/logic.js';

const DT = 0.05;

// Walk in place: alternate feet every `gap` seconds, starting at the current game time.
// The alternation and the next step time live on the game, so consecutive calls keep walking smoothly.
function walk(g, seconds, gap = 0.6, lift = 4) {
  if (g._nextStepT === undefined) { g._nextStepT = g.t; g._foot = 'L'; }
  const end = g.t + seconds;
  while (g.t < end) {
    if (g.t >= g._nextStepT) {
      addEvent(g, { foot: g._foot, kind: 'strike' });
      if (lift !== null) addEvent(g, { foot: g._foot, kind: 'lift', liftCm: lift });
      g._foot = g._foot === 'L' ? 'R' : 'L';
      g._nextStepT += gap;
    }
    step(g, DT);
  }
}

// Walk until cond() holds, with a hard limit so a broken rule fails the test instead of hanging it.
function walkUntil(g, cond, limitS = 60) {
  const end = g.t + limitS;
  while (!cond() && g.t < end) walk(g, 0.1);
  assert.ok(cond(), 'condition not reached in time');
}

function toGarden(limits = {}) {
  const g = newGame({ walkSeconds: 2, ...limits }, 3);
  walkUntil(g, () => g.act === 'garden');
  return g;
}

test('cadence below the minimum does not move the world or fill act 1', () => {
  const g = newGame({ walkSeconds: 2 }, 1);
  walk(g, 6, 1.0);                     // 60 steps per minute < 80
  assert.equal(g.act, 'walk');
  assert.equal(g.travelledCm, 0);
});

test('a steady pace with both feet finishes act 1', () => {
  const g = newGame({ walkSeconds: 2 }, 1);
  walk(g, 4, 0.6);                     // 100 steps per minute; pace is valid from the third step
  assert.equal(g.act, 'garden');
  assert.ok(g.travelledCm > 0);
});

test('one foot only is not a valid pace', () => {
  const g = newGame({}, 1);
  for (let i = 0; i < 20; i++) { addEvent(g, { foot: 'L', kind: 'strike' }); step(g, 0.3); }
  assert.equal(pace(g).ok, false);
  assert.equal(form(pace(g)), 0);
});

test('a normal step does not stomp a flower; a high step on time does', () => {
  const g = toGarden({ gardenPlants: 2 });
  walkUntil(g, () => g.things.length >= 1);
  const first = g.things[0];
  walkUntil(g, () => first.result !== null);          // only normal 4 cm steps
  assert.equal(first.result, 'miss');
  walkUntil(g, () => g.things.some((th) => th.id !== first.id));
  const second = g.things.find((th) => th.id !== first.id);
  walkUntil(g, () => second.arriveT !== null);
  addEvent(g, { foot: second.lane, kind: 'lift', liftCm: needCm(g, 'flower', second.lane) + 1, t: second.arriveT });
  walkUntil(g, () => second.result !== null);
  assert.equal(second.result, 'hit');
});

test('a high step on the wrong foot does not stomp', () => {
  const g = toGarden({ gardenPlants: 1 });
  walkUntil(g, () => g.things.length >= 1);
  const fl = g.things[0];
  walkUntil(g, () => fl.arriveT !== null);
  const other = fl.lane === 'L' ? 'R' : 'L';
  addEvent(g, { foot: other, kind: 'lift', liftCm: 30, t: fl.arriveT });
  walkUntil(g, () => fl.result !== null);
  assert.equal(fl.result, 'miss');
});

test('one high step cannot stomp two flowers', () => {
  const g = toGarden({ gardenPlants: 2 });
  g.things = [];
  g.spawned = g.limits.gardenPlants;   // no more spawns
  const t0 = g.t;
  g.things.push({ id: 101, kind: 'flower', lane: 'L', distCm: 0, arriveT: t0, result: null });
  g.things.push({ id: 102, kind: 'flower', lane: 'L', distCm: 0, arriveT: t0 + 0.2, result: null });
  addEvent(g, { foot: 'L', kind: 'lift', liftCm: 30, t: t0 + 0.1 });  // inside both windows
  step(g, 0.4); step(g, 0.4);
  const hits = g.log.filter((r) => (r.id === 101 || r.id === 102) && r.result === 'hit');
  assert.equal(hits.length, 1);
});

test('act 1 measures the normal step height and sets the thresholds from it', () => {
  const g = newGame({ walkSeconds: 1, liftCm: 6 }, 2);
  walk(g, 3, 0.6, 5);
  assert.equal(g.act, 'garden');
  assert.deepEqual(g.base, { L: 5, R: 5 });
  assert.equal(needCm(g, 'flower', 'L'), 9);
  assert.equal(needCm(g, 'seed', 'L'), 12);       // above the therapist's 6 cm because normal steps are 5 cm
});

function toStorm() {
  const g = newGame({ walkSeconds: 1, gardenPlants: 1, stormSeeds: 1, liftCm: 10 }, 9);
  walkUntil(g, () => g.act === 'storm');
  walkUntil(g, () => g.things.some((th) => th.kind === 'seed'));
  return { g, seed: g.things.find((th) => th.kind === 'seed') };
}

test('a lift below the dodge height is hit by the seed', () => {
  const { g, seed } = toStorm();
  walkUntil(g, () => seed.arriveT !== null);
  addEvent(g, { foot: seed.lane, kind: 'lift', liftCm: needCm(g, 'seed', seed.lane) - 1, t: seed.arriveT });
  walkUntil(g, () => seed.result !== null);
  assert.equal(seed.result, 'miss');
});

test('a high lift dodges the seed', () => {
  const { g, seed } = toStorm();
  walkUntil(g, () => seed.arriveT !== null);
  addEvent(g, { foot: seed.lane, kind: 'lift', liftCm: needCm(g, 'seed', seed.lane) + 2, t: seed.arriveT - 0.2 });
  walkUntil(g, () => seed.result !== null);
  assert.equal(seed.result, 'hit');
});

test('the game reaches home after all three acts', () => {
  const g = newGame({ walkSeconds: 1, gardenPlants: 2, stormSeeds: 2 }, 5);
  walk(g, 60, 0.55, 4);                // steady pace with normal steps
  assert.equal(g.act, 'home');
  const s = summary(g);
  assert.equal(s.act, 'home');
  assert.ok(s.steps > 50);
});

test('coach parameters stay inside the therapist ranges', () => {
  const g = newGame({}, 1);
  applyParams(g, { liftCm: 40, spacingCm: 10 });
  assert.equal(g.limits.liftCm, g.limits.liftRange[1]);
  assert.equal(g.limits.spacingCm, g.limits.spacingRange[0]);
});

test('form rewards a symmetric good pace', () => {
  assert.equal(form({ bothFeet: true, ok: true, asym: 0.05 }), 1);
  assert.equal(form({ bothFeet: true, ok: false, asym: 0.3 }), 0.35);
});

test('events from an unknown foot are ignored', () => {
  const g = newGame({}, 1);
  assert.equal(addEvent(g, { foot: 'X', kind: 'strike' }), null);
  assert.equal(g.stats.steps, 0);
});

test('lift targets never exceed the therapist maximum', () => {
  const g = newGame({ walkSeconds: 1, liftRange: [6, 18] }, 4);
  walk(g, 3, 0.6, 12);                 // high marching in act 1: normal step 12 cm
  assert.equal(g.act, 'garden');
  assert.equal(needCm(g, 'seed', 'L'), 18);
  assert.equal(needCm(g, 'flower', 'L'), 16);
});

test('startAt jumps to an act through the normal transition', () => {
  const g = newGame({}, 1);
  startAt(g, 'storm');
  assert.equal(g.act, 'storm');
  assert.equal(g.actResolved, 0);
  assert.ok(g.base);
});

test('equal step times on one foot still give an asymmetry value', () => {
  const g = newGame({}, 1);
  for (const [t, f] of [[0, 'L'], [0.6, 'R'], [0.6, 'L'], [1.2, 'R'], [1.2, 'L']]) addEvent(g, { foot: f, kind: 'strike', t });
  g.t = 1.3;
  assert.notEqual(pace(g).asym, null);
});

test('plant speed scales the world speed inside its limits', () => {
  const at = (speedScale) => {
    const g = newGame({ speedScale }, 1);
    let out;
    for (let i = 0; i < 40; i++) {           // a steady 100 steps per minute, both feet
      addEvent(g, { foot: i % 2 ? 'R' : 'L', kind: 'strike', t: g.t });
      out = step(g, 0.3);
    }
    return out.speed;
  };
  const normal = at(1);
  assert.ok(normal > 0);
  assert.ok(Math.abs(at(0.5) - normal / 2) < 1e-9);
  assert.ok(Math.abs(at(5) - normal * 2) < 1e-9);      // capped at 2
  assert.ok(Math.abs(at(0.1) - normal * 0.3) < 1e-9);  // floor at 0.3
});

test('a zero or missing plant speed never stops the world', () => {
  assert.equal(speedScale(newGame({ speedScale: 0 }, 1)), 0.3);
  assert.equal(speedScale(newGame({ speedScale: 'x' }, 1)), 0.7);   // the default
});

// ---------- shoe mode: feet.py boxes mapped onto the field ----------
// Walk on the belt with shoes only: each lane swings forward and back once per `gap`, which yields the strikes.
function shoeWalk(g, seconds, gap = 0.6) {
  if (g._shoeT === undefined) { g._shoeT = g.t; g._shoeFoot = 'L'; }
  const end = g.t + seconds;
  while (g.t < end) {
    const phase = ((g.t - g._shoeT) % gap) / gap;                  // 0..1 inside the current step
    const swing = phase < 0.5 ? phase * 2 : (1 - phase) * 2;      // forward, then the belt carries it back
    const lane = Math.floor((g.t - g._shoeT) / gap) % 2 === 0 ? 'L' : 'R';
    const d = -g.toeCm + 10 + swing * 120;
    const still = -g.toeCm + 10;
    addShoes(g, lane === 'L'
      ? [{ xFrac: 0.3, nearCm: d + 30, farCm: d }, { xFrac: 0.7, nearCm: still + 30, farCm: still }]
      : [{ xFrac: 0.3, nearCm: still + 30, farCm: still }, { xFrac: 0.7, nearCm: d + 30, farCm: d }]);
    step(g, DT);
  }
}

test('shoe swings on the belt count as steps and keep the pace gate open', () => {
  const g = newGame({ walkSeconds: 2 }, 1);
  shoeWalk(g, 6, 0.6);                    // 100 steps per minute, alternating feet
  assert.equal(g.shoeMode, true);
  assert.ok(g.stats.steps >= 8, `steps ${g.stats.steps}`);
  assert.equal(pace(g).ok, true);
  assert.equal(g.act, 'garden');          // act 1 filled with no lift events at all
});

test('a shoe on a flower smashes it at once; a flower that passes the toes is missed', () => {
  const g = toGarden();
  walkUntil(g, () => g.things.length > 0);
  const th = g.things[0];
  // keep walking (keyboard steps) until the flower is on the belt, with a shoe far up the other lane keeping shoe mode live
  const other = () => addShoes(g, [{ xFrac: th.lane === 'L' ? 0.7 : 0.3, nearCm: 600, farCm: 580 }]);   // beyond the field: keeps shoe mode live, touches nothing
  walkUntil(g, () => { other(); return th.distCm < -20; });
  assert.equal(th.result, null);
  addShoes(g, [{ xFrac: th.lane === 'L' ? 0.3 : 0.7, nearCm: th.distCm + 10, farCm: th.distCm - 10 }]);
  const out = step(g, DT);
  assert.equal(th.result, 'hit');
  assert.equal(out.resolved[0], th);
  assert.equal(g.stats.stomp[0], 1);
  // the next flower gets no shoe at all and walks past the toes
  walkUntil(g, () => g.things.some((x) => x !== th && !x.result));
  const next = g.things.find((x) => x !== th && !x.result);
  // a shoe keeps showing up in the other lane, never on this flower
  walkUntil(g, () => { addShoes(g, [{ xFrac: next.lane === 'L' ? 0.7 : 0.3, nearCm: -40, farCm: -70 }]); return next.result !== null; }, 90);
  assert.equal(next.result, 'miss');
  assert.ok(next.distCm < -g.toeCm);
});

test('a seed under a shoe splats; a seed in a clear lane is dodged once it passes the toes', () => {
  const g = toGarden();
  startAt(g, 'storm');
  walkUntil(g, () => g.things.length > 0);
  const seed = g.things[0];
  walkUntil(g, () => seed.distCm < -20);
  addShoes(g, [{ xFrac: seed.lane === 'L' ? 0.3 : 0.7, nearCm: seed.distCm + 10, farCm: seed.distCm - 10 }]);
  step(g, DT);
  assert.equal(seed.result, 'miss');
  walkUntil(g, () => g.things.some((x) => x !== seed && !x.result));
  const clear = g.things.find((x) => x !== seed && !x.result);
  // a shoe keeps showing in the other lane and never touches it
  walkUntil(g, () => { addShoes(g, [{ xFrac: clear.lane === 'L' ? 0.7 : 0.3, nearCm: -40, farCm: -70 }]); return clear.result !== null; }, 90);
  assert.equal(clear.result, 'hit');
  assert.equal(g.stats.dodge[0], 1);
});

test('a stale shoe sighting no longer smashes anything', () => {
  const g = toGarden();
  walkUntil(g, () => g.things.length > 0);
  const th = g.things[0];
  walkUntil(g, () => th.distCm < -20);
  addShoes(g, [{ xFrac: th.lane === 'L' ? 0.3 : 0.7, nearCm: th.distCm + 10, farCm: th.distCm - 10 }], g.t - 1);
  step(g, DT);
  assert.equal(th.result, null);
});

test('shoe mode needs a real sighting, lapses when the shoes stop coming, and reports itself', () => {
  const g = toGarden();
  addShoes(g, []);
  assert.equal(g.shoeMode, false);
  addShoes(g, [{ xFrac: 0.3, nearCm: -40, farCm: -70 }]);
  assert.equal(shoesLive(g), true);
  walk(g, 4);                               // no sightings for 4 s: the lift rules are back
  assert.equal(shoesLive(g), false);
  assert.equal(summary(g).shoeMode, true);  // but the report knows shoes were used
  // with the lift rules back, a flower resolves by timing again
  walkUntil(g, () => g.log.length > 0, 90);
});

test('one shoe takes its lane from the last two-shoe midpoint', () => {
  const g = newGame({}, 1);
  addShoes(g, [{ xFrac: 0.2, nearCm: -40, farCm: -70 }, { xFrac: 0.4, nearCm: -40, farCm: -70 }]);   // both feet left of centre
  assert.deepEqual(g.shoes.map((s) => s.lane), ['L', 'R']);
  addShoes(g, [{ xFrac: 0.4, nearCm: -40, farCm: -70 }]);
  assert.equal(g.shoes[0].lane, 'R');       // right of the midpoint 0.3, although left of the field centre
  resetShoes(g);
  assert.deepEqual(g.shoes, []);
});

test('when the shoes drop out mid-act, things past the line still wait for the toes', () => {
  const g = toGarden();
  walkUntil(g, () => g.things.length > 0);
  const th = g.things[0];
  const other = () => addShoes(g, [{ xFrac: th.lane === 'L' ? 0.7 : 0.3, nearCm: 600, farCm: 580 }]);   // beyond the field: keeps shoe mode live, touches nothing
  walkUntil(g, () => { other(); return th.distCm < -20; });
  walk(g, 4);                                   // no sightings: shoe mode lapses, but no lift was ever asked for
  assert.equal(shoesLive(g), false);
  assert.equal(th.result, null);                // not a miss yet
  walkUntil(g, () => th.result !== null, 90);
  assert.equal(th.result, 'miss');
  assert.ok(th.distCm < -g.toeCm);              // missed at the toes, as under the shoe rules
});

test('the toe line follows where the shoes stand, so a flower reaches feet that map past the field', () => {
  const g = toGarden();
  const standing = () => addShoes(g, [{ xFrac: 0.3, nearCm: -500, farCm: -530 }, { xFrac: 0.7, nearCm: -500, farCm: -530 }]);
  for (let i = 0; i < 12; i++) { standing(); step(g, DT); }
  assert.ok(g.toeCm >= 530, `toeCm ${g.toeCm}`);        // the feet stand 500 cm past the line, 30 cm margin
  walkUntil(g, () => { standing(); return g.things.length > 0; });
  const th = g.things[0];
  walkUntil(g, () => { standing(); return th.distCm < -400; }, 90);
  assert.equal(th.result, null);                         // not missed at the old toe line (300 cm)
  addShoes(g, [{ xFrac: th.lane === 'L' ? 0.3 : 0.7, nearCm: th.distCm + 10, farCm: th.distCm - 10 }]);
  step(g, DT);
  assert.equal(th.result, 'hit');
});
