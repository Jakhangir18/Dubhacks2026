// Perceptron second opinion (Perceptron track). The game still decides every step in real time;
// Perceptron Mk1.5 looks at a few timestamped frames afterwards and the agreement goes into the report.
// The frames come from feet.py's camera above the belt whenever its pictures reach this window ("overhead": shoes
// and projected flowers from above, never a face), else from this window's own camera cropped from the knees down
// ("legs"). They stay small and are sent only when the therapist panel has Perceptron consent on for this player
// and the server has a key.
const W = 320;
const H = 240;                  // every frame the same size: the API needs that
const EVERY_MS = 200;
const KEEP_MS = 2400;
const STEP_WINDOW_MS = 1600;
const MAX_FRAMES = 8;           // server/perceive.py MAX_FRAMES
const MAX_SESSION_FRAMES = 32;  // server/perceive.py MAX_SESSION_FRAMES
const FORM_EVERY_MS = 10000;
const LEG = [25, 26, 27, 28, 29, 30, 31, 32];   // knees, ankles, heels, toes
const KNEES = [25, 26];
const FEED_LIVE_MS = 2500;      // overhead pictures newer than this make them the source (feet.py sends 4 a second in a game)

export class Perceiver {
  constructor(tracker) {
    this.tracker = tracker;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.gen = 0;
    this.view = 'legs';
    this.lastFeed = -Infinity;
    this.feedBusy = false;
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
    this.sessionAllowed = enabled;
    this.sessionFrames = [];
    this.sessionStart = performance.now();
    this.sampleEvery = 1500;
    this.lastSample = -Infinity;
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

  // Are feet.py's overhead pictures arriving? While they are, they are what Perceptron sees.
  feedLive() { return performance.now() - this.lastFeed < FEED_LIVE_MS; }

  // One overhead picture from feet.py (a JPEG data URL), drawn into the same small frame as the camera's, so every
  // frame of a request has the same size and the server's points and the panel's lab need no change.
  feed(jpeg) {
    this.lastFeed = performance.now();
    if (!this.enabled || this.feedBusy) return;
    if (this.isPaused()) { this.frames = []; this.lastForm = performance.now(); return; }
    this.feedBusy = true;
    const img = new Image();
    img.onload = () => {
      this.feedBusy = false;
      if (!this.enabled || !img.naturalWidth) return;
      const s = Math.min(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, W, H);
      this.ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      this.addFrame(this.canvas.toDataURL('image/jpeg', 0.7), 'overhead');
    };
    img.onerror = () => { this.feedBusy = false; };
    img.src = jpeg;
  }

  capture() {
    const v = this.tracker.video;
    const lm = this.tracker.lastLm;
    if (this.isPaused()) { this.frames = []; this.lastForm = performance.now(); return; }   // no clip spans a pause
    if (this.feedLive()) return;   // the overhead pictures are the source while they come
    if (!this.enabled || !this.tracker.running || !lm || v.readyState < 2 || !v.videoWidth) return;
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
    this.addFrame(this.canvas.toDataURL('image/jpeg', 0.7), 'legs');
  }

  // A new frame from either view: kept for the step checks, sampled for the walk report, and every 10 s a form check.
  addFrame(url, view) {
    const now = Math.round(performance.now());
    if (view !== this.view) {   // never mix the two cameras in one request or one report
      this.view = view;
      this.frames = [];
      this.sessionFrames = [];
      this.sampleEvery = 1500;
      this.lastSample = -Infinity;
    }
    this.frames.push({ url, tsMs: now });
    if (now - this.lastSample >= this.sampleEvery) {
      if (this.sessionFrames.length === MAX_SESSION_FRAMES) {
        this.sessionFrames = this.sessionFrames.filter((_, i) => i % 2 === 0);
        this.sampleEvery *= 2;
      }
      this.sessionFrames.push({ url, tsMs: Math.max(0, Math.round(now - this.sessionStart)) });
      this.lastSample = now;
    }
    while (this.frames.length && now - this.frames[0].tsMs > KEEP_MS) this.frames.shift();
    if (now - this.lastForm > FORM_EVERY_MS && this.frames.length >= MAX_FRAMES) {
      this.lastForm = now;
      const sent = this.frames.slice(-MAX_FRAMES);
      this.send({ kind: 'form', frames: sent }, (out) => { this.form = out; this.onResult?.({ kind: 'form', out, frame: sent.at(-1)?.url }); });
    }
  }

  // th is a resolved flower or seed from logic.js: { kind, lane, result }.
  checkStep(th) {
    if (!this.enabled) return;
    const now = performance.now();
    const frames = this.frames.filter((f) => now - f.tsMs <= STEP_WINDOW_MS).slice(-MAX_FRAMES);   // keep the newest: the step itself
    if (frames.length < 2) return;
    this.send({ kind: 'step', foot: th.lane, thing: th.kind, frames }, (out) => {
      this.onResult?.({ kind: 'step', th, out, frame: frames.at(-1)?.url });   // the camera window shows each verdict
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
        body: JSON.stringify({ player: this.player, view: this.view, ...body }), signal: AbortSignal.timeout(15000) });
      const out = r.ok ? await r.json() : null;
      if (gen !== this.gen || !out) return;
      if (out.source === 'no-consent') {
        this.enabled = false; this.sessionAllowed = false; this.sessionFrames = [];
      }
      else if (out.source === 'perceptron') done(out);
    } catch { /* offline or slow: the game never waits for Perceptron */ }
    finally { if (gen === this.gen) this.busy[body.kind] = false; }
  }

  // sessionId: the walk this report belongs to, so the dashboard and the report show it with that walk.
  async sessionReport(sessionId = null) {
    if (!this.used || !this.sessionAllowed || this.sessionFrames.length < 2) return null;
    const frames = this.sessionFrames;
    this.sessionFrames = [];
    try {
      const r = await fetch('/api/perceive/session', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ player: this.player, frames, view: this.view, ...(sessionId && { sessionId }) }), signal: AbortSignal.timeout(90000) });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }

  badge() {
    return this.used ? `Perceptron ✓ ${this.agree}/${this.checked}` : '';
  }

  summary() {
    if (!this.used) return null;
    const form = this.form && { onPad: this.form.onPad, holdingRail: this.form.holdingRail, steady: this.form.steady };
    return { checked: this.checked, agree: this.agree, view: this.view,
      agreePct: this.checked ? Math.round((100 * this.agree) / this.checked) : null, form };
  }
}
