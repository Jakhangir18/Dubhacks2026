// Zombie Walk Home: pure game rules. No DOM, no camera; runs in the browser and in Node tests.
// Floor mode: the player steps in place in the walking zone; the world moves towards them at a
// speed set by their cadence. Units: cm, seconds, steps per minute.
//
// Acts: 'walk' (keep a steady pace for walkSeconds) -> 'garden' (stomp flowers with the matching foot)
//       -> 'storm' (lift the targeted foot over seed balls; only when stormSeeds > 0) -> 'home'.
// Flowers come on a beat: lanes alternate and each flower is an odd number of steps after the last, so a player
// who keeps a steady cadence meets every flower with the other foot.

export const LIMITS = {          // set by the therapist (Therapist panel); the coach adapts inside them
  minCadence: 80,                // steps per minute needed to move forward
  walkSeconds: 45,               // act 1 length, counted only while the pace is good
  gardenPlants: 12,              // act 2 length
  stormSeeds: 0,                 // act 3 length; 0 leaves the seeds out: flowers only, rounds of them
  liftCm: 10,                    // lift needed to dodge a seed
  liftRange: [6, 18],            // the coach may move liftCm only inside this range
  spacingCm: 140,                // distance between plants, snapped to an odd number of steps (3 at the default plant speed)
  spacingRange: [90, 220],
  speedScale: 0.7,               // how fast plants come, times the walking speed (0.3 to 2); 1 felt too fast on the pad
  rounds: 2,                     // flowers then seeds, this many times, before home
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
  // Shoe mode has a wider window: the foot may be on the thing from this long before it reaches the line (about
  // 70 cm at a normal pace, the floor says NOW! from there) to this long after. A touch outside it is a miss.
  shoeBeforeS: 1.2,
  shoeAfterS: 0.5,
  paceHorizonS: 5,               // cadence is measured over this window
  // The world never freezes while the player walks: below the minimum pace it runs at this share of the minimum
  // and act 1 fills at this rate; only standing still stops it. The pace shows in the form score and the cues.
  slowFloor: 0.7,
  slowFill: 0.5,
  stopAfterS: 1.5,               // no step for this long means the player stopped
  // The world speed eases towards what the cadence asks (time constants in s), so a pace change, a missed step
  // or a stop glides instead of jerking the plants; below restCmS with no cadence it is at rest.
  speedUpS: 0.6,
  slowDownS: 1.0,
  restCmS: 1,
  // The pace warning follows a leaky share of recent time at a bad pace (time constant paceWarnS): it comes on above
  // paceWarnOn (about 1.6 s of a bad pace) and goes off below paceWarnOff (about 1.2 s of a good one), so one missed
  // step never flashes the floor and a pace that flips every second or so settles instead of flickering. Not before
  // paceGraceS. See warnGate.
  paceWarnS: 1.0,
  paceWarnOn: 0.8,
  paceWarnOff: 0.3,
  paceGraceS: 3,
  points: { stomp: 10, dodge: 15 },
  // Rounds stay interesting: every goldenEvery-th flower is golden (goldenX points, same beat), every flower hit is a
  // petal and bouquetPetals petals make a bouquet (petals never burn on a miss), and each round after the first adds
  // roundSpeedUp to the plant speed.
  goldenEvery: 4,
  goldenX: 3,
  bouquetPetals: 4,
  roundSpeedUp: 0.2,
  // Shoe mode (feet.py boxes on the camera): a flower is smashed when a shoe covers it, a seed splats; a thing
  // that passes the toes resolves the other way. Distances are world cm on the field.
  shoeReachCm: 30,               // margin around the shoe's span when matching a thing
  shoeFreshS: 0.5,               // a shoe sighting older than this is gone (the camera gives about 8 a second, with gaps)
  shoeSwingCm: 40,               // a shoe must travel this far forward, then back, to count as one step (box jitter is under 20)
  shoeStepMinS: 0.3,             // one landing per foot at most this often
  swingCmPerLiftCm: 7.5,         // world cm of forward swing on the belt per cm of 'lift': a long or high step swings far
  toeCm: 300,                    // how far past the hit line the toes are; the game sets it from its layout
  shoeHoldS: 3,                  // shoes drive the game this long after the last sighting, then the lift rules return
  shoeGapS: 2,                   // a lane unseen this long starts its swing tracking afresh (a quarter of frames see no sock)
  stanceS: 6,                    // the toe line follows where the shoes have stood over this window
  stanceMarginCm: 30,            // a thing is gone only this far behind the standing feet
  markReachCm: 90,               // a camera-seen foot-on-mark touches the nearest thing of that kind within this (the sock's centre is not the flower's)
  markShowCm: 90,                // the coloured mark shows under a thing from this far before the hit line
  timelineS: 15,                 // the report samples the pace this often (game seconds)
  timelineMax: 120,              // and keeps at most this many samples, the newest
};

