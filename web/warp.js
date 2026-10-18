// Four-corner warp shared by the projector test page and the game.
// Classic script (not a module) so pages also work when opened straight from disk.
// Warp.apply(el, corners) maps an element's rectangle onto four screen points
// (top-left, top-right, bottom-right, bottom-left) with a CSS matrix3d.
(function () {
  // Gaussian elimination with partial pivoting for the 8x8 homography system.
  function solve(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let max = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[max][i])) max = r;
      [A[i], A[max]] = [A[max], A[i]];
      [b[i], b[max]] = [b[max], b[i]];
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
      x[i] = s / A[i][i];
    }
    return x;
  }

  // Homography h[0..7] (h8 = 1) mapping four src points to four dst points.
  function homography(src, dst) {
    const A = [];
    const b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i];
      const [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    return solve(A, b);
  }

  function mapPoint(h, x, y) {
    const w = h[6] * x + h[7] * y + 1;
    return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
  }

  function matrix3d(w, h, corners) {
    const H = homography([[0, 0], [w, 0], [w, h], [0, h]], corners);
    return `matrix3d(${H[0]},${H[3]},0,${H[6]},${H[1]},${H[4]},0,${H[7]},0,0,1,0,${H[2]},${H[5]},0,1)`;
  }

  function apply(el, corners) {
    el.style.transformOrigin = '0 0';
    el.style.transform = corners ? matrix3d(el.offsetWidth, el.offsetHeight, corners) : '';
  }

  function defaultCorners(w, h, inset = 60) {
    return [[inset, inset], [w - inset, inset], [w - inset, h - inset], [inset, h - inset]];
  }

  // Draggable corner handles; onChange(corners) fires on every move.
  function handles(layer, corners, onChange) {
    layer.innerHTML = '';
    const labels = ['TL', 'TR', 'BR', 'BL'];
    corners.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'warp-handle';
      d.textContent = labels[i];
      d.style.left = `${c[0]}px`;
      d.style.top = `${c[1]}px`;
      d.addEventListener('pointerdown', (e) => {
        d.setPointerCapture(e.pointerId);
        const move = (m) => {
          corners[i] = [m.clientX, m.clientY];
          d.style.left = `${m.clientX}px`;
          d.style.top = `${m.clientY}px`;
          onChange(corners);
        };
        d.addEventListener('pointermove', move);
        d.addEventListener('pointerup', () => d.removeEventListener('pointermove', move), { once: true });
      });
      layer.appendChild(d);
    });
  }

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
    },
  };

  window.Warp = { homography, mapPoint, matrix3d, apply, defaultCorners, handles, store, CORNERS_KEY: 'zombiewalk.corners' };
})();
