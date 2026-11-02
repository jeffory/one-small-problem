import { edgeMargin } from './helpers.mjs';
import { generateSurface, sampleGround, MAX_STEP, N, HALF, MAP_MARGIN } from '../src/gen/surface.js';
import { budgetAt, COST } from '../src/gen/encounters.js';
import { reachMap } from '../src/gen/passable.js';
const hist = {}; let rerolls = 0, fail = 0, worst = 0, rockMin = Infinity, worstEdge = Infinity, rockMax = 0;
for (let n = 0; n < 1000; n++) {
  const seed = 'SOAK-' + String(n).padStart(4, '0');
  try {
    const w = generateSurface(seed);
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
    const P = w.plan, bad = (m) => { fail++; console.error(seed, 'plan', m); };
    const reach = reachMap(w.occ, N, [Math.round(w.spawn.x + HALF), Math.round(w.spawn.z + HALF)], MAX_STEP, MAP_MARGIN), lim = HALF - MAP_MARGIN;
    const stands = (o) => Math.abs(o.x) <= lim && Math.abs(o.z) <= lim && reach[Math.round(o.z + HALF) * N + Math.round(o.x + HALF)] === 1;
    P.encounters.forEach((e, k) => {
      if (k > 0 && e.aliens.reduce((s, a) => s + COST[a.type], 0) !== budgetAt(e.p)) bad('budget ' + k);
      e.aliens.forEach((a) => { if (a.type !== 'fl' && !stands(a)) bad('alien unreachable ' + k); });
    });
    const e0 = P.encounters[0], last = P.encounters[P.encounters.length - 1];
    if (!last.aliens.some((a) => a.type === 'br')) bad('no brute at the rim');
    if (!(e0.first && e0.aliens.length === 1 && e0.aliens[0].type === 'sk')) bad('first encounter');
    if (P.pickups.filter((u) => u.kind === 'tape').length !== 2 || P.pickups.filter((u) => u.kind === 'cells').length !== 2) bad('pickup counts');
    if (P.canisters.length < 6) bad('canisters ' + P.canisters.length);
    if (!P.pickups.every(stands)) bad('pickup unreachable');
    if (!P.canisters.every(stands)) bad('canister unreachable');
    if (w.attempt > 0) rerolls++;
    hist[w.attempt] = (hist[w.attempt] || 0) + 1;
    rockMin = Math.min(rockMin, w.rocks.length); rockMax = Math.max(rockMax, w.rocks.length);
  } catch (e) { fail++; console.error(seed, e.message); }
}
const rate = rerolls / 1000;
console.log('attempt histogram', JSON.stringify(hist), 'rerolls', rerolls, 'rate', rate);
console.log('worst centreline step', worst.toFixed(4), 'worst edge margin', worstEdge.toFixed(3), 'rocks min/max', rockMin, rockMax, 'failures', fail);
process.exit(fail || rate > 0.05 ? 1 : 0);
