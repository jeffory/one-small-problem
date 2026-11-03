import test from 'node:test'; import assert from 'node:assert/strict'; import { generateWorld } from '../src/gen/world.js'; import { BASE } from '../src/gen/base.js';
import { AREAS, LEVEL, GRAVITY, makeLevel, areaStart, stintEnd } from '../src/game/areas.js'; import { lineOfSight, updateField, UNK } from '../src/game/nav.js'; import { give } from '../src/game/weapons.js';
import { createFight, stepFight, hurtPlayer, skipTo, openBars, DEATH_TIME } from '../src/game/fight.js'; import { KO } from '../src/game/escape.js';
const W = generateWorld('APOLLO-4471'), P = W.prisonMap, idle = { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 };
const run = (F, inp, secs, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) stepFight(F, inp, dt); };
const put = (F, x, z) => Object.assign(F.player, { x, z, y: F.lv.ground(x, z), vx: 0, vy: 0, vz: 0, kx: 0, kz: 0 });
const face = (F, x, z) => { F.player.yaw = Math.atan2(F.player.x - x, F.player.z - z); F.player.pitch = 0; };
const near = (p, s, d = .5) => Math.hypot(p.x - s.x, p.z - s.z) < d;
const fieldAt = (F, x, z) => { const f = F.field; return f.d[(Math.round(z + f.half) - f.oz) * f.n + Math.round(x + f.half) - f.ox]; };
const cellF = () => { const F = createFight(W); skipTo(F, 4); F.events.length = 0; return F; };
test('area 4 is the prison: its own level, gravity 9, started in the cell; stints keep levels apart', () => {
  assert.deepEqual([AREAS[4], LEVEL[4], GRAVITY.prison, stintEnd(0), stintEnd(2), stintEnd(4)], ['prison', 'prison', 9, 1, 3, 4]);
  const F = createFight(W, 4); assert.deepEqual([F.lv.id, F.lv.map, F.gravity, F.cell.shut], ['prison', P, 9, true]); assert.equal(areaStart(W, 4), P.start);
  assert.ok(near(F.player, P.start)); assert.ok(F.aliens.length > 0 && [...F.aliens, ...F.pickups].every(q => q.area === 4)); assert.equal(makeLevel(W, 'base').map, W.baseMap); });
test('shut bars block walking, sight and the nav field; open, the doorway is floor again; the map never changes', () => {
  const F = createFight(W, 4), b = P.bars, p = F.player, out = [b.x + b.dx * 3, b.z + b.dz * 3], see = () => lineOfSight(F.lv.ground, [p.x, p.y + 1.5, p.z], [out[0], p.y + 1.5, out[1]], F.lv.ceil);
  F.aliens.length = 0; for (const t of b.tiles) assert.equal(F.lv.grid[t], BASE.wall); assert.equal(see(), false);
  face(F, b.x, b.z); run(F, { ...idle, fwd: 1 }, 2); assert.ok((p.x - b.x) * b.dx + (p.z - b.z) * b.dz < -.5, 'stopped short');
  updateField(F.field, F.lv.grid, F.lv.n, F.lv.half, p.x, p.z, F.lv.maxStep); assert.equal(fieldAt(F, ...out), UNK);
  openBars(F); for (const t of b.tiles) assert.equal(F.lv.grid[t], P.floor[t]); assert.ok(see()); assert.ok(F.events.some(e => e.type === 'bars'));
  updateField(F.field, F.lv.grid, F.lv.n, F.lv.half, p.x, p.z, F.lv.maxStep); assert.notEqual(fieldAt(F, ...out), UNK);
  run(F, { ...idle, fwd: 1 }, 2); assert.ok((p.x - b.x) * b.dx + (p.z - b.z) * b.dz > .5, 'through'); for (const t of b.tiles) assert.equal(P.floor[t], 0); });
test('skipTo the prison strips you to the flag pole at KO.hp, checkpoint too; a death restarts you, bars shut', () => {
  const F = createFight(W, 3); give(F.ars, 1, 99); give(F.ars, 2, 0); F.hp = 40; skipTo(F, 4);
  assert.deepEqual([F.area, F.lv.id, F.hp, F.ars.owned, F.ars.cells, F.ars.cur, F.flag.held, F.ko], [4, 'prison', KO.hp, [true, false, false], 0, 0, true, null]);
  assert.deepEqual([F.entry.owned, F.entry.cells, F.entry.flagHeld], [[true, false, false], 0, true]); assert.ok(F.events.some(e => e.type === 'area' && e.level));
  openBars(F); hurtPlayer(F, 999, 0, 0, 0); run(F, idle, DEATH_TIME + .1); assert.ok(F.cell.shut && near(F.player, P.start)); for (const t of P.bars.tiles) assert.equal(F.lv.grid[t], BASE.wall); });
