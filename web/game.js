// Zombie Walk Home: Phaser scenes, art, HUD and input. Rules live in logic.js.
// Floor projection, top-down: the bottom band is the walking zone; flowers and seeds come from the top.
import { newGame, step, addEvent, summary, needCm, startAt, applyParams, RULES } from './logic.js';
import { emitFoot, onFoot } from './bus.js';
import { mountCameraPanel } from './camera-panel.js';
import { connectBridge } from './bridge.js';
import { ACTS, ENDING } from './lore.js';
import { GardenSound } from './sound.js';
import { WalkClip, uploadClip } from './clip.js';
import { WalkingZone } from './zone.js';
import { AmbientGarden } from './ambient.js';
import { Perceiver } from './perceive.js';

const Phaser = window.Phaser;
const Warp = window.Warp;
const sound = new GardenSound(Warp.store);
const clip = new WalkClip();

const C = { green: 0x7cff4f, yellow: 0xffe44d, magenta: 0xff2d95, cyan: 0x2de2ff, orange: 0xff9a1f,
  white: 0xffffff, red: 0xff4d4d, violet: 0x9b6bff, path: 0x19352f, zone: 0x295d45 };
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const TEXT = { fontFamily: 'Trebuchet MS, system-ui, sans-serif', fontStyle: 'bold', color: '#ffffff',
  stroke: '#19352f', strokeThickness: 8 };
const txt = (size, color = C.white) => ({ ...TEXT, fontSize: `${Math.max(24, size)}px`, color: hex(color) });

// ---------- shared state ----------
// URL options for development and screenshots: ?scene=play&act=garden&auto=1
const params = new URLSearchParams(location.search);
const settings = {
  voice: Warp.store.get('zombiewalk.voice', true),
  limits: {},                                       // the current player's limits from the server (therapist panel)
  player: Warp.store.get('zombiewalk.player', 'Player'),
  greeting: null,
  perceptron: false,                                // consent on and a key on the server
};

// ---------- server calls; every one has an offline fallback ----------
async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

const DEMO = { walkSeconds: 8, gardenPlants: 4, stormSeeds: 4 };
// Called before every game, so limits saved in the therapist panel apply to the next walk without a reload.
async function loadPlayer() {
  const name = encodeURIComponent(settings.player);
  const [player, plan, status] = await Promise.allSettled([
    withTimeout(api(`/api/player/${name}`), 3000),
    withTimeout(api(`/api/plan/${name}`), 8000),
    withTimeout(api('/api/status'), 3000),
  ]);
  settings.limits = player.status === 'fulfilled' ? { ...player.value.limits } : {};
  settings.perceptron = player.status === 'fulfilled' && player.value.perceptronConsent === true &&
    status.status === 'fulfilled' && status.value.perceptron === true;
  if (params.get('demo') === '1') Object.assign(settings.limits, DEMO);
  settings.greeting = plan.status === 'fulfilled' ? plan.value.say : null;
}
let playerReady = loadPlayer();
if (params.get('demo') === '1') Object.assign(settings.limits, DEMO);   // ?demo=1: a short game for judges

