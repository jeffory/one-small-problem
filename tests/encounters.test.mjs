import test from 'node:test'; import assert from 'node:assert/strict';
import { sampleGround, distToPolyline, flagSpot, HALF, N, MAP_MARGIN, MAX_STEP } from '../src/gen/surface.js';
import { generateWorld } from '../src/gen/world.js';
import { planFight, budgetAt, COST, SURFACE_P } from '../src/gen/encounters.js'; import { reachMap, passable } from '../src/gen/passable.js'; import { xf, Ry } from '../src/gfx/math.js';
const W = generateWorld('APOLLO-4471'), P = W.plan, cost = e => e.aliens.reduce((s, a) => s + COST[a.type], 0), all = P.encounters.flatMap(e => e.aliens);
test('the plan is deterministic and attached to the world', () => { assert.deepEqual(planFight(generateWorld('APOLLO-4471')), P); assert.notDeepEqual(generateWorld('EAGLE-0001').plan, P); });
test('budgets grow with progress; brutes only from p 0.3; the rim has a brute', () => {
  assert.equal(budgetAt(0), 2); assert.equal(budgetAt(SURFACE_P), 7); assert.ok(P.encounters.length >= 6);
  for (const e of P.encounters.slice(1)) { assert.equal(cost(e), budgetAt(e.p)); if (e.aliens.some(a => a.type === 'br')) assert.ok(e.p >= 0.3); }
  const last = P.encounters.at(-1); assert.ok(Math.abs(last.p - SURFACE_P) < 0.02); assert.ok(last.aliens.some(a => a.type === 'br'));
  assert.ok(all.filter(a => a.type === 'fl').length >= 2); });
test('the first encounter is one skitterer near the route', () => { const e = P.encounters[0];
  assert.equal(e.first, true); assert.deepEqual(e.aliens.map(a => a.type), ['sk']); assert.ok(distToPolyline(e.aliens[0].x, e.aliens[0].z, W.route) <= 6);
  assert.ok(P.encounters.slice(1).every(x => !x.first)); });
test('every walker, pickup and canister stands on reachable open ground', () => {
  const reach = reachMap(W.occ, N, [Math.round(W.spawn.x + HALF), Math.round(W.spawn.z + HALF)], MAX_STEP, MAP_MARGIN), lim = HALF - MAP_MARGIN;
  const ok = o => { assert.ok(Math.abs(o.x) <= lim && Math.abs(o.z) <= lim); assert.equal(reach[Math.round(o.z + HALF) * N + Math.round(o.x + HALF)], 1); assert.ok(Math.abs(o.y - sampleGround(W, o.x, o.z)) < 1e-6); };
  all.filter(a => a.type !== 'fl').forEach(ok); P.pickups.forEach(ok); P.canisters.forEach(ok); });
test('floaters hover 3 to 4.5 m up', () => { for (const a of all.filter(a => a.type === 'fl')) { const h = a.y - sampleGround(W, a.x, a.z); assert.ok(h >= 3 && h <= 4.5, `h ${h}`); } });
test('two tapes, two cell caches, canisters in chainable clusters', () => {
  assert.equal(P.pickups.filter(p => p.kind === 'tape').length, 2); assert.equal(P.pickups.filter(p => p.kind === 'cells').length, 2);
  assert.ok(P.canisters.length >= 6); for (const c of P.canisters) assert.ok(P.canisters.some(d => d !== c && Math.hypot(d.x - c.x, d.z - c.z) <= 2.2)); });
test('canisters keep 1.2 m from one another and 1 m from every pickup (R15)', () => { for (const P of [W.plan, generateWorld('SOAK-0005').plan, generateWorld('SOAK-0045').plan]) {
  const C = P.canisters; assert.ok(C.length >= 6);
  for (const c of C) { for (const d of C) if (d !== c) assert.ok(Math.hypot(d.x - c.x, d.z - c.z) >= 1.2 - 1e-9); for (const u of P.pickups) assert.ok(Math.hypot(u.x - c.x, u.z - c.z) >= 1 - 1e-9); } } });
test('reachMap agrees with passable', () => { const g = new Float32Array(256); for (let j = 0; j < 16; j++) g[j * 16 + 8] = 5;
  assert.equal(reachMap(g, 16, [2, 2], 0.45)[14 * 16 + 14], 0); g[3 * 16 + 8] = 0;
  assert.equal(reachMap(g, 16, [2, 2], 0.45)[14 * 16 + 14], 1); assert.equal(passable(g, 16, [2, 2], [14, 14], 0.45), true); });
test('flagSpot matches where the scene plants the flag', () => { const { lander: L, spawn: S } = W, f = xf(Ry(Math.atan2(S.dx, S.dz)), [-4.5, 0, 3]), s = flagSpot(W);
  assert.ok(Math.abs(s.x - (L.x + f[0])) < 1e-6 && Math.abs(s.z - (L.z + f[2])) < 1e-6); });
