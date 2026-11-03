import test from 'node:test'; import assert from 'node:assert/strict'; import { generateWorld } from '../src/gen/world.js'; import { makeRng } from '../src/gen/rng.js'; import { K } from '../src/gen/base.js';
import { createFight, stepFight, skipTo } from '../src/game/fight.js'; import { SHIP } from '../src/game/escape.js'; import { give } from '../src/game/weapons.js'; import { worldSpheres } from '../src/game/rigs.js'; import { PLAYER } from '../src/game/player.js';
import { cameraBasis } from '../src/gfx/math.js'; import { BOT, createBot, botStep, baseField } from '../src/game/bot.js';
const W = generateWorld('APOLLO-4471'), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// main.js's loop: uneven frames from 1/144 to 1/18 s, cut into sub-steps of at most .05 s. A bot playing to to, from the wreck or,
// for k >= 4, from area k's start (skipTo), until done, secs or until(F); start: where it began (pre-flight F1: each test checks
// it, so a skipTo that did nothing cannot pass); missed: the rescue ships that left without it (F10).
function run(world, secs, to = 'comms', k = 0, until = () => false) { const F = createFight(world), bot = createBot(world, makeRng(world.seed + '/bot'), to), r = makeRng('bot-dt'); F.god = true;
  if (k >= 4) skipTo(F, k);
  const start = { area: F.area, x: F.player.x, z: F.player.z }; let t = 0, turn = 0, missed = 0;
  while (!bot.done && t < secs && !until(F)) { const dt = Math.min(.25, r.range(1 / 144, 1 / 18)), n = Math.max(1, Math.ceil(dt / .05));
    for (let k = 0; k < n; k++) { const y0 = F.player.yaw, inp = botStep(bot, F, dt / n); turn = Math.max(turn, Math.abs(wrap(F.player.yaw - y0)) / (dt / n));
      stepFight(F, k ? { ...inp, use: false, weapon: -1, wheel: 0 } : inp, dt / n); }
    missed += F.events.filter(e => e.type === 'missed').length; F.events.length = 0; t += dt; }
  return { F, bot, t, turn, start, missed }; }
test('the immortal bot plays from the wreck to the comms room within 600 s at uneven frame rates, turning no faster than BOT.turn (attract)', () => {
  const { F, bot, t, turn } = run(W, 900); assert.equal(bot.done, 'comms'); assert.equal(F.area, 3); assert.ok(t < 600, `${t} s`); assert.ok(F.kills > 0); assert.ok(turn <= BOT.turn + 1e-6, `${turn}`); });
test('the same seed and frame times replay the same run (attract)', () => { const a = run(W, 60), b = run(W, 60);
  assert.equal(JSON.stringify([a.F.player, a.F.kills, a.bot.k, a.bot.stage]), JSON.stringify([b.F.player, b.F.kills, b.bot.k, b.bot.stage])); });
test('a bot that cannot get anywhere gives up within BOT.stall + 2 s (Review Focus 5)', () => { const F = createFight(W), p = F.player, bot = createBot(W, makeRng('stuck')); F.god = true; F.aliens.length = 0;
  const x0 = p.x, z0 = p.z, y0 = p.y; F.lv.ground = F._ctx.ground = (x, z) => (Math.hypot(x - x0, z - z0) > 1.5 ? 99 : y0); let t = 0;
  while (!bot.done && t < BOT.stall + 10) { stepFight(F, botStep(bot, F, 1 / 30), 1 / 30); t += 1 / 30; } assert.equal(bot.done, 'stall'); assert.ok(t <= BOT.stall + 2, `${t}`); });
