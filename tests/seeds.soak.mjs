import { generateSurface, MAX_STEP, MAP_MARGIN } from '../src/gen/surface.js';
import { passable } from '../src/gen/passable.js';
const hist = {}; let ok = 0, fail = 0, rockMin = Infinity, rockMax = 0;
const cell = (p) => [Math.round(p.x + 256), Math.round(p.z + 256)];
for (let n = 0; n < 1000; n++) {
  const seed = 'SOAK-' + String(n).padStart(4, '0');
  try {
    const w = generateSurface(seed);
    if (passable(w.occ, 512, cell(w.spawn), cell(w.rim), MAX_STEP, MAP_MARGIN)) ok++; else fail++;
    hist[w.attempt] = (hist[w.attempt] || 0) + 1;
    rockMin = Math.min(rockMin, w.rocks.length); rockMax = Math.max(rockMax, w.rocks.length);
  } catch (e) { fail++; console.error(seed, e.message); }
}
console.log(ok + '/1000 passable');
console.log('attempt histogram', JSON.stringify(hist), 'rocks min/max', rockMin, rockMax);
process.exit(fail ? 1 : 0);
