// The fight: one pure simulation tying the player, weapons, bolts, aliens, pickups and canisters together, run on a level
// (the surface or the base; see areas.js). Deterministic: every random draw comes from F.rng = makeRng(world.seed + '/sim');
// there is no wall clock, DOM or GPU here.
import { makeRng } from '../gen/rng.js';
import { sampleGround, flagSpot } from '../gen/surface.js';
import { cameraBasis } from '../gfx/math.js';
import { PLAYER, FALL, createPlayer, stepPlayer, knock, fits } from './player.js';
import { WEAPONS, MAX_CELLS, createArsenal, give, selectWeapon, cycleWeapon, coolWeapon, fireWeapon, meleeTargets } from './weapons.js';
import { stepBolts, groundNormal } from './bolts.js';
import { lineOfSight, createField, updateField } from './nav.js';
import { worldSpheres } from './rigs.js';
import { ALIENS, createAlien, stepAlien, hurtAlien, move, level, muzzleAt } from './aliens.js';
import { AREAS, AREA_TEXT, LEVEL, makeLevel, areaStart, advanceArea } from './areas.js';
import { K } from '../gen/base.js';
import { HOLD, planWaves, dishOf } from './hold.js';

// Alien drops (pistol, scatter, flCells) are 20% up on Plan 2's 20, 16 and 15 after the first play-test (H5). Tape drops (Plan 5) come from the sim's
// F.rng, not generation, so the goldens are untouched: tapeDrop is the chance per alien type, tapeOff the distance it lies from another drop.
export const PICKUP = { tape: 25, cells: 25, pistol: 24, scatter: 19, flCells: 18, pistolDrop: .3, tapeDrop: { sk: .1, fl: .2, br: 1 }, tapeOff: .7 };
export const CANISTER = { hp: 15, radius: .45, blast: 5, dmg: 70, knock: 9, fuse: .2 };
export const DEATH_TIME = 2.5;
// GOLF_TOTAL: golf balls in a world (3 on the surface, 2 in the base); DOOR_REACH: how near (m) the hangar door's use point E works.
export const GOLF_TOTAL = 5, DOOR_REACH = 2.5;
// MAX_PARTS: the most particles at once (the oldest go past it); the opening hands its glitter over within it.
export const MAX_PARTS = 300;
// CORPSE: seconds a corpse lasts, the last SINK of them sinking 1 m; DECALS: each kind's ring (M5: goo can't evict scorch);
// GRAB: flag reach; REACH: pickup reach; CAN_Y: canister centre above its base; CAN_H: its height; WALL: ground this far above
// a particle stops it like a wall.
const CORPSE = 8, SINK = 2, DECALS = { scorch: 40, goo: 24 }, BOOM_LIFE = .6, FIELD_DT = .25, GRAB = 2.2, REACH = 1.2;
const CAN_Y = .4, CAN_H = .9, WALL = .35, TAU = 2 * Math.PI, sqrt = Math.sqrt, STILL = { fwd: 0, strafe: 0, run: false, jump: false };
// HOLD_ID: the first hold alien's id; HOVER: a hold floater's height above its door's floor (its top just under the lintel).
const HOLD_ID = 1000, HOVER = 1.7;

