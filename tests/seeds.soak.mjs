import { edgeMargin } from './helpers.mjs';
import { sampleGround, distToPolyline, MAX_STEP, N, HALF, MAP_MARGIN } from '../src/gen/surface.js';
import { generateWorld } from '../src/gen/world.js';
import { CRATER } from '../src/gen/crater.js';
import { budgetAt, COST, CRATER_P, CRATER_AT } from '../src/gen/encounters.js';
import { reachMap } from '../src/gen/passable.js';
import { BASE, K as TILE } from '../src/gen/base.js';
import { LIGHT_CAP, BASE_SCALE } from '../src/gen/baseplan.js';
import { HOLD, dishOf, callSpot } from '../src/game/hold.js';
// The base comes from generateWorld, one per seed: a layout that fails to construct or is rejected re-rolls, and that is
// routine (pre-flight F7: printed, not gated). Only a seed that exhausts all BASE.attempts (32) attempts fails the soak,
// because generateBase then throws (ruling R2).
const T0 = Date.now();
const bhist = {}; let brerolls = 0, ghDropped = 0;
const THEME_ORDER = 'lift,hangar,lab,reactor,greenhouse,comms', inRange = (v, r) => v >= r[0] && v <= r[1];
function checkBase(seed, B, golfSurface) {
  const bad = (m) => { fail++; console.error(seed, 'base', m); };
  {
    const n = B.n, h = B.half, at = (o) => Math.round(o.z + h) * n + Math.round(o.x + h);
    const reach = reachMap(B.floor, n, [Math.round(B.start.x + h), Math.round(B.start.z + h)], BASE.step, 0);
    let lost = 0; for (let k = 0; k < n * n; k++) if (B.kind[k] === TILE.floor && reach[k] !== 1) lost++;
    if (lost) bad(lost + ' floor tiles unreachable');
    if (reach[at(B.commsDoor)] !== 1) bad('comms door unreachable');
    if (!inRange(B.crit.length, BASE.crit) || !inRange(B.side.length, BASE.side) || !inRange(B.links.filter((l) => l.loop).length, BASE.loops)) bad('room counts');
    if (B.crit.map((r) => B.rooms[r].theme).filter((t) => t !== 'plain').join() !== THEME_ORDER || B.side.some((r) => B.rooms[r].theme !== 'side')) bad('theme order');
    const area = (r) => (r.x1 - r.x0) * (r.z1 - r.z0), c = B.rooms[B.crit[B.crit.length - 1]];
    if (B.rooms.some((r) => r !== c && area(r) >= area(c))) bad('comms room not the largest');
    if (B.spawnDoors.length < 3 || B.spawnDoors.length > 4) bad('spawn doors ' + B.spawnDoors.length);
    for (const l of B.links) { // 3 across; the length (2 to 8) runs along whichever axis separates the two rooms (pre-flight F5)
      const A = B.rooms[l.a], C = B.rooms[l.b], xl = A.x1 <= C.x0 || C.x1 <= A.x0, across = xl ? l.z1 - l.z0 : l.x1 - l.x0, len = xl ? l.x1 - l.x0 : l.z1 - l.z0;
      if (across !== BASE.corridor || len < 2 || len > 8) bad(`corridor ${l.a}-${l.b} ${across} across, ${len} long`);
    }
    for (let i = 0; i < n; i++) if ([i, (n - 1) * n + i, i * n, i * n + n - 1].some((k) => B.kind[k] !== TILE.wall)) { bad('edge not sealed'); break; }
    if (B.attempt > 0) brerolls++;
    bhist[B.attempt] = (bhist[B.attempt] || 0) + 1;
    const P = B.plan, L = B.crit.length, tile = (o) => Math.round(o.z + h) * n + Math.round(o.x + h), stand = (o, r) => B.room[tile(o)] === r && B.kind[tile(o)] === TILE.floor && reach[tile(o)] === 1;
    if (P.encounters.length !== L - 2) bad('encounters ' + P.encounters.length);
    P.encounters.forEach((e, i) => {
      const k = i + 1, cost = e.aliens.reduce((s, a) => s + COST[a.type], 0);
      if (e.room !== k || e.area !== 2) bad('encounter room ' + k);
      if (Math.abs(e.p - (.5 + .5 * k / (L - 1))) > 1e-9) bad('base p ' + k);
      if (cost !== Math.floor(budgetAt(e.p) * BASE_SCALE)) bad('base budget ' + k);
      if (e.aliens.some((a) => a.type === 'br') !== (k % 2 === 0 || e.p >= .8)) bad('brute rule ' + k);
      for (const a of e.aliens) {
        if (!stand(a, k)) bad('alien off reachable floor, room ' + k);
        if (a.type === 'fl' && B.ceil[tile(a)] - B.floor[tile(a)] < 4.5) bad('floater under a low ceiling, room ' + k);
      }
    });
    const tapeIn = (r) => P.pickups.some((u) => u.kind === 'tape' && stand(u, r));
    for (const r of B.side) if (!tapeIn(r)) bad('no tape in side room ' + r);
    P.encounters.forEach((e, i) => { if (i > 0 && e.aliens.some((a) => a.type === 'br') && !tapeIn(i)) bad('no tape before brute room ' + (i + 1)); });
    for (const q of [...P.pickups, ...P.canisters]) if (q.area !== 2 || !stand(q, B.room[tile(q)])) bad('pickup or canister off reachable floor');
    if (P.golf.length !== 2 || P.golf.some((g, i) => g.id !== 3 + i || g.area !== 2 || !stand(g, B.side[i]))) bad('base golf');
    if (golfSurface + P.golf.length !== 5) bad('golf balls in all');
    // A cluster with fewer than 2 canisters is dropped by design; beds leave the greenhouse few clear tiles, so its drops are counted, not failed.
    for (const t of ['hangar', 'reactor', 'greenhouse']) if (P.canisters.filter((c) => B.rooms[B.room[tile(c)]].theme === t).length < 2) { if (t === 'greenhouse') ghDropped++; else bad('canister cluster in ' + t); }
    for (let k = 0; k < n * n; k++) if (B.kind[k] === TILE.floor) for (const up of [1.7, 2.4]) {
      const x = k % n - h, z = (k - k % n) / n - h, y = B.floor[k] + up;
      let c = 0; for (const l of B.lights) { const dx = l.x - x, dy = l.y - y, dz = l.z - z; if (dx * dx + dy * dy + dz * dz < l.r * l.r) c++; }
      if (c > LIGHT_CAP) { bad('LIGHT_CAP exceeded ' + c); break; }
    }
    for (const r of B.rooms) if (!B.lights.some((l) => l.kind === 0 && B.room[tile(l)] === r.id)) bad('no steady lamp in room ' + r.id + ' ' + r.theme);
    // The final stand (Task 5): the array, the call spot beside it, the dais supplies and the spawn doors, all on comms room floor.
    const cr = B.crit[L - 1], dish = dishOf(B), floorAt = (o) => B.kind[tile(o)] === TILE.floor;
    if (!dish) bad('no dish');
    else {
      if (!stand(callSpot(B), cr)) bad('call spot off reachable comms room floor');
      const spots = HOLD.spots.filter(([u, v]) => floorAt({ x: dish.x + u, z: dish.z + v })).length;
      if (spots < HOLD.tape + HOLD.cells) bad('supply spots on floor ' + spots);
    }
    for (const d of B.spawnDoors) if (!floorAt(d) || B.room[tile(d)] !== cr) bad('spawn door off comms room floor');
    // R16: no lamp reaches a walkable tile it cannot see (a 2D sight line to the tile's centre, sampled every 5 cm; wall tiles block).
    for (const l of B.lights) {
      const fx = l.x + h, fz = l.z + h, R = Math.ceil(l.r) + 1; let leak = false;
      for (let j = Math.max(0, Math.floor(fz) - R); j <= Math.min(n - 1, Math.floor(fz) + R) && !leak; j++) for (let i = Math.max(0, Math.floor(fx) - R); i <= Math.min(n - 1, Math.floor(fx) + R) && !leak; i++) {
        if (B.kind[j * n + i] === TILE.wall) continue;
        const dx = Math.max(0, Math.abs(fx - i) - .5), dz = Math.max(0, Math.abs(fz - j) - .5); if (Math.sqrt(dx * dx + dz * dz) >= l.r - 1e-9) continue;
        const s = Math.ceil(Math.hypot(i - fx, j - fz) / .05);
        for (let k = 1; k < s; k++) if (B.kind[Math.round(fz + (j - fz) * k / s) * n + Math.round(fx + (i - fx) * k / s)] === TILE.wall) { leak = true; break; }
      }
      if (leak) { bad('lamp reaches a tile behind a wall'); break; }
    }
  }
}
const hist = {}; let rerolls = 0, fail = 0, worst = 0, worstCrater = 0, rockMin = Infinity, worstEdge = Infinity, rockMax = 0, golfAll = 0, golfRock = 0;
for (let n = 0; n < 1000; n++) {
  const seed = 'SOAK-' + String(n).padStart(4, '0');
  try {
    const w = generateWorld(seed);
    let seedWorst = 0;
    for (let k = 0; k + 1 < w.route.length; k++) {
      const [ax, az] = w.route[k], [bx, bz] = w.route[k + 1], m = Math.ceil(Math.hypot(bx - ax, bz - az));
      let prev = sampleGround(w, ax, az);
      for (let i = 1; i <= m; i++) {
        const t = i / m, v = sampleGround(w, ax + (bx - ax) * t, az + (bz - az) * t);
        seedWorst = Math.max(seedWorst, Math.abs(v - prev)); prev = v;
      }
    }
    worst = Math.max(worst, seedWorst);
    if (seedWorst > MAX_STEP) { fail++; console.error(seed, 'centreline step', seedWorst); }
    const em = edgeMargin(w); worstEdge = Math.min(worstEdge, em);
    if (em < 0) { fail++; console.error(seed, 'edge margin', em); }
    const K = w.crater, kc = [Math.round(K.use.x + HALF), Math.round(K.use.z + HALF)];
    let kWorst = 0;
    for (let k = 0; k + 1 < K.path.length; k++) {
      const [ax, az] = K.path[k], [bx, bz] = K.path[k + 1], m = Math.ceil(Math.hypot(bx - ax, bz - az));
      let prev = sampleGround(w, ax, az);
      for (let i = 1; i <= m; i++) {
        const t = i / m, v = sampleGround(w, ax + (bx - ax) * t, az + (bz - az) * t);
        kWorst = Math.max(kWorst, Math.abs(v - prev)); prev = v;
      }
    }
    worstCrater = Math.max(worstCrater, kWorst);
    if (kWorst > MAX_STEP) { fail++; console.error(seed, 'switchback step', kWorst); }
    if (w.rocks.some((r) => distToPolyline(r.x, r.z, K.path) <= CRATER.half + Math.max(r.sx, r.sz))) { fail++; console.error(seed, 'rock on the switchback'); }
    const P = w.plan, bad = (m) => { fail++; console.error(seed, 'plan', m); };
    const reach = reachMap(w.occ, N, [Math.round(w.spawn.x + HALF), Math.round(w.spawn.z + HALF)], MAX_STEP, MAP_MARGIN), lim = HALF - MAP_MARGIN;
    if (reach[kc[1] * N + kc[0]] !== 1) { fail++; console.error(seed, 'door unreachable'); }
    const stands = (o) => Math.abs(o.x) <= lim && Math.abs(o.z) <= lim && reach[Math.round(o.z + HALF) * N + Math.round(o.x + HALF)] === 1;
    P.encounters.forEach((e, k) => {
      if (e.area === 0 && k > 0 && e.aliens.reduce((s, a) => s + COST[a.type], 0) !== budgetAt(e.p)) bad('budget ' + k);
      e.aliens.forEach((a) => { if (a.type !== 'fl' && !stands(a)) bad('alien unreachable ' + k); });
    });
    const S = P.encounters.filter((e) => e.area === 0), Cr = P.encounters.filter((e) => e.area === 1), e0 = S[0], last = S[S.length - 1];
    if (!last.aliens.some((a) => a.type === 'br')) bad('no brute at the rim');
    if (!(e0.first && e0.aliens.length === 1 && e0.aliens[0].type === 'sk')) bad('first encounter');
    const cnt = (a, kd) => P.pickups.filter((u) => u.area === a && u.kind === kd).length;
    if ([cnt(0, 'tape'), cnt(0, 'cells'), cnt(1, 'tape'), cnt(1, 'cells')].join() !== '2,2,1,1' || P.pickups.length !== 6) bad('pickup counts');
    if (Cr.length !== CRATER_AT.length) bad('crater encounters ' + Cr.length);
    Cr.forEach((e, i) => {
      if (Math.abs(e.p - (CRATER_P[0] + (CRATER_P[1] - CRATER_P[0]) * CRATER_AT[i])) > 1e-9) bad('crater p ' + i);
      if (e.aliens.reduce((s, a) => s + COST[a.type], 0) !== budgetAt(e.p)) bad('crater budget ' + i);
      if (!e.aliens.some((a) => a.type === 'br')) bad('crater brute ' + i);
      e.aliens.forEach((a) => { if (a.type !== 'fl' && !stands(a)) bad('crater alien unreachable ' + i); });
    });
    if (P.canisters.filter((c) => c.area === 1).length < 2) bad('crater canisters');
    if (P.golf.length !== 3) bad('golf count');
    for (const b of P.golf) {
      if (!stands(b)) bad('golf unreachable ' + b.id);
      if (distToPolyline(b.x, b.z, w.route) < 20) bad('golf near route ' + b.id);
      golfAll++; if (w.rocks.some((k) => Math.hypot(k.x - b.x, k.z - b.z) <= Math.max(k.sx, k.sz) + 1.5)) golfRock++;
    }
    if (P.canisters.length < 6) bad('canisters ' + P.canisters.length);
    if (!P.pickups.every(stands)) bad('pickup unreachable');
    if (!P.canisters.every(stands)) bad('canister unreachable');
    const C = P.canisters, gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    if (C.some((c, i) => C.some((d, j) => j > i && gap(c, d) < 1.2))) bad('canisters closer than 1.2 m');
    if (C.some((c) => P.pickups.some((u) => gap(c, u) < 1))) bad('canister within 1 m of a pickup');
    checkBase(seed, w.baseMap, P.golf.length);
    if (w.attempt > 0) rerolls++;
    hist[w.attempt] = (hist[w.attempt] || 0) + 1;
    rockMin = Math.min(rockMin, w.rocks.length); rockMax = Math.max(rockMax, w.rocks.length);
  } catch (e) { fail++; console.error(seed, e.message); }
}
console.log('base attempt histogram', JSON.stringify(bhist), 'rerolls', brerolls, 'rate', brerolls / 1000);
console.log('greenhouse canister clusters dropped', ghDropped + '/1000');
console.log('golf balls beside a rock', golfRock + '/' + golfAll);
const rate = rerolls / 1000;
console.log('attempt histogram', JSON.stringify(hist), 'rerolls', rerolls, 'rate', rate);
console.log('worst centreline step', worst.toFixed(4), 'worst switchback step', worstCrater.toFixed(4), 'worst edge margin', worstEdge.toFixed(3), 'rocks min/max', rockMin, rockMax, 'failures', fail);
console.log('soak wall time', ((Date.now() - T0) / 1000).toFixed(1) + ' s');
process.exit(fail || rate > 0.05 ? 1 : 0);
