// Pure alien behaviour: skitterers chase, lunge, bump and tumble; floaters hover, circle and lob slow orbs;
// brutes telegraph a five-bolt fan, claw, and overcommit. Deterministic: all randomness comes from ctx.rng.
import { muzzleWorld } from './rigs.js';
import { fieldDir } from './nav.js';
import { TEAL, SICK } from './weapons.js';
import { PLAYER } from './player.js';
// radius and height: the walkers' collision cylinders (separation, and the player's in fight.js).
export const ALIENS = {
  sk: { hp: 30, speed: 5.5, radius: .45, height: .95, sight: 35, range: 20, cool: 1.3, aimErr: .05, bolt: { speed: 13, dmg: 6, size: .18, col: TEAL },
    lunge: 3, lungeSpeed: 9, lungeDmg: 10, gait: 2.2, bump: 1.0 },
  fl: { hp: 60, speed: 3.5, radius: .75, sight: 40, keep: [10, 20], tele: .7, cool: 2.4, aimErr: .03, bolt: { speed: 6, dmg: 18, size: .38, col: SICK } },
  br: { hp: 160, speed: 2.2, radius: .8, height: 2.4, sight: 40, range: 25, tele: .8, cool: 2.0, recover: 1.2, fan: 5, fanSpread: .349, aimErr: .02,
    bolt: { speed: 11, dmg: 9, size: .3, col: TEAL }, claw: 2.6, clawDmg: 25, clawKnock: 8, staggerChance: .3, gait: 1.2 },
};
export const WAVE_TIME = 1.2, TUMBLE_TIME = 0.7;
// Fixed timings from the behaviour rules; CHEST is the aim height above the player's feet; STEP is the most a walker climbs per move;
// REACH is how far above or below the alien's feet the player can be and still be bitten (sk) or clawed (br).
const LUNGE_TIME = .4, SK_RECOVER = .6, CLAW_WIND = .4, CLAW_RECOVER = 1, STAGGER = 1, LURCH = 1.5, LURCH_TIME = .3, CHEST = 1.2, STEP = .6;
const REACH = { sk: 1.5, br: 2.5 }, ACTIVE = { sk: 'chase', fl: 'hover', br: 'chase' };
const sin = Math.sin, cos = Math.cos, atan2 = Math.atan2;
const go = (a, state, st = 0) => { a.state = state; a.st = st; };
const ease = (v, to, r) => (v < to ? Math.min(to, v + r) : Math.max(to, v - r));
const smooth = v => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x); };

export function createAlien({ type, x, y, z }, id, enc) {
  // hover (floaters) is y - ground at the spawn; createAlien has no ground, so the first stepAlien fills it in.
  return { id, type, enc, x, y, z, yaw: id * 2.39996, hp: ALIENS[type].hp, state: 'idle', st: 0, cool: ALIENS[type].cool * .5, t: 0, gait: 0,
    aim: 0, claw: 0, wave: 0, fall: 0, hover: null, tumbleCD: 0, vx: 0, vz: 0, flash: 0, _bit: false };
}

// Horizontal move. Walkers stay on the ground and refuse (per axis, so they slide) any move after which the ground at their
// leading edge (radius R ahead) is more than STEP above the ground under their centre. That depends on where they stand, not on
// how far one step is, so it doesn't change with frame rate, and it keeps their bodies off steep walls.
export function move(a, ctx, dx, dz) {
  if (a.type === 'fl') { a.x += dx; a.z += dz; return Math.hypot(dx, dz); }
  const R = ALIENS[a.type].radius; let g = ctx.ground(a.x, a.z), m = 0;
  if (dx && ctx.ground(a.x + dx + (dx > 0 ? R : -R), a.z) - g <= STEP) { a.x += dx; g = ctx.ground(a.x, a.z); m += dx * dx; }
  if (dz && ctx.ground(a.x, a.z + dz + (dz > 0 ? R : -R)) - g <= STEP) { a.z += dz; g = ctx.ground(a.x, a.z); m += dz * dz; }
  a.y = g; return Math.sqrt(m);
}
const walk = (a, ctx, h, v) => { a.yaw = h; return move(a, ctx, sin(h) * v, cos(h) * v); };
const heading = (a, ctx, toP) => { const f = ctx.field && fieldDir(ctx.field, a.x, a.z); return f ? atan2(f[0], f[1]) : toP; };
const reach = (a, ctx, r) => Math.hypot(ctx.px - a.x, ctx.pz - a.z) < r && Math.abs(ctx.py - a.y) < REACH[a.type];
// Does a walker's cylinder share heights with the player's (feet to eye)?
export const level = (a, py) => py < a.y + ALIENS[a.type].height && a.y < py + PLAYER.eye;

