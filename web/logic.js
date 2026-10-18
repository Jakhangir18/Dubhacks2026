// Zombie Walk Home: pure game rules. No DOM, no camera; runs in the browser and in Node tests.
// Floor mode: the player steps in place in the walking zone; the world moves towards them at a
// speed set by their cadence. Units: cm, seconds, steps per minute.
//
// Acts: 'walk' (keep a steady pace for walkSeconds) -> 'garden' (stomp flowers with the matching foot)
//       -> 'storm' (lift the targeted foot over seed balls) -> 'home'.

export const LIMITS = {          // set by the therapist (Therapist panel); the coach adapts inside them
  minCadence: 80,                // steps per minute needed to move forward
  walkSeconds: 45,               // act 1 length, counted only while the pace is good
  gardenPlants: 12,              // act 2 length
  stormSeeds: 10,                // act 3 length
  liftCm: 10,                    // lift needed to dodge a seed
  liftRange: [6, 18],            // the coach may move liftCm only inside this range
  spacingCm: 140,                // distance between plants
  spacingRange: [90, 220],
  speedScale: 1,                 // how fast plants come, times the walking speed (0.3 to 2)
};

export const RULES = {
  strideCm: 50,                  // nominal distance per step used to turn cadence into world speed
  aheadCm: 420,                  // plants appear this far ahead of the walking zone
  // Walking in place lands every step in its own lane, so a plain step must not count.
  // A stomp is a high step (marching) timed to the flower; a dodge is an even higher lift timed to the seed.
  // Heights are relative to the player's own normal step height measured in act 1.
  stompExtraCm: 4,               // stomp: lift at least this much above the normal step height
  dodgeExtraCm: 7,               // dodge: at least this much above normal (and never below limits.liftCm)
  defaultBaseCm: 4,              // normal step height if act 1 measured nothing
  beforeS: 0.6,                  // the lift may peak up to this long before arrival
  afterS: 0.35,                  // or this long after
  paceHorizonS: 5,               // cadence is measured over this window
  stopAfterS: 1.5,               // no step for this long means the player stopped
  points: { stomp: 10, dodge: 15 },
};

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function newGame(limits = {}, seed = 1) {
  return {
    limits: { ...LIMITS, ...limits },
    rand: rng(seed),
    t: 0,
    act: 'walk',
    actT: 0,                     // seconds spent in the current act
    walkGoodS: 0,                // act 1 seconds at a good pace
    travelledCm: 0,
    nextSpawnCm: 0,
    spawned: 0,
    nextId: 1,
    things: [],                  // flowers and seeds on the floor
    events: [],                  // foot events, newest last; each may be used once
    strikes: [],                 // {t, foot} for cadence and symmetry
    score: 0,
    streak: 0,
    formSum: 0, formN: 0,
    stats: { stomp: [0, 0], dodge: [0, 0], lifts: { L: [], R: [] }, steps: 0 },
    walkLifts: { L: [], R: [] },   // act 1 lifts: the player's normal step height
    base: null,                    // {L, R} normal step height, set when act 1 ends
    log: [],                     // resolved things for the report and the UI
    actResolved: 0,              // things resolved in the current act (progress bar)
  };
}

// ---------- events ----------
// {foot:'L'|'R', kind:'strike'} or {foot, kind:'lift', liftCm}
export function addEvent(g, ev) {
  const e = { ...ev, t: ev.t ?? g.t, used: false };
  if (e.foot !== 'L' && e.foot !== 'R') return null;
  g.events.push(e);
  if (g.events.length > 300) g.events.splice(0, g.events.length - 300);
  if (e.kind === 'strike') {
    g.strikes.push({ t: e.t, foot: e.foot });
    g.stats.steps += 1;
    if (g.strikes.length > 60) g.strikes.shift();
  }
  if (e.kind === 'lift' && Number.isFinite(e.liftCm)) {
    const arr = g.stats.lifts[e.foot];
    arr.push(e.liftCm);
    if (arr.length > 200) arr.shift();
    if (g.act === 'walk') g.walkLifts[e.foot].push(e.liftCm);
  }
  return e;
}