let speechId = 0;
let currentUtterance = null;   // held so Chrome cannot garbage-collect it before onend fires
let unduckTimer = null;
function say(text) {
  if (!settings.voice || !window.speechSynthesis) return;
  const id = ++speechId;
  try {
    speechSynthesis.cancel();
    sound.duck(false);
    clearTimeout(unduckTimer);
    const u = new SpeechSynthesisUtterance(text);
    currentUtterance = u;
    u.rate = 1.05;
    const unduck = () => { if (id === speechId) { sound.duck(false); currentUtterance = null; clearTimeout(unduckTimer); } };
    // Safety net if onend never arrives: check after an estimated speaking time, and keep checking
    // while the voice is still talking, so the music never comes back mid-sentence.
    const check = () => {
      if (id !== speechId) return;
      if (window.speechSynthesis.speaking) unduckTimer = setTimeout(check, 1000);
      else unduck();
    };
    u.onstart = () => { if (id === speechId) sound.duck(true); };
    u.onend = u.onerror = unduck;
    unduckTimer = setTimeout(check, (String(text).split(/\s+/).length / 2.5 + 1) * 1000);
    speechSynthesis.speak(u);
  } catch { sound.duck(false); }
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
const perceiver = new Perceiver(cameraPanel.tracker);   // Perceptron second opinion on the same camera
if (params.has('scene')) window.zombiewalk = { perceiver, tracker: cameraPanel.tracker };   // development and end-to-end tests
connectBridge((status) => { document.getElementById('bridge').textContent = status; });   // Pi events via the server

// ---------- projector corner warp ----------
const zone = new WalkingZone();
new AmbientGarden(zone);
// Reuse the event and payload. The ambient canvas never allocates objects in its frame loop.
const gardenState = { cadence: 0, act: 'title', paceOk: true, paused: false,
  title: '', score: '', coach: '', pace: '', progress: 0 };
const gardenEvent = new CustomEvent('zombiewalk:pace', { detail: gardenState });
function publishGarden(values) { Object.assign(gardenState, values); window.dispatchEvent(gardenEvent); }
function reaction(value) { window.dispatchEvent(new CustomEvent('zombiewalk:reaction', { detail: value })); }
// A resize while zone setup has the scene paused (F for fullscreen) must not bring it back on top of the preview.
function restartWhenShown(scene, data) {
  if (!scene.sys.isPaused()) { scene.scene.restart(data); return; }
  if (scene.restartQueued) return;
  scene.restartQueued = true;
  scene.events.once('resume', () => { scene.restartQueued = false; scene.scene.restart(data); });
}

function openZone() {
  const game = window.zombieGame;
  if (!game || zone.active || !game.scene.isActive('title') && !game.scene.isActive('play') && !game.scene.isActive('home')) return;
  const scenes = game.scene.getScenes(true);
  const play = scenes.find(scene => scene.sys.settings.key === 'play');
  const home = scenes.find(scene => scene.sys.settings.key === 'home');
  const homeResult = home?.homeData.result;
  const homeShare = home?.homeData.share;
  for (const scene of scenes) { scene.scene.pause(); scene.scene.setVisible(false); }
  sound.setMusic(false); clip.setPaused(true);
  game.scene.start('zone');
  zone.open(() => {
    game.scene.stop('zone');
    for (const scene of scenes) { scene.scene.resume(); scene.scene.setVisible(true); }
    if (play) play.frameWall = performance.now();
    // A session response or clip upload may have completed while Home was paused.
    if (home) {
      if (home.homeData.result && home.homeData.result !== homeResult) home.showResult(home.homeData.result);
      if (home.homeData.share && home.homeData.share !== homeShare) home.showShare(home.homeData.share);
      else if (!home.homeData.share && home.homeData.shareStatus) { home.shareText.setText(home.homeData.shareStatus); home.layoutCard(); }
    }
    sound.setMusic(!!play && !play.paused); clip.setPaused(!!play?.paused);
  });
}

window.addEventListener('keydown', (e) => {
  sound.unlock();
  if (e.repeat || ['INPUT', 'SELECT'].includes(e.target.tagName)) return;   // a held key must not fake a stream of steps
  const k = e.key.toLowerCase();
  const map = {
    a: () => keyStep('L', 4), d: () => keyStep('R', 4),
    q: () => keyStep('L', 16), e: () => keyStep('R', 16),
    w: toggleAutoWalk, c: openZone, z: openZone,
    f: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()),
    m: () => {
      settings.voice = !settings.voice; Warp.store.set('zombiewalk.voice', settings.voice);
      if (!settings.voice) { ++speechId; window.speechSynthesis?.cancel(); sound.duck(false); }
    },
    n: () => sound.toggle(),
    k: () => { const el = document.getElementById('keys'); el.hidden = !el.hidden; },
    v: () => cameraPanel.toggle(),
  };
  if (zone.active && ['a', 'd', 'q', 'e', 'w', 'c', 'z'].includes(k)) return;
  if (map[k]) { map[k](); e.preventDefault(); }
});

// ---------- original local SVG art; procedural art remains the per-file fallback ----------
const ART = {
  'gus-idle': [160, 192], 'gus-step': [160, 192], 'gus-celebrate': [160, 192],
  zombie: [80, 80, 'gus-portrait'],
  flower: [128, 128, 'flower-marigold'], 'flower-bell': [128, 128], 'flower-rose': [128, 128],
  pod: [128, 128], seed: [64, 64], 'foot-l': [80, 124], 'foot-r': [80, 124],
  'tile-grass-light': [160, 160], 'tile-grass-dark': [160, 160], 'tile-dirt': [160, 160],
  'tile-stone': [160, 160], 'tile-puddle': [160, 160], 'tile-cracked': [160, 160], 'tile-target': [160, 160],
  house: [260, 240], fence: [192, 80], tree: [128, 144, 'tree-lime'], 'tree-teal': [128, 144],
  moon: [128, 128], 'cloud-puff': [164, 80], 'cloud-long': [164, 80],
  petal: [24, 20], spark: [24, 24], goo: [24, 24],
};
function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const done = (key, w, h) => { if (!scene.textures.exists(key)) g.generateTexture(key, w, h); g.clear(); };

  // Only rasterize missing art; one fallback path covers every loaded texture.
  for (const [key, [w, h]] of Object.entries(ART)) {
    if (scene.textures.exists(key)) continue;
    if (key.startsWith('tile-')) {
      const color = { 'tile-grass-light': 0xb3e96b, 'tile-grass-dark': 0x60b852,
        'tile-dirt': 0xdfaa68, 'tile-stone': 0xbdcfc7, 'tile-puddle': C.cyan,
        'tile-cracked': 0x93c66b, 'tile-target': C.yellow }[key];
      g.fillStyle(color); g.fillRoundedRect(4, 4, w - 8, h - 8, 14);
      g.lineStyle(6, C.path); g.strokeRoundedRect(4, 4, w - 8, h - 8, 14);
    } else if (key.startsWith('gus-')) {
      g.fillStyle(C.violet); g.fillRoundedRect(38, 90, 84, 65, 16);
      g.fillStyle(C.green); g.fillRoundedRect(26, 10, 108, 96, 25);
      g.fillStyle(C.white); g.fillCircle(57, 48, 15); g.fillCircle(102, 48, 15);
      g.fillStyle(C.path); g.fillCircle(59, 51, 6); g.fillCircle(100, 51, 6);
      g.lineStyle(6, C.path); g.lineBetween(55, 80, 108, 80);
      g.fillStyle(C.yellow); g.fillEllipse(49, 171, 42, 22); g.fillEllipse(110, 171, 42, 22);
    } else if (key.startsWith('foot-')) {
      g.fillStyle(C.white); g.fillEllipse(40, 79, 48, 72);
      for (let i = 0; i < 3; i++) g.fillCircle(20 + i * 20, 28, 10);
    } else if (key.startsWith('flower-')) {
      g.fillStyle(key === 'flower-rose' ? C.magenta : C.violet);
      for (let i = 0; i < 6; i++) g.fillCircle(64 + Math.cos(i * Math.PI / 3) * 32, 60 + Math.sin(i * Math.PI / 3) * 32, 22);
      g.fillStyle(C.yellow); g.fillCircle(64, 60, 25);
      g.fillStyle(C.path); g.fillCircle(55, 57, 5); g.fillCircle(75, 57, 5);
    } else if (key === 'fence') {
      g.fillStyle(0xffe2a2); g.fillRect(0, 30, w, 14); g.fillRect(0, 58, w, 14);
      for (let x = 20; x < w; x += 64) g.fillRoundedRect(x, 8, 22, 72, 6);
    } else {
      g.fillStyle(key === 'moon' ? C.yellow : key === 'tree-teal' ? 0x6fe0b0 : 0xb9e9dc);
      g.fillEllipse(w / 2, h / 2, w - 12, h - 12);
      g.lineStyle(6, C.path); g.strokeEllipse(w / 2, h / 2, w - 12, h - 12);
    }
    done(key, w, h);
  }
  g.destroy();
}