export function newGame(limits = {}) {
  return {
    limits: { ...LIMITS, ...limits },
    t: 0,
    act: 'walk',
    round: 1,                    // which flowers-and-seeds round (1 to limits.rounds)
    actT: 0,                     // seconds spent in the current act
    walkGoodS: 0,                // act 1 seconds at a good pace
    speed: 0,                    // world speed in cm/s, eased towards the cadence
    paceGated: false,            // the pace warning (see RULES.paceWarnS)
    paceBad: 0,                  // leaky share of recent time at a bad pace, 0..1
    travelledCm: 0,
    nextSpawnCm: 0,              // travelledCm at which the next thing is due: the first on a step, then every beat
    spawnDist: RULES.aheadCm,    // where a thing due exactly now appears, from the hit line
    spawned: 0,
    nextId: 1,
    things: [],                  // flowers and seeds on the floor
    lastLane: null,              // the lane of the last thing spawned; the next takes the other
    events: [],                  // foot events, newest last; each may be used once
    strikes: [],                 // {t, foot} for cadence and symmetry
    score: 0,
    streak: 0,
    formSum: 0, formN: 0,
    stats: { stomp: [0, 0], dodge: [0, 0], golden: [0, 0], petals: 0, bouquets: 0, lifts: { L: [], R: [] }, steps: 0, stepsByFoot: { L: 0, R: 0 } },
    flowerN: 0,                  // flowers spawned so far: every goldenEvery-th is golden
    walkLifts: { L: [], R: [] },   // act 1 lifts: the player's normal step height
    base: null,                    // {L, R} normal step height, set when act 1 ends
    shoeMode: false,               // shoes were seen in this game (for the report); shoesLive() says whether they drive it now
    lastShoeT: null,
    shoeMidX: null,                // the midpoint between the two shoes when both were last seen: the lane divider for one shoe
    shoes: [],                     // latest sightings {lane, xFrac, nearCm, farCm, t}
    stance: [],                    // recent {t, nearCm} of every sighting: where the feet really stand
    shoeTrack: { L: { phase: 'back', max: -Infinity, min: Infinity, lastStrikeT: -Infinity }, R: { phase: 'back', max: -Infinity, min: Infinity, lastStrikeT: -Infinity } },
    toeCm: RULES.toeCm,
    toeBaseCm: null,               // the game's own toe line from its layout; the stance can only push it further
    log: [],                     // resolved things for the report and the UI
    actResolved: 0,              // things resolved in the current act (progress bar)
    swings: { L: [], R: [] },    // shoe mode: forward swing of every counted step, field cm (for the report)
    timeline: [],                // {t, cadence, evenPct, act} every timelineS, for the report
    nextTimelineT: RULES.timelineS,
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
    g.stats.stepsByFoot[e.foot] += 1;
    if (g.strikes.length > 60) g.strikes.shift();
    if (g.spawned === 0 && quota(g) > 0 && g.travelledCm >= g.nextSpawnCm) spawnOnStep(g, e.foot);
  }
  if (e.kind === 'lift' && Number.isFinite(e.liftCm)) {
    const arr = g.stats.lifts[e.foot];
    arr.push(e.liftCm);
    if (arr.length > 200) arr.shift();
    if (g.act === 'walk') { g.walkLifts[e.foot].push(e.liftCm); if (g.walkLifts[e.foot].length > 200) g.walkLifts[e.foot].shift(); }
  }
  return e;
}

