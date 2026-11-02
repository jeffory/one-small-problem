import { fbm2, valueNoise2 } from './noise.js';

export const N = 512, HALF = 256, MAP_MARGIN = 24;

function smoothstep(a, b, x) {
  let t = (x - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}

export function pickLayout(rng) {
  const lander = { x: -170 + rng.range(-20, 20), z: 170 + rng.range(-20, 20), y: 0 };
  const base = { x: 150 + rng.range(-20, 20), z: -150 + rng.range(-20, 20), R: rng.range(55, 68) };
  let ux = lander.x - base.x, uz = lander.z - base.z, l = Math.sqrt(ux * ux + uz * uz);
  ux /= l; uz /= l;
  const rim = { x: base.x + ux * base.R * 1.05, z: base.z + uz * base.R * 1.05 };
  let dx = rim.x - lander.x, dz = rim.z - lander.z;
  l = Math.sqrt(dx * dx + dz * dz); dx /= l; dz /= l;
  const spawn = { x: lander.x + dx * 6, z: lander.z + dz * 6, dx, dz };
  return { lander, spawn, base, rim };
}

export function buildRoute(rng, L) {
  const { spawn: s, rim } = L, dx = s.dx, dz = s.dz, px = -dz, pz = dx, lim = HALF - 40;
  const cl = (v) => v < -lim ? -lim : v > lim ? lim : v;
  const pts = [[s.x, s.z]];
  for (let k = 1; k <= 7; k++) {
    const t = k / 8, p = rng.range(-45, 45), q = rng.range(-10, 10);
    pts.push([cl(s.x + (rim.x - s.x) * t + px * p + dx * q), cl(s.z + (rim.z - s.z) * t + pz * p + dz * q)]);
  }
  pts.push([rim.x, rim.z]);
  return pts;
}

export function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const ax = pts[i][0], az = pts[i][1], ex = pts[i + 1][0] - ax, ez = pts[i + 1][1] - az;
    const l2 = ex * ex + ez * ez;
    let t = l2 > 0 ? ((x - ax) * ex + (z - az) * ez) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ox = x - ax - ex * t, oz = z - az - ez * t, d = ox * ox + oz * oz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function polylineLength(pts) {
  let len = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const ex = pts[i + 1][0] - pts[i][0], ez = pts[i + 1][1] - pts[i][1];
    len += Math.sqrt(ex * ex + ez * ez);
  }
  return len;
}

export function craterProfile(r, R) {
  const depth = 0.32 * R, rim = 0.075 * R;
  if (r < 1) {
    let d = depth * (r * r - 1) + rim * r * r * r * r;
    if (R > 9) d = Math.max(d, -0.78 * depth);
    return d;
  }
  if (r < 1.8) {
    const q = (r - 1) * 2.6, t = Math.max(0, 1 - q * q / 4);
    return rim * t * t * t * t;
  }
  return 0;
}

export function sampleBilinear(arr, x, z) {
  let gx = x + HALF, gz = z + HALF;
  gx = gx < 0 ? 0 : gx > N - 1 ? N - 1 : gx;
  gz = gz < 0 ? 0 : gz > N - 1 ? N - 1 : gz;
  const xi = Math.min(Math.floor(gx), N - 2), zi = Math.min(Math.floor(gz), N - 2);
  const fx = gx - xi, fz = gz - zi, i = zi * N + xi;
  const a = arr[i], b = arr[i + 1], c = arr[i + N], d = arr[i + N + 1];
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

export function buildHeightfield(rng, L, route) {
  const s1 = rng.int(0x7fffffff), s2 = rng.int(0x7fffffff), s3 = rng.int(0x7fffffff);
  const h = new Float32Array(N * N), mask = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    const z = j - HALF;
    for (let i = 0; i < N; i++) {
      const x = i - HALF, m = smoothstep(4, 16, distToPolyline(x, z, route));
      mask[j * N + i] = m;
      h[j * N + i] = ((fbm2(x / 110, z / 110, 5, s1) - 0.5) * 14 + (fbm2(x / 22 + 40, z / 22, 4, s2) - 0.5) * 2.4 +
        (valueNoise2(x / 5, z / 5, s3) - 0.5) * 0.5) * (0.35 + 0.65 * m);
    }
  }
  const { lander, base } = L, craters = [];
  const stamp = (cx, cz, R, isBase) => {
    craters.push([cx, cz, R]);
    const ext = 1.8 * R;
    const i0 = Math.max(0, Math.floor(cx + HALF - ext)), i1 = Math.min(N - 1, Math.ceil(cx + HALF + ext));
    const j0 = Math.max(0, Math.floor(cz + HALF - ext)), j1 = Math.min(N - 1, Math.ceil(cz + HALF + ext));
    for (let j = j0; j <= j1; j++) {
      const oz = j - HALF - cz;
      for (let i = i0; i <= i1; i++) {
        const ox = i - HALF - cx, r = Math.sqrt(ox * ox + oz * oz) / R;
        if (r >= 1.8) continue;
        const k = j * N + i, m = mask[k];
        h[k] += craterProfile(r, R) * (isBase ? 1 - (1 - m) * 0.85 : m);
      }
    }
  };
  stamp(base.x, base.z, base.R, true);
  const tryAdd = (R, lim) => {
    const cx = rng.range(-lim, lim), cz = rng.range(-lim, lim);
    const ldx = cx - lander.x, ldz = cz - lander.z, lr = R + (R <= 2.5 ? 6 : 14);
    if (ldx * ldx + ldz * ldz < lr * lr) return;
    const bdx = cx - base.x, bdz = cz - base.z, br = base.R + 0.5 * R;
    if (bdx * bdx + bdz * bdz < br * br) return;
    stamp(cx, cz, R, false);
  };
  for (let k = 0; k < 4; k++) tryAdd(rng.range(18, 30), 230);
  for (let k = 0; k < 14; k++) tryAdd(rng.range(7, 19), 230);
  for (let k = 0; k < 260; k++) { const u = rng.next(); tryAdd(0.8 + 6 * u * u, 250); }
  lander.y = sampleBilinear(h, lander.x, lander.z);
  const i0 = Math.max(0, Math.floor(lander.x + HALF - 7)), i1 = Math.min(N - 1, Math.ceil(lander.x + HALF + 7));
  const j0 = Math.max(0, Math.floor(lander.z + HALF - 7)), j1 = Math.min(N - 1, Math.ceil(lander.z + HALF + 7));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const ox = i - HALF - lander.x, oz = j - HALF - lander.z, d = Math.sqrt(ox * ox + oz * oz);
    if (d >= 7) continue;
    const w = 1 - smoothstep(4, 7, d), k = j * N + i;
    h[k] += (lander.y - h[k]) * w;
  }
  return { h, craters };
}