class Preload extends Phaser.Scene {
  constructor() { super('preload'); }
  preload() {
    const { width: W, height: H } = this.scale;
    this.add.text(W / 2, H / 2, 'Waking up Gus…', txt(40, C.yellow)).setOrigin(0.5);
    for (const [key, [width, height, file = key]] of Object.entries(ART)) {
      this.load.svg(key, `art/${file}.svg`, { width, height });
    }
  }
  create() { makeTextures(this); this.scene.start('boot'); }
}

// Shared storybook scenery: no external fonts, filters, shaders, or per-frame allocations.
function gardenBackdrop(scene, W, H) {
  const b = scene.add.graphics();
  b.fillStyle(0x245b67); b.fillRect(0, 0, W, H);
  b.fillStyle(0x438d62); b.fillEllipse(W * 0.78, H * 0.43, W * 1.2, H * 0.68);
  b.fillStyle(0x73bc62); b.fillEllipse(W * 0.15, H * 0.66, W * 1.5, H * 0.7);
  b.fillStyle(0x96d364); b.fillRect(0, H * 0.66, W, H * 0.34);
  scene.add.image(W * 0.15, H * 0.16, 'moon').setDisplaySize(H * 0.18, H * 0.18);
  scene.add.image(W * 0.36, H * 0.13, 'cloud-long').setScale(0.9);
  scene.add.image(W * 0.91, H * 0.09, 'cloud-puff').setScale(0.8);
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) * W / 6;
    scene.add.image(x, H * 0.72, 'fence').setDisplaySize(W / 6 + 4, H * 0.1);
  }
  for (let i = 0; i < 4; i++) {
    const x = i < 2 ? W * (0.04 + i * 0.08) : W * (0.88 + (i - 2) * 0.08);
    scene.add.image(x, H * (0.4 + (i % 2) * 0.12), i % 2 ? 'tree-teal' : 'tree').setScale(H / 660);
  }
  for (let i = 0; i < 6; i++) {
    const x = W * (i < 3 ? 0.06 + i * 0.08 : 0.78 + (i - 3) * 0.08);
    scene.add.image(x, H * (0.88 + (i % 2) * 0.03), ['flower', 'flower-bell', 'flower-rose'][i % 3]).setScale(H / 1100);
  }
}

class Boot extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    zone.apply();
    if (!zone.saved) {
      this.scene.start('zone');
      zone.open(() => { window.zombieGame.scene.stop('zone'); window.zombieGame.scene.start('boot'); });
      return;
    }
    if (params.get('auto') === '1' && !autoWalk) toggleAutoWalk();
    const sample = { score: 180, formPct: 82, steps: 412, cadence: 96, stompPct: 75, dodgePct: 70, highLiftAvgCm: { L: 13.5, R: 11 } };
    const first = params.get('scene');
    if (first === 'home') this.scene.start('home', { summary: sample });   // development: preview the end screen
    else this.scene.start(first === 'play' ? 'play' : 'title');
  }
}

// The calibration preview has no rules clock, input subscription or recording side effects.
class ZonePreview extends Phaser.Scene {
  constructor() { super('zone'); }
  create() {
    const { width: W, height: H } = this.scale;
    const bg = this.add.graphics();
    bg.fillStyle(C.path); bg.fillRect(0, 0, W, H);
    for (let row = 0; row < 6; row++) for (let lane = 0; lane < 2; lane++) {
      this.add.image(W * (lane ? .67 : .33), H * (.08 + row * .12),
        (row + lane) % 2 ? 'tile-grass-dark' : 'tile-grass-light').setDisplaySize(W * .33, H * .125);
    }
    bg.lineStyle(8, C.yellow); bg.lineBetween(W * .16, H * .78, W * .84, H * .78);
    this.add.image(W * .33, H * .88, 'foot-l').setDisplaySize(W * .08, H * .18);
    this.add.image(W * .67, H * .88, 'foot-r').setDisplaySize(W * .08, H * .18);
    for (let i = 0; i < 3; i++) {
      const flower = this.add.image(W * (i % 2 ? .67 : .33), H * .1, ['flower', 'flower-bell', 'flower-rose'][i]).setScale(1.1);
      this.tweens.add({ targets: flower, y: H * .73, duration: 4000, delay: i * 1200, repeat: -1 });
    }
    const resize = () => this.scene.restart();
    this.scale.on('resize', resize);
    this.events.once('shutdown', () => this.scale.off('resize', resize));
  }
}

