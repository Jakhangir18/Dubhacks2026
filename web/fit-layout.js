// Conservative empty rectangles: every decoration stays outside the calibrated quad.
export function gardenLayout(p, w, h) {
  const pad = 16;
  const left = Math.min(...p.map(v => v[0])), right = Math.max(...p.map(v => v[0]));
  const top = Math.min(...p.map(v => v[1])), bottom = Math.max(...p.map(v => v[1]));
  const far = [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2];
  const near = [(p[2][0] + p[3][0]) / 2, (p[2][1] + p[3][1]) / 2];
  const regions = [
    { x: Math.max(pad, left), y: pad, w: Math.min(w - pad, right) - Math.max(pad, left), h: top - 2 * pad },
    { x: Math.max(pad, left), y: bottom + pad, w: Math.min(w - pad, right) - Math.max(pad, left), h: h - bottom - 2 * pad },
    { x: pad, y: pad, w: left - 2 * pad, h: h - 2 * pad },
    { x: right + pad, y: pad, w: w - right - 2 * pad, h: h - 2 * pad },
  ].filter(r => r.w > 48 && r.h > 48);
  const direction = r => ((r.x + r.w / 2 - far[0]) * (far[0] - near[0]) +
    (r.y + r.h / 2 - far[1]) * (far[1] - near[1]));
  const ahead = regions.filter(r => direction(r) > 0);
  const house = [...(ahead.length ? ahead : regions)].sort((a, b) => b.w * b.h - a.w * a.h)[0];
  const hud = regions.filter(r => r !== house && r.w >= 150 && r.h >= 180).sort((a, b) => direction(a) - direction(b))[0];
  const decorations = [];
  const overlap = (a, b) => b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const center = [(far[0] + near[0]) / 2, (far[1] + near[1]) / 2];
  for (const [a, b] of [[p[0], p[3]], [p[1], p[2]]]) {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    let nx = -dy / length, ny = dx / length;
    if ((center[0] - a[0]) * nx + (center[1] - a[1]) * ny > 0) { nx = -nx; ny = -ny; }
    for (const t of [.2, .5, .8]) for (const size of [140, 110, 80, 56]) {
      // The square's whole support lies beyond this side's half-plane.
      const distance = size / 2 * (Math.abs(nx) + Math.abs(ny)) + 18;
      const r = { x: a[0] + dx * t + nx * distance - size / 2,
        y: a[1] + dy * t + ny * distance - size / 2, w: size, h: size };
      if (r.x < pad || r.y < pad || r.x + size > w - pad || r.y + size > h - pad ||
          overlap(r, house) || overlap(r, hud) || decorations.some(d => overlap(r, d))) continue;
      decorations.push(r); break;
    }
  }
  return { house, hud, regions, far, near, decorations };
}
