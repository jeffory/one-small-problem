// The switchback carved down the base crater's inner wall, the door pad and the hangar-door bunker's footprint.
import { makeRng } from './rng.js';
import { N, HALF, sampleBilinear, stampOccluders, distToPolyline } from './surface.js';

export const CRATER = { legs: [[1.05, 0], [.92, 1], [.76, -1], [.60, 1], [.42, 0]], w: [.25, .31], half: 3, blend: 4,
  door: .30, use: 1.8, pad: { at: .36, r: 12, blend: 4 }, bunker: { w: 7, d: 6, h: 4.5 } };

function smoothstep(a, b, x) {
  let t = (x - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}

// Visit every height sample within rad of (cx, cz): fn(index, world x, world z).
function eachNear(cx, cz, rad, fn) {
  const i0 = Math.max(0, Math.floor(cx + HALF - rad)), i1 = Math.min(N - 1, Math.ceil(cx + HALF + rad));
  const j0 = Math.max(0, Math.floor(cz + HALF - rad)), j1 = Math.min(N - 1, Math.ceil(cz + HALF + rad));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * N + i, i - HALF, j - HALF);
}

export function carveCrater(world) {
  const { h, base: C, rim, route } = world, R = C.R, { legs, half, blend, pad } = CRATER;
  let ux = rim.x - C.x, uz = rim.z - C.z;
  const ul = Math.sqrt(ux * ux + uz * uz);
  ux /= ul; uz /= ul;
  const tx = -uz, tz = ux, rng = makeRng(world.seed + '/crater/' + world.attempt);
  const side = rng.next() < .5 ? 1 : -1, w = R * rng.range(CRATER.w[0], CRATER.w[1]);
  const path = legs.map(([f, s], k) => k ? [C.x + ux * f * R + tx * side * s * w, C.z + uz * f * R + tz * side * s * w] : route[route.length - 1].slice());
  const arc = [0];
  for (let k = 1; k < path.length; k++) {
    const ex = path[k][0] - path[k - 1][0], ez = path[k][1] - path[k - 1][1];
    arc.push(arc[k - 1] + Math.sqrt(ex * ex + ez * ez));
  }
  const y0 = sampleBilinear(h, path[0][0], path[0][1]), yE = sampleBilinear(h, path[4][0], path[4][1]), total = arc[arc.length - 1];
  const ys = arc.map(a => y0 + (yE - y0) * a / total);

  // the pad first, so the path's own heights win on its strip
  const qx = C.x + ux * pad.at * R, qz = C.z + uz * pad.at * R, pr = pad.r + pad.blend;
  eachNear(qx, qz, pr, (k, x, z) => {
    const dx = x - qx, dz = z - qz;
    h[k] += (yE - h[k]) * (1 - smoothstep(pad.r, pr, Math.sqrt(dx * dx + dz * dz)));
  });

  // the path: nearest polyline point gives arc s and distance d
  const reach = half + blend;
  for (let s = 0; s + 1 < path.length; s++) {
    const [ax, az] = path[s], [bx, bz] = path[s + 1];
    eachNear((ax + bx) / 2, (az + bz) / 2, Math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az)) / 2 + reach + 1, (k, x, z) => {
      // only the segment-owner pass writes: find the global nearest point over all segments, act when it lies on this segment
      let best = Infinity, bs = 0, bseg = -1;
      for (let q = 0; q + 1 < path.length; q++) {
        const px = path[q][0], pz = path[q][1], ex = path[q + 1][0] - px, ez = path[q + 1][1] - pz, l2 = ex * ex + ez * ez;
        let t = ((x - px) * ex + (z - pz) * ez) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ox = x - px - ex * t, oz = z - pz - ez * t, d2 = ox * ox + oz * oz;
        if (d2 < best) { best = d2; bseg = q; bs = arc[q] + t * (arc[q + 1] - arc[q]); }
      }
      if (bseg !== s) return;
      const d = Math.sqrt(best);
      if (d >= reach) return;
      h[k] += (y0 + (yE - y0) * bs / total - h[k]) * (1 - smoothstep(half, reach, d));
    });
  }

  // rocks off the path and the pad
  world.rocks = world.rocks.filter(r => {
    const m = Math.max(r.sx, r.sz), dx = r.x - qx, dz = r.z - qz, lim = pr + 1 + m;
    return distToPolyline(r.x, r.z, path) >= reach + 1 + m && dx * dx + dz * dz >= lim * lim;
  });
  world.occ = stampOccluders(h, world, world.rocks);

  // the door and the bunker
  const dist = CRATER.door * R, door = { x: C.x + ux * dist, y: yE, z: C.z + uz * dist, dx: ux, dz: uz };
  const use = { x: door.x + ux * CRATER.use, z: door.z + uz * CRATER.use };
  const { w: bw, d: bd, h: bh } = CRATER.bunker, bx = door.x - ux * bd / 2, bz = door.z - uz * bd / 2;
  const bunker = { x: bx, z: bz, ux, uz, w: bw, d: bd, h: bh, y: yE }, rr = Math.sqrt(bw * bw / 4 + bd * bd / 4) + 1;
  eachNear(bx, bz, rr, (k, x, z) => {
    const dx = x - bx, dz = z - bz, a = dx * ux + dz * uz, s = -dx * uz + dz * ux;
    if (Math.abs(s) <= bw / 2 + .5 && Math.abs(a) <= bd / 2 + .5 && yE + bh > world.occ[k]) world.occ[k] = yE + bh;
  });
  const dx = path[1][0] - path[0][0], dz = path[1][1] - path[0][1], dl = Math.sqrt(dx * dx + dz * dz);
  return { path, ys, top: { x: path[0][0], z: path[0][1], dx: dx / dl, dz: dz / dl }, door, use, bunker };
}
