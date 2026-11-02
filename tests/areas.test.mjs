import test from 'node:test'; import assert from 'node:assert/strict';
import { generateWorld } from '../src/gen/world.js'; import { BASE } from '../src/gen/base.js';
import { AREAS, LEVEL, GRAVITY, makeLevel, areaStart, advanceArea } from '../src/game/areas.js'; import { createFight, stepFight } from '../src/game/fight.js'; import { PLAYER } from '../src/game/player.js';
const W = generateWorld('APOLLO-4471'), M = W.baseMap, idle = { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 };
const run = (F, inp, secs, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) stepFight(F, inp, dt); };
const put = (F, x, z) => Object.assign(F.player, { x, z, y: F.lv.ground(x, z), vx: 0, vy: 0, vz: 0, kx: 0, kz: 0 });
test('every area starts on its level, at its start, under its level gravity', () => { assert.deepEqual(AREAS, ['surface', 'crater', 'base', 'comms']); assert.deepEqual(GRAVITY, { surface: 3.0, base: 9.0 });
  for (let k = 0; k < 4; k++) { const F = createFight(W, k), s = areaStart(W, k); assert.deepEqual([F.area, F.lv.id, F.gravity], [k, LEVEL[k], GRAVITY[LEVEL[k]]]);
    assert.ok(Math.hypot(F.player.x - s.x, F.player.z - s.z) < 1e-9); assert.equal(F.player.y, F.lv.ground(s.x, s.z)); assert.ok(F.aliens.every(a => a.area >= k)); } });
test('the base level: solid walls, real ceilings, a sealed edge; the surface has no ceiling', () => { const L = makeLevel(W, 'base'), r = M.rooms[1];
  assert.equal(L.ceil(r.x0 + 1 - M.half, r.z0 + 1 - M.half), r.ceil); assert.ok(L.ground(r.x0 - 1 - M.half, r.z0 - 1 - M.half) >= BASE.wall);
  assert.ok(L.ground(100, 0) >= BASE.wall); assert.equal(L.ceil(100, 0), 0); assert.equal(makeLevel(W, 'surface').ceil, null); });
test('a base fight: walk into the hangar and its aliens wake, keep to the tiles and shoot back', () => { const F = createFight(W, 2), e = F.encs[0], r = M.rooms[e.room];
  F.god = true; put(F, r.in.x, r.in.z); run(F, idle, 8); assert.ok(F.hp < 100); // R9: the hangar can kill an idle player before 8 s, and the restart would reset hp
  for (const a of F.aliens) { assert.ok(F.lv.ground(a.x, a.z) < BASE.wall, `alien ${a.id} in a wall`); if (a.type !== 'fl' && a.state !== 'dead') assert.equal(a.y, F.lv.ground(a.x, a.z)); } });
test('base gravity is 9: a jump in the lift lands in 2 jumpV / 9 s', () => { const F = createFight(W, 2); let t = 1 / 60; stepFight(F, { ...idle, jump: true }, 1 / 60);
  while (!F.player.onGround && t < 3) { stepFight(F, idle, 1 / 60); t += 1 / 60; } assert.ok(Math.abs(t - 2 * PLAYER.jumpV / GRAVITY.base) < .05, `airtime ${t}`); });
test('a bolt into a base wall scorches the wall at its height, facing out of it', () => { const F = createFight(W, 2), p = F.player, s = areaStart(W, 2); F.aliens.length = 0; // pre-flight F25
  F.bolts.push({ x: p.x, y: p.y + 1.5, z: p.z, vx: -s.dx * 40, vy: 0, vz: -s.dz * 40, dmg: 1, r: .1, life: 2, col: [1, 1, 1], team: 0, src: 0 }); run(F, idle, .5);
  const d = F.decals.find(x => x.kind === 'scorch'); assert.ok(d); assert.ok(Math.abs(d.ny) < 1e-9); assert.ok(Math.abs(d.nx * s.dx + d.nz * s.dz - 1) < 1e-9); assert.ok(Math.abs(d.y - (p.y + 1.5)) < .01); });
test('goo thrown at a wall slides down it and lands flat on the floor, never inside the wall', () => { const F = createFight(W, 2), p = F.player, s = areaStart(W, 2); F.aliens.length = 0; // pre-flight F25: no alien goo or scorch
  for (let i = 0; i < 30; i++) F.parts.push({ x: p.x, y: p.y + 1.5, z: p.z, vx: -s.dx * 6, vy: 1, vz: -s.dz * 6, kind: 'goo', life: 8 });
  run(F, idle, 3); const g = F.decals.filter(d => d.kind === 'goo'); assert.equal(g.length, 10);
  for (const d of g) { assert.ok(F.lv.ground(d.x, d.z) < BASE.wall); assert.ok(d.ny > .99); } for (const q of F.parts) assert.ok(F.lv.ground(q.x, q.z) < BASE.wall); });
