// Static garden canvases are painted on asset load / resize only; animation is capped at 30 fps.
import { coachNumbers, ENDING_SECONDS } from './lore.js';
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
    this.paintCaches(); this.layout();
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
    if (state.act !== this.act) this.storyTime = 0;
    this.act = state.act; this.state = { ...state };
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
      setText($('story-prompt'), `Walk to start round ${state.round}`);
      setText($('story-detail'), `${state.round - 1}/${state.rounds || 3} of the way home · 4 steps when you are ready`);
    } else if (state.act === 'title') {
      setText($('story-prompt'), 'Walk to start'); setText($('story-detail'), '4 steps · or press Enter');
    } else if (state.act === 'home') {
      setText($('story-prompt'), 'Home before sunrise!'); setText($('story-detail'), 'Your walk summary is next');
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
    this.garden = this.paintGarden(this.w, this.h);
    this.panorama = this.paintGarden(Math.ceil(this.w * 1.6), this.h);
  }

  paintGarden(w, h) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const c = canvas.getContext('2d');
    const scale = h / 1080;
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#10283e'); sky.addColorStop(.42, '#285b65'); sky.addColorStop(1, '#34794c');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 64; i++) {
      c.fillStyle = i % 4 ? '#92bec4' : '#eafdc1';
      c.beginPath(); c.arc(((i * .618034) % 1) * w, ((i * .41421) % 1) * h * .38, (i % 3 + 1) * scale, 0, Math.PI * 2); c.fill();
    }
    this.art(c, 'moon', w * .72, h * .15, h * .19);
    c.fillStyle = '#1c4a48';
    c.beginPath(); c.ellipse(w * .22, h * .51, w * .7, h * .25, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2c694c';
    c.beginPath(); c.ellipse(w * .85, h * .57, w * .65, h * .22, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#357747'; c.fillRect(0, h * .51, w, h * .49);
    // Tall overlapping trees and a continuous fence make a garden, rather than isolated tile decorations.
    for (let i = 0; i < Math.ceil(w / (155 * scale)); i++) {
      this.art(c, i % 2 ? 'teal' : 'lime', i * 155 * scale, h * (.35 + .025 * (i % 3)), 310 * scale, 390 * scale);
    }
    for (let x = -50 * scale; x < w + 150 * scale; x += 174 * scale) {
      this.art(c, 'fence', x, h * .51, 240 * scale, 170 * scale);
    }
    // Warm garden path: a broad continuous ribbon from the gate to the doorstep.
    c.lineCap = 'round'; c.beginPath(); c.moveTo(-60 * scale, h * .78);
    c.bezierCurveTo(w * .25, h * .69, w * .5, h * .87, w * .83, h * .70);
    c.strokeStyle = '#183e35'; c.lineWidth = 132 * scale; c.stroke();
    c.strokeStyle = '#bea576'; c.lineWidth = 112 * scale; c.stroke();
    c.strokeStyle = '#dec796'; c.lineWidth = 80 * scale; c.stroke();
    // Planted beds, edging stones and grass tufts fill the foreground and both sides of the belt.
    for (const [row, y] of [[0, .625], [1, .94]]) {
      for (let i = 0; i < Math.ceil(w / (310 * scale)); i++) {
        const x = (i + .5) * 310 * scale;
        if (!row && x > w * .71) continue;
        c.fillStyle = '#214837'; c.strokeStyle = '#8eac5a'; c.lineWidth = 8 * scale;
        c.beginPath(); c.ellipse(x, h * y, 142 * scale, 54 * scale, -.06, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = '#604e38'; c.beginPath(); c.ellipse(x, h * y - 4 * scale, 126 * scale, 37 * scale, -.06, 0, Math.PI * 2); c.fill();
        for (let j = 0; j < 4; j++) {
          const key = ['flower', 'bell', 'rose', 'spitter', 'spikes'][(i + j + row) % 5];
          this.art(c, key, x + (j - 1.5) * 60 * scale, h * y - (j % 2 ? 35 : 52) * scale, 115 * scale);
        }
      }
    }
    for (let i = 0; i < 130; i++) {
      const x = ((i * .618034) % 1) * w, y = h * (.54 + ((i * .41421) % 1) * .46);
      if (y > h * .69 && y < h * .84) continue;
      c.strokeStyle = i % 2 ? '#66a951' : '#82b85b'; c.lineWidth = 3 * scale;
      c.beginPath(); c.moveTo(x - 6 * scale, y); c.lineTo(x - 12 * scale, y - 14 * scale);
      c.moveTo(x, y); c.lineTo(x, y - 18 * scale); c.moveTo(x + 5 * scale, y); c.lineTo(x + 13 * scale, y - 11 * scale); c.stroke();
    }
    // The house stays large and warm, visible to the right of the calibrated belt.
    this.art(c, 'house', w * .84, h * .47, h * .56, h * .61);
    return canvas;
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
    const size = this.h * .32, frame = walking ? Math.floor(time * 8) % 24 : 0;
    c.fillStyle = '#17372d66'; c.beginPath(); c.ellipse(x, feetY - size * .06, size * .28, size * .055, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(x, feetY); c.scale(-1, 1);   // the source walks left; home is to the right
    c.drawImage(img, frame % 6 * 256, Math.floor(frame / 6) * 256, 256, 256, -size / 2, -size, size, size);
    c.restore();
  }

  drawStory(c) {
    const w = this.w, h = this.h, t = this.storyTime;
    if (this.act === 'title') {
      const loop = t % 18, pan = smooth((loop - 3) / 7) * (this.panorama.width - w);
      c.drawImage(this.panorama, -pan, 0);
      const x = w * (-.035 + .435 * smooth(loop / 5));
      this.gus(c, x, h * .81, loop);
      this.maya(c, this.panorama.width * .84 - pan, h * .56, h * .135);
      this.story.classList.toggle('intro-walking', loop < 9);
      setText($('story-caption'), loop < 3 ? 'Gus is a long way from bedtime…' : loop < 9 ? 'Flowers. Pea spitters. Spikes. Maya is waiting at home.' : 'Stomp through the garden. Get Gus home.');
    } else {
      c.drawImage(this.garden, 0, 0);
      const finish = this.act === 'home';
      const fraction = finish ? 2 / 3 + smooth(t / 3) / 3 : (this.state.round - 1) / (this.state.rounds || 3);
      const x = w * (.08 + fraction * .70);
      if (finish) {
        // Door swings inward as Gus arrives. Bright interior sits over the closed-door artwork.
        const open = smooth((t - 1.8) / 1.1), doorX = w * .84 - h * .048, doorY = h * .51;
        c.fillStyle = '#ffe9a0'; c.fillRect(doorX - h * .029, doorY, h * .058, h * .135);
        c.fillStyle = '#75523b'; c.fillRect(doorX - h * .029, doorY, h * .058 * (1 - open), h * .135);
      }
      this.gus(c, x, h * .80, t, finish && t < 3);
      this.maya(c, w * .86, h * .56, h * .135, finish && t > 2.5 ? t : 0);
      if (!finish) {
        c.textAlign = 'center'; c.font = `bold ${Math.max(28, h * .032)}px Trebuchet MS`;
        c.strokeStyle = '#173b32'; c.lineWidth = 7; c.fillStyle = '#fff1a4';
        const label = `${this.state.round - 1}/${this.state.rounds || 3} HOME`;
        c.strokeText(label, x, h * .84); c.fillText(label, x, h * .84);
      } else if (t > 2.6) {
        const colors = ['#ffdb62', '#ed80bc', '#b3ff79', '#80e4e4'];
        for (let i = 0; i < 36; i++) {
          const age = ((t - 2.6) * .4 + i / 36) % 1;
          c.fillStyle = colors[i % 4];
          c.fillRect(w * (.57 + (i * .618034 % 1) * .4) + Math.sin(i + t * 2) * 18, h * (.22 + age * .55), 10, 18);
        }
      }
    }
  }

  frame(now) {
    this.request = requestAnimationFrame(this.frame);
    if (now - this.lastFrame < 1000 / 30) return;
    const dt = this.lastFrame ? Math.min(.1, (now - this.lastFrame) / 1000) : 0; this.lastFrame = now;
    if (!this.state.paused && !this.zone.active) { this.elapsed += dt; this.storyTime += dt; }
    const full = !this.state.paused && !this.zone.active && (['title', 'rest'].includes(this.act) || this.act === 'home' && this.storyTime < ENDING_SECONDS);
    document.body.classList.toggle('story-active', full); this.story.hidden = !full;
    $('story-intro').hidden = this.act !== 'title'; $('story-rest').hidden = this.act !== 'rest'; $('story-ending').hidden = this.act !== 'home';
    const c = this.ctx;
    c.globalAlpha = 1;
    if (full) this.drawStory(c);
    else {
      c.drawImage(this.garden, 0, 0);
      this.maya(c, this.w * .86, this.h * .56, this.h * .11);
      if (this.act === 'home') this.gus(c, this.w * .78, this.h * .80, 0, false);
      // Few fireflies, no moving background tiles or per-frame scenery painting.
      for (let i = 0; i < 12; i++) {
        c.globalAlpha = .35 + .35 * Math.sin(this.elapsed * 1.4 + i);
        c.fillStyle = '#e6ffab'; c.beginPath();
        c.arc(((i * .618034) % 1) * this.w + Math.sin(this.elapsed + i) * 12,
          this.h * (.35 + ((i * .41421) % 1) * .6), 3, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = .8; c.strokeStyle = this.state.paceOk ? '#bbffc7' : '#ffb21e'; c.lineWidth = 6; c.stroke(this.path);
    }
    c.globalAlpha = 1;
  }
}
