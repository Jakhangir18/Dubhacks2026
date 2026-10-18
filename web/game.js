// Zombie Walk Home: Phaser scenes, art, HUD and input. Rules live in logic.js.
// Floor projection, top-down: the bottom band is the walking zone; flowers and seeds come from the top.
import { newGame, step, addEvent, summary, needCm, startAt, applyParams, RULES } from './logic.js';
import { emitFoot, onFoot } from './bus.js';
import { mountCameraPanel } from './camera-panel.js';
import { connectBridge } from './bridge.js';

const Phaser = window.Phaser;
const Warp = window.Warp;

const C = { green: 0x7cff4f, yellow: 0xffe44d, magenta: 0xff2d95, cyan: 0x2de2ff, orange: 0xff9a1f,
  white: 0xffffff, red: 0xff4d4d, violet: 0x9b6bff, path: 0x10240f, zone: 0x163d12 };
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const TEXT = { fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', fontStyle: 'bold', color: '#ffffff',
  stroke: '#000000', strokeThickness: 8 };
const txt = (size, color = C.white) => ({ ...TEXT, fontSize: `${size}px`, color: hex(color) });

// ---------- shared state ----------
// URL options for development and screenshots: ?scene=play&act=garden&auto=1
const params = new URLSearchParams(location.search);
const settings = {
  voice: Warp.store.get('zombiewalk.voice', true),
  limits: {},                                       // the current player's limits from the server (therapist panel)
  player: Warp.store.get('zombiewalk.player', 'Player'),
  greeting: null,
};

// ---------- server calls; every one has an offline fallback ----------
async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

async function loadPlayer() {
  try {
    const p = await withTimeout(api(`/api/player/${encodeURIComponent(settings.player)}`), 3000);
    settings.limits = p.limits || {};
    if (params.get('demo') === '1') Object.assign(settings.limits, { walkSeconds: 8, gardenPlants: 4, stormSeeds: 4 });
    const plan = await withTimeout(api(`/api/plan/${encodeURIComponent(settings.player)}`), 6000);
    settings.greeting = plan.say;
  } catch { /* offline: default limits, local greeting */ }
}
loadPlayer();
// ?demo=1: a short game for judges and testing (also re-applied after the server limits load)
if (params.get('demo') === '1') Object.assign(settings.limits, { walkSeconds: 8, gardenPlants: 4, stormSeeds: 4 });

function say(text) {
  if (!settings.voice || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch { /* no audio device */ }
}

// ---------- keyboard input (development and fallback) ----------
// A normal step lifts the foot a little then lands; a high step lifts it high.
function keyStep(foot, liftCm) {
  emitFoot({ foot, kind: 'lift', liftCm });
  setTimeout(() => emitFoot({ foot, kind: 'strike' }), 150);
}
let autoWalk = null;
let autoFoot = 'L';
function toggleAutoWalk() {
  if (autoWalk) { clearInterval(autoWalk); autoWalk = null; return; }
  autoWalk = setInterval(() => { keyStep(autoFoot, 4); autoFoot = autoFoot === 'L' ? 'R' : 'L'; }, 600);
}

// ---------- camera and Raspberry Pi inputs ----------
const cameraPanel = mountCameraPanel();          // V: phone or webcam, live lift values
connectBridge((status) => { document.getElementById('bridge').textContent = status; });   // Pi events via the server

// ---------- projector corner warp ----------
const stage = document.getElementById('stage');
const handleLayer = document.getElementById('handles');
let corners = Warp.store.get(Warp.CORNERS_KEY, null);
let editingCorners = false;
function applyWarp() { Warp.apply(stage, corners); }
function toggleCorners() {
  editingCorners = !editingCorners;
  if (!editingCorners) { handleLayer.innerHTML = ''; return; }
  corners = corners || Warp.defaultCorners(innerWidth, innerHeight);
  Warp.handles(handleLayer, corners, (c) => { corners = c; Warp.store.set(Warp.CORNERS_KEY, c); applyWarp(); });
  applyWarp();
}

window.addEventListener('keydown', (e) => {
  if (e.repeat || ['INPUT', 'SELECT'].includes(e.target.tagName)) return;   // a held key must not fake a stream of steps
  const k = e.key.toLowerCase();
  const map = {
    a: () => keyStep('L', 4), d: () => keyStep('R', 4),
    q: () => keyStep('L', 16), e: () => keyStep('R', 16),
    w: toggleAutoWalk, c: toggleCorners,
    f: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()),
    m: () => { settings.voice = !settings.voice; Warp.store.set('zombiewalk.voice', settings.voice); },
    k: () => { const el = document.getElementById('keys'); el.hidden = !el.hidden; },
    v: () => cameraPanel.toggle(),
  };
  if (map[k]) { map[k](); e.preventDefault(); }
});

