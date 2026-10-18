// Bridge from the server to the foot bus: events posted by the Raspberry Pi (or any other sender)
// to the laptop server arrive here over a WebSocket and are re-emitted on the bus.
// Works only when the game is served by server/app.py; with a plain static server it stays silent.
import { emitFoot } from './bus.js';

export function connectBridge(onStatus = () => {}) {
  if (location.protocol === 'file:') return;
  let ws = null;
  let retry = 1000;
  const open = () => {
    try {
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/game`);
    } catch { return; }
    ws.onopen = () => { retry = 1000; onStatus('bridge connected'); };
    ws.onmessage = (m) => {
      try {
        const msg = JSON.parse(m.data);
        for (const ev of Array.isArray(msg) ? msg : [msg]) {
          if ((ev.foot === 'L' || ev.foot === 'R') && (ev.kind === 'strike' || ev.kind === 'lift')) {
            emitFoot({ foot: ev.foot, kind: ev.kind, liftCm: ev.liftCm, source: ev.source || 'bridge' });
          }
        }
      } catch { /* ignore malformed messages */ }
    };
    ws.onclose = () => {
      onStatus('bridge offline');
      setTimeout(open, retry);
      retry = Math.min(10000, retry * 2);
    };
  };
  open();
}
