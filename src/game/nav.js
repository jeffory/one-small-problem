// Pure navigation: line of sight over the height field, and one windowed BFS distance field from the player.
export const FIELD_N = 96, UNK = 65535;
export function lineOfSight(ground, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], s = Math.ceil(Math.sqrt(dx * dx + dy * dy + dz * dz) / 0.75);
  for (let i = 1; i < s; i++) { const f = i / s; if (ground(a[0] + dx * f, a[2] + dz * f) > a[1] + dy * f) return false; }
  return true;
}
export const createField = () => ({ ox: 0, oz: 0, half: 0, n: FIELD_N, d: new Uint16Array(FIELD_N * FIELD_N).fill(UNK) });
const Q = new Int32Array(FIELD_N * FIELD_N), DI = [1, -1, 0, 0], DJ = [0, 0, 1, -1];
export function updateField(F, grid, N, half, px, pz, maxStep) {
  const n = F.n, d = F.d, ci = Math.round(px + half), cj = Math.round(pz + half);
  F.ox = ci - (n >> 1); F.oz = cj - (n >> 1); F.half = half; d.fill(UNK);
  if (ci < 0 || cj < 0 || ci >= N || cj >= N) return;
  const si = ci - F.ox, sj = cj - F.oz; let h = 0, t = 0; d[sj * n + si] = 0; Q[t++] = sj * n + si;
  while (h < t) {
    const c = Q[h++], i = c % n, j = (c / n) | 0, gi = i + F.ox, gj = j + F.oz, g0 = grid[gj * N + gi], nd = d[c] + 1;
    for (let k = 0; k < 4; k++) {
      const ni = i + DI[k], nj = j + DJ[k]; if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const mi = ni + F.ox, mj = nj + F.oz; if (mi < 0 || mj < 0 || mi >= N || mj >= N) continue;
      const nc = nj * n + ni; if (d[nc] !== UNK || Math.abs(grid[mj * N + mi] - g0) > maxStep) continue;
      d[nc] = nd; Q[t++] = nc;
    }
  }
}
export function fieldDir(F, x, z) {
  const n = F.n, d = F.d, i = Math.round(x + F.half) - F.ox, j = Math.round(z + F.half) - F.oz;
  if (i < 0 || j < 0 || i >= n || j >= n) return null;
  const c = d[j * n + i]; if (c === UNK || c === 0) return null;
  const at = (a, b) => (a < 0 || b < 0 || a >= n || b >= n ? UNK : d[b * n + a]);
  let best = UNK, bx = 0, bz = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (!di && !dj) continue; const v = at(i + di, j + dj); if (v === UNK) continue;
    if (di && dj && (at(i + di, j) === UNK || at(i, j + dj) === UNK)) continue;
    if (v < best) { best = v; bx = di; bz = dj; }
  }
  if (best === UNK) return null; const l = Math.sqrt(bx * bx + bz * bz); return [bx / l, bz / l];
}
