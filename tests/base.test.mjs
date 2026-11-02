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
test('base generation is quick', () => { const t = performance.now(); for (let i = 0; i < 50; i++) generateBase('SPEED-' + i); assert.ok(performance.now() - t < 1000); });
