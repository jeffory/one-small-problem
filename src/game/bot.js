// The attract bot: plays a run behind the title through the same Input the keyboard gives, and turns the player as a mouse
// would. It grabs the flag, follows the route and the crater switchback to the hangar door, then a distance field through the
// base to the comms room (and with the finale on, on to the array, where it calls and holds out by the call spot until Houston
// picks up); it aims at the nearest alien it can see, with noise, fires when on target, and dodges. It never gives up a run by
// dying (the fight is god mode), only by finishing it or stalling. Pure: no DOM, GPU or clock, and its noise
// comes from the rng it is given, so the same seed and frame times replay the same run.
import { lineOfSight, descend } from './nav.js';
import { worldSpheres } from './rigs.js';
import { PLAYER } from './player.js';
import { WEAPONS } from './weapons.js';
import { DOOR_REACH } from './fight.js';
import { HOLD, dishOf, callSpot } from './hold.js';
import { BASE } from '../gen/base.js';
import { N, MAX_STEP, MAP_MARGIN, distToPolyline } from '../gen/surface.js';
import { cameraBasis } from '../gfx/math.js';

// wp: a route waypoint this near (m) is passed; turn: the most yaw, and the most pitch, turned per second (rad); fire: the aim
// error (rad) it fires under; sight: how far (m) it looks for a target; noise: the aim noise, each way (rad); strafe: how often
// (s) its dodge flips; stuck: seconds without progress before it jiggles, and again at each multiple; stall: seconds without
// progress before it gives up the run; use: how near the flag (m) it presses E.
export const BOT = { wp: 3, turn: 5, fire: .052, sight: 40, noise: .04, strafe: 1.3, stuck: 3, stall: 45, use: 1.6 };
// GAIN: the drop in the distance left (m or field steps) that counts as progress; JIG: how long a jiggle lasts (s); NOISE_T: how
// often the aim noise is redrawn (s); DODGE: the dodge strafe; POLE: how near (m) a target must be to swing the flag pole at it;
// SCATTER: how near for the scattergun; STAY: on hold it keeps within this of the call spot (m): it walks back once half of it away.
const GAIN = 1, JIG = 1, NOISE_T = .5, DODGE = .6, POLE = 2.4, SCATTER = 10, PITCH = 1.5, STAY = 1;
const DI = [1, -1, 0, 0], DJ = [0, 0, 1, -1], IDLE = { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), clamp = (v, m) => Math.max(-m, Math.min(m, v));

// BFS steps from cell (i, j) to every cell of the n x n grid reachable through 4-neighbours whose heights differ by at most
// step; cells at or above wall, and within margin of the edge, are left out. Unreached cells are -1. (The distance version of
// passable.reachMap's flood fill, which generation keeps as it is.)
export function gridField(grid, n, i, j, step, wall = Infinity, margin = 0) {
  const d = new Int32Array(n * n).fill(-1), lo = margin, hi = n - 1 - margin;
  const open = (a, b) => a >= lo && a <= hi && b >= lo && b <= hi && grid[b * n + a] < wall;
  if (!open(i, j)) return d;
  const Q = new Int32Array(n * n); let h = 0, t = 0;
  d[Q[t++] = j * n + i] = 0;
  while (h < t) {
    const c = Q[h++], a = c % n, b = (c - a) / n;
    for (let k = 0; k < 4; k++) {
      const x = a + DI[k], z = b + DJ[k], q = z * n + x;
      if (!open(x, z) || d[q] >= 0 || Math.abs(grid[q] - grid[c]) > step) continue;
      d[q] = d[c] + 1; Q[t++] = q;
    }
  }
  return d;
}
// The base's field from the tile under (x, z): every floor tile, by steps a body can climb.
export const baseField = (B, x, z) => gridField(B.floor, B.n, Math.round(x + B.half), Math.round(z + B.half), BASE.step, BASE.wall);

// The descent of field d (n x n, cell (i, j) at world (i - h, j - h)) from the cell under (x, z): [x, z, value] of the best
// neighbour cell, or null.
function down(d, n, h, x, z) {
  const i = Math.round(x + h), j = Math.round(z + h), s = descend((a, b) => (a < 0 || b < 0 || a >= n || b >= n ? -1 : d[b * n + a]), i, j);
  return s && [i + s[0] - h, j + s[1] - h, s[2]];
}

