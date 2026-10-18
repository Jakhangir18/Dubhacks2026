// Camera panel (press V in the game): pick the phone or webcam, enter the player's height, watch live lift values.
import { FootTracker } from './vision.js';

const store = window.Warp.store;

export function mountCameraPanel() {
  const panel = document.createElement('div');
  panel.id = 'campanel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="row"><b>Camera</b> <select id="cp-dev"><option value="">press Start to list cameras</option></select></div>
    <div class="row">Player height <input id="cp-h" type="number" min="90" max="210" step="1"> cm
      <button id="cp-start">Start</button> <button id="cp-stop">Stop</button></div>
    <div class="vid"><video id="cp-video" playsinline muted></video><canvas id="cp-canvas"></canvas></div>
    <div id="cp-status" class="row">camera off · keyboard still works</div>
    <div class="row hint">Floor mode: camera in front of the player at about 45°, knee height, both lower legs in view.</div>`;
  document.body.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `
    #campanel { position: fixed; right: 12px; bottom: 12px; z-index: 30; width: 380px; background: rgba(12,12,12,.94);
      border: 1px solid #333; border-radius: 12px; padding: 10px; color: #ddd; font: 13px system-ui, sans-serif; }
    #campanel .row { margin: 6px 0; } #campanel b { color: #7CFF4F; }
    #campanel select, #campanel input { background: #222; color: #fff; border: 1px solid #444; border-radius: 6px; padding: 3px; }
    #campanel select { width: 70%; } #campanel input { width: 60px; }
    #campanel button { background: #2a2a2a; color: #fff; border: 1px solid #555; border-radius: 6px; padding: 3px 10px; cursor: pointer; }
    #campanel .vid { position: relative; } #campanel video, #campanel canvas { width: 100%; display: block; border-radius: 8px; }
    #campanel canvas { position: absolute; inset: 0; } #campanel .hint { color: #888; }`;
  document.head.appendChild(style);

  const $ = (id) => panel.querySelector(`#${id}`);
  const video = $('cp-video');
  const canvas = $('cp-canvas');
  const ctx = canvas.getContext('2d');
  const status = $('cp-status');
  const heightInput = $('cp-h');
  heightInput.value = store.get('zombiewalk.heightCm', 160);

  let frames = 0;
  let fpsT = performance.now();
  let fps = 0;
  const tracker = new FootTracker({
    video,
    heightCm: Number(heightInput.value),
    onFrame: (lm, state) => {
      frames++;
      const now = performance.now();
      if (now - fpsT > 1000) { fps = Math.round((frames * 1000) / (now - fpsT)); frames = 0; fpsT = now; }
      const vw = video.videoWidth || 640, vh = video.videoHeight || 360;
      if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (lm) {
        for (const [i, c] of [[29, '#ffe44d'], [31, '#ffe44d'], [30, '#2de2ff'], [32, '#2de2ff'], [27, '#fff'], [28, '#fff']]) {
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.arc(lm[i].x * canvas.width, lm[i].y * canvas.height, 8, 0, Math.PI * 2); ctx.fill();
        }
      }
      status.textContent = lm
        ? `${fps} fps · lift L ${state.L.liftCm.toFixed(1)} cm · R ${state.R.liftCm.toFixed(1)} cm`
        : `${fps} fps · no person in view`;
    },
  });

  let busy = false;
  let pending = false;            // a camera switch asked for while the model was still loading
  async function start() {
    if (busy) { pending = true; return; }
    busy = true;
    try {
      const id = $('cp-dev').value || store.get('zombiewalk.camera', null);
      status.textContent = 'loading the pose model…';
      await tracker.start(id);
      const cams = await FootTracker.cameras();
      const current = video.srcObject.getVideoTracks()[0].getSettings().deviceId;
      const select = $('cp-dev');
      select.replaceChildren(...cams.map((c, i) => new Option(c.label || `camera ${i + 1}`, c.deviceId)));   // labels as text, not HTML
      select.value = current;
      store.set('zombiewalk.camera', current);
    } catch (e) {
      status.textContent = `camera error: ${e && (e.message || e.name) ? `${e.name || ''} ${e.message || ''}` : String(e)}`;
      console.error('camera start failed', e);
    } finally {
      busy = false;
      if (pending) { pending = false; start(); }
    }
  }

  $('cp-start').addEventListener('click', start);
  $('cp-stop').addEventListener('click', () => { tracker.stop(); status.textContent = 'camera off · keyboard still works'; });
  $('cp-dev').addEventListener('change', () => { store.set('zombiewalk.camera', $('cp-dev').value); start(); });
  heightInput.addEventListener('change', () => {
    const v = Number(heightInput.value);
    if (v >= 90 && v <= 210) { tracker.heightCm = v; tracker.cmPerPx = null; store.set('zombiewalk.heightCm', v); }
    else heightInput.value = tracker.heightCm;
  });
  panel.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => b.blur()));

  return { toggle() { panel.hidden = !panel.hidden; }, tracker };
}