// ---------- pace and form ----------
export function pace(g, now = g.t) {
  const recent = g.strikes.filter((s) => now - s.t <= RULES.paceHorizonS);
  // Cadence from the span of recent steps, so it is right after three steps, not after the full window;
  // zero once the player has stopped stepping for a moment.
  const last = recent.length ? recent[recent.length - 1].t : -Infinity;
  const span = recent.length >= 3 ? last - recent[0].t : 0;
  const cadence = span > 0 && now - last <= RULES.stopAfterS ? ((recent.length - 1) / span) * 60 : 0;
  const feet = new Set(recent.map((s) => s.foot));
  // symmetry: compare mean step time ending on each foot
  const gaps = { L: [], R: [] };
  for (let i = 1; i < recent.length; i++) gaps[recent[i].foot].push(recent[i].t - recent[i - 1].t);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const mL = mean(gaps.L), mR = mean(gaps.R);
  const asym = mL !== null && mR !== null && mL + mR > 0 ? Math.abs(mL - mR) / ((mL + mR) / 2) : null;
  const ok = cadence >= g.limits.minCadence && feet.size === 2;
  return { cadence: Math.round(cadence), ok, bothFeet: feet.size === 2, asym };
}

// 0..1: pace, both feet, symmetry. Multiplies points; the HUD shows it as the form meter.
export function form(p) {
  if (!p.bothFeet) return 0;
  let f = p.ok ? 0.7 : 0.35;
  if (p.asym !== null) f += p.asym < 0.1 ? 0.3 : p.asym < 0.2 ? 0.15 : 0;
  return Math.min(1, f);
}

// ---------- spawning ----------
function spawnThing(g) {
  const lane = g.rand() < 0.5 ? 'L' : 'R';
  const kind = g.act === 'garden' ? 'flower' : 'seed';
  const th = { id: g.nextId++, kind, lane, distCm: RULES.aheadCm, arriveT: null, result: null };
  g.things.push(th);
  g.spawned += 1;
  return th;
}

function quota(g) {
  return g.act === 'garden' ? g.limits.gardenPlants : g.act === 'storm' ? g.limits.stormSeeds : 0;
}

// ---------- judging ----------
function takeEvent(g, pred) {
  const e = g.events.find((ev) => !ev.used && pred(ev));
  if (e) e.used = true;
  return e || null;
}

function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

// Height a lift must reach on this foot for this kind of thing.
export function needCm(g, kind, foot) {
  const base = g.base ? g.base[foot] : RULES.defaultBaseCm;
  const max = g.limits.liftRange[1];     // never ask for more than the therapist allows
  return kind === 'flower' ? Math.min(max, base + RULES.stompExtraCm) : Math.min(max, Math.max(g.limits.liftCm, base + RULES.dodgeExtraCm));
}

function judge(g, th) {
  const need = needCm(g, th.kind, th.lane);
  return takeEvent(g, (e) => e.kind === 'lift' && e.foot === th.lane && e.liftCm >= need &&
    e.t >= th.arriveT - RULES.beforeS && e.t <= th.arriveT + RULES.afterS);
}