// ---------- art, drawn in code (own designs, high contrast for a dim projector) ----------
function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const done = (key, w, h) => { g.generateTexture(key, w, h); g.clear(); };

  // sunflower to stomp
  g.fillStyle(C.yellow);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.fillEllipse(64 + Math.cos(a) * 36, 64 + Math.sin(a) * 36, 34, 22);
  }
  g.fillStyle(C.orange); g.fillCircle(64, 64, 28);
  g.fillStyle(0x7a3b00);
  for (let i = 0; i < 7; i++) g.fillCircle(64 + Math.cos(i) * 12, 64 + Math.sin(i * 1.7) * 12, 3);
  done('flower', 128, 128);

  // seed-spitting pod plant
  g.fillStyle(0x2e8b2e); g.fillEllipse(34, 92, 44, 26); g.fillEllipse(94, 92, 44, 26);
  g.fillStyle(C.green); g.fillCircle(64, 56, 40);
  g.fillStyle(0x0b2a0b); g.fillCircle(64, 70, 18);
  g.fillStyle(C.magenta); g.fillCircle(64, 70, 11);
  g.fillStyle(C.white); g.fillCircle(48, 42, 9); g.fillCircle(80, 42, 9);
  g.fillStyle(0x000000); g.fillCircle(50, 44, 4); g.fillCircle(82, 44, 4);
  done('pod', 128, 128);

  // seed ball
  g.fillStyle(C.magenta, 0.35); g.fillCircle(32, 32, 30);
  g.fillStyle(C.magenta); g.fillCircle(32, 32, 20);
  g.fillStyle(C.white, 0.9); g.fillCircle(25, 25, 6);
  done('seed', 64, 64);

  // zombie footprint (right foot; flipped for the left)
  g.fillStyle(C.green); g.fillEllipse(40, 74, 50, 74);
  [[18, 30, 9], [30, 22, 8], [42, 20, 8], [54, 24, 7], [63, 32, 6]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
  done('foot', 80, 120);

  // particles
  g.fillStyle(C.yellow); g.fillEllipse(8, 5, 16, 10); done('petal', 16, 10);
  g.fillStyle(C.white); g.fillCircle(5, 5, 5); done('spark', 10, 10);
  g.fillStyle(0x6bdc3a); g.fillCircle(8, 8, 8); done('goo', 16, 16);

  // house with lit windows
  g.fillStyle(C.violet); g.fillTriangle(10, 90, 130, 10, 250, 90);
  g.fillStyle(0x3b2a5c); g.fillRect(34, 90, 192, 130);
  g.fillStyle(C.yellow); g.fillRect(56, 112, 44, 40); g.fillRect(160, 112, 44, 40);
  g.fillStyle(C.orange); g.fillRoundedRect(110, 150, 40, 70, 8);
  done('house', 260, 220);

  // tree
  g.fillStyle(0x1f5e1f); g.fillCircle(40, 40, 38);
  g.fillStyle(0x2f8f2f); g.fillCircle(32, 32, 22);
  done('tree', 80, 80);

  // zombie head (the player marker on the progress bar)
  g.fillStyle(0x8fd36b); g.fillCircle(40, 40, 36);
  g.fillStyle(C.white); g.fillCircle(27, 34, 10); g.fillCircle(53, 34, 12);
  g.fillStyle(0x000000); g.fillCircle(29, 36, 4); g.fillCircle(51, 37, 5);
  g.fillStyle(0x2a4a1a); g.fillRect(22, 56, 36, 5);
  g.fillStyle(0x000000); for (let x = 25; x < 58; x += 7) g.fillRect(x, 52, 2, 13);
  done('zombie', 80, 80);

  g.destroy();
}

