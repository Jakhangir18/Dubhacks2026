// One unwarped 2D canvas, a fixed pool of 90 moving decorations, at most 30 fps.
const ART = ['tile-grass-dark', 'tile-grass-light', 'flower-marigold', 'flower-bell', 'flower-rose',
  'tree-lime', 'tree-teal', 'fence', 'house', 'moon'];
const $ = id => document.getElementById(id);
const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };

export class AmbientGarden {
  constructor(zone) {
    this.zone = zone;
    this.canvas = $('ambient'); this.ctx = this.canvas.getContext('2d');
    this.hud = $('garden-hud');
    this.title = $('act-title'); this.score = $('score'); this.coach = $('coach');
    this.progress = $('home-progress'); this.pace = $('pace'); this.prompt = $('walk-prompt');
    // Generated art first (web/art/hd), the SVG if it is missing.
    this.images = ART.map(name => {
      const img = new Image();
      img.onerror = () => { img.onerror = null; img.src = `art/${name}.svg`; };
      img.src = `art/hd/${name}.png`;
      return img;
    });
    // x, y, size, phase, art index: allocated only once, recycled in place.
    this.decor = new Float32Array(72 * 5);
    for (let i = 0; i < 72; i++) {
      const k = i * 5;
      this.decor[k] = ((i * .618034) % 1);
      this.decor[k + 1] = ((i * .754877666 + .13) % 1);
      this.decor[k + 2] = i < 36 ? 56 + i % 4 * 12 : 30 + i % 5 * 5;
      this.decor[k + 3] = i * 2.4;
      this.decor[k + 4] = i < 36 ? i % 2 : 2 + i % 3;
    }
    this.cadence = 0; this.act = 'title'; this.paceOk = true; this.paused = false;
    this.bounce = 0; this.ripple = 0; this.sunrise = 0; this.elapsed = 0;
    this.lastFrame = 0; this.frame = this.frame.bind(this);
    window.addEventListener('zombiewalk:zone', () => this.layout());
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('zombiewalk:pace', e => this.update(e.detail));
    window.addEventListener('zombiewalk:reaction', e => {
      if (e.detail === 'stomp') this.bounce = 1;
      if (e.detail === 'dodge') this.ripple = 1;
    });
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(this.request);
      this.lastFrame = 0;
      if (!document.hidden) this.request = requestAnimationFrame(this.frame);
    });
    this.resize();
    if (!document.hidden) this.request = requestAnimationFrame(this.frame);
  }

  resize() {
    this.w = innerWidth; this.h = innerHeight;
    // Deliberately cap backing resolution on high-DPI laptops driving a projector.
    this.canvas.width = this.w; this.canvas.height = this.h;
    const c = this.ctx;
    this.night = c.createLinearGradient(0, 0, 0, this.h);
    this.night.addColorStop(0, '#0c2037'); this.night.addColorStop(.55, '#163f3e'); this.night.addColorStop(1, '#204b3d');
    this.dawn = c.createLinearGradient(0, 0, 0, this.h);
    this.dawn.addColorStop(0, '#ffbd78'); this.dawn.addColorStop(.48, '#b19b6a'); this.dawn.addColorStop(1, '#41644a');
    this.layout();
  }

  layout() {
    const p = this.zone.corners;
    this.path = new Path2D();
    this.path.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < 4; i++) this.path.lineTo(p[i][0], p[i][1]);
    this.path.closePath();
    this.frontX = (p[0][0] + p[1][0]) / 2;
    this.frontY = (p[0][1] + p[1][1]) / 2;
    const dx = (p[2][0] + p[3][0]) / 2 - this.frontX;
    const dy = (p[2][1] + p[3][1]) / 2 - this.frontY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    this.dx = dx / distance; this.dy = dy / distance;
    this.centerX = this.frontX + dx / 2; this.centerY = this.frontY + dy / 2;
    const left = Math.min(...p.map(v => v[0])), right = Math.max(...p.map(v => v[0]));
    const top = Math.min(...p.map(v => v[1])), bottom = Math.max(...p.map(v => v[1]));
    // Every candidate is wholly outside the quad; prefer the actual front edge.
    const regions = [
      { x: 20, y: 20, w: this.w - 40, h: top - 40, front: this.dy },
      { x: 20, y: bottom + 20, w: this.w - 40, h: this.h - bottom - 40, front: -this.dy },
      { x: 20, y: 20, w: left - 40, h: this.h - 40, front: this.dx },
      { x: right + 20, y: 20, w: this.w - right - 40, h: this.h - 40, front: -this.dx },
    ];
    regions.sort((a, b) => {
      const score = r => ((r.w >= 420 && r.h >= 220 || r.w >= 220 && r.h >= 540) ? 1e7 : 0)
        + r.front * 1e6 + Math.max(0, r.w) * Math.max(0, r.h);
      return score(b) - score(a);
    });
    const r = regions[0];
    const width = Math.max(0, Math.min(860, r.w));
    this.hud.style.left = `${r.x + (r.w - width) / 2}px`;
    this.hud.style.top = `${r.y}px`;
    this.hud.style.width = `${width}px`;
    this.hud.style.maxHeight = `${Math.max(0, r.h)}px`;
    this.hud.style.pointerEvents = r.h < 220 ? 'auto' : 'none';
    this.hud.classList.toggle('narrow', width < 600);
    if (this.zone.active && !(r.w >= 420 && r.h >= 220 || r.w >= 220 && r.h >= 540)) {
      this.zone.help.textContent = 'Leave more space outside the zone for the game text (ideally in front).';
    }
  }

  update(state) {
    this.cadence = state.cadence; this.act = state.act; this.paceOk = state.paceOk;
    this.paused = state.paused;
    setText(this.title, state.title);
    setText(this.score, state.score || '');
    setText(this.coach, state.coach || '');
    setText(this.pace, state.pace || '');
    this.progress.value = state.progress || 0;
    this.progress.parentElement.hidden = state.act === 'title' || state.act === 'setup';
    this.prompt.hidden = state.paceOk || state.paused || state.act === 'home' || this.zone.active;
  }

  drawImage(index, x, y, w, h = w) {
    const img = this.images[index];
    if (!img.complete || !img.naturalWidth) return;
    if (index > 1 && index !== 7) {   // contain-fit everything but tiles and the fence, which join edge to edge
      const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
      w = img.naturalWidth * s; h = img.naturalHeight * s;
    }
    this.ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  }

  frame(now) {
    this.request = requestAnimationFrame(this.frame);
    if (now - this.lastFrame < 1000 / 30) return;
    const dt = this.lastFrame ? Math.min(.1, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    const moving = !this.paused && !this.zone.active;
    if (moving) {
      this.elapsed += dt;
      this.bounce = Math.max(0, this.bounce - dt * 1.5);
      this.ripple = Math.max(0, this.ripple - dt * .7);
      this.sunrise += ((this.act === 'home' ? 1 : 0) - this.sunrise) * Math.min(1, dt * 1.5);
    }
    const c = this.ctx, w = this.w, h = this.h;
    c.globalAlpha = 1; c.fillStyle = this.night; c.fillRect(0, 0, w, h);
    if (this.sunrise > .001) { c.globalAlpha = this.sunrise * .8; c.fillStyle = this.dawn; c.fillRect(0, 0, w, h); }
    c.globalAlpha = .65;
    this.drawImage(9, w * .09, h * .13, 92);
    // Fence, trees and the distant house stay fixed; ground foliage travels toward the player.
    for (let i = 0; i < 8; i++) this.drawImage(7, (i + .5) * w / 8, h * .29, w / 8 + 2, 54);
    for (let i = 0; i < 8; i++) this.drawImage(5 + i % 2, i % 2 ? w * .94 : w * .06, h * (.34 + Math.floor(i / 2) * .19), 110, 124);
    this.drawImage(8, Math.max(80, Math.min(w - 80, this.frontX - this.dx * 235 + this.dy * 470)),
      Math.max(65, Math.min(h - 65, this.frontY - this.dy * 250 - this.dx * 470)), 145, 134);
    const speed = moving ? Math.min(180, this.cadence) * .7 * dt : 0;
    c.globalAlpha = .43;
    for (let i = 0; i < 72; i++) {
      const k = i * 5;
      this.decor[k] += this.dx * speed / (w + 140);
      this.decor[k + 1] += this.dy * speed / (h + 140);
      if (this.decor[k] > 1) this.decor[k] -= 1;
      if (this.decor[k] < 0) this.decor[k] += 1;
      if (this.decor[k + 1] > 1) this.decor[k + 1] -= 1;
      if (this.decor[k + 1] < 0) this.decor[k + 1] += 1;
      const flower = this.decor[k + 4] >= 2;
      c.globalAlpha = flower ? .52 : .18;
      const bounce = flower ? Math.abs(Math.sin(this.bounce * Math.PI * 3)) * this.bounce * 32 : 0;
      this.drawImage(this.decor[k + 4], this.decor[k] * (w + 140) - 70,
        this.decor[k + 1] * (h + 140) - 70 - bounce, this.decor[k + 2]);
    }
    if (!this.paceOk && this.act !== 'home') {
      c.globalAlpha = .38; c.fillStyle = '#020e19'; c.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 18; i++) {
      c.globalAlpha = .25 + .35 * (1 + Math.sin(this.elapsed * 1.5 + i)) / 2;
      c.fillStyle = '#e1ffab'; c.beginPath();
      c.arc(((i * .618034) % 1) * w + Math.sin(this.elapsed * .6 + i) * 15,
        ((i * .41421) % 1) * h + Math.cos(this.elapsed * .8 + i) * 15, 3, 0, Math.PI * 2); c.fill();
    }
    if (this.ripple > 0) {
      c.globalAlpha = this.ripple * .45; c.strokeStyle = '#9df5df'; c.lineWidth = 14;
      c.beginPath(); c.arc(this.centerX, this.centerY, (1 - this.ripple) * Math.max(w, h), 0, Math.PI * 2); c.stroke();
    }
    const pulse = this.paceOk ? .75 : .55 + .35 * Math.sin(this.elapsed * 4);
    c.strokeStyle = this.paceOk ? '#bbffc7' : '#ffcb7c';
    c.globalAlpha = pulse * .12; c.lineWidth = 30; c.stroke(this.path);
    c.globalAlpha = pulse * .25; c.lineWidth = 16; c.stroke(this.path);
    c.globalAlpha = pulse; c.lineWidth = 6; c.stroke(this.path);
    c.globalAlpha = 1;
  }
}
