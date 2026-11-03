import test from 'node:test'; import assert from 'node:assert/strict'; import { generateWorld } from '../src/gen/world.js'; import { reachMap } from '../src/gen/passable.js';
import { generateBase, baseAccept, BASE, PRISON_PLAN, THEMES, PROPS, K } from '../src/gen/base.js'; import { buildBaseMeshes } from '../src/game/baseMesh.js';
const W = generateWorld('APOLLO-4471'), P = W.prisonMap, n = P.n, h = P.half, tile = o => Math.round(o.z + h) * n + Math.round(o.x + h);
test('the prison: own stream; cell, cellblock, guard, interro, evidence, hall in order; 2-3 side rooms; one loop', () => {
  assert.deepEqual(THEMES.slice(0, 8), ['plain', 'side', 'lift', 'hangar', 'lab', 'reactor', 'greenhouse', 'comms']); assert.deepEqual(PROPS.slice(0, 9), ['lift', 'saucer', 'jarRover', 'jarProbe', 'jar', 'core', 'bed', 'dish', 'strip']);
  assert.equal(P.cfg, PRISON_PLAN); assert.deepEqual(generateBase('APOLLO-4471', baseAccept, PRISON_PLAN).floor, P.floor); assert.notDeepEqual(P.floor, W.baseMap.floor);
  assert.ok(P.crit.length >= 6 && P.crit.length <= 8 && P.side.length >= 2 && P.side.length <= 3); assert.equal(P.links.filter(l => l.loop).length, 1);
  assert.equal(P.crit.map(r => P.rooms[r].theme).filter(t => t !== 'plain').join(), 'cell,cellblock,guard,interro,evidence,hall'); });
test('the cell: 5 x 5, low; its only doorway is the three bar tiles; all floor reachable once they open', () => {
  const c = P.rooms[0], b = P.bars; assert.deepEqual([c.x1 - c.x0, c.z1 - c.z0, c.ceil], [5, 5, BASE.ceil.cell]); assert.ok(BASE.ceil.cell < 3);
  assert.equal(b.tiles.length, 3); assert.deepEqual([b.dx, b.dz], [P.start.dx, P.start.dz]);
  for (const t of b.tiles) assert.ok(P.kind[t] === K.floor && P.room[t] < 0 && Math.hypot(t % n - h - b.x, (t / n | 0) - h - b.z) <= 1 + 1e-9);
  const shut = P.floor.slice(); for (const t of b.tiles) shut[t] = BASE.wall;
  const r = reachMap(shut, n, [Math.round(P.start.x + h), Math.round(P.start.z + h)], BASE.step, 0); let k = 0;
  for (let t = 0; t < n * n; t++) if (r[t] === 1) { assert.equal(P.room[t], 0); k++; } assert.equal(k, 25); assert.ok(baseAccept(P)); });
test('the cell block: 15 x 8, barred alcoves nobody walks into, one holding the cow', () => {
  const r = P.rooms[1], bars = P.props.filter(q => q.kind === 'bars'), cow = P.props.filter(q => q.kind === 'cow'), w = r.x1 - r.x0, d = r.z1 - r.z0;
  assert.deepEqual([r.theme, Math.max(w, d), Math.min(w, d)], ['cellblock', 15, 8]); assert.ok(bars.length >= 2); assert.equal(cow.length, 1);
  for (const q of bars) { const ux = Math.abs(q.dz), uz = Math.abs(q.dx); assert.equal(q.w, 2);
    for (const s of [-.5, .5]) { const t = tile({ x: q.x - q.dx * .5 + ux * s, z: q.z - q.dz * .5 + uz * s }); assert.ok(P.kind[t] === K.prop && P.room[t] === 1 && P.floor[t] >= BASE.wall); } }
  assert.ok(bars.some(q => Math.hypot(q.x - q.dx * .5 - cow[0].x, q.z - q.dz * .5 - cow[0].z) < .6)); });
