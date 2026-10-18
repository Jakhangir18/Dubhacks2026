// Bridge from the server to the foot bus: events posted by the Raspberry Pi (or any other sender)
// to the laptop server arrive here over a WebSocket and are re-emitted on the bus.
// Works only when the game is served by server/app.py; with a plain static server it gives up after a few tries.
import { emitFoot } from './bus.js';

export const CONTROL_EVENT = 'zombiewalk:control';

export const SHOES_EVENT = 'zombiewalk:shoes';   // {boxes: [[x1, y1, x2, y2, conf], ...], source}
export const FRAME_EVENT = 'zombiewalk:frame';   // {jpeg: data URL, source: 'feet' | 'side'} what a camera sees
export const MARKS_EVENT = 'zombiewalk:marks';   // {marks: [[color, cx, cy, w, h], ...]} a foot seen on a coloured mark

export function connectBridge(onStatus = () => {}) {
  if (location.protocol === 'file:') return;
  let ws = null;
  let retry = 1000;
  let failures = 0;               // consecutive failures before the first connection
  let everConnected = false;
  const again = () => {
    failures += 1;
    // A plain static server has no /ws/game: stop after a few tries instead of logging errors forever.
    if (!everConnected && failures >= 4) { onStatus('bridge off (no game server)'); return; }
    setTimeout(open, retry);
    retry = Math.min(10000, retry * 2);
  };
  const open = () => {
    try {
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/game`);
    } catch { again(); return; }
    ws.onopen = () => { retry = 1000; failures = 0; everConnected = true; onStatus('bridge connected'); };
    ws.onmessage = (m) => {
      try {
        const msg = JSON.parse(m.data);
        for (const ev of Array.isArray(msg) ? msg : [msg]) {
          if ((ev.foot === 'L' || ev.foot === 'R') && (ev.kind === 'strike' || ev.kind === 'lift')) {
            emitFoot({ foot: ev.foot, kind: ev.kind, liftCm: ev.liftCm, source: ev.source || 'bridge' });
          } else if (ev.kind === 'control' && typeof ev.id === 'string') {
            window.dispatchEvent(new CustomEvent(CONTROL_EVENT, { detail: ev }));
          } else if (ev.kind === 'shoes' && Array.isArray(ev.boxes)) {
            window.dispatchEvent(new CustomEvent(SHOES_EVENT, { detail: { boxes: ev.boxes, source: ev.source || 'bridge' } }));
          } else if (ev.kind === 'marks' && Array.isArray(ev.marks)) {
            window.dispatchEvent(new CustomEvent(MARKS_EVENT, { detail: { marks: ev.marks } }));
          } else if (ev.kind === 'frame' && typeof ev.jpeg === 'string' && ev.jpeg.startsWith('data:image/jpeg;base64,')) {
            window.dispatchEvent(new CustomEvent(FRAME_EVENT, { detail: { jpeg: ev.jpeg, source: ev.source || 'feet' } }));
          }
        }
      } catch { /* ignore malformed messages */ }
    };
    ws.onclose = () => {
      onStatus('bridge offline');
      again();
    };
  };
  open();
}
