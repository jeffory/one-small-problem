import test from 'node:test'; import assert from 'node:assert/strict';
import { generateBase, BASE, K } from '../src/gen/base.js'; import { reachMap } from '../src/gen/passable.js';
const B = generateBase('APOLLO-4471'), n = B.n, at = o => Math.round(o.z + B.half) * n + Math.round(o.x + B.half);
const reach = reachMap(B.floor, n, [Math.round(B.start.x + B.half), Math.round(B.start.z + B.half)], BASE.step, 0);
test('same seed, same base; another seed, another base', () => { assert.deepEqual(generateBase('APOLLO-4471').floor, B.floor); assert.notDeepEqual(generateBase('EAGLE-0001').floor, B.floor); assert.equal(B.seed, 'APOLLO-4471'); });
test('8 to 12 rooms from the lift to the comms room, 3 to 5 side rooms, 1 or 2 loops', () => {
  assert.ok(B.crit.length >= 8 && B.crit.length <= 12); assert.ok(B.side.length >= 3 && B.side.length <= 5); assert.deepEqual(B.crit, B.crit.map((_, i) => i));
  const loops = B.links.filter(l => l.loop); assert.ok(loops.length >= 1 && loops.length <= 2);
  const comms = B.crit.at(-1); for (const l of loops) assert.ok(![0, comms].includes(l.a) && ![0, comms].includes(l.b)); });
test('themes run lift, hangar, lab, reactor, greenhouse, comms along the path', () => {
  assert.deepEqual(B.crit.map(r => B.rooms[r].theme).filter(t => t !== 'plain'), ['lift', 'hangar', 'lab', 'reactor', 'greenhouse', 'comms']);
  for (const r of B.side) assert.equal(B.rooms[r].theme, 'side'); });
test('the comms room is the largest, with cover, 3 or 4 spawn doors and one way in', () => {
  const area = r => (r.x1 - r.x0) * (r.z1 - r.z0), c = B.rooms[B.crit.at(-1)]; for (const r of B.rooms) if (r !== c) assert.ok(area(r) < area(c));
  let cover = 0; for (let k = 0; k < n * n; k++) if (B.room[k] === c.id && B.kind[k] === K.cover) cover++; assert.ok(cover >= 8, `cover ${cover}`);
  assert.ok(B.spawnDoors.length >= 3 && B.spawnDoors.length <= 4); assert.equal(B.links.filter(l => l.a === c.id || l.b === c.id).length, 1);
  for (const d of B.spawnDoors) { assert.equal(B.room[at(d)], c.id); assert.equal(B.room[at({ x: d.x + d.dx, z: d.z + d.dz })], c.id); assert.equal(B.ceil[at(d)], Math.fround(BASE.lintel)); } }); // pre-flight F6: ceil is a Float32Array
test('every floor tile is reachable from the lift, the comms door included (Review Focus 3)', () => {
  for (let k = 0; k < n * n; k++) if (B.kind[k] === K.floor) assert.equal(reach[k], 1, `tile ${k % n}, ${k / n | 0}`);
  assert.equal(reach[at(B.commsDoor)], 1); assert.equal(B.kind[at(B.start)], K.floor); assert.equal(Math.abs(B.start.dx) + Math.abs(B.start.dz), 1); });
test('walls are solid, walkable tiles have headroom, corridors are 3 wide, the edge is sealed', () => {
  for (let k = 0; k < n * n; k++) { if (B.kind[k] === K.wall) assert.ok(B.floor[k] >= BASE.wall && B.ceil[k] === 0); if (B.kind[k] === K.floor) assert.ok(B.ceil[k] - B.floor[k] >= BASE.minHead); }
  for (const l of B.links) assert.ok([l.x1 - l.x0, l.z1 - l.z0].includes(BASE.corridor), 'corridor width'); // pre-flight F5: 3 across, 2 to 8 long
  for (let i = 0; i < n; i++) for (const k of [i, (n - 1) * n + i, i * n, i * n + n - 1]) assert.equal(B.kind[k], K.wall); });
test('set pieces stand in their themed rooms; glow strips stay rare', () => { const th = p => B.rooms[B.room[at(p)]]?.theme;
  for (const [kind, theme] of [['saucer', 'hangar'], ['jarRover', 'lab'], ['jarProbe', 'lab'], ['core', 'reactor'], ['bed', 'greenhouse'], ['dish', 'comms'], ['lift', 'lift']])
    assert.ok(B.props.some(p => p.kind === kind && th(p) === theme), kind);
  const strips = B.props.filter(p => p.kind === 'strip'); assert.equal(strips.length, Math.floor(.4 * (B.rooms.length - 2)));
  assert.equal(new Set(strips.map(p => B.room[at({ x: p.x + p.dx, z: p.z + p.dz })])).size, strips.length); });
