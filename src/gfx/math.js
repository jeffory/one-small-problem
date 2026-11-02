// Column-major 4x4 matrix helpers (Float32Array) for the renderer and scene builders.
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export function persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); }
export function mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
export function viewM(e, f, r, u) { return new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, e), -dot(u, e), dot(f, e), 1]); }
export const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export const I3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
export const T = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
export const Rx = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
export const Ry = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };
export const Rz = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); };
export const Sc = s => new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
export const MM = (...ms) => ms.reduce((a, b) => mul(a, b));
export function rot3(m) { const o = new Float32Array(9); for (let c = 0; c < 3; c++) { const l = Math.hypot(m[c * 4], m[c * 4 + 1], m[c * 4 + 2]) || 1; for (let r = 0; r < 3; r++) o[c * 3 + r] = m[c * 4 + r] / l; } return o; }
// Allocation-free writers for the per-frame paths: each writes into o and returns it. o must not be an input.
export function mulTo(o, a, b) { for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
export function rot3To(o, m) { for (let c = 0; c < 3; c++) { const l = Math.hypot(m[c * 4], m[c * 4 + 1], m[c * 4 + 2]) || 1; for (let r = 0; r < 3; r++) o[c * 3 + r] = m[c * 4 + r] / l; } return o; }
export const setT = (o, x, y, z) => { o.set(I4); o[12] = x; o[13] = y; o[14] = z; return o; };
export const setRx = (o, a) => { const c = Math.cos(a), s = Math.sin(a); o.set(I4); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; };
export const setRy = (o, a) => { const c = Math.cos(a), s = Math.sin(a); o.set(I4); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; };
export const setRz = (o, a) => { const c = Math.cos(a), s = Math.sin(a); o.set(I4); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; };
export const setSc = (o, s) => { o.set(I4); o[0] = o[5] = o[10] = s; return o; };
const CA = new Float32Array(16), CB = new Float32Array(16);
// o = ms[0] * ms[1] * ...; the partial products alternate between two scratch buffers. o must not be among ms.
export function chainTo(o, ...ms) {
  const n = ms.length; let a = ms[0];
  for (let i = 1; i < n; i++) { const d = i === n - 1 ? o : i & 1 ? CA : CB; mulTo(d, a, ms[i]); a = d; }
  if (n === 1) o.set(a);
  return o;
}
// o = T(x, y, z) * Ry(yaw) * Sc(s)
export function trs(o, x, y, z, yaw, s) {
  const c = Math.cos(yaw) * s, n = Math.sin(yaw) * s;
  o[0] = c; o[1] = 0; o[2] = -n; o[3] = 0; o[4] = 0; o[5] = s; o[6] = 0; o[7] = 0; o[8] = n; o[9] = 0; o[10] = c; o[11] = 0; o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
  return o;
}
export const xf = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
// Camera basis: yaw 0 faces -z; u = r x f.
export function cameraBasis(yaw, pitch) {
  const cp = Math.cos(pitch);
  const f = [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp], r = [Math.cos(yaw), 0, -Math.sin(yaw)];
  return { f, r, u: cross(r, f) };
}
