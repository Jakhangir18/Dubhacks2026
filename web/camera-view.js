// Camera window for the laptop screen: the camera picture with the leg skeleton, live lift values and a graph,
// the steps and plants as they happen, a small copy of the projected game, and every Perceptron verdict.
// It owns the camera and the Perceptron checks; the game window on the projector gets the steps over link.js.
import { FootTracker } from './vision.js';
import { onFoot } from './bus.js';
import { Perceiver } from './perceive.js';
import { send, listen } from './link.js';

const CAM_KEY = window.Warp.CAM_KEY;
const CORNERS = ['FRONT-LEFT', 'FRONT-RIGHT', 'BACK-RIGHT', 'BACK-LEFT'];


const store = window.Warp.store;
// The saved shoe calibration, read once and after each save (this window is the only writer).
let saved = { points: store.get(CAM_KEY + '.points', null), picture: store.get(CAM_KEY + '.picture', 'local') };
const $ = (id) => document.getElementById(id);
const video = $('video');
const overlay = $('overlay');
const octx = overlay.getContext('2d');
const graph = $('graph');
const gctx = graph.getContext('2d');
$('height').value = store.get('zombiewalk.heightCm', 160);

const LEGS = { L: [23, 25, 27, 29, 31, 27], R: [24, 26, 28, 30, 32, 28] };
const COLOR = { L: '#ffe44d', R: '#2de2ff' };
const history = [];            // {t, L, R} lift in cm, last 8 s
let frames = 0, fpsT = performance.now(), fps = 0;

const tracker = new FootTracker({
  video,
  heightCm: Number($('height').value),
  onFrame: (lm, state) => {
    frames++;
    const now = performance.now();
    if (now - fpsT > 1000) { fps = Math.round((frames * 1000) / (now - fpsT)); frames = 0; fpsT = now; }
    $('st-cam').textContent = lm ? `camera ${fps} fps` : `camera ${fps} fps · no person`;
    $('st-cam').classList.toggle('on', !!lm);
    drawSkeleton(lm, state);
    $('liftL').textContent = state.L.liftCm.toFixed(1);
    $('liftR').textContent = state.R.liftCm.toFixed(1);
    history.push({ t: now, L: state.L.liftCm, R: state.R.liftCm });
    while (history.length && now - history[0].t > 8000) history.shift();
  },
});

// Shoe boxes from feet.py (forwarded by the game window) and the calibration corners, drawn over the picture.
let shoes = { boxes: [], at: 0 };
let camFeed = { at: 0, w: 0, h: 0 };   // feet.py's picture, when it is running
let calib = { points: [], active: false };
function drawShoes(w, h) {
  if (performance.now() - shoes.at < 500) {
    octx.lineWidth = 5; octx.strokeStyle = '#9cff5a'; octx.fillStyle = '#9cff5a';
    for (const [x1, y1, x2, y2] of shoes.boxes) {
      octx.strokeRect(x1 * w, y1 * h, (x2 - x1) * w, (y2 - y1) * h);
      octx.beginPath(); octx.arc((x1 + x2) / 2 * w, y2 * h, 8, 0, Math.PI * 2); octx.fill();   // the toe tip the game uses
    }
  }
  const pts = calib.active ? calib.points : (Array.isArray(saved.points) ? saved.points : []);
  const picture = feedLive() ? 'feed' : 'local';
  if (!calib.active && saved.picture !== picture) return;   // clicked on the other camera's picture: not shown over this one
  octx.strokeStyle = '#ff2d95'; octx.fillStyle = '#ff2d95'; octx.lineWidth = 4;
  pts.forEach(([x, y], i) => {
    octx.beginPath(); octx.arc(x * w, y * h, 10, 0, Math.PI * 2); octx.fill();
    octx.font = 'bold 26px system-ui'; octx.fillText(CORNERS[i], x * w + 14, y * h - 10);
  });
  if (pts.length === 4) { octx.beginPath(); pts.forEach(([x, y], i) => (i ? octx.lineTo(x * w, y * h) : octx.moveTo(x * w, y * h))); octx.closePath(); octx.stroke(); }
}

