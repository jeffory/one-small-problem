import test from 'node:test'; import assert from 'node:assert/strict'; import { generateWorld } from '../src/gen/world.js'; import { BASE } from '../src/gen/base.js';
import { AREAS, LEVEL, AREA_TEXT, GRAVITY, makeLevel, areaStart, stintEnd, advanceArea, wayTarget, wayfind } from '../src/game/areas.js'; import { lineOfSight, updateField, UNK } from '../src/game/nav.js'; import { give } from '../src/game/weapons.js';
import { createFight, stepFight, hurtPlayer, skipTo, openBars, canBang, atExit, PICKUP, DEATH_TIME } from '../src/game/fight.js'; import { hurtAlien, createAlien } from '../src/game/aliens.js'; import { MAX_CELLS } from '../src/game/weapons.js'; import { dawdling } from '../src/game/radio.js'; import { KO, BREAK, EXIT, SIGHTS, exitOf } from '../src/game/escape.js';
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
test('arriving anywhere but the prison clears the cell ', () => { const F = cellF(); assert.ok(F.cell); skipTo(F, 3); assert.equal(F.cell, null); });

test('stintEnd stops at the last area and rejects an area that does not exist', () => {
  assert.deepEqual([stintEnd(5), stintEnd(6)], [6, 6]); assert.throws(() => stintEnd(LEVEL.length)); assert.throws(() => stintEnd(-1)); });
test('areas 5-6 on the surface: the climb starts at the hangar door facing out, the dash at the rim facing your lander', () => {
  assert.deepEqual(AREAS, ['surface', 'crater', 'base', 'comms', 'prison', 'climb', 'dash']); assert.deepEqual(LEVEL.slice(4), ['prison', 'surface', 'surface']);
  assert.deepEqual(AREA_TEXT.slice(4), ['THE CELLS', 'THE CLIMB', 'THE DASH']); assert.equal(EXIT.reach, 2.5); const U = W.crater.use, d = W.crater.door, T = W.crater.top, s6 = areaStart(W, 6);
  assert.deepEqual(areaStart(W, 5), { x: U.x, z: U.z, dx: d.dx, dz: d.dz }); const l = Math.hypot(W.lander.x - T.x, W.lander.z - T.z);
  assert.deepEqual([s6.x, s6.z], [T.x, T.z]); assert.ok(Math.abs(s6.dx - (W.lander.x - T.x) / l) < 1e-12 && Math.abs(s6.dz - (W.lander.z - T.z) / l) < 1e-12);
  const F = createFight(W, 5), n1 = W.plan.encounters.reduce((s, e) => s + e.aliens.length, 0);
  assert.ok(F.aliens.length > 0 && F.aliens.every(a => (a.area === 5 || a.area === 6) && a.id > n1)); assert.ok(F.balls.every(b => b.id === 6)); });
test('skipTo starts a new stint fresh, at the area start; a walk within a stint keeps its level (pre-flight F1)', () => {
  const F = createFight(W); skipTo(F, 6); assert.deepEqual([F.area, F.lv.id], [6, 'surface']); assert.ok(near(F.player, areaStart(W, 6), 1e-9), 'at the rim, not the wreck');
  const G = createFight(W); skipTo(G, 5); assert.ok(near(G.player, W.crater.use, 1e-9)); const lv = G.lv, B = W.base; put(G, B.x + B.R * 1.01, B.z); stepFight(G, idle, 1 / 60); assert.deepEqual([G.area, G.lv === lv], [6, true]); });
test('a skip from the cell to the dash leaves no cell and no bars (spec 5)', () => {
  const F = cellF(); skipTo(F, 6); assert.deepEqual([F.area, F.lv.id, F.cell, F.lv.bars ?? null], [6, 'surface', null, null]); assert.ok(near(F.player, areaStart(W, 6), 1e-9)); });
