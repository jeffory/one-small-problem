import test from 'node:test'; import assert from 'node:assert/strict';
import { PLAYER, FALL, createPlayer, stepPlayer, knock, fits } from '../src/game/player.js';
import { tileLevel } from './helpers.mjs';
const run = (p, inp, secs, g, dt = 1 / 60, bound = 1e9) => { for (let t = 0; t < secs; t += dt) stepPlayer(p, inp, dt, g, bound); };
const idle = { fwd: 0, strafe: 0, run: false, jump: false }, east = { x: 0, z: 0, dx: 1, dz: 0 };
const RUN = { fwd: 1, strafe: 0, run: true, jump: false }, FPS = [1 / 20, 1 / 60, 1 / 144];
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
const box = (L, p) => Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => L.ceil(p.x + a * .38, p.z + b * .38)));
test('indoors you keep clear of a convex wall corner instead of grazing it (Review Focus 5)', () => { const L = tileLevel(['#######', '#.....#', '#.....#', '#..####', '#..####', '#######']);
  for (const dt of FPS) { const p = createPlayer({ x: 2, z: 2.3, dx: 1, dz: 0 }, L.ground); let gap = 9;
    for (let t = 0; t < 1; t += dt) { stepPlayer(p, RUN, dt, L.ground, 1e9, 9, L.ceil); gap = Math.min(gap, L.gap(p.x, p.z)); } assert.ok(gap >= .37, `${Math.round(1 / dt)} fps: ${gap}`); } });
test('indoors, running diagonally into a wall slides along it without sticking (Review Focus 5)', () => { const L = tileLevel(['#########', '#.......#', '#.......#', '#.......#', '#########']);
  for (const dt of FPS) { const p = createPlayer({ x: 1.5, z: 2, dx: Math.SQRT1_2, dz: Math.SQRT1_2 }, L.ground); for (let t = 0; t < 1; t += dt) stepPlayer(p, RUN, dt, L.ground, 1e9, 9, L.ceil);
    assert.ok(p.x >= 6.5, `${Math.round(1 / dt)} fps: x ${p.x}`); } });
test('a blast that throws you up stops your head at the ceiling, at any frame rate (Review Focus 5)', () => { const L = tileLevel(['#####', '#...#', '#...#', '#...#', '#####'], { ceil: 3 });
  for (const dt of FPS) { const p = createPlayer({ x: 2, z: 2, dx: 1, dz: 0 }, L.ground); knock(p, 0, 9, 0); let top = 0;
    for (let t = 0; t < 2; t += dt) { stepPlayer(p, idle, dt, L.ground, 1e9, 9, L.ceil); top = Math.max(top, p.y + PLAYER.head); }
    assert.ok(top <= 3 + 1e-9 && top > 2.9, `${Math.round(1 / dt)} fps: head ${top}`); assert.equal(p.onGround, true); } });
test('thrown up beside a doorway lintel, your head never enters it, and you still walk through (Review Focus 5)', () => {
  const L = tileLevel(['#####', '#...#', '#.l.#', '#...#', '#...#', '#####'], { ceil: 4 });
  for (const dt of FPS) { const p = createPlayer({ x: 2, z: 1, dx: 0, dz: 1 }, L.ground); knock(p, 0, 6, 0);
    for (let t = 0; t < 3; t += dt) { stepPlayer(p, { ...idle, fwd: 1 }, dt, L.ground, 1e9, 9, L.ceil); assert.ok(p.y + PLAYER.head <= box(L, p) + 1e-9, `${Math.round(1 / dt)} fps at z ${p.z}`); }
    assert.ok(p.z > 3, `${Math.round(1 / dt)} fps: stuck at z ${p.z}`); } });
test('fits: outdoors the ground at the centre is within a step; indoors all four box corners are, with headroom', () => {
  const wall = x => (x > .5 ? 2 : 0), L = tileLevel(['#####', '#...#', '#.l.#', '#...#', '#####']), at = y => ({ y }), h = L.ceil(2, 2) - PLAYER.head;
  assert.equal(fits(at(0), .4, 0, wall), true); assert.equal(fits(at(0), .6, 0, wall), false);
  assert.equal(fits(at(0), 1, 1, L.ground, L.ceil), true); assert.equal(fits(at(0), .85, 1, L.ground, L.ceil), false); // a corner in the wall
  assert.equal(fits(at(h - .05), 1.3, 1.3, L.ground, L.ceil), true); assert.equal(fits(at(h + .05), 1.3, 1.3, L.ground, L.ceil), false); }); // a corner under the lintel
// A 0.5 m bed row (z 4.5..5.5; greenhouse beds were this low until M4 raised them to BASE.cover): jump beside it, drift toward it,
// land with a box corner over it.
const bedLevel = (end = 40) => { const ground = (x, z) => (Math.round(z) === 5 && x > -1 ? (x < end ? .5 : 99) : Math.round(z) >= 7 || Math.round(z) <= 0 ? 99 : 0);
  return { ground, ceil: (x, z) => (ground(x, z) >= 99 ? 0 : 4) }; };