class Boot extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    makeTextures(this);
    applyWarp();
    if (params.get('auto') === '1') toggleAutoWalk();
    const sample = { score: 180, formPct: 82, steps: 412, cadence: 96, stompPct: 75, dodgePct: 70, highLiftAvgCm: { L: 13.5, R: 11 } };
    const first = params.get('scene');
    if (first === 'home') this.scene.start('home', { summary: sample });   // development: preview the end screen
    else this.scene.start(first === 'play' ? 'play' : 'title');
  }
}

// ---------- title ----------
class Title extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    this.started = false;
    const { width: W, height: H } = this.scale;
    for (let i = 0; i < 14; i++) {
      this.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'tree').setAlpha(0.35).setScale(0.6 + Math.random());
    }
    this.add.image(W / 2, H * 0.22, 'house').setScale(Math.min(1.2, H / 600));
    this.add.text(W / 2, H * 0.47, 'ZOMBIE WALK HOME', txt(Math.round(Math.min(W / 11, 96)), C.green)).setOrigin(0.5);
    this.add.text(W / 2, H * 0.6, 'Walk in place to start', txt(40, C.yellow)).setOrigin(0.5);
    this.add.text(W / 2, H * 0.68, `or press Enter · player: ${settings.player}`, txt(26)).setOrigin(0.5);
    const z = this.add.image(W / 2, H * 0.84, 'zombie').setScale(1.4);
    this.tweens.add({ targets: z, y: z.y - 14, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const steps = [];
    this.off = onFoot((ev) => {
      if (ev.kind !== 'strike') return;
      steps.push(performance.now());
      while (steps.length && performance.now() - steps[0] > 3000) steps.shift();
      if (steps.length >= 4) this.go();
    });
    this.input.keyboard.on('keydown-ENTER', () => this.go());
    this.scale.on('resize', this.restartOnResize, this);
    this.events.once('shutdown', () => { this.off(); this.scale.off('resize', this.restartOnResize, this); });
  }
  restartOnResize() { if (!this.started) this.scene.restart(); }
  go() { if (!this.started) { this.started = true; this.scene.start('play'); } }
}

// ---------- the walk home ----------
const ACTS = {
  walk: { title: 'ACT 1 · WALK HOME', hint: 'Keep a steady pace', voice: 'Let us walk home. Keep a steady pace.' },
  garden: { title: 'ACT 2 · STOMP THE FLOWERS', hint: 'High step onto the glowing flower', voice: 'Flowers ahead. High step and stomp them.' },
  storm: { title: 'ACT 3 · SEED STORM', hint: 'Lift the foot the seed is aiming at', voice: 'Seed storm. Lift your foot high when a seed comes.' },
};

class Play extends Phaser.Scene {
  constructor() { super('play'); }