// A fight starting at area k, on that area's level, at its start, with nothing held.
export function createFight(world, k = 0) {
  const lv = makeLevel(world, LEVEL[k]), fs = flagSpot(world);
  const F = { world, area: k, lv, gravity: lv.gravity, rng: makeRng(world.seed + '/sim'), player: createPlayer(areaStart(world, k), lv.ground), hp: 100, ars: createArsenal(),
    encs: [], aliens: [], bolts: [], pickups: [], canisters: [], balls: [], parts: [], decals: [], booms: [],
    flag: { x: fs.x, y: sampleGround(world, fs.x, fs.z), z: fs.z, held: false }, entry: { owned: [false, false, false], cells: 0, flagHeld: false },
    state: 'play', deadT: 0, time: 0, kills: 0, shots: 0, shotT: 9, hurtT: 0, field: createField(), fieldT: 0, events: [], god: false,
    found: [], golf: 0, hold: null, won: false, wonAt: null };
  clearDecals(F);
  const C = F._ctx = { ground: lv.ground, ceil: lv.ceil, px: 0, py: 0, pz: 0, field: F.field, rng: F.rng, others: F.aliens,
    los: a => lineOfSight(F.lv.ground, muzzleAt(a, C), [C.px, C.py + PLAYER.eye, C.pz], F.lv.ceil),
    shoot: (a, m, d, s) => { F.bolts.push({ x: m[0], y: m[1], z: m[2], vx: d[0] * s.speed, vy: d[1] * s.speed, vz: d[2] * s.speed,
      dmg: s.dmg, r: s.size, life: 4, col: s.col, team: 1, src: a.id }); F.events.push({ type: 'zap', x: m[0], z: m[2] }); },
    melee: (a, dmg, k) => {
      let dx = F.player.x - a.x, dz = F.player.z - a.z; const l = sqrt(dx * dx + dz * dz);
      if (l > 1e-6) { dx /= l; dz /= l; } else { dx = Math.sin(a.yaw); dz = Math.cos(a.yaw); }
      hurtPlayer(F, dmg, dx * k, 1.5, dz * k);
    } };
  populate(F, k);
  return F;
}

// From the level plan: one fresh enc per encounter (encs and aliens are rebuilt), then the aliens, pickups, canisters and golf
// balls (those not yet found) of areas >= from, appended (pre-flight F19: callers empty what they replace). Each carries its
// area. Ids are the level plan's: an alien's is 1 + its index in the plan's aliens (encounter by encounter), a canister's -1 -
// its index in the plan's canisters, a ball's its golf id.
function populate(F, from) {
  const plan = F.lv.plan; let id = 1;
  F.encs.length = F.aliens.length = 0;
  for (const e of plan.encounters) {
    const enc = { x: e.x, z: e.z, p: e.p, first: e.first, area: e.area, room: e.room ?? -1, alerted: false, waved: false };
    F.encs.push(enc);
    for (const s of e.aliens) { const i = id++; if (e.area < from) continue; const a = createAlien(s, i, enc); a.area = e.area; F.aliens.push(a); }
  }
  for (const p of plan.pickups) if (p.area >= from) F.pickups.push({ kind: p.kind, x: p.x, y: p.y, z: p.z, n: PICKUP[p.kind], area: p.area });
  plan.canisters.forEach((c, i) => { if (c.area >= from) F.canisters.push({ x: c.x, y: c.y, z: c.z, hp: CANISTER.hp, fuse: 0, id: -1 - i, area: c.area }); });
  for (const g of plan.golf) if (g.area >= from && !F.found.includes(g.id)) F.balls.push({ id: g.id, x: g.x, y: g.y, z: g.z, area: g.area });
}

// Into area k (> F.area): your inventory now is what a death in k restarts you with. On the same level nothing else changes; a
// new level is entered fresh at k's start, leaving everything of the old one behind (nothing in flight follows you in).
export function enterArea(F, k) {
  const fresh = LEVEL[k] !== F.lv.id;
  F.area = k;
  if (fresh) {
    const lv = F.lv = makeLevel(F.world, LEVEL[k]), C = F._ctx;
    F.gravity = lv.gravity;
    F.bolts.length = F.parts.length = F.booms.length = 0; clearDecals(F);
    F.aliens.length = F.pickups.length = F.canisters.length = F.balls.length = 0;
    populate(F, k);
    Object.assign(F.player, createPlayer(areaStart(F.world, k), lv.ground)); // in place: the input module holds this object
    F.field = C.field = createField(); F.fieldT = 0; C.ground = lv.ground; C.ceil = lv.ceil;
  }
  F.entry = { owned: F.ars.owned.slice(), cells: F.ars.cells, flagHeld: F.flag.held };
  F.events.push({ type: 'area', area: k, id: AREAS[k], level: fresh, text: AREA_TEXT[k] });
}

// cause (optional) rides on the 'hurt' event: 'fall' for a hard landing (R18), for Plan 4's radio. Once Houston has picked up
// nothing hurts you.
export function hurtPlayer(F, dmg, kx, ky, kz, cause) {
  if (F.state === 'dead' || F.won) return;
  F.hp -= dmg;
  if (F.god) F.hp = Math.max(1, F.hp);
  F.hurtT = Math.min(1, F.hurtT + dmg / 20);
  knock(F.player, kx, ky, kz);
  F.events.push(cause ? { type: 'hurt', cause } : { type: 'hurt' });
  if (F.hp <= 0) die(F);
}