// Fire from the muzzle at the player's chest, tilted up to aimErr in a random direction; brutes fan `fan` bolts in yaw.
function fire(a, ctx) {
  const T = ALIENS[a.type], m = muzzleWorld(a);
  let dx = ctx.px - m[0], dy = ctx.py + CHEST - m[1], dz = ctx.pz - m[2];
  const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  const h = Math.hypot(dx, dz), rx = h > 1e-9 ? dz / h : 1, rz = h > 1e-9 ? -dx / h : 0; // r: horizontal, perpendicular to d
  const ux = dy * rz, uy = dz * rx - dx * rz, uz = -dy * rx; // u = d x r
  const e = T.aimErr * ctx.rng.next(), q = 2 * Math.PI * ctx.rng.next(), c = cos(e), sr = sin(e) * cos(q), su = sin(e) * sin(q);
  dx = dx * c + rx * sr + ux * su; dy = dy * c + uy * su; dz = dz * c + rz * sr + uz * su;
  const n = T.fan || 1;
  for (let k = 0; k < n; k++) {
    const f = n > 1 ? (k / (n - 1) * 2 - 1) * T.fanSpread : 0, cf = cos(f), sf = sin(f);
    ctx.shoot(a, m, [dx * cf + dz * sf, dy, dz * cf - dx * sf], T.bolt);
  }
}

function skitterer(a, ctx, dt, d, toP) {
  const T = ALIENS.sk;
  switch (a.state) {
    case 'chase':
      // bump: two chasing skitterers within T.bump; the higher id tumbles. T.bump must stay >= 2 * radius + .1, or separation
      // (which holds pairs at the radius sum) keeps them from ever getting that close at high frame rates.
      if (a.tumbleCD <= 0) for (const o of ctx.others) {
        if (o === a || o.type !== 'sk' || o.state !== 'chase' || o.tumbleCD > 0 || Math.hypot(o.x - a.x, o.z - a.z) >= T.bump) continue;
        a.tumbleCD = o.tumbleCD = 4; go(a.id > o.id ? a : o, 'tumble'); break;
      }
      if (a.state !== 'chase') return 0;
      if (d < T.lunge) { a.yaw = toP; a._bit = false; go(a, 'lunge'); return 0; }
      { const m = walk(a, ctx, heading(a, ctx, toP) + (a.id % 5 - 2) * .35, T.speed * dt);
        if (a.cool <= 0 && d < T.range && ctx.los(a)) { fire(a, ctx); a.cool = T.cool + ctx.rng.range(-.3, .3); }
        return m; }
    case 'lunge': { // committed: the dash keeps the heading it started with, so a sidestep makes it overshoot
      // R16: it stops where its path first touches the player (radius sum R), never passing through, and the lunge ends there
      const R = T.radius + PLAYER.radius, hx = sin(a.yaw), hz = cos(a.yaw), ox = ctx.px - a.x, oz = ctx.pz - a.z;
      const s = ox * hx + oz * hz, e = ox * hz - oz * hx, gap = level(a, ctx.py) && s > 0 && e * e < R * R ? Math.max(0, s - Math.sqrt(R * R - e * e)) : 1 / 0;
      const v = T.lungeSpeed * dt, m = walk(a, ctx, a.yaw, Math.min(v, gap));
      if (!a._bit && reach(a, ctx, T.radius + .5)) { a._bit = true; ctx.melee(a, T.lungeDmg, 4); }
      if (gap <= v || a.st >= LUNGE_TIME) go(a, 'recover');
      return m;
    }
    case 'recover': if (a.st >= SK_RECOVER) go(a, 'chase'); return 0;
    case 'tumble':
      a.fall = .5 * sin(Math.PI * Math.min(1, a.st / TUMBLE_TIME));
      if (a.st >= TUMBLE_TIME) { a.fall = 0; go(a, 'chase'); }
      return 0;
  }
  return 0;
}

function floater(a, ctx, dt, dx, dz, d, toP) {
  const T = ALIENS.fl;
  a.yaw = toP;
  if (a.state === 'hover') {
    if (a.cool <= 0 && d < T.sight && ctx.los(a)) { go(a, 'aim'); return 0; } // the view pulses its flash while it aims
    const s = T.speed * dt / (d || 1), w = a.id % 2 ? 1 : -1; // w: which way it circles
    return d < T.keep[0] ? move(a, ctx, -dx * s, -dz * s) : d > T.keep[1] ? move(a, ctx, dx * s, dz * s) : move(a, ctx, dz * s * w, -dx * s * w);
  }
  if (a.state === 'aim' && a.st >= T.tele) { fire(a, ctx); a.cool = T.cool; go(a, 'hover'); }
  return 0;
}

