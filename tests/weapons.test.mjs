import test from 'node:test'; import assert from 'node:assert/strict';
import { WEAPONS, MAX_CELLS, createArsenal, give, selectWeapon, cycleWeapon, coolWeapon, fireWeapon, meleeTargets } from '../src/game/weapons.js';
import { stepBolts, groundNormal } from '../src/game/bolts.js';
import { PLAYER } from '../src/game/player.js';
import { tileLevel } from './helpers.mjs';
const B = { f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0] }, eye = [0, 1.7, 0], aim = [0, 1.7, -50], flat = () => 0;
const bolt = (o = {}) => ({ x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: -60, dmg: 10, r: .12, life: 2, col: [1, 1, 1], team: 0, src: 0, ...o });
test('nothing owned, nothing fires; the flag swings without cells', () => { const a = createArsenal(); assert.equal(fireWeapon(a, eye, B, aim), null);
  give(a, 0, 0); assert.equal(a.cur, 0); assert.equal(fireWeapon(a, eye, B, aim).melee, true); assert.equal(fireWeapon(a, eye, B, aim), null);
  coolWeapon(a, WEAPONS[0].cool); assert.ok(fireWeapon(a, eye, B, aim)); });
test('pistol: one bolt from the muzzle toward the aim point, one cell', () => { const a = createArsenal(); give(a, 0, 0); give(a, 1, 20); assert.equal(a.cur, 1);
  const s = fireWeapon(a, eye, B, aim), b = s.bolts[0], m = WEAPONS[1].muzzle; assert.equal(s.bolts.length, 1); assert.equal(a.cells, 19);
  assert.ok(Math.abs(b.x - m[0]) < 1e-6 && Math.abs(b.y - (1.7 + m[1])) < 1e-6 && Math.abs(b.z + m[2]) < 1e-6);
  const d = [aim[0] - b.x, aim[1] - b.y, aim[2] - b.z], l = Math.hypot(...d), sp = WEAPONS[1].speed;
  assert.ok(Math.abs(b.vx / sp - d[0] / l) < 1e-6 && Math.abs(b.vy / sp - d[1] / l) < 1e-6 && Math.abs(b.vz / sp - d[2] / l) < 1e-6); });
test('scattergun: five bolts fanned within the spread, four cells', () => { const a = createArsenal(); give(a, 0, 0); give(a, 2, 16);
  const s = fireWeapon(a, eye, B, aim); assert.equal(s.bolts.length, 5); assert.equal(a.cells, 12);
  const ang = s.bolts.map(b => Math.atan2(b.vx, -b.vz)); assert.ok(Math.max(...ang) - Math.min(...ang) > 0.15); assert.ok(ang.every(x => Math.abs(x) <= WEAPONS[2].spread + 0.02)); });
test('out of cells falls back to the flag pole (Review Focus 4)', () => { const a = createArsenal(); give(a, 0, 0); give(a, 1, 1); fireWeapon(a, eye, B, aim); coolWeapon(a, 1);
  assert.equal(fireWeapon(a, eye, B, aim), null); assert.equal(a.cur, 0); });
test('holding fire for 2 s fires the same number of pistol shots at 20, 60 and 144 fps (M3)', () => { const n = [1 / 20, 1 / 60, 1 / 144].map(dt => {
  const a = createArsenal(); give(a, 0, 0); give(a, 1, MAX_CELLS); let shots = 0; for (let i = 0, m = Math.round(2 / dt); i < m; i++) { coolWeapon(a, dt); if (fireWeapon(a, eye, B, aim)) shots++; } return shots; });
  assert.ok(Math.max(...n) - Math.min(...n) <= 1, n.join()); assert.ok(n.every(k => Math.abs(k - 2 / WEAPONS[1].cool) <= 1.5), n.join()); });
