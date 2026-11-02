// The surface fight: one pure simulation tying the player, weapons, bolts, aliens, pickups and canisters together.
// Deterministic: every random draw comes from F.rng = makeRng(world.seed + '/sim'); there is no wall clock, DOM or GPU here.
import { makeRng } from '../gen/rng.js';
import { sampleGround, flagSpot, HALF, MAP_MARGIN, MAX_STEP } from '../gen/surface.js';
import { cameraBasis } from '../gfx/math.js';
import { PLAYER, createPlayer, stepPlayer, knock } from './player.js';
import { WEAPONS, MAX_CELLS, createArsenal, give, selectWeapon, cycleWeapon, coolWeapon, fireWeapon, meleeTargets } from './weapons.js';
import { stepBolts } from './bolts.js';
import { lineOfSight, createField, updateField } from './nav.js';
import { muzzleWorld, worldSpheres } from './rigs.js';
import { ALIENS, createAlien, stepAlien, hurtAlien, move, level } from './aliens.js';

export const PICKUP = { tape: 25, cells: 25, pistol: 20, scatter: 16, flCells: 15, pistolDrop: .3 };
export const CANISTER = { hp: 15, radius: .45, blast: 5, dmg: 70, knock: 9, fuse: .2 };
export const DEATH_TIME = 2.5;
// WAKE: encounter wake radius; CORPSE: seconds a corpse lasts, the last SINK of them sinking 1 m; GRAB: flag reach;
// REACH: pickup reach; CAN_Y: canister centre above its base; CAN_H: its height.
const WAKE = 60, CORPSE = 8, SINK = 2, MAX_PARTS = 300, MAX_DECALS = 64, BOOM_LIFE = .6, FIELD_DT = .25, GRAB = 2.2, REACH = 1.2;
const CAN_Y = .4, CAN_H = .9, TAU = 2 * Math.PI, sqrt = Math.sqrt;

export function createFight(world, { gravity }) {
  const G = (x, z) => sampleGround(world, x, z), fs = flagSpot(world);
  const F = { world, gravity, rng: makeRng(world.seed + '/sim'), player: createPlayer(world.spawn, G), hp: 100, ars: createArsenal(),
    encs: [], aliens: [], bolts: [], pickups: [], canisters: [], parts: [], decals: [], booms: [],
    flag: { x: fs.x, y: G(fs.x, fs.z), z: fs.z, held: false }, entry: { owned: [false, false, false], cells: 0, flagHeld: false },
    state: 'play', deadT: 0, time: 0, kills: 0, shots: 0, shotT: 9, hurtT: 0, field: createField(), fieldT: 0, events: [], god: false,
    _g: G, _di: 0 };
  const C = F._ctx = { ground: G, px: 0, py: 0, pz: 0, field: F.field, rng: F.rng, others: F.aliens,
    los: a => lineOfSight(G, muzzleWorld(a), [C.px, C.py + PLAYER.eye, C.pz]),
    shoot: (a, m, d, s) => { F.bolts.push({ x: m[0], y: m[1], z: m[2], vx: d[0] * s.speed, vy: d[1] * s.speed, vz: d[2] * s.speed,
      dmg: s.dmg, r: s.size, life: 4, col: s.col, team: 1, src: a.id }); },
    melee: (a, dmg, k) => {
      let dx = F.player.x - a.x, dz = F.player.z - a.z; const l = sqrt(dx * dx + dz * dz);
      if (l > 1e-6) { dx /= l; dz /= l; } else { dx = Math.sin(a.yaw); dz = Math.cos(a.yaw); }
      hurtPlayer(F, dmg, dx * k, 1.5, dz * k);
    } };
  populate(F);
  return F;
}

// Encounters, aliens (ids from 1), pickups and canisters, fresh from the world plan. Arrays are refilled in place.
function populate(F) {
  const plan = F.world.plan; let id = 1;
  F.encs.length = F.aliens.length = F.pickups.length = F.canisters.length = 0;
  for (const e of plan.encounters) {
    const enc = { x: e.x, z: e.z, p: e.p, first: e.first, alerted: false, waved: false };
    F.encs.push(enc);
    for (const s of e.aliens) F.aliens.push(createAlien(s, id++, enc));
  }
  for (const p of plan.pickups) F.pickups.push({ kind: p.kind, x: p.x, y: p.y, z: p.z, n: PICKUP[p.kind] });
  plan.canisters.forEach((c, i) => F.canisters.push({ x: c.x, y: c.y, z: c.z, hp: CANISTER.hp, fuse: 0, id: -1 - i }));
}

