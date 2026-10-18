import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, beatCm, plan, warnGate, newGame, step, addEvent, addShoes, shoesLive, resetShoes, markHit, pace, form, applyParams, summary, needCm, startAt, speedScale } from '../web/logic.js';

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
  const g = newGame({ walkSeconds: 2, ...limits });
  walkUntil(g, () => g.act === 'garden');
  return g;
}

test('cadence below the minimum slows the world and fills act 1 at half rate; standing still stops it', () => {
  const g = newGame({ walkSeconds: 2 });
  walk(g, 2.5, 1.0);                   // 60 steps per minute < 80: slow, not stopped
  assert.equal(g.act, 'walk');         // 2.5 s at half rate is not 2 s of good walking yet
  assert.ok(g.travelledCm > 0);
  walk(g, 5, 1.0);
  assert.equal(g.act, 'garden');       // about 7 s at half rate (the first steps have no cadence yet)
  for (let i = 0; i < 120; i++) step(g, DT);  // 6 s with no steps: past stopAfterS and the glide to rest
  const before = g.travelledCm;
  for (let i = 0; i < 20; i++) step(g, DT);   // another second standing still: nothing moves
  assert.equal(g.travelledCm, before);
});

test('the world speed glides: no jump when the pace starts, flips or stops', () => {
  const g = newGame({ walkSeconds: 60 });
  const speeds = [];
  const go = (seconds, gap) => { const end = g.t + seconds; while (g.t < end) { walk(g, DT, gap); speeds.push(g.speed); } };
  go(1.15, 0.6);                       // two steps (at 0 and 0.6 s): no cadence yet
  assert.equal(g.speed, 0);
  go(0.1, 0.6);                        // the third step gives a cadence of 100: the world starts, gently
  assert.ok(g.speed > 0 && g.speed < 0.3 * (100 / 60) * 50 * 0.7, `starts gently, got ${g.speed}`);
  go(4, 0.6);
  const steady = g.speed;
  const nominal = (100 / 60) * 50 * 0.7;   // steps land on frames, so the measured cadence wobbles by a step or two
  assert.ok(Math.abs(steady - nominal) < 0.05 * nominal, `reaches the cadence speed, got ${steady} for ${nominal}`);
  for (let i = 1; i < speeds.length; i++) assert.ok(speeds[i] - speeds[i - 1] < 0.1 * steady, 'no jump on the way up');
  const stopT = g.t, stopCm = g.travelledCm, lastStrikeT = g.strikes[g.strikes.length - 1].t;
  for (let i = 0; i < 40; i++) step(g, DT);   // 2 s without a step: past stopAfterS, the target is 0
  assert.ok(g.speed > 0 && g.speed < steady, `slows instead of freezing, got ${g.speed}`);
  for (let i = 0; i < 80; i++) step(g, DT);   // 4 s more: at rest, exactly
  assert.equal(g.speed, 0);
  // Full speed until stopAfterS after the last step, then a glide worth about slowDownS of travel.
  const expected = steady * (lastStrikeT + RULES.stopAfterS - stopT + RULES.slowDownS);
  const glided = g.travelledCm - stopCm;
  assert.ok(Math.abs(glided - expected) < 0.1 * expected, `glides ${glided} cm, expected about ${expected}`);
});

test('the pace warning gate: comes on after about 1.6 s of a bad pace, off after about 1.2 s of a good one, steady under a 1.2 s flip', () => {
  const run = (g, bad, seconds) => { for (let t = 0; t < seconds - 1e-9; t += DT) warnGate(g, bad, DT); return g.paceGated; };
  const g = newGame();
  assert.equal(run(g, true, 1.4), false, 'not yet at 1.4 s');
  assert.equal(run(g, true, 0.4), true, 'on by 1.8 s');
  assert.equal(run(g, false, 1.0), true, 'not yet off at 1.0 s');
  assert.equal(run(g, false, 0.4), false, 'off by 1.4 s');
  const flips = (halfPeriodS) => {
    const h = newGame();
    let last = h.paceGated, n = 0;
    for (let cycle = 0; cycle < 20; cycle++) for (const bad of [true, false]) {
      run(h, bad, halfPeriodS);
      if (cycle >= 4 && h.paceGated !== last) n += 1;
      last = h.paceGated;
    }
    return n;
  };
  assert.equal(flips(1.2), 0);   // a pace flipping every 1.2 s settles
  assert.equal(flips(1.0), 0);
  assert.ok(flips(3.0) > 0);     // a pace that is bad for 3 s at a time is shown as such
});