const feedLive = () => performance.now() - camFeed.at < 2000;

function drawSkeleton(lm, state) {
  const live = feedLive();   // feet.py's picture replaces the local video; the pose skeleton belongs to the local video only
  const w = live ? camFeed.w : (video.videoWidth || 1280), h = live ? camFeed.h : (video.videoHeight || 720);
  if (overlay.width !== w || overlay.height !== h) { overlay.width = w; overlay.height = h; }
  octx.clearRect(0, 0, w, h);
  drawShoes(w, h);
  if (!lm || live) return;
  octx.lineWidth = 6; octx.lineCap = 'round';
  octx.strokeStyle = '#ffffff88';
  octx.beginPath(); octx.moveTo(lm[23].x * w, lm[23].y * h); octx.lineTo(lm[24].x * w, lm[24].y * h); octx.stroke();
  for (const side of ['L', 'R']) {
    octx.strokeStyle = COLOR[side]; octx.fillStyle = COLOR[side];
    octx.beginPath();
    LEGS[side].forEach((i, k) => (k ? octx.lineTo(lm[i].x * w, lm[i].y * h) : octx.moveTo(lm[i].x * w, lm[i].y * h)));
    octx.stroke();
    for (const i of LEGS[side]) { octx.beginPath(); octx.arc(lm[i].x * w, lm[i].y * h, 7, 0, Math.PI * 2); octx.fill(); }
    const toe = lm[LEGS[side][4]];
    octx.font = 'bold 34px system-ui'; octx.lineWidth = 6; octx.strokeStyle = '#000';
    const label = `${side} ${state[side].liftCm.toFixed(0)} cm`;
    octx.strokeText(label, toe.x * w + 14, toe.y * h + 10); octx.fillText(label, toe.x * w + 14, toe.y * h + 10);
    octx.lineWidth = 6;
  }
}

function drawGraph() {
  const w = graph.width, h = graph.height, now = performance.now();
  gctx.clearRect(0, 0, w, h);
  const y = (cm) => h - 10 - (Math.min(30, cm) / 30) * (h - 20);   // 0 to 30 cm
  gctx.strokeStyle = '#24343a'; gctx.lineWidth = 1;
  for (const cm of [0, 10, 20, 30]) { gctx.beginPath(); gctx.moveTo(0, y(cm)); gctx.lineTo(w, y(cm)); gctx.stroke(); }
  for (const side of ['L', 'R']) {
    gctx.strokeStyle = COLOR[side]; gctx.lineWidth = 3; gctx.beginPath();
    history.forEach((p, k) => {
      const x = w - ((now - p.t) / 8000) * w;
      if (k) gctx.lineTo(x, y(p[side])); else gctx.moveTo(x, y(p[side]));
    });
    gctx.stroke();
  }
  requestAnimationFrame(drawGraph);
}
requestAnimationFrame(drawGraph);

