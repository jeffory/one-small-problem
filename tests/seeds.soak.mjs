import { edgeMargin } from './helpers.mjs';
import { generateSurface, sampleGround, MAX_STEP } from '../src/gen/surface.js';
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
    if (w.attempt > 0) rerolls++;
    hist[w.attempt] = (hist[w.attempt] || 0) + 1;
    rockMin = Math.min(rockMin, w.rocks.length); rockMax = Math.max(rockMax, w.rocks.length);
  } catch (e) { fail++; console.error(seed, e.message); }
}
const rate = rerolls / 1000;
console.log('attempt histogram', JSON.stringify(hist), 'rerolls', rerolls, 'rate', rate);
console.log('worst centreline step', worst.toFixed(4), 'worst edge margin', worstEdge.toFixed(3), 'rocks min/max', rockMin, rockMax, 'failures', fail);
process.exit(fail || rate > 0.05 ? 1 : 0);
