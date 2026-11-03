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

// A planner over the surface: reach from the spawn, and the plan its helpers fill ({ encounters, pickups, canisters, golf }). Every
// helper draws from the rng it is handed, so each section of a plan keeps its own stream; pts is the polyline it plans along.
export function routePlanner(world) {
  const occ = world.occ, h = world.h, lim = HALF - MAP_MARGIN - 4;
  const reach = reachMap(occ, N, [Math.round(world.spawn.x + HALF), Math.round(world.spawn.z + HALF)], MAX_STEP, MAP_MARGIN);
  const plan = { encounters: [], pickups: [], canisters: [], golf: [] }, { encounters, pickups, canisters } = plan;
  const standable = (x, z) => {
    if (x < -lim || x > lim || z < -lim || z > lim) return false;
    const i = Math.round(x + HALF), j = Math.round(z + HALF), c = j * N + i;
    if (reach[c] !== 1 || occ[c] - h[c] >= 0.05) return false;
    const o = occ[c];
    for (const k of [c - 1, c + 1, c - N, c + N]) { const d = occ[k] - o; if ((d < 0 ? -d : d) > MAX_STEP) return false; }
    return true;
  };
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

  // R15: a canister stands 1.5 m from every alien, 1 m from every pickup and 1.2 m from every canister already placed
  // (its own cluster's members and, though they are far apart anyway, the other clusters'); with off ({x, z, r}), r m or more
  // from (x, z).
  const cluster3 = (anchorAt, area, r, off = null) => {
    const walkers = encounters.flatMap(e => e.aliens), cluster = [];
    const clear = (x, z) => {
      const q = { x, z };
      return standable(x, z) && walkers.every(a => dist(a, q) >= 1.5) && pickups.every(u => dist(u, q) >= 1) &&
        canisters.every(c => dist(c, q) >= 1.2) && cluster.every(c => dist(c, q) >= 1.2) && (!off || dist(off, q) >= off.r);
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

  // A walk along pts: an encounter about every GAP m from FIRST_AT to 8 m short of the end (each centred 12 m on), at p0 + dp times
  // the fraction of the way (firstOne: the first is a lone skitterer, flagged first); two tapes and two cell caches beside the way;
  // and canister clusters by the walk's encounters 1, 3 and its last. With off ({x, z, r}) the encounters stop short of it: the
  // last centre is 1 m before where pts first comes within r + 1 m of (x, z) (1 m steps), so every centre is r m or more from it
  // (and so is every canister), with the count spread over the shorter way at about GAP m (6 at least, as ever).
  const walk = (pts, rng, area, p0, dp, firstOne, off = null) => {
    const L = polylineLength(pts), at = (s) => pointAlong(pts, s), e0 = encounters.length;
    let end = 8;
    if (off) { let s = 0; while (s < L && dist(at(s), off) >= off.r + 1) s++; end = Math.max(end, L - s + 13); }
    const count = Math.max(5, Math.floor((L - FIRST_AT - (end - 8)) / GAP));
    for (let k = 0; k <= count; k++) {
      const s = FIRST_AT + k * (L - end - FIRST_AT) / count, p = p0 + dp * s / L, c = at(s + 12), first = firstOne && k === 0;
      const aliens = first ? place(c, ['sk'], [-4, 4], [-4, 10], pts, s + 12, rng) : place(c, compose(p, k, rng), [-14, 14], [-4, 10], pts, s + 12, rng);
      encounters.push({ x: c.x, z: c.z, p, first, area, aliens });
    }
    const onRoute = (kind, s, lo, hi, either) => {
      const sign = either && rng.next() < 0.5 ? -1 : 1;
      pick(kind, at(s), area, () => sign * rng.range(lo, hi), [-4, 4], rng);
    };
    onRoute('tape', L / 2, 10, 16, true);
    onRoute('tape', L - 45, 4, 8, false);
    onRoute('cells', 0.3 * L, 8, 14, false);
    onRoute('cells', 0.7 * L, 8, 14, false);
    const hosts = [1, 3, count].filter((v, i, a) => a.indexOf(v) === i);
    for (const ei of hosts) {
      const e = encounters[e0 + ei], d = nearestDir(pts, e.x, e.z);
      cluster3(() => {
        const side = (rng.next() < 0.5 ? -1 : 1) * rng.range(6, 10), fwd = rng.range(-4, 4);
        return { x: e.x - d.dz * side + d.dx * fwd, z: e.z + d.dx * side + d.dz * fwd };
      }, area, rng, off);
    }
  };

  // A switchback along pts: an encounter at each fraction of ats of its length, p from P[0] to P[1] by that fraction, a tape
  // halfway and a cell cache at .8, and a canister cluster 5-9 m from the last encounter.
  const switchback = (pts, rng, area, ats, P) => {
    const L = polylineLength(pts);
    ats.forEach((at, i) => {
      const p = P[0] + (P[1] - P[0]) * at, c = pointAlong(pts, at * L);
      encounters.push({ x: c.x, z: c.z, p, first: false, area, aliens: place(c, compose(p, i, rng), [-6, 6], [-4, 8], pts, at * L, rng) });
    });
    const inside = (kind, at) => pick(kind, pointAlong(pts, at * L), area, () => rng.range(-2.5, 2.5), [-3, 3], rng);
    inside('tape', .5);
    inside('cells', .8);
    const last = encounters[encounters.length - 1];
    cluster3(() => {
      let vx = rng.range(-1, 1), vz = rng.range(-1, 1);
      const l = Math.sqrt(vx * vx + vz * vz) || 1, d = rng.range(5, 9);
      return { x: last.x + vx / l * d, z: last.z + vz / l * d };
    }, area, rng);
  };

  // A golf ball for the band [lo, hi] of pts: 25-70 m to the side and by a rock where one can be found, else any spot 20 m or more
  // off pts.
  const golfIn = (gr, pts, [lo, hi], id, area) => {
    const L = polylineLength(pts), far = (x, z) => standable(x, z) && distToPolyline(x, z, pts) >= 20;
    let spot = null, backup = null;
    for (let t = 0; t < 80 && !spot; t++) {
      const c = pointAlong(pts, gr.range(lo * L, hi * L)), sd = (gr.next() < 0.5 ? -1 : 1) * gr.range(25, 70);
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
      const c = pointAlong(pts, (lo + hi) / 2 * L);
      for (let d = 20; d <= 70 && !spot; d++) for (const sg of [1, -1]) {
        const x = c.x - c.dz * d * sg, z = c.z + c.dx * d * sg;
        if (!spot && far(x, z)) spot = { x, z };
      }
    }
    if (!spot) throw new Error('no golf spot for seed ' + world.seed);
    plan.golf.push({ id, x: spot.x, y: sampleGround(world, spot.x, spot.z), z: spot.z, area });
  };
  return { standable, compose, place, pick, cluster3, golfIn, walk, switchback, plan };
}

// Level 1: the route to the rim (area 0), then the crater's switchback (area 1), then three golf balls.
export function planFight(world) {
  const P = routePlanner(world);
  P.walk(world.route, makeRng(world.seed + '/fight/' + world.attempt), 0, 0, SURFACE_P, true);
  // The crater section: its own rng stream, so the surface plan above is what it always was.
  P.switchback(world.crater.path, makeRng(world.seed + '/fight/crater/' + world.attempt), 1, CRATER_AT, CRATER_P);
  // Golf: its own stream too. Three balls, one per band of the route.
  const gr = makeRng(world.seed + '/golf/' + world.attempt);
  [[.15, .4], [.4, .65], [.65, .9]].forEach((band, id) => P.golfIn(gr, world.route, band, id, 0));
  return P.plan;
}

// The escape (Plan 6), level 1's ground walked backwards on streams of its own: the climb up the switchback (area 5), like level 1's
// crater; the dash from the rim toward the wreck (area 6) with no lone first skitterer, its encounters stopping ESCAPE.shipGap
// short of the rescue site; golf ball 6 by the dash; and the rescue site (its own stream, so placed first, as it always was).
// climbAt, climbP: the climb's encounter fractions and p range (as CRATER_AT, CRATER_P); dashP: the dash's p range; golf: golf 6's
// band of the dash; site: its range (m) from your lander; flat: the most (m) world.h may vary within 4 m of it; rockGap: m it keeps
// beyond each rock's larger of sx, sz; tries: candidate spots; shipGap: no dash encounter's centre and no dash canister comes
// within this (m) of the site, so the last stretch to the ship is the rush's alone (Task 8 fix).
export const ESCAPE = { climbAt: [.25, .6, .95], climbP: [.35, .5], dashP: [.6, 1], golf: [.4, .65], site: [20, 30], flat: .6, rockGap: 6, tries: 80, shipGap: 60 };
export function planEscape(world) {
  const P = routePlanner(world), stream = (s) => makeRng(world.seed + '/escape/' + s + '/' + world.attempt);
  const up = world.crater.path.slice().reverse(), back = world.route.slice().reverse(), site = rescueSite(world, P.standable, stream('site'));
  P.switchback(up, stream('climb'), 5, ESCAPE.climbAt, ESCAPE.climbP);
  P.walk(back, stream('dash'), 6, ESCAPE.dashP[0], ESCAPE.dashP[1] - ESCAPE.dashP[0], false, { x: site.x, z: site.z, r: ESCAPE.shipGap });
  P.golfIn(stream('golf'), back, ESCAPE.golf, 6, 6);
  return { ...P.plan, site };
}

// Where the rescue ship lands: the first candidate ESCAPE.site m from your lander that is standable, clear of rocks and flat;
// failing that, the flattest standable one. (dx, dz) is its +z, the ladder side: the unit vector toward the rim, the way you come.
function rescueSite(world, standable, r) {
  const L = world.lander, E = ESCAPE;
  const relief = (x, z) => {
    const ci = Math.round(x + HALF), cj = Math.round(z + HALF);
    let lo = Infinity, hi = -Infinity;
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (i * i + j * j <= 16) {
      const y = world.h[(cj + j) * N + ci + i]; lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    return hi - lo;
  };
  const clear = (x, z) => world.rocks.every(k => { const dx = k.x - x, dz = k.z - z; return Math.sqrt(dx * dx + dz * dz) >= E.rockGap + Math.max(k.sx, k.sz); });
  let site = null, flattest = null;
  for (let t = 0; t < E.tries && !site; t++) {
    const vx = r.range(-1, 1), vz = r.range(-1, 1), l = Math.sqrt(vx * vx + vz * vz);
    if (l < 0.05) continue;
    const d = r.range(E.site[0], E.site[1]), x = L.x + vx / l * d, z = L.z + vz / l * d;
    if (!standable(x, z)) continue;
    const f = relief(x, z);
    if (f <= E.flat && clear(x, z)) site = { x, z };
    else if (!flattest || f < flattest.f) flattest = { x, z, f };
  }
  site = site || flattest;
  if (!site) throw new Error('no rescue site for seed ' + world.seed);
  const dx = world.rim.x - site.x, dz = world.rim.z - site.z, l = Math.sqrt(dx * dx + dz * dz);
  return { x: site.x, y: sampleGround(world, site.x, site.z), z: site.z, dx: dx / l, dz: dz / l };
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