test('idle banks at most one sub-step of cooldown, never below -0.05 (M3)', () => { const a = createArsenal(); give(a, 0, 0); give(a, 1, MAX_CELLS);
  for (let i = 0; i < 100; i++) coolWeapon(a, 1 / 144); assert.ok(a.cool >= -1 / 144 - 1e-12 && a.cool < 0); coolWeapon(a, 1); assert.ok(a.cool >= -.05);
  fireWeapon(a, eye, B, aim); assert.ok(Math.abs(a.cool - (WEAPONS[1].cool - .05)) < 1e-9); });
test('a scattergun short of cells switches to the pistol, not the pole (M9)', () => { const a = createArsenal(); give(a, 0, 0); give(a, 1, 0); give(a, 2, 0); a.cells = WEAPONS[2].cells - 1;
  assert.equal(a.cur, 2); assert.equal(fireWeapon(a, eye, B, aim), null); assert.equal(a.cur, 1); assert.equal(fireWeapon(a, eye, B, aim).bolts.length, 1); });
test('weapon keys and the wheel only reach owned weapons (Review Focus 4)', () => { const a = createArsenal(); give(a, 0, 0);
  assert.equal(selectWeapon(a, 2), false); assert.equal(a.cur, 0); give(a, 2, 4); assert.equal(a.cur, 2); give(a, 0, 0); assert.equal(a.cur, 2); selectWeapon(a, 0);
  cycleWeapon(a, 1); assert.equal(a.cur, 2); cycleWeapon(a, 1); assert.equal(a.cur, 0); cycleWeapon(a, -1); assert.equal(a.cur, 2);
  give(a, 1, 500); assert.equal(a.cells, MAX_CELLS); });
test('the pole judges its swing side to side: 2.6 m past the radius, cosArc .65, feet -.3 to eye +.5; pitch plays no part (Plan 5)', () => {
  const W = WEAPONS[0], d2r = Math.PI / 180, at = (deg, d, y = .55, r = .4) => ({ x: d * Math.sin(deg * d2r), y, z: -d * Math.cos(deg * d2r), r });
  assert.deepEqual([W.range, W.cosArc, W.band[0], W.band[1], W.dmg, W.cool, W.knock], [2.6, .65, -.3, PLAYER.eye + .5, 25, .65, 7]);
  const hit = [at(0, 1.2), at(40, 1.2), at(-45, 1.2), at(0, 2.95), at(0, 1.5, -.6), at(0, 1.5, 2.5), at(0, 0)];
  const miss = [at(180, 1.2), at(90, 1.2), at(55, 1.2), at(0, 3.05), at(0, 1.5, -.8), at(0, 1.5, 2.7)];
  assert.deepEqual(meleeTargets(0, 0, 0, 0, [...hit, ...miss], W), hit);
  const left = { x: -1.2, y: .55, z: 0, r: .4 }; assert.deepEqual(meleeTargets(0, 0, 0, Math.PI / 2, [left], W), [left]);
  const up = { x: 5, y: 10.55, z: -1.2, r: .4 }; assert.deepEqual(meleeTargets(5, 10, 0, 0, [up], W), [up]); });
test('a fast bolt cannot tunnel through a small target at 20 fps (Review Focus 3)', () => { const bs = [bolt()], T = [{ x: 0, y: 1, z: -10, r: .3, id: 5 }];
  let h = []; for (let i = 0; i < 20 && !h.length; i++) h = stepBolts(bs, 0.05, flat, T); assert.equal(h[0].t, T[0]); assert.equal(bs.length, 0); });
test('bolts hit the ground, expire, and never hit their shooter', () => {
  const g = [bolt({ vy: -10, vz: -10 })]; let h = []; for (let i = 0; i < 20 && !h.length; i++) h = stepBolts(g, 0.05, flat, []);
  assert.equal(h[0].t, null); assert.equal(h[0].y, 0);
  const e = [bolt({ life: 0.1 })]; stepBolts(e, 0.05, flat, []); stepBolts(e, 0.06, flat, []); assert.equal(e.length, 0);
  const s = [bolt({ src: 7 })]; assert.equal(stepBolts(s, 0.05, flat, [{ x: 0, y: 1, z: -0.5, r: .5, id: 7 }]).length, 0); });