  create() {
    this.g = newGame(settings.limits, Date.now() % 100000);
    this.sprites = new Map();
    this.scroll = 0;
    this.lift = { L: 0, R: 0 };            // shown lift, decays
    this.footFlash = { L: 0, R: 0 };
    this.lastCue = 0;
    this.frameWall = performance.now();

    const { width: W, height: H } = this.scale;
    this.bg = this.add.graphics();
    this.trees = Array.from({ length: 10 }, (_, i) => this.add.image(i % 2 ? W * 0.07 : W * 0.93, (H / 10) * i, 'tree').setAlpha(0.5));
    this.house = this.add.image(W * 0.84, 76, 'house').setScale(0.22);
    this.pods = { L: this.add.image(0, 0, 'pod').setVisible(false).setScale(0.8), R: this.add.image(0, 0, 'pod').setVisible(false).setScale(0.8) };
    this.feet = { L: this.add.image(0, 0, 'foot').setFlipX(true).setAlpha(0.35), R: this.add.image(0, 0, 'foot').setAlpha(0.35) };
    this.hud = this.add.graphics();
    this.actText = this.add.text(24, 16, '', txt(30, C.green));
    this.scoreText = this.add.text(W - 24, 14, '', txt(34, C.yellow)).setOrigin(1, 0);
    this.paceText = this.add.text(W - 24, 100, '', txt(22)).setOrigin(1, 0);
    this.coachText = this.add.text(W / 2, H * 0.3, '', txt(34, C.cyan)).setOrigin(0.5);
    this.waitText = this.add.text(W / 2, H * 0.56, 'KEEP WALKING', txt(64, C.orange)).setOrigin(0.5).setVisible(false);
    this.banner = this.add.text(W / 2, H * 0.4, '', txt(64, C.green)).setOrigin(0.5).setAlpha(0);
    this.zombie = this.add.image(0, 0, 'zombie').setScale(0.45);

    this.fx = {
      petals: this.add.particles(0, 0, 'petal', { speed: { min: 150, max: 420 }, lifespan: 900, rotate: { min: 0, max: 360 },
        scale: { start: 1.6, end: 0.2 }, gravityY: 300, emitting: false }),
      sparks: this.add.particles(0, 0, 'spark', { speed: { min: 120, max: 360 }, lifespan: 600, scale: { start: 1.4, end: 0 },
        tint: [C.cyan, C.white, C.green], emitting: false }),
      goo: this.add.particles(0, 0, 'goo', { speed: { min: 60, max: 260 }, lifespan: 700, scale: { start: 1.5, end: 0.3 },
        emitting: false }),
    };

    this.off = onFoot((ev) => {
      if (this.paused) return;                          // the world is frozen; steps do not count
      // Stamp with the game clock, interpolated to the moment the event arrived between two frames,
      // so a slow frame rate does not bunch steps together.
      const e = addEvent(this.g, { ...ev, t: this.g.t + (performance.now() - this.frameWall) / 1000 });
      if (!e) return;
      if (e.kind === 'strike') this.footFlash[e.foot] = 1;
      if (e.kind === 'lift') this.lift[e.foot] = Math.max(this.lift[e.foot], e.liftCm);
    });
    this.events.once('shutdown', () => this.off());
    this.input.keyboard.on('keydown-SPACE', () => { this.paused = !this.paused; });
    if (settings.greeting) { this.coachText.setText(settings.greeting); setTimeout(() => say(settings.greeting), 2600); }
    const jump = params.get('act');
    if (jump) { startAt(this.g, jump); params.delete('act'); }   // development shortcut, first game only
    this.showAct();
  }

  layout() {
    const { width: W, height: H } = this.scale;
    const zoneY = H * 0.74;
    return { W, H, zoneY, top: H * 0.16, lanes: { L: W * 0.33, R: W * 0.67 } };
  }

  yFor(distCm, L) {
    return L.zoneY - (distCm / RULES.aheadCm) * (L.zoneY - L.top);
  }

