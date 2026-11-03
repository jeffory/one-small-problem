import test from 'node:test'; import assert from 'node:assert/strict'; import { generateWorld } from '../src/gen/world.js'; import { BASE } from '../src/gen/base.js';
import { AREAS, LEVEL, GRAVITY, makeLevel, areaStart, stintEnd } from '../src/game/areas.js'; import { lineOfSight, updateField, UNK } from '../src/game/nav.js'; import { give } from '../src/game/weapons.js';
import { createFight, stepFight, hurtPlayer, skipTo, openBars, canBang, PICKUP, DEATH_TIME } from '../src/game/fight.js'; import { hurtAlien } from '../src/game/aliens.js'; import { MAX_CELLS } from '../src/game/weapons.js'; import { dawdling } from '../src/game/radio.js'; import { KO, BREAK } from '../src/game/escape.js';
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
const atBars = (F, d = 1.2) => { const b = P.bars; put(F, b.x - b.dx * d, b.z - b.dz * d); face(F, b.x, b.z); };
const banged = () => { const F = cellF(); atBars(F); stepFight(F, { ...idle, use: true }, 1 / 60); return F; };
test('the break-out: facing the bars, E bangs once; the guard at BREAK.guard s, the bars drop at BREAK.open s', () => {
  assert.deepEqual(BREAK, { reach: 2, face: .5, guard: 3, open: 4.5, idle: 20, pa: 40 });
  const F = cellF(), b = P.bars; atBars(F, 3); assert.equal(canBang(F), false); atBars(F); F.player.yaw += Math.PI; assert.equal(canBang(F), false);
  atBars(F); assert.ok(canBang(F)); stepFight(F, { ...idle, use: true }, 1 / 60); assert.ok(F.events.some(e => e.type === 'bang')); assert.equal(canBang(F), false);
  run(F, idle, BREAK.guard - .1); assert.ok(!F.aliens.some(a => a.enc.guard)); run(F, idle, .2); const g = F.aliens.find(a => a.enc.guard);
  assert.ok(g && g.id === 1 && g.type === 'sk' && g.area === 4 && g.enc.alerted && g.enc.first && F.cell.shut); assert.ok(Math.hypot(g.x - P.rooms[1].in.x, g.z - P.rooms[1].in.z) < 1);
  run(F, idle, BREAK.open - BREAK.guard); assert.equal(F.cell.shut, false); for (const t of b.tiles) assert.equal(F.lv.grid[t], P.floor[t]);
  stepFight(F, { ...idle, use: true }, 1 / 60); assert.equal(F.aliens.filter(a => a.enc.guard).length, 1, 'E again does nothing'); });
test('spec 4.1: the guard drops pistol and tape; once it is dead you restart freed with them, and no guard', () => {
  const F = banged(); run(F, idle, BREAK.guard + .1); const g = F.aliens.find(a => a.enc.guard); hurtAlien(g, 999, 0, 0); stepFight(F, idle, 1 / 60);
  assert.deepEqual(F.pickups.filter(q => Math.hypot(q.x - g.x, q.z - g.z) < 1).map(q => q.kind).sort(), ['pistol', 'tape']);
  assert.ok(F.cell.freed && F.events.some(e => e.type === 'freed')); assert.deepEqual([F.entry.owned, F.entry.cells], [[true, true, false], PICKUP.pistol]);
  hurtPlayer(F, 999, 0, 0, 0); run(F, idle, DEATH_TIME + .1); assert.deepEqual([F.area, F.cell.shut, F.ars.owned, F.ars.cells, F.ars.cur], [4, false, [true, true, false], PICKUP.pistol, 1]);
  for (const t of P.bars.tiles) assert.equal(F.lv.grid[t], P.floor[t]); run(F, idle, BREAK.open + 1); assert.ok(!F.aliens.some(a => a.enc.guard)); });
test('spec 4.1: dying while the guard lives replays the beat: bars shut, no guard until you bang again', () => {
  const F = banged(); run(F, idle, BREAK.open + .1); assert.equal(F.cell.shut, false); hurtPlayer(F, 999, 0, 0, 0); run(F, idle, DEATH_TIME + .1);
  assert.deepEqual([F.cell.shut, F.cell.bang, F.cell.freed, F.ars.owned], [true, null, false, [true, false, false]]);
  run(F, idle, BREAK.open + 1); assert.ok(F.cell.shut && !F.aliens.some(a => a.enc.guard)); });
test('dying in the step the guard dies still frees you (Review Focus 2)', () => {
  const F = banged(); run(F, idle, BREAK.guard + .1); hurtAlien(F.aliens.find(a => a.enc.guard), 999, 0, 0); F.hp = 0; stepFight(F, idle, 1 / 60);
  assert.deepEqual([F.state, F.cell.freed], ['dead', true]); run(F, idle, DEATH_TIME + .1);
  assert.deepEqual([F.state, F.cell.shut, F.ars.owned[1], F.ars.cells], ['play', false, true, Math.min(MAX_CELLS, PICKUP.pistol)]); });
test('the shut cell nudges every BREAK.idle s with no dawdling; none after the bang; once out a PA every BREAK.pa s', () => {
  const F = cellF(), ev = []; for (let t = 0; t < 2 * BREAK.idle + 1; t += 1 / 30) { stepFight(F, idle, 1 / 30); ev.push(...F.events.filter(e => e.type === 'nudge').map(e => e.n)); F.events.length = 0; }
  assert.deepEqual(ev, [1, 2]); assert.equal(dawdling('play', F), false); atBars(F); stepFight(F, { ...idle, use: true }, 1 / 60); F.events.length = 0;
  run(F, idle, BREAK.open + .1); assert.ok(!F.events.some(e => e.type === 'nudge')); F.god = true; run(F, idle, BREAK.pa); assert.ok(F.events.some(e => e.type === 'pa')); });
test('arriving anywhere but the prison clears the cell (areas 5-6 do not exist yet, so a hook lands on 3)', () => { const F = cellF(); assert.ok(F.cell); skipTo(F, 3); assert.equal(F.cell, null); });
