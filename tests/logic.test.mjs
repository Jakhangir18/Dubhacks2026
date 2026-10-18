import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, ROUND_TYPES, beatCm, plan, warnGate, newGame, step, addEvent, addShoes, shoesLive, resetShoes, markHit, pace, form, applyParams, summary, needCm, startAt, speedScale } from '../web/logic.js';
import { ENDING, ROUND_ACTS, ROUND_LINES, endingLine, roundLine } from '../web/lore.js';

const DT = 0.05;

// Walk in place: alternate feet every `gap` seconds, starting at the current game time.
// The alternation and the next step time live on the game, so consecutive calls keep walking smoothly.
function walk(g, seconds, gap = 0.6, lift = 4) {
  if (g._nextStepT === undefined) { g._nextStepT = g.t; g._foot = 'L'; }
  const end = g.t + seconds;
  while (g.t < end) walkFrame(g, gap, lift);
}

// One frame of that walk: the step that is due lands, then the rules advance; returns what step() reported.
function walkFrame(g, gap = 0.6, lift = 4) {
  if (g._nextStepT === undefined) { g._nextStepT = g.t; g._foot = 'L'; }
  if (g.t >= g._nextStepT) {
    addEvent(g, { foot: g._foot, kind: 'strike' });
    if (lift !== null) addEvent(g, { foot: g._foot, kind: 'lift', liftCm: lift });
    g._foot = g._foot === 'L' ? 'R' : 'L';
    g._nextStepT += gap;
  }
  return step(g, DT);
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
  assert.equal(beat(100, 1), 3 * 50);       // 2 steps would be a tie with 1: the floor of 3 holds
  assert.equal(beat(220), 7 * 35);          // 6.3 steps: 7
  assert.equal(beat(90, 2), 3 * 100);       // under one step: the floor of 3
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

test('every fourth flower is golden and scores triple; petals bank every hit and never burn; rounds speed up', () => {
  const g = toGarden({ gardenPlants: 5, rounds: 2 });
  const feed = () => {   // the shoe sits on every flower that crosses, except the fifth: a miss between hits
    const th = g.things.find((t) => !t.result);
    const on = th && g.log.length !== 4 && th.distCm < 30;
    addShoes(g, [on ? { xFrac: th.lane === 'L' ? 0.3 : 0.7, nearCm: th.distCm + 10, farCm: th.distCm - 10 } : { xFrac: 0.5, nearCm: 600, farCm: 580 }]);
  };
  const untilLog = (n) => walkUntil(g, () => { feed(); return g.log.length >= n; }, 90);
  untilLog(4);
  assert.deepEqual(g.log.map((l) => !!l.golden), [false, false, false, true]);   // the fourth flower is golden
  assert.ok(g.log.every((l) => l.result === 'hit'));
  assert.deepEqual(g.stats.golden, [1, 1]);
  assert.equal(g.stats.petals, 4);
  assert.equal(g.stats.bouquets, 1);
  untilLog(5);
  assert.equal(g.log[4].result, 'miss');
  assert.equal(g.stats.petals, 4, 'a miss burns no petals');
  assert.equal(g.stats.bouquets, 1);
  walkUntil(g, () => { feed(); return g.round === 2; }, 60);
  assert.ok(Math.abs(speedScale(g) - 0.9) < 1e-9, `round 2 is faster: ${speedScale(g)}`);
});

test('a golden hit scores three times a plain one at the same form and streak', () => {
  const at = (golden) => {
    const g = toGarden({ gardenPlants: 1 });
    walkUntil(g, () => g.things.length > 0);
    const th = g.things[0];
    th.golden = golden;
    const x = th.lane === 'L' ? 0.3 : 0.7;
    walkUntil(g, () => { addShoes(g, [{ xFrac: x, nearCm: th.distCm + 10, farCm: th.distCm - 10 }]); return th.result !== null; }, 30);
    assert.equal(th.result, 'hit');
    return g.score;
  };
  const plain = at(false), gold = at(true);
  assert.ok(plain > 0);
  assert.ok(Math.abs(gold - 3 * plain) <= 2, `golden ${gold} vs plain ${plain}`);   // rounding only
});

test('with no seeds the rounds are flowers only, lanes alternate, and each flower comes an odd number of steps after the last', () => {
  const g = newGame({ walkSeconds: 1, gardenPlants: 4, rounds: 2 });   // stormSeeds defaults to 0
  const acts = [g.act], roundStarts = new Set();
  const beat = beatCm(g);
  assert.equal(beat, 3 * RULES.strideCm * 0.7);   // 140 cm at the default plant speed snaps to 3 steps
  let gaps = 0;
  walkUntil(g, () => {
    const key = g.act === 'garden' ? `garden ${g.round}` : g.act;
    if (key !== acts[acts.length - 1]) { acts.push(key); roundStarts.add(g.log.length); }   // a round's first flower follows the foot
    const live = g.things.filter((th) => !th.result), beatNow = beatCm(g);   // round 2 is faster: a longer beat in cm
    for (let i = 1; i < live.length; i++) {   // things on the floor sit exactly one beat apart, whatever the frame
      assert.ok(Math.abs(live[i].distCm - live[i - 1].distCm - beatNow) < 1e-6, `gap ${live[i].distCm - live[i - 1].distCm}`);
      gaps += 1;
    }
    return g.act === 'home';
  }, 120);
  assert.ok(gaps > 0);
  assert.deepEqual(acts, ['walk', 'garden 1', 'rest', 'garden 2', 'home']);   // a rest between rounds, walked through
  assert.equal(g.log.length, 8);
  assert.ok(g.log.every((l) => l.kind === 'flower'));
  for (let i = 1; i < g.log.length; i++) if (!roundStarts.has(i)) assert.notEqual(g.log[i].lane, g.log[i - 1].lane, 'lanes alternate');
  assert.equal(summary(g).beatCm, 135);      // the spacing as played in round 2: 3 steps at plant speed 0.9
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

test('shoe mode window: a foot on the flower a second before the line counts, two seconds before does not', () => {
  const touchWhile = (lo, hi) => {   // the shoe sits on the next flower only while it is between lo and hi cm from the line
    const g = toGarden();
    walkUntil(g, () => g.things.length > 0);
    const th = g.things[0];
    const x = th.lane === 'L' ? 0.3 : 0.7;
    const away = { xFrac: th.lane === 'L' ? 0.7 : 0.3, nearCm: 600, farCm: 580 };   // shoe mode live, touching nothing
    walkUntil(g, () => {
      const on = th.distCm > lo && th.distCm < hi;
      addShoes(g, [on ? { xFrac: x, nearCm: th.distCm + 10, farCm: th.distCm - 10 } : away]);
      return th.result !== null;
    }, 30);
    return th.result;
  };
  assert.equal(touchWhile(50, 65), 'hit');     // about 1.0 s before arrival at 100 steps a minute: inside shoeBeforeS
  assert.equal(touchWhile(95, 115), 'miss');   // about 1.8 s before: outside the window, a real miss
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
  assert.deepEqual(acts, ['walk', 'garden', 'storm', 'rest', 'garden', 'storm', 'home']);   // a rest between rounds, walked through
  assert.equal(summary(g).rounds, 2);
});

// ---------- round types: what each garden round brings (limits.roundPlan) ----------
test('the round plan: by default limits.rounds rounds of flowers; an explicit plan sets the rounds; unknown names play flowers', () => {
  assert.deepEqual(plan(newGame()).roundPlan, ['flowers', 'flowers']);
  assert.deepEqual(plan(newGame({ rounds: 3 })), { rounds: 3, seeds: false, roundPlan: ['flowers', 'flowers', 'flowers'] });
  const three = plan(newGame({ rounds: 2, roundPlan: ['flowers', 'seedStomp', 'slippers'] }));
  assert.equal(three.rounds, 3);                       // the plan wins over limits.rounds
  assert.deepEqual(three.roundPlan, ['flowers', 'seedStomp', 'slippers']);
  assert.deepEqual(plan(newGame({ roundPlan: 'slippers, seedStomp' })).roundPlan, ['slippers', 'seedStomp']);   // a list typed as text
  assert.deepEqual(plan(newGame({ roundPlan: ['seedstomp', 'constructor', 'slippers'] })).roundPlan, ['flowers', 'flowers', 'slippers']);
  assert.deepEqual(plan(newGame({ rounds: 2, roundPlan: [] })).roundPlan, ['flowers', 'flowers']);   // empty: from rounds
  assert.deepEqual(plan(newGame({ rounds: 3, roundPlan: ' , ' })).roundPlan, ['flowers', 'flowers', 'flowers']);   // blank text too
  assert.deepEqual(plan(newGame({ roundPlan: 'seedStomp,slippers,' })).roundPlan, ['seedStomp', 'slippers']);   // a trailing comma adds no round
  assert.deepEqual(plan(newGame({ roundPlan: 'flowers seedStomp;slippers' })).roundPlan, ['flowers', 'seedStomp', 'slippers']);   // a URL '+' is a space
  assert.deepEqual(ROUND_TYPES, ['flowers', 'seedStomp', 'slippers']);
});

test('each garden round brings its own type on the same beat: flowers, then Pip’s seeds, then Rosa’s slippers, all to step on', () => {
  const g = newGame({ walkSeconds: 1, gardenPlants: 3, roundPlan: ['flowers', 'seedStomp', 'slippers'] });
  const acts = [];
  walkUntil(g, () => {
    const key = g.act === 'garden' || g.act === 'rest' ? `${g.act} ${g.round} ${g.roundType}` : g.act;
    if (acts[acts.length - 1] !== key) acts.push(key);
    const live = g.things.filter((th) => !th.result);
    for (let i = 1; i < live.length; i++) assert.ok(Math.abs(live[i].distCm - live[i - 1].distCm - beatCm(g)) < 1e-6, 'one beat apart');
    return g.act === 'home';
  }, 200);
  assert.deepEqual(acts, ['walk', 'garden 1 flowers', 'rest 2 seedStomp', 'garden 2 seedStomp', 'rest 3 slippers', 'garden 3 slippers', 'home']);   // a rest knows what comes next
  assert.deepEqual(g.log.map((r) => r.kind), ['flower', 'flower', 'flower', 'seed', 'seed', 'seed', 'slipper', 'slipper', 'slipper']);
  assert.deepEqual(g.log.map((r) => r.roundType), ['flowers', 'flowers', 'flowers', 'seedStomp', 'seedStomp', 'seedStomp', 'slippers', 'slippers', 'slippers']);
  assert.ok(g.log.every((r) => r.target === true));
  for (let i = 1; i < g.log.length; i++) {   // lanes alternate inside a round (a round's first thing follows the foot)
    if (g.log[i].roundType === g.log[i - 1].roundType) assert.notEqual(g.log[i].lane, g.log[i - 1].lane, 'lanes alternate');
  }
});

test('seed stomp: a shoe on Pip’s seed at the line squishes it (hit); a seed nobody steps on rolls past (miss)', () => {
  const g = toGarden({ roundPlan: ['seedStomp'] });
  walkUntil(g, () => g.things.length > 0);
  const seed = g.things[0];
  assert.equal(seed.kind, 'seed');
  assert.equal(seed.target, true);
  const keep = () => addShoes(g, [{ xFrac: seed.lane === 'L' ? 0.7 : 0.3, nearCm: 600, farCm: 580 }]);   // shoe mode live, touching nothing
  walkUntil(g, () => { keep(); return seed.distCm < 30; });
  const x = seed.lane === 'L' ? 0.3 : 0.7;
  walkUntil(g, () => { addShoes(g, [{ xFrac: x, nearCm: seed.distCm + 15, farCm: seed.distCm - 15 }]); return seed.result !== null; }, 10);
  assert.equal(seed.result, 'hit');
  walkUntil(g, () => { keep(); return g.things.some((t) => t !== seed && !t.result); });
  const next = g.things.find((t) => t !== seed && !t.result);
  walkUntil(g, () => { keep(); return next.result !== null; }, 60);
  assert.equal(next.result, 'miss');
  assert.deepEqual(g.stats.stomp, [1, 2]);   // counted with the stomps, not the dodges
  assert.deepEqual(g.stats.dodge, [0, 0]);
  assert.equal(g.stats.petals, 1);           // a squished seed banks a petal like a flower
});

test('seed stomp scores like flowers: the same points for one hit, and every fourth seed is golden', () => {
  const oneHit = (roundPlan) => {
    const g = toGarden({ gardenPlants: 1, roundPlan });
    walkUntil(g, () => g.things.length > 0);
    const th = g.things[0];
    const x = th.lane === 'L' ? 0.3 : 0.7;
    walkUntil(g, () => { addShoes(g, [{ xFrac: x, nearCm: th.distCm + 10, farCm: th.distCm - 10 }]); return th.result !== null; }, 30);
    assert.equal(th.result, 'hit');
    return g.score;
  };
  assert.ok(oneHit(['flowers']) > 0);
  assert.equal(oneHit(['seedStomp']), oneHit(['flowers']));
  assert.equal(oneHit(['seedStomp']), RULES.points.stomp);   // full form, no streak: a stomp's points, not a dodge's
  const g = toGarden({ gardenPlants: 4, roundPlan: ['seedStomp'] });
  walkUntil(g, () => g.act === 'home', 120);
  assert.deepEqual(g.log.map((r) => [r.kind, !!r.golden]), [['seed', false], ['seed', false], ['seed', false], ['seed', true]]);
});

test('the storm act still dodges: after a seed-stomp round its seeds are the ones to keep clear of', () => {
  const g = toGarden({ roundPlan: ['seedStomp'], stormSeeds: 2 });
  startAt(g, 'storm');
  assert.equal(g.act, 'storm');
  assert.equal(g.roundType, 'seedStomp');
  walkUntil(g, () => g.things.length > 0);
  const seed = g.things[0];
  assert.equal(seed.kind, 'seed');
  assert.equal(seed.target, false);
  const keep = () => addShoes(g, [{ xFrac: seed.lane === 'L' ? 0.7 : 0.3, nearCm: 600, farCm: 580 }]);
  walkUntil(g, () => { keep(); return seed.distCm < 30; });
  const x = seed.lane === 'L' ? 0.3 : 0.7;
  walkUntil(g, () => { addShoes(g, [{ xFrac: x, nearCm: seed.distCm + 15, farCm: seed.distCm - 15 }]); return seed.result !== null; }, 10);
  assert.equal(seed.result, 'miss');         // stepped on: splat
  walkUntil(g, () => { keep(); return g.things.some((t) => t !== seed && !t.result); });
  const clear = g.things.find((t) => t !== seed && !t.result);
  walkUntil(g, () => { keep(); return clear.result !== null; }, 60);
  assert.equal(clear.result, 'hit');         // kept clear: dodged
  assert.deepEqual(g.stats.dodge, [1, 2]);
  assert.deepEqual(g.stats.stomp, [0, 0]);
  assert.equal(g.stats.petals, 0);           // a dodge banks no petal
  assert.ok(g.log.every((r) => r.target === false && r.roundType === undefined));
});

test('lift rules: a seed to squish asks for a stomp-high step on time, not the storm’s higher dodge', () => {
  const g = toGarden({ gardenPlants: 1, roundPlan: ['seedStomp'], liftCm: 10 });
  walkUntil(g, () => g.things.length > 0);
  const seed = g.things[0];
  const stomp = needCm(g, 'flower', seed.lane);
  assert.equal(needCm(g, seed, seed.lane), stomp);           // a thing answers for itself
  assert.ok(needCm(g, 'seed', seed.lane) > stomp);           // the kind name alone still means the storm's dodge
  assert.equal(needCm(g, 'slipper', seed.lane), stomp);
  assert.equal(needCm(g, undefined, seed.lane), needCm(g, 'seed', seed.lane));   // no thing: the dodge, as before, never a throw
  walkUntil(g, () => seed.arriveT !== null);
  addEvent(g, { foot: seed.lane, kind: 'lift', liftCm: stomp, t: seed.arriveT });
  walkUntil(g, () => seed.result !== null);
  assert.equal(seed.result, 'hit');
});

test('Rosa’s slippers come in pairs, one in each lane: both stepped on make a pair and a bonus; a missed one breaks its pair', () => {
  const g = toGarden({ gardenPlants: 5, roundPlan: ['slippers'] });
  const judged = [];   // per judged slipper: the points it brought, whether the step reported a pair, the form then
  for (const end = g.t + 120; g.act === 'garden' && g.t < end;) {
    const th = g.things.find((t) => !t.result);
    const on = th && th.distCm < 30 && g.log.length !== 3;   // the fourth slipper gets away
    addShoes(g, [on ? { xFrac: th.lane === 'L' ? 0.3 : 0.7, nearCm: th.distCm + 10, farCm: th.distCm - 10 } : { xFrac: 0.5, nearCm: 600, farCm: 580 }]);
    const before = g.score, n = g.log.length;
    const out = walkFrame(g);
    if (g.log.length > n) judged.push({ gained: g.score - before, pair: !!out.pair, form: out.form });
  }
  assert.equal(g.act, 'home');
  assert.deepEqual(g.log.map((r) => [r.kind, r.result]),
    [['slipper', 'hit'], ['slipper', 'hit'], ['slipper', 'hit'], ['slipper', 'miss'], ['slipper', 'hit']]);
  assert.deepEqual(g.log.map((r) => r.pair), [1, 1, 2, 2, 3]);   // the fifth has no partner
  for (const [a, b] of [[0, 1], [2, 3]]) assert.notEqual(g.log[a].lane, g.log[b].lane, 'a pair is one slipper in each lane');
  assert.deepEqual(judged.map((j) => j.pair), [false, true, false, false, false]);   // once, as the pair's second slipper is judged
  assert.deepEqual(g.stats.pairs, [1, 2]);          // two pairs decided, one made
  assert.deepEqual([judged[0].form, judged[1].form], [1, 1], 'full form for the made pair');
  assert.equal(judged[0].gained, RULES.points.stomp);                       // the first of a pair is a plain stomp
  assert.equal(judged[1].gained, RULES.points.stomp + RULES.points.pair);   // the second brings the pair bonus too
  assert.equal(judged[3].gained, 0);                                        // a missed slipper breaks its pair: no bonus
  assert.equal(g.stats.petals, 0);                  // slippers pair up instead of banking petals
  assert.ok(g.log.every((r) => !r.golden));
  assert.equal(summary(g).placementCm, null);       // shoe-to-flower distance: no flowers, no value (the report labels it so)
});

test('the summary keeps the round plan, the hit share of each round type and the slipper pairs; flower numbers stay flower numbers', () => {
  const g = toGarden({ gardenPlants: 2, roundPlan: ['flowers', 'seedStomp', 'slippers'] });
  for (const end = g.t + 200; g.act !== 'home' && g.t < end;) {   // step on everything but the first seed
    const th = g.things.find((t) => !t.result);
    const on = th && th.distCm < 30 && !(th.kind === 'seed' && !g.log.some((r) => r.kind === 'seed'));
    addShoes(g, [on ? { xFrac: th.lane === 'L' ? 0.3 : 0.7, nearCm: th.distCm + 10, farCm: th.distCm - 10 } : { xFrac: 0.5, nearCm: 600, farCm: 580 }]);
    walkFrame(g);
  }
  const s = summary(g);
  assert.equal(s.act, 'home');
  assert.deepEqual(s.roundPlan, ['flowers', 'seedStomp', 'slippers']);
  assert.equal(s.rounds, 3);
  assert.deepEqual(s.roundTypePct, { flowers: 100, seedStomp: 50, slippers: 100 });
  assert.deepEqual(s.slipperPairs, [1, 1]);
  assert.equal(s.targetPct, 83);                    // 5 of the 6 things to step on, whatever their kind
  assert.equal(s.stompPct, 100);                    // the flowers alone: the server and the report label it so
  assert.equal(s.dodgePct, null);                   // nothing to keep clear of in this walk
  assert.deepEqual(s.byLane.seed, { L: [0, 0], R: [0, 0] });   // per-lane dodges: a squished seed is not one
  const sides = (lanes) => lanes.L[1] + lanes.R[1];
  assert.deepEqual([sides(s.byLane.flower), sides(s.byLane.seedStomp), sides(s.byLane.slippers)], [2, 2, 2]);
  assert.equal(s.byLane.seedStomp.L[0] + s.byLane.seedStomp.R[0], 1);   // one seed squished, one rolled past
  const flowersOnly = summary(newGame());
  assert.deepEqual(flowersOnly.roundPlan, ['flowers', 'flowers']);
  assert.deepEqual(flowersOnly.roundTypePct, { flowers: null, seedStomp: null, slippers: null });   // nothing played yet
  assert.deepEqual(flowersOnly.slipperPairs, [0, 0]);
});

test('camera marks follow the rule, not the kind: the cyan mark touches what is stepped on, the magenta one what is kept clear of', () => {
  const g = toGarden({ roundPlan: ['seedStomp'] });
  walkUntil(g, () => g.things.length > 0);
  const seed = g.things[0];
  const keep = () => addShoes(g, [{ xFrac: seed.lane === 'L' ? 0.7 : 0.3, nearCm: 600, farCm: 580 }]);
  walkUntil(g, () => { keep(); return seed.distCm < 20; });
  assert.equal(markHit(g, seed.lane, 'seed', seed.distCm), null);     // magenta: only under the storm's seeds
  assert.equal(markHit(g, seed.lane, 'flower', seed.distCm), seed);   // cyan: under everything to step on
  walkUntil(g, () => { keep(); return seed.result !== null; }, 10);
  assert.equal(seed.result, 'hit');
  const storm = toGarden({ stormSeeds: 1 });
  startAt(storm, 'storm');
  walkUntil(storm, () => storm.things.length > 0);
  const dodge = storm.things[0];
  walkUntil(storm, () => dodge.distCm < 20);
  for (const other of ['magenta', 'slipper', undefined]) assert.equal(markHit(storm, dodge.lane, other, dodge.distCm), null);   // not a mark name
  assert.equal(dodge.touchedT, undefined);
  assert.equal(markHit(storm, dodge.lane, 'flower', dodge.distCm), null);
  assert.equal(markHit(storm, dodge.lane, 'seed', dodge.distCm), dodge);
});

test('the tale covers every round type, and the home card counts the slipper pairs Rosa got back', () => {
  for (const type of ROUND_TYPES) {
    const a = ROUND_ACTS[type];
    assert.ok(a?.title.split(' · ')[1] && a.intro.length && a.hint && a.how, `act lines for ${type}`);   // the HUD shows the part after the dot
    assert.match(a.hint, /high step/i, `the lift rules' hint for ${type}: every target asks for a stomp-high step`);
    assert.ok(ROUND_LINES[type], `round line for ${type}`);
  }
  assert.match(roundLine(4, 'nonsense'), /^Round 4! .*Golden flowers/);   // past the written rounds, and an unknown type
  assert.equal(endingLine({}), ENDING);                                 // a summary from before round types
  assert.equal(endingLine({ slipperPairs: [0, 0] }), ENDING);           // no slipper round
  assert.match(endingLine({ slipperPairs: [0, 2] }), /still wants her slippers/);
  assert.match(endingLine({ slipperPairs: [0, 0], roundTypePct: { slippers: 100 } }), /got some of her slippers/);   // found, never paired
  assert.match(endingLine({ slipperPairs: [0, 0], roundTypePct: { slippers: 0 } }), /still wants her slippers/);
  assert.match(endingLine({ slipperPairs: [1, 2] }), /got 1 pair of slippers/);
  assert.match(endingLine({ slipperPairs: [3, 3] }), /got 3 pairs of slippers/);
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