function brute(a, ctx, dt, d, toP) {
  const T = ALIENS.br;
  switch (a.state) {
    case 'chase':
      if (d < T.claw) { a.yaw = toP; go(a, 'claw'); return 0; }
      if (a.cool <= 0 && d < T.range && ctx.los(a)) { a.yaw = toP; go(a, 'aim'); return 0; }
      return walk(a, ctx, heading(a, ctx, toP), T.speed * dt);
    case 'claw':
      a.claw = Math.min(1, a.st / CLAW_WIND);
      if (a.st >= CLAW_WIND) {
        if (reach(a, ctx, T.claw + .5)) ctx.melee(a, T.clawDmg, T.clawKnock);
        go(a, 'recover', T.recover - CLAW_RECOVER); // 'recover' ends at st = T.recover, so this one lasts CLAW_RECOVER
      }
      return 0;
    case 'aim':
      a.yaw = toP; a.aim = atan2(ctx.py + CHEST - muzzleWorld(a)[1], d);
      if (a.st >= T.tele) { fire(a, ctx); a.cool = T.cool; go(a, ctx.rng.next() < T.staggerChance ? 'stagger' : 'recover'); }
      return 0;
    case 'stagger': { // lurch LURCH metres forward over the first LURCH_TIME seconds (the part of this step inside that window)
      const k = Math.min(a.st, LURCH_TIME) - Math.min(a.st - dt, LURCH_TIME), m = k > 0 ? walk(a, ctx, a.yaw, LURCH / LURCH_TIME * k) : 0;
      if (a.st >= STAGGER) go(a, 'chase');
      return m;
    }
    case 'recover': if (a.st >= T.recover) go(a, 'chase'); return 0;
  }
  return 0;
}

export function stepAlien(a, ctx, dt) {
  const T = ALIENS[a.type], fl = a.type === 'fl';
  if (fl && a.hover == null) a.hover = a.y - ctx.ground(a.x, a.z);
  a.t += dt; a.st += dt; a.cool -= dt; a.tumbleCD -= dt; a.flash = Math.max(0, a.flash - 4 * dt);
  let moved = 0;
  if (a.vx || a.vz) { // knock slides the living and the dead
    moved = move(a, ctx, a.vx * dt, a.vz * dt);
    const k = Math.max(0, 1 - 5 * dt); a.vx *= k; a.vz *= k;
    if (a.vx * a.vx + a.vz * a.vz < 1e-4) a.vx = a.vz = 0;
  }
  // poses relax once their state is over (each state that drives one sets it below)
  if (a.state !== 'wave') a.wave = ease(a.wave, 0, 4 * dt);
  if (a.state !== 'claw') a.claw = ease(a.claw, 0, 6 * dt);
  if (a.state !== 'aim') a.aim = ease(a.aim, 0, 2 * dt);
  if (a.state === 'dead') {
    a.fall = Math.max(a.fall, smooth(a.st / .5));
    if (fl) a.y = Math.max(ctx.ground(a.x, a.z), a.y - 3 * a.st * dt); // falls at 3 m/s^2 from the moment of death
    return;
  }
  const dx = ctx.px - a.x, dz = ctx.pz - a.z, d = Math.hypot(dx, dz), toP = atan2(dx, dz);
  if (a.state === 'idle') {
    if (a.enc.alerted || (d < T.sight && ctx.los(a))) {
      a.enc.alerted = true; a.yaw = toP;
      if (a.enc.waved) go(a, ACTIVE[a.type]); else { a.enc.waved = true; go(a, 'wave'); }
    }
  } else if (a.state === 'wave') {
    a.yaw = toP; a.wave = smooth(Math.min(a.st, WAVE_TIME - a.st) / .25);
    if (a.st >= WAVE_TIME) go(a, ACTIVE[a.type]);
  } else moved += a.type === 'sk' ? skitterer(a, ctx, dt, d, toP) : fl ? floater(a, ctx, dt, dx, dz, d, toP) : brute(a, ctx, dt, d, toP);
  if (T.gait) a.gait += moved * T.gait;
  if (fl) { const g = ctx.ground(a.x, a.z); a.y = Math.max(g + .8, ease(a.y, g + a.hover, 2 * dt)); } // never sinks into a rising slope
  // separation: live aliens at overlapping heights closer than their radii are pushed apart, half the overlap each
  for (const o of ctx.others) {
    if (o === a || o.state === 'dead') continue;
    const R = T.radius + ALIENS[o.type].radius;
    if (Math.abs(o.y - a.y) >= R) continue;
    let ex = a.x - o.x, ez = a.z - o.z; const l2 = ex * ex + ez * ez;
    if (l2 >= R * R) continue;
    const l = Math.sqrt(l2), p = (R - l) / 2;
    if (l < 1e-9) { ex = a.id < o.id ? -1 : 1; ez = 0; } else { ex /= l; ez /= l; }
    move(a, ctx, ex * p, ez * p); move(o, ctx, -ex * p, -ez * p);
  }
}

// Returns true when this blow kills. Corpses still take knock (blasts shove them) but never die twice.
export function hurtAlien(a, dmg, kx, kz) {
  const s = a.type === 'br' ? .3 : 1, was = a.state === 'dead';
  a.hp -= dmg; a.flash = 1; a.enc.alerted = true; a.vx += kx * s; a.vz += kz * s;
  if (was || a.hp > 0) return false;
  go(a, 'dead'); return true;
}