test('the pace warning follows the pace in a game: on after a sustained slow stretch, off after a sustained good one', () => {
  const g = newGame({ walkSeconds: 60 });
  walk(g, 6, 0.6);                        // 100 steps per minute, past the grace period
  assert.equal(step(g, DT).pace.gated, false);
  const until = (cond, limitS = 20) => { const end = g.t + limitS; while (g.t < end) { walk(g, DT, g._gap); if (cond(pace(g))) return; } assert.fail('not reached'); };
  g._gap = 1.0;                           // 60 steps per minute: below the minimum once the window sees it
  until((p) => !p.ok);
  const badT = g.t;
  assert.equal(step(g, DT).pace.gated, false, 'not at once');
  until(() => g.t >= badT + 2 * RULES.paceWarnS);
  assert.equal(step(g, DT).pace.gated, true, 'after the hold');
  g._gap = 0.6;
  until((p) => p.ok);
  const okT = g.t;
  assert.equal(step(g, DT).pace.gated, true, 'still shown right after the pace recovers');
  until(() => g.t >= okT + 2 * RULES.paceWarnS);
  assert.equal(step(g, DT).pace.gated, false, 'gone after the hold');
});

test('the beat snaps the spacing to the nearest odd number of steps, ties down, monotonic', () => {
  const beat = (spacingCm, speedScale = 0.7) => beatCm(newGame({ spacingCm, speedScale }));
  assert.equal(beat(140), 3 * 35);          // 4 steps is a tie: 3
  assert.equal(beat(120, 1), 3 * 50);       // 2.4 steps: 3, never 1
  assert.equal(beat(100, 1), 1 * 50);       // 2 steps is a tie: 1
  assert.equal(beat(220), 7 * 35);          // 6.3 steps: 7
  assert.equal(beat(90, 2), 1 * 100);       // under one step: 1
  let last = 0;
  for (let cm = 90; cm <= 220; cm += 5) { assert.ok(beat(cm) >= last); last = beat(cm); }
});

test('the first flower of an act appears on a landing, a whole number of steps out, in the lane of the foot that lands there', () => {
  const firstOf = (limits) => {
    const g = toGarden(limits);
    assert.equal(g.spawned, 0);
    walkUntil(g, () => g.spawned === 1);
    return { first: g.things[0], foot: g.strikes[g.strikes.length - 1].foot };   // the landing that placed it
  };
  const even = firstOf({});                        // 420 cm ahead, 35 cm per step: 12 steps, the same foot lands on it
  assert.equal(even.first.lane, even.foot);
  assert.ok(Math.abs(even.first.distCm - 420) < 8, `placed ${even.first.distCm} cm out`);   // minus up to two frames of travel
  const odd = firstOf({ speedScale: 1.2 });        // 60 cm per step: 7 whole steps (inside the field), the other foot
  assert.equal(odd.first.lane, odd.foot === 'L' ? 'R' : 'L');
  assert.ok(Math.abs(odd.first.distCm - 420) < 10 && odd.first.distCm <= 420, `placed ${odd.first.distCm} cm out`);
});

test('with no seeds the rounds are flowers only, lanes alternate, and each flower comes an odd number of steps after the last', () => {
  const g = newGame({ walkSeconds: 1, gardenPlants: 4, rounds: 2 });   // stormSeeds defaults to 0
  const acts = [g.act];
  const beat = beatCm(g);
  assert.equal(beat, 3 * RULES.strideCm * 0.7);   // 140 cm at the default plant speed snaps to 3 steps
  let gaps = 0;
  walkUntil(g, () => {
    const key = g.act === 'garden' ? `garden ${g.round}` : g.act;
    if (key !== acts[acts.length - 1]) acts.push(key);
    const live = g.things.filter((th) => !th.result);
    for (let i = 1; i < live.length; i++) {   // things on the floor sit exactly one beat apart, whatever the frame
      assert.ok(Math.abs(live[i].distCm - live[i - 1].distCm - beat) < 1e-6, `gap ${live[i].distCm - live[i - 1].distCm}`);
      gaps += 1;
    }
    return g.act === 'home';
  }, 120);
  assert.ok(gaps > 0);
  assert.deepEqual(acts, ['walk', 'garden 1', 'garden 2', 'home']);
  assert.equal(g.log.length, 8);
  assert.ok(g.log.every((l) => l.kind === 'flower'));
  for (let i = 1; i < g.log.length; i++) assert.notEqual(g.log[i].lane, g.log[i - 1].lane, 'lanes alternate');
  assert.equal(summary(g).beatCm, 105);      // the spacing as played
  assert.equal(summary(g).spacingCm, 140);   // the therapist's setting, untouched
  assert.equal(summary(g).seedAct, false);
});

