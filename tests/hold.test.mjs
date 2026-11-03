import test from 'node:test'; import assert from 'node:assert/strict'; import { generateWorld } from '../src/gen/world.js'; import { makeRng } from '../src/gen/rng.js';
import { createFight, stepFight, hurtPlayer, knockOut, DEATH_TIME } from '../src/game/fight.js'; import { KO } from '../src/game/escape.js'; import { hurtAlien } from '../src/game/aliens.js'; import { createBot, botStep } from '../src/game/bot.js';
import { HOLD, ENDING, planWaves, dishOf, callSpot } from '../src/game/hold.js';
const W = generateWorld('APOLLO-4471'), M = W.baseMap, idle = { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 };
const run = (F, inp, secs, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) stepFight(F, inp, dt); };
const put = (F, x, z) => Object.assign(F.player, { x, z, y: F.lv.ground(x, z), vx: 0, vy: 0, vz: 0, kx: 0, kz: 0 });
const atArray = () => { const F = createFight(W, 3), s = callSpot(M); put(F, s.x, s.z); return F; };
test('planWaves: the table\'s seven waves, each spending exactly its budget, a brute only from budget 6, spawns HOLD.gap apart round the doors (final stand)', () => {
  const P = planWaves(makeRng('w'), 3), C = { sk: 1, fl: 2, br: 4 }; assert.ok(ENDING.min < ENDING.max);
  HOLD.waves.forEach(([at, b], w) => { const s = P.filter(q => q.wave === w); assert.equal(s.reduce((a, q) => a + C[q.type], 0), b); assert.equal(s.some(q => q.type === 'br'), b >= 6);
    s.forEach((q, i) => { assert.ok(Math.abs(q.at - (at + i * HOLD.gap)) < 1e-9); assert.ok(q.door >= 0 && q.door < 3); if (i) assert.equal(q.door, (s[i - 1].door + 1) % 3); }); });
  for (let i = 1; i < P.length; i++) assert.ok(P[i].at >= P[i - 1].at); assert.deepEqual(planWaves(makeRng('w'), 3), planWaves(makeRng('w'), 3, HOLD.waves)); });
test('E at the comms array puts you on hold with three tapes and two cells on the dais; E at the door does nothing (final stand)', () => {
  const F = atArray(); stepFight(F, { ...idle, use: true }, 1 / 60); assert.ok(F.hold && F.hold.t >= 0); assert.ok(F.events.some(e => e.type === 'hold'));
  const mine = F.pickups.filter(q => q.area === 3), d = dishOf(M); assert.deepEqual(mine.map(q => q.kind).sort(), ['cells', 'cells', 'tape', 'tape', 'tape']);
  for (const q of mine) { assert.ok(Math.hypot(q.x - d.x, q.z - d.z) <= 3.6); assert.ok(Math.abs(q.y - .3) < 1e-6); }
  const G = createFight(W, 3); stepFight(G, { ...idle, use: true }, 1 / 60); assert.equal(G.hold, null); });
test('the waves come out of the spawn doors on time, at most HOLD.cap alive; holdmsg every HOLD.msg s; Houston picks up at HOLD.time and then nothing hurts you (final stand)', () => {
  const F = atArray(); F.god = true; stepFight(F, { ...idle, use: true }, 1 / 60); const plan = F.hold.plan, born = new Map(), ev = []; let live = 0, t = 0;
  while (!F.ko && t < HOLD.time + 2) { stepFight(F, idle, 1 / 30); t += 1 / 30; for (const e of F.events) ev.push([e.type, F.hold.t]); F.events.length = 0;
    for (const a of F.aliens) if (!born.has(a)) { const q = plan[born.size], d = M.spawnDoors[q.door]; born.set(a, F.hold.t);
      assert.equal(a.type, q.type); assert.ok(Math.hypot(a.x - d.x, a.z - d.z) < 1e-9, 'at its door'); assert.ok(F.hold.t >= q.at - 1e-9 && a.area === 3); }
    for (const a of F.aliens) if (a.state !== 'dead' && F.hold.t - born.get(a) > 3) hurtAlien(a, 999, 0, 0); // a defender clears them, so every wave comes
    live = Math.max(live, F.aliens.filter(a => a.state !== 'dead').length); }
  assert.equal(born.size, plan.length); assert.ok(live <= HOLD.cap); assert.ok(F.ko);
  const h = ev.find(e => e[0] === 'houston'); assert.ok(h && Math.abs(h[1] - HOLD.time) <= 1 / 30 + 1e-9);
  assert.equal(ev.filter(e => e[0] === 'holdmsg').length, Math.floor((HOLD.time - HOLD.msg / 2) / HOLD.msg) + 1);
  F.god = false; const hp = F.hp; hurtPlayer(F, 500, 0, 0, 0); assert.equal(F.hp, hp); assert.equal(F.state, 'play'); });
