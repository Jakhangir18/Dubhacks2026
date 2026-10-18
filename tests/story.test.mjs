import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, step, addEvent, summary } from '../web/logic.js';
import { actStory, targetTexture, coachNumbers } from '../web/lore.js';

test('three demo rounds have distinct skins and name the completed round at rest, with 18 flower judgments', () => {
  const g = newGame({ walkSeconds: 8, gardenPlants: 6, stormSeeds: 0, rounds: 3 });
  const rounds = new Map(), rests = [], seen = new Set();
  let nextStep = 0, left = true;
  while (g.act !== 'home' && g.t < 300) {
    if (g.t >= nextStep) {
      addEvent(g, { foot: left ? 'L' : 'R', kind: 'strike' });
      addEvent(g, { foot: left ? 'L' : 'R', kind: 'lift', liftCm: 16 });
      left = !left; nextStep += .6;
    }
    const out = step(g, .05);
    if (out.actChanged && g.act === 'rest') rests.push(actStory(g.act, g.round).title);
    for (const th of g.things) {
      assert.equal(th.kind, 'flower', 'visual peas must never enter the rules');
      if (!seen.has(th.id)) {
        seen.add(th.id);
        const keys = rounds.get(g.round) || new Set();
        keys.add(targetTexture(g.round, th.id)); rounds.set(g.round, keys);
      }
    }
  }
  assert.equal(g.act, 'home');
  assert.deepEqual(rests, ['ROUND 1 DONE', 'ROUND 2 DONE']);
  assert.deepEqual([...rounds.get(1)].sort(), ['flower', 'flower-bell', 'flower-rose']);
  assert.deepEqual([...rounds.get(2)], ['spitter']);
  assert.deepEqual([...rounds.get(3)], ['spikeweed']);
  assert.equal(g.stats.stomp[1], 18);
  assert.equal(summary(g).byLane.flower.L[1] + summary(g).byLane.flower.R[1], 18);
});

test('rest measurements label units and withhold missing camera measurements', () => {
  const text = coachNumbers({ cadence: 96, asymmetryPct: 8, formPct: 82,
    highLiftAvgCm: { L: 12, R: null }, timingS: null, placementCm: null,
    sideCamera: { cadence: 94, toe_lift_cm: { L: 5, R: null }, speed_m_s: .6 } });
  assert.match(text, /96 steps\/min/);
  assert.match(text, /Even L\/R 92%/);
  assert.match(text, /High step: L 12 \/ R — cm/);
  assert.match(text, /Side camera 94 steps\/min/);
  assert.match(text, /Toe lift: L 5 \/ R — cm/);
  assert.match(text, /Speed 0.6 m\/s/);
  assert.doesNotMatch(text, /Timing|Placement|null|undefined/);
});