export function hurtPlayer(F, dmg, kx, ky, kz) {
  if (F.state === 'dead') return;
  F.hp -= dmg;
  if (F.god) F.hp = Math.max(1, F.hp);
  F.hurtT = Math.min(1, F.hurtT + dmg / 20);
  knock(F.player, kx, ky, kz);
  F.events.push({ type: 'hurt' });
  if (F.hp <= 0) die(F);
}

function die(F) {
  F.hp = Math.max(0, F.hp); F.state = 'dead'; F.deadT = 0;
  F.events.push({ type: 'dead' });
}

export function restartArea(F) {
  const E = F.entry, A = F.ars;
  Object.assign(F.player, createPlayer(F.world.spawn, F._g)); // in place: the input module holds this object
  F.hp = 100;
  A.owned = E.owned.slice(); A.cells = E.cells; A.cool = 0; A.cur = A.owned.lastIndexOf(true);
  F.flag.held = E.flagHeld;
  populate(F);
  F.bolts.length = F.parts.length = F.decals.length = F.booms.length = 0; F._di = 0;
  F.field = createField(); F.fieldT = 0;
  F.state = 'play'; F.deadT = 0; F.hurtT = 0; F.shotT = 9;
  F.events.push({ type: 'restart' });
}

// Where the crosshair ray first meets a live alien's sphere or the ground (0.5 m steps), up to 200 m (and never nearer than 1 m,
// so a bolt from the muzzle can't be sent backwards). Spheres that hold the eye are ignored.
export function aimPoint(F) {
  const p = F.player, f = cameraBasis(p.yaw, p.pitch).f, ex = p.x, ey = p.y + PLAYER.eye, ez = p.z;
  let best = 200;
  for (const a of F.aliens) {
    if (a.state === 'dead') continue;
    const mx = a.x - ex, my = a.y - ey, mz = a.z - ez, t0 = mx * f[0] + my * f[1] + mz * f[2];
    if (t0 < -4 || t0 > best + 4 || mx * mx + my * my + mz * mz - t0 * t0 > 16) continue; // spheres sit within ~2.4 m of a.x/y/z
    for (const s of worldSpheres(a)) {
      const qx = ex - s[0], qy = ey - s[1], qz = ez - s[2], b = qx * f[0] + qy * f[1] + qz * f[2], c = qx * qx + qy * qy + qz * qz - s[3] * s[3];
      if (c <= 0 || b > 0) continue;
      const disc = b * b - c;
      if (disc >= 0) best = Math.min(best, -b - sqrt(disc));
    }
  }
  for (let s = .5; s < best; s += .5) if (ey + f[1] * s <= F._g(ex + f[0] * s, ez + f[2] * s)) { best = s; break; }
  best = Math.max(1, best);
  return [ex + f[0] * best, ey + f[1] * best, ez + f[2] * best];
}