// pre-flight F10: the test above kills each alien after 3 s, so it never reaches the cap; this one fills it
test('at most HOLD.cap hold aliens live at once, and a planned spawn waits for a free slot (final stand)', () => {
  const F = atArray(); F.god = true; stepFight(F, { ...idle, use: true }, 1 / 60); const live = () => F.aliens.filter(a => a.id >= 1000 && a.state !== 'dead');
  F.hold.plan = Array.from({ length: HOLD.cap + 4 }, (_, i) => ({ at: 0, type: 'sk', door: i % M.spawnDoors.length, wave: 0 }));
  stepFight(F, idle, 1 / 30); assert.equal(live().length, HOLD.cap); assert.equal(F.hold.next, HOLD.cap);
  hurtAlien(live()[0], 999, 0, 0); stepFight(F, idle, 1 / 30); assert.equal(live().length, HOLD.cap); assert.equal(F.hold.next, HOLD.cap + 1); });
test('dying during the final stand restarts you at the comms door off hold, its aliens and supplies gone; E at the array starts it again from 0 (final stand)', () => {
  const F = atArray(); F.god = true; stepFight(F, { ...idle, use: true }, 1 / 60); run(F, idle, 10); assert.ok(F.aliens.length > 0);
  F.god = false; hurtPlayer(F, 999, 0, 0, 0); run(F, idle, DEATH_TIME + .1); assert.deepEqual([F.state, F.area, F.hold], ['play', 3, null]);
  assert.equal(F.aliens.length, 0); assert.equal(F.pickups.filter(q => q.area === 3).length, 0); assert.ok(Math.hypot(F.player.x - M.commsDoor.x, F.player.z - M.commsDoor.z) < .5);
  const s = callSpot(M); put(F, s.x, s.z); stepFight(F, { ...idle, use: true }, 1 / 60); assert.ok(F.hold && F.hold.t < .1); });
test('an idle player at the array does not survive the hold: the final stand is a real fight (final stand)', () => {
  const F = atArray(); stepFight(F, { ...idle, use: true }, 1 / 60); let died = false;
  for (let t = 0; t < HOLD.time && !died; t += 1 / 30) { stepFight(F, idle, 1 / 30); died = F.events.some(e => e.type === 'dead'); F.events.length = 0; } assert.ok(died); });
// R7: the brief's "stays within 1 m of the call spot" means it walks back to within 1 m after a knock (claws, lunges and blasts throw
// it metres off), so the longest stretch more than 1 m away is bounded. APOLLO-4471 at fixed 1/30 s steps is the brief's run;
// BOT-0028 and BOT-0007 at uneven frame times cut as main.js does were pinned 3 m off behind the dish pedestal (26.2 s and 11.8 s)
// by a straight walk home.
const finale = (seed, uneven) => { const W = generateWorld(seed), F = createFight(W), bot = createBot(W, makeRng('finale'), 'houston'), r = makeRng('dt' + seed), c = callSpot(W.baseMap);
  F.god = true; let t = 0, off = 0, longest = 0;
  while (!bot.done && t < 900) { const dt = uneven ? Math.min(.25, r.range(1 / 144, 1 / 18)) : 1 / 30, n = Math.max(1, Math.ceil(dt / .05));
    for (let k = 0; k < n; k++) { const inp = botStep(bot, F, dt / n); stepFight(F, k ? { ...inp, use: false, weapon: -1, wheel: 0 } : inp, dt / n);
      if (F.hold && !F.ko) { off = Math.hypot(F.player.x - c.x, F.player.z - c.z) > 1 ? off + dt / n : 0; longest = Math.max(longest, off); } }
    F.events.length = 0; t += dt; }
  return { F, bot, t, longest }; };