// ---------- shoes ----------
// Sightings from the camera, already mapped onto the field: {xFrac: 0..1 across the field, nearCm, farCm} per shoe,
// nearCm and farCm being the span of the shoe measured from the hit line (negative on the belt). Two shoes take the
// lanes by order (left-most is the left foot); one shoe takes the side it is on. Each lane's forward-then-back
// swing on the belt counts as a step, so the pace gate and the cadence work as with any other sensor.
export function addShoes(g, shoes, t = g.t) {
  const seen = shoes.filter((s) => [s.xFrac, s.nearCm, s.farCm].every(Number.isFinite)).slice(0, 2)
    .sort((a, b) => a.xFrac - b.xFrac);
  if (!seen.length) return [];   // a missed frame changes nothing; a sighting stays valid for shoeFreshS anyway
  if (g.lastShoeT !== null && t - g.lastShoeT > RULES.shoeGapS) resetShoes(g);   // the feet were out of view
  g.shoeMode = true;
  g.lastShoeT = t;
  // The toe line follows the feet: a calibration a little off must not make things vanish before they reach them.
  for (const s of seen) g.stance.push({ t, nearCm: Math.max(s.nearCm, s.farCm) });
  while (g.stance.length && t - g.stance[0].t > RULES.stanceS) g.stance.shift();
  if (g.stance.length >= 10) {
    const sorted = g.stance.map((s) => s.nearCm).sort((a, b) => a - b);
    const rest = sorted[Math.floor(sorted.length * 0.25)];   // the feet at rest, not mid-swing
    g.toeCm = Math.max(g.toeBaseCm ?? RULES.toeCm, -rest + RULES.stanceMarginCm);   // follows the feet both ways
  }
  if (seen.length === 2) g.shoeMidX = (seen[0].xFrac + seen[1].xFrac) / 2;
  g.shoes = seen.map((s, i) => ({
    lane: seen.length === 2 ? (i === 0 ? 'L' : 'R') : (s.xFrac < (g.shoeMidX ?? 0.5) ? 'L' : 'R'),
    xFrac: s.xFrac, nearCm: Math.max(s.nearCm, s.farCm), farCm: Math.min(s.nearCm, s.farCm), t,
  }));
  for (const s of g.shoes) {
    const tr = g.shoeTrack[s.lane];
    const d = s.nearCm;
    if (tr.phase === 'back') {
      tr.min = Math.min(tr.min, d);
      if (d > tr.min + RULES.shoeSwingCm) { tr.phase = 'forward'; tr.max = d; }
    } else {
      tr.max = Math.max(tr.max, d);
      if (d < tr.max - RULES.shoeSwingCm) {   // the foot stopped going forward: it landed and the belt takes it back
        tr.phase = 'back';
        const swing = tr.max - tr.min;   // how far the foot travelled forward: a long or high step swings further
        tr.min = d;
        if (t - tr.lastStrikeT >= RULES.shoeStepMinS) {
          tr.lastStrikeT = t;
          g.swings[s.lane].push(Math.round(swing));
          if (g.swings[s.lane].length > 200) g.swings[s.lane].shift();
          // The swing stands in for the lift height, so act 1 learns a normal step and a seed asks for a bigger one.
          addEvent(g, { foot: s.lane, kind: 'lift', liftCm: Math.round((swing / RULES.swingCmPerLiftCm) * 10) / 10, t });
          addEvent(g, { foot: s.lane, kind: 'strike', t });
        }
      }
    }
  }
  return g.shoes;
}

// Shoes drive the game while sightings keep coming; a gap hands the game back to the lift rules.
export function shoesLive(g) {
  return g.lastShoeT !== null && g.t - g.lastShoeT <= RULES.shoeHoldS;
}

// After a pause or a gap: forget the sightings and the half-finished swings, so nothing lands on stale geometry.
export function resetShoes(g) {
  g.shoes = [];
  g.stance = [];
  g.toeCm = g.toeBaseCm ?? RULES.toeCm;
  g.lastShoeT = null;   // shoes drive the game again only from the next sighting
  for (const lane of ['L', 'R']) g.shoeTrack[lane] = { phase: 'back', max: -Infinity, min: Infinity, lastStrikeT: -Infinity };
}

