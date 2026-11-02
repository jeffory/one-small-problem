import test from 'node:test'; import assert from 'node:assert/strict'; import { makeRng } from '../src/gen/rng.js';
import { ALIENS, WAVE_TIME, createAlien, stepAlien, hurtAlien } from '../src/game/aliens.js'; import { muzzleWorld } from '../src/game/rigs.js'; import { PLAYER } from '../src/game/player.js'; import { tileLevel } from './helpers.mjs';
const enc = (o = {}) => ({ x: 0, z: 0, alerted: false, waved: false, ...o });
const world = (aliens, o = {}) => { const W = { shots: [], hits: [], states: new Map(), now: 0 }; W.ctx = { px: 0, py: 0, pz: 0, ground: () => 0, los: () => true, field: null, others: aliens, rng: makeRng('t'),
  shoot: (a, from, dir, spec) => W.shots.push({ a, from, dir, spec, t: W.ctx.now, at: muzzleWorld(a) }), melee: (a, dmg, k) => W.hits.push({ a, dmg, k, t: W.ctx.now }), now: 0, ...o }; return W; };
const sim = (W, secs, dt = 1 / 60) => { for (let i = 0, n = Math.round(secs / dt); i < n; i++) { W.ctx.now += dt; for (const a of W.ctx.others) { stepAlien(a, W.ctx, dt); (W.states.get(a) ?? W.states.set(a, new Set()).get(a)).add(a.state); } } };
const yawOf = d => Math.atan2(d[0], d[2]);
test('idle until it sees you; no sight keeps it idle', () => { const a = createAlien({ type: 'sk', x: 0, y: 0, z: -30 }, 1, enc()), W = world([a], { los: () => false });
  sim(W, 2); assert.equal(a.state, 'idle'); assert.equal(W.shots.length, 0); W.ctx.los = () => true; sim(W, .1); assert.notEqual(a.state, 'idle'); });
test('the first of an encounter to see you waves before it shoots; its mates do not wave', () => { const e = enc(), a = createAlien({ type: 'sk', x: 0, y: 0, z: -15 }, 1, e), b = createAlien({ type: 'sk', x: 3, y: 0, z: -15 }, 2, e), W = world([a, b]);
  sim(W, WAVE_TIME + 2.5); assert.ok(W.states.get(a).has('wave')); assert.ok(!W.states.get(b).has('wave'));
  assert.equal(W.shots.filter(s => s.a === a && s.t < WAVE_TIME).length, 0); assert.ok(W.shots.some(s => s.a === a)); });
test('every shot leaves its muzzle and heads for your chest', () => { for (const type of ['sk', 'fl', 'br']) { const a = createAlien({ type, x: 0, y: type === 'fl' ? 3.5 : 0, z: -14 }, 1, enc({ waved: true })), W = world([a]);
  sim(W, 6); assert.ok(W.shots.length > 0, type);
  for (const s of W.shots) { assert.ok(Math.hypot(s.from[0] - s.at[0], s.from[1] - s.at[1], s.from[2] - s.at[2]) < 1e-9, type);
    const c = [-s.from[0], 1.2 - s.from[1], -s.from[2]], l = Math.hypot(...c), cos = (c[0] * s.dir[0] + c[1] * s.dir[1] + c[2] * s.dir[2]) / l / Math.hypot(...s.dir);
    assert.ok(Math.acos(Math.min(1, cos)) <= ALIENS[type].aimErr + (type === 'br' ? ALIENS.br.fanSpread : 0) + .01, type); } } });
test('skitterers close in, lunge and bite once per lunge', () => { const a = createAlien({ type: 'sk', x: 0, y: 0, z: -12 }, 1, enc({ waved: true })), W = world([a]);
  sim(W, 6); assert.ok(W.hits.length >= 1); assert.ok(W.hits.every(h => h.dmg === ALIENS.sk.lungeDmg)); for (let i = 1; i < W.hits.length; i++) assert.ok(W.hits[i].t - W.hits[i - 1].t >= .4); });