test('it fires only with its aim within BOT.fire of a live alien (attract)', () => { const F = createFight(W), p = F.player, bot = createBot(W, makeRng('aim')), e = F.encs[1]; F.god = true;
  give(F.ars, 0, 0); give(F.ars, 1, 150); F.flag.held = true; Object.assign(p, { x: e.x + 15, z: e.z, y: F.lv.ground(e.x + 15, e.z) }); let shots = 0;
  for (let i = 0; i < 900; i++) { const inp = botStep(bot, F, 1 / 60);
    if (inp.fire) { const f = cameraBasis(p.yaw, p.pitch).f, eye = [p.x, p.y + PLAYER.eye, p.z]; shots++;
      assert.ok(F.aliens.some(a => a.state !== 'dead' && worldSpheres(a).some(s => { const d = [s[0] - eye[0], s[1] - eye[1], s[2] - eye[2]], l = Math.hypot(...d);
        return Math.acos(Math.min(1, (d[0] * f[0] + d[1] * f[1] + d[2] * f[2]) / l)) <= BOT.fire + 1e-9; })), `shot at step ${i} is off target`); }
    stepFight(F, inp, 1 / 60); } assert.ok(shots > 0); });
test('baseField reaches every floor tile from the comms door and nothing else (attract)', () => { for (const seed of ['APOLLO-4471', 'EAGLE-0001', 'SOAK-0042']) {
  const B = generateWorld(seed).baseMap, d = baseField(B, B.commsDoor.x, B.commsDoor.z), at = (x, z) => Math.round(z + B.half) * B.n + Math.round(x + B.half);
  assert.equal(d[at(B.commsDoor.x, B.commsDoor.z)], 0); assert.ok(d[at(B.start.x, B.start.z)] > 0);
  for (let t = 0; t < B.n * B.n; t++) assert.equal(d[t] >= 0, B.kind[t] === K.floor, `${seed} tile ${t}`); } });
// R21: an attract run never lasts longer than BOT.max s of sim time, whatever its progress (the soak's longest reach is ~297 s)
test('an attract run that is still making progress is given up after BOT.max s (R21)', () => {
  const F = createFight(W), bot = createBot(W, makeRng('max')); F.god = true;
  F.time = BOT.max - .01; botStep(bot, F, 1 / 60); assert.equal(bot.done, null);
  F.time = BOT.max + .01; assert.deepEqual(botStep(bot, F, 1 / 60), { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 }); assert.equal(bot.done, 'stall'); });
test('the soak bot breaks out: bangs, beats the guard, takes the lift within 300 s (Plan 6)', () => {
  const { F, bot, t, start } = run(W, 400, 'board', 4, f => f.area >= 5); assert.deepEqual([start.area, start.x, start.z], [4, W.prisonMap.start.x, W.prisonMap.start.z]); assert.ok(F.area === 5 && t < 300, `${bot.stage} ${t}`); });
test('from the climb the soak bot boards the ship with the clock to spare (Plan 6)', () => {
  const { F, bot, t, start, missed } = run(W, 600, 'board', 5); assert.deepEqual([start.area, start.x, start.z], [5, W.crater.use.x, W.crater.use.z], 'starts at the hangar door, not the wreck');
  assert.equal(bot.done, 'board', `${bot.stage} ${t}`); assert.equal(missed, 0); assert.ok(F.won && F.ship.left > .3 * SHIP.clock, `${F.ship.left}`); });
// pre-flight F16: the knock-out (KO.call + out + down + getUp, 38.8 s of the 45 s BOT.stall) is idled through and never counts as a
// stall; a soak run is given up only after BOT.full s
test('the soak bot idles through the knock-out without stalling and gives up only after BOT.full s (Plan 6, F16)', () => {
  const F = createFight(W, 3), bot = createBot(W, makeRng('ko'), 'board'), idle = { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 };
  F.ko = { phase: 'call', t: 0 };
  for (let t = 0; t < BOT.stall + 10; t += 1 / 30) assert.deepEqual(botStep(bot, F, 1 / 30), idle);
  assert.deepEqual([bot.stage, bot.done], ['ko', null]);
  F.ko = null; F.time = BOT.max + .01; botStep(bot, F, 1 / 60); assert.equal(bot.done, null);
  F.time = BOT.full + .01; assert.deepEqual(botStep(bot, F, 1 / 60), idle); assert.equal(bot.done, 'stall'); });
