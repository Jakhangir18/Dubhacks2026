// Foot event bus. Every input source dispatches the same events here:
// the keyboard (development), the browser camera tracker, and the Raspberry Pi bridge.
// Event: {foot: 'L'|'R', kind: 'strike'} or {foot, kind: 'lift', liftCm}. The game stamps the time itself.
export const FOOT_EVENT = 'zombiewalk:foot';

export function emitFoot(ev) {
  window.dispatchEvent(new CustomEvent(FOOT_EVENT, { detail: ev }));
}

export function onFoot(fn) {
  const handler = (e) => fn(e.detail);
  window.addEventListener(FOOT_EVENT, handler);
  return () => window.removeEventListener(FOOT_EVENT, handler);
}