test('a lunge ends on contact: it bites once and never passes through you, at 20, 60 and 144 fps (R16)', () => { for (const dt of [1 / 20, 1 / 60, 1 / 144]) {
  const a = createAlien({ type: 'sk', x: 0, y: 0, z: -12 }, 1, enc({ waved: true })), W = world([a]), R = ALIENS.sk.radius + PLAYER.radius; let dmin = 9, past = false;
  for (let i = 0, n = Math.round(6 / dt); i < n; i++) { W.ctx.now += dt; stepAlien(a, W.ctx, dt); dmin = Math.min(dmin, Math.hypot(a.x, a.z)); past ||= a.z > 0; if (a.state === 'lunge') assert.ok(a.st < .4 + 1e-9); }
  assert.ok(dmin >= R - 1e-6, `dt ${dt}: ${dmin}`); assert.ok(!past, `dt ${dt}`); assert.ok(W.hits.length >= 2, `dt ${dt}`); for (let i = 1; i < W.hits.length; i++) assert.ok(W.hits[i].t - W.hits[i - 1].t >= .4); } });
test('bumping skitterers tumble and get pushed apart', () => { const e = enc({ alerted: true, waved: true }), a = createAlien({ type: 'sk', x: 0, y: 0, z: -20 }, 1, e), b = createAlien({ type: 'sk', x: .5, y: 0, z: -20 }, 2, e), W = world([a, b]);
  for (const x of [a, b]) x.state = 'chase'; sim(W, 1); assert.ok(W.states.get(a).has('tumble') || W.states.get(b).has('tumble')); assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= .8); });
test('floaters hold their height and keep their distance', () => { const a = createAlien({ type: 'fl', x: 0, y: 3.5, z: -5 }, 1, enc({ waved: true })), W = world([a]);
  sim(W, 5); const d = Math.hypot(a.x, a.z); assert.ok(d >= 9 && d <= 21, `d ${d}`); assert.ok(a.y >= 3 && a.y <= 4.5, `y ${a.y}`); });
test('floaters telegraph before every shot', () => { const a = createAlien({ type: 'fl', x: 0, y: 3.5, z: -14 }, 1, enc({ waved: true })), W = world([a]); let aimAt = -1, last = '';
  W.ctx.shoot = (x, from, dir) => { assert.ok(aimAt >= 0 && W.ctx.now - aimAt >= ALIENS.fl.tele - 1 / 60); W.shots.push(1); };
  for (let t = 0; t < 8; t += 1 / 60) { W.ctx.now += 1 / 60; stepAlien(a, W.ctx, 1 / 60); if (a.state === 'aim' && last !== 'aim') aimAt = W.ctx.now; last = a.state; } assert.ok(W.shots.length >= 2); });
test('the brute telegraphs, fires a 5-bolt fan of +-20 degrees, then recovers', () => { const a = createAlien({ type: 'br', x: 0, y: 0, z: -15 }, 1, enc({ waved: true })), W = world([a]);
  sim(W, 7); const t0 = W.shots[0].t, g = W.shots.filter(s => s.t === t0), ys = g.map(s => yawOf(s.dir)); assert.equal(g.length, 5);
  assert.ok(Math.max(...ys) - Math.min(...ys) > .6 && Math.max(...ys) - Math.min(...ys) < .75); const nxt = W.shots.find(s => s.t > t0); assert.ok(!nxt || nxt.t - t0 >= ALIENS.br.cool); });
test('brutes claw when you are close', () => { const a = createAlien({ type: 'br', x: 0, y: 0, z: -2 }, 1, enc({ waved: true })), W = world([a]);
  sim(W, 2); assert.ok(W.hits.some(h => h.dmg === ALIENS.br.clawDmg && h.k === ALIENS.br.clawKnock)); });
test('hurt and kill: alerts, falls over, stops acting', () => { const e = enc(), a = createAlien({ type: 'sk', x: 0, y: 0, z: -30 }, 1, e), W = world([a], { los: () => false });
  assert.equal(hurtAlien(a, 10, 0, 0), false); assert.equal(e.alerted, true); assert.equal(hurtAlien(a, 25, 0, 0), true); assert.equal(a.state, 'dead');
  sim(W, 1); assert.equal(a.fall, 1); assert.equal(W.shots.length, 0); });
test('aliens move at the same pace at 20, 60 and 144 fps (Review Focus 3)', () => { const d = [1 / 20, 1 / 60, 1 / 144].map(dt => {
  const a = createAlien({ type: 'sk', x: 0, y: 0, z: -20 }, 1, enc({ alerted: true, waved: true })), W = world([a]); a.state = 'chase'; sim(W, 1, dt); return Math.hypot(a.x, a.z); });
  assert.ok(Math.max(...d) - Math.min(...d) < .3, d.join()); });
