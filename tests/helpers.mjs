import { sampleGround, HALF, N, MAP_MARGIN } from '../src/gen/surface.js';
export function edgeMargin(w, bound = HALF - MAP_MARGIN, eye = 1.7) {
  let worst = Infinity;
  for (let k = HALF - bound; k <= HALF + bound; k++) {
    const c = k - HALF;
    for (const [e, g] of [[w.h[k * N], sampleGround(w, -bound, c)], [w.h[k * N + N - 1], sampleGround(w, bound, c)],
      [w.h[k], sampleGround(w, c, -bound)], [w.h[(N - 1) * N + k], sampleGround(w, c, bound)]]) worst = Math.min(worst, e - g - eye);
  }
  return worst;
}
export function tileLevel(rows, { ceil = 3, wall = 99 } = {}) {
  const n = Math.max(rows.length, ...rows.map(r => r.length)), floor = new Float32Array(n * n).fill(wall), top = new Float32Array(n * n);
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '#') { floor[j * n + i] = c === 'c' ? 1.1 : 0; top[j * n + i] = c === 'l' ? 2.6 : ceil; } }));
  const at = (a, x, z, out) => { const i = Math.round(x), j = Math.round(z); return i < 0 || j < 0 || i >= n || j >= n ? out : a[j * n + i]; };
  const solid = (i, j) => i < 0 || j < 0 || i >= n || j >= n || floor[j * n + i] >= wall;
  return { n, ground: (x, z) => at(floor, x, z, wall), ceil: (x, z) => at(top, x, z, 0),
    gap(x, z) { let g = Infinity; for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) if (solid(i, j)) g = Math.min(g, Math.hypot(Math.max(0, Math.abs(x - i) - .5), Math.max(0, Math.abs(z - j) - .5))); return g; } };
}