test('E at the exit lift takes you up to the climb: a fresh surface at the hangar door', () => {
  const F = cellF(), e = exitOf(P); openBars(F); put(F, e.x + 1, e.z); assert.ok(atExit(F)); stepFight(F, { ...idle, use: true }, 1 / 60);
  assert.deepEqual([F.area, F.lv.id, F.gravity, F.cell], [5, 'surface', GRAVITY.surface, null]); assert.ok(near(F.player, W.crater.use, 1e-9));
  assert.ok(F.events.some(v => v.type === 'area' && v.area === 5 && v.level && v.text === 'THE CLIMB')); assert.deepEqual(F.entry.owned, F.ars.owned); });
test('the exit lift needs you within reach, alive, in play and in the prison', () => {
  const F = cellF(), e = exitOf(P); put(F, e.x + EXIT.reach + .5, e.z); assert.equal(atExit(F), false); stepFight(F, { ...idle, use: true }, 1 / 60); assert.equal(F.area, 4);
  put(F, e.x + 1, e.z); F.state = 'dead'; assert.equal(atExit(F), false); });
test('back the way you came: E at the door does nothing in the climb; over the rim is the dash, back down stays the dash (Review Focus 4)', () => {
  const F = createFight(W, 5), B = W.base; stepFight(F, { ...idle, use: true }, 1 / 60); assert.deepEqual([F.area, F.lv.id], [5, 'surface']);
  assert.deepEqual([advanceArea(W, 5, B.x, B.z), advanceArea(W, 5, B.x + B.R * 1.01, B.z), advanceArea(W, 6, B.x, B.z)], [5, 6, 6]);
  const G = createFight(W, 6); put(G, B.x + B.R * .9, B.z); stepFight(G, idle, 1 / 60); assert.equal(G.area, 6); assert.deepEqual(wayTarget(W, 6, G.player), { x: W.escape.site.x, z: W.escape.site.z }); });
test('the arrow climbs the switchback to the rim, then points at the rescue site; none in the prison', () => {
  const K = W.crater.path, n = K.length, vx = i => ({ x: K[i][0], z: K[i][1] }); for (let i = n - 1; i > 1; i--) assert.deepEqual(wayTarget(W, 5, vx(i)), vx(i - 1), `${i}`);
  const t = wayTarget(W, 5, vx(1)); assert.deepEqual([t.x, t.z], [W.crater.top.x, W.crater.top.z]); assert.equal(wayTarget(W, 4, P.start), null); assert.ok(wayfind(createFight(W, 5))); });
import { SHIP, FLARE, RING, shipLift, flareAt } from '../src/game/escape.js'; import { PUFF } from '../src/game/lander.js'; import { HOLD, planWaves } from '../src/game/hold.js'; import { OPEN } from '../src/game/opening.js';
import { PLAYER } from '../src/game/player.js'; import { makeRng } from '../src/gen/rng.js'; import { COST } from '../src/gen/encounters.js';
test('the ship comes down on the opening\'s curve, lands, fires its flare 150 m up, opens its hatch', () => {
  assert.deepEqual(SHIP, { clock: 300, warn: 30, calls: [180, 120, 60, 30], r: 2, reach: 1.6, alt: 24, descent: 9, hatch: 1, puffs: 40 }); assert.deepEqual([SHIP.alt, SHIP.descent], [OPEN.alt, OPEN.descent]);
  assert.deepEqual(PUFF, { r: 2.2, v: [9, 14], up: [1, 2.5], life: 3, s: [.35, .7] }); // pre-flight F14
  assert.deepEqual(FLARE, { up: 150, rise: 3, fall: 40, size: .6, ang: .01, trail: 10, gap: .5, col: [2.4, .3, .08] });
  const F = createFight(W, 6), S = F.ship, st = W.escape.site; F.aliens.length = 0; assert.deepEqual([S.landed, S.left, S.W.lift], [false, SHIP.clock, SHIP.alt]); assert.equal(shipLift(SHIP.descent / 2), SHIP.alt / 4);
  run(F, idle, SHIP.descent - .05); assert.ok(!S.landed && S.W.lift > 0 && flareAt(S) === null);
  run(F, idle, .1); assert.ok(S.landed && S.W.lift === 0 && F.events.some(e => e.type === 'flare') && F.parts.some(q => q.kind === 'puff'));
  run(F, idle, FLARE.rise); const f = flareAt(S); assert.ok(Math.abs(f.y - st.y - FLARE.up) < .5 && f.x === st.x && f.z === st.z);
  run(F, idle, FLARE.fall); assert.equal(flareAt(S), null); assert.equal(S.W.hatch, 1); });
