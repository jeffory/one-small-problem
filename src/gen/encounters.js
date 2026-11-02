import { makeRng } from './rng.js';
import { reachMap } from './passable.js';
import { N, HALF, MAP_MARGIN, MAX_STEP, polylineLength, sampleGround, distToPolyline } from './surface.js';

export const COST = { sk: 1, fl: 2, br: 4 };
export const SURFACE_P = 0.35, FIRST_AT = 70, GAP = 60;
export const CRATER_P = [.35, .5], CRATER_AT = [.25, .6, .95];
export function budgetAt(p) { return Math.floor(2 + 16 * p); }

// The point and unit direction at arc length s along a polyline, clamped to its ends.
export function pointAlong(pts, s) {
  const L = polylineLength(pts);
  s = s < 0 ? 0 : s > L ? L : s;
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const ex = pts[i + 1][0] - pts[i][0], ez = pts[i + 1][1] - pts[i][1], l = Math.sqrt(ex * ex + ez * ez);
    if (l > 0 && (acc + l >= s || i + 2 === pts.length)) {
      const t = (s - acc) / l;
      return { x: pts[i][0] + ex * t, z: pts[i][1] + ez * t, dx: ex / l, dz: ez / l };
    }
    acc += l;
  }
  return { x: pts[0][0], z: pts[0][1], dx: 0, dz: 1 };
}

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
  const Lr = polylineLength(route), routeAt = (s) => pointAlong(route, s);
  const dist = (a, b) => { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); };

  // Brute, then floaters, then skitterers from the budget at progress p; k (the encounter's index) picks the first floater by parity.
  const compose = (p, k, r) => {
    const types = [];
    let B = budgetAt(p);
    if (p >= 0.3 && B >= 4) { types.push('br'); B -= 4; }
    if (B >= 2 && (k % 2 === 1 || r.next() < 0.35)) { types.push('fl'); B -= 2; }
    if (B >= 4 && r.next() < 0.3) { types.push('fl'); B -= 2; }
    while (B > 0) { types.push('sk'); B -= 1; }
    return types;
  };
  // Aliens around centre c (side x fwd off c's direction); when no standable spot is found, a point along pts from s.
  const place = (c, types, sideR, fwdR, pts, s, r) => {
    const aliens = [];
    types.forEach((type, j) => {
      let spot = null;
      for (let t = 0; t < 40 && !spot; t++) {
        const side = r.range(sideR[0], sideR[1]), fwd = r.range(fwdR[0], fwdR[1]);
        const x = c.x - c.dz * side + c.dx * fwd, z = c.z + c.dx * side + c.dz * fwd;
        if (standable(x, z) && aliens.every(a => dist(a, { x, z }) >= 2.5)) spot = { x, z };
      }
      if (!spot) spot = pointAlong(pts, s + 2 * j);
      const g = sampleGround(world, spot.x, spot.z);
      aliens.push({ type, x: spot.x, y: type === 'fl' ? g + r.range(3, 4.5) : g, z: spot.z });
    });
    return aliens;
  };

  const count = Math.max(5, Math.floor((Lr - FIRST_AT) / GAP));
  const encounters = [];
  for (let k = 0; k <= count; k++) {
    const s = FIRST_AT + k * (Lr - 8 - FIRST_AT) / count, p = SURFACE_P * s / Lr, c = routeAt(s + 12);
    const aliens = k === 0 ? place(c, ['sk'], [-4, 4], [-4, 10], route, s + 12, rng) : place(c, compose(p, k, rng), [-14, 14], [-4, 10], route, s + 12, rng);
    encounters.push({ x: c.x, z: c.z, p, first: k === 0, area: 0, aliens });
  }

  const pickups = [];
  // side() draws the lateral offset; the forward offset is drawn from fwdR.
  const pick = (kind, c, area, side, fwdR, r) => {
    let spot = null;
    for (let t = 0; t < 40 && !spot; t++) {
      const sd = side(), fwd = r.range(fwdR[0], fwdR[1]);
      const x = c.x - c.dz * sd + c.dx * fwd, z = c.z + c.dx * sd + c.dz * fwd;
      if (standable(x, z)) spot = { x, z };
    }
    if (!spot) spot = c;
    pickups.push({ kind, x: spot.x, y: sampleGround(world, spot.x, spot.z), z: spot.z, area });
  };
  const onRoute = (kind, s, lo, hi, either) => {
    const sign = either && rng.next() < 0.5 ? -1 : 1;
    pick(kind, routeAt(s), 0, () => sign * rng.range(lo, hi), [-4, 4], rng);
  };
  onRoute('tape', Lr / 2, 10, 16, true);
  onRoute('tape', Lr - 45, 4, 8, false);
  onRoute('cells', 0.3 * Lr, 8, 14, false);
  onRoute('cells', 0.7 * Lr, 8, 14, false);

  // R15: a canister stands 1.5 m from every alien, 1 m from every pickup and 1.2 m from every canister already placed
  // (its own cluster's members and, though they are far apart anyway, the other clusters').
  const canisters = [];
  const cluster3 = (anchorAt, area, r) => {
    const walkers = encounters.flatMap(e => e.aliens), cluster = [];
    const clear = (x, z) => {
      const q = { x, z };
      return standable(x, z) && walkers.every(a => dist(a, q) >= 1.5) && pickups.every(u => dist(u, q) >= 1) &&
        canisters.every(c => dist(c, q) >= 1.2) && cluster.every(c => dist(c, q) >= 1.2);
    };
    let anchor = null;
    for (let t = 0; t < 40 && !anchor; t++) { const a = anchorAt(); if (clear(a.x, a.z)) anchor = a; }
    if (!anchor) return;
    cluster.push(anchor);
    while (cluster.length < 3) {
      const prev = cluster[cluster.length - 1];
      let spot = null;
      for (let t = 0; t < 40 && !spot; t++) {
        let vx = r.range(-1, 1), vz = r.range(-1, 1);
        const l = Math.sqrt(vx * vx + vz * vz);
        if (l < 0.05) continue;
        const d = r.range(1.2, 2.0);
        const x = prev.x + vx / l * d, z = prev.z + vz / l * d;
        if (clear(x, z)) spot = { x, z };
      }
      if (!spot) break;
      cluster.push(spot);
    }
    if (cluster.length >= 2) for (const q of cluster) canisters.push({ x: q.x, y: sampleGround(world, q.x, q.z), z: q.z, area });
  };
  const hosts = [1, 3, encounters.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  for (const ei of hosts) {
    const e = encounters[ei], d = nearestDir(route, e.x, e.z);
    cluster3(() => {
      const side = (rng.next() < 0.5 ? -1 : 1) * rng.range(6, 10), fwd = rng.range(-4, 4);
      return { x: e.x - d.dz * side + d.dx * fwd, z: e.z + d.dx * side + d.dz * fwd };
    }, 0, rng);
  }

  // The crater section: its own rng stream, so the surface plan above is what it always was.
  const K = world.crater, cr = makeRng(world.seed + '/fight/crater/' + world.attempt), Lp = polylineLength(K.path);
  CRATER_AT.forEach((at, i) => {
    const p = CRATER_P[0] + (CRATER_P[1] - CRATER_P[0]) * at, c = pointAlong(K.path, at * Lp);
    encounters.push({ x: c.x, z: c.z, p, first: false, area: 1, aliens: place(c, compose(p, i, cr), [-6, 6], [-4, 8], K.path, at * Lp, cr) });
  });
  const inCrater = (kind, at) => pick(kind, pointAlong(K.path, at * Lp), 1, () => cr.range(-2.5, 2.5), [-3, 3], cr);
  inCrater('tape', .5);
  inCrater('cells', .8);
  const last = encounters[encounters.length - 1];
  cluster3(() => {
    let vx = cr.range(-1, 1), vz = cr.range(-1, 1);
    const l = Math.sqrt(vx * vx + vz * vz) || 1, d = cr.range(5, 9);
    return { x: last.x + vx / l * d, z: last.z + vz / l * d };
  }, 1, cr);

  // Golf: its own stream too. Three balls, one per band of the route, 25-70 m to the side and by a rock where one can be found.
  const gr = makeRng(world.seed + '/golf/' + world.attempt), golf = [];
  const far = (x, z) => standable(x, z) && distToPolyline(x, z, route) >= 20;
  [[.15, .4], [.4, .65], [.65, .9]].forEach(([lo, hi], id) => {
    let spot = null, backup = null;
    for (let t = 0; t < 80 && !spot; t++) {
      const c = routeAt(gr.range(lo * Lr, hi * Lr)), sd = (gr.next() < 0.5 ? -1 : 1) * gr.range(25, 70);
      const x = c.x - c.dz * sd, z = c.z + c.dx * sd;
      if (!backup && far(x, z)) backup = { x, z };
      let rock = null, rd = 12;
      for (const k of world.rocks) { const d = dist(k, { x, z }); if (d <= rd) { rd = d; rock = k; } }
      if (!rock || rd < 1e-6) continue;
      const m = Math.max(rock.sx, rock.sz) + 1.2, sx = rock.x + (x - rock.x) / rd * m, sz = rock.z + (z - rock.z) / rd * m;
      if (far(sx, sz)) spot = { x: sx, z: sz };
    }
    if (!spot) spot = backup;
    if (!spot) {
      const c = routeAt((lo + hi) / 2 * Lr);
      for (let d = 20; d <= 70 && !spot; d++) for (const sg of [1, -1]) {
        const x = c.x - c.dz * d * sg, z = c.z + c.dx * d * sg;
        if (!spot && far(x, z)) spot = { x, z };
      }
    }
    if (!spot) throw new Error('no golf spot for seed ' + world.seed);
    golf.push({ id, x: spot.x, y: sampleGround(world, spot.x, spot.z), z: spot.z, area: 0 });
  });
  return { encounters, pickups, canisters, golf };
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