const r6 = v => Math.round(v * 1e6) / 1e6 + 0, fly = (b, L) => { const s = [b]; let h = []; for (let i = 0; i < 20 && !h.length; i++) h = stepBolts(s, .05, L.ground, [], L.ceil); return h[0]; };
test('bolts stop at ceilings and wall faces and say which face they hit (Review Focus 5)', () => { const L = tileLevel(['#####', '#...#', '#...#', '#...#', '#####'], { ceil: 3 });
  const up = fly(bolt({ x: 2, y: 1.5, z: 2, vx: 0, vy: 40, vz: 0 }), L); assert.equal(up.y, 3); assert.deepEqual(up.n.map(r6), [0, -1, 0]);
  const side = fly(bolt({ x: 2, y: 1.5, z: 2, vx: 60, vy: 0, vz: 0 }), L); assert.ok(Math.abs(side.x - 3.5) < .01 && Math.abs(side.y - 1.5) < .01); assert.deepEqual(side.n.map(r6), [-1, 0, 0]);
  const down = fly(bolt({ x: 2.2, y: 1.5, z: 3.3, vx: 0, vy: -40, vz: 0 }), L); assert.equal(down.y, 0); assert.deepEqual(down.n.map(r6), [0, 1, 0]);
  const sof = fly(bolt({ x: 1, y: 3, z: 2, vx: 60, vy: 0, vz: 0 }), tileLevel(['#####', '#...#', '#.l.#', '#...#', '#####'], { ceil: 4 })); // pre-flight F15: into a lintel's soffit
  assert.ok(Math.abs(sof.x - 1.5) < .01 && sof.y === 3, `soffit hit at ${sof.x}, ${sof.y}`); assert.deepEqual(sof.n.map(r6), [-1, 0, 0]); });
test('groundNormal ignores a wall beside the floor but follows a slope', () => { const L = tileLevel(['#####', '#...#', '#...#', '#####']);
  assert.deepEqual(groundNormal(L.ground, 2.2, 2.3).map(r6), [0, 1, 0]); const n = groundNormal(x => .3 * x, 0, 0); assert.ok(Math.abs(n[0] + .3 / Math.hypot(.3, 1)) < 1e-9); });
test('a level hit is classed by what the bolt is inside: a ceiling over a ledge is no wall, a floor under a lintel no soffit', () => {
  const ledge = x => (x >= 2.5 ? .2 : 0), cover = x => (x >= 2.5 ? 1.1 : 0), lintel = x => (x >= 2.5 ? 2.6 : 4);
  const up = fly(bolt({ x: 1, y: 2.9, z: 0, vx: 60, vy: 0, vz: 0 }), { ground: cover, ceil: x => (x >= 2.5 ? 2.8 : 3) }); assert.equal(up.y, 3); assert.deepEqual(up.n.map(r6), [0, -1, 0]);
  const low = fly(bolt({ x: 1, y: .1, z: 0, vx: 60, vy: 0, vz: 0 }), { ground: ledge, ceil: lintel }); assert.equal(low.y, 0); assert.ok(low.n[1] > .9, `n ${low.n}`); }); // a floor normal (the .2 m step reads as slope)
test('a point-blank shot from a muzzle inside a wall marks the wall face on the shooter\'s side', () => { const L = tileLevel(['#######', '#.....#', '#.....#', '#######']);
  const h = fly(bolt({ x: 5.65, y: 1.5, z: 2, vx: 60, vy: 0, vz: 0 }), L); assert.ok(Math.abs(h.x - 5.5) < .01 && h.y === 1.5, `at ${h.x}, ${h.y}`); assert.deepEqual(h.n.map(r6), [-1, 0, 0]); });