test('re-roll: reseeds per attempt and throws when nothing is accepted (Review Focus 3)', () => {
  const r = generateBase('APOLLO-4471', b => b.attempt >= 2); assert.ok(r.attempt >= 2); assert.notDeepEqual(r.floor, B.floor); // pre-flight F23: attempt 2 may fail to construct
  assert.throws(() => generateBase('NOPE-0001', () => false), /no base layout for seed NOPE-0001/); });
test('re-rolls run to 32 attempts, so no seed is left without a base (ruling R2)', () => {
  assert.equal(BASE.attempts, 32); const r = generateBase('APOLLO-4471', b => b.attempt >= 8); assert.ok(r.attempt >= 8 && r.attempt < BASE.attempts);
  for (const s of ['APOLLO-2428', 'EAGLE-7587', 'ORION-6034', 'CRATER-7635', 'MERCURY-5618', 'TITAN-0038']) { const b = generateBase(s); assert.equal(b.seed, s); assert.ok(b.attempt >= 8, `${s} attempt ${b.attempt}`); } });
test('base generation is quick', () => { const t = performance.now(); for (let i = 0; i < 50; i++) generateBase('SPEED-' + i); assert.ok(performance.now() - t < 1000); });
import { generateWorld } from '../src/gen/world.js'; import { checksumWorld } from '../src/gen/checksum.js';
import { LIGHT, LIGHT_CAP, LAMP_DROP, BASE_SCALE } from '../src/gen/baseplan.js'; import { budgetAt, COST } from '../src/gen/encounters.js';
const WW = generateWorld('APOLLO-4471'), M = WW.baseMap, P = M.plan, cost = e => e.aliens.reduce((s, a) => s + COST[a.type], 0);
const tm = o => Math.round(o.z + M.half) * M.n + Math.round(o.x + M.half), rm = reachMap(M.floor, M.n, [Math.round(M.start.x + M.half), Math.round(M.start.z + M.half)], BASE.step, 0);
const room = t => M.rooms.find(r => r.theme === t).id;
test('one encounter per room between the lift and the comms room, p rising from .5 toward 1, scaled budgets, brutes in even rooms and late', () => {
  const L = M.crit.length; assert.equal(P.encounters.length, L - 2);
  P.encounters.forEach((e, i) => { const k = i + 1; assert.deepEqual([e.room, e.area, e.first], [k, 2, false]); assert.ok(Math.abs(e.p - (.5 + .5 * k / (L - 1))) < 1e-9);
    assert.equal(cost(e), Math.floor(budgetAt(e.p) * BASE_SCALE)); assert.equal(e.aliens.some(a => a.type === 'br'), k % 2 === 0 || e.p >= .8, `room ${k}`); }); });
test('aliens stand on reachable floor of their own room; floaters only under tall ceilings, well below them (Review Focus 3)', () => {
  for (const e of P.encounters) for (const a of e.aliens) { const t = tm(a); assert.equal(M.room[t], e.room); assert.equal(M.kind[t], K.floor); assert.equal(rm[t], 1);
    if (a.type === 'fl') { assert.ok(M.ceil[t] - M.floor[t] >= 4.5); assert.ok(a.y - M.floor[t] >= 1.8 && a.y - M.floor[t] <= 2.4); } else assert.equal(a.y, M.floor[t]); } });
test('tape in every side room and before every brute room, cells in the hangar and reactor, canister clusters there and in the greenhouse', () => {
  const n = (r, kind) => P.pickups.filter(q => q.kind === kind && M.room[tm(q)] === r).length;
  for (const r of M.side) assert.ok(n(r, 'tape') >= 1, `side room ${r}`);
  P.encounters.forEach((e, i) => { if (i > 0 && e.aliens.some(a => a.type === 'br')) assert.ok(n(i, 'tape') >= 1, `tape before room ${i + 1}`); });
  assert.ok(n(room('hangar'), 'cells') >= 1 && n(room('reactor'), 'cells') >= 1);
  for (const t of ['hangar', 'reactor', 'greenhouse']) assert.ok(P.canisters.filter(c => M.room[tm(c)] === room(t)).length >= 2, t);
  for (const q of [...P.pickups, ...P.canisters]) { assert.equal(q.area, 2); assert.equal(rm[tm(q)], 1); } });
test('two golf balls in the first two side rooms, reachable (Review Focus 3)', () => { assert.deepEqual(P.golf.map(g => [g.id, g.area]), [[3, 2], [4, 2]]);
  P.golf.forEach((g, i) => { assert.equal(M.room[tm(g)], M.side[i]); assert.equal(rm[tm(g)], 1); assert.equal(g.y, M.floor[tm(g)]); }); });