test('chasing skitterers that converge bump and tumble at 60 and 144 fps, despite separation', () => { assert.ok(ALIENS.sk.bump >= 2 * ALIENS.sk.radius + .1);
  for (const dt of [1 / 60, 1 / 144]) { const e = enc({ alerted: true, waved: true }), a = createAlien({ type: 'sk', x: 1.5, y: 0, z: -20 }, 1, e), b = createAlien({ type: 'sk', x: -1.5, y: 0, z: -20 }, 3, e), W = world([a, b]);
    for (const x of [a, b]) x.state = 'chase'; sim(W, 2, dt); assert.ok(W.states.get(b).has('tumble'), `dt ${dt}`); assert.ok(!W.states.get(a).has('tumble'), `dt ${dt}`); } });
test('a bump never tumbles a mate that is not chasing', () => { const e = enc({ alerted: true, waved: true }), a = createAlien({ type: 'sk', x: 0, y: 0, z: -20 }, 1, e), b = createAlien({ type: 'sk', x: .5, y: 0, z: -20 }, 2, e), W = world([a, b]);
  a.state = 'chase'; b.state = 'recover'; sim(W, 1 / 60); assert.notEqual(b.state, 'tumble'); assert.ok(b.tumbleCD <= 0); });
test('walkers look a fixed distance ahead before climbing, so nothing scales the lander at 20, 60 or 144 fps (carry-over)', () => {
  const lander = (x, z) => { const r = Math.hypot(x, z); return r < 2 ? 2.45 : r < 3 ? 2.45 * (3 - r) : 0; };
  for (const type of ['sk', 'br']) for (const dt of [1 / 20, 1 / 60, 1 / 144]) {
    const a = createAlien({ type, x: 0, y: 0, z: -12 }, 2, enc({ alerted: true, waved: true })), W = world([a], { ground: lander, pz: 12, los: () => false }); // id 2: no chase offset (pre-flight F14)
    a.state = 'chase'; let top = 0; for (let t = 0; t < 6; t += dt) { stepAlien(a, W.ctx, dt); top = Math.max(top, a.y); } assert.ok(top < .6, `${type} at ${Math.round(1 / dt)} fps climbed to ${top}`); }
  const b = createAlien({ type: 'br', x: -5, y: 0, z: 0 }, 1, enc({ alerted: true, waved: true })), W = world([b], { ground: x => Math.max(0, x * .3), px: 10, los: () => false });
  b.state = 'chase'; sim(W, 4); assert.ok(b.x > 2, `a gentle ramp is still climbed: x ${b.x}`); });
test('indoors a floater keeps under the ceiling and out of the walls', () => { const L = tileLevel(['#########', ...Array(7).fill('#.......#'), '#########'], { ceil: 4.5 });
  const a = createAlien({ type: 'fl', x: 2, y: 3.8, z: 2 }, 1, enc({ waved: true })), W = world([a], { ground: L.ground, ceil: L.ceil, px: 6, pz: 6 });
  stepAlien(a, W.ctx, 1 / 60); for (let t = 0; t < 8; t += 1 / 60) { stepAlien(a, W.ctx, 1 / 60); assert.ok(a.y + ALIENS.fl.top <= 4.5 + 1e-9, `y ${a.y}`); assert.ok(L.gap(a.x, a.z) >= ALIENS.fl.radius - .05, `in the wall at ${a.x}, ${a.z}`); } });
test('indoors a floater circling past a 1 x 1 pillar keeps its centre at least 0.5 m from the corner, at 20, 60 and 144 fps (R5)', () => {
  const room = Array.from({ length: 27 }, (_, j) => (j === 0 || j === 26 ? '#'.repeat(27) : '#' + '.'.repeat(25) + '#'));
  for (const pi of [15, 16]) { const L = tileLevel(room.map((r, j) => (j === 2 ? r.slice(0, pi) + '#' + r.slice(pi + 1) : r)), { ceil: 5 });
    for (const dt of [1 / 20, 1 / 60, 1 / 144]) { const a = createAlien({ type: 'fl', x: 13, y: 2, z: 2 }, 1, enc({ alerted: true, waved: true })), W = world([a], { ground: L.ground, ceil: L.ceil, px: 13, pz: 13, los: () => false });
      a.state = 'hover'; let gap = 9; for (let t = 0; t < 8; t += dt) { stepAlien(a, W.ctx, dt); gap = Math.min(gap, L.gap(a.x, a.z)); }
      assert.ok(gap >= .5 && gap < ALIENS.fl.radius, `pillar ${pi} at ${Math.round(1 / dt)} fps: ${gap}`); assert.ok(a.x > pi + 1, `pillar ${pi} at ${Math.round(1 / dt)} fps: held at ${a.x}`); } } });