function die(F) {
  F.hp = Math.max(0, F.hp); F.state = 'dead'; F.deadT = 0;
  F.events.push({ type: 'dead' });
}

// Back to the current area's start with what you entered it with, facing it (and any later area of the level) fresh. Earlier
// areas of the level keep the pickups, intact canisters and golf balls you left there; every alien goes, so those you fled from
// are gone. Found golf balls stay found. A death on hold takes you off hold (its aliens and supplies are area 3's), and
// Houston never picked up (R8).
export function restartArea(F) {
  const E = F.entry, A = F.ars, k = F.area;
  F.aliens.length = 0; F.hold = null; F.won = false; F.wonAt = null;
  keep(F.pickups, q => q.area < k);
  keep(F.canisters, c => c.area < k && !(c.hp <= 0 || c.fuse > 0));
  keep(F.balls, b => b.area < k);
  Object.assign(F.player, createPlayer(areaStart(F.world, k), F.lv.ground)); // in place: the input module holds this object
  F.hp = 100;
  A.owned = E.owned.slice(); A.cells = E.cells; A.cool = 0; A.cur = A.owned.lastIndexOf(true);
  F.flag.held = E.flagHeld;
  F.bolts.length = F.parts.length = F.booms.length = 0; clearDecals(F);
  F.field = createField(); F.fieldT = 0;
  F.state = 'play'; F.deadT = 0; F.hurtT = 0; F.shotT = 9;
  populate(F, k);
  F.events.push({ type: 'restart', area: k });
}

// Keeps (in order, in place) the items of L that pass ok.
function keep(L, ok) { let w = 0; for (const x of L) if (ok(x)) L[w++] = x; L.length = w; }

// Where the crosshair ray first meets a live alien's sphere or the level (the ground, or indoors at or above the ceiling; 0.5 m
// steps), up to 200 m (and never nearer than 1 m, so a bolt from the muzzle can't be sent backwards). Spheres that hold the eye
// are ignored.
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
  const G = F.lv.ground, Cl = F.lv.ceil;
  for (let s = .5; s < best; s += .5) {
    const x = ex + f[0] * s, y = ey + f[1] * s, z = ez + f[2] * s;
    if (y <= G(x, z) || (Cl && y >= Cl(x, z))) { best = s; break; }
  }
  best = Math.max(1, best);
  return [ex + f[0] * best, ey + f[1] * best, ez + f[2] * best];
}

