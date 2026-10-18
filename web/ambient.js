// Static garden canvases are painted on asset load / resize only; animation is capped at 30 fps.
import { gardenLayout } from './fit-layout.js';
import { coachNumbers, ENDING_SECONDS, ENDINGS } from './lore.js';
const $ = id => document.getElementById(id);
const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const ART = {
  flower: 'hd/flower-marigold.png', rose: 'hd/flower-rose.png', bell: 'hd/flower-bell.png',
  lime: 'hd/tree-lime.png', teal: 'hd/tree-teal.png', fence: 'hd/fence.png',
  house: 'hd/house.png', moon: 'hd/moon.png', spitter: 'spitter.svg', spikes: 'spikeweed.svg',
  gus: 'gus-walk-sheet.webp', maya: 'maya-cartoon.webp',
};

export class AmbientGarden {
  constructor(zone) {
    this.zone = zone;
    this.canvas = $('ambient'); this.ctx = this.canvas.getContext('2d');
    this.hud = $('garden-hud'); this.title = $('act-title'); this.score = $('score');
    this.coach = $('coach'); this.progress = $('home-progress'); this.pace = $('pace'); this.prompt = $('walk-prompt');
    this.story = $('story-screen');
    this.images = {};
    this.act = 'title'; this.state = {}; this.elapsed = 0; this.storyTime = 0; this.lastFrame = 0;
    this.frame = this.frame.bind(this);
    window.addEventListener('zombiewalk:zone', () => this.layout());
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('zombiewalk:pace', e => this.update(e.detail));
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(this.request); this.lastFrame = 0;
      if (!document.hidden) this.request = requestAnimationFrame(this.frame);
    });
    this.resize();
    // Load all art before the one final cache paint, including failures so offline art cannot hang the scene.
    Promise.all(Object.entries(ART).map(([key, path]) => new Promise(resolve => {
      const img = this.images[key] = new Image();
      img.onload = img.onerror = resolve; img.src = `art/${path}`;
    }))).then(() => this.paintCaches());
    if (!document.hidden) this.request = requestAnimationFrame(this.frame);
  }

  resize() {
    this.w = innerWidth; this.h = innerHeight;
    this.canvas.width = this.w; this.canvas.height = this.h;
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
    this.fit = gardenLayout(p, this.w, this.h);
    const r = this.fit.hud;
    this.hud.style.display = r ? '' : 'none';
    if (r) {
      this.hud.style.left = `${r.x}px`; this.hud.style.top = `${r.y}px`;
      this.hud.style.width = `${Math.min(360, r.w)}px`;
      this.hud.style.maxHeight = `${r.h}px`;
      this.hud.classList.toggle('narrow', r.w < 300);
    }
    this.paintCaches();
  }

  update(state) {
    if (state.act !== this.act) this.storyTime = 0;
    this.act = state.act; this.state = { ...state };
    document.body.dataset.act = state.act;
    const r = state.act === 'rest' ? this.fit.hud : null;
    this.story.style.inset = r ? `${r.y}px auto auto ${r.x}px` : '';
    this.story.style.width = r ? `${Math.min(360, r.w)}px` : '';
    this.story.style.maxHeight = r ? `${r.h}px` : '';
    this.story.style.overflow = r ? 'auto' : '';
    setText(this.title, state.title || ''); setText(this.score, state.score || '');
    setText(this.coach, state.coach || ''); setText(this.pace, state.pace || '');
    this.progress.value = state.progress || 0;
    this.progress.parentElement.hidden = state.act === 'title' || state.act === 'setup';
    this.prompt.hidden = state.paceOk || state.paused || ['home', 'rest', 'title'].includes(state.act) || this.zone.active;
    this.coach.style.color = state.coachColor || '';
    if (state.act === 'rest') {
      setText($('story-round'), `ROUND ${state.round - 1} DONE`);
      setText($('story-coach'), state.coach || 'Take a breath. Maya is looking at your walk.');
      setText($('story-numbers'), coachNumbers(state.restSummary));
      setText($('story-prompt'), state.countdown || 'Next round in three!');
      setText($('story-detail'), `${state.round - 1}/${state.rounds || 3} of the way home`);
    } else if (state.act === 'title') {
      setText($('story-prompt'), 'Press Enter to begin'); setText($('story-detail'), 'Help Gus get home to Maya.');
    } else if (state.act === 'intro') {
      setText($('story-prompt'), 'Maya is waiting at home'); setText($('story-detail'), 'Get ready to walk');
    } else if (state.act === 'home') {
      const ending = ENDINGS[state.ending] || ENDINGS.home;
      setText($('story-ending-eyebrow'), state.ending === 'almost' ? 'ONE WARM DAWN AWAY…' : 'THREE PATCHES LATER…');
      setText($('story-ending-title'), ending.storyTitle);
      setText($('story-ending-detail'), ending.storyDetail);
      setText($('story-prompt'), ending.prompt); setText($('story-detail'), ending.detail);
    }
  }

  art(c, key, x, y, w, h = w) {
    const img = this.images[key];
    if (!img?.complete || !img.naturalWidth) return;
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    c.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
  }

  paintCaches() {
    if (!this.fit) return;
    const canvas = document.createElement('canvas'); canvas.width = this.w; canvas.height = this.h;
    const c = canvas.getContext('2d'), w = this.w, h = this.h;
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#10283e'); sky.addColorStop(1, '#28574f');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 36; i++) {
      c.fillStyle = '#9cbab9'; c.beginPath();
      c.arc(12 + ((i * .618034) % 1) * (w - 24), 12 + ((i * .41421) % 1) * (h - 24), 1.5, 0, Math.PI * 2); c.fill();
    }
    for (const [i, bed] of this.fit.decorations.entries()) {
      const x = bed.x + bed.w / 2, y = bed.y + bed.h / 2;
      this.art(c, 'fence', x, y - bed.h * .12, bed.w, bed.h * .65);
      c.fillStyle = '#427458'; c.beginPath(); c.ellipse(x, y + bed.h * .25, bed.w * .46, bed.h * .18, 0, 0, Math.PI * 2); c.fill();
      this.art(c, i % 2 ? 'flower' : 'bell', x, y + bed.h * .08, bed.w * .65, bed.h * .65);
    }
    this.backdrop = document.createElement('canvas');
    this.backdrop.width = w; this.backdrop.height = h;
    this.backdrop.getContext('2d').drawImage(canvas, 0, 0);
    const r = this.fit.house;
    if (r) {
      const size = Math.min(r.w, r.h * .6, 460);
      this.home = { x: r.x + r.w / 2, y: r.y + r.h / 2, size };
      this.art(c, 'house', this.home.x, this.home.y, size, size);
      this.maya(c, this.home.x, this.home.y + size * .22, size * .16);
    } else this.home = null;
    this.garden = canvas;
  }

  maya(c, x, y, size, cheer = 0) {
    c.save(); c.translate(x, y - Math.sin(cheer * 8) * (cheer ? 8 : 0));
    // The supplied portrait is opaque white. Crop it deliberately into a framed round cameo.
    c.fillStyle = '#ffdf83'; c.beginPath(); c.arc(0, 0, size / 2 + 7, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(0, 0, size / 2, 0, Math.PI * 2); c.clip();
    this.art(c, 'maya', 0, 0, size, size); c.restore();
    c.font = `bold ${Math.max(24, size * .17)}px Trebuchet MS`; c.textAlign = 'center';
    c.lineWidth = 6; c.strokeStyle = '#12392f'; c.fillStyle = '#fff3b5';
    c.strokeText('MAYA', 0, size * .7); c.fillText('MAYA', 0, size * .7); c.restore();
  }

  gus(c, x, feetY, time, walking = true) {
    const img = this.images.gus;
    if (!img?.complete || !img.naturalWidth) return;
    const size = this.gusSize || this.h * .32, frame = walking ? Math.floor(time * 8) % 24 : 0;
    c.fillStyle = '#17372d66'; c.beginPath(); c.ellipse(x, feetY - size * .06, size * .28, size * .055, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(x, feetY); c.scale(-1, 1);   // the source walks left; home is to the right
    c.drawImage(img, frame % 6 * 256, Math.floor(frame / 6) * 256, 256, 256, -size / 2, -size, size, size);
    c.restore();
  }

  mayaWindow(c, x, y, size, time) {
    const sway = Math.sin(time * 5) * size * .05;
    c.save();
    c.fillStyle = '#ffe59a'; c.shadowColor = '#ffbe62'; c.shadowBlur = size * .6;
    c.fillRect(x - size / 2, y - size / 2, size, size); c.shadowBlur = 0;
    c.strokeStyle = '#633b44'; c.lineWidth = Math.max(3, size * .1); c.strokeRect(x - size / 2, y - size / 2, size, size);
    c.beginPath(); c.rect(x - size / 2, y - size / 2, size, size); c.clip();
    this.art(c, 'maya', x + sway, y + size * .18, size * 1.15, size * 1.15);
    c.restore();
    c.strokeStyle = '#633b44'; c.lineWidth = Math.max(2, size * .055);
    c.beginPath(); c.moveTo(x, y - size / 2); c.lineTo(x, y + size / 2); c.moveTo(x - size / 2, y); c.lineTo(x + size / 2, y); c.stroke();
  }

  drawStory(c) {
    c.drawImage(this.act === 'intro' ? this.backdrop : this.garden, 0, 0);
    if (['intro', 'home'].includes(this.act) && this.home) {
      const r = this.fit.house, { x, y, size } = this.home;
      const almost = this.act === 'home' && this.state.ending === 'almost';
      const t = smooth(this.storyTime / (this.act === 'intro' ? 6 : 3));
      this.gusSize = Math.min(r.w * .32, r.h * .22, 140);
      if (this.act === 'intro') {
        // A restrained push toward the doorstep, contained in the house's reserved area.
        const zoom = .8 + .2 * t, cameraX = x + size * .06 * (1 - t);
        this.art(c, 'house', cameraX, y, size * zoom, size * zoom);
        this.maya(c, cameraX, y + size * .22 * zoom, size * .16 * zoom);
      }
      const startX = r.x + this.gusSize / 2;
      this.gus(c, startX + (x - startX) * t * (almost ? .55 : 1),
        y + size * .48, this.storyTime, t < 1);
      if (almost) {
        this.mayaWindow(c, x + size * .16, y, size * .10, this.storyTime);
      } else if (this.act === 'home') {
        const open = smooth((this.storyTime - 2) / 1.2);
        c.fillStyle = '#ffe9a0'; c.fillRect(x - size * .20, y + size * .08, size * .10 * open, size * .22);
        this.maya(c, x, y + size * .22, size * .16);
      }
      setText($('story-caption'), 'Gus is coming home. Maya is waiting.');
    }
  }

  frame(now) {
    this.request = requestAnimationFrame(this.frame);
    if (now - this.lastFrame < 1000 / 30) return;
    const dt = this.lastFrame ? Math.min(.1, (now - this.lastFrame) / 1000) : 0; this.lastFrame = now;
    if (!this.state.paused && !this.zone.active) { this.elapsed += dt; this.storyTime += dt; }
    const full = !this.state.paused && !this.zone.active && (['title', 'intro', 'rest'].includes(this.act) || this.act === 'home' && this.storyTime < ENDING_SECONDS);
    document.body.classList.toggle('story-active', full); this.story.hidden = !full;
    $('story-intro').hidden = !['title', 'intro'].includes(this.act); $('story-rest').hidden = this.act !== 'rest'; $('story-ending').hidden = this.act !== 'home';
    const c = this.ctx;
    c.globalAlpha = 1;
    this.drawStory(c);
    c.globalAlpha = 1;
  }
}