test('a steady pace with both feet finishes act 1', () => {
  const g = newGame({ walkSeconds: 2 });
  walk(g, 4, 0.6);                     // 100 steps per minute; pace is valid from the third step
  assert.equal(g.act, 'garden');
  assert.ok(g.travelledCm > 0);
});

test('one foot only is not a valid pace', () => {
  const g = newGame({});
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
  const g = newGame({ walkSeconds: 1, liftCm: 6 });
  walk(g, 3, 0.6, 5);
  assert.equal(g.act, 'garden');
  assert.deepEqual(g.base, { L: 5, R: 5 });
  assert.equal(needCm(g, 'flower', 'L'), 9);
  assert.equal(needCm(g, 'seed', 'L'), 12);       // above the therapist's 6 cm because normal steps are 5 cm
});

function toStorm() {
  const g = newGame({ walkSeconds: 1, gardenPlants: 1, stormSeeds: 1, liftCm: 10 });
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
  const g = newGame({ walkSeconds: 1, gardenPlants: 2, stormSeeds: 2 });
  walk(g, 60, 0.55, 4);                // steady pace with normal steps
  assert.equal(g.act, 'home');
  const s = summary(g);
  assert.equal(s.act, 'home');
  assert.ok(s.steps > 50);
});

test('coach parameters stay inside the therapist ranges', () => {
  const g = newGame({});
  applyParams(g, { liftCm: 40, spacingCm: 10 });
  assert.equal(g.limits.liftCm, g.limits.liftRange[1]);
  assert.equal(g.limits.spacingCm, g.limits.spacingRange[0]);
});

test('form rewards a symmetric good pace', () => {
  assert.equal(form({ bothFeet: true, ok: true, asym: 0.05 }), 1);
  assert.equal(form({ bothFeet: true, ok: false, asym: 0.3 }), 0.35);
});

test('events from an unknown foot are ignored', () => {
  const g = newGame({});
  assert.equal(addEvent(g, { foot: 'X', kind: 'strike' }), null);
  assert.equal(g.stats.steps, 0);
});

test('lift targets never exceed the therapist maximum', () => {
  const g = newGame({ walkSeconds: 1, liftRange: [6, 18] });
  walk(g, 3, 0.6, 12);                 // high marching in act 1: normal step 12 cm
  assert.equal(g.act, 'garden');
  assert.equal(needCm(g, 'seed', 'L'), 18);
  assert.equal(needCm(g, 'flower', 'L'), 16);
});

test('startAt jumps to an act through the normal transition', () => {
  const none = newGame();
  startAt(none, 'storm');
  assert.equal(none.act, 'garden');   // no seed act in a flowers-only game
  const g = newGame({ stormSeeds: 2 });
  startAt(g, 'storm');
  assert.equal(g.act, 'storm');
  assert.equal(g.actResolved, 0);
  assert.ok(g.base);
});

test('equal step times on one foot still give an asymmetry value', () => {
  const g = newGame({});
  for (const [t, f] of [[0, 'L'], [0.6, 'R'], [0.6, 'L'], [1.2, 'R'], [1.2, 'L']]) addEvent(g, { foot: f, kind: 'strike', t });
  g.t = 1.3;
  assert.notEqual(pace(g).asym, null);
});