export function stepFight(F, input, dt) {
  // 1. clock and death
  F.time += dt; F.shotT += dt;
  if (F.state === 'dead') {
    F.deadT += dt;
    flyBolts(F, dt); stepParts(F, dt); stepBooms(F, dt);
    if (F.deadT >= DEATH_TIME) restartArea(F);
    return;
  }
  const p = F.player, A = F.ars, W = F.world;
  // 2. weapon input
  if (input.weapon >= 0) selectWeapon(A, input.weapon);
  if (input.wheel) cycleWeapon(A, input.wheel);
  if (input.use && !F.flag.held && Math.hypot(p.x - F.flag.x, p.z - F.flag.z) <= GRAB) {
    give(A, 0, 0); F.flag.held = true;
    F.entry = { owned: A.owned.slice(), cells: A.cells, flagHeld: true };
    F.events.push({ type: 'flag', text: WEAPONS[0].name, x: F.flag.x, y: F.flag.y, z: F.flag.z });
  }
  coolWeapon(A, dt);
  if (input.fire && A.cur >= 0 && A.cool <= 0) fire(F);
  // 3. player
  stepPlayer(p, input, dt, F._g, HALF - MAP_MARGIN, F.gravity);
  // 4. distance field
  if ((F.fieldT -= dt) <= 0) { F.fieldT = FIELD_DT; updateField(F.field, W.occ, W.N, W.half, p.x, p.z, MAX_STEP); }
  // 5. aliens: awake near their encounter or once it is alerted; the asleep only tick their clock
  const C = F._ctx;
  C.px = p.x; C.py = p.y; C.pz = p.z; C.field = F.field;
  for (const a of F.aliens) {
    const e = a.enc, dx = p.x - e.x, dz = p.z - e.z;
    if (e.alerted || dx * dx + dz * dz < WAKE * WAKE) stepAlien(a, C, dt); else a.t += dt;
  }
  // 5b. the player can't stand inside a live walker or a canister
  bodies(F);
  // 6. bolts, 7. deaths, 8. canisters
  flyBolts(F, dt);
  deaths(F);
  canisters(F, dt);
  // 9. pickups (not if a blast just killed you)
  if (F.state === 'play') pickups(F);
  // 10. particles, decals, booms, the hurt flash
  stepParts(F, dt); stepBooms(F, dt);
  F.hurtT = Math.max(0, F.hurtT - 2 * dt);
  // 11. death check (hurtPlayer already enters death; this catches hp set directly)
  if (F.state === 'play' && F.hp <= 0) { if (F.god) F.hp = 1; else die(F); }
}

// R16: the player is pushed out of live walkers and canisters (horizontally, where their heights overlap). A push that would
// climb more than PLAYER.stepUp, or cross the bound, shoves the walker instead (by its own climb rule); canisters never move.
function bodies(F) {
  const p = F.player, G = F._g, lim = HALF - MAP_MARGIN;
  const out = (x, z, R, a) => {
    let dx = p.x - x, dz = p.z - z; const l2 = dx * dx + dz * dz;
    if (l2 >= R * R) return;
    const l = sqrt(l2), d = R - l;
    if (l > 1e-9) { dx /= l; dz /= l; } else { dx = Math.sin(p.yaw); dz = Math.cos(p.yaw); } // dead centre: back off
    const nx = p.x + dx * d, nz = p.z + dz * d, gy = G(nx, nz);
    if (Math.abs(nx) <= lim && Math.abs(nz) <= lim && gy - p.y <= PLAYER.stepUp) { p.x = nx; p.z = nz; p.y = Math.max(p.y, gy); }
    else if (a) move(a, F._ctx, -dx * d, -dz * d);
  };
  for (const a of F.aliens) if (a.type !== 'fl' && a.state !== 'dead' && level(a, p.y)) out(a.x, a.z, ALIENS[a.type].radius + PLAYER.radius, a);
  for (const c of F.canisters) if (p.y < c.y + CAN_H && c.y < p.y + PLAYER.eye) out(c.x, c.z, CANISTER.radius + PLAYER.radius, null);
}

function fire(F) {
  const p = F.player, eye = [p.x, p.y + PLAYER.eye, p.z], B = cameraBasis(p.yaw, p.pitch), s = fireWeapon(F.ars, eye, B, aimPoint(F));
  if (!s) return;
  F.shots++; F.shotT = 0; F.events.push({ type: 'fire' });
  if (!s.melee) { for (const b of s.bolts) F.bolts.push(b); return; }
  const W = WEAPONS[s.w], f = B.f, T = [];
  for (const a of F.aliens) {
    if (a.state === 'dead' || Math.abs(a.x - p.x) > 8 || Math.abs(a.z - p.z) > 8) continue;
    const q = worldSpheres(a)[0];
    T.push({ x: q[0], y: q[1], z: q[2], r: q[3], a });
  }
  for (const c of F.canisters) T.push({ x: c.x, y: c.y + CAN_Y, z: c.z, r: CANISTER.radius, c });
  for (const t of meleeTargets(eye, f, T, W.range, W.cosArc)) {
    if (t.a) { hurtAlien(t.a, W.dmg, f[0] * W.knock, f[2] * W.knock); burst(F, 'goo', t.x, t.y, t.z, 6, 1.2, .5, 2, 8, 8); }
    else t.c.hp -= W.dmg;
  }
}

