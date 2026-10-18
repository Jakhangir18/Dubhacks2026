// Zombie Walk Home: Phaser scenes, art, HUD and input. Rules live in logic.js.
// Floor projection: things arrive at the pad's front edge; ghost feet mark the toes below.
import { ease, plan, newGame, step, addEvent, addShoes, shoesLive, resetShoes, markHit, summary, needCm, startAt, applyParams, speedScale, SPEED_RANGE, RULES, LIMITS } from './logic.js';
import { emitFoot, onFoot } from './bus.js';
import { mountCameraPanel } from './camera-panel.js';
import { connectBridge, SHOES_EVENT, FRAME_EVENT, MARKS_EVENT } from './bridge.js';
import { ACTS, ENDING } from './lore.js';
import { GardenSound } from './sound.js';
import { WalkClip, uploadClip } from './clip.js';
import { WalkingZone } from './zone.js';
import { AmbientGarden } from './ambient.js';
import { Perceiver } from './perceive.js';
import { send, listen, cameraWindowAlive, RemotePerceiver } from './link.js';

const Phaser = window.Phaser;
const Warp = window.Warp;
const sound = new GardenSound(Warp.store);
const clip = new WalkClip();

const C = { green: 0x7cff4f, yellow: 0xffe44d, magenta: 0xff2d95, cyan: 0x2de2ff, orange: 0xff9a1f,
  white: 0xffffff, red: 0xff4d4d, violet: 0x9b6bff, path: 0x19352f, zone: 0x295d45,
  lime: 0x9cff5a, amber: 0xffb21e, dodge: 0x2de2c4, pink: 0xff5fa2 };
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const TEXT = { fontFamily: 'Trebuchet MS, system-ui, sans-serif', fontStyle: 'bold', color: '#ffffff',
  stroke: '#19352f', strokeThickness: 8 };
const txt = (size, color = C.white) => ({ ...TEXT, fontSize: `${Math.max(24, size)}px`, color: hex(color) });