test('plant speed scales the world speed inside its limits', () => {
  const at = (speedScale) => {
    const g = newGame({ speedScale });
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
  assert.equal(speedScale(newGame({ speedScale: 0 })), 0.3);
  assert.equal(speedScale(newGame({ speedScale: 'x' })), 0.7);   // the default
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
  const g = newGame({ walkSeconds: 2 });
  shoeWalk(g, 6, 0.6);                    // 100 steps per minute, alternating feet
  assert.equal(g.shoeMode, true);
  assert.ok(g.stats.steps >= 8 && g.stats.steps <= 12, `steps ${g.stats.steps}`);   // one per swing, no jitter steps
  assert.ok(g.base.L > 10 && g.base.L < 20, `normal swing ${g.base.L}`);        // act 1 learned the normal swing
  assert.equal(pace(g).ok, true);
  assert.equal(g.act, 'garden');          // act 1 filled with no lift events at all
});

test('at the line: a shoe on the flower smashes it, no shoe means it got away', () => {
  const g = toGarden();
  walkUntil(g, () => g.things.length > 0);
  const th = g.things[0];
  const x = th.lane === 'L' ? 0.3 : 0.7;
  const keep = () => addShoes(g, [{ xFrac: th.lane === 'L' ? 0.7 : 0.3, nearCm: 600, farCm: 580 }]);   // shoe mode live, touching nothing
  walkUntil(g, () => { keep(); return th.distCm < 30; });
  // the shoe is on the flower as it crosses the line
  walkUntil(g, () => { addShoes(g, [{ xFrac: x, nearCm: th.distCm + 15, farCm: th.distCm - 15 }]); return th.result !== null; }, 10);
  assert.equal(th.result, 'hit');
  assert.ok(th.distCm > -80, `judged near the line, at ${Math.round(th.distCm)}`);
  // the next flower crosses with the shoe elsewhere
  walkUntil(g, () => { keep(); return g.things.some((t) => t !== th && !t.result); });
  const next = g.things.find((t) => t !== th && !t.result);
  walkUntil(g, () => { keep(); return next.result !== null; }, 60);
  assert.equal(next.result, 'miss');
  assert.ok(next.distCm > -80);
});

test('at the line: a shoe on the seed splats, a clear lane is a dodge', () => {
  const g = toGarden({ stormSeeds: 2 });
  startAt(g, 'storm');
  walkUntil(g, () => g.things.length > 0);
  const seed = g.things[0];
  const x = seed.lane === 'L' ? 0.3 : 0.7;
  const keep = () => addShoes(g, [{ xFrac: seed.lane === 'L' ? 0.7 : 0.3, nearCm: 600, farCm: 580 }]);
  walkUntil(g, () => { keep(); return seed.distCm < 30; });
  walkUntil(g, () => { addShoes(g, [{ xFrac: x, nearCm: seed.distCm + 15, farCm: seed.distCm - 15 }]); return seed.result !== null; }, 10);
  assert.equal(seed.result, 'miss');
  walkUntil(g, () => { keep(); return g.things.some((t) => t !== seed && !t.result); });
  const clear = g.things.find((t) => t !== seed && !t.result);
  walkUntil(g, () => { keep(); return clear.result !== null; }, 60);
  assert.equal(clear.result, 'hit');
  assert.ok(g.stats.dodge[0] >= 1);
});

test('a camera mark touches the thing; the line still decides', () => {
  const g = toGarden();
  walkUntil(g, () => g.things.length > 0);
  const th = g.things[0];
  const keep = () => addShoes(g, [{ xFrac: th.lane === 'L' ? 0.7 : 0.3, nearCm: 600, farCm: 580 }]);
  walkUntil(g, () => { keep(); return th.distCm < 20; });
  assert.equal(markHit(g, th.lane === 'L' ? 'R' : 'L', 'flower', th.distCm), null);   // other lane: nothing
  assert.equal(markHit(g, th.lane, 'flower', th.distCm), th);
  assert.equal(th.result, null);                                                      // not yet: the line decides
  walkUntil(g, () => { keep(); return th.result !== null; }, 10);
  assert.equal(th.result, 'hit');
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
  const g = newGame({});
  addShoes(g, [{ xFrac: 0.2, nearCm: -40, farCm: -70 }, { xFrac: 0.4, nearCm: -40, farCm: -70 }]);   // both feet left of centre
  assert.deepEqual(g.shoes.map((s) => s.lane), ['L', 'R']);
  addShoes(g, [{ xFrac: 0.4, nearCm: -40, farCm: -70 }]);
  assert.equal(g.shoes[0].lane, 'R');       // right of the midpoint 0.3, although left of the field centre
  resetShoes(g);
  assert.deepEqual(g.shoes, []);
});

test('rounds: flowers and seeds repeat before home, and the summary counts them', () => {
  const g = newGame({ walkSeconds: 2, gardenPlants: 2, stormSeeds: 2, rounds: 2 });
  const acts = [];
  walkUntil(g, () => { if (acts[acts.length - 1] !== g.act) acts.push(g.act); return g.act === 'home'; }, 300);
  assert.deepEqual(acts, ['walk', 'garden', 'storm', 'garden', 'storm', 'home']);
  assert.equal(summary(g).rounds, 2);
});


// ---------- the report: what the summary keeps for the gait review ----------
test('the summary counts steps per foot and samples the pace every 15 s', () => {
  const g = newGame({ walkSeconds: 100 }, 1);   // stays in act 1
  walk(g, 31, 0.6);                             // 100 steps per minute, alternating feet
  const s = summary(g);
  assert.equal(s.stepsByFoot.L + s.stepsByFoot.R, s.steps);
  assert.ok(Math.abs(s.stepsByFoot.L - s.stepsByFoot.R) <= 1);
  assert.deepEqual(s.timeline.map((r) => r.t), [15, 30]);
  for (const r of s.timeline) {
    assert.ok(Math.abs(r.cadence - 100) <= 3, `cadence ${r.cadence}`);
    assert.ok(r.evenPct >= 95, `even ${r.evenPct}`);
    assert.equal(r.act, 'walk');
  }
});

test('the pace timeline keeps the newest 120 samples', () => {
  const g = newGame({}, 1);
  for (let i = 0; i < 121 * 15; i++) step(g, 1);   // standing still: samples with cadence 0
  const s = summary(g);
  assert.equal(s.timeline.length, 120);
  assert.equal(s.timeline[0].t, 30);
  assert.equal(s.timeline[119].t, 121 * 15);
  assert.equal(s.timeline[0].cadence, 0);
  assert.equal(s.timeline[0].evenPct, null);
});

test('lift rules: hits per lane and the timing of the lift that counted (+ = late)', () => {
  const g = toGarden({ gardenPlants: 2 });
  g.things = [];
  g.spawned = g.limits.gardenPlants;   // no more spawns
  const t0 = g.t;
  g.things.push({ id: 101, kind: 'flower', lane: 'L', distCm: 0, arriveT: t0, result: null });
  g.things.push({ id: 102, kind: 'flower', lane: 'R', distCm: 0, arriveT: t0, result: null });
  addEvent(g, { foot: 'L', kind: 'lift', liftCm: 30, t: t0 + 0.2 });   // late by 0.2 s
  step(g, 0.4); step(g, 0.4);
  const s = summary(g);
  assert.deepEqual(s.byLane.flower, { L: [1, 1], R: [0, 1] });
  assert.deepEqual(s.byLane.seed, { L: [0, 0], R: [0, 0] });
  assert.deepEqual(s.timingS, { L: 0.2, R: null });
  assert.equal(g.log.find((r) => r.id === 101).liftCm, 30);
  assert.equal(s.placementCm, null);   // no shoes in this game
  assert.equal(s.swingCm, null);
});

test('shoe mode: the report keeps how close the shoe came to each flower, and the swings, not the lift timing', () => {
  const g = toGarden({ gardenPlants: 2 });
  const xOf = (th) => (th.lane === 'L' ? 0.3 : 0.7);
  const keep = (th) => addShoes(g, [{ xFrac: th.lane === 'L' ? 0.7 : 0.3, nearCm: 600, farCm: 580 }]);   // shoe mode live, touching nothing
  walkUntil(g, () => g.things.length > 0);
  const first = g.things[0];
  walkUntil(g, () => { keep(first); return first.distCm < 80; });
  // a shoe planted on the hit line as the flower crosses it
  walkUntil(g, () => { addShoes(g, [{ xFrac: xOf(first), nearCm: 15, farCm: -15 }]); return first.result !== null; }, 10);
  assert.equal(first.result, 'hit');
  walkUntil(g, () => { keep(first); return g.things.some((t) => t !== first && !t.result); });
  const second = g.things.find((t) => t !== first && !t.result);
  walkUntil(g, () => { keep(second); return second.distCm < 80; });
  // a shoe a metre back on the belt: the flower gets away
  walkUntil(g, () => { addShoes(g, [{ xFrac: xOf(second), nearCm: -85, farCm: -115 }]); return second.result !== null; }, 10);
  assert.equal(second.result, 'miss');
  const near = g.log.find((r) => r.id === first.id).placementCm;
  const far = g.log.find((r) => r.id === second.id).placementCm;
  assert.ok(near <= 10, `near ${near}`);
  assert.ok(far >= 70, `far ${far}`);
  const s = summary(g);
  for (const lane of ['L', 'R']) {
    const v = g.log.filter((r) => r.lane === lane && r.placementCm !== undefined).map((r) => r.placementCm);
    assert.equal(s.placementCm[lane], v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null);
  }
  assert.equal(s.timingS, null);   // judged by the shoes, not by a lift
  const w = newGame({ walkSeconds: 2 }, 1);
  shoeWalk(w, 6, 0.6);
  const sw = summary(w).swingCm;
  assert.ok(sw.L > 60 && sw.L < 140 && sw.R > 60 && sw.R < 140, `swings ${JSON.stringify(sw)}`);
});
