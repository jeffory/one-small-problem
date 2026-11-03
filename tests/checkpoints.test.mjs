import test from 'node:test'; import assert from 'node:assert/strict';
import { generateWorld } from '../src/gen/world.js'; import { GRAVITY, areaStart } from '../src/game/areas.js'; import { give } from '../src/game/weapons.js';
import { createFight, stepFight, hurtPlayer, enterArea, DEATH_TIME, GOLF_TOTAL } from '../src/game/fight.js'; import { ALIENS } from '../src/game/aliens.js';
const W = generateWorld('APOLLO-4471'), K = W.crater, M = W.baseMap, B = W.base, idle = { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 };
const run = (F, inp, secs, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) stepFight(F, inp, dt); };
const put = (F, x, z) => Object.assign(F.player, { x, z, y: F.lv.ground(x, z), vx: 0, vy: 0, vz: 0, kx: 0, kz: 0 });
const face = (F, x, z) => { F.player.yaw = Math.atan2(F.player.x - x, F.player.z - z); F.player.pitch = 0; };
const grab = F => { put(F, F.flag.x + 1, F.flag.z); stepFight(F, { ...idle, use: true }, 1 / 60); };
const ul = Math.hypot(W.rim.x - B.x, W.rim.z - B.z), ux = (W.rim.x - B.x) / ul, uz = (W.rim.z - B.z) / ul, rim = d => [B.x + ux * (B.R + d), B.z + uz * (B.R + d)];
const near = (p, s, d = .5) => Math.hypot(p.x - s.x, p.z - s.z) < d;
test('walking over the crater rim enters the crater: one area event, a fresh entry snapshot, the surface left as it is', () => {
  const F = createFight(W); grab(F); give(F.ars, 1, 33); F.pickups.length = 0; const n = F.aliens.length; F.events.length = 0;
  put(F, ...rim(.5)); face(F, B.x, B.z); run(F, { ...idle, fwd: 1 }, .5);
  assert.equal(F.area, 1); const ev = F.events.filter(e => e.type === 'area'); assert.equal(ev.length, 1);
  assert.deepEqual([ev[0].area, ev[0].id, ev[0].level, ev[0].text], [1, 'crater', false, 'THE CRATER']); assert.equal(F.entry.cells, 33); assert.equal(F.aliens.length, n); });
test('dying in the same step you cross into the crater restarts you at the crater top with what you crossed with (Review Focus 1)', () => {
  const F = createFight(W), p = F.player; grab(F); give(F.ars, 2, 30); F.pickups.length = 0; put(F, ...rim(.05)); face(F, B.x, B.z); F.hp = 1;
  F.bolts.push({ x: p.x - ux * .6, y: p.y + 1.3, z: p.z - uz * .6, vx: ux * 30, vy: 0, vz: uz * 30, dmg: 50, r: .2, life: 1, col: [1, 1, 1], team: 1, src: 99 });
  stepFight(F, { ...idle, fwd: 1, run: true }, 1 / 60); assert.equal(F.area, 1); assert.equal(F.state, 'dead');
  run(F, idle, DEATH_TIME + .1); assert.equal(F.state, 'play'); assert.ok(near(p, areaStart(W, 1))); assert.deepEqual(F.ars.owned, [true, false, true]); assert.equal(F.ars.cells, 30); assert.equal(F.hp, 100); });
test('a dead body knocked over the rim does not change the area (Review Focus 1)', () => { const F = createFight(W); grab(F); put(F, ...rim(.3)); F.hp = 1;
  hurtPlayer(F, 5, -ux * 20, 0, -uz * 20); run(F, idle, DEATH_TIME + .1); assert.equal(F.area, 0); assert.ok(near(F.player, W.spawn)); });
test('E at the hangar door takes you into the base, leaving every bolt, goo drop, boom, decal and lit fuse behind (Review Focus 2)', () => {
  const F = createFight(W, 1), p = F.player; F.flag.held = true; give(F.ars, 0, 0); give(F.ars, 1, 50); put(F, K.use.x, K.use.z);
  const c = F.canisters.find(x => x.area === 1); c.hp = 0; c.fuse = .1;
  for (let i = 0; i < 20; i++) F.bolts.push({ x: p.x + i * .3, y: p.y + 1, z: p.z + 2, vx: 0, vy: 0, vz: -9, dmg: 9, r: .2, life: 4, col: [1, 1, 1], team: 1, src: 99 });
  for (let i = 0; i < 50; i++) F.parts.push({ x: p.x, y: p.y + 2, z: p.z, vx: 1, vy: 2, vz: 0, kind: 'goo', life: 8 });
  F.booms.push({ x: p.x, y: p.y, z: p.z, age: 0 }); F.decals.push({ x: p.x, y: p.y, z: p.z, nx: 0, ny: 1, nz: 0, r: 1, yaw: 0, kind: 'scorch' });
  stepFight(F, { ...idle, use: true }, 1 / 60);
  assert.deepEqual([F.area, F.lv.id, F.gravity], [2, 'base', GRAVITY.base]); assert.deepEqual([F.bolts.length, F.parts.length, F.booms.length, F.decals.length], [0, 0, 0, 0]);
  assert.ok(!F.canisters.includes(c)); assert.ok([...F.aliens, ...F.pickups, ...F.canisters].every(x => x.area >= 2)); assert.ok(F.canisters.every(x => !(x.fuse > 0)));
  assert.ok(near(p, areaStart(W, 2))); assert.equal(F.entry.cells, 50); assert.ok(F.events.some(e => e.type === 'area' && e.area === 2 && e.level)); });
