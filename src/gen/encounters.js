import { makeRng } from './rng.js';
import { reachMap } from './passable.js';
import { N, HALF, MAP_MARGIN, MAX_STEP, polylineLength, sampleGround } from './surface.js';
// surface.js and this file import each other: read surface.js bindings only inside functions.

export const COST = { sk: 1, fl: 2, br: 4 };
export const SURFACE_P = 0.35, FIRST_AT = 70, GAP = 60;
export function budgetAt(p) { return Math.floor(2 + 16 * p); }

export function planFight(world) {
  const rng = makeRng(world.seed + '/fight/' + world.attempt);
  const route = world.route, occ = world.occ, h = world.h, lim = HALF - MAP_MARGIN - 4;
  const reach = reachMap(occ, N, [Math.round(world.spawn.x + HALF), Math.round(world.spawn.z + HALF)], MAX_STEP, MAP_MARGIN);
  const standable = (x, z) => {
    if (x < -lim || x > lim || z < -lim || z > lim) return false;
    const i = Math.round(x + HALF), j = Math.round(z + HALF), c = j * N + i;
    if (reach[c] !== 1 || occ[c] - h[c] >= 0.05) return false;
    const o = occ[c];
    for (const k of [c - 1, c + 1, c - N, c + N]) { const d = occ[k] - o; if ((d < 0 ? -d : d) > MAX_STEP) return false; }
    return true;
  };
  const Lr = polylineLength(route);
  const routeAt = (s) => {
    s = s < 0 ? 0 : s > Lr ? Lr : s;
    let acc = 0;
    for (let i = 0; i + 1 < route.length; i++) {
      const ex = route[i + 1][0] - route[i][0], ez = route[i + 1][1] - route[i][1], l = Math.sqrt(ex * ex + ez * ez);
      if (l > 0 && (acc + l >= s || i + 2 === route.length)) {
        const t = (s - acc) / l;
        return { x: route[i][0] + ex * t, z: route[i][1] + ez * t, dx: ex / l, dz: ez / l };
      }
      acc += l;
    }
    return { x: route[0][0], z: route[0][1], dx: 0, dz: 1 };
  };
  const dist = (a, b) => { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); };

  const count = Math.max(5, Math.floor((Lr - FIRST_AT) / GAP));
  const encounters = [];
  for (let k = 0; k <= count; k++) {
    const s = FIRST_AT + k * (Lr - 8 - FIRST_AT) / count, p = SURFACE_P * s / Lr, c = routeAt(s + 12);
    const types = [];
    if (k === 0) types.push('sk');
    else {
      let B = budgetAt(p);
      if (p >= 0.3 && B >= 4) { types.push('br'); B -= 4; }
      if (B >= 2 && (k % 2 === 1 || rng.next() < 0.35)) { types.push('fl'); B -= 2; }
      if (B >= 4 && rng.next() < 0.3) { types.push('fl'); B -= 2; }
      while (B > 0) { types.push('sk'); B -= 1; }
    }
    const aliens = [];
    types.forEach((type, j) => {
      let spot = null;
      for (let t = 0; t < 40 && !spot; t++) {
        const side = k === 0 ? rng.range(-4, 4) : rng.range(-14, 14), fwd = rng.range(-4, 10);
        const x = c.x - c.dz * side + c.dx * fwd, z = c.z + c.dx * side + c.dz * fwd;
        if (standable(x, z) && aliens.every(a => dist(a, { x, z }) >= 2.5)) spot = { x, z };
      }
      if (!spot) spot = routeAt(s + 12 + 2 * j);
      const g = sampleGround(world, spot.x, spot.z);
      aliens.push({ type, x: spot.x, y: type === 'fl' ? g + rng.range(3, 4.5) : g, z: spot.z });
    });
    encounters.push({ x: c.x, z: c.z, p, first: k === 0, aliens });
  }

  const pickups = [];
  const pick = (kind, s, lo, hi, either) => {
    const c = routeAt(s), sign = either && rng.next() < 0.5 ? -1 : 1;
    let spot = null;
    for (let t = 0; t < 40 && !spot; t++) {
      const side = sign * rng.range(lo, hi), fwd = rng.range(-4, 4);
      const x = c.x - c.dz * side + c.dx * fwd, z = c.z + c.dx * side + c.dz * fwd;
      if (standable(x, z)) spot = { x, z };
    }
    if (!spot) spot = c;
    pickups.push({ kind, x: spot.x, y: sampleGround(world, spot.x, spot.z), z: spot.z });
  };
  pick('tape', Lr / 2, 10, 16, true);
  pick('tape', Lr - 45, 4, 8, false);
  pick('cells', 0.3 * Lr, 8, 14, false);
  pick('cells', 0.7 * Lr, 8, 14, false);

  // R15: a canister stands 1.5 m from every alien, 1 m from every pickup and 1.2 m from every canister already placed
  // (its own cluster's members and, though they are far apart anyway, the other clusters').
  const canisters = [], walkers = encounters.flatMap(e => e.aliens);
  const clear = (x, z, cluster) => {
    const q = { x, z };
    return standable(x, z) && walkers.every(a => dist(a, q) >= 1.5) && pickups.every(u => dist(u, q) >= 1) &&
      canisters.every(c => dist(c, q) >= 1.2) && cluster.every(c => dist(c, q) >= 1.2);
  };
  const hosts = [1, 3, encounters.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  for (const ei of hosts) {
    const e = encounters[ei], cluster = [];
    let anchor = null;
    for (let t = 0; t < 40 && !anchor; t++) {
      const side = (rng.next() < 0.5 ? -1 : 1) * rng.range(6, 10), fwd = rng.range(-4, 4);
      // side axis from the route direction at the encounter centre
      const r = nearestDir(route, e.x, e.z);
      const x = e.x - r.dz * side + r.dx * fwd, z = e.z + r.dx * side + r.dz * fwd;
      if (clear(x, z, cluster)) anchor = { x, z };
    }
    if (!anchor) continue;
    cluster.push(anchor);
    while (cluster.length < 3) {
      const prev = cluster[cluster.length - 1];
      let spot = null;
      for (let t = 0; t < 40 && !spot; t++) {
        let vx = rng.range(-1, 1), vz = rng.range(-1, 1);
        const l = Math.sqrt(vx * vx + vz * vz);
        if (l < 0.05) continue;
        const d = rng.range(1.2, 2.0);
        const x = prev.x + vx / l * d, z = prev.z + vz / l * d;
        if (clear(x, z, cluster)) spot = { x, z };
      }
      if (!spot) break;
      cluster.push(spot);
    }
    if (cluster.length >= 2) for (const q of cluster) canisters.push({ x: q.x, y: sampleGround(world, q.x, q.z), z: q.z });
  }
  return { encounters, pickups, canisters };
}

// Unit direction of the route segment nearest to a point.
function nearestDir(route, x, z) {
  let best = Infinity, out = { dx: 0, dz: 1 };
  for (let i = 0; i + 1 < route.length; i++) {
    const ax = route[i][0], az = route[i][1], ex = route[i + 1][0] - ax, ez = route[i + 1][1] - az, l2 = ex * ex + ez * ez;
    if (l2 <= 0) continue;
    let t = ((x - ax) * ex + (z - az) * ez) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ox = x - ax - ex * t, oz = z - az - ez * t, d = ox * ox + oz * oz;
    if (d < best) { best = d; const l = Math.sqrt(l2); out = { dx: ex / l, dz: ez / l }; }
  }
  return out;
}
