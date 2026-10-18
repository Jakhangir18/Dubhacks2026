// Link between the game window (on the projector) and the camera window (camera.html, on the laptop screen).
// Both run in the same browser, so a BroadcastChannel carries foot events one way and game state the other,
// with no server round trip. The camera window also owns the Perceptron checks; the game talks to it through
// RemotePerceiver, which has the same methods as Perceiver.
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('zombiewalk') : null;

export function send(type, data = {}) {
  channel?.postMessage({ type, ...data });
}

export function listen(fn) {
  if (!channel) return () => {};
  const handler = (e) => { if (e.data && typeof e.data.type === 'string') fn(e.data); };
  channel.addEventListener('message', handler);
  return () => channel.removeEventListener('message', handler);
}

// The camera window says hello every second; the game treats it as present for 3 s after the last one.
let cameraSeen = -Infinity;   // no camera window until it says hello
listen((m) => { if (m.type === 'camera-alive') cameraSeen = performance.now(); });
export const cameraWindowAlive = () => performance.now() - cameraSeen < 3000;

export class RemotePerceiver {
  constructor() {
    this.used = false;
    this.state = { checked: 0, agree: 0, form: null };
    this.pending = new Map();
    this.nextId = 1;
    listen((m) => {
      if (m.type === 'perceiver-state') this.state = m.state;
      if (m.type === 'perceiver-report') { this.pending.get(m.id)?.(m.report); this.pending.delete(m.id); }
    });
  }

  reset(enabled, player, isPaused = () => false) {
    this.used = enabled;
    this.state = { checked: 0, agree: 0, form: null };
    send('perceiver-reset', { enabled, player });
    clearInterval(this.pauseTimer);
    let last = null;
    this.pauseTimer = setInterval(() => {
      const paused = isPaused();
      if (paused !== last) { last = paused; send('perceiver-paused', { paused }); }
    }, 200);
  }

  stop() {
    clearInterval(this.pauseTimer);
    send('perceiver-stop');
  }

  checkStep(th) {
    send('perceiver-step', { th: { kind: th.kind, lane: th.lane, result: th.result } });
  }

  badge() {
    return this.used ? `Perceptron ✓ ${this.state.agree}/${this.state.checked}` : '';
  }

  summary() {
    if (!this.used) return null;
    const { checked, agree, form } = this.state;
    return { checked, agree, agreePct: checked ? Math.round((100 * agree) / checked) : null, form };
  }

  sessionReport() {
    if (!cameraWindowAlive()) return Promise.resolve(null);   // closed mid-walk: nobody would answer
    const id = this.nextId++;
    send('perceiver-report-request', { id });
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      setTimeout(() => { if (this.pending.delete(id)) resolve(null); }, 95000);
    });
  }
}