test('dying in the base restarts you at the lift with what you carried in, facing a fresh base', () => {
  const F = createFight(W, 1); F.flag.held = true; give(F.ars, 0, 0); give(F.ars, 1, 50); put(F, K.use.x, K.use.z); stepFight(F, { ...idle, use: true }, 1 / 60);
  F.ars.cells = 3; const r = M.rooms[F.encs[0].room]; put(F, r.in.x, r.in.z); hurtPlayer(F, 999, 0, 0, 0);
  while (F.state === 'dead') stepFight(F, idle, 1 / 60); // pre-flight F13: compare at the restart step, before any alien can move
  assert.equal(F.area, 2); assert.ok(near(F.player, areaStart(W, 2))); assert.equal(F.ars.cells, 50); assert.equal(F.hp, 100);
  const key = L => L.map(a => [a.id, a.type, a.hp, a.x, a.z]); assert.deepEqual(key(F.aliens), key(createFight(W, 2).aliens)); });
test('walking through the comms door enters the comms area; dying there restarts at the comms door', () => {
  const F = createFight(W, 2), d = M.commsDoor; F.aliens.length = 0; put(F, d.x - d.dx * 3, d.z - d.dz * 3); face(F, d.x, d.z); run(F, { ...idle, fwd: 1 }, 1.5);
  assert.equal(F.area, 3); assert.ok(F.events.some(e => e.type === 'area' && e.id === 'comms' && !e.level));
  hurtPlayer(F, 999, 0, 0, 0); run(F, idle, DEATH_TIME + .1); assert.equal(F.area, 3); assert.ok(near(F.player, d)); });
test('a crater restart rebuilds the crater, keeps the surface pickups you left, and drops the surface aliens', () => {
  const F = createFight(W); grab(F); enterArea(F, 1); const tape = F.pickups.find(q => q.area === 0 && q.kind === 'tape'), cr = F.aliens.find(a => a.area === 1); cr.hp = 5;
  hurtPlayer(F, 999, 0, 0, 0); run(F, idle, DEATH_TIME + .1);
  assert.ok(F.pickups.includes(tape)); assert.ok(F.aliens.length > 0 && F.aliens.every(a => a.area === 1)); assert.equal(F.aliens.find(a => a.id === cr.id).hp, ALIENS[cr.type].hp); });
test('a golf ball counts once, flashes GOLF BALL n/7, and stays found after a death', () => { const F = createFight(W), g = F.balls[0];
  assert.deepEqual(F.balls.map(b => b.id), [0, 1, 2]); put(F, g.x, g.z); stepFight(F, idle, 1 / 60);
  assert.equal(F.golf, 1); assert.deepEqual(F.found, [0]); assert.equal(F.events.find(e => e.type === 'golf').text, `GOLF BALL 1/${GOLF_TOTAL}`); assert.equal(GOLF_TOTAL, 7);
  hurtPlayer(F, 999, 0, 0, 0); run(F, idle, DEATH_TIME + .1); assert.equal(F.golf, 1); assert.deepEqual(F.balls.map(b => b.id), [1, 2]); });
test('a crater restart takes away the surface canisters that were lit or shot out, so nothing explodes later; the rest stay as they were', () => {
  const F = createFight(W); enterArea(F, 1); const [lit, spent, hit, ok] = F.canisters.filter(c => c.area === 0); lit.hp = 0; lit.fuse = .15; spent.hp = 0; hit.hp = 5;
  hurtPlayer(F, 999, 0, 0, 0); while (F.state === 'dead') stepFight(F, idle, 1 / 60);
  assert.deepEqual([lit, spent, hit, ok].map(c => F.canisters.includes(c)), [false, false, true, true]); assert.equal(hit.hp, 5); assert.ok(F.canisters.every(c => c.hp > 0 && !(c.fuse > 0))); });
test('grabbing the flag from the crater adds only the flag weapon to the crater snapshot', () => {
  const F = createFight(W); enterArea(F, 1); F.ars.cells = 25; grab(F); assert.equal(F.area, 1);
  assert.deepEqual([F.entry.owned, F.entry.cells, F.entry.flagHeld], [[true, false, false], 0, true]);
  hurtPlayer(F, 999, 0, 0, 0); while (F.state === 'dead') stepFight(F, idle, 1 / 60);
  assert.deepEqual([F.ars.owned, F.ars.cells, F.flag.held], [[true, false, false], 0, true]); });
test('a crater restart rebuilds the crater pickups once (never doubled per death) and keeps the surface golf balls you left', () => {
  const F = createFight(W); grab(F); enterArea(F, 1); const balls = F.balls.map(b => [b.id, b.area]);
  for (let i = 0; i < 2; i++) { hurtPlayer(F, 999, 0, 0, 0); while (F.state === 'dead') stepFight(F, idle, 1 / 60); } // pre-flight F13
  assert.deepEqual(F.pickups.filter(q => q.area >= 1).map(q => q.kind), createFight(W, 1).pickups.map(q => q.kind)); assert.deepEqual(F.balls.map(b => [b.id, b.area]), balls); });