// Bolts against the player's two spheres (id 0), every live alien's spheres (its id) and every canister (id -1 - index).
function flyBolts(F, dt) {
  if (!F.bolts.length) return;
  const p = F.player, T = [{ x: p.x, y: p.y + .5, z: p.z, r: .4, id: 0 }, { x: p.x, y: p.y + 1.3, z: p.z, r: .4, id: 0 }];
  for (const a of F.aliens) if (a.state !== 'dead') for (const s of worldSpheres(a)) T.push({ x: s[0], y: s[1], z: s[2], r: s[3], id: a.id, a });
  for (const c of F.canisters) T.push({ x: c.x, y: c.y + CAN_Y, z: c.z, r: CANISTER.radius, id: c.id, c });
  for (const h of stepBolts(F.bolts, dt, F._g, T)) {
    const b = h.b, t = h.t;
    if (!t) {
      decal(F, 'scorch', h.x, h.y, h.z, b.r >= .3 ? .7 : .35);
      burst(F, 'spark', h.x, h.y, h.z, 4, 2.5, 1, 3.5, .25, .5);
      burst(F, 'dust', h.x, h.y, h.z, 2, .8, .4, 1.2, .7, 1.2);
    } else if (t.a) { hurtAlien(t.a, b.team ? b.dmg / 2 : b.dmg, 0, 0); burst(F, 'goo', h.x, h.y, h.z, 6, 1.2, .5, 2, 8, 8); }
    else if (t.c) t.c.hp -= b.dmg;
    else { const k = 1.5 / (Math.hypot(b.vx, b.vy, b.vz) || 1); hurtPlayer(F, b.dmg, b.vx * k, b.vy * k, b.vz * k); }
  }
}

// New deaths score, splash goo and drop; corpses sink over their last SINK seconds and go after CORPSE. Ids never change.
function deaths(F) {
  const G = F._g, L = F.aliens; let w = 0;
  for (const a of L) {
    if (a.state === 'dead') {
      if (a._died == null) killed(F, a);
      const age = F.time - a._died;
      if (age >= CORPSE) continue;
      if (age > CORPSE - SINK) a.y = G(a.x, a.z) - (age - (CORPSE - SINK)) / SINK;
    }
    L[w++] = a;
  }
  L.length = w;
}

function killed(F, a) {
  a._died = F.time; F.kills++;
  const c = worldSpheres(a)[0], gy = F._g(a.x, a.z);
  burst(F, 'goo', c[0], c[1], c[2], 24, 1.5, 1, 3, 8, 8);
  F.events.push({ type: 'kill', x: a.x, y: gy, z: a.z });
  const kind = a.type === 'fl' ? 'cells' : a.type === 'br' ? 'scatter' : a.enc.first || F.rng.next() < PICKUP.pistolDrop ? 'pistol' : null;
  if (kind) F.pickups.push({ kind, x: a.x, y: gy, z: a.z, n: kind === 'cells' ? PICKUP.flCells : PICKUP[kind] });
}

// A shot-out canister lights its fuse; when the fuse runs out it is removed and explodes.
function canisters(F, dt) {
  const L = F.canisters, go = []; let w = 0;
  for (const c of L) {
    if (c.fuse > 0) { if ((c.fuse -= dt) <= 0) { go.push(c); continue; } }
    else if (c.hp <= 0) c.fuse = CANISTER.fuse;
    L[w++] = c;
  }
  L.length = w;
  for (const c of go) explode(F, c);
}