test('lamps: amber and teal pools, a pulsing core, red flicker at the spawn doors, at most LIGHT_CAP on any tile, a steady lamp in every room', () => { const Ls = M.lights;
  assert.ok(Ls.some(l => l.kind === 2 && M.room[tm(l)] === room('reactor'))); assert.ok(Ls.filter(l => l.kind === 1).length >= M.spawnDoors.length);
  const cols = new Set(Ls.filter(l => !l.kind).map(l => l.col.join())); assert.ok(cols.has(LIGHT.amber.col.join()) && cols.has(LIGHT.teal.col.join()));
  for (let k = 0; k < M.n * M.n; k++) if (M.kind[k] === K.floor) for (const up of [1.7, 2.4]) { const x = k % M.n - M.half, z = (k / M.n | 0) - M.half, y = M.floor[k] + up; // pre-flight F28
    assert.ok(Ls.filter(l => Math.hypot(l.x - x, l.y - y, l.z - z) < l.r).length <= LIGHT_CAP, `tile ${x}, ${z} at +${up}`); }
  for (const r of M.rooms) assert.ok(Ls.some(l => l.kind === 0 && M.room[tm(l)] === r.id), `room ${r.id} (${r.theme}) has no steady lamp`); }); // R16: the cap may refuse lamps, never a room's last
// R16: a 2D sight line over the tile grid, sampled every 2 cm from (x, z) to tile t's centre; any wall tile on it blocks.
const sees = (B, x, z, t) => { const bx = t % B.n - B.half, bz = (t / B.n | 0) - B.half, s = Math.ceil(Math.hypot(bx - x, bz - z) / .02);
  for (let k = 1; k < s; k++) if (B.kind[Math.round(z + (bz - z) * k / s + B.half) * B.n + Math.round(x + (bx - x) * k / s + B.half)] === K.wall) return false; return true; };
test('room lamps hang at the look test height, and no lamp reaches a walkable tile it cannot see, so light never passes through a wall (R16)', () => {
  assert.equal(LAMP_DROP, 2.65); for (const l of M.lights) { const r = M.rooms[M.room[tm(l)]]; if (!l.kind && r) assert.equal(l.y, r.floor + LAMP_DROP, `lamp at ${l.x}, ${l.z}`); }
  for (const l of M.lights) for (let t = 0; t < M.n * M.n; t++) { if (M.kind[t] === K.wall) continue;
    const dx = Math.max(0, Math.abs(l.x - (t % M.n - M.half)) - .5), dz = Math.max(0, Math.abs(l.z - ((t / M.n | 0) - M.half)) - .5);
    if (Math.hypot(dx, dz) < l.r - 1e-9) assert.ok(sees(M, l.x, l.z, t), `lamp at ${l.x}, ${l.z} (r ${l.r}) reaches tile ${t % M.n}, ${t / M.n | 0} behind a wall`); } });
// R16: the world shader's own lighting for a floor point (squared falloff, the cosine to the up normal, ambient .012-.013, 14 bands), with
// each lamp at full colour (the core at its mean pulse, .7), averaged over the channels; band 1 is the first lit step.
const bandAt = (B, t) => { const x = t % B.n - B.half, z = (t / B.n | 0) - B.half, y = B.floor[t]; let s = (.012 + .013 + .012) / 3;
  for (const l of B.lights) { const dx = l.x - x, dy = l.y - y, dz = l.z - z, d = Math.hypot(dx, dy, dz), k = Math.max(0, 1 - d / l.r);
    if (k > 0 && dy > 0) s += (l.col[0] + l.col[1] + l.col[2]) / 3 * (l.kind === 2 ? .7 : 1) * k * k * dy / d; }
  return Math.floor(s * 14 + .5); };
test('the lamps light the floor: at least 60% of walkable tiles reach band 1 on three seeds (R16)', () => {
  for (const seed of ['APOLLO-4471', 'EAGLE-0001', 'SOAK-0042']) { const B = seed === 'APOLLO-4471' ? M : generateWorld(seed).baseMap; let lit = 0, all = 0;
    for (let t = 0; t < B.n * B.n; t++) if (B.kind[t] === K.floor) { all++; if (bandAt(B, t) >= 1) lit++; }
    assert.ok(lit / all >= .6, `${seed}: ${(100 * lit / all).toFixed(1)}% of walkable tiles lit`); } });
test('generateWorld carries the base, and the checksum covers it', () => { const a = generateWorld('APOLLO-4471'); assert.equal(checksumWorld(a), checksumWorld(WW));
  a.baseMap.lights[0].r += .5; assert.notEqual(checksumWorld(a), checksumWorld(WW)); });