export function stepFight(F, input, dt) {
  // 1. clock and death; the body still falls and slides to rest (M4)
  F.time += dt; F.shotT += dt;
  if (F.state === 'dead') {
    F.deadT += dt;
    stepPlayer(F.player, STILL, dt, F.lv.ground, F.lv.bound, F.gravity, F.lv.ceil, F.area === 1 ? FALL.safe : Infinity);
    flyBolts(F, dt); stepParts(F, dt); stepBooms(F, dt);
    if (F.deadT >= DEATH_TIME) restartArea(F);
    return;
  }
  const p = F.player, A = F.ars, U = F.world.crater.use;
  // 2. weapon input; the flag stands on the surface level only; E at the hangar door takes you into the base, where the rest of
  // this step runs; E at the comms array puts you on hold
  if (input.weapon >= 0) selectWeapon(A, input.weapon);
  if (input.wheel) cycleWeapon(A, input.wheel);
  if (input.use && F.lv.id === 'surface' && !F.flag.held && Math.hypot(p.x - F.flag.x, p.z - F.flag.z) <= GRAB) {
    give(A, 0, 0); F.flag.held = true;
    F.entry.owned[0] = true; F.entry.flagHeld = true; // R12: the checkpoint gains only the flag, never what you have picked up since
    F.events.push({ type: 'flag', text: WEAPONS[0].name, x: F.flag.x, y: F.flag.y, z: F.flag.z });
  }
  if (input.use && F.area === 1 && Math.hypot(p.x - U.x, p.z - U.z) <= DOOR_REACH) enterArea(F, 2);
  if (input.use && F.area === 3 && !F.hold && F.state === 'play') { const d = dishOf(F.world.baseMap); if (Math.hypot(p.x - d.x, p.z - d.z) <= HOLD.reach) startHold(F, d); }
  const lv = F.lv;
  coolWeapon(A, dt);
  if (input.fire && A.cur >= 0 && A.cool <= 0) fire(F);
  // 3. player, then the area you walked into (only the living get here: a dead body never changes area), then a hard landing's
  // cost (R18), after the area so a fatal fall over the rim restarts you at the crater top. Walking only ever advances within a
  // level (over the rim, through the comms door), so lv stays this step's level.
  stepPlayer(p, input, dt, lv.ground, lv.bound, F.gravity, lv.ceil, F.area === 1 ? FALL.safe : Infinity);
  const k = advanceArea(F.world, F.area, p.x, p.z); if (k > F.area) enterArea(F, k);
  if (p.land > FALL.safe) hurtPlayer(F, FALL.dmg * (p.land - FALL.safe), 0, 0, 0, 'fall');
  // 4. distance field
  if ((F.fieldT -= dt) <= 0) { F.fieldT = FIELD_DT; updateField(F.field, lv.grid, lv.n, lv.half, p.x, p.z, lv.maxStep); }
  // 5. aliens: awake within the level's wake radius of their encounter or once it is alerted; the asleep only tick their clock
  const C = F._ctx, wake = lv.wake;
  C.px = p.x; C.py = p.y; C.pz = p.z; C.field = F.field;
  for (const a of F.aliens) {
    const e = a.enc, dx = p.x - e.x, dz = p.z - e.z;
    if (e.alerted || dx * dx + dz * dz < wake * wake) stepAlien(a, C, dt); else a.t += dt;
  }
  // 5a. on hold: the waves come in, until Houston picks up; only while you are alive this step (R8): a blow in steps 3-5 has
  // already killed you, and hp set to 0 directly is only turned into a death at step 11
  if (F.hold && !F.won && F.state === 'play' && F.hp > 0) stepHold(F, dt);
  // 5b. the player can't stand inside a live walker or a canister
  bodies(F);
  // 6. bolts, 7. deaths, 8. canisters
  flyBolts(F, dt);
  deaths(F);
  canisters(F, dt);
  // 9. pickups and golf balls (not if a blast just killed you)
  if (F.state === 'play') { pickups(F); findBalls(F); }
  // 10. particles, decals, booms, the hurt flash
  stepParts(F, dt); stepBooms(F, dt);
  F.hurtT = Math.max(0, F.hurtT - 2 * dt);
  // 11. death check (hurtPlayer already enters death; this catches hp set directly)
  if (F.state === 'play' && F.hp <= 0) { if (F.god) F.hp = 1; else die(F); }
}

// On hold at the array d (the dish): the waves are planned now, from the sim rng, so a retry after a death gets new ones. The
// hold's aliens share one enc, alerted from the start, at the dish. The supplies go on the dais: tape on the first HOLD.tape of
// HOLD.spots that are floor, cells on the next HOLD.cells.
function startHold(F, d) {
  const M = F.world.baseMap, enc = { x: d.x, z: d.z, p: 1, first: false, area: 3, room: -1, alerted: true, waved: false };
  F.hold = { t: 0, plan: planWaves(F.rng, M.spawnDoors.length), next: 0, msgs: 0, enc };
  let k = 0;
  for (const [u, v] of HOLD.spots) {
    const x = d.x + u, z = d.z + v;
    if (k === HOLD.tape + HOLD.cells || M.kind[Math.round(z + M.half) * M.n + Math.round(x + M.half)] !== K.floor) continue;
    const kind = k++ < HOLD.tape ? 'tape' : 'cells';
    F.pickups.push({ kind, x, y: F.lv.ground(x, z), z, n: PICKUP[kind], area: 3 });
  }
  F.events.push({ type: 'hold' });
}