function explode(F, c) {
  const B = CANISTER, x = c.x, y = c.y + CAN_Y, z = c.z, p = F.player;
  // [damage, knock x, y, z] for a point inside the blast, or null; knock points away from the canister
  const hit = (tx, ty, tz) => {
    const dx = tx - x, dy = ty - y, dz = tz - z, d = Math.hypot(dx, dy, dz);
    if (d >= B.blast) return null;
    const k = 1 - d / B.blast, s = B.knock * k / (d || 1);
    return d > 1e-6 ? [B.dmg * k, dx * s, dy * s, dz * s] : [B.dmg * k, 0, B.knock * k, 0];
  };
  let q = hit(p.x, p.y + .9, p.z);
  if (q) hurtPlayer(F, q[0], q[1], q[2], q[3]);
  for (const a of F.aliens) {
    if (Math.abs(a.x - x) > B.blast + 3 || Math.abs(a.z - z) > B.blast + 3) continue;
    const s = worldSpheres(a)[0];
    if ((q = hit(s[0], s[1], s[2]))) hurtAlien(a, q[0], q[1], q[3]);
  }
  for (const o of F.canisters) if ((q = hit(o.x, o.y + CAN_Y, o.z))) { o.hp -= q[0]; if (!(o.fuse > 0)) o.fuse = B.fuse; }
  decal(F, 'scorch', x, F._g(x, z), z, 1.6);
  burst(F, 'spark', x, y, z, 30, 6, 1.5, 7, .3, .7);
  F.booms.push({ x, y, z, age: 0 });
  F.events.push({ type: 'boom', x, y, z });
}

function pickups(F) {
  const p = F.player, L = F.pickups; let w = 0;
  for (const k of L) {
    const dx = k.x - p.x, dz = k.z - p.z;
    if (dx * dx + dz * dz < REACH * REACH && Math.abs(k.y - p.y) < 2 && collect(F, k)) continue;
    L[w++] = k;
  }
  L.length = w;
}

// Tape heals only the hurt; cells and weapons aren't wasted on a full cell pack (a new weapon is always taken).
function collect(F, k) {
  const A = F.ars; let text;
  if (k.kind === 'tape') {
    if (F.hp >= 100) return false;
    F.hp = Math.min(100, F.hp + k.n); text = '+' + k.n + ' DUCT TAPE';
  } else if (k.kind === 'cells') {
    if (A.cells >= MAX_CELLS) return false;
    A.cells = Math.min(MAX_CELLS, A.cells + k.n); text = '+' + k.n + ' CELLS';
  } else {
    const i = k.kind === 'pistol' ? 1 : 2;
    if (A.owned[i] && A.cells >= MAX_CELLS) return false;
    give(A, i, k.n); text = WEAPONS[i].name;
  }
  F.events.push({ type: 'pickup', text, x: k.x, y: k.y, z: k.z });
  return true;
}

// n particles of one kind: horizontal speed up to h each way, upward speed vy0..vy1, life l0..l1 seconds. The oldest go past MAX_PARTS.
function burst(F, kind, x, y, z, n, h, vy0, vy1, l0, l1) {
  const r = F.rng, P = F.parts;
  for (let i = 0; i < n; i++) P.push({ x, y, z, vx: r.range(-h, h), vy: r.range(vy0, vy1), vz: r.range(-h, h), kind, life: r.range(l0, l1) });
  if (P.length > MAX_PARTS) P.splice(0, P.length - MAX_PARTS);
}

// A ground mark facing the ground's normal (from its gradient), in a ring of MAX_DECALS.
function decal(F, kind, x, y, z, r) {
  const G = F._g, gx = G(x + .5, z) - G(x - .5, z), gz = G(x, z + .5) - G(x, z - .5), l = Math.hypot(gx, 1, gz);
  F.decals[F._di++ % MAX_DECALS] = { x, y, z, nx: -gx / l, ny: 1 / l, nz: -gz / l, r, yaw: F.rng.range(0, TAU), kind };
}

// Particles fall under the area's gravity. Goo that reaches the ground sticks as a decal; sparks and dust settle and fade.
function stepParts(F, dt) {
  const P = F.parts, G = F._g, g = F.gravity; let w = 0;
  for (const q of P) {
    if ((q.life -= dt) <= 0) continue;
    q.vy -= g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
    const gy = G(q.x, q.z);
    if (q.y <= gy) {
      if (q.kind === 'goo') { decal(F, 'goo', q.x, gy, q.z, F.rng.range(.12, .3)); continue; }
      q.y = gy; q.vx = q.vy = q.vz = 0;
    }
    P[w++] = q;
  }
  P.length = w;
}

function stepBooms(F, dt) {
  const L = F.booms; let w = 0;
  for (const b of L) if ((b.age += dt) < BOOM_LIFE) L[w++] = b;
  L.length = w;
}