// Every step goes to the game window and into the list.
const events = $('events');
function logLine(text, cls = '') {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} · ${text}`;
  if (cls) li.className = cls;
  events.prepend(li);
  while (events.children.length > 60) events.lastChild.remove();
}
onFoot((ev) => {
  send('foot', { foot: ev.foot, kind: ev.kind, liftCm: ev.liftCm });
  logEvent(ev);
});
function logEvent(ev) {
  const from = ev.source && ev.source !== 'camera' ? ` (${ev.source})` : '';
  logLine(ev.kind === 'lift' ? `${ev.foot} lift ${ev.liftCm} cm${from}` : `${ev.foot} strike${from}`);
}

// Camera start and stop, as in the game's camera panel.
let starting = false;
async function start() {
  if (starting) return;   // one pose model, one camera stream at a time
  starting = true;
  try {
    $('st-cam').textContent = 'loading the pose model…';
    const id = $('dev').value || store.get('zombiewalk.camera', null);
    await tracker.start(id);
    const cams = await FootTracker.cameras();
    const current = video.srcObject.getVideoTracks()[0].getSettings().deviceId;
    $('dev').replaceChildren(...cams.map((c, i) => new Option(c.label || `camera ${i + 1}`, c.deviceId)));
    $('dev').value = current;
    store.set('zombiewalk.camera', current);
  } catch (e) {
    $('st-cam').textContent = `camera error: ${e?.name || ''} ${e?.message || e}`;
  } finally { starting = false; }
}
$('start').onclick = start;
$('stop').onclick = () => { tracker.stop(); $('st-cam').textContent = 'camera off'; $('st-cam').classList.remove('on'); };
$('dev').onchange = () => { store.set('zombiewalk.camera', $('dev').value); start(); };
$('height').onchange = () => {
  const v = Number($('height').value);
  if (v >= 90 && v <= 210) { tracker.heightCm = v; tracker.cmPerPx = null; store.set('zombiewalk.heightCm', v); }
  else $('height').value = tracker.heightCm;
};

// Perceptron runs here, on this window's camera, on behalf of the game window.
const perceiver = new Perceiver(tracker);
let paused = false;
const feed = $('pp-feed');
let lastState = '';
perceiver.onResult = ({ kind, th, out, frame }) => {
  if (feed.classList.contains('hint')) { feed.classList.remove('hint'); feed.textContent = ''; }
  const row = document.createElement('div');
  row.className = 'pp';
  const img = document.createElement('img');
  if (frame) img.src = frame;
  const text = document.createElement('div');
  text.textContent = kind === 'step'
    ? `${th.lane} ${th.kind}: game ${th.result === 'hit' ? 'hit' : 'miss'} · Perceptron ${out.verdict}${out.note ? ` — ${out.note}` : ''}`
    : `form: on pad ${out.onPad}, rail ${out.holdingRail}, steady ${out.steady}`;
  row.append(img, text);
  feed.prepend(row);
  while (feed.children.length > 8) feed.lastChild.remove();
};
setInterval(() => {
  const state = { checked: perceiver.checked, agree: perceiver.agree,
    form: perceiver.form && { onPad: perceiver.form.onPad, holdingRail: perceiver.form.holdingRail, steady: perceiver.form.steady } };
  const key = JSON.stringify(state);
  if (key !== lastState) { lastState = key; send('perceiver-state', { state }); }
  $('st-pp').textContent = perceiver.used ? `Perceptron ${perceiver.agree}/${perceiver.checked}` : 'Perceptron off';
  $('st-pp').classList.toggle('on', perceiver.enabled);
}, 500);

let gameSeen = 0;
listen((m) => {
  if (m.type === 'perceiver-reset') { paused = false; perceiver.reset(!!m.enabled, String(m.player || 'Player'), () => paused); lastState = ''; }
  else if (m.type === 'perceiver-paused') paused = !!m.paused;
  else if (m.type === 'perceiver-stop') perceiver.stop();
  else if (m.type === 'perceiver-step') perceiver.checkStep(m.th);
  else if (m.type === 'perceiver-report-request') perceiver.sessionReport().then((report) => send('perceiver-report', { id: m.id, report }));
  else if (m.type === 'foot-seen' && m.ev) logEvent(m.ev);
  else if (m.type === 'shoes-seen' && Array.isArray(m.boxes)) { shoes = { boxes: m.boxes, at: performance.now() }; }
  else if (m.type === 'frame-seen' && typeof m.jpeg === 'string') {
    const img = $('feed');
    img.onload = () => { camFeed = { at: performance.now(), w: img.naturalWidth, h: img.naturalHeight }; };
    img.src = m.jpeg;
  }
  else if (m.type === 'mirror') { $('mirror').src = m.url; gameSeen = performance.now(); }
  else if (m.type === 'game') {
    gameSeen = performance.now();
    $('b-title').textContent = m.state.title || 'ZOMBIE WALK HOME';
    $('b-score').textContent = m.state.score || '';
    $('b-coach').textContent = m.state.coach || '';
    $('b-pace').textContent = m.state.pace || '';
  } else if (m.type === 'resolved') {
    const { kind, lane, result } = m.th;
    const what = kind === 'flower' ? (result === 'hit' ? 'stomped' : 'missed') : (result === 'hit' ? 'dodged' : 'hit by the seed');
    logLine(`${lane} ${kind} ${what}`, result === 'hit' ? 'hit' : 'miss');
  }
});

// Tell the game window this one is here; show whether the game is.
setInterval(() => {
  send('camera-alive');
  const live = performance.now() - gameSeen < 3000;
  // The game window closed or reloaded mid-walk: stop sending leg frames to Perceptron.
  if (perceiver.enabled && performance.now() - gameSeen > 5000) perceiver.stop();
  $('st-game').textContent = live ? 'game window linked' : 'game window not open';
  $('st-game').classList.toggle('on', live);
}, 1000);

// Pose steps off when feet.py shoes drive the game (the game ignores them anyway once shoes arrive).
$('pose').checked = store.get('zombiewalk.poseSteps', true);
tracker.emit = $('pose').checked;
$('pose').onchange = () => { tracker.emit = $('pose').checked; store.set('zombiewalk.poseSteps', tracker.emit); };

// Shoe calibration: click the four projected zone corners in the camera picture, in the zone's own order.
// The homography maps normalised camera coordinates onto the 720 x 1280 game field; the game reads it from storage.
const FIELD = [[0, 0], [720, 0], [720, 1280], [0, 1280]];
const help = $('calib-help');
$('calib').onclick = () => {
  calib = { points: [], active: true };
  help.hidden = false;
  help.textContent = `Press Z in the game so the corner labels are projected on the floor, then click the corner labelled ${CORNERS[0]} here in the picture (Esc cancels).`;
};
overlay.parentElement.addEventListener('click', (e) => {
  if (!calib.active) return;
  const r = overlay.getBoundingClientRect();
  calib.points.push([(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]);
  if (calib.points.length < 4) { help.textContent = `Now click ${CORNERS[calib.points.length]}.`; return; }
  const h = window.Warp.homography(calib.points.map(([x, y]) => [x, y]), FIELD);
  if (!h.every(Number.isFinite)) { help.textContent = 'Those four points do not make a quad; try again.'; calib.active = false; return; }
  store.set(CAM_KEY, h);
  saved = { points: calib.points, picture: feedLive() ? 'feed' : 'local' };   // which picture the corners were clicked on
  store.set(CAM_KEY + '.points', saved.points);
  store.set(CAM_KEY + '.picture', saved.picture);
  calib.active = false;
  help.textContent = 'Saved. Walk: the game draws a ring under each shoe; if the rings are off, calibrate again.';
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && calib.active) { calib.active = false; help.hidden = true; } });
setInterval(() => {
  const live = performance.now() - shoes.at < 1500;
  const picture = feedLive() ? 'feed' : 'local';
  const calibrated = saved.points ? (saved.picture === picture ? 'calibrated' : 'calibrated on the other camera: calibrate again') : 'not calibrated';
  $('st-shoes').textContent = live ? `shoes ${shoes.boxes.length} · ${calibrated}` : `shoes: ${calibrated}, none seen`;
  $('st-shoes').classList.toggle('on', live);
  // feet.py's picture in, the local video out, and the overlay redrawn when no tracker frame will do it.
  const feed = feedLive();
  $('feed').hidden = !feed; $('feed-note').hidden = !feed; video.hidden = feed;
  if (!tracker.running) drawSkeleton(null, tracker.state);
}, 500);
