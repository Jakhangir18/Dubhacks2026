// Camera foot tracker: MediaPipe Pose Landmarker in the browser (phone as webcam, or a USB webcam).
// Emits foot events on the bus: {foot, kind:'lift', liftCm} at the top of each swing and {foot, kind:'strike'} on landing.
//
// Camera placement for floor mode (walking in place): in front of the player at about 45 degrees, low (knee height),
// whole lower legs in view. Both feet stay separate in the image, which keeps left and right apart.
import { emitFoot } from './bus.js';

const TASKS = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const IDX = { L: { knee: 25, ankle: 27, heel: 29, toe: 31 }, R: { knee: 26, ankle: 28, heel: 30, toe: 32 } };

export const TUNING = {
  liftStartCm: 3,        // the foot counts as lifted above this
  landCm: 1.5,           // and as landed below this
  peakDropCm: 2,         // the swing peak is reported once the foot has come down this far from it
  groundWindowS: 3,      // each foot's ground level is its lowest position over this window
  lostAfterS: 0.5,       // a lifted foot unseen this long is a lost step
};

export class FootTracker {
  constructor({ video, heightCm = 160, onFrame = null }) {
    this.video = video;
    this.heightCm = heightCm;      // player height, turns pixels into cm through the shank length
    this.onFrame = onFrame;        // optional (landmarks, state) callback for drawing
    this.landmarker = null;
    this.running = false;
    this.cmPerPx = null;
    this.hist = { L: [], R: [] };  // {t, y} per foot for its own ground level
    this.state = { L: blank(), R: blank() };
    this.lastTs = -1;
  }

  static async cameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  }

  async start(deviceId = null) {
    if (!this.landmarker) {
      const { PoseLandmarker, FilesetResolver } = await import(`${TASKS}/vision_bundle.mjs`);
      const files = await FilesetResolver.forVisionTasks(`${TASKS}/wasm`);
      const make = (delegate) => PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numPoses: 1,
      });
      try {
        this.landmarker = await make('GPU');
      } catch {
        this.landmarker = await make('CPU');   // laptops without WebGL2 support for the GPU delegate
      }
    }
    this.stopStream();
    const video = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } };
    if (deviceId) video.deviceId = { exact: deviceId };
    try {
      this.video.srcObject = await navigator.mediaDevices.getUserMedia({ video });
    } catch (e) {
      if (!deviceId || e.name !== 'OverconstrainedError') throw e;
      delete video.deviceId;   // the saved camera is gone (phone unplugged): take any camera
      this.video.srcObject = await navigator.mediaDevices.getUserMedia({ video });
    }
    await this.video.play();
    if (!this.running) { this.running = true; this.loop(); }
  }

  stopStream() {
    if (this.video.srcObject) this.video.srcObject.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
  }

  stop() { this.running = false; this.stopStream(); }

  loop() {
    if (!this.running) return;
    const now = performance.now();
    // Run the model once per new camera frame, not once per display refresh.
    const frameTime = this.video.currentTime;
    if (this.video.readyState >= 2 && frameTime !== this.lastFrameTime && now > this.lastTs) {
      this.lastFrameTime = frameTime;
      this.lastTs = now;
      const res = this.landmarker.detectForVideo(this.video, now);
      const lm = res.landmarks && res.landmarks[0];
      if (lm) this.process(lm, now / 1000);
      if (this.onFrame) this.onFrame(lm || null, this.state);
    }
    requestAnimationFrame(() => this.loop());
  }

  process(lm, t) {
    const w = this.video.videoWidth || 1280;
    const h = this.video.videoHeight || 720;
    const ok = (i) => (lm[i].visibility ?? 1) > 0.5;

    // Scale from shank length (knee to ankle is about 24.6% of body height). x and y each in their own pixels.
    const shanks = ['L', 'R'].filter((f) => ok(IDX[f].knee) && ok(IDX[f].ankle)).map((f) =>
      Math.hypot((lm[IDX[f].knee].x - lm[IDX[f].ankle].x) * w, (lm[IDX[f].knee].y - lm[IDX[f].ankle].y) * h));
    if (shanks.length) {
      const est = (0.246 * this.heightCm) / (shanks.reduce((a, b) => a + b, 0) / shanks.length);
      this.cmPerPx = this.cmPerPx ? 0.95 * this.cmPerPx + 0.05 * est : est;
    }
    if (!this.cmPerPx) return;

    for (const f of ['L', 'R']) {
      const st = this.state[f];
      if (!ok(IDX[f].heel) || !ok(IDX[f].toe)) {
        // Foot out of view while lifted: drop the step rather than land it late.
        if (st.lifted && t - (st.lastSeen ?? t) > TUNING.lostAfterS) { st.lifted = false; st.lastSeen = undefined; }
        continue;
      }
      st.lastSeen = t;
      // Clearance is the lowest point of the foot (largest image y); the heel alone rises a lot in a normal step.
      const y = Math.max(lm[IDX[f].heel].y, lm[IDX[f].toe].y) * h;
      const hist = this.hist[f];
      hist.push({ t, y });
      while (hist.length && t - hist[0].t > TUNING.groundWindowS) hist.shift();
      if (hist.length < 8) continue;
      const ys = hist.map((p) => p.y).sort((a, b) => a - b);
      const ground = ys[Math.floor(ys.length * 0.9)];          // this foot's own ground level
      const liftCm = Math.max(0, (ground - y) * this.cmPerPx);
      st.liftCm = liftCm;
      if (!st.lifted && liftCm > TUNING.liftStartCm) { st.lifted = true; st.peak = liftCm; st.peakSent = false; }
      if (!st.lifted) continue;
      if (liftCm > st.peak) st.peak = liftCm;
      if (!st.peakSent && st.peak - liftCm > TUNING.peakDropCm) {
        emitFoot({ foot: f, kind: 'lift', liftCm: Math.round(st.peak * 10) / 10, source: 'camera' });
        st.peakSent = true;
      }
      if (liftCm < TUNING.landCm) {
        if (!st.peakSent) emitFoot({ foot: f, kind: 'lift', liftCm: Math.round(st.peak * 10) / 10, source: 'camera' });
        emitFoot({ foot: f, kind: 'strike', source: 'camera' });
        st.lifted = false;
      }
    }
  }
}

function blank() { return { lifted: false, peak: 0, peakSent: false, liftCm: 0 }; }