// dt seconds on hold. Planned spawns come in order once due, while fewer than HOLD.cap hold aliens are alive (one that finds no
// free slot waits, and so do those after it), each at its door, first moving next step. Mission Control's on-hold message is
// due every HOLD.msg s from HOLD.msg / 2; at HOLD.time Houston picks up, and the run's time stops there (R9: wonAt, which the
// end screen and the best time use, whatever the ending's radio takes).
function stepHold(F, dt) {
  const H = F.hold, P = H.plan, D = F.world.baseMap.spawnDoors;
  H.t += dt;
  let live = 0;
  for (const a of F.aliens) if (a.enc === H.enc && a.state !== 'dead') live++;
  for (; H.next < P.length && P[H.next].at <= H.t && live < HOLD.cap; live++) {
    const q = P[H.next], d = D[q.door], g = F.lv.ground(d.x, d.z);
    const a = createAlien({ type: q.type, x: d.x, y: q.type === 'fl' ? g + HOVER : g, z: d.z }, HOLD_ID + H.next++, H.enc);
    a.area = 3; F.aliens.push(a);
  }
  while (H.t >= HOLD.msg / 2 + H.msgs * HOLD.msg) F.events.push({ type: 'holdmsg', n: H.msgs++ });
  if (H.t >= HOLD.time) { F.won = true; F.wonAt = F.time; F.events.push({ type: 'houston' }); }
}

// R16: the player is pushed out of live walkers and canisters (horizontally, where their heights overlap). A push to where the
// player doesn't fit (more than PLAYER.stepUp to climb, or indoors a wall or low ceiling under the box), or across the bound,
// shoves the walker instead (by its own climb rule); canisters never move.
function bodies(F) {
  const p = F.player, G = F.lv.ground, Cl = F.lv.ceil, lim = F.lv.bound;
  const out = (x, z, R, a) => {
    let dx = p.x - x, dz = p.z - z; const l2 = dx * dx + dz * dz;
    if (l2 >= R * R) return;
    const l = sqrt(l2), d = R - l;
    if (l > 1e-9) { dx /= l; dz /= l; } else { dx = Math.sin(p.yaw); dz = Math.cos(p.yaw); } // dead centre: back off
    const nx = p.x + dx * d, nz = p.z + dz * d;
    if (Math.abs(nx) <= lim && Math.abs(nz) <= lim && fits(p, nx, nz, G, Cl)) { p.x = nx; p.z = nz; p.y = Math.max(p.y, G(nx, nz)); }
    else if (a) move(a, F._ctx, -dx * d, -dz * d);
  };
  for (const a of F.aliens) if (a.type !== 'fl' && a.state !== 'dead' && level(a, p.y)) out(a.x, a.z, ALIENS[a.type].radius + PLAYER.radius, a);
  for (const c of F.canisters) if (p.y < c.y + CAN_H && c.y < p.y + PLAYER.eye) out(c.x, c.z, CANISTER.radius + PLAYER.radius, null);
}

function fire(F) {
  const p = F.player, eye = [p.x, p.y + PLAYER.eye, p.z], B = cameraBasis(p.yaw, p.pitch), s = fireWeapon(F.ars, eye, B, aimPoint(F));
  if (!s) return;
  F.shots++; F.shotT = 0; F.events.push({ type: 'fire', w: s.w });
  if (!s.melee) { for (const b of s.bolts) F.bolts.push(b); return; }
  const W = WEAPONS[s.w], f = B.f, T = [];
  for (const a of F.aliens) {
    if (a.state === 'dead' || Math.abs(a.x - p.x) > 8 || Math.abs(a.z - p.z) > 8) continue;
    const q = worldSpheres(a)[0];
    T.push({ x: q[0], y: q[1], z: q[2], r: q[3], a });
  }
  for (const c of F.canisters) T.push({ x: c.x, y: c.y + CAN_Y, z: c.z, r: CANISTER.radius, c });
  for (const t of meleeTargets(p.x, p.y, p.z, p.yaw, T, W)) {
    if (t.a) { F.events.push({ type: 'hit' }); hurtAlien(t.a, W.dmg, f[0] * W.knock, f[2] * W.knock); burst(F, 'goo', t.x, t.y, t.z, 6, 1.2, .5, 2, 8, 8); }
    else t.c.hp -= W.dmg;
  }
}