test('the ship clock calls its marks; at 0 the ship leaves and the dash restarts at the rim, ship and clock fresh', () => {
  const F = createFight(W, 6), ev = []; F.aliens.length = 0; let t = 0;
  while (F.state === 'play' && t < SHIP.clock + 1) { stepFight(F, idle, .1); t += .1; for (const e of F.events) if (e.type === 'clock' || e.type === 'missed') ev.push(e.n ?? e.type); F.events.length = 0; }
  assert.ok(Math.abs(t - SHIP.clock) < .11, `${t}`); assert.deepEqual(ev, [1, 2, 3, 4, 'missed']); run(F, idle, DEATH_TIME + .1);
  assert.deepEqual([F.state, F.area, F.ship.landed], ['play', 6, false]); assert.ok(F.ship.left > SHIP.clock - .2 && near(F.player, areaStart(W, 6))); });
test('the rush: once landed and near, waves from RING.n points 30-40 m round the ship, ids from RING.id, at most HOLD.cap alive', () => {
  assert.deepEqual(RING, { near: 60, r: [30, 40], n: 6, id: 2000, hover: 3.5, waves: [[0, 4], [5, 5], [10, 6], [15, 6]], cap: 8 });
  const P0 = planWaves(makeRng('r'), RING.n, RING.waves); RING.waves.forEach(([, b], w) => assert.equal(P0.filter(q => q.wave === w).reduce((s, q) => s + COST[q.type], 0), b));
  const F = createFight(W, 6), st = W.escape.site; F.aliens.length = 0; F.god = true; put(F, st.x + RING.near - 5, st.z); run(F, idle, 1); assert.equal(F.ship.ring, null);
  run(F, idle, SHIP.descent); assert.ok(F.ship.ring && F.events.some(e => e.type === 'rush')); assert.equal(F.ship.ring.pts.length, RING.n);
  for (const q of F.ship.ring.pts) { const d = Math.hypot(q.x - st.x, q.z - st.z); assert.ok(d >= RING.r[0] - 1e-9 && d <= RING.r[1] + 1e-9); }
  for (let i = 0; i < 600; i++) { stepFight(F, idle, 1 / 30); const R = F.aliens.filter(a => a.id >= RING.id && a.state !== 'dead'); assert.ok(R.length <= HOLD.cap && R.every(a => a.area === 6 && a.enc.alerted)); }
  assert.ok(F.aliens.some(a => a.id >= RING.id)); });
test('the landed ship is solid: you are pushed off its deck', () => {
  const F = createFight(W, 6), st = W.escape.site; F.aliens.length = 0; run(F, idle, SHIP.descent + .1); put(F, st.x + .5, st.z); stepFight(F, idle, 1 / 60);
  assert.ok(Math.hypot(F.player.x - st.x, F.player.z - st.z) >= SHIP.r + PLAYER.radius - 1e-6); });