test('areas only advance: over the crater rim, then through the comms door', () => { const B = W.base, d = M.commsDoor, S = W.spawn;
  assert.deepEqual([advanceArea(W, 0, S.x, S.z), advanceArea(W, 0, B.x + B.R * .99, B.z), advanceArea(W, 0, B.x + B.R * 1.01, B.z), advanceArea(W, 1, S.x, S.z)], [0, 1, 0, 1]);
  assert.deepEqual([advanceArea(W, 2, M.start.x, M.start.z), advanceArea(W, 2, d.x - d.dx * 3, d.z - d.dz * 3), advanceArea(W, 2, d.x, d.z), advanceArea(W, 3, M.start.x, M.start.z)], [2, 2, 3, 3]); });
test('populate tags everything with its area and keeps the level plan ids from any start; the flag is surface-only', () => {
  const A = createFight(W), C = createFight(W, 1), key = L => L.map(a => [a.id, a.area, a.type, a.x, a.z]), can = L => L.map(c => [c.id, c.area, c.x, c.z]);
  assert.ok(A.aliens.some(a => a.area === 0) && C.aliens.length > 0); assert.deepEqual(key(C.aliens), key(A.aliens.filter(a => a.area >= 1)));
  assert.deepEqual(can(C.canisters), can(A.canisters.filter(c => c.area >= 1))); assert.ok(C.pickups.length > 0 && C.pickups.every(q => q.area === 1));
  assert.equal(C.encs.length, W.plan.encounters.length); assert.ok(C.aliens.every(a => C.encs.includes(a.enc) && a.enc.area === a.area));
  const F = createFight(W, 2); put(F, F.flag.x + 1, F.flag.z); stepFight(F, { ...idle, use: true }, 1 / 60); assert.equal(F.flag.held, false); });
test('a hit reported inside a wall (an alien muzzle buried in it) leaves no decal or particle in the wall', () => { const F = createFight(W, 2); F.aliens.length = 0;
  F.bolts.push({ x: .1 - M.half, y: 1.5, z: M.start.z, vx: 1, vy: 0, vz: 0, dmg: 1, r: .1, life: 2, col: [1, 1, 1], team: 1, src: 99 }); // the sealed edge
  stepFight(F, idle, 1 / 60); assert.equal(F.bolts.length, 0); run(F, idle, .5);
  for (const d of F.decals) assert.ok(F.lv.ground(d.x, d.z) < BASE.wall); for (const q of F.parts) assert.ok(F.lv.ground(q.x, q.z) < BASE.wall); });
test('R11: on a steep surface slope bolt, blast and goo decals face the true slope; indoors a floor beside a wall still reads flat', () => {
  // [x, z] on the level where the decals land: a bolt straight down, a canister blast and three settling goo drops (every 3rd sticks)
  const mark = (F, x, z) => { const y = F.lv.ground(x, z); F.aliens.length = 0; F.canisters.length = 0;
    F.bolts.push({ x, y: y + 1.5, z, vx: 0, vy: -30, vz: 0, dmg: 1, r: .1, life: 1, col: [1, 1, 1], team: 1, src: 99 });
    F.canisters.push({ x, y, z, hp: 0, fuse: .01, id: -99, area: F.area }); for (let i = 0; i < 3; i++) F.parts.push({ x, y: y + .05, z, vx: 0, vy: 0, vz: 0, kind: 'goo', life: 9 });
    run(F, idle, .5); const d = F.decals.filter(q => Math.hypot(q.x - x, q.z - z) < 1e-6); assert.equal(d.length, 3); return d; };
  const S = createFight(W), G = S.lv.ground, slope = (x, z) => { const gx = G(x + .5, z) - G(x - .5, z), gz = G(x, z + .5) - G(x, z - .5), l = Math.hypot(gx, 1, gz); return [-gx / l, 1 / l, -gz / l]; };
  let at = null; // the first sample past 35 deg whose step to a neighbour is beyond the indoor clamp (.35 m), away from the player
  for (let j = -220; j <= 220 && !at; j++) for (let i = -220; i <= 220 && !at; i++) { const x = i + .3, z = j + .3, c = G(x, z);
    if (slope(x, z)[1] < Math.cos(35 * Math.PI / 180) && [G(x + .5, z), G(x - .5, z), G(x, z + .5), G(x, z - .5)].some(g => Math.abs(g - c) > .5) && Math.hypot(x - S.player.x, z - S.player.z) > 5) at = [x, z]; }
  assert.ok(at); const n = slope(...at); for (const d of mark(S, ...at)) assert.ok(Math.abs(d.nx - n[0]) + Math.abs(d.ny - n[1]) + Math.abs(d.nz - n[2]) < 1e-9, `${d.kind} ${[d.nx, d.ny, d.nz]} vs ${n}`);
  const B = createFight(W, 2), s = areaStart(W, 2); let x = s.x, z = s.z; // walk back from the lift centre to just short of the back wall
  while (B.lv.ground(x - s.dx * .6, z - s.dz * .6) < BASE.wall) { x -= s.dx * .1; z -= s.dz * .1; }
  for (const d of mark(B, x, z)) assert.ok(d.ny === 1 && Math.abs(d.nx) + Math.abs(d.nz) === 0, `${d.kind} ${[d.nx, d.ny, d.nz]}`); });