// Bolts against the level, the player's two spheres (id 0), every live alien's spheres (its id) and every canister (its id).
// A level hit scorches the face it hit (floor, wall or ceiling).
function flyBolts(F, dt) {
  if (!F.bolts.length) return;
  const p = F.player, T = [{ x: p.x, y: p.y + .5, z: p.z, r: .4, id: 0 }, { x: p.x, y: p.y + 1.3, z: p.z, r: .4, id: 0 }];
  for (const a of F.aliens) if (a.state !== 'dead') for (const s of worldSpheres(a)) T.push({ x: s[0], y: s[1], z: s[2], r: s[3], id: a.id, a });
  for (const c of F.canisters) T.push({ x: c.x, y: c.y + CAN_Y, z: c.z, r: CANISTER.radius, id: c.id, c });
  for (const h of stepBolts(F.bolts, dt, F.lv.ground, T, F.lv.ceil)) {
    const b = h.b, t = h.t;
    if (!t) {
      decal(F, 'scorch', h.x, h.y, h.z, b.r >= .3 ? .7 : .35, h.n);
      burst(F, 'spark', h.x, h.y, h.z, 4, 2.5, 1, 3.5, .25, .5);
      burst(F, 'dust', h.x, h.y, h.z, 2, .8, .4, 1.2, .7, 1.2);
    } else if (t.a) { if (!b.team) F.events.push({ type: 'hit' }); if (hurtAlien(t.a, b.team ? b.dmg / 2 : b.dmg, 0, 0) && b.team) t.a._foe = 1; burst(F, 'goo', h.x, h.y, h.z, 6, 1.2, .5, 2, 8, 8); }
    else if (t.c) t.c.hp -= b.dmg;
    else { const k = 1.5 / (Math.hypot(b.vx, b.vy, b.vz) || 1); hurtPlayer(F, b.dmg, b.vx * k, b.vy * k, b.vz * k); }
  }
}