test('the rush holds back while RING.cap live aliens of the dash are within RING.near of the ship, as the hold caps its own (fix: the crowded rush)', () => {
  const F = createFight(W, 6), st = W.escape.site, far = { x: 1e5, z: 1e5, p: 1, first: false, area: 6, room: -1, alerted: false, waved: false }; F.aliens.length = 0; F.god = true; put(F, st.x + RING.near - 5, st.z);
  for (let i = 0; i < RING.cap; i++) { const x = st.x - 20, z = st.z - 10 + 3 * i, a = createAlien({ type: 'sk', x, y: F.lv.ground(x, z), z }, 500 + i, far); a.area = 6; F.aliens.push(a); } // asleep: their encounter is far off
  const ring = () => F.aliens.filter(a => a.id >= RING.id && a.state !== 'dead').length;
  run(F, idle, SHIP.descent + 6); assert.ok(F.ship.ring && F.ship.ring.t > 5); assert.equal(ring(), 0);
  hurtAlien(F.aliens[0], 999, 0, 0); run(F, idle, 3); assert.equal(ring(), 1); });
import { LIFT, ladderAt } from '../src/game/escape.js'; import { atLadder } from '../src/game/fight.js'; import { createLiftoff, stepLiftoff } from '../src/game/liftoff.js'; import { EGRESS } from '../src/game/opening.js';
const landed = () => { const F = createFight(W, 6); F.aliens.length = 0; run(F, idle, SHIP.descent + .1); F.events.length = 0; return F; };
test('R9 moved: E at the landed ship\'s ladder boards it; the run clock stops for good, nothing hurts; not before, not from afar', () => {
  assert.deepEqual(LIFT, { acc: 2, sting: 6, fade: .8 }); const E = createFight(W, 6), l0 = ladderAt(E.ship); E.aliens.length = 0; put(E, l0.x, l0.z);
  stepFight(E, { ...idle, use: true }, 1 / 60); assert.equal(E.won, false, 'not before touchdown');
  const F = landed(), l = ladderAt(F.ship); put(F, l.x + SHIP.reach + .5, l.z); assert.equal(atLadder(F), false); put(F, l.x, l.z); assert.ok(atLadder(F));
  stepFight(F, { ...idle, use: true }, 1 / 60); assert.deepEqual([F.won, F.wonAt], [true, F.run]); assert.ok(F.events.some(e => e.type === 'board'));
  const r = F.run, hp = F.hp; run(F, idle, 2); hurtPlayer(F, 500, 0, 0, 0); assert.deepEqual([F.run, F.hp, F.state], [r, hp, 'play']); });
test('E at the ladder in the clock\'s last step boards (Review Focus 3)', () => {
  const F = landed(), l = ladderAt(F.ship); put(F, l.x, l.z); F.ship.left = 1 / 120; stepFight(F, { ...idle, use: true }, 1 / 60);
  assert.deepEqual([F.won, F.state], [true, 'play']); assert.ok(!F.events.some(e => e.type === 'missed')); });
test('the lift-off: the ascent stage rises with you, the aliens turn and wave, the sting at LIFT.sting s, once', () => {
  const F = landed(), st = W.escape.site, l = ladderAt(F.ship), a = createAlien({ type: 'sk', x: st.x + 20, y: F.lv.ground(st.x + 20, st.z), z: st.z }, 2500, F.encs[0]);
  a.area = 6; F.aliens.push(a); put(F, l.x, l.z); stepFight(F, { ...idle, use: true }, 1 / 60); const L = createLiftoff(F), y0 = F.player.y, ev = []; let waved = 0;
  assert.equal(L.view.eye, EGRESS[0][3]); assert.ok(L.view.aliens.includes(a));
  for (let t = 0; t < LIFT.sting + 1; t += 1 / 30) { stepLiftoff(L, 1 / 30); ev.push(...L.events.map(e => e.key)); L.events.length = 0; waved = Math.max(waved, a.wave); }
  assert.ok(Math.abs(F.ship.W.up - LIFT.acc * L.t * L.t / 2) < 1e-9 && F.player.y - y0 > 10); assert.deepEqual(ev, ['click', 'sting']); assert.ok(L.sting && waved > .9);
  assert.ok(Math.abs(Math.atan2(st.x - a.x, st.z - a.z) - a.yaw) < 1e-9); });
