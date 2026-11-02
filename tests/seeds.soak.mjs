import { edgeMargin } from './helpers.mjs';
import { sampleGround, distToPolyline, MAX_STEP, N, HALF, MAP_MARGIN } from '../src/gen/surface.js';
import { generateWorld } from '../src/gen/world.js';
import { CRATER } from '../src/gen/crater.js';
import { budgetAt, COST, CRATER_P, CRATER_AT } from '../src/gen/encounters.js';
import { reachMap } from '../src/gen/passable.js';
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
    if (w.attempt > 0) rerolls++;
    hist[w.attempt] = (hist[w.attempt] || 0) + 1;
    rockMin = Math.min(rockMin, w.rocks.length); rockMax = Math.max(rockMax, w.rocks.length);
  } catch (e) { fail++; console.error(seed, e.message); }
}
console.log('golf balls beside a rock', golfRock + '/' + golfAll);
const rate = rerolls / 1000;
console.log('attempt histogram', JSON.stringify(hist), 'rerolls', rerolls, 'rate', rate);
console.log('worst centreline step', worst.toFixed(4), 'worst switchback step', worstCrater.toFixed(4), 'worst edge margin', worstEdge.toFixed(3), 'rocks min/max', rockMin, rockMax, 'failures', fail);
process.exit(fail || rate > 0.05 ? 1 : 0);