// ---------- shared state ----------
// URL options for development and screenshots: ?scene=play&act=garden&auto=1
const params = new URLSearchParams(location.search);
const FIELD = Warp.FIELD;   // the portrait game field, 720 x 1280; the zone warp fits it to the floor
// ?floor=1: the whole field lies on a white board in front of the pad (black belt, lit venue), so the hit line
// sits near the board's rear edge by the pad and nothing is dimmed as "belt".
const BOARD = params.get('floor') === '1';
// Where the hit line sits on the field (share of its height from the far edge): put it where the front foot lands.
// On the pad the feet stand well down the belt, so the default line (0.54) can be out of their reach: ?line=0.68.
const LINE = Math.min(0.85, Math.max(0.4, Number(params.get('line')) || 0.54));
const settings = {
  voice: Warp.store.get('zombiewalk.voiceOn', false),   // spoken lines are off until the team picks a voice (M)
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

const DEMO = { walkSeconds: 8, gardenPlants: 6, stormSeeds: 0, rounds: 2 };
const RING_SNAP_PX = 60;   // shoe-box jitter on the field stays under this; a bigger move is a real step and snaps
const RING_EASE_S = 0.08;  // how the ring settles under the jitter
const SHARE = params.get('share') === '1';   // the clip and QR code are off unless asked for
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
  const speed = Warp.store.get('zombiewalk.speedScale', null);   // the operator's [ ] setting wins on this laptop
  if (Number.isFinite(speed)) settings.limits.speedScale = speed;
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
// [ and ]: plants slower or faster, live, remembered on this laptop.
function nudgeSpeed(delta) {
  const play = window.zombieGame?.scene.getScene('play');
  const now = Number(play?.g?.limits.speedScale ?? settings.limits.speedScale ?? LIMITS.speedScale);
  const next = Math.round(Math.min(SPEED_RANGE[1], Math.max(SPEED_RANGE[0], now + delta)) * 10) / 10;
  settings.limits.speedScale = next;
  if (play?.g) play.g.limits.speedScale = next;
  Warp.store.set('zombiewalk.speedScale', next);
  if (play?.sys.isActive()) play.showFeedback(`PLANT SPEED x${next.toFixed(1)}`, C.cyan);
}

function toggleAutoWalk() {
  if (autoWalk) { clearInterval(autoWalk); autoWalk = null; return; }
  autoWalk = setInterval(() => { keyStep(autoFoot, 4); autoFoot = autoFoot === 'L' ? 'R' : 'L'; }, 600);
}

// ---------- camera and Raspberry Pi inputs ----------
const cameraPanel = mountCameraPanel();          // V: phone or webcam, live lift values
// Perceptron second opinion: on this window's camera (V), or in the camera window (camera.html) when it is open.
const localPerceiver = new Perceiver(cameraPanel.tracker);
const remotePerceiver = new RemotePerceiver();
let perceiver = localPerceiver;
if (params.has('scene')) window.zombiewalk = { perceiver: localPerceiver, tracker: cameraPanel.tracker };   // development and end-to-end tests

// Shoe sightings from feet.py through the bridge: the boxes go on to the camera window first (so detection can be
// checked before any calibration), then onto the field: into the game being played, or, on the title and home
// screens, into a scratch game whose derived steps reach the bus, so walking on the pad starts the game.
const scratch = newGame();
const scratchLayout = floorLayout(FIELD.width, FIELD.height);
window.addEventListener(SHOES_EVENT, (e) => {
  if (cameraWindowAlive()) send('shoes-seen', { boxes: e.detail.boxes });
  if (!camH) return;
  const play = window.zombieGame?.scene.getScene('play');
  if (play?.sys.isActive() && !play.paused && !zone.active) { play.feedShoes(e.detail.boxes); return; }
  const g = window.zombieGame;
  if (!(g?.scene.isActive('title') || g?.scene.isActive('home')) || zone.active) return;   // walk-to-start on the title and home screens
  const before = scratch.stats.steps;
  scratch.t = performance.now() / 1000;
  addShoes(scratch, mapShoes(e.detail.boxes, scratchLayout));
  if (scratch.stats.steps > before) emitFoot({ foot: scratch.strikes[scratch.strikes.length - 1].foot, kind: 'strike', source: 'feet' });
});

// A foot seen on a coloured mark: the camera judged the hit itself; the mark's place picks the lane and the thing.
window.addEventListener(MARKS_EVENT, (e) => {
  const play = window.zombieGame?.scene.getScene('play');
  if (!camH || !play?.sys.isActive() || play.paused || zone.active) return;
  const L = play.layout();
  for (const [color, cx, cy] of e.detail.marks) {
    const kind = color === 'cyan' ? 'flower' : color === 'magenta' ? 'seed' : null;
    if (!kind) continue;
    const [fx, fy] = Warp.mapPoint(camH, cx, cy);
    if (!Number.isFinite(fx) || !Number.isFinite(fy)) continue;
    const lane = fx < L.W / 2 ? 'L' : 'R';
    markHit(play.g, lane, kind, fieldDist(fy, L));   // touched; the line decides, and the game logs the result then
  }
});

// feet.py's camera picture goes on to the camera window, where the shoe calibration is clicked.
window.addEventListener(FRAME_EVENT, (e) => { if (cameraWindowAlive()) send('frame-seen', { jpeg: e.detail.jpeg }); });

// Foot events from the camera window on the laptop screen; the game stamps them on arrival like any source.
// While the camera window runs, this window's own camera (V) would count every step twice: ignore it.
const doubleCamera = (ev) => ev.source === 'camera' && cameraWindowAlive();
// Pose-based steps are noise once feet.py shoes drive the game.
const POSE_SOURCES = new Set(['camera', 'camera-window']);

// Camera -> field: the homography saved by the camera window's shoe calibration (normalised camera coords to field px).
const readCamToField = () => { const h = Warp.store.get(Warp.CAM_KEY, null); return Array.isArray(h) && h.length === 8 && h.every(Number.isFinite) ? h : null; };
let camH = readCamToField();
window.addEventListener('storage', (e) => { if (e.key === Warp.CAM_KEY) camH = readCamToField(); });   // the camera window writes it
// The server keeps the calibration too (saved by the camera window, or set by hand): a newer one replaces the local copy.
async function pullShoeCal() {
  try {
    const cal = await withTimeout(api('/api/shoecal'), 3000);
    if (!cal.h || !(cal.ts > Warp.store.get(Warp.CAM_KEY + '.ts', 0))) return;
    Warp.store.set(Warp.CAM_KEY, cal.h); Warp.store.set(Warp.CAM_KEY + '.ts', cal.ts);
    Warp.store.set(Warp.CAM_KEY + '.points', cal.points || null); Warp.store.set(Warp.CAM_KEY + '.picture', cal.picture || 'feed');
    camH = readCamToField();
  } catch { /* offline: the local copy stays */ }
}
pullShoeCal();
setInterval(pullShoeCal, 4000);

// Field y of a thing at distCm from the hit line, and back.
const fieldY = (distCm, L) => L.zoneY - (distCm / RULES.aheadCm) * (L.zoneY - L.top);
const fieldDist = (y, L) => (L.zoneY - y) * RULES.aheadCm / (L.zoneY - L.top);

// Shoe boxes (fractions of feet.py's picture) onto the field: the toe tip is on the floor; the box top is the ankle,
// above the floor, so the heel is taken at about 60 % down the box.
function mapShoes(boxes, L) {
  const shoes = [];
  for (const [x1, y1, x2, y2] of boxes.slice(0, 2)) {
    const cx = (x1 + x2) / 2;
    const [fx, fy] = Warp.mapPoint(camH, cx, y2);
    const [, fyHeel] = Warp.mapPoint(camH, cx, y1 + 0.6 * (y2 - y1));
    if (![fx, fy, fyHeel].every(Number.isFinite)) continue;
    const nearCm = fieldDist(fy, L);
    if (nearCm > 40) continue;   // feet stay on the belt, below the hit line: anything beyond is a lit console or a wall
    shoes.push({ xFrac: fx / L.W, nearCm, farCm: fieldDist(fyHeel, L) });
  }
  return shoes;
}

// When the camera window appears, give it the current banner at once instead of at the next update.
let cameraWasAlive = false;
listen((m) => {
  if (m.type !== 'camera-alive') return;
  if (!cameraWasAlive) send('game', { state: { ...gardenState } });
  cameraWasAlive = true;
});
setInterval(() => { cameraWasAlive = cameraWindowAlive(); }, 1000);

// Every step the game receives from other sources (keyboard, Pi, a side camera over the server) is shown in the
// camera window too, so a detector on another computer can be tested there.
onFoot((ev) => { if (ev.source !== 'camera-window' && cameraWindowAlive()) send('foot-seen', { ev }); });

listen((m) => {
  if (m.type !== 'foot' || !['L', 'R'].includes(m.foot) || !['lift', 'strike'].includes(m.kind)) return;
  emitFoot({ foot: m.foot, kind: m.kind, liftCm: Number.isFinite(m.liftCm) ? m.liftCm : undefined, source: 'camera-window' });
});
connectBridge((status) => { document.getElementById('bridge').textContent = status; });   // Pi events via the server

// ---------- projector corner warp ----------
// Portrait like the pad, and a 9:16 walk clip. The one place the field size is set: Warp reads it from #stage.
Object.assign(document.getElementById('stage').style, { width: `${FIELD.width}px`, height: `${FIELD.height}px` });
const zone = new WalkingZone();
new AmbientGarden(zone);
// Reuse the event and payload. The ambient canvas never allocates objects in its frame loop.
const gardenState = { cadence: 0, act: 'title', paceOk: true, paused: false,
  title: '', score: '', coach: '', pace: '', progress: 0 };
const gardenEvent = new CustomEvent('zombiewalk:pace', { detail: gardenState });
// A short line to the server per judged thing or act change, so a run on the pad can be followed from anywhere.
function logRemote(entry) {
  fetch('/api/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...entry, player: settings.player }) }).catch(() => {});
}

function publishGarden(values) {
  Object.assign(gardenState, values);
  window.dispatchEvent(gardenEvent);
  if (cameraWindowAlive()) send('game', { state: { ...gardenState } });   // the laptop screen shows the same banner
}
function reaction(value) { window.dispatchEvent(new CustomEvent('zombiewalk:reaction', { detail: value })); }
// A resize while zone setup has the scene paused (F for fullscreen) must not bring it back on top of the preview.
function restartWhenShown(scene, data) {
  if (!scene.sys.isPaused()) { scene.scene.restart(data); return; }
  if (scene.restartQueued) return;
  scene.restartQueued = true;
  const later = () => { scene.restartQueued = false; scene.scene.restart(data); };
  scene.events.once('resume', later);
  scene.events.once('shutdown', () => { scene.events.off('resume', later); scene.restartQueued = false; });
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
  play?.markPause(true);   // the side camera's timeline counts the setup as a pause
  sound.setMusic(false); clip.setPaused(true);
  game.scene.start('zone');
  zone.open(() => {
    game.scene.stop('zone');
    for (const scene of scenes) { scene.scene.resume(); scene.scene.setVisible(true); }
    if (play) {
      play.frameWall = performance.now(); resetShoes(play.g);   // sightings from before the setup are stale
      if (!play.paused) play.markPause(false);                  // a Space pause goes on until Space
    }
    // A session response or clip upload may have completed while Home was paused.
    if (home) {
      home.showLab();
      home.showGait();
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
      settings.voice = !settings.voice; Warp.store.set('zombiewalk.voiceOn', settings.voice);
      if (!settings.voice) { ++speechId; window.speechSynthesis?.cancel(); sound.duck(false); }
    },
    n: () => sound.toggle(),
    k: () => { const el = document.getElementById('keys'); el.hidden = !el.hidden; },
    v: () => cameraPanel.toggle(),
    o: () => window.open('camera.html', 'zombiewalk-camera'),   // the camera window for the laptop screen
    '[': () => nudgeSpeed(-0.1), ']': () => nudgeSpeed(0.1),
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
// Generated art (Higgsfield, docs/ART_DIRECTION.md) replaces the SVG of the same name; the SVG stays as the fallback.
const HD = new Set(['fence', 'flower-bell', 'flower-marigold', 'flower-rose', 'foot-l', 'foot-r', 'gus-celebrate', 'gus-idle', 'gus-portrait', 'gus-step', 'house', 'moon', 'pod', 'seed', 'tile-grass-dark', 'tile-grass-light', 'tile-target', 'tree-lime', 'tree-teal']);
const PLANT_SCALE = 1.7;   // generated plants are drawn larger than the old SVG box
const POD_SCALE = 1;
const FILL = new Set(['fence', 'tile-grass-light', 'tile-grass-dark', 'tile-target']);
function useHdArt(scene) {
  for (const [key, [w, h]] of Object.entries(ART)) {
    const hd = `${key}@hd`;
    if (!scene.textures.exists(hd)) continue;
    const img = scene.textures.get(hd).getSourceImage();
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const canvas = scene.textures.createCanvas(key, w, h);
    const ctx = canvas.getContext();
    ctx.imageSmoothingQuality = 'high';
    if (FILL.has(key)) ctx.drawImage(img, 0, 0, w, h);   // tiles and fence segments must join edge to edge
    else {
      const s = Math.min(w / img.width, h / img.height);   // contain: the art keeps its proportions inside the old box
      ctx.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
    }
    if (key === 'tile-grass-dark') {   // lift the dark checker: on a 150-lumen projector it read as almost black
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = '#3c6a2c'; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    canvas.refresh();
    scene.textures.remove(hd);   // the full-size source is not needed again
  }
}
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
  // White outline of the existing SVG footprint, without its fill or arrow.
  for (const lane of ['l', 'r']) for (const amber of [false, true]) {
    const key = `foot-ghost-${lane}${amber ? '-amber' : ''}`;
    if (scene.textures.exists(key)) continue;
    const canvas = scene.textures.createCanvas(key, 180, 240);
    const ctx = canvas.getContext();
    ctx.scale(180 / 80, 240 / 124);
    if (lane === 'l') { ctx.translate(80, 0); ctx.scale(-1, 1); }
    ctx.strokeStyle = amber ? '#ffb21e' : '#ffffff'; ctx.lineWidth = 6; ctx.lineJoin = 'round';   // at least 12 px after scaling
    ctx.stroke(new Path2D('M29 50 Q7 59 17 84 Q25 101 23 106 Q24 117 41 116 Q60 116 60 102 L67 75 Q73 53 55 48Z'));
    for (const [x, y, rx, ry] of [[21, 33, 11, 14], [43, 24, 10, 13], [62, 31, 8, 11]]) {
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    }
    canvas.refresh();
  }
}

function floorLayout(W, H) {
  const zoneY = H * (BOARD ? 0.86 : LINE), top = H * 0.085;
  return { W, H, zoneY, top, rowH: (zoneY - top) / 6,
    lanes: { L: W * 0.318, R: W * 0.682 }, laneW: W * 0.364, gap: 20,
    // On the board the meters stand beside the lanes, ending at the hit line; on the pad they run up the rails.
    toeY: BOARD ? H - 75 : H - 120, meterBottom: BOARD ? zoneY - 20 : H - 30, meterTop: BOARD ? H * 0.42 : zoneY + 10 };
}

function makeFloor(scene, L) {
  scene.bg = scene.add.graphics().setDepth(-20);
  scene.bg.fillStyle(0x10241c); scene.bg.fillRect(0, 0, L.W, L.H);
  const rows = Math.ceil((L.H - L.top) / L.rowH) + 3;
  scene.board = Array.from({ length: rows * 2 }, () => scene.add.image(0, 0, 'tile-grass-light').setDepth(-18));
  scene.hitLine = scene.add.graphics().setDepth(2);
  // Shoe mode: the belt part is a plain light so the camera sees pale socks on a black belt, not a green pattern on legs.
  scene.beltLight = scene.add.rectangle(L.W / 2, (L.zoneY + 30 + L.H) / 2, L.laneW * 2 + L.gap, L.H - L.zoneY - 30, 0xe9f1e6, 0.9)
    .setDepth(-17).setVisible(false);
  scene.feet = Object.fromEntries(['L', 'R'].map(lane => [lane,
    scene.add.image(L.lanes[lane], L.toeY, `foot-ghost-${lane.toLowerCase()}`).setAlpha(0.3).setDepth(12)
      .setScale(BOARD ? 0.5 : 1)]));   // on the board the feet are a small metronome under the hit line
  scene.hud = scene.add.graphics().setDepth(30);
}

function drawFloor(scene, L, travelledCm, t, gated = false) {
  scene.beltLight.setVisible(!!camH && !BOARD).setAlpha(gated ? 0.5 : 0.9);
  const rowsTravelled = travelledCm / (RULES.aheadCm / 6);
  const offset = (rowsTravelled % 1) * L.rowH;
  const rowIndex = Math.floor(rowsTravelled);
  for (let i = 0; i < scene.board.length; i++) {
    const row = Math.floor(i / 2), col = i % 2, tile = scene.board[i];
    if (scene.rowIndex !== rowIndex) {
      const parity = ((row - rowIndex + col) % 2 + 2) % 2;
      tile.setTexture(parity ? 'tile-grass-dark' : 'tile-grass-light')
        .setDisplaySize(L.laneW - L.gap / 2, L.rowH + 1);
    }
    const y = L.top + (row - 1) * L.rowH + offset;
    tile.setPosition(L.lanes[col ? 'R' : 'L'], y).setAlpha((y > L.zoneY && !BOARD ? 0.4 : 1) * (gated ? 0.4 : 1));
  }
  scene.rowIndex = rowIndex;
  const h = scene.hitLine;
  const color = gated ? C.amber : C.lime;
  const pulse = gated ? 0.5 + 0.5 * Math.sin(2 * Math.PI * t) : 0.85 + 0.15 * Math.sin(t * 3);
  const left = L.lanes.L - L.laneW / 2, width = L.laneW * 2;
  h.clear();
  for (const [height, alpha] of [[96, 0.08], [72, 0.18], [48, 0.8]]) {
    h.fillStyle(color, alpha * pulse); h.fillRoundedRect(left, L.zoneY - height / 2, width, height, 12);
  }
  h.fillStyle(gated ? C.amber : C.white, pulse); h.fillRect(left, L.zoneY - 12, width, 24);
  h.lineStyle(12, gated ? C.amber : C.white, pulse);
  for (const lane of ['L', 'R']) for (const dx of [-65, 65]) {
    const x = L.lanes[lane] + dx;
    h.beginPath(); h.moveTo(x - 20, L.zoneY + 34); h.lineTo(x, L.zoneY + 52);
    h.lineTo(x + 20, L.zoneY + 34); h.strokePath();
  }
}

function drawMeter(h, L, lane, lift, need, color, flash = 0, urgent = false) {
  const x = L.W * (lane === 'L' ? 0.068 : 0.932);
  const height = L.meterBottom - L.meterTop, scale = height / 30;
  h.fillStyle(0x101f30); h.fillRoundedRect(x - 30, L.meterTop, 60, height, 16);
  h.lineStyle(12, C.white, 0.3); h.strokeRoundedRect(x - 30, L.meterTop, 60, height, 16);
  const fill = Math.min(30, lift) * scale;
  h.fillStyle(flash > 0 ? C.white : C.dodge); h.fillRect(x - 24, L.meterBottom - fill, 48, fill);
  if (need !== null) {
    h.lineStyle(12, flash > 0 ? C.white : color, urgent || flash > 0 ? 1 : 0.6);
    h.lineBetween(x - 30, L.meterBottom - need * scale, x + 30, L.meterBottom - need * scale);
  }
}

class Preload extends Phaser.Scene {
  constructor() { super('preload'); }
  preload() {
    const { width: W, height: H } = this.scale;
    this.add.text(W / 2, H / 2, 'Waking up Gus…', txt(40, C.yellow)).setOrigin(0.5);
    for (const [key, [width, height, file = key]] of Object.entries(ART)) {
      this.load.svg(key, `art/${file}.svg`, { width, height });
      if (HD.has(file)) this.load.image(`${key}@hd`, `art/hd/${file}.png`);
    }
  }
  create() { useHdArt(this); makeTextures(this); this.scene.start('boot'); }
}

// Shared storybook scenery: no external fonts, filters, shaders, or per-frame allocations.
function gardenBackdrop(scene, W, H) {
  const b = scene.add.graphics();
  const S = Math.min(W, H);   // art scales with the short side, so a portrait field is not crowded
  b.fillStyle(0x245b67); b.fillRect(0, 0, W, H);
  b.fillStyle(0x438d62); b.fillEllipse(W * 0.78, H * 0.43, W * 1.2, H * 0.68);
  b.fillStyle(0x73bc62); b.fillEllipse(W * 0.15, H * 0.66, W * 1.5, H * 0.7);
  b.fillStyle(0x96d364); b.fillRect(0, H * 0.66, W, H * 0.34);
  scene.add.image(W * 0.15, H * 0.16, 'moon').setDisplaySize(S * 0.18, S * 0.18);
  scene.add.image(W * 0.36, H * 0.13, 'cloud-long').setScale(0.9);
  scene.add.image(W * 0.91, H * 0.09, 'cloud-puff').setScale(0.8);
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) * W / 6;
    scene.add.image(x, H * 0.72, 'fence').setDisplaySize(W / 6 + 4, H * 0.1);
  }
  for (let i = 0; i < 4; i++) {
    const x = i < 2 ? W * (0.04 + i * 0.08) : W * (0.88 + (i - 2) * 0.08);
    scene.add.image(x, H * (0.4 + (i % 2) * 0.12), i % 2 ? 'tree-teal' : 'tree').setScale(S / 660);
  }
  for (let i = 0; i < 6; i++) {
    const x = W * (i < 3 ? 0.06 + i * 0.08 : 0.78 + (i - 3) * 0.08);
    scene.add.image(x, H * (0.88 + (i % 2) * 0.03), ['flower', 'flower-bell', 'flower-rose'][i % 3]).setScale(S / 1100);
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
    this.floor = floorLayout(W, H);
    this.previewT = 0;
    this.rowIndex = null;
    makeFloor(this, this.floor);
    this.flowers = Array.from({ length: 3 }, (_, i) => this.add.image(0, 0,
      ['flower', 'flower-bell', 'flower-rose'][i]).setScale(PLANT_SCALE, PLANT_SCALE * 1.25).setDepth(5));
    const resize = () => this.scene.restart();
    this.scale.on('resize', resize);
    this.events.once('shutdown', () => this.scale.off('resize', resize));
  }
  update(_time, deltaMs) {
    this.previewT += Math.min(0.1, deltaMs / 1000);
    const L = this.floor, t = this.previewT;
    drawFloor(this, L, t * 83, t);
    this.hud.clear();
    for (const lane of ['L', 'R']) drawMeter(this.hud, L, lane, 4, 8, C.amber);
    this.flowers.forEach((flower, i) => {
      const phase = (t / 6 + i / 3) % 1;
      const y = L.top + phase * (L.H - L.top + 150);
      flower.setPosition(L.lanes[i % 2 ? 'R' : 'L'], y).setAlpha(y > L.zoneY && !BOARD ? 0.4 : 1);
    });
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
    this.add.image(W * 0.73, H * 0.14, 'house').setScale(Math.min(1.2, W / 900));
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
      if (doubleCamera(ev)) return;
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
    this.g = newGame(settings.limits);
    this.g.toeBaseCm = this.g.toeCm = -fieldDist(this.layout().toeY, this.layout());   // world cm from the hit line to the toes
    this.shoeRings = ['L', 'R'].map(() => this.add.ellipse(0, 0, 150, 80).setStrokeStyle(10, C.cyan, 0.8).setVisible(false).setDepth(11));
    this.lastShoes = 0;
    perceiver = cameraWindowAlive() ? remotePerceiver : localPerceiver;
    perceiver.reset(settings.perceptron, settings.player, () => this.paused || this.sys.isPaused());
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
    // One session id ties this game, the side camera's recording and the gait review; the game never waits for it.
    this.sessionId = null;
    this.startWall = performance.now();
    this.segments = [];                    // {act, round, startS, endS}, wall-clock seconds since the start below
    this.pauses = [];                      // [startS, endS]
    this.pauseAt = null;
    const game = this.g;
    withTimeout(api('/api/session/start', { player: settings.player }), 5000)
      .then((r) => { if (this.g === game && typeof r?.id === 'string') this.sessionId = r.id; })
      .catch(() => {});                    // offline: the session is saved without an id, as before

    makeFloor(this, this.layout());
    this.pods = { L: this.add.image(0, 0, 'pod').setVisible(false).setScale(POD_SCALE).setDepth(3),
      R: this.add.image(0, 0, 'pod').setVisible(false).setScale(POD_SCALE).setDepth(3) };
    this.meterFlash = { L: 0, R: 0 };
    this.aftermath = [];

    this.fx = {
      petals: this.add.particles(0, 0, 'petal', { speed: { min: 150, max: 420 }, lifespan: 900, rotate: { min: 0, max: 360 },
        scale: { start: 1.1, end: 0.2 }, gravityY: 300, maxParticles: 32, maxAliveParticles: 32, emitting: false }).setDepth(20),
      sparks: this.add.particles(0, 0, 'spark', { speed: { min: 120, max: 360 }, lifespan: 600, scale: { start: 1, end: 0 },
        tint: [C.cyan, C.white, C.green], maxParticles: 28, maxAliveParticles: 28, emitting: false }).setDepth(20),
      goo: this.add.particles(0, 0, 'goo', { speed: { min: 60, max: 260 }, lifespan: 700, scale: { start: 1, end: 0.3 },
        maxParticles: 20, maxAliveParticles: 20, emitting: false }).setDepth(20),
    };

    this.off = onFoot((ev) => {
      if (doubleCamera(ev)) return;
      if (shoesLive(this.g) && POSE_SOURCES.has(ev.source)) return;
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
        const next = this.g.things.filter(th => th.lane === e.foot && !th.result)
          .sort((a, b) => a.distCm - b.distCm)[0];
        if (next && this.lift[e.foot] >= needCm(this.g, next.kind, e.foot)) this.meterFlash[e.foot] = 0.2;
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
      publishGarden({ paused: this.paused, coachColor: '', coach: this.paused ? 'Paused · Space to keep walking' : this.coachLine });
      this.markPause(this.paused);
      sound.setMusic(!this.paused);
      clip.setPaused(this.paused);
      if (!this.paused) resetShoes(this.g);   // sightings and half swings from before the pause are stale
    });
    if (settings.greeting) { this.coachLine = settings.greeting; setTimeout(() => say(settings.greeting), 2600); }
    const jump = params.get('act');
    if (jump) { startAt(this.g, jump); params.delete('act'); }   // development shortcut, first game only
    this.nextSegment();
    this.showAct();
  }

  // Wall-clock seconds since the game asked for its session, pauses included: the side camera cuts its recording by them.
  wallS() { return Math.round((performance.now() - this.startWall) / 100) / 10; }

  // Ends the current act's segment and opens one for the act now playing (none for home).
  nextSegment() {
    const now = this.wallS();
    const last = this.segments[this.segments.length - 1];
    if (last) last.endS = now;
    if (this.g.act !== 'home') this.segments.push({ act: this.g.act, round: this.g.round, startS: now, endS: null });
  }

  // A pause (Space or the zone setup) for the same timeline: on starts one, off ends it.
  markPause(on) {
    if (on && this.pauseAt === null) this.pauseAt = this.wallS();
    else if (!on && this.pauseAt !== null) { this.pauses.push([this.pauseAt, this.wallS()]); this.pauseAt = null; }
  }

  // Shoe boxes from feet.py while this game runs: onto the field, into the rules, with the usual step feedback.
  feedShoes(boxes) {
    const before = this.g.stats.steps;
    addShoes(this.g, mapShoes(boxes, this.layout()), this.g.t + (performance.now() - this.frameWall) / 1000);
    this.lastShoes = performance.now();
    if (this.g.stats.steps > before) {   // a shoe swing landed: the same feedback as a sensor strike
      const s = this.g.strikes[this.g.strikes.length - 1];
      this.footFlash[s.foot] = 1;
      sound.play('step');
      if (cameraWindowAlive()) send('foot-seen', { ev: { foot: s.foot, kind: 'strike', source: 'feet' } });
    }
  }

  layout() {
    const { width: W, height: H } = this.scale;
    if (this.currentLayout?.W === W && this.currentLayout.H === H) return this.currentLayout;
    this.currentLayout = floorLayout(W, H);
    return this.currentLayout;
  }

  yFor(distCm, L) { return fieldY(distCm, L); }

  showAct() {
    const a = ACTS[this.g.act];
    if (!a) return;
    sound.play('act');
    const { rounds, seeds } = plan(this.g);   // the clip records the last act of the last round
    if (SHARE && this.g.round === rounds && this.g.act === (seeds ? 'storm' : 'garden')) clip.start(this.game.canvas, sound.capture?.stream);
    this.actIntroUntil = this.g.t + 4.4;
    this.coachLine = shoesLive(this.g) ? a.how : a.hint;   // shoe mode: say what to do with the foot, plainly
    this.nextGardenUpdate = 0;
    say(a.intro.join(' '));
  }

  showFeedback(text, color) {
    this.feedback = text;
    this.feedbackColor = hex(color);
    this.feedbackUntil = this.g.t + 1.2;
    this.nextGardenUpdate = 0;
  }

  laneFlash(lane, color, duration, L) {
    const flash = this.add.rectangle(L.lanes[lane], (L.top + L.zoneY) / 2,
      L.laneW - L.gap / 2, L.zoneY - L.top, color, 0.6).setDepth(1);
    this.tweens.add({ targets: flash, alpha: 0, duration, onComplete: () => flash.destroy() });
  }

  leaveStamp(art, y, wobble = false) {
    art.setDepth(4);
    this.aftermath.push({ art, y, travelled: this.g.travelledCm, wobble });
  }

  resolveFx(th, L) {
    perceiver.checkStep(th);
    send('resolved', { th: { kind: th.kind, lane: th.lane, result: th.result } });
    sound.play(th.result !== 'hit' ? 'miss' : th.kind === 'flower' ? 'stomp' : 'dodge');
    if (th.result === 'hit') reaction(th.kind === 'flower' ? 'stomp' : 'dodge');
    const x = L.lanes[th.lane];
    const y = this.yFor(th.distCm, L);   // where the thing is now: it resolves a little past the line
    this.laneFlash(th.lane, th.result === 'hit' ? C.lime : C.amber, th.result === 'hit' ? 200 : 400, L);
    if (th.kind === 'flower' && th.result === 'hit') {
      this.fx.petals.explode(70, x, y);
      this.showFeedback('SMASH!', C.yellow);
      this.burst(x, y, C.yellow, 'SMASH!');
      this.cameras.main.shake(120, 0.004);
      const size = PLANT_SCALE * Math.min(1.15, L.W / FIELD.width);
      const stamp = this.add.image(x, y, this.flowerKey(th.id)).setScale(size, size * 1.25);
      this.leaveStamp(stamp, y);
      // Squash flat with a bounce, then stay as a flattened, still bright, record under the feet.
      this.tweens.add({ targets: stamp, scaleX: size * 1.45, scaleY: size * 0.22, duration: 90, ease: 'Quad.out',
        onComplete: () => this.tweens.add({ targets: stamp, scaleX: size * 1.25, scaleY: size * 0.38, alpha: 0.75, duration: 160, ease: 'Back.out' }) });
    }
    else if (th.kind === 'flower') {
      this.showFeedback(shoesLive(this.g) ? 'MISSED' : 'HIGHER STEP', C.amber);
      if (!shoesLive(this.g)) {   // in shoe mode a missed flower just goes: nothing lands on the feet
        const stamp = this.add.image(x, y, this.flowerKey(th.id)).setScale(PLANT_SCALE, PLANT_SCALE * 1.25).setAlpha(0.5);
        this.leaveStamp(stamp, y, true);
      }
    }
    else if (th.result === 'hit') {
      this.fx.sparks.explode(40, x, y); this.cameras.main.flash(140, 190, 255, 235);
      this.showFeedback('DODGED!', C.dodge);
      this.burst(x, y, C.dodge, 'DODGED!');
    }
    else {
      this.fx.goo.explode(40, x, y); this.cameras.main.shake(160, 0.006); this.showFeedback('SPLAT', C.pink);
      this.burst(x, y, C.pink, 'SPLAT!');
      const blot = this.add.graphics({ x, y });
      blot.fillStyle(C.pink, 0.8); blot.fillEllipse(0, 0, 220, 130);
      for (let i = 0; i < 7; i++) {
        const angle = i * Math.PI * 2 / 7;
        blot.fillEllipse(Math.cos(angle) * 100, Math.sin(angle) * 60, 60, 60);
      }
      blot.lineStyle(12, 0xffacd0, 0.8); blot.strokeEllipse(0, 0, 180, 100);
      this.leaveStamp(blot, y);
    }
  }

  // One big, short burst at the thing: an expanding ring, a spiky flash and the word, all readable from above.
  burst(x, y, color, word) {
    const ring = this.add.ellipse(x, y, 150, 90).setStrokeStyle(20, color, 1).setDepth(19);
    this.tweens.add({ targets: ring, scaleX: 4.2, scaleY: 4.2, alpha: 0, duration: 420, ease: 'Quad.out', onComplete: () => ring.destroy() });
    const star = this.add.graphics({ x, y }).setDepth(19);
    star.fillStyle(C.white, 0.95);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, r = i % 2 ? 60 : 150;
      const b = ((i + 1) / 10) * Math.PI * 2;
      star.fillTriangle(0, 0, Math.cos(a) * r, Math.sin(a) * r * 0.6, Math.cos(b) * (i % 2 ? 150 : 60), Math.sin(b) * (i % 2 ? 150 : 60) * 0.6);
    }
    this.tweens.add({ targets: star, scaleX: 1.6, scaleY: 1.6, alpha: 0, angle: 25, duration: 380, onComplete: () => star.destroy() });
    const text = this.add.text(x, y - 60, word, txt(120, color)).setOrigin(0.5).setDepth(21).setScale(0.4);
    this.tweens.add({ targets: text, scaleX: 1, scaleY: 1, y: y - 200, duration: 220, ease: 'Back.out',
      onComplete: () => this.tweens.add({ targets: text, alpha: 0, y: y - 260, duration: 500, delay: 250, onComplete: () => text.destroy() }) });
  }

  progress() {
    const g = this.g;
    const { rounds, seeds } = plan(g);
    const perRound = seeds ? 2 : 1;   // flowers, and seeds when there are any
    const total = 1 + perRound * rounds;   // the walk, then the acts of each round
    let done, within;
    if (g.act === 'walk') { done = 0; within = Math.min(1, g.walkGoodS / g.limits.walkSeconds); }
    else if (g.act === 'garden') { done = 1 + perRound * (g.round - 1); within = Math.min(1, g.actResolved / g.limits.gardenPlants); }
    else if (g.act === 'storm') { done = 2 + perRound * (g.round - 1); within = Math.min(1, g.actResolved / g.limits.stormSeeds); }
    else return 1;
    return (done + within) / total;
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
    const shoes = shoesLive(this.g);   // shoe mode: it is about where the foot lands, not how high it goes
    if (this.g.act === 'garden' && sum.stompPct !== null && sum.stompPct < 60) return shoes ? 'Step right onto the flower' : 'Knee up high, then stomp the flower';
    if (this.g.act === 'storm' && sum.dodgePct !== null && sum.dodgePct < 60) return shoes ? 'Keep that foot out of the seed\u2019s lane' : 'Lift the foot higher over the seed';
    return 'Great walking, keep it up';
  }

  update(_time, deltaMs) {
    if (this.paused || zone.active) return;
    const dt = deltaMs / 1000;   // Phaser already bounds a stalled frame (minFps 5, smoothed over frames)
    this.frameWall = performance.now();
    const out = step(this.g, dt);
    const L = this.layout();

    if (out.actChanged) {
      this.nextSegment();
      if (this.g.act === 'home') {
        // The scene is about to close: play the sounds, skip visuals that would be torn down at once.
        for (const th of out.resolved) {
          sound.play(th.result !== 'hit' ? 'miss' : th.kind === 'flower' ? 'stomp' : 'dodge');
          if (th.result === 'hit') reaction(th.kind === 'flower' ? 'stomp' : 'dodge');
        }
        const timing = { segments: this.segments, pauses: this.pauses, wallSeconds: this.wallS() };
        this.scene.start('home', { summary: { ...summary(this.g), perceptron: perceiver.summary(), ...timing }, sessionId: this.sessionId }); return;
      }
      this.sprites.forEach((s) => s.destroy());
      this.sprites.clear();
      this.showAct();
    }
    const g = this.g;
    for (const th of out.resolved) {
      this.resolveFx(th, L);
      // The log says why: where each shoe stood (lane, toe and heel cm from the line, age of the sighting) and when the
      // thing was last touched relative to its arrival, so a run of misses can be read without a camera.
      logRemote({ what: th.kind, lane: th.lane, result: th.result, at: Math.round(th.distCm), shoes: shoesLive(g), t: Math.round(g.t),
        feet: g.shoes.map((s) => [s.lane, Math.round(s.nearCm), Math.round(s.farCm), Math.round((g.t - s.t) * 1000)]),
        touch: th.touchedT === undefined ? null : Math.round((th.touchedT - th.arriveT) * 100) / 100 });
    }
    if (out.actChanged) logRemote({ what: 'act', act: g.act, round: g.round, t: Math.round(g.t) });
    if (Math.floor(g.t / 5) !== Math.floor((g.t - dt) / 5)) logRemote({ what: 'pace', cadence: out.pace.cadence, steps: g.stats.steps, form: Math.round(out.form * 100), shoes: shoesLive(g), base: g.base, t: Math.round(g.t) });

    // coach cue every 20 s: the server therapist (Gemini inside the therapist's limits), local rules offline
    if (this.g.t - this.lastCue > 20) {
      this.lastCue = this.g.t;
      this.askCoach();
    }

    this.lastForm = out.form;   // for things the camera resolves between frames
    this.drawWorld(L, out);
    this.drawThings(L, out);
    this.drawHud(L, out, dt);
  }

  drawWorld(L, out) {
    drawFloor(this, L, this.g.travelledCm, this.g.t, out.pace.gated);
    for (const lane of ['L', 'R']) this.pods[lane].setPosition(L.lanes[lane], Math.max(66, L.top - 20));
    this.aftermath = this.aftermath.filter(stamp => {
      stamp.art.y = stamp.y + (this.g.travelledCm - stamp.travelled) * (L.zoneY - L.top) / RULES.aheadCm;
      if (stamp.art.y > L.H + 180) { stamp.art.destroy(); return false; }
      if (stamp.wobble) stamp.art.setAngle(Math.sin(this.g.t * 9) * 9);
      return true;
    });
  }

  flowerKey(id) { return ['flower', 'flower-bell', 'flower-rose'][(id - 1) % 3]; }

  drawThings(L, out) {
    const g = this.g;
    const live = new Set();
    for (const th of g.things) {
      live.add(th.id);
      let s = this.sprites.get(th.id);
      if (!s) {
        const pad = this.add.ellipse(0, 34, 300, 144).setStrokeStyle(12, C.lime, 0.6).setVisible(false);
        // Shoe mode: a solid coloured disc under the thing once it is on the belt, for the camera (cyan flower, magenta seed).
        const mark = this.add.ellipse(0, 20, 200, 120, th.kind === 'flower' ? 0x00e5ff : 0xff00c8, 1).setVisible(false);
        const arc = this.add.graphics({ x: 0, y: 34 }).setScale(1, 0.48);
        const plant = this.add.image(0, 0, th.kind === 'flower' ? this.flowerKey(th.id) : 'seed')
          .setScale(th.kind === 'flower' ? PLANT_SCALE : 2.0);
        // Pads travel with the exact rules position; tile decoration never snaps an obstacle's distance.
        s = this.add.container(L.lanes[th.lane], L.top, [mark, pad, plant, arc]).setDepth(5);
        this.sprites.set(th.id, s);
        if (th.kind === 'seed') {
          sound.play('seed');
          const pod = this.pods[th.lane];
          this.tweens.killTweensOf(pod);
          pod.setScale(POD_SCALE);   // a second seed mid-hiccup restarts from rest, never from a squashed pod
          this.tweens.add({ targets: pod, scaleX: POD_SCALE * 1.2, scaleY: POD_SCALE * 0.8, duration: 120, yoyo: true });
        }
      }
      const y = this.yFor(th.distCm, L);
      const near = Math.max(0, 1 - th.distCm / RULES.aheadCm);
      const plant = s.list[2];
      const scale = Math.min(1.15, L.W / FIELD.width);
      s.setPosition(L.lanes[th.lane], y).setScale(scale, scale * 1.25);
      s.setVisible(!th.result);
      const pad = s.list[1];
      // Once open, the window stays open: a pace dip must not flip the cue back or flash the lane again.
      const windowOpen = s.windowOpen || th.arriveT !== null || th.distCm <= out.speed * RULES.beforeS;
      pad.setVisible(near > 0.72 && !th.result);
      s.list[0].setVisible(!!camH && !th.result && th.distCm < RULES.markShowCm);   // the camera mark, from just before the line
      pad.setStrokeStyle(12, windowOpen ? C.white : C.lime, windowOpen ? 1 : 0.6);
      pad.setScale(windowOpen ? 1 : 1 + 0.06 * Math.sin(g.t * Math.PI * 6));
      const arc = s.list[3];
      arc.clear();
      if (windowOpen && !th.result && !shoesLive(g)) {   // the timing arc belongs to the lift rules
        const arrival = th.arriveT ?? g.t + (out.speed > 0 ? th.distCm / out.speed : 0);   // at the current speed; a ramp shifts it
        const left = Math.max(0, Math.min(1, (arrival + RULES.afterS - g.t) / (RULES.beforeS + RULES.afterS)));
        if (left > 0) {
          arc.lineStyle(16, th.kind === 'seed' ? C.pink : C.white);
          arc.beginPath(); arc.arc(0, 0, 170, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); arc.strokePath();
        }
        if (!s.windowOpen) this.laneFlash(th.lane, C.white, 160, L);
      }
      s.windowOpen = windowOpen;
      plant.setVisible(!(th.kind === 'flower' && th.result === 'hit'));
      if (th.kind === 'seed' && !th.result) plant.setRotation(plant.rotation + 0.15);
      else plant.setAngle(Math.sin(g.t * 3 + th.id) * 5);
    }
    for (const [id, s] of this.sprites) if (!live.has(id)) { s.destroy(); this.sprites.delete(id); }
    const storm = g.act === 'storm';
    for (const lane of ['L', 'R']) this.pods[lane].setVisible(storm);
  }

  drawHud(L, out, dt) {
    // Rings under the detected shoes: the live check that the shoe calibration matches the floor.
    const fresh = shoesLive(this.g) && performance.now() - this.lastShoes < 400;
    const k = ease(dt, RING_EASE_S);
    this.shoeRings.forEach((ring, i) => {
      const s = this.g.shoes.find((sh) => sh.lane === (i ? 'R' : 'L'));
      if (s) {
        const x = s.xFrac * L.W, y = this.yFor((s.nearCm + s.farCm) / 2, L);   // where the shoe really is in its lane
        // A step snaps (the ring is the live calibration check); only box jitter under the deadband is smoothed.
        if (ring.visible && Math.hypot(x - ring.x, y - ring.y) < RING_SNAP_PX) ring.setPosition(ring.x + (x - ring.x) * k, ring.y + (y - ring.y) * k);
        else ring.setPosition(x, y);
      }
      ring.setVisible(fresh && !!s);
    });
    const g = this.g;
    const h = this.hud;
    h.clear();

    const gated = out.pace.gated;
    const beat = g.t * (g.limits.minCadence + 20) / 60;
    const next = {};
    for (const th of g.things) if (!th.result && (!next[th.lane] || th.distCm < next[th.lane].distCm)) next[th.lane] = th;
    for (const lane of ['L', 'R']) {
      this.footFlash[lane] = Math.max(0, this.footFlash[lane] - dt * 3);
      this.meterFlash[lane] = Math.max(0, this.meterFlash[lane] - dt);
      const th = next[lane];
      const need = th ? needCm(g, th.kind, lane) : null;
      const urgent = th && 1 - th.distCm / RULES.aheadCm > 0.72;
      const active = Math.floor(beat) % 2 === (lane === 'L' ? 0 : 1);
      this.feet[lane].setTexture(`foot-ghost-${lane.toLowerCase()}${gated && active ? '-amber' : ''}`);
      // Each step lights its footprint briefly, so a working sensor is visible at a glance.
      // Shoe mode: nothing is projected on the feet themselves, so the camera sees socks, not footprints.
      this.feet[lane].setVisible(!shoesLive(g)).setAlpha(Math.max(gated && active ? 0.3 + 0.7 * (1 - beat % 1) : 0.3, this.footFlash[lane]));
      if (!shoesLive(g)) drawMeter(h, L, lane, this.lift[lane], need, th?.kind === 'flower' ? C.amber : C.pink,
        this.meterFlash[lane], urgent);   // lift meters mean nothing while shoes drive the game
      this.lift[lane] = Math.max(0, this.lift[lane] - dt * 25);
    }

    if (g.t >= this.nextGardenUpdate) {
      this.nextGardenUpdate = g.t + .2;
      const act = ACTS[g.act];
      publishGarden({ cadence: out.pace.cadence, act: g.act, paceOk: !out.pace.gated,
        paused: this.paused, title: `${act?.title || ''}${g.round > 1 && g.act !== 'walk' ? ` · round ${g.round}` : ''}`, score: `${g.score} pts${g.streak >= 5 ? '  x2' : ''}`,
        progress: this.progress(), pace: `${out.pace.cadence} steps/min · min ${g.limits.minCadence} · speed x${speedScale(g).toFixed(1)}${shoesLive(g) ? ' · shoes' : ''} · form ${Math.round(out.form * 100)}%${out.pace.asym !== null ? ` · even L/R ${Math.max(0, Math.round(100 - out.pace.asym * 100))}%` : ''}${perceiver.used ? ` · ${perceiver.badge()}` : ''}`,
        coachColor: g.t < this.feedbackUntil ? this.feedbackColor : '',
        coach: g.t < this.feedbackUntil ? this.feedback : g.t < this.actIntroUntil ? (shoesLive(g) ? `${act.title.split(' · ')[1]}: ${act.how}` : act.intro.join(' ')) : this.coachLine });
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
      score: `${s.score} pts`, progress: 1, pace: `${s.steps} steps · form ${s.formPct}%`, coachColor: '', coach: 'Welcome home, Gus! · Walk to play again' });
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
      `Flowers stomped ${s.stompPct ?? 0}%${s.dodgePct == null ? '' : `   ·   Seeds dodged ${s.dodgePct}%`}`,
      s.shoeMode ? `Long steps  left ${s.highLiftAvgCm?.L ?? '-'}   right ${s.highLiftAvgCm?.R ?? '-'}  (swing, camera)`
        : `High steps  left ${s.highLiftAvgCm?.L ?? '-'} cm   right ${s.highLiftAvgCm?.R ?? '-'} cm`,
    ];
    if (s.perceptron?.checked) lines.push(`Perceptron double-check agreed on ${s.perceptron.agree} of ${s.perceptron.checked} steps`);
    this.stats = lines.map((line) => text(line, bodySize));
    this.labText = text(data.labStatus || (s.perceptron ? 'Perceptron lab is reviewing your walk…' : ''), small ? 18 : 22, C.cyan);
    // Measure a three-line slot before replacing the sample with the asynchronous note.
    this.noteText = text('Ag\nAg\nAg', small ? 18 : 22, C.cyan);
    this.noteHeight = this.noteText.height;
    this.noteText.setText(data.result ? data.result.note || '' : 'The coach is writing your note…');
    this.rewardText = text('Ag\nAg', bodySize, C.magenta);
    this.rewardHeight = this.rewardText.height;
    this.rewardText.setText('');
    // The side camera's gait review: room for four lines once one is on its way, so the card does not jump.
    this.gaitText = text('Ag\nAg\nAg\nAg', small ? 18 : 22, C.green);
    this.gaitHeight = this.gaitText.height;
    this.gaitText.setText('');
    this.footer = text('Walk to play again · R', small ? 22 : 24, C.yellow);
    this.shareText = text(SHARE ? data.shareStatus || 'Preparing your walk clip…' : '', small ? 20 : 24, C.yellow);
    this.qrImage = null;
    this.layoutCard();
    if (data.share) this.showShare(data.share);
    if (SHARE && !data.clipTask) {
      data.clipTask = this.prepareClip(data);
    }
    if (data.result) this.showResult(data.result);
    if (data.gaitStatus) this.showGait();
    say(`${ENDING} ${s.stompPct ?? 0} percent of flowers stomped. Great walking.`);
    const playAgain = () => {
      if (this.restarting || zone.active) return;   // once, and not under the zone setup
      this.restarting = true;
      data.cancelled = true; data.uploadAbort?.abort(); clip.cancel();
      playerReady = loadPlayer();
      playerReady.then(() => { if (this.sys.isActive() || this.sys.isPaused()) this.scene.start('play'); });   // the panel's new limits apply
    };
    this.input.keyboard.on('keydown-R', playAgain);
    // Walking again starts the next game by itself, once the card has been on screen for a moment.
    const steps = [];
    const shownAt = performance.now();
    this.offFoot = onFoot((ev) => {
      if (doubleCamera(ev) || ev.kind !== 'strike' || performance.now() - shownAt < 8000) return;
      steps.push(performance.now());
      while (steps.length && performance.now() - steps[0] > 3000) steps.shift();
      if (steps.length >= 4) playAgain();
    });
    this.events.once('shutdown', () => this.offFoot());
    const again = () => restartWhenShown(this, data);
    this.scale.once('resize', again);
    this.events.once('shutdown', () => this.scale.off('resize', again));
    if (data.replay) return;
    data.replay = true;
    window.dispatchEvent(new CustomEvent('zombiewalk:session', { detail: s }));
    if (params.get('scene') === 'home') return;   // preview only, nothing to save
    if (s.perceptron) {
      data.labStatus = 'Perceptron lab is reviewing your walk…';   // kept across a zone-setup pause
      data.labTask = perceiver.sessionReport().then((report) => {
        data.labReport = report;
        data.caption = report?.caption || null;
        data.labStatus = report?.source === 'perceptron'
          ? `${report.clips ? `Perceptron saw ${report.clips.length} high steps` : 'Perceptron lab ready'}${data.caption ? ' · caption ready' : ''}`
          : 'Perceptron lab unavailable for this walk';
        if (!data.cancelled && this.homeData === data && this.sys.isActive()) this.showLab();
      });
    }
    const verified = (s.formPct ?? 0) >= 40;        // walking was verified for most of the session
    withTimeout(api('/api/session', { player: settings.player, summary: s, verified, ...(data.sessionId && { id: data.sessionId }) }), 25000)
      .then((result) => {
        data.result = result;
        if (this.sys.isActive()) this.showResult(result);
        // gaitReview null: no side camera recorded this game, so no review will come. (An older server leaves it out.)
        const id = result?.id || data.sessionId;
        if (id && !data.cancelled && result?.gaitReview !== null) this.followGait(data, id, result?.gaitReview);
      })
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
    const items = [this.heading, this.ending, ...this.stats, this.labText, this.noteText, this.gaitText, this.rewardText, this.footer];
    for (const item of items) item.setScale(1).setWordWrapWidth(textWidth);
    const reservedHeight = (item) => Math.max(item.height,
      item === this.noteText ? this.noteHeight : item === this.rewardText ? this.rewardHeight
        : item === this.gaitText && this.homeData.gaitStatus ? this.gaitHeight : 0);
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
    this.shareText.setScale(1).setWordWrapWidth(qrWidth);
    if (this.qrImage) this.shareText.setScale(Math.min(1, 64 / Math.max(1, this.shareText.height)));
    this.shareText.setPosition(qrX, top + cardH / 2 + (this.qrImage ? qrWidth / 2 + 12 : -30));
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

  showLab() {
    // The caption goes with the lab line; the line under the QR keeps telling the player to scan.
    this.labText.setText([this.homeData.labStatus, this.homeData.caption && `“${this.homeData.caption}”`].filter(Boolean).join('\n'));
    this.layoutCard();
  }

  // After the save: when a side camera recorded this walk, its review is on the way. Poll every 3 s for up to
  // 2 minutes; a newer game (R, walking again) or a newer Home stops it. Nothing shows without a side camera.
  async followGait(data, id, saved) {
    if (saved) { data.gaitReview = saved; data.gaitStatus = saved.status; if (this.sys.isActive()) this.showGait(); }
    const url = `/api/session/${encodeURIComponent(id)}`;
    const until = performance.now() + 120000;
    for (let first = true; performance.now() < until; first = false) {
      if (!first || saved) await new Promise((resolve) => setTimeout(resolve, 3000));
      if (data.cancelled || this.homeData !== data) return;
      let review;
      try { review = (await withTimeout(api(url), 5000)).gaitReview; } catch { if (first && !saved) return; continue; }
      if (data.cancelled || this.homeData !== data) return;
      if (!review) return;   // no side camera checked in for this game
      data.gaitReview = review;
      data.gaitStatus = review.status;
      if (this.sys.isActive()) this.showGait();
      if (review.status === 'done' || review.status === 'failed') {
        const words = review.review?.playerFeedback;
        if (review.status === 'done' && words && !data.gaitSpoken) { data.gaitSpoken = true; say(words); }
        return;
      }
    }
    if (data.cancelled || this.homeData !== data) return;
    data.gaitStatus = 'late';
    if (this.sys.isActive()) this.showGait();
  }

  showGait() {
    const d = this.homeData;
    const r = d.gaitReview?.review;
    this.gaitText.setText(d.gaitStatus === 'done' && r ? [r.playerFeedback, r.focus?.text && `Next time: ${r.focus.text}`].filter(Boolean).join('\n')
      : d.gaitStatus === 'waiting' || d.gaitStatus === 'reviewing' ? 'The coach is reviewing your walk…'
        : d.gaitStatus === 'late' ? 'Your walk review will be in the therapist panel.'
          : d.gaitStatus === 'failed' ? `No walk review this time${d.gaitReview?.reason ? `: ${d.gaitReview.reason}` : ''}` : '');
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
  scale: { mode: Phaser.Scale.NONE, ...FIELD },
  // A stalled frame is bounded here (Phaser's defaults, pinned): the rules get at most 200 ms per step, never a leap.
  fps: { min: 5, smoothStep: true },
  scene: [Preload, Boot, ZonePreview, Title, Play, Home],
});

// A small copy of the projected picture for the camera window, a few times a second, only while it is open.
const mirror = document.createElement('canvas');
mirror.width = 180; mirror.height = 320;
let lastMirror = 0;
window.zombieGame.events.on('postrender', () => {
  const now = performance.now();
  if (now - lastMirror < 500 || !cameraWindowAlive()) return;
  lastMirror = now;
  mirror.getContext('2d').drawImage(window.zombieGame.canvas, 0, 0, mirror.width, mirror.height);
  send('mirror', { url: mirror.toDataURL('image/jpeg', 0.6) });
});