test('once you are aboard the flare is out, so the rising cabin never meets it (review fix)', () => {
  const F = landed(), l = ladderAt(F.ship); run(F, idle, FLARE.rise); assert.ok(flareAt(F.ship)); put(F, l.x, l.z); stepFight(F, { ...idle, use: true }, 1 / 60);
  assert.ok(F.won); const L = createLiftoff(F); for (let t = 0; t < LIFT.sting; t += 1 / 30) stepLiftoff(L, 1 / 30);
  for (let k = 0; k <= FLARE.trail; k++) assert.equal(flareAt(F.ship, k * FLARE.gap), null, `${k}`); });
import { knockOut } from '../src/game/fight.js'; import { koLight, koLock, wakeIn } from '../src/game/escape.js';
// Plan 6: Houston's call ends in the knock-out: stripped into the shut cell, KO.out s of black (the stamp at KO.stamp), KO.down s on
// the floor with the look locked, KO.getUp s getting up, then THE CELLS
const calling = () => { const F = createFight(W, 3); F.aliens.length = 0; F.ko = { phase: 'call', t: 0 }; return F; };
const through = (F, dt) => { const ev = [], at = {}, p = F.player, x = p.x, z = p.z; let t = 0, moved = 0;
  while (F.ko && t < 20) { stepFight(F, { ...idle, fwd: 1 }, dt); t += dt; for (const e of F.events) if (['stamp', 'wake', 'woke'].includes(e.type)) { ev.push(e.type); at[e.type] = t; }
    F.events.length = 0; if (F.ko && F.ko.phase !== 'up') moved = Math.max(moved, Math.hypot(p.x - x, p.z - z)); } return { ev, at, moved }; };
test('the knock-out: stripped into the shut cell; black, the stamp, the wake on the floor, look locked, up, THE CELLS', () => {
  const F = calling(); give(F.ars, 1, 80); F.hp = 33; assert.ok(knockOut(F)); const r0 = F.run;
  assert.deepEqual([F.area, F.lv.id, F.ko.phase, F.hp, F.ars.owned, F.ars.cells, F.flag.held, F.cell.shut, F.hold], [4, 'prison', 'out', KO.hp, [true, false, false], 0, true, true, null]);
  assert.deepEqual([F.entry.owned, F.entry.cells, koLight(F), koLock(F), F.eye], [[true, false, false], 0, 0, true, KO.eye]);
  const { ev, at, moved } = through(F, 1 / 30); assert.deepEqual(ev, ['stamp', 'wake', 'woke']); assert.equal(moved, 0, 'still on the floor');
  assert.ok(Math.abs(at.stamp - KO.stamp) < .05 && Math.abs(at.wake - KO.out) < .05 && Math.abs(at.woke - KO.out - KO.down - KO.getUp) < .08, JSON.stringify(at)); // pre-flight F4: with the carried overshoot each is within one 1/30 step
  assert.deepEqual([F.ko, F.eye, koLight(F), koLock(F), wakeIn(F)], [null, undefined, 1, false, 0]); assert.ok(F.run - r0 < .04, 'the run clock stopped'); });
test('a slow frame across the knock-out: each event once, in order (Review Focus 5)', () => { const F = calling(); knockOut(F); assert.deepEqual(through(F, .25).ev, ['stamp', 'wake', 'woke']); });
test('the prison\'s sights: near the cow, the chair and the exit lift each cue once a run', () => {
  assert.deepEqual(SIGHTS, { cow: 5, chair: 4, exit: 12 }); const F = cellF(), ev = []; openBars(F); F.aliens.length = 0; F.god = true;
  for (const k of ['cow', 'chair', 'exit', 'cow']) { const q = P.props.find(o => o.kind === k), d = SIGHTS[k] - .5; put(F, q.x + q.dx * d, q.z + q.dz * d); stepFight(F, idle, 1 / 60);
    ev.push(...F.events.filter(e => ['cow', 'chair', 'hall'].includes(e.type)).map(e => e.type)); F.events.length = 0; }
  assert.deepEqual(ev, ['cow', 'chair', 'hall']); });