// ---------- main step ----------
// Advance by dt seconds. Returns {resolved: [...], actChanged: bool, pace, form}.
export function step(g, dt) {
  g.t += dt;
  g.actT += dt;
  const p = pace(g);
  const f = form(p);
  if (g.act !== 'home') { g.formSum += f * dt; g.formN += dt; }   // time-weighted, independent of frame rate
  const scale = Math.min(2, Math.max(0.3, Number(g.limits.speedScale) || 1));
  const speed = p.ok ? (p.cadence / 60) * RULES.strideCm * scale : 0;   // the world waits when the pace drops
  const moved = speed * dt;
  g.travelledCm += moved;
  const out = { resolved: [], actChanged: false, pace: p, form: f, speed };

  if (g.act === 'walk') {
    if (p.ok) g.walkGoodS += dt;
    if (g.walkGoodS >= g.limits.walkSeconds) nextAct(g, out);
    return out;
  }
  if (g.act === 'home') return out;

  while (g.spawned < quota(g) && g.travelledCm >= g.nextSpawnCm) {
    spawnThing(g);
    g.nextSpawnCm = g.travelledCm + g.limits.spacingCm;
  }
  for (const th of g.things) {
    if (th.result) continue;
    th.distCm -= moved;
    if (th.arriveT === null && th.distCm <= 0) th.arriveT = g.t;
    if (th.arriveT !== null && g.t - th.arriveT > RULES.afterS) {
      const hit = judge(g, th);
      th.result = hit ? 'hit' : 'miss';
      const key = th.kind === 'flower' ? 'stomp' : 'dodge';
      g.stats[key][1] += 1;
      if (hit) {
        g.stats[key][0] += 1;
        g.streak += 1;
        g.score += Math.round(RULES.points[key] * (0.5 + 0.5 * f) * (g.streak >= 5 ? 2 : 1));
      } else {
        g.streak = 0;
      }
      g.log.push({ id: th.id, kind: th.kind, lane: th.lane, result: th.result, t: g.t });
      g.actResolved += 1;
      out.resolved.push(th);
    }
  }
  g.things = g.things.filter((th) => !th.result || g.t - th.arriveT < 1.5);
  const done = g.spawned >= quota(g) && g.things.every((th) => th.result);
  if (done) nextAct(g, out);
  return out;
}

function nextAct(g, out) {
  if (g.act === 'walk') {
    g.base = {
      L: median(g.walkLifts.L) ?? RULES.defaultBaseCm,
      R: median(g.walkLifts.R) ?? RULES.defaultBaseCm,
    };
  }
  g.act = { walk: 'garden', garden: 'storm', storm: 'home' }[g.act];
  g.actT = 0;
  g.actResolved = 0;
  g.spawned = 0;
  g.nextSpawnCm = g.travelledCm + 60;
  g.things = [];
  out.actChanged = true;
}

// Development and demo shortcut: start at an act as if the earlier acts were done with normal steps.
export function startAt(g, act) {
  if (act !== 'garden' && act !== 'storm') return;
  g.base = { L: RULES.defaultBaseCm, R: RULES.defaultBaseCm };
  g.act = 'walk';
  if (act === 'storm') g.act = 'garden';
  nextAct(g, { actChanged: false });
}

// Coach adjustments are clamped to the therapist's ranges.
export function applyParams(g, params = {}) {
  const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));
  if (Number.isFinite(params.liftCm)) g.limits.liftCm = clamp(params.liftCm, g.limits.liftRange);
  if (Number.isFinite(params.spacingCm)) g.limits.spacingCm = clamp(params.spacingCm, g.limits.spacingRange);
}

export function summary(g) {
  const pct = ([h, n]) => (n ? Math.round((100 * h) / n) : null);
  const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
  const p = pace(g);
  return {
    seconds: Math.round(g.t),
    act: g.act,
    steps: g.stats.steps,
    cadence: p.cadence,
    asymmetryPct: p.asym === null ? null : Math.round(p.asym * 100),
    stompPct: pct(g.stats.stomp),
    dodgePct: pct(g.stats.dodge),
    liftAvgCm: { L: avg(g.stats.lifts.L), R: avg(g.stats.lifts.R) },
    liftMaxCm: { L: g.stats.lifts.L.length ? Math.max(...g.stats.lifts.L) : null, R: g.stats.lifts.R.length ? Math.max(...g.stats.lifts.R) : null },
    highLiftAvgCm: {   // only deliberate high steps (stomps and dodges), the number a therapist cares about
      L: avg(g.stats.lifts.L.filter((x) => x >= needCm(g, 'flower', 'L'))),   // same (capped) height the game asks for
      R: avg(g.stats.lifts.R.filter((x) => x >= needCm(g, 'flower', 'R'))),
    },
    formPct: g.formN ? Math.round((100 * g.formSum) / g.formN) : 0,
    score: g.score,
    liftTargetCm: g.limits.liftCm,
    spacingCm: g.limits.spacingCm,
    normalStepCm: g.base,
  };
}
