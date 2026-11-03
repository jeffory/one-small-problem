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
export function tilePath(B, a, b, step = .35) { const n = B.n, c = p => Math.round(p.z + B.half) * n + Math.round(p.x + B.half), s = c(a), g = c(b), from = new Int32Array(n * n).fill(-1), q = [s]; from[s] = s;
  for (let h = 0; h < q.length && from[g] < 0; h++) { const k = q[h]; for (const d of [1, -1, n, -n]) { const m = k + d; if (from[m] < 0 && Math.abs(B.floor[m] - B.floor[k]) <= step) { from[m] = k; q.push(m); } } }
  const out = []; for (let k = g; ; k = from[k]) { out.unshift([k % n - B.half, (k / n | 0) - B.half]); if (k === s) return out; } }
// Does the segment a -> b cross any of the triangles (each [p0, p1, p2] of [x, y, z])? Moller-Trumbore, ends excluded.
export function segmentHits(tris, a, b) { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], dt = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  for (const [p0, p1, p2] of tris) { const e1 = sub(p1, p0), e2 = sub(p2, p0), h = cr(d, e2), q = dt(e1, h); if (Math.abs(q) < 1e-12) continue;
    const s = sub(a, p0), u = dt(s, h) / q; if (u < 0 || u > 1) continue; const r = cr(s, e1), v = dt(d, r) / q; if (v < 0 || u + v > 1) continue;
    const t = dt(e2, r) / q; if (t > 1e-6 && t < 1 - 1e-6) return true; } return false; }