test('the lift hall: 20 x 20, the exit lift raised at its centre, crates, no spawn doors, the only red lamps', () => {
  const r = P.rooms[P.crit.at(-1)], e = P.props.find(q => q.kind === 'exit');
  assert.deepEqual([r.theme, r.x1 - r.x0, r.z1 - r.z0, P.spawnDoors.length], ['hall', 20, 20, 0]); assert.deepEqual([e.x, e.z], [(r.x0 + r.x1 - 1) / 2 - h, (r.z0 + r.z1 - 1) / 2 - h]);
  assert.equal(P.floor[tile(e)], Math.fround(.3)); assert.ok(P.kind.some((k, t) => k === K.cover && P.room[t] === r.id));
  const red = P.lights.filter(l => l.kind === 1); assert.ok(red.length > 0 && red.every(l => P.room[tile(l)] === r.id)); });
// Final review FR3: crates keep off the exit lift's dais (the hall's centred 4 x 4 at +.3) and a one-tile ring round it, and the
// dais is floor again once they are placed. Before the fix a crate stood on the dais on 36% of seeds (on the lift's own centre
// tiles on BOT-0000, BOT-0004 and BOT-0008), so the bot had to find floor beside the lift.
test('no crate on the exit lift dais or the one-tile ring round it; the dais is floor at +.3', () => {
  for (const s of ['APOLLO-4471', 'BOT-0000', 'BOT-0004', 'BOT-0008']) {
    const B = s === 'APOLLO-4471' ? P : generateBase(s, baseAccept, PRISON_PLAN), e = B.props.find(q => q.kind === 'exit'), off = t => Math.max(Math.abs(t % n - h - e.x), Math.abs((t - t % n) / n - h - e.z));
    for (let t = 0; t < n * n; t++) { if (B.kind[t] === K.cover) assert.ok(off(t) > 2.5, `${s}: a crate ${off(t) <= 1.5 ? 'on' : 'by'} the dais`);
      if (off(t) <= 1.5) assert.deepEqual([B.kind[t], B.floor[t]], [K.floor, Math.fround(.3)], s); } } });
test('the prison plan: the guard first; a brute in the guard room; golf 5, tape and cells in evidence; p .4-.9; area 4', () => {
  const L = P.crit.length, E = P.plan.encounters, g = E[0], in1 = P.rooms[1].in, ev = P.rooms.find(r => r.theme === 'evidence'), inEv = q => P.room[tile(q)] === ev.id;
  assert.deepEqual([g.first, g.guard, g.room, g.area, g.x, g.z, g.aliens.map(a => [a.type, a.x, a.z])], [true, true, 1, 4, in1.x, in1.z, [['sk', in1.x, in1.z]]]);
  assert.equal(E.length, L - 1); E.slice(1).forEach((e, i) => { assert.equal(e.room, i + 1); assert.ok(Math.abs(e.p - (.4 + .5 * (i + 1) / (L - 1))) < 1e-9 && !e.first); });
  assert.ok(E.find(e => P.rooms[e.room].theme === 'guard').aliens.some(a => a.type === 'br'));
  assert.deepEqual(P.plan.golf.map(b => [b.id, inEv(b)]), [[5, true]]); assert.ok(['tape', 'cells'].every(k => P.plan.pickups.some(q => q.kind === k && inEv(q))));
  for (const q of [...E, ...P.plan.pickups, ...P.plan.canisters, ...P.plan.golf]) assert.equal(q.area, 4); });
test('the prison meshes: every new prop builds finite geometry, and the hall alarm lamps get a fixture', () => {
  const kinds = new Set(P.props.map(q => q.kind)); for (const k of ['bars', 'cow', 'chair', 'shelf', 'exit']) assert.ok(kinds.has(k), k);
  const { shell, props } = buildBaseMeshes(P); for (const m of [shell, props]) { assert.ok(m.pos.length > 0); assert.ok(m.pos.every(Number.isFinite)); }
  const bare = buildBaseMeshes({ ...P, lights: P.lights.filter(l => l.kind !== 1) }).props.pos.length;
  assert.ok(props.pos.length > bare); });
