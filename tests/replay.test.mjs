import test from 'node:test'; import assert from 'node:assert/strict'; import { fakeGL } from './fakegl.mjs';
import { generateWorld } from '../src/gen/world.js'; import { makeRng } from '../src/gen/rng.js'; import { buildSurfaceScene } from '../src/game/surfaceScene.js';
import { createFight, stepFight, hurtPlayer } from '../src/game/fight.js'; import { give } from '../src/game/weapons.js'; import { PLAYER } from '../src/game/player.js'; import { createFightView, fillFrame } from '../src/game/fightView.js';
const W = generateWorld('APOLLO-4471'), COUNT = { dead: 'deaths', restart: 'restarts', kill: 'kills', boom: 'booms' };
// main.js's frame loop over a seeded, uneven frame time between 1/144 and 1/18 s: grab the flag, take the pistol, then run down
// the route at the encounters, strafing, jumping, cycling weapons and firing at the nearest live alien; a blast-like hit at
// frame 900 makes sure of a death mid-fight.
function play(view) {
  const F = createFight(W, { gravity: 3 }), p = F.player, r = makeRng('replay-dt'), out = { deaths: 0, restarts: 0, kills: 0, booms: 0, snaps: [] };
  let V = null, frame = null, t = 0;
  if (view) { const gl = fakeGL(), scene = buildSurfaceScene(gl, W); V = createFightView(gl, scene); frame = { ...scene, exposure: 1 }; }
  const snap = () => JSON.stringify([F.time, F.state, F.deadT, F.hp, F.kills, F.shots, F.shotT, F.hurtT, p, F.ars, F.flag, F.bolts, F.parts, F.decals, F.booms, F.pickups,
    F.canisters, F.aliens.map(a => ({ ...a, enc: F.encs.indexOf(a.enc) })), F.encs, F.rng.next()]);
  for (let i = 0; i < 2400; i++) {
    const el = r.range(1 / 144, 1 / 18), dt = Math.min(.25, el), n = Math.max(1, Math.ceil(dt / .05));
    const go = F.flag.held ? F.encs[Math.min(F.encs.length - 1, 1 + (i / 500 | 0))] : F.flag;
    let tgt = go, best = 1600;
    if (F.flag.held) for (const a of F.aliens) { const d = (a.x - p.x) ** 2 + (a.z - p.z) ** 2; if (a.state !== 'dead' && d < best) { best = d; tgt = a; } }
    p.yaw = Math.atan2(p.x - tgt.x, p.z - tgt.z); p.pitch = tgt === go ? 0 : Math.atan2(tgt.y + .6 - p.y - PLAYER.eye, Math.sqrt(best));
    const inp = { fwd: 1, strafe: (i / 90 | 0) % 2 ? 1 : -1, run: i % 400 < 300, jump: i % 97 === 0, fire: F.flag.held, use: !F.flag.held,
      weapon: i % 300 === 150 ? 1 : -1, wheel: i % 211 === 0 ? 1 : 0 };
    if (i === 60) give(F.ars, 1, 150);
    if (i === 900) hurtPlayer(F, 999, 0, 4, 0);
    for (let k = 0; k < n; k++) stepFight(F, k ? { ...inp, use: false, weapon: -1, wheel: 0 } : inp, dt / n);
    for (const e of F.events) if (COUNT[e.type]) out[COUNT[e.type]]++;
    F.events.length = 0; t += el;
    if (view) fillFrame(V, F, frame, t);
    if (i === 1200 || i === 2399) out.snaps.push(snap());
  }
  return out;
}
test('a fight over an uneven frame rate, with a death and a restart, replays bit for bit, with or without the view (M11)', () => {
  const a = play(false), b = play(true);
  assert.ok(a.deaths >= 1 && a.restarts >= 1 && a.kills >= 1, `deaths ${a.deaths} restarts ${a.restarts} kills ${a.kills}`);
  assert.equal(a.snaps[0], b.snaps[0]); assert.equal(a.snaps[1], b.snaps[1]); assert.deepEqual([a.deaths, a.restarts, a.kills, a.booms], [b.deaths, b.restarts, b.kills, b.booms]); });