// ---------- title ----------
class Title extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    this.started = false;
    publishGarden({ act: 'title', cadence: 0, paceOk: true, paused: false,
      title: 'ZOMBIE WALK HOME', score: '', coach: 'Walk in place or press Enter · Z to mark your zone', pace: '', progress: 0 });
    const { width: W, height: H } = this.scale;
    gardenBackdrop(this, W, H);
    this.add.image(W * 0.73, H * 0.22, 'house').setScale(Math.min(1.2, H / 660));
    const titleSize = Math.round(Math.max(22, Math.min(W / 11, H * 0.115, 96)));
    const title = this.add.text(W / 2, H * 0.27, 'ZOMBIE', txt(titleSize, C.yellow)).setOrigin(0.5, 0)
      .setShadow(0, 7, '#19352f', 0, true, true);
    const subtitle = this.add.text(W / 2, title.y + title.height, 'WALK HOME', txt(titleSize, 0xc0ff91)).setOrigin(0.5, 0)
      .setShadow(0, 7, '#19352f', 0, true, true);
    const plaque = this.add.graphics();
    const plaqueStyle = { wordWrap: { width: W * 0.9 - 40, useAdvancedWrap: true }, align: 'center' };
    const prompt = this.add.text(W / 2, subtitle.y + subtitle.height + 24, 'Walk in place to start',
      { ...txt(Math.max(22, Math.min(40, W / 20)), C.yellow), ...plaqueStyle }).setOrigin(0.5, 0);
    const player = this.add.text(W / 2, prompt.y + prompt.height + 6, `or press Enter · player: ${settings.player}`,
      { ...txt(Math.max(22, Math.min(26, W / 30))), ...plaqueStyle }).setOrigin(0.5, 0);
    const plaqueW = Math.max(prompt.width, player.width) + 40;
    const plaqueH = player.y + player.height - prompt.y + 24;
    plaque.fillStyle(C.path); plaque.fillRoundedRect((W - plaqueW) / 2, prompt.y - 12, plaqueW, plaqueH, 22);
    plaque.lineStyle(4, 0xffe2a2); plaque.strokeRoundedRect((W - plaqueW) / 2, prompt.y - 12, plaqueW, plaqueH, 22);
    const gusTop = prompt.y - 12 + plaqueH + 16;
    const gusH = Math.max(0, H - gusTop - 22);
    const z = this.add.image(W / 2, gusTop + gusH / 2, 'gus-idle').setScale(Math.min(H / 1000, gusH / 192));
    this.tweens.add({ targets: z, y: z.y - 10, angle: 3, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
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
  restartOnResize() { if (!this.started) restartWhenShown(this); }
  go() {
    if (this.started || zone.active) return;
    sound.unlock();
    this.started = true;
    playerReady.then(() => this.scene.start('play'));
  }
}

// ---------- the walk home ----------
class Play extends Phaser.Scene {
  constructor() { super('play'); }

  create() {
    clip.cancel();
    sound.setMusic(true);
    this.paused = false;
    this.highSound = { L: false, R: false };
    this.g = newGame(settings.limits, Date.now() % 100000);
    perceiver.reset(settings.perceptron, settings.player);
    this.events.once('shutdown', () => perceiver.stop());   // no frames leave on the Home or Title screens
    this.sprites = new Map();
    this.nextGardenUpdate = 0;
    this.coachLine = '';
    this.feedbackUntil = 0;
    this.currentLayout = null;
    this.worldLayout = null;
    this.rowIndex = null;
    this.lift = { L: 0, R: 0 };            // shown lift, decays
    this.footFlash = { L: 0, R: 0 };
    this.lastCue = 0;
    this.frameWall = performance.now();

    this.bg = this.add.graphics().setDepth(-20);
    // A fixed pool: ten rows includes offscreen recycling, about seven are visible above the feet.
    this.board = Array.from({ length: 20 }, () => this.add.image(0, 0, 'tile-grass-light').setDepth(-18));
    this.walkingZone = this.add.graphics().setDepth(-10);
    this.targetTiles = ['L', 'R'].map(() => this.add.image(0, 0, 'tile-target').setDepth(-15));
    this.pods = { L: this.add.image(0, 0, 'pod').setVisible(false).setScale(0.8).setDepth(3),
      R: this.add.image(0, 0, 'pod').setVisible(false).setScale(0.8).setDepth(3) };
    this.feet = { L: this.add.image(0, 0, 'foot-l').setDepth(12), R: this.add.image(0, 0, 'foot-r').setDepth(12) };
    this.hud = this.add.graphics().setDepth(30);

    this.fx = {
      petals: this.add.particles(0, 0, 'petal', { speed: { min: 150, max: 420 }, lifespan: 900, rotate: { min: 0, max: 360 },
        scale: { start: 1.1, end: 0.2 }, gravityY: 300, maxParticles: 32, maxAliveParticles: 32, emitting: false }).setDepth(20),
      sparks: this.add.particles(0, 0, 'spark', { speed: { min: 120, max: 360 }, lifespan: 600, scale: { start: 1, end: 0 },
        tint: [C.cyan, C.white, C.green], maxParticles: 28, maxAliveParticles: 28, emitting: false }).setDepth(20),
      goo: this.add.particles(0, 0, 'goo', { speed: { min: 60, max: 260 }, lifespan: 700, scale: { start: 1, end: 0.3 },
        maxParticles: 20, maxAliveParticles: 20, emitting: false }).setDepth(20),
    };

    this.off = onFoot((ev) => {
      if (this.paused || zone.active) return;                          // the world is frozen; steps do not count
      // Stamp with the game clock, interpolated to the moment the event arrived between two frames,
      // so a slow frame rate does not bunch steps together.
      const e = addEvent(this.g, { ...ev, t: this.g.t + (performance.now() - this.frameWall) / 1000 });
      if (!e) return;
      if (e.kind === 'strike') {
        this.footFlash[e.foot] = 1;
        this.highSound[e.foot] = false;
        sound.play('step');
      }
      if (e.kind === 'lift') {
        this.lift[e.foot] = Math.max(this.lift[e.foot], e.liftCm);
        const asked = this.g.act === 'garden' ? 'flower' : this.g.act === 'storm' ? 'seed' : null;   // nothing asked in act 1
        if (asked && !this.highSound[e.foot] && e.liftCm >= needCm(this.g, asked, e.foot)) {
          this.highSound[e.foot] = true;
          sound.play('high');
        }
      }
    });
    this.events.once('shutdown', () => this.off());
    this.input.keyboard.on('keydown-SPACE', () => {
      if (zone.active) return;
      this.paused = !this.paused;
      publishGarden({ paused: this.paused, coach: this.paused ? 'Paused · Space to keep walking' : this.coachLine });
      sound.setMusic(!this.paused);
      clip.setPaused(this.paused);
    });
    if (settings.greeting) { this.coachLine = settings.greeting; setTimeout(() => say(settings.greeting), 2600); }
    const jump = params.get('act');
    if (jump) { startAt(this.g, jump); params.delete('act'); }   // development shortcut, first game only
    this.showAct();
  }

  layout() {
    const { width: W, height: H } = this.scale;
    if (this.currentLayout?.W === W && this.currentLayout.H === H) return this.currentLayout;
    const zoneY = H * 0.74;
    // All words live outside the zone; only reserve room for a whole plant at the front.
    const top = H * 0.10;
    const rowH = (zoneY - top) / 6;
    const lanes = { L: W * 0.33, R: W * 0.67 };
    const padY = zoneY + rowH * 0.6;
    const pads = Object.fromEntries(Object.entries(lanes).map(([lane, x]) => [lane,
      { x: x - W * 0.105, y: padY, w: W * 0.21, h: H - padY - 12 } ]));
    this.currentLayout = { W, H, zoneY, top, rowH, lanes, pad: (lane) => pads[lane] };
    return this.currentLayout;
  }

  yFor(distCm, L) {
    return L.zoneY - (distCm / RULES.aheadCm) * (L.zoneY - L.top);
  }

  showAct() {
    const a = ACTS[this.g.act];
    if (!a) return;
    sound.play('act');
    if (this.g.act === 'storm') clip.start(this.game.canvas, sound.capture?.stream);
    this.actIntroUntil = this.g.t + 4.4;
    this.coachLine = a.hint;
    this.nextGardenUpdate = 0;
    say(a.intro.join(' '));
  }

  showFeedback(text) {
    this.feedback = text;
    this.feedbackUntil = this.g.t + 1.2;
    this.nextGardenUpdate = 0;
  }

  resolveFx(th, L) {
    perceiver.checkStep(th);
    sound.play(th.result !== 'hit' ? 'miss' : th.kind === 'flower' ? 'stomp' : 'dodge');
    if (th.result === 'hit') reaction(th.kind === 'flower' ? 'stomp' : 'dodge');
    const x = L.lanes[th.lane];
    const y = L.zoneY;
    if (th.kind === 'flower' && th.result === 'hit') {
      this.fx.petals.explode(26, x, y);
      this.showFeedback('SMASH!');
      // A separate short-lived stamp also works for the last plant of an act.
      const stamp = this.add.image(x, y, this.flowerKey(th.id)).setDepth(19);
      this.tweens.add({ targets: stamp, scaleX: 1.5, scaleY: 0.35, duration: 110, yoyo: true,
        onComplete: () => { this.tweens.add({ targets: stamp, scale: 0.3, alpha: 0, duration: 160, onComplete: () => stamp.destroy() }); } });
    }
    else if (th.kind === 'flower') this.showFeedback('Higher step!');
    else if (th.result === 'hit') { this.fx.sparks.explode(24, x, y); this.cameras.main.flash(140, 190, 255, 235); this.showFeedback('DODGED!'); }
    else { this.fx.goo.explode(20, x, y); this.cameras.main.shake(160, 0.006); this.showFeedback('SPLAT'); }
  }

  progress() {
    const g = this.g;
    if (g.act === 'walk') return Math.min(1, g.walkGoodS / g.limits.walkSeconds) / 3;
    if (g.act === 'garden') return 1 / 3 + Math.min(1, g.actResolved / g.limits.gardenPlants) / 3;
    if (g.act === 'storm') return 2 / 3 + Math.min(1, g.actResolved / g.limits.stormSeeds) / 3;
    return 1;
  }

  async askCoach() {
    const g = this.g;
    const sum = summary(g);
    let cue;
    try {
      const out = await withTimeout(api('/api/coach', { player: settings.player, summary: sum }), 7000);
      if (!this.sys.isActive() || this.g !== g) return;   // a new game started meanwhile
      if (out.params) applyParams(g, out.params);
      cue = out.say;
    } catch {
      cue = this.localCue(sum);
    }
    if (!this.sys.isActive() || this.g !== g || !cue) return;
    this.coachLine = cue;
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
    if (this.paused || zone.active) return;
    const dt = Math.min(1, deltaMs / 1000);   // only a stalled tab is capped: events arrive in real time, game time must keep up
    this.frameWall = performance.now();
    const out = step(this.g, dt);
    const L = this.layout();

    if (out.actChanged) {
      if (this.g.act === 'home') {
        // The scene is about to close: play the sounds, skip visuals that would be torn down at once.
        for (const th of out.resolved) {
          sound.play(th.result !== 'hit' ? 'miss' : th.kind === 'flower' ? 'stomp' : 'dodge');
          if (th.result === 'hit') reaction(th.kind === 'flower' ? 'stomp' : 'dodge');
        }
        this.scene.start('home', { summary: { ...summary(this.g), perceptron: perceiver.summary() } }); return;
      }
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

    this.drawWorld(L);
    this.drawThings(L);
    this.drawHud(L, out, dt);
  }

  drawWorld(L) {
    const { W, H } = L;
    const { rowH } = L;
    // World distance keeps the checker parity and scenery continuous through recycling and resizing.
    const rowsTravelled = this.g.travelledCm / (RULES.aheadCm / 6);
    const offset = (rowsTravelled % 1) * rowH;
    const rowIndex = Math.floor(rowsTravelled);
    const resized = this.worldLayout !== L;
    const recycled = this.rowIndex !== rowIndex;
    if (resized) {
      this.worldLayout = L;
      const b = this.bg;
      b.clear();
      b.fillStyle(0x43864b); b.fillRect(0, 0, W, H);
      b.fillStyle(C.path); b.fillRoundedRect(W * 0.155, L.top - 10, W * 0.69, H, 18);
      this.targetTiles.forEach((tile, i) => tile.setPosition(L.lanes[i ? 'R' : 'L'], L.zoneY)
        .setDisplaySize(W * 0.34, rowH));
      for (const lane of ['L', 'R']) {
        this.pods[lane].setPosition(W * (lane === 'L' ? 0.08 : 0.92), L.top + 48);
        const pad = L.pad(lane);
        this.feet[lane].setPosition(L.lanes[lane], pad.y + pad.h / 2)
          .setScale(Math.min(1.4, (pad.h - 16) / 124, (pad.w - 16) / 80));
      }
      // Opaque foot pads keep the walking zone legible on a white projection mat.
      const z = this.walkingZone;
      z.clear();
      z.fillStyle(C.zone); z.fillRect(0, L.zoneY + rowH / 2, W, H - L.zoneY - rowH / 2);
      z.lineStyle(6, 0xffe778); z.lineBetween(W * 0.16, L.zoneY, W * 0.84, L.zoneY);
      for (const lane of ['L', 'R']) {
        const pad = L.pad(lane);
        z.fillStyle(0x173e37); z.fillRoundedRect(pad.x, pad.y, pad.w, pad.h, 24);
        z.lineStyle(5, 0x91d970); z.strokeRoundedRect(pad.x, pad.y, pad.w, pad.h, 24);
      }
    }
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 2; col++) {
        const tile = this.board[row * 2 + col];
        if (resized || recycled) {
          const parity = ((row - rowIndex + col) % 2 + 2) % 2;
          tile.setTexture(parity ? 'tile-grass-dark' : 'tile-grass-light').setDisplaySize(W * 0.34, rowH + 1);
        }
        tile.setPosition(L.lanes[col ? 'R' : 'L'], L.top + (row - 1) * rowH + offset);
      }
    }
    this.rowIndex = rowIndex;
  }

  flowerKey(id) { return ['flower', 'flower-bell', 'flower-rose'][(id - 1) % 3]; }

  drawThings(L) {
    const g = this.g;
    const live = new Set();
    for (const th of g.things) {
      live.add(th.id);
      let s = this.sprites.get(th.id);
      if (!s) {
        const pad = this.add.image(0, 8, 'tile-dirt').setDisplaySize(142, 90);
        const plant = this.add.image(0, 0, th.kind === 'flower' ? this.flowerKey(th.id) : 'seed');
        // Pads travel with the exact rules position; tile decoration never snaps an obstacle's distance.
        s = this.add.container(L.lanes[th.lane], L.top, [pad, plant]).setDepth(5);
        this.sprites.set(th.id, s);
        if (th.kind === 'seed') {
          sound.play('seed');
          const pod = this.pods[th.lane];
          this.tweens.add({ targets: pod, scaleX: 1, scaleY: 0.65, duration: 120, yoyo: true });
        }
      }
      const y = this.yFor(Math.max(th.distCm, -40), L);
      const near = Math.max(0, 1 - th.distCm / RULES.aheadCm);
      const plant = s.list[1];
      s.setPosition(L.lanes[th.lane], y).setScale(Math.min(1.15, L.W / 850));
      s.setAlpha(th.result ? 0.25 : 1);
      const pad = s.list[0];
      const padKey = near > 0.72 && !th.result ? 'tile-target' : 'tile-dirt';
      if (pad.texture.key !== padKey) pad.setTexture(padKey).setDisplaySize(142, 90);
      plant.setVisible(!(th.kind === 'flower' && th.result === 'hit'));
      if (th.kind === 'seed' && !th.result) plant.setRotation(plant.rotation + 0.15);
      else plant.setAngle(Math.sin(g.t * 3 + th.id) * 5);
    }
    for (const [id, s] of this.sprites) if (!live.has(id)) { s.destroy(); this.sprites.delete(id); }
    const storm = g.act === 'storm';
    for (const lane of ['L', 'R']) this.pods[lane].setVisible(storm);
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
      const pulse = urgent ? 0.8 + 0.2 * Math.sin(g.t * 14) : 1;
      this.feet[lane].setAlpha(Math.max(pulse, this.footFlash[lane]));
      // Canvas-friendly colored rim: the same urgency cue without a WebGL-only image tint.
      if (urgent || this.footFlash[lane] > 0) {
        h.lineStyle(7, urgent ? (th.kind === 'flower' ? C.yellow : C.magenta) : C.white,
          Math.max(pulse, this.footFlash[lane]));
        const pad = L.pad(lane);
        h.strokeRoundedRect(pad.x, pad.y, pad.w, pad.h, 24);
      }
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

    if (g.t >= this.nextGardenUpdate) {
      this.nextGardenUpdate = g.t + .2;
      const act = ACTS[g.act];
      publishGarden({ cadence: out.pace.cadence, act: g.act, paceOk: out.pace.ok || g.t <= 3,
        paused: this.paused, title: act?.title || '', score: `${g.score} pts${g.streak >= 5 ? '  x2' : ''}`,
        progress: this.progress(), pace: `${out.pace.cadence} steps/min · min ${g.limits.minCadence} · form ${Math.round(out.form * 100)}%${perceiver.used ? ` · ${perceiver.badge()}` : ''}`,
        coach: g.t < this.feedbackUntil ? this.feedback : g.t < this.actIntroUntil ? act.intro.join(' ') : this.coachLine });
    }
  }
}