test('the immortal bot with the finale on plays a whole run, wreck to Houston, within 800 s, never more than 1 m off the call spot for 5 s on hold (final stand, R7)', () => {
  for (const [seed, uneven] of [['APOLLO-4471', false], ['BOT-0028', true], ['BOT-0007', true]]) { const { F, bot, t, longest } = finale(seed, uneven);
    assert.equal(bot.done, 'houston', seed); assert.ok(F.ko && t < 800, `${seed} ${t}`); assert.ok(longest < 5, `${seed}: ${longest} s more than 1 m off the call spot`); } });
// R8: a death in the step Houston would pick up leaves no Houston behind (hp 0 there stands in for a blow earlier in the step)
test('dying in the step Houston would pick up: no Houston; after the restart you are off hold and not won, and E at the array starts a hold that runs (final stand, R8)', () => {
  const F = atArray(); stepFight(F, { ...idle, use: true }, 1 / 60); F.aliens.length = 0; F.hold.plan.length = 0; F.hold.t = HOLD.time - 1 / 120; F.events.length = 0;
  F.hp = 0; stepFight(F, idle, 1 / 60); assert.ok(!F.events.some(e => e.type === 'houston')); assert.deepEqual([F.state, F.ko], ['dead', null]);
  run(F, idle, DEATH_TIME + .1); assert.deepEqual([F.state, F.hold, F.ko, F.won], ['play', null, null, false]);
  const s = callSpot(M); put(F, s.x, s.z); stepFight(F, { ...idle, use: true }, 1 / 60); const t0 = F.hold.t; run(F, idle, 1, 1 / 30);
  assert.ok(Math.abs(F.hold.t - t0 - 1) < .05, `${F.hold.t}`); assert.equal(F.ko, null); });
// R9 moved (Plan 6): the run clock F.run and the kill count stop at Houston, so a best time doesn't depend on how long Houston's call
// takes, and the invulnerable call can't farm kills; F.time runs on (F.won and F.wonAt now mean boarded)
test('R9 moved: F.run and kills stop at Houston while F.time runs on', () => {
  const F = atArray(); F.god = true; stepFight(F, { ...idle, use: true }, 1 / 60); F.hold.plan = [0, 1].map(door => ({ at: 0, type: 'sk', door, wave: 0 }));
  stepFight(F, idle, 1 / 30); const [a, b] = F.aliens; hurtAlien(a, 999, 0, 0); stepFight(F, idle, 1 / 30); assert.equal(F.kills, 1);
  F.hold.t = HOLD.time - 1 / 60; stepFight(F, idle, 1 / 30); assert.deepEqual([F.ko.phase, F.won, F.wonAt], ['call', false, null]); const at = F.run, t0 = F.time;
  hurtAlien(b, 999, 0, 0); run(F, idle, 5); assert.equal(F.kills, 1); assert.equal(F.run, at); assert.ok(F.time > t0 + 4.9); });
const houston = () => { const F = atArray(); stepFight(F, { ...idle, use: true }, 1 / 60); F.aliens.length = 0; F.hold.plan.length = 0; F.hold.t = HOLD.time; stepFight(F, idle, 1 / 60); F.events.length = 0; return F; };
test('the knock-out comes KO.call s after Houston or at once by knockOut, only once; nothing hurts meanwhile (Review Focus 1)', () => {
  assert.deepEqual(KO, { call: 30, out: 5, stamp: 1.5, fade: 1, down: 3, getUp: .8, eye: .3, pitch: .6, hp: 70, text: 'ANOTHER SMALL PROBLEM' });
  const F = houston(); hurtPlayer(F, 500, 0, 0, 0); assert.equal(F.hp, 100); let t = 0, n = 0;
  while (F.ko.phase === 'call' && t < KO.call + 1) { stepFight(F, idle, .25); t += .25; n += F.events.filter(e => e.type === 'ko').length; F.events.length = 0; }
  assert.ok(Math.abs(t - KO.call) <= .25 + 1e-9, `${t}`); assert.equal(n, 1); assert.equal(knockOut(F), false);
  const G = houston(); assert.equal(knockOut(G), true); assert.equal(knockOut(G), false); assert.equal(G.events.filter(e => e.type === 'ko').length, 1); });
