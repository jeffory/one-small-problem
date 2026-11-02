import test from 'node:test'; import assert from 'node:assert/strict';
import { PLAYER, createPlayer, stepPlayer, knock } from '../src/game/player.js';
const run = (p, inp, secs, g, dt = 1 / 60, bound = 1e9) => { for (let t = 0; t < secs; t += dt) stepPlayer(p, inp, dt, g, bound); };
const idle = { fwd: 0, strafe: 0, run: false, jump: false }, east = { x: 0, z: 0, dx: 1, dz: 0 };
test('stands still on flat ground', () => { const p = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, () => 0); run(p, idle, 1, () => 0); assert.equal(p.y, 0); assert.ok(p.onGround); });
test('walks 4.5 m/s, runs 9 m/s toward -z at yaw 0', () => { const g = () => 0;
  const a = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, g); run(a, { ...idle, fwd: 1 }, 1, g); assert.ok(Math.abs(a.z + 4.5) < 0.1);
  const b = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, g); run(b, { ...idle, fwd: 1, run: true }, 1, g); assert.ok(Math.abs(b.z + 9) < 0.2); });
test('low-gravity jump: ~2.04 m apex, ~2.33 s airtime', () => { const g = () => 0, p = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, g); let top = 0, t = 0;
  stepPlayer(p, { ...idle, jump: true }, 1 / 60, g, 1e9); t += 1 / 60; while (!p.onGround && t < 5) { stepPlayer(p, idle, 1 / 60, g, 1e9); t += 1 / 60; top = Math.max(top, p.y); }
  assert.ok(Math.abs(top - PLAYER.jumpV ** 2 / (2 * PLAYER.gSurface)) < 0.06); assert.ok(Math.abs(t - 2 * PLAYER.jumpV / PLAYER.gSurface) < 0.06); });
test('walls stop you, small steps do not', () => { const p = createPlayer(east, () => 0), wall = x => (x > 1 ? 2 : 0);
  run(p, { ...idle, fwd: 1 }, 1, (x) => wall(x)); assert.ok(p.x <= 1.0001 && p.y === 0);
  const q = createPlayer(east, () => 0), step = x => (x > 1 ? 0.3 : 0); run(q, { ...idle, fwd: 1 }, 1, (x) => step(x)); assert.ok(q.x > 2 && Math.abs(q.y - 0.3) < 1e-9); });
test('stays glued walking downhill', () => { const g = x => -0.5 * x, p = createPlayer(east, g); run(p, { ...idle, fwd: 1 }, 1, g); assert.ok(p.onGround && Math.abs(p.y - g(p.x)) < 0.01); });
test('a huge frame does not tunnel through a wall', () => { const p = createPlayer(east, () => 0); stepPlayer(p, { ...idle, fwd: 1, run: true }, 1.0, x => (x > 1 ? 2 : 0), 1e9); assert.ok(p.x <= 1.0001); });
test('map bound holds', () => { const p = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, () => 0); run(p, { ...idle, fwd: 1, run: true }, 10, () => 0, 1 / 60, 20); assert.ok(p.z >= -20); });
test('diagonal strafe-running is no faster than straight', () => { const g = () => 0, dist = p => Math.hypot(p.x, p.z);
  const a = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, g); run(a, { ...idle, fwd: 1, strafe: 1 }, 1, g); assert.ok(Math.abs(dist(a) - 4.5) < 0.1);
  const b = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, g); run(b, { ...idle, fwd: 1, strafe: 1, run: true }, 1, g); assert.ok(Math.abs(dist(b) - 9) < 0.2); });
test('jump pressed while airborne is ignored', () => { const g = () => 0, p = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, g); let top = 0;
  for (let i = 0; i < 150; i++) { stepPlayer(p, { ...idle, jump: true }, 1 / 60, g, 1e9); top = Math.max(top, p.y); }
  assert.ok(top > 1.9); assert.ok(top <= PLAYER.jumpV ** 2 / (2 * PLAYER.gSurface) + 0.06); });
test('walls slide per axis instead of stopping dead', () => { const g = x => (x > 1 ? 2 : 0), p = createPlayer({ x: 0, z: 0, dx: 1, dz: -1 }, g);
  run(p, { ...idle, fwd: 1 }, 1, g); assert.ok(p.x <= 1.0001); assert.ok(p.z < -1); });
test('a steep bilinear ramp is refused at any frame rate, walking or running', () => {
  const g = x => Math.min(2.45, Math.max(0, (x - 1) * 2.45));
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) { const p = createPlayer(east, g); run(p, { ...idle, fwd: 1 }, 2, g, dt); assert.ok(p.y < 0.5 && p.x < 1.3, `dt ${dt}: x ${p.x} y ${p.y}`); }
  const q = createPlayer(east, g); run(q, { ...idle, fwd: 1, run: true }, 2, g, 1 / 144); assert.ok(q.y < 0.5 && q.x < 1.3, `run: x ${q.x} y ${q.y}`); });
test('a gentle ramp is still climbed', () => { const g = x => Math.max(0, (x - 1) * 0.5), p = createPlayer(east, g);
  run(p, { ...idle, fwd: 1 }, 2, g, 1 / 60); assert.ok(p.x > 5 && Math.abs(p.y - g(p.x)) < 0.01, `x ${p.x} y ${p.y}`); });
test('gravity is a parameter: near-normal g gives a short hop', () => { const g = () => 0, p = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, g); let t = 0;
  stepPlayer(p, { ...idle, jump: true }, 1 / 60, g, 1e9, 9); t += 1 / 60; while (!p.onGround && t < 5) { stepPlayer(p, idle, 1 / 60, g, 1e9, 9); t += 1 / 60; }
  assert.ok(Math.abs(t - 2 * PLAYER.jumpV / 9) < 0.05, `airtime ${t}`); });
test('a knock shoves you, then ground friction stops it', () => { const g = () => 0, p = createPlayer(east, g); knock(p, 6, 0, 0); run(p, idle, 1, g);
  assert.ok(p.x > 0.6 && p.x < 1.5, `x ${p.x}`); assert.ok(Math.abs(p.kx) < 0.05); });
test('an upward knock throws you and carries on in the air', () => { const g = () => 0, p = createPlayer(east, g); knock(p, 4, 3, 0);
  stepPlayer(p, idle, 1 / 60, g, 1e9); assert.equal(p.onGround, false); run(p, idle, 0.5, g); assert.ok(p.y > 0.5); assert.equal(p.kx, 4); });
test('a knock into a wall stops at the wall', () => { const w = x => (x > 1 ? 2 : 0), p = createPlayer(east, () => 0); knock(p, 20, 0, 0); run(p, idle, 1, w);
  assert.ok(p.x <= 1.0001); assert.equal(p.kx, 0); });