// ---------- home ----------
class Home extends Phaser.Scene {
  constructor() { super('home'); }
  create(data) {
    this.homeData = data;
    sound.setMusic(false);
    if (!data.replay) sound.play('home');
    const s = data.summary;
    publishGarden({ act: 'home', cadence: 0, paceOk: true, paused: false, title: 'HOME BEFORE SUNRISE!',
      score: `${s.score} pts`, progress: 1, pace: `${s.steps} steps · form ${s.formPct}%`, coach: 'Welcome home, Gus! · R to walk again' });
    const { width: W, height: H } = this.scale;
    gardenBackdrop(this, W, H);
    this.house = this.add.image(W * 0.62, H * 0.18, 'house');
    this.gus = this.add.image(W * 0.4, H * 0.2, 'gus-celebrate');
    this.confetti = this.add.particles(W / 2, H * 0.19, 'spark', { speed: { min: 80, max: 260 }, lifespan: 1400, quantity: 2,
      frequency: 120, maxParticles: 36, maxAliveParticles: 36,
      tint: [C.yellow, C.green, C.cyan, C.magenta], scale: { start: 1.2, end: 0 } });
    this.card = this.add.graphics();
    const small = H < 700;
    const bodySize = small ? 20 : 26;
    const style = (size, color = C.white) => ({ ...txt(size, color),
      wordWrap: { width: W * 0.84 - 32, useAdvancedWrap: true }, align: 'center' });
    const text = (value, size, color) => this.add.text(W / 2, 0, value, style(size, color)).setOrigin(0.5, 0);
    this.heading = text('HOME!', small ? 48 : 64, C.green);
    this.ending = text(ENDING, bodySize, C.yellow);
    const lines = [
      `Score ${s.score}   ·   Form ${s.formPct}%`,
      `${s.steps} steps   ·   ${s.cadence} steps/min`,
      `Flowers stomped ${s.stompPct ?? 0}%   ·   Seeds dodged ${s.dodgePct ?? 0}%`,
      `High steps  left ${s.highLiftAvgCm?.L ?? '-'} cm   right ${s.highLiftAvgCm?.R ?? '-'} cm`,
    ];
    if (s.perceptron?.checked) lines.push(`Perceptron double-check agreed on ${s.perceptron.agree} of ${s.perceptron.checked} steps`);
    this.stats = lines.map((line) => text(line, bodySize));
    // Measure a three-line slot before replacing the sample with the asynchronous note.
    this.noteText = text('Ag\nAg\nAg', small ? 18 : 22, C.cyan);
    this.noteHeight = this.noteText.height;
    this.noteText.setText(data.result ? data.result.note || '' : 'The coach is writing your note…');
    this.rewardText = text('Ag\nAg', bodySize, C.magenta);
    this.rewardHeight = this.rewardText.height;
    this.rewardText.setText('');
    this.footer = text('Press R to walk again', small ? 22 : 24, C.yellow);
    this.shareText = text(data.shareStatus || 'Preparing your walk clip…', small ? 20 : 24, C.yellow);
    this.qrImage = null;
    this.layoutCard();
    if (data.share) this.showShare(data.share);
    if (!data.clipTask) {
      data.clipTask = this.prepareClip(data);
    }
    if (data.result) this.showResult(data.result);
    say(`${ENDING} ${s.stompPct ?? 0} percent of flowers stomped. Great walking.`);
    this.input.keyboard.on('keydown-R', () => {
      data.cancelled = true; data.uploadAbort?.abort(); clip.cancel();
      playerReady = loadPlayer(); this.scene.start('title');
    });
    const again = () => restartWhenShown(this, data);
    this.scale.once('resize', again);
    this.events.once('shutdown', () => this.scale.off('resize', again));
    if (data.replay) return;
    data.replay = true;
    window.dispatchEvent(new CustomEvent('zombiewalk:session', { detail: s }));
    if (params.get('scene') === 'home') return;   // preview only, nothing to save
    const verified = (s.formPct ?? 0) >= 40;        // walking was verified for most of the session
    withTimeout(api('/api/session', { player: settings.player, summary: s, verified }), 25000)
      .then((result) => { data.result = result; if (this.sys.isActive()) this.showResult(result); })
      .catch(() => {
        data.result = { note: 'Not saved: the game server did not answer.' };
        if (this.sys.isActive()) this.showResult(data.result);
      });
  }