  showAct() {
    const a = ACTS[this.g.act];
    if (!a) return;
    this.banner.setText(a.title).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 400, ease: 'Back.out' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 2200, duration: 600 });
    this.coachText.setText(a.hint);
    say(a.voice);
  }

  popText(x, y, text, color) {
    const t = this.add.text(x, y, text, txt(44, color)).setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 90, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  resolveFx(th, L) {
    const x = L.lanes[th.lane];
    const y = L.zoneY;
    if (th.kind === 'flower' && th.result === 'hit') { this.fx.petals.explode(26, x, y); this.popText(x, y - 40, 'SMASH!', C.yellow); }
    else if (th.kind === 'flower') this.popText(x, y - 40, 'higher step!', C.orange);
    else if (th.result === 'hit') { this.fx.sparks.explode(24, x, y); this.popText(x, y - 40, 'DODGED!', C.cyan); }
    else { this.fx.goo.explode(20, x, y); this.cameras.main.shake(160, 0.006); this.popText(x, y - 40, 'SPLAT', C.magenta); }
  }

  progress() {
    const g = this.g;
    if (g.act === 'walk') return Math.min(1, g.walkGoodS / g.limits.walkSeconds) / 3;
    if (g.act === 'garden') return 1 / 3 + Math.min(1, g.actResolved / g.limits.gardenPlants) / 3;
    if (g.act === 'storm') return 2 / 3 + Math.min(1, g.actResolved / g.limits.stormSeeds) / 3;
    return 1;
  }

  async askCoach() {
    const sum = summary(this.g);
    let cue;
    try {
      const out = await withTimeout(api('/api/coach', { player: settings.player, summary: sum }), 5000);
      if (out.params) applyParams(this.g, out.params);
      cue = out.say;
    } catch {
      cue = this.localCue(sum);
    }
    if (!this.sys.isActive() || !cue) return;
    this.coachText.setText(cue);
    say(cue);
  }

  localCue(sum) {
    if (sum.cadence < this.g.limits.minCadence) return 'A little faster, keep stepping';
    if (sum.asymmetryPct !== null && sum.asymmetryPct > 20) return 'Even steps, left and right the same';
    if (this.g.act === 'garden' && sum.stompPct !== null && sum.stompPct < 60) return 'Knee up high, then stomp the flower';
    if (this.g.act === 'storm' && sum.dodgePct !== null && sum.dodgePct < 60) return 'Lift the foot higher over the seed';
    return 'Great walking, keep it up';
  }

  update(_time, deltaMs) {
    if (this.paused) return;
    const dt = Math.min(1, deltaMs / 1000);   // only a stalled tab is capped: events arrive in real time, game time must keep up
    this.frameWall = performance.now();
    const out = step(this.g, dt);
    const L = this.layout();

    if (out.actChanged) {
      if (this.g.act === 'home') { this.scene.start('home', { summary: summary(this.g) }); return; }
      this.sprites.forEach((s) => s.destroy());
      this.sprites.clear();
      this.showAct();
    }
    for (const th of out.resolved) this.resolveFx(th, L);

    // coach cue every 20 s: the server therapist (Gemini inside the therapist's limits), local rules offline
    if (this.g.t - this.lastCue > 20) {
      this.lastCue = this.g.t;
      this.askCoach();
    }

    this.drawWorld(L, out, dt);
    this.drawThings(L);
    this.drawHud(L, out, dt);
  }

  drawWorld(L, out, dt) {
    const { W, H } = L;
    const pxPerCm = (L.zoneY - L.top) / RULES.aheadCm;
    this.scroll = (this.scroll + out.speed * dt * pxPerCm) % 80;
    const b = this.bg;
    b.clear();
    b.fillStyle(C.path); b.fillRect(W * 0.16, 0, W * 0.68, H);
    b.fillStyle(C.green, 0.5);
    for (let y = -80 + this.scroll; y < H; y += 80) b.fillRect(W / 2 - 4, y, 8, 44);   // moving centre line
    b.fillStyle(C.zone, 0.9); b.fillRect(0, L.zoneY - 30, W, H - L.zoneY + 30);
    b.lineStyle(6, C.green, 0.9); b.lineBetween(0, L.zoneY, W, L.zoneY);
    this.trees.forEach((t, i) => { t.y = ((i * H) / 10 + this.scroll * 2) % (H + 80) - 40; });
  }

  drawThings(L) {
    const g = this.g;
    const live = new Set();
    for (const th of g.things) {
      live.add(th.id);
      let s = this.sprites.get(th.id);
      if (!s) {
        s = this.add.image(L.lanes[th.lane], L.top, th.kind === 'flower' ? 'flower' : 'seed');
        this.sprites.set(th.id, s);
        if (th.kind === 'seed') { const pod = this.pods[th.lane]; this.tweens.add({ targets: pod, scale: 1.25, duration: 120, yoyo: true }); }
      }
      const y = this.yFor(Math.max(th.distCm, -40), L);
      const near = Math.max(0, 1 - th.distCm / RULES.aheadCm);
      s.setPosition(L.lanes[th.lane], y).setScale(0.55 + near * 0.65).setAlpha(th.result ? 0.25 : 1);
      if (th.kind === 'seed' && !th.result) s.setRotation(s.rotation + 0.15);
    }
    for (const [id, s] of this.sprites) if (!live.has(id)) { s.destroy(); this.sprites.delete(id); }
    const storm = g.act === 'storm';
    for (const lane of ['L', 'R']) this.pods[lane].setVisible(storm).setPosition(L.lanes[lane], L.top - 10);
  }

  drawHud(L, out, dt) {
    const { W, H } = L;
    const g = this.g;
    const h = this.hud;
    h.clear();

    // next thing per lane: ghost footprint and the lift needed
    const next = {};
    for (const th of g.things) if (!th.result && (!next[th.lane] || th.distCm < next[th.lane].distCm)) next[th.lane] = th;
    for (const lane of ['L', 'R']) {
      this.footFlash[lane] = Math.max(0, this.footFlash[lane] - dt * 3);
      this.lift[lane] = Math.max(0, this.lift[lane] - dt * 25);
      const th = next[lane];
      const urgent = th && th.distCm < 140;
      const pulse = urgent ? 0.55 + 0.45 * Math.sin(g.t * 14) : 0.3;
      this.feet[lane].setPosition(L.lanes[lane], L.zoneY + (H - L.zoneY) * 0.45)
        .setScale(Math.min(1.4, (H - L.zoneY) / 110))
        .setTint(urgent ? (th.kind === 'flower' ? C.yellow : C.magenta) : C.green)
        .setAlpha(Math.max(pulse, this.footFlash[lane]));
      // lift bar beside each footprint: current lift against the target line
      const bx = lane === 'L' ? L.lanes.L - W * 0.12 : L.lanes.R + W * 0.12;
      const barH = (H - L.zoneY) * 0.8;
      const by = H - 14;
      const scale = barH / 30;                       // 30 cm full bar
      h.fillStyle(0x222222); h.fillRect(bx - 12, by - barH, 24, barH);
      h.fillStyle(C.cyan); h.fillRect(bx - 12, by - Math.min(30, this.lift[lane]) * scale, 24, Math.min(30, this.lift[lane]) * scale);
      if (th) {
        const need = needCm(g, th.kind, lane);
        h.lineStyle(4, th.kind === 'flower' ? C.yellow : C.magenta); h.lineBetween(bx - 22, by - need * scale, bx + 22, by - need * scale);
      }
    }

    // progress to home: the zombie walks along the bar towards the house, which grows as it gets close
    const px = W * 0.2, pw = W * 0.5, py = 76;
    this.house.setPosition(px + pw + 50, py).setScale(0.18 + this.progress() * 0.14);
    h.fillStyle(0x222222); h.fillRoundedRect(px, py - 10, pw, 20, 10);
    h.fillStyle(C.green); h.fillRoundedRect(px, py - 10, Math.max(20, pw * this.progress()), 20, 10);
    this.zombie.setPosition(px + pw * this.progress(), py);

    // form meter
    const fc = out.form >= 0.7 ? C.green : out.form >= 0.4 ? C.yellow : C.red;
    h.fillStyle(0x222222); h.fillRoundedRect(W - 236, 66, 212, 20, 10);
    h.fillStyle(fc); h.fillRoundedRect(W - 236, 66, Math.max(20, 212 * out.form), 20, 10);

    // positions follow the current size (fullscreen or a projector resolution change)
    this.scoreText.setPosition(W - 24, 14);
    this.paceText.setPosition(W - 24, 100);
    this.coachText.setPosition(W / 2, H * 0.3);
    this.waitText.setPosition(W / 2, H * 0.56);
    this.banner.setPosition(W / 2, H * 0.4);
    this.trees.forEach((tr, i) => tr.setX(i % 2 ? W * 0.07 : W * 0.93));
    this.actText.setText(ACTS[g.act] ? ACTS[g.act].title : '');
    this.scoreText.setText(`${g.score} pts${g.streak >= 5 ? '  x2' : ''}`);
    this.paceText.setText(`form · ${out.pace.cadence} steps/min (min ${g.limits.minCadence})`);
    this.waitText.setVisible(!out.pace.ok && g.t > 3);
  }
}

