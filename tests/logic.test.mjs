import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, step, addEvent, pace, form, applyParams, summary, needCm, startAt } from '../web/logic.js';

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