  layoutCard() {
    const { width: W, height: H } = this.scale;
    const gap = H < 700 ? 3 : 5;
    const qrWidth = W < 1000 ? 184 : 220;
    const textWidth = W * 0.84 - 56 - qrWidth;
    const textX = W * 0.08 + 16 + textWidth / 2;
    const qrX = W * 0.92 - 16 - qrWidth / 2;
    const items = [this.heading, this.ending, ...this.stats, this.noteText, this.rewardText, this.footer];
    for (const item of items) item.setScale(1).setWordWrapWidth(textWidth);
    const reservedHeight = (item) => Math.max(item.height,
      item === this.noteText ? this.noteHeight : item === this.rewardText ? this.rewardHeight : 0);
    const naturalHeight = items.reduce((sum, item) => sum + reservedHeight(item) + gap, 28);
    const fit = Math.min(1, (H - 84) / naturalHeight);
    let cursor = 14;
    for (const item of items) {
      item.setScale(fit).setPosition(textX, cursor);
      cursor += reservedHeight(item) * fit + gap;
    }
    const cardH = Math.max(cursor - gap + 14, qrWidth + 12 + 64 + 48);   // QR, gap, two caption lines, margins
    const top = Math.max(12, Math.min(H * 0.30, H - cardH - 60));
    for (const item of items) item.y += top;
    this.shareText.setWordWrapWidth(qrWidth).setPosition(qrX, top + cardH / 2 + (this.qrImage ? qrWidth / 2 + 12 : -30));
    if (this.qrImage) this.qrImage.setPosition(qrX, top + cardH / 2).setDisplaySize(qrWidth, qrWidth);
    this.card.clear();
    this.card.fillStyle(C.path); this.card.fillRoundedRect(W * 0.08, top, W * 0.84, cardH, 26);
    this.card.lineStyle(5, 0xffe2a2); this.card.strokeRoundedRect(W * 0.08, top, W * 0.84, cardH, 26);
    const artH = Math.max(0, top - 32);
    this.tweens.killTweensOf([this.house, this.gus]);
    this.house.setPosition(W * 0.62, top / 2).setScale(Math.min(0.95, artH / (240 * 1.04)));
    this.gus.setPosition(W * 0.4, top / 2).setScale(Math.min(1, artH / Math.hypot(160, 192)));
    this.tweens.add({ targets: this.house, scale: this.house.scale * 1.04, duration: 600, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: this.gus, y: this.gus.y - Math.min(12, top * 0.08), angle: 5,
      duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.confetti.setPosition(W / 2, top / 2);
  }

  async prepareClip(data) {
    try {
      // Let the celebration and home arrival appear in the final recording.
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (data.cancelled) return;
      const blob = await clip.finish();
      if (data.cancelled) return;
      if (!blob) throw new Error('Recording unavailable on this browser or preview.');
      data.shareStatus = 'Sharing your walk clip…';
      if (this.sys.isActive() && this.homeData === data) this.shareText.setText(data.shareStatus);
      data.uploadAbort = new AbortController();
      const timer = setTimeout(() => data.uploadAbort.abort(), 30000);
      try { data.share = await uploadClip(blob, data.uploadAbort.signal); }
      finally { clearTimeout(timer); }
      if (!data.cancelled && this.sys.isActive() && this.homeData === data) this.showShare(data.share);
    } catch (error) {
      data.shareStatus = error.message.startsWith('Recording unavailable') ? 'Play act 3 to record a clip on a supported browser.' : 'Clip sharing unavailable. Check the local server and play again.';
      if (!data.cancelled && this.sys.isActive() && this.homeData === data) {
        this.shareText.setText(data.shareStatus); this.layoutCard();
      }
    }
  }

  showShare(share) {
    if (this.qrImage) this.qrImage.destroy();
    if (this.textures.exists('walk-qr')) this.textures.remove('walk-qr');
    this.textures.addImage('walk-qr', share.image);
    this.qrImage = this.add.image(0, 0, 'walk-qr').setInteractive({ useHandCursor: true });
    this.qrImage.on('pointerdown', () => window.open(share.url, '_blank', 'noopener'));
    this.shareText.setText('Scan to get your walk clip');
    this.layoutCard();
  }

  showResult(result) {
    this.noteText.setText(result.note || '');
    if (result.reward && result.receipt) {
      this.rewardText.setText(`Reward: ${result.reward.name}  ·  ${result.receipt.network}  ·  $${result.receipt.amountUsd}`);
      say(result.reward.line || `You earned ${result.reward.name}!`);
    }
    this.layoutCard();
  }
}

// ---------- boot ----------
window.zombieGame = new Phaser.Game({
  // WebGL renders particle tint palettes; Phaser falls back to Canvas when unavailable.
  type: Phaser.AUTO,
  parent: 'stage',
  backgroundColor: '#000000',
  // RESIZE measures the parent's transformed bounds and would shrink the board twice.
  // Size the source canvas explicitly; Warp alone maps it to the walking zone.
  scale: { mode: Phaser.Scale.NONE, width: window.innerWidth, height: window.innerHeight },
  scene: [Preload, Boot, ZonePreview, Title, Play, Home],
});
window.addEventListener('resize', () => window.zombieGame.scale.resize(innerWidth, innerHeight));