// ---------- home ----------
class Home extends Phaser.Scene {
  constructor() { super('home'); }
  create(data) {
    const s = data.summary;
    const { width: W, height: H } = this.scale;
    const house = this.add.image(W / 2, H * 0.2, 'house').setScale(Math.min(1.0, H / 800));
    this.tweens.add({ targets: house, scale: house.scale * 1.06, duration: 600, yoyo: true, repeat: -1 });
    this.add.particles(W / 2, H * 0.2, 'spark', { speed: { min: 80, max: 260 }, lifespan: 1400, quantity: 2,
      tint: [C.yellow, C.green, C.cyan, C.magenta], scale: { start: 1.2, end: 0 } });
    this.add.text(W / 2, H * 0.43, 'HOME!', txt(80, C.green)).setOrigin(0.5);
    const lines = [
      `Score ${s.score}   ·   Form ${s.formPct}%`,
      `${s.steps} steps   ·   ${s.cadence} steps/min`,
      `Flowers stomped ${s.stompPct ?? 0}%   ·   Seeds dodged ${s.dodgePct ?? 0}%`,
      `High steps  left ${s.highLiftAvgCm?.L ?? '-'} cm   right ${s.highLiftAvgCm?.R ?? '-'} cm`,
    ];
    lines.forEach((l, i) => this.add.text(W / 2, H * 0.51 + i * 38, l, txt(26)).setOrigin(0.5));
    this.add.text(W / 2, H * 0.92, 'Press R to walk again', txt(24, C.yellow)).setOrigin(0.5);
    this.noteText = this.add.text(W / 2, H * 0.74, data.result ? data.result.note : 'The coach is writing your note…', { ...txt(22, C.cyan), wordWrap: { width: W * 0.8 }, align: 'center' }).setOrigin(0.5);
    this.rewardText = this.add.text(W / 2, H * 0.84, '', txt(26, C.magenta)).setOrigin(0.5);
    if (data.result) this.showResult(data.result);
    say(`You made it home. ${s.stompPct ?? 0} percent of flowers stomped. Great walking.`);
    this.input.keyboard.on('keydown-R', () => this.scene.start('title'));
    const again = () => this.scene.restart(data);
    this.scale.once('resize', again);
    this.events.once('shutdown', () => this.scale.off('resize', again));
    if (data.replay) return;
    data.replay = true;
    window.dispatchEvent(new CustomEvent('zombiewalk:session', { detail: s }));
    if (params.get('scene') === 'home') return;   // preview only, nothing to save
    const verified = (s.formPct ?? 0) >= 40;        // walking was verified for most of the session
    withTimeout(api('/api/session', { player: settings.player, summary: s, verified }), 15000)
      .then((result) => { data.result = result; if (this.sys.isActive()) this.showResult(result); })
      .catch(() => { if (this.sys.isActive()) this.noteText.setText('Saved on this laptop only (server offline).'); });
  }

  showResult(result) {
    this.noteText.setText(result.note || '');
    if (result.reward && result.receipt) {
      this.rewardText.setText(`Reward: ${result.reward.name}  ·  ${result.receipt.network}  ·  $${result.receipt.amountUsd}`);
      say(result.reward.line || `You earned ${result.reward.name}!`);
    }
  }
}

// ---------- boot ----------
window.zombieGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  backgroundColor: '#000000',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [Boot, Title, Play, Home],
});