// The camera saw a foot on a coloured mark the game draws under a thing near the hit line: cyan under flowers, magenta
// under seeds. The nearest unresolved thing of that kind in the lane is marked as touched; the line decides the result.
export function markHit(g, lane, kind, distCm) {
  const near = g.things.filter((th) => !th.result && th.kind === kind && th.lane === lane && th.distCm < RULES.markShowCm &&
    Math.abs(th.distCm - distCm) <= RULES.markReachCm).sort((a, b) => Math.abs(a.distCm - distCm) - Math.abs(b.distCm - distCm))[0];
  if (!near) return null;
  near.touchedT = g.t;
  return near;
}

function shoeOn(g, th) {
  return g.shoes.some((s) => s.lane === th.lane && g.t - s.t <= RULES.shoeFreshS &&
    th.distCm <= s.nearCm + RULES.shoeReachCm && th.distCm >= s.farCm - RULES.shoeReachCm);
}

// For the report only: how far the centre of a fresh shoe in the thing's lane is from it, null when none is seen.
function shoeGapCm(g, th) {
  let best = null;
  for (const s of g.shoes) {
    if (s.lane !== th.lane || g.t - s.t > RULES.shoeFreshS) continue;
    const gap = Math.abs((s.nearCm + s.farCm) / 2 - th.distCm);
    if (best === null || gap < best) best = gap;
  }
  return best;
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
function spawnThing(g, lane, distCm) {
  g.lastLane = lane;
  const kind = g.act === 'garden' ? 'flower' : 'seed';
  const golden = kind === 'flower' && ++g.flowerN % RULES.goldenEvery === 0;
  const th = { id: g.nextId++, kind, lane, distCm, arriveT: null, result: null, ...(golden && { golden: true }) };
  g.things.push(th);
  g.spawned += 1;
  return th;
}

// The first thing of an act appears on a landing, a whole number of steps from the hit line, in the lane of the
// foot that lands when it gets there; the rest follow on the beat, so a steady walker meets each with the other foot.
function spawnOnStep(g, foot) {
  const stepCm = RULES.strideCm * speedScale(g);
  const steps = Math.max(1, Math.floor(RULES.aheadCm / stepCm));   // whole steps, inside the field
  g.spawnDist = steps * stepCm;
  spawnThing(g, steps % 2 === 0 ? foot : foot === 'L' ? 'R' : 'L', g.spawnDist);
  g.nextSpawnCm = g.travelledCm + beatCm(g);   // the next is one beat after this landing
}

// The beat: the therapist's spacing in world cm, snapped to the nearest odd number of steps (ties go down; the world
// moves one stride times the plant speed per step): 3 steps at the defaults.
export function beatCm(g) {
  const stepCm = RULES.strideCm * speedScale(g);
  const steps = Math.max(1, 2 * Math.ceil(g.limits.spacingCm / stepCm / 2 - 1) + 1);
  return steps * stepCm;
}

function quota(g) {
  return g.act === 'garden' ? g.limits.gardenPlants : g.act === 'storm' ? g.limits.stormSeeds : 0;
}

// The act plan: how many rounds, and whether a round has a seed act after the flowers.
export function plan(g) {
  return { rounds: Math.max(1, Math.round(Number(g.limits.rounds) || 1)), seeds: Number(g.limits.stormSeeds) > 0 };
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
// Plant speed as step() applies it: the limit, clamped to 0.3-2, the default when missing.
export const SPEED_RANGE = [0.3, 2];
export function speedScale(g) {
  const v = Number(g.limits.speedScale);
  return Number.isFinite(v) ? Math.min(SPEED_RANGE[1], Math.max(SPEED_RANGE[0], v)) : LIMITS.speedScale;
}

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

// Frame-rate independent easing: the share of the gap to close this frame for a time constant tauS.
export function ease(dt, tauS) { return 1 - Math.exp(-dt / tauS); }

// The pace warning gate (see RULES.paceWarnS): feed it whether this frame's pace is bad; it returns the warning.
export function warnGate(g, bad, dt) {
  g.paceBad += ((bad ? 1 : 0) - g.paceBad) * ease(dt, RULES.paceWarnS);
  if (g.paceBad > RULES.paceWarnOn) g.paceGated = true;
  else if (g.paceBad < RULES.paceWarnOff) g.paceGated = false;
  return g.paceGated;
}

// ---------- main step ----------
// Advance by dt seconds. Returns {resolved: [...], actChanged: bool, pace, form, speed}.
export function step(g, dt) {
  g.t += dt;
  g.actT += dt;
  const p = pace(g);
  const f = form(p);
  p.gated = warnGate(g, !p.ok && g.t > RULES.paceGraceS, dt);
  if (g.act !== 'home') { g.formSum += f * dt; g.formN += dt; }   // time-weighted, independent of frame rate
  const scale = speedScale(g);
  const walking = p.cadence > 0;
  const cadence = p.ok ? p.cadence : walking ? Math.max(p.cadence, g.limits.minCadence * RULES.slowFloor) : 0;
  const target = (cadence / 60) * RULES.strideCm * scale;   // slow walking slows the world a little; standing still stops it
  // A stop glides to rest over about slowDownS of travel: a thing that close to the line still arrives and is judged
  // against the standing player, which is the feedback for breaking the beat.
  g.speed += (target - g.speed) * ease(dt, target > g.speed ? RULES.speedUpS : RULES.slowDownS);
  if (Math.abs(target - g.speed) < (target === 0 ? RULES.restCmS : 0.01)) g.speed = target;   // settle, never creep
  const speed = g.speed;
  const moved = speed * dt;
  g.travelledCm += moved;
  const out = { resolved: [], actChanged: false, pace: p, form: f, speed };
  if (g.act !== 'home' && g.t >= g.nextTimelineT) {   // a pace sample for the report
    g.nextTimelineT += RULES.timelineS;
    g.timeline.push({ t: Math.round(g.t), cadence: p.cadence, evenPct: p.asym === null ? null : Math.max(0, Math.round(100 - p.asym * 100)), act: g.act });
    if (g.timeline.length > RULES.timelineMax) g.timeline.shift();
  }

  if (g.act === 'walk') {
    if (p.ok) g.walkGoodS += dt;
    else if (walking) g.walkGoodS += dt * RULES.slowFill;   // slow walking still gets there, at half speed
    if (g.walkGoodS >= g.limits.walkSeconds) nextAct(g, out);
    return out;
  }
  if (g.act === 'home') return out;

  for (const th of g.things) {
    if (th.result) continue;
    th.distCm -= moved;
    if (th.arriveT === null && th.distCm <= 0) th.arriveT = g.t;
    if (shoesLive(g)) {
      // Everything is decided at the hit line: a shoe on the thing while it crosses (the timing window around arrival)
      // smashes a flower and splats on a seed; nothing on it means the flower got away and the seed was dodged.
      if (shoeOn(g, th)) th.touchedT = g.t;
      // The report: the closest a shoe came to the thing inside its timing window (the window the UI shows).
      const gap = th.arriveT !== null || th.distCm <= speed * RULES.shoeBeforeS ? shoeGapCm(g, th) : null;
      if (gap !== null && (th.placeCm === undefined || gap < th.placeCm)) th.placeCm = gap;
      if (th.arriveT !== null && g.t - th.arriveT > RULES.shoeAfterS) {
        const touched = th.touchedT !== undefined && th.touchedT >= th.arriveT - RULES.shoeBeforeS;
        resolve(g, th, (th.kind === 'flower') === touched ? 'hit' : 'miss', f, out);
      }
    } else if (th.arriveT !== null && g.t - th.arriveT > RULES.afterS) {
      const e = judge(g, th);
      resolve(g, th, e ? 'hit' : 'miss', f, out, e && { offsetS: Math.round((e.t - th.arriveT) * 100) / 100, liftCm: e.liftCm });
    }
  }
  // After the first (which waits for a landing, see spawnOnStep), each thing is due one beat further along and
  // appears exactly one beat behind the last, whatever the frame's overshoot: placed after this frame's move,
  // like the things already on the floor.
  while (g.spawned > 0 && g.spawned < quota(g) && g.travelledCm >= g.nextSpawnCm) {
    spawnThing(g, g.lastLane === 'L' ? 'R' : 'L', g.spawnDist - (g.travelledCm - g.nextSpawnCm));
    g.nextSpawnCm += beatCm(g);
  }
  g.things = g.things.filter((th) => !th.result || g.t - th.resolvedT < 1.5);
  const done = g.spawned >= quota(g) && g.things.every((th) => th.result);
  if (done) nextAct(g, out);
  return out;
}

// extra: what the report keeps about the lift that counted (lift rules only).
function resolve(g, th, result, f, out, extra = null) {
  th.result = result;
  th.resolvedT = g.t;
  const key = th.kind === 'flower' ? 'stomp' : 'dodge';
  g.stats[key][1] += 1;
  if (th.golden) g.stats.golden[1] += 1;
  if (result === 'hit') {
    g.stats[key][0] += 1;
    g.streak += 1;
    g.score += Math.round(RULES.points[key] * (0.5 + 0.5 * f) * (g.streak >= 5 ? 2 : 1) * (th.golden ? RULES.goldenX : 1));
    if (th.golden) g.stats.golden[0] += 1;
    if (th.kind === 'flower') {   // a petal for the bank; a full bouquet is announced once
      g.stats.petals += 1;
      if (g.stats.petals % RULES.bouquetPetals === 0) { g.stats.bouquets += 1; out.bouquet = true; }
    }
  } else {
    g.streak = 0;
  }
  g.log.push({ id: th.id, kind: th.kind, lane: th.lane, result, t: g.t, ...(th.golden && { golden: true }),
    ...(th.placeCm !== undefined && { placementCm: Math.round(th.placeCm) }), ...extra });
  g.actResolved += 1;
  out.resolved.push(th);
}

function nextAct(g, out) {
  if (g.act === 'walk') {
    g.base = {
      L: median(g.walkLifts.L) ?? RULES.defaultBaseCm,
      R: median(g.walkLifts.R) ?? RULES.defaultBaseCm,
    };
  }
  const { rounds, seeds } = plan(g);
  const roundEnd = seeds ? 'storm' : 'garden';
  if (g.act === roundEnd && g.round < rounds) {   // another round, a little faster
    g.round += 1;
    g.act = 'garden';
    g.limits.speedScale = Math.min(SPEED_RANGE[1], speedScale(g) + RULES.roundSpeedUp);
  }
  else g.act = { walk: 'garden', garden: seeds ? 'storm' : 'home', storm: 'home' }[g.act];
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
  if (act === 'storm' && !plan(g).seeds) act = 'garden';   // no seed act in this game
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
  // {L, R} means of a value the log or the swings hold per lane; null when the game never measured it.
  const perLane = (rows, digits = 1) => {
    if (!rows.length) return null;
    const mean = (lane) => {
      const v = rows.filter((r) => r.lane === lane).map((r) => r.v);
      return v.length ? Math.round((v.reduce((x, y) => x + y, 0) / v.length) * 10 ** digits) / 10 ** digits : null;
    };
    return { L: mean('L'), R: mean('R') };
  };
  const lanes = (kind) => Object.fromEntries(['L', 'R'].map((lane) => {
    const rows = g.log.filter((r) => r.kind === kind && r.lane === lane);
    return [lane, [rows.filter((r) => r.result === 'hit').length, rows.length]];
  }));
  return {
    seconds: Math.round(g.t),
    act: g.act,
    steps: g.stats.steps,
    cadence: p.cadence,
    asymmetryPct: p.asym === null ? null : Math.round(p.asym * 100),
    stompPct: pct(g.stats.stomp),
    goldenPct: pct(g.stats.golden),
    petals: g.stats.petals,
    bouquets: g.stats.bouquets,
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
    spacingCm: g.limits.spacingCm,                      // the therapist's setting
    beatCm: Math.round(beatCm(g)),                      // the spacing as played: the setting snapped to the beat
    stepCm: RULES.strideCm * speedScale(g),             // world cm per step at this plant speed (the beat's quantum)
    seedAct: plan(g).seeds,                             // false: the game had no seed act at all
    normalStepCm: g.base,
    shoeMode: g.shoeMode,
    rounds: g.round,
    stepsByFoot: { ...g.stats.stepsByFoot },
    byLane: { flower: lanes('flower'), seed: lanes('seed') },
    placementCm: perLane(g.log.filter((r) => r.kind === 'flower' && r.placementCm !== undefined).map((r) => ({ lane: r.lane, v: r.placementCm }))),
    timingS: perLane(g.log.filter((r) => r.offsetS !== undefined).map((r) => ({ lane: r.lane, v: r.offsetS })), 2),
    swingCm: perLane(['L', 'R'].flatMap((lane) => g.swings[lane].map((v) => ({ lane, v })))),
    timeline: [...g.timeline],
  };
}
