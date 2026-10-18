// Screen-space corners retain the exact format used by calibrate.html.
const Warp = window.Warp;
const SIZE_KEY = 'zombiewalk.zoneViewport';
const LABELS = ['FRONT-LEFT', 'FRONT-RIGHT', 'BACK-RIGHT', 'BACK-LEFT'];

function valid(corners) {
  if (!Array.isArray(corners) || corners.length !== 4 ||
      !corners.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) return false;
  // Reject crossed, collapsed and concave quads before the homography can become singular.
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4], c = corners[(i + 2) % 4];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 400 || (sign && Math.sign(cross) !== sign)) return false;
    sign = Math.sign(cross);
  }
  return true;
}

export class WalkingZone {
  constructor() {
    this.stage = document.getElementById('stage');
    this.layer = document.getElementById('handles');
    this.setup = document.getElementById('zone-setup');
    this.help = document.getElementById('zone-help');
    this.width = innerWidth; this.height = innerHeight;
    const saved = Warp.store.get(Warp.CORNERS_KEY, null);
    this.saved = valid(saved);
    this.corners = this.saved ? saved : [
      [innerWidth * .32, innerHeight * .46], [innerWidth * .68, innerHeight * .46],
      [innerWidth * .79, innerHeight * .91], [innerWidth * .21, innerHeight * .91],
    ];
    const size = Warp.store.get(SIZE_KEY, null);
    if (this.saved && size?.width > 0 && size?.height > 0 && JSON.stringify(size.corners) === JSON.stringify(saved)) {
      for (const p of this.corners) { p[0] *= innerWidth / size.width; p[1] *= innerHeight / size.height; }
    }
    this.active = false;
    document.getElementById('rotate-zone').onclick = () => {
      this.corners.push(this.corners.shift());
      this.mountHandles(); this.apply();
    };
    document.getElementById('save-zone').onclick = () => this.finish();
    window.addEventListener('resize', () => {
      for (const p of this.corners) { p[0] *= innerWidth / this.width; p[1] *= innerHeight / this.height; }
      this.width = innerWidth; this.height = innerHeight;
      if (this.active) this.mountHandles();
      this.apply();
    });
    // Capture Enter before Phaser can start the title scene on the same key press.
    window.addEventListener('keydown', e => {
      if (!this.active || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); this.finish(); }
      else if (!['f', 'k', 'v', 'm', 'n', 'tab', 'shift', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault(); e.stopImmediatePropagation();
      }
    }, true);
    this.apply();
  }

  apply() {
    Warp.apply(this.stage, this.corners);
    window.dispatchEvent(new CustomEvent('zombiewalk:zone', { detail: this.corners }));
  }

  open(onDone) {
    if (this.active) return;
    this.active = true; this.onDone = onDone;
    this.help.textContent = '';
    this.setup.hidden = false;
    document.body.classList.add('setting-zone');
    this.mountHandles(); this.apply();
  }

  finish() {
    if (!this.active) return;
    Warp.store.set(Warp.CORNERS_KEY, this.corners);
    Warp.store.set(SIZE_KEY, { width: innerWidth, height: innerHeight, corners: this.corners });
    this.saved = true; this.active = false;
    this.setup.hidden = true; this.layer.replaceChildren();
    document.body.classList.remove('setting-zone');
    this.onDone();
  }

  mountHandles() {
    this.layer.replaceChildren();
    this.corners.forEach((point, index) => {
      const handle = document.createElement('button');
      handle.type = 'button'; handle.className = 'warp-handle';
      handle.setAttribute('aria-label', LABELS[index]);
      const position = () => {
        const p = this.corners[index];
        handle.style.left = `${p[0]}px`; handle.style.top = `${p[1]}px`;
        handle.classList.toggle('label-left', p[0] > innerWidth / 2);
        handle.classList.toggle('label-above', p[1] > innerHeight * .7);
      };
      const move = (x, y) => {
        const previous = this.corners[index];
        this.corners[index] = [Math.max(30, Math.min(innerWidth - 30, x)), Math.max(30, Math.min(innerHeight - 30, y))];
        if (!valid(this.corners)) {
          this.corners[index] = previous;
          this.help.textContent = 'Keep four separate corners without crossing the edges.';
          return;
        }
        this.help.textContent = '';
        position(); this.apply();
      };
      handle.onpointerdown = e => { handle.setPointerCapture(e.pointerId); handle.focus(); };
      handle.onpointermove = e => { if (handle.hasPointerCapture(e.pointerId)) move(e.clientX, e.clientY); };
      handle.onpointerup = handle.onpointercancel = e => {
        if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
      };
      handle.onkeydown = e => {
        const amount = e.shiftKey ? 20 : 4;
        const p = this.corners[index];
        if (e.key.startsWith('Arrow')) {
          e.preventDefault(); e.stopPropagation();
          move(p[0] + (e.key === 'ArrowRight' ? amount : e.key === 'ArrowLeft' ? -amount : 0),
            p[1] + (e.key === 'ArrowDown' ? amount : e.key === 'ArrowUp' ? -amount : 0));
        }
      };
      position(); this.layer.appendChild(handle);
    });
  }
}
