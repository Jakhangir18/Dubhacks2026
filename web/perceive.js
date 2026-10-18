// Perceptron second opinion (Perceptron track). The browser detector still decides every step in real time;
// Perceptron Mk1.5 looks at a few timestamped frames afterwards and the agreement goes into the report.
// Frames are cropped from the knees down (never a face), stay small, and are sent only when the
// therapist panel has Perceptron consent on for this player and the server has a key.
const W = 320;
const H = 240;                  // every frame the same size: the API needs that
const EVERY_MS = 200;
const KEEP_MS = 2400;
const STEP_WINDOW_MS = 1600;
const MAX_FRAMES = 8;           // server/perceive.py MAX_FRAMES
const FORM_EVERY_MS = 10000;
const LEG = [25, 26, 27, 28, 29, 30, 31, 32];   // knees, ankles, heels, toes
const KNEES = [25, 26];

export class Perceiver {
  constructor(tracker) {
    this.tracker = tracker;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.gen = 0;
    this.reset(false, 'Player');
    setInterval(() => this.capture(), EVERY_MS);
  }

  // Called at the start of every game.
  // isPaused: the game is paused or the zone is being set up; nothing is captured then.
  reset(enabled, player, isPaused = () => false) {
    this.gen++;
    this.enabled = enabled;
    this.used = enabled;
    this.isPaused = isPaused;
    this.player = player;
    this.frames = [];
    this.checked = 0;
    this.agree = 0;
    this.form = null;
    this.busy = { step: false, form: false };   // a slow form check never blocks step checks
    this.lastForm = performance.now();
  }

  // Called when a game ends: keep the counts for the summary, stop capturing and sending.
  stop() {
    this.gen++;
    this.enabled = false;
    this.frames = [];
  }

  capture() {
    const v = this.tracker.video;
    const lm = this.tracker.lastLm;
    if (!this.enabled || this.isPaused() || !this.tracker.running || !lm || v.readyState < 2 || !v.videoWidth) return;
    const seen = (i) => lm[i] && (lm[i].visibility ?? 1) > 0.5;
    const pts = LEG.filter(seen).map((i) => lm[i]);
    if (pts.length < 4 || !KNEES.some(seen)) return;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const xs = pts.map((p) => p.x * vw);
    const ys = pts.map((p) => p.y * vh);
    const pad = 0.25 * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 40);
    // The top edge is the higher knee, with no padding upwards, so nothing above the knees is sent.
    const x0 = Math.max(0, Math.min(...xs) - pad);
    const y0 = Math.max(0, Math.min(...KNEES.filter(seen).map((i) => lm[i].y * vh)));
    const x1 = Math.min(vw, Math.max(...xs) + pad);
    const y1 = Math.min(vh, Math.max(...ys) + pad);
    if (x1 - x0 < 8 || y1 - y0 < 8) return;
    const s = Math.min(W / (x1 - x0), H / (y1 - y0));
    const dw = (x1 - x0) * s;
    const dh = (y1 - y0) * s;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, W, H);
    this.ctx.drawImage(v, x0, y0, x1 - x0, y1 - y0, (W - dw) / 2, (H - dh) / 2, dw, dh);
    const now = Math.round(performance.now());
    this.frames.push({ url: this.canvas.toDataURL('image/jpeg', 0.7), tsMs: now });
    while (this.frames.length && now - this.frames[0].tsMs > KEEP_MS) this.frames.shift();
    if (now - this.lastForm > FORM_EVERY_MS && this.frames.length >= MAX_FRAMES) {
      this.lastForm = now;
      this.send({ kind: 'form', frames: this.frames.slice(-MAX_FRAMES) }, (out) => { this.form = out; });
    }
  }

  // th is a resolved flower or seed from logic.js: { kind, lane, result }.
  checkStep(th) {
    if (!this.enabled) return;
    const now = performance.now();
    const frames = this.frames.filter((f) => now - f.tsMs <= STEP_WINDOW_MS).slice(-MAX_FRAMES);   // keep the newest: the step itself
    if (frames.length < 2) return;
    this.send({ kind: 'step', foot: th.lane, thing: th.kind, frames }, (out) => {
      if (out.verdict !== 'yes' && out.verdict !== 'no') return;   // unclear: not counted either way
      this.checked++;
      if ((out.verdict === 'yes') === (th.result === 'hit')) this.agree++;
    });
  }

  async send(body, done) {
    if (this.busy[body.kind]) return;   // one request per kind at a time; a busy moment just skips a check
    this.busy[body.kind] = true;
    const gen = this.gen;
    try {
      const r = await fetch('/api/perceive', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ player: this.player, ...body }), signal: AbortSignal.timeout(15000) });
      const out = r.ok ? await r.json() : null;
      if (gen !== this.gen || !out) return;
      if (out.source === 'no-consent') this.enabled = false;
      else if (out.source === 'perceptron') done(out);
    } catch { /* offline or slow: the game never waits for Perceptron */ }
    finally { if (gen === this.gen) this.busy[body.kind] = false; }
  }

  badge() {
    return this.used ? `Perceptron ✓ ${this.agree}/${this.checked}` : '';
  }

  summary() {
    if (!this.used) return null;
    const form = this.form && { onPad: this.form.onPad, holdingRail: this.form.holdingRail, steady: this.form.steady };
    return { checked: this.checked, agree: this.agree,
      agreePct: this.checked ? Math.round((100 * this.agree) / this.checked) : null, form };
  }
}
