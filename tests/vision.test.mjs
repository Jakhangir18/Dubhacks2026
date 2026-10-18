import test from 'node:test';
import assert from 'node:assert/strict';

// vision.js emits through the bus on window; give Node a window to dispatch on.
globalThis.window = new EventTarget();
const { FootTracker } = await import('../web/vision.js');
const { FOOT_EVENT } = await import('../web/bus.js');

const W = 1280, H = 720, HEIGHT_CM = 160;
const CM_PER_PX = (0.246 * HEIGHT_CM) / (0.25 * H);   // knee 0.5 -> ankle 0.75 of the image height

// One frame of landmarks: each foot's lowest point sits `liftCm` above its own ground line.
function frame(lift, ground = { L: 0.9, R: 0.86 }) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  for (const [f, knee, ankle, heel, toe, x] of [['L', 25, 27, 29, 31, 0.4], ['R', 26, 28, 30, 32, 0.6]]) {
    const yLow = ground[f] - (lift[f] / CM_PER_PX) / H;
    lm[knee] = { x, y: 0.5, visibility: 1 };
    lm[ankle] = { x, y: 0.75, visibility: 1 };
    lm[toe] = { x: x + 0.02, y: yLow, visibility: 1 };        // toe is the lowest point
    lm[heel] = { x: x - 0.02, y: yLow - 0.03, visibility: 1 }; // heel higher than the toe
  }
  return lm;
}

// Walking in place: each foot lifts in a half-sine every `period` s, the right foot half a period later.
function lifts(t, period, peak) {
  const phase = (f) => ((t + (f === 'R' ? period / 2 : 0)) % period) / period;
  const one = (f) => (phase(f) < 0.4 ? peak[f] * Math.sin((Math.PI * phase(f)) / 0.4) : 0);
  return { L: one('L'), R: one('R') };
}

function run(seconds, peak, ground) {
  const tr = new FootTracker({ video: { videoWidth: W, videoHeight: H }, heightCm: HEIGHT_CM });
  const events = [];
  const h = (e) => events.push(e.detail);
  window.addEventListener(FOOT_EVENT, h);
  for (let t = 0; t < seconds; t += 1 / 30) tr.process(frame(lifts(t, 1.2, peak), ground), t);
  window.removeEventListener(FOOT_EVENT, h);
  return events;
}

test('each step gives one lift with the right height and one strike, per foot', () => {
  const ev = run(8, { L: 12, R: 7 });
  for (const [f, peak] of [['L', 12], ['R', 7]]) {
    const ls = ev.filter((e) => e.foot === f && e.kind === 'lift').slice(2);   // skip warm-up of the ground estimate
    const ss = ev.filter((e) => e.foot === f && e.kind === 'strike');
    assert.ok(ls.length >= 4, `${f}: ${ls.length} lifts`);
    for (const l of ls) assert.ok(Math.abs(l.liftCm - peak) < 1.5, `${f} lift ${l.liftCm} vs ${peak}`);
    assert.ok(Math.abs(ss.length - ev.filter((e) => e.foot === f && e.kind === 'lift').length) <= 1);
  }
});

test('a foot that rests higher in the image still lands (per-foot ground)', () => {
  const ev = run(8, { L: 10, R: 10 }, { L: 0.9, R: 0.82 });   // right foot rests 0.08 of the image higher
  const strikesR = ev.filter((e) => e.foot === 'R' && e.kind === 'strike').length;
  assert.ok(strikesR >= 5, `right strikes ${strikesR}`);
});

test('standing still emits nothing', () => {
  const ev = run(5, { L: 0, R: 0 });
  assert.equal(ev.length, 0);
});
