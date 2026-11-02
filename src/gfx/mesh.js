// Pure-JS geometry kit (no GL): builders push into {p, m, i}; finishMesh packs typed arrays.
import { norm, cross } from './math.js';

// Mat = [layer, scale, emissive, flags]
export const createMesh = () => ({ p: [], m: [], i: [] });
export function vtx(M, x, y, z, mt) { M.p.push(x, y, z); M.m.push(mt[0], mt[1], mt[2], mt[3]); return M.p.length / 3 - 1; }
export function quadIdx(M, a, b, c, d) { M.i.push(a, b, c, a, c, d); }
export function quad(M, A, B, C, D, mt) {
  quadIdx(M, vtx(M, A[0], A[1], A[2], mt), vtx(M, B[0], B[1], B[2], mt), vtx(M, C[0], C[1], C[2], mt), vtx(M, D[0], D[1], D[2], mt));
}
export function box(M, x0, y0, z0, x1, y1, z1, mt) {
  quad(M, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], mt); quad(M, [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1], mt);
  quad(M, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], mt); quad(M, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], mt);
  quad(M, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], mt); quad(M, [x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], mt);
}
export function beam(M, a, b, w, mt) {
  const f = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), r = norm(cross(f, Math.abs(f[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), u = cross(r, f);
  const P = (o, s, t) => [o[0] + (r[0] * s + u[0] * t) * w, o[1] + (r[1] * s + u[1] * t) * w, o[2] + (r[2] * s + u[2] * t) * w], c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let k = 0; k < 4; k++) { const s0 = c[k], s1 = c[(k + 1) % 4]; quad(M, P(a, s0[0], s0[1]), P(a, s1[0], s1[1]), P(b, s1[0], s1[1]), P(b, s0[0], s0[1]), mt); }
  quad(M, P(a, -1, -1), P(a, -1, 1), P(a, 1, 1), P(a, 1, -1), mt); quad(M, P(b, -1, -1), P(b, 1, -1), P(b, 1, 1), P(b, -1, 1), mt);
}
export function prism(M, cx, y0, cz, r, h, n, mt, rot = 0) {
  const pt = k => { const a = rot + k / n * Math.PI * 2; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; };
  for (let k = 0; k < n; k++) { const A = pt(k), B = pt(k + 1); quad(M, [A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y0 + h, B[1]], [A[0], y0 + h, A[1]], mt); }
  const top = vtx(M, cx, y0 + h, cz, mt), bot = vtx(M, cx, y0, cz, mt), ts = [], bs = [];
  for (let k = 0; k < n; k++) { const A = pt(k); ts.push(vtx(M, A[0], y0 + h, A[1], mt)); bs.push(vtx(M, A[0], y0, A[1], mt)); }
  for (let k = 0; k < n; k++) M.i.push(top, ts[k], ts[(k + 1) % n], bot, bs[(k + 1) % n], bs[k]);
}
export function blob(M, c, r, seg, rings, mt, disp = null, yaw = 0) {
  const base = M.p.length / 3, cy = Math.cos(yaw), sy = Math.sin(yaw);
  for (let j = 0; j <= rings; j++) {
    const th = j / rings * Math.PI;
    for (let i = 0; i <= seg; i++) {
      const ph = i / seg * Math.PI * 2;
      let x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      const k = disp ? disp(x, y, z) : 1; x *= r[0] * k; y *= r[1] * k; z *= r[2] * k;
      vtx(M, c[0] + x * cy - z * sy, c[1] + y, c[2] + x * sy + z * cy, mt);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = base + j * (seg + 1) + i, b = a + seg + 1; quadIdx(M, a, b, b + 1, a + 1); }
}
// Spin a profile [[t, radius], ...] around the segment a->b; end caps are skipped where radius <= 0.
export function lathe(M, a, b, prof, n, mt) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], f = norm(d), r = norm(cross(f, Math.abs(f[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), u = cross(r, f), base = M.p.length / 3;
  const ring = (t, rad, i) => { const an = i / n * Math.PI * 2, ca = Math.cos(an) * rad, sa = Math.sin(an) * rad; return [a[0] + d[0] * t + r[0] * ca + u[0] * sa, a[1] + d[1] * t + r[1] * ca + u[1] * sa, a[2] + d[2] * t + r[2] * ca + u[2] * sa]; };
  for (const [t, rad] of prof) for (let i = 0; i <= n; i++) { const p = ring(t, rad, i); vtx(M, p[0], p[1], p[2], mt); }
  for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < n; i++) { const p = base + j * (n + 1) + i, q = p + n + 1; quadIdx(M, p, p + 1, q + 1, q); }
  for (const e of [0, prof.length - 1]) {
    const [t, rad] = prof[e]; if (rad <= 0) continue;
    const c = vtx(M, a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t, mt), rg = [];
    for (let i = 0; i < n; i++) { const p = ring(t, rad, i); rg.push(vtx(M, p[0], p[1], p[2], mt)); }
    for (let i = 0; i < n; i++) M.i.push(c, rg[i], rg[(i + 1) % n]);
  }
}
// Apply a column-major mat4 to the positions of every vertex from firstVertex onward.
export function transformFrom(M, firstVertex, m) {
  for (let k = firstVertex * 3; k < M.p.length; k += 3) {
    const x = M.p[k], y = M.p[k + 1], z = M.p[k + 2];
    M.p[k] = m[0] * x + m[4] * y + m[8] * z + m[12];
    M.p[k + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    M.p[k + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
}
// Area-weighted vertex normals plus typed-array packing.
export function finishMesh(M) {
  const P = M.p, I = M.i, n = new Float32Array(P.length);
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    n[a] += nx; n[a + 1] += ny; n[a + 2] += nz; n[b] += nx; n[b + 1] += ny; n[b + 2] += nz; n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
  }
  // Seam duplicates at a pole / cone apex only touch degenerate triangles; borrow the normal of the vertex at the same point.
  const at = new Map();
  for (let k = 0; k < n.length; k += 3) if (n[k] || n[k + 1] || n[k + 2]) at.set(`${P[k]},${P[k + 1]},${P[k + 2]}`, k);
  for (let k = 0; k < n.length; k += 3) {
    if (n[k] || n[k + 1] || n[k + 2]) continue;
    const s = at.get(`${P[k]},${P[k + 1]},${P[k + 2]}`);
    if (s !== undefined) { n[k] = n[s]; n[k + 1] = n[s + 1]; n[k + 2] = n[s + 2]; }
  }
  for (let k = 0; k < n.length; k += 3) { const l = Math.hypot(n[k], n[k + 1], n[k + 2]) || 1; n[k] /= l; n[k + 1] /= l; n[k + 2] /= l; }
  return { pos: new Float32Array(P), nrm: n, mat: new Float32Array(M.m), idx: new Uint32Array(I) };
}