test('landing with a box corner over a low bed never stops you running along it, and pushing in never climbs it (R6)', () => { const B = bedLevel();
  for (const dt of FPS) { let overlapped = 0;
    for (const drift of [.1, .2, .3]) { const p = createPlayer({ x: 2, z: 4.05, dx: 1, dz: 0 }, B.ground); let stuck = 0;
      stepPlayer(p, { ...idle, fwd: 1, jump: true }, dt, B.ground, 1e9, 9, B.ceil);
      for (let t = dt; t < 3; t += dt) { const x0 = p.x; stepPlayer(p, { ...idle, fwd: 1, strafe: t < drift ? 1 : 0 }, dt, B.ground, 1e9, 9, B.ceil); if (t > 1 && p.onGround && p.x === x0) stuck++; }
      assert.equal(stuck, 0, `${Math.round(1 / dt)} fps, drift ${drift}: forward refused for ${stuck} frames`);
      if (p.y === 0 && p.z + .38 > 4.5) { overlapped++; for (let t = 0; t < 1; t += dt) stepPlayer(p, { ...idle, strafe: 1 }, dt, B.ground, 1e9, 9, B.ceil);
        assert.ok(p.y === 0 && p.z < 4.5, `${Math.round(1 / dt)} fps: pushed onto the bed, z ${p.z} y ${p.y}`); } }
    assert.ok(overlapped, `${Math.round(1 / dt)} fps: never landed overlapping the bed`); } });
test('an overlap never lets a corner into a wall: running along a bed into the wall at its end stops you clear (R6)', () => { const B = bedLevel(9.5);
  for (const dt of FPS) { const p = createPlayer({ x: 2, z: 4.05, dx: 1, dz: 0 }, B.ground); let gap = 9;
    stepPlayer(p, { ...idle, fwd: 1, jump: true }, dt, B.ground, 1e9, 9, B.ceil);
    for (let t = dt; t < 3; t += dt) { stepPlayer(p, { ...idle, fwd: 1, strafe: t < .1 ? 1 : 0 }, dt, B.ground, 1e9, 9, B.ceil); gap = Math.min(gap, Math.hypot(Math.max(0, 9.5 - p.x), Math.max(0, 4.5 - p.z))); }
    assert.ok(p.z + .38 > 4.5 && p.x > 8.5, `${Math.round(1 / dt)} fps: never ran along the bed overlapping it (${p.x}, ${p.z})`); assert.ok(gap >= .37, `${Math.round(1 / dt)} fps: ${gap}`); } });
// R18: the step you land in reports your landing speed (p.land, m/s down), every other step 0.
const fall = (ground, ceil, g, dt, p, secs = 6, inp = idle) => { const L = []; for (let t = 0; t < secs; t += dt) { stepPlayer(p, inp, dt, ground, 1e9, g, ceil); if (p.land) L.push(p.land); } return L; };
test('the step you land in reports your landing speed; ordinary jumps and a 1 m base drop land well under FALL.safe (R18)', () => {
  for (const dt of FPS) { const g = () => 0, open = { fwd: 0, strafe: 0, run: false, jump: false };
    for (const [grav, ceil] of [[PLAYER.gSurface, null], [9, () => 4]]) { const p = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, g);
      assert.deepEqual(fall(g, ceil, grav, dt, p, 1, { ...open, fwd: 1 }), [], 'walking never lands');
      stepPlayer(p, { ...open, jump: true }, dt, g, 1e9, grav, ceil); const L = fall(g, ceil, grav, dt, p, 3);
      assert.equal(L.length, 1); assert.ok(Math.abs(L[0] - PLAYER.jumpV) <= grav * dt + 1e-9 && L[0] < FALL.safe, `${Math.round(1 / dt)} fps, g ${grav}: ${L[0]}`); }
    const ledge = x => (x < 2 ? 1 : 0), p = createPlayer(east, ledge), L = fall(ledge, () => 4, 9, dt, p, 2, { ...open, fwd: 1 });
    assert.equal(L.length, 1); assert.ok(Math.abs(L[0] - Math.sqrt(2 * 9)) < .3 && L[0] < FALL.safe, `${Math.round(1 / dt)} fps: 1 m drop lands at ${L[0]}`); } });
test('outdoors your feet follow falling ground at up to FALL.safe m/s; where it drops away faster you leave it, at any frame rate (R18)', () => {
  const steep = x => -1.2 * Math.max(0, x - 1), gentle = x => -.5 * x, at = [];
  for (const dt of FPS) { const p = createPlayer(east, steep); let off = null;
    for (let t = 0; t < 1.5 && off === null; t += dt) { stepPlayer(p, RUN, dt, steep, 1e9); if (!p.onGround) off = p.x; } // running: 10.8 m/s down
    assert.ok(off !== null && off < 1.5, `${Math.round(1 / dt)} fps: ran down a 1.2 slope still glued`); at.push(off);
    const q = createPlayer(east, steep); for (let t = 0; t < 1.5; t += dt) { stepPlayer(q, { ...idle, fwd: 1 }, dt, steep, 1e9); assert.ok(q.onGround, `${Math.round(1 / dt)} fps: walking (5.4 m/s down) left the slope`); }
    const r = createPlayer(east, gentle); for (let t = 0; t < 1; t += dt) { stepPlayer(r, RUN, dt, gentle, 1e9); assert.ok(r.onGround); } }
  assert.ok(Math.max(...at) - Math.min(...at) < .5, `take-off points ${at}`); });