// A bot for a fight on world, from the wreck. finale: it plays on into the comms room (Task 5) instead of stopping at its door.
// path: the route, the switchback and the hangar door's use spot; k: the waypoint it heads for; sf: the surface field to the
// use spot; bf: the base field to the comms door, cf: to the call spot (each made on arrival). still/best: the progress timer
// and its mark (see botStep).
export function createBot(world, rng, finale = false) {
  const U = world.crater.use, h = world.half;
  return { rng, finale, stage: 'flag', path: [...world.route, ...world.crater.path.slice(1), [U.x, U.z]], k: 1,
    sf: gridField(world.occ, N, Math.round(U.x + h), Math.round(U.z + h), MAX_STEP, Infinity, MAP_MARGIN), bf: null, cf: null, done: null,
    still: 0, best: Infinity, jig: 0, side: 1, noiseT: 0, ny: 0, np: 0, dodgeT: 0, dodge: 1 };
}

// dt seconds of play: the Input for this step. It also turns F.player, at most BOT.turn rad/s in yaw and in pitch.
export function botStep(bot, F, dt) {
  const p = F.player, A = F.ars, W = F.world, R = bot.rng;
  // 1. done at the comms room's door (unless it plays the finale), when Houston picks up, or stalled
  if (F.area === 3 && !bot.finale) bot.done = 'comms';
  if (F.won) bot.done = 'houston';
  if (bot.done) return { ...IDLE };
  // the stage: each belongs to one level (in the base, to the comms room, then the array, then on hold), so a new level is
  // always a new stage, and progress starts over
  const stage = F.lv.id !== 'base' ? (F.flag.held ? 'route' : 'flag') : F.area < 3 ? 'base' : F.hold ? 'hold' : 'call', inp = { ...IDLE, run: true };
  if (stage !== bot.stage) Object.assign(bot, { stage, still: 0, best: Infinity, jig: 0 });

  // 2. the goal (gx, gz) and the distance left, rem; on hold, the call spot, and parked: standing within STAY / 2 of it
  let gx, gz, rem, parked = false;
  if (stage === 'base') {
    const B = W.baseMap, s = down(bot.bf ??= baseField(B, B.commsDoor.x, B.commsDoor.z), B.n, B.half, p.x, p.z);
    [gx, gz, rem] = s || [B.commsDoor.x, B.commsDoor.z, Infinity];
  } else if (stage === 'call') {
    const B = W.baseMap, c = callSpot(B), d = dishOf(B), s = down(bot.cf ??= baseField(B, c.x, c.z), B.n, B.half, p.x, p.z);
    [gx, gz, rem] = s || [c.x, c.z, Infinity];
    inp.use = Math.hypot(d.x - p.x, d.z - p.z) <= HOLD.reach - .3;
  } else if (stage === 'hold') {
    const c = callSpot(W.baseMap); gx = c.x; gz = c.z; rem = 0; parked = Math.hypot(gx - p.x, gz - p.z) < STAY / 2;
  } else if (stage === 'flag') {
    gx = F.flag.x; gz = F.flag.z; rem = Math.hypot(gx - p.x, gz - p.z); inp.use = rem < BOT.use;
  } else {
    // pick up from the nearest leg at or after the current one (knocked down the switchback, or onto the crater floor), pass
    // the waypoints in reach, and when stuck follow the surface field instead, round bunkers, rims and ledges
    const P = bot.path, L = P.length, U = W.crater.use; let j = bot.k - 1, bd = Infinity;
    for (let q = bot.k - 1; q < L - 1; q++) { const d = distToPolyline(p.x, p.z, [P[q], P[q + 1]]); if (d < bd) { bd = d; j = q; } }
    if (j >= bot.k) bot.k = j + 1;
    while (bot.k < L - 1 && Math.hypot(P[bot.k][0] - p.x, P[bot.k][1] - p.z) < BOT.wp) bot.k++;
    [gx, gz] = P[bot.k];
    const s = down(bot.sf, N, W.half, p.x, p.z); rem = s ? s[2] : Infinity;
    if (s && bot.still >= BOT.stuck) { gx = s[0]; gz = s[1]; }
    if (F.area === 1) inp.use = Math.hypot(U.x - p.x, U.z - p.z) <= DOOR_REACH - .5;
  }

  // 3. progress: a gain of GAIN on the best so far resets the stuck timer; each BOT.stuck s without one, jiggle for JIG s
  // (jumping, strafing to a random side) and take the current rem as the best, so ground won back after a knock-back counts.
  // BOT.stall s without progress gives the run up (ruling R4, the probed rule). Pre-flight F18's variant, a separate stall timer
  // that only an all-time best resets, was measured at 468/480 runs: it gave up on bots knocked far back that won the ground
  // back too slowly, and stranded BOT-0036 behind the hangar bunker. In 72 test pens this rule always gives up by 47.6 s.
  // On hold there is nowhere left to go: the hold itself ends the run.
  if (stage !== 'hold') {
    if (rem < bot.best - GAIN) { bot.best = rem; bot.still = 0; }
    else { const s0 = bot.still; bot.still += dt; if (Math.floor(bot.still / BOT.stuck) > Math.floor(s0 / BOT.stuck)) { bot.jig = JIG; bot.side = R.next() < .5 ? -1 : 1; bot.best = rem; } }
    if (bot.still > BOT.stall) { bot.done = 'stall'; return { ...IDLE }; }
  }

  // 4. the target: the nearest live alien in sight whose first sphere the eye can see; the aim noise is redrawn every NOISE_T s
  const ex = p.x, ey = p.y + PLAYER.eye, ez = p.z, eye = [ex, ey, ez]; let T = null, td = BOT.sight;
  for (const a of F.aliens) {
    if (a.state === 'dead' || Math.abs(a.x - ex) > td + 3 || Math.abs(a.z - ez) > td + 3) continue;
    const s = worldSpheres(a)[0], d = Math.hypot(s[0] - ex, s[1] - ey, s[2] - ez);
    if (d < td && lineOfSight(F.lv.ground, eye, s, F.lv.ceil)) { T = s; td = d; }
  }
  if ((bot.noiseT -= dt) <= 0) { bot.noiseT += NOISE_T; bot.ny = R.range(-BOT.noise, BOT.noise); bot.np = R.range(-BOT.noise, BOT.noise); }

  // 5. turn toward the target (with the noise), else the goal (parked, keep the facing), level
  let wy = parked ? p.yaw : Math.atan2(p.x - gx, p.z - gz), wp = 0;
  if (T) { const dx = T[0] - ex, dz = T[2] - ez; wy = Math.atan2(-dx, -dz) + bot.ny; wp = clamp(Math.atan2(T[1] - ey, Math.hypot(dx, dz)) + bot.np, PITCH); }
  const m = BOT.turn * dt;
  p.yaw += clamp(wrap(wy - p.yaw), m); p.pitch += clamp(wp - p.pitch, m);

  // 6. move toward the goal whatever the facing (analog keys), unless parked; with a target walk, dodging side to side
  // (on hold the walk back to the call spot outpulls the dodge); jiggle when stuck
  const rel = Math.atan2(p.x - gx, p.z - gz) - p.yaw;
  if (!parked) { inp.fwd = Math.cos(rel); inp.strafe = -Math.sin(rel); }
  if ((bot.dodgeT += dt) >= BOT.strafe) { bot.dodgeT -= BOT.strafe; bot.dodge = -bot.dodge; }
  if (T) { inp.strafe += DODGE * bot.dodge; inp.run = false; }
  if (bot.jig > 0) { bot.jig -= dt; inp.jump = true; inp.strafe = bot.side; }

  // 7. the weapon: the scattergun near, else the pistol, else the pole; fire when the view is within BOT.fire of the target's
  // first sphere (the 3D angle), with a gun, or with the pole in reach
  inp.weapon = A.owned[2] && A.cells >= WEAPONS[2].cells && T && td < SCATTER ? 2 : A.owned[1] && A.cells >= WEAPONS[1].cells ? 1 : 0;
  if (T) {
    const f = cameraBasis(p.yaw, p.pitch).f, w = A.owned[inp.weapon] ? inp.weapon : A.cur;
    inp.fire = (w > 0 || (w === 0 && td < POLE)) && Math.acos(Math.min(1, ((T[0] - ex) * f[0] + (T[1] - ey) * f[1] + (T[2] - ez) * f[2]) / td)) < BOT.fire;
  }
  return inp;
}