// New deaths score (until Houston picks up, R9: no kill farming in the invulnerable ending; and not one an alien's bolt finished,
// _foe, whose kill event carries team 1, R25), splash goo and drop; corpses sink over their last SINK seconds and go after CORPSE.
// Ids never change.
function deaths(F) {
  const G = F.lv.ground, L = F.aliens; let w = 0;
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
  const scored = !F.won && !a._foe; a._died = F.time; if (scored) F.kills++;
  const c = worldSpheres(a)[0], gy = F.lv.ground(a.x, a.z);
  burst(F, 'goo', c[0], c[1], c[2], 24, 1.5, 1, 3, 8, 8);
  F.events.push({ type: 'kill', x: a.x, y: gy, z: a.z, kind: a.type, n: F.kills, team: a._foe });
  const kind = a.type === 'fl' ? 'cells' : a.type === 'br' ? 'scatter' : a.enc.first || F.rng.next() < PICKUP.pistolDrop ? 'pistol' : null;
  if (kind) F.pickups.push({ kind, x: a.x, y: gy, z: a.z, n: kind === 'cells' ? PICKUP.flCells : PICKUP[kind], area: a.area });
  const c2 = PICKUP.tapeDrop[a.type]; // the first scoring kill drops tape with no roll; else by chance (rng drawn only when 0 < c2 < 1)
  if (scored && F.kills === 1 || c2 >= 1 || c2 > 0 && F.rng.next() < c2) {
    let x = a.x, y = gy, z = a.z;
    if (kind) { const p = F.player, dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz), tx = a.x + (d > 1e-6 ? dx / d : 1) * PICKUP.tapeOff, tz = a.z + (d > 1e-6 ? dz / d : 0) * PICKUP.tapeOff, ty = F.lv.ground(tx, tz);
      if (Math.abs(ty - gy) <= WALL) { x = tx; y = ty; z = tz; } }
    F.pickups.push({ kind: 'tape', x, y, z, n: PICKUP.tape, area: a.area });
  }
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
  const B = CANISTER, x = c.x, y = c.y + CAN_Y, z = c.z, p = F.player, L = F.lv;
  // [damage, knock x, y, z] for a point inside the blast, or null; knock points away from the canister. Indoors (M3) the blast only
  // reaches what it can see, so it never hurts or sets off anything through a wall.
  const hit = (tx, ty, tz) => {
    const dx = tx - x, dy = ty - y, dz = tz - z, d = Math.hypot(dx, dy, dz);
    if (d >= B.blast || (L.ceil && !lineOfSight(L.ground, [x, y, z], [tx, ty, tz], L.ceil))) return null;
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
  const G = F.lv.ground;
  decal(F, 'scorch', x, G(x, z), z, 1.6, groundNormal(G, x, z, F.lv.ceil ? undefined : Infinity)); // R11: the step clamp is indoor-only
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

// A golf ball in reach is found for good: it counts once and never comes back, through deaths too (a lifetime stat, like kills).
function findBalls(F) {
  const p = F.player, L = F.balls; let w = 0;
  for (const b of L) {
    const dx = b.x - p.x, dz = b.z - p.z;
    if (dx * dx + dz * dz < REACH * REACH && Math.abs(b.y - p.y) < 2) {
      F.found.push(b.id); F.golf++;
      F.events.push({ type: 'golf', n: F.golf, id: b.id, x: b.x, y: b.y, z: b.z, text: 'GOLF BALL ' + F.golf + '/' + GOLF_TOTAL });
      continue;
    }
    L[w++] = b;
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
  F.events.push({ type: 'pickup', kind: k.kind, text, x: k.x, y: k.y, z: k.z });
  return true;
}

// Is (x, y, z) inside the level (ground more than WALL above it: a wall, or deep in a slope)? A bolt that starts there (an alien
// muzzle buried in a wall) is reported there; it leaves no decal or particles.
const buried = (F, x, y, z) => F.lv.ground(x, z) - y > WALL;

// n particles of one kind: horizontal speed up to h each way, upward speed vy0..vy1, life l0..l1 seconds. The oldest go past MAX_PARTS.
function burst(F, kind, x, y, z, n, h, vy0, vy1, l0, l1) {
  if (buried(F, x, y, z)) return;
  const r = F.rng, P = F.parts;
  for (let i = 0; i < n; i++) P.push({ x, y, z, vx: r.range(-h, h), vy: r.range(vy0, vy1), vz: r.range(-h, h), kind, life: r.range(l0, l1) });
  if (P.length > MAX_PARTS) P.splice(0, P.length - MAX_PARTS);
}

// F.decals is one dense list; each kind keeps a ring (the decals' indices in that list, oldest first) of DECALS[kind].
function clearDecals(F) { F.decals.length = 0; F._dr = { scorch: { at: [], n: 0 }, goo: { at: [], n: 0 } }; F._gn = 0; }

// A mark at (x, y, z) facing the unit normal n (of a floor, wall or ceiling); past its kind's ring size it replaces that kind's
// oldest.
function decal(F, kind, x, y, z, r, n) {
  if (buried(F, x, y, z)) return;
  const R = F._dr[kind], i = R.n++ % DECALS[kind];
  const d = { x, y, z, nx: n[0], ny: n[1], nz: n[2], r, yaw: F.rng.range(0, TAU), kind };
  if (R.at.length < DECALS[kind]) { R.at.push(F.decals.length); F.decals.push(d); } else F.decals[R.at[i]] = d;
}

// Particles fall under the level's gravity. A move to where the ground is more than WALL above the particle (a wall) is
// refused: it keeps its x and z, loses its horizontal speed and falls down the face. Indoors the ceiling holds it down. Every
// 3rd goo particle to reach the ground sticks as a decal facing the floor (the rest vanish); sparks and dust settle and fade.
function stepParts(F, dt) {
  const P = F.parts, G = F.lv.ground, Cl = F.lv.ceil, g = F.gravity; let w = 0;
  for (const q of P) {
    if ((q.life -= dt) <= 0) continue;
    q.vy -= g * dt;
    const x = q.x + q.vx * dt, z = q.z + q.vz * dt;
    if (G(x, z) - q.y > WALL) q.vx = q.vz = 0; else { q.x = x; q.z = z; }
    q.y += q.vy * dt;
    if (Cl) { const c = Cl(q.x, q.z); if (q.y > c) { q.y = c; q.vy = Math.min(q.vy, 0); } }
    const gy = G(q.x, q.z);
    if (q.y <= gy) {
      if (q.kind === 'goo') { if (++F._gn % 3 === 0) decal(F, 'goo', q.x, gy, q.z, F.rng.range(.12, .3), groundNormal(G, q.x, q.z, Cl ? undefined : Infinity)); continue; }
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
