// The opening, spec 4.2 "never leave the helmet": a pure director that steps the beats from the touchdown, seen from the cabin
// through its triangular window, to the title drop. It moves the player and the lander, plays three scripted aliens, fills a
// fight-shaped view for fillFrame, and pushes radio cues, sound cues and stage events for the shell. You can move the whole time
// but for the knock-down. Pure: no DOM, GPU or clock; its randomness is O.rng and the wreck's own seed, so the same dt sequence
// plays the same opening.
import { makeRng } from '../gen/rng.js';
import { flagSpot, sampleBilinear } from '../gen/surface.js';
import { PLAYER, stepPlayer, knock } from './player.js';
import { ALIENS, createAlien, waveAt } from './aliens.js';
import { muzzleWorld } from './rigs.js';
import { PIECES, createWreck, blast, stepWreck, drawnGround } from './lander.js';
import { MAX_PARTS } from './fight.js';

// The beats; times (s) count from the beat each follows. alt: the lander's height (m) as the descent starts; descent: the start to
// touchdown; dust: the height (m) under which the engine sprays dust; hatch: touchdown to the hatch opening, which swings over hatchT;
// cabin, crawl, climb: your speeds (m/s) in the cabin, crawling out to the porch, and down the ladder; far, near: where the flag can
// go (m from the lander's centre); nag, auto: your first step to Houston's nudge and to Houston planting it for you; talk: your first
// step to the earliest the aliens' wait can start, so the step line is over before the flag's (R11); company: that wait, from the
// plant, to the aliens, who rise over rise, then speak (line), wave and fire, their bolts flying for flight; from the blast, flash
// (held, then faded over), down (the knock-down: look, its pitch (rad) up at Earth, and downEye, its eye (m), back to PLAYER.eye over
// getUp), tele (the telemetry line) and title (the drop); aliens: the actors d m down the route, side m apart across it; parts: the
// most particles at once.
export const OPEN = { alt: 24, descent: 9, dust: 5, hatch: 5.5, hatchT: .8, cabin: 1.2, crawl: 1, climb: 1.2, near: 15, far: 3.5, nag: 15, auto: 30,
  talk: 3.5, company: 2.5, rise: 1.5, line: 1, wave: 1.5, fire: 4.5, flight: .45, flash: [.12, 1.2], down: 2, look: .75, downEye: .3, getUp: .7,
  tele: .6, title: 5.5, aliens: { d: 40, side: 6, types: ['sk', 'br', 'fl'] }, parts: 500 };
// The way out, [x, y, z, eye] in lander space (y the feet): the cabin, the hatch, the porch, the foot of the ladder.
export const EGRESS = [[0, 2.5, .2, 1.05], [0, 2.5, 1.45, .45], [0, 2.45, 2.0, 1.7], [0, 0, 3.9, 1.7]];

// The show's particles and lights, a tuning table like OPEN. Ranges are [lo, hi]; speeds m/s, sizes and distances m, times s.
// dust: the touchdown spray, from the ground r out under the bell, v outward and up; rate a second; it lies `rest` after landing.
// plume: the exhaust's glow sprites from the bell's mouth (y up, lander space), v down and up to side across, size s; rate a second.
// glow: its light (y up, radius s, colour col times a flicker) and the cabin's (radius s, colour col).
// boot: the puff at your first step. spark, foil, puff: the blast's (foil: v in a random direction plus up, each its own life, so
// they thin out rather than all going at once (R10); puff: a ring r out, y up).
// knock: the blast's shove (out, up). rise: the actors' heights over the ground, from and to (walkers, the floater); sink: from `at`
// s after the blast they sink at v, the walkers out of sight and gone at `end`, the floater down to the ground and gone once there.
// boom: its life. bolt: the actors' bolt radius. disc: the cabin's room (radius); drop: the knock-down eye's fall; turn: its look
// rate (rad/s).
export const FX = {
  dust: { r: [1, 3], v: [6, 12], up: [1, 3], rate: 80, rest: [1, 2] },
  plume: { y: .5, v: [8, 14], side: 1, s: [.4, .8], life: [.12, .25], rate: 60 },
  glow: { plume: { y: .2, s: 9, col: [1.3, .8, .35], flicker: [.8, 1] }, cabin: { s: 2.2, col: [.5, .32, .12] } },
  boot: { n: 12, v: [.5, 1.5], up: [.3, 1], life: [.8, 1.4] },
  spark: { n: 30, h: 6, up: [1.5, 7], life: [.3, .7] },
  foil: { n: 140, v: [3, 9], up: 3, life: [7, 11] },
  puff: { n: 56, r: 2.2, y: .3, v: [9, 14], up: [1, 2.5], life: 3, s: [.35, .7] },
  knock: [4, 2.5], rise: { walk: [-2.6, 0], fl: [-1, 3] }, sink: { at: 1, v: 1.3, end: 3 },
  boom: .6, bolt: .3, disc: .45, drop: .4, turn: 3,
};
const TAU = 2 * Math.PI, IDLE = { fwd: 0, strafe: 0, run: false, jump: false }, CABIN = PIECES.find(q => q.id === 'cabin').at;
const clamp01 = k => Math.max(0, Math.min(1, k));
// a to b by k, clamped, landing on b exactly
const lerp = (a, b, k) => (k >= 1 ? b : a + (b - a) * clamp01(k));

// The opening for a fight F just created on the surface: the lander OPEN.alt up with you crouched in its cabin, the flag stowed.
export function createOpening(world, F) {
  const L = world.lander, ly = Math.atan2(world.spawn.dx, world.spawn.dz), c = Math.cos(ly), s = Math.sin(ly);
  const at = ([x, y, z]) => [L.x + c * x + s * z, L.y + y, L.z - s * x + c * z]; // lander space to the world (as createWreck)
  const wreck = createWreck(world), path = EGRESS.map(at), S = [0], ahead = Math.atan2(-world.spawn.dx, -world.spawn.dz);
  wreck.lift = OPEN.alt;
  path[3][1] = F.lv.ground(path[3][0], path[3][2]); // the ladder's foot stands on the ground
  for (let i = 1; i < EGRESS.length; i++) { const a = EGRESS[i - 1], b = EGRESS[i]; S.push(S[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
  F.flag.held = true;
  const p = F.player, gw = FX.glow;
  p.yaw = ahead + .28; p.pitch = -.3; // +.28 rad turns the view toward the window at lander +x (pre-flight F28)
  const O = { phase: 'descent', t: 0, hatch: 0, planted: false, prompt: '', lock: false, flash: 0, events: [], wreck, rng: makeRng(world.seed + '/opening'),
    view: { player: p, state: 'play', deadT: 0, ars: { cur: -1 }, shotT: 9, hurtT: 0, lv: F.lv, flag: F.flag, aliens: [], bolts: [], parts: [], booms: [],
      decals: [], pickups: [], canisters: [], balls: [], glow: [], eye: EGRESS[0][3], flash: 0 },
    // _u: down the route (lander +z); _x: across it (lander +x); _C: the cabin's centre; _path, _S: the way out and its arc lengths;
    // _arc: how far along it you are; _ox, _oz: where you are on the cabin's disc; _dust, _plume: spray owed; the beats' times
    // (null until known): _groundT your first step, _compT the aliens, _blastT the blast; _pl, _cl: the plume and cabin lights.
    _world: world, _F: F, _L: L, _ahead: ahead, _u: [s, c], _x: [c, -s], _C: at(CABIN), _path: path, _S: S, _arc: 0, _ox: 0, _oz: 0,
    _dust: 0, _plume: 0, _groundT: null, _compT: null, _blastT: null,
    _pl: { x: L.x, y: 0, z: L.z, s: gw.plume.s, r: 0, g: 0, b: 0 }, _cl: { x: 0, y: 0, z: 0, s: gw.cabin.s, r: gw.cabin.col[0], g: gw.cabin.col[1], b: gw.cabin.col[2] } };
  inCabin(O);
  return O;
}

const say = (O, type, key) => O.events.push(key === undefined ? { type } : { type, key });

// dt seconds of the opening under one frame's input. Beats at a time T happen in the step that reaches it (t0 < T <= t).
export function stepOpening(O, input, dt) {
  if (O.phase === 'done') return O;
  const F = O._F, p = F.player, V = O.view, t0 = O.t, t = O.t = t0 + dt, beat = T => T !== null && t0 < T && T <= t;
  if (t0 === 0 && t > 0) say(O, 'sfx', 'engine');
  stepParts(O, dt);
  for (const b of V.bolts) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; }
  { const B = V.booms; let w = 0; for (const o of B) if ((o.age += dt) < FX.boom) B[w++] = o; B.length = w; }

  // the lander: down on its engine, then the hatch
  if (O.phase === 'descent') {
    if (t >= OPEN.descent) { O.wreck.lift = 0; O.phase = 'landed'; say(O, 'radio', 'touchdown'); say(O, 'sfx', 'land'); }
    else { const k = 1 - t / OPEN.descent; O.wreck.lift = OPEN.alt * k * k; spray(O, dt); }
  }
  O.hatch = clamp01((t - OPEN.descent - OPEN.hatch) / OPEN.hatchT);
  if (beat(OPEN.descent + OPEN.hatch)) say(O, 'sfx', 'hatch');
  O.wreck.hatch = O.hatch; // pieceMatrix swings the door by it (pre-flight F7)

  // you (pre-flight F2): the cabin's disc, carried by the lift; the way out; your own feet; flat on your back
  const ph = O.phase;
  if (ph === 'landed' && O.hatch === 1 && input.fwd > 0) { O.phase = 'egress'; O._arc = 0; crawl(O, input, dt, t); }
  else if (ph === 'descent' || ph === 'landed') cabin(O, input, dt);
  else if (ph === 'egress') crawl(O, input, dt, t);
  else if (ph === 'down') { stepPlayer(p, IDLE, dt, F.lv.ground, F.lv.bound, F.gravity, null, Infinity); look(O, dt); }
  else stepPlayer(p, input, dt, F.lv.ground, F.lv.bound, F.gravity, null, Infinity);
  O.prompt = O.phase === 'landed' && O.hatch === 1 ? '[W] climb out' : '';

  // the flag, then company
  if (O.phase === 'ground' && !O.planted) flag(O, input, beat, t);
  if (O.phase === 'ground' && O.planted && t >= O._compT) { O.phase = 'company'; company(O); }
  if (V.aliens.length) actors(O, dt, beat, t);
  if (O.phase === 'company' && t >= O._compT + OPEN.fire + OPEN.flight) boom(O);

  // after the blast: the debris, the flash, the knock-down, the title drop
  const bT = O._blastT;
  if (bT !== null) {
    stepWreck(O.wreck, Math.min(dt, t - bT));
    O.flash = t - bT < OPEN.flash[0] ? 1 : clamp01(1 - (t - bT - OPEN.flash[0]) / OPEN.flash[1]);
    if (beat(bT + OPEN.tele)) say(O, 'radio', 'telemetry');
    if (O.phase === 'down' && t >= bT + OPEN.down) { O.phase = 'up'; O.lock = false; }
    if (t >= bT + OPEN.title) done(O);
  }
  glow(O);
  if (V.parts.length > OPEN.parts) V.parts.splice(0, V.parts.length - OPEN.parts);
  V.eye = eye(O, t); V.flash = O.flash;
  return O;
}

// --- you ---

// You on the cabin's disc (at OPEN.cabin m/s, relative to your yaw), carried by the lift.
function cabin(O, input, dt) {
  const p = O._F.player, n = Math.hypot(input.fwd, input.strafe), k = n > 1 ? 1 / n : 1, f = input.fwd * k, r = input.strafe * k;
  const s = Math.sin(p.yaw), c = Math.cos(p.yaw), v = OPEN.cabin * dt;
  let x = O._ox + (-s * f + c * r) * v, z = O._oz + (-c * f - s * r) * v;
  const d = Math.hypot(x, z);
  if (d > FX.disc) { x *= FX.disc / d; z *= FX.disc / d; }
  O._ox = x; O._oz = z;
  inCabin(O);
}
function inCabin(O) {
  const p = O._F.player, P = O._path[0];
  p.x = P[0] + O._ox; p.y = P[1] + O.wreck.lift; p.z = P[2] + O._oz;
  p.vx = p.vy = p.vz = p.kx = p.kz = 0; p.onGround = true; p.land = 0;
}

// The segment of the way out that arc length s is on, and how far along it (0-1).
const seg = (S, s) => { const i = s < S[1] ? 0 : s < S[2] ? 1 : 2; return [i, (s - S[i]) / (S[i + 1] - S[i])]; };

// W and S move you along the way out at each segment's speed, whichever way you face. The spot you left the cabin's disc from
// fades into the path over the first segment. Back at the start you are in the cabin again; at the end, on the ground.
function crawl(O, input, dt, t) {
  const S = O._S, end = S[3], dir = Math.sign(input.fwd);
  let s = O._arc, tau = dt;
  while (dir && tau > 0 && (dir > 0 ? s < end : s > 0)) {
    const i = dir > 0 ? (s < S[1] ? 0 : s < S[2] ? 1 : 2) : (s > S[2] ? 2 : s > S[1] ? 1 : 0);
    const v = i < 2 ? OPEN.crawl : OPEN.climb, edge = dir > 0 ? S[i + 1] : S[i], need = Math.abs(edge - s) / v;
    if (need > tau) { s += dir * v * tau; break; }
    s = edge; tau -= need;
  }
  O._arc = s;
  if (s <= 0) { O.phase = 'landed'; inCabin(O); return; }
  const p = O._F.player, P = O._path;
  if (s >= end) { // boot on the dust
    O.phase = 'ground'; O._groundT = t;
    p.x = P[3][0]; p.z = P[3][2]; p.y = O._F.lv.ground(p.x, p.z);
    p.vx = p.vy = p.vz = p.kx = p.kz = 0; p.onGround = true; p.land = 0;
    say(O, 'radio', 'step'); say(O, 'sfx', 'step');
    const r = O.rng, B = FX.boot;
    for (let k = 0; k < B.n; k++) { const a = r.range(0, TAU), v = r.range(B.v[0], B.v[1]);
      O.view.parts.push({ kind: 'dust', x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * v, vy: r.range(B.up[0], B.up[1]), vz: Math.sin(a) * v, life: r.range(B.life[0], B.life[1]) }); }
    return;
  }
  const [i, k] = seg(S, s), a = P[i], b = P[i + 1], fade = Math.max(0, 1 - s / S[1]);
  p.x = a[0] + (b[0] - a[0]) * k + O._ox * fade; p.y = a[1] + (b[1] - a[1]) * k; p.z = a[2] + (b[2] - a[2]) * k + O._oz * fade;
}

// Flat on your back: yaw turns to Earth (wrapped) and pitch up to OPEN.look, each at FX.turn rad/s.
function look(O, dt) {
  const p = O._F.player, m = FX.turn * dt, d = Math.atan2(Math.sin(O._ahead - p.yaw), Math.cos(O._ahead - p.yaw));
  p.yaw += Math.max(-m, Math.min(m, d)); p.pitch += Math.max(-m, Math.min(m, OPEN.look - p.pitch));
}

function eye(O, t) {
  switch (O.phase) {
    case 'descent': case 'landed': return EGRESS[0][3];
    case 'egress': { const [i, k] = seg(O._S, O._arc); return EGRESS[i][3] + (EGRESS[i + 1][3] - EGRESS[i][3]) * k; }
    case 'down': return lerp(PLAYER.eye, OPEN.downEye, (t - O._blastT) / FX.drop);
    case 'up': return lerp(OPEN.downEye, PLAYER.eye, (t - O._blastT - OPEN.down) / OPEN.getUp);
    default: return PLAYER.eye;
  }
}

// --- the flag ---

// In range, E plants it a metre ahead. Houston nags at OPEN.nag and plants it at OPEN.auto: a metre ahead in range, else at
// the flag spot, so you plant near the lander and see the blast, and the opening never stalls. The aliens come OPEN.company after
// the plant, but never before OPEN.talk + OPEN.company after your first step: the radio speaks its story lines in turn, and a quick
// plant would otherwise push "are we expecting anyone?" past the blast and the title line over 3 s past the stamp (R11).
function flag(O, input, beat, t) {
  const p = O._F.player, L = O._L, d = Math.hypot(p.x - L.x, p.z - L.z), ok = d >= OPEN.far && d <= OPEN.near;
  if (ok) O.prompt = '[E] plant the flag';
  const ahead = () => plant(O, p.x - Math.sin(p.yaw), p.z - Math.cos(p.yaw), t);
  if (ok && input.use) { ahead(); say(O, 'radio', 'planted'); return; }
  if (beat(O._groundT + OPEN.nag)) say(O, 'radio', 'nag');
  if (t >= O._groundT + OPEN.auto) { say(O, 'radio', 'autoplant'); if (ok) ahead(); else { const f = flagSpot(O._world); plant(O, f.x, f.z, t); } }
}
function plant(O, x, z, t) {
  const F = O._F;
  F.flag.x = x; F.flag.z = z; F.flag.y = drawnGround(O._world, x, z); F.flag.held = false; // on the dust, not the deck's collision ramp (R10)
  O.planted = true; O.prompt = ''; O._compT = Math.max(t, O._groundT + OPEN.talk) + OPEN.company;
}

// --- company ---

// Three scripted actors (not fight aliens) OPEN.aliens.d down the route, side by side across it, facing the lander.
function company(O) {
  const { d, side, types } = OPEN.aliens, L = O._L, [ux, uz] = O._u, [xx, xz] = O._x, G = O._F.lv.ground;
  types.forEach((type, k) => {
    const x = L.x + ux * d + xx * side * (k - 1), z = L.z + uz * d + xz * side * (k - 1), a = createAlien({ type, x, y: G(x, z) + rise(type)[0], z }, 900 + k, null);
    a.yaw = Math.atan2(L.x - x, L.z - z);
    O.view.aliens.push(a);
  });
}
const rise = type => (type === 'fl' ? FX.rise.fl : FX.rise.walk);

// They rise over OPEN.rise, the brute waves, each fires one bolt into the cabin; after the blast they duck out of sight. The
// floater only comes down to the ground, and goes once it is there, never in mid-air (R10).
function actors(O, dt, beat, t) {
  const A = O.view.aliens, G = O._F.lv.ground, cT = O._compT, bT = O._blastT, K = FX.sink; let w = 0;
  for (const a of A) {
    const [lo, hi] = rise(a.type), g = G(a.x, a.z), fl = a.type === 'fl';
    a.t += dt;
    a.y = g + lerp(lo, hi, (t - cT) / OPEN.rise) - (bT === null ? 0 : K.v * Math.max(0, t - bT - K.at));
    if (fl && bT !== null) a.y = Math.max(g, a.y);
    if (a.type === 'br') a.wave = waveAt(t - cT - OPEN.wave); // pre-flight F17: the fight's own wave
    if (bT === null || t < bT + K.end || (fl && a.y > g)) A[w++] = a;
  }
  A.length = w;
  if (beat(cT + OPEN.line)) say(O, 'radio', 'company');
  const fT = cT + OPEN.fire;
  if (beat(fT)) for (const a of A) { // each bolt flies OPEN.flight s from the muzzle to the cabin's centre, from the beat's time
    const m = muzzleWorld(a), C = O._C, vx = (C[0] - m[0]) / OPEN.flight, vy = (C[1] - m[1]) / OPEN.flight, vz = (C[2] - m[2]) / OPEN.flight, e = t - fT;
    O.view.bolts.push({ x: m[0] + vx * e, y: m[1] + vy * e, z: m[2] + vz * e, vx, vy, vz, r: FX.bolt, col: ALIENS[a.type].bolt.col, src: a.id });
  }
}

// The bolts arrive: the lander blows apart in silence but for a thud through your boots; a flash, sparks, glittering foil, a ring
// of dust, and you are knocked off your feet away from it.
function boom(O) {
  const F = O._F, p = F.player, L = O._L, C = O._C, V = O.view, r = O.rng, P = V.parts, h = O._world.h;
  O._blastT = O._compT + OPEN.fire + OPEN.flight;
  V.bolts.length = 0;
  blast(O.wreck, makeRng(O._world.seed + '/wreck'));
  say(O, 'sfx', 'thud'); say(O, 'wreck');
  V.booms.push({ x: C[0], y: C[1], z: C[2], age: 0 });
  const K = FX.spark;
  for (let k = 0; k < K.n; k++) P.push({ kind: 'spark', x: C[0], y: C[1], z: C[2], vx: r.range(-K.h, K.h), vy: r.range(K.up[0], K.up[1]), vz: r.range(-K.h, K.h), life: r.range(K.life[0], K.life[1]) });
  const Fo = FX.foil;
  for (let k = 0; k < Fo.n; k++) { const u = r.range(-1, 1), a = r.range(0, TAU), w = Math.sqrt(1 - u * u), v = r.range(Fo.v[0], Fo.v[1]);
    P.push({ kind: 'foil', x: C[0], y: C[1], z: C[2], vx: v * w * Math.cos(a), vy: v * u + Fo.up, vz: v * w * Math.sin(a), life: r.range(Fo.life[0], Fo.life[1]), ph: r.range(0, TAU) }); }
  const Pu = FX.puff;
  for (let k = 0; k < Pu.n; k++) { const a = (k + r.next()) * TAU / Pu.n, cx = Math.cos(a), sz = Math.sin(a), x = L.x + cx * Pu.r, z = L.z + sz * Pu.r, v = r.range(Pu.v[0], Pu.v[1]);
    P.push({ kind: 'puff', x, y: sampleBilinear(h, x, z) + Pu.y, z, vx: cx * v, vy: r.range(Pu.up[0], Pu.up[1]), vz: sz * v, life: Pu.life, s: r.range(Pu.s[0], Pu.s[1]) }); }
  let dx = p.x - L.x, dz = p.z - L.z; const l = Math.hypot(dx, dz);
  if (l > 1e-6) { dx /= l; dz /= l; } else [dx, dz] = O._u;
  knock(p, FX.knock[0] * dx, FX.knock[1], FX.knock[0] * dz);
  O.flash = 1; O.phase = 'down'; O.lock = true; O.prompt = '';
}

// The title drop. The glitter and dust still about go on into play in F.parts, so they don't vanish with the stamp (pre-flight F6);
// those inside the ground (fallen into the lander's footing) are left behind.
function done(O) {
  const F = O._F, G = F.lv.ground;
  say(O, 'title'); say(O, 'radio', 'title'); say(O, 'sfx', 'stamp'); say(O, 'done');
  for (const q of O.view.parts) if ((q.kind === 'foil' || q.kind === 'puff' || q.kind === 'dust') && q.y >= G(q.x, q.z)) F.parts.push(q);
  if (F.parts.length > MAX_PARTS) F.parts.splice(0, F.parts.length - MAX_PARTS);
  O.phase = 'done'; O.lock = false; O.prompt = '';
}

// --- particles and lights ---

// The descent's exhaust glow under the bell and, under OPEN.dust m, its dust spray from the ground beneath (FX.dust.rate a second).
function spray(O, dt) {
  const r = O.rng, L = O._L, P = O.view.parts, lift = O.wreck.lift, D = FX.dust, U = FX.plume, g = O._F.gravity;
  if (lift < OPEN.dust) for (O._dust += D.rate * dt; O._dust >= 1; O._dust--) {
    const a = r.range(0, TAU), d = r.range(D.r[0], D.r[1]), cx = Math.cos(a), sz = Math.sin(a), x = L.x + cx * d, z = L.z + sz * d, v = r.range(D.v[0], D.v[1]), up = r.range(D.up[0], D.up[1]);
    P.push({ kind: 'dust', x, y: sampleBilinear(O._world.h, x, z), z, vx: cx * v, vy: up, vz: sz * v, life: 2 * up / g + r.range(D.rest[0], D.rest[1]) });
  }
  for (O._plume += U.rate * dt; O._plume >= 1; O._plume--) {
    const a = r.range(0, TAU), w = r.range(0, U.side);
    P.push({ kind: 'plume', x: L.x, y: L.y + lift + U.y, z: L.z, vx: Math.cos(a) * w, vy: -r.range(U.v[0], U.v[1]), vz: Math.sin(a) * w, life: r.range(U.life[0], U.life[1]), s: r.range(U.s[0], U.s[1]) });
  }
}

// Particles fly clean airless arcs under F.gravity (exactly, so at any frame rate) and stop on F.lv.ground. One that starts inside
// the ground (dust from under the lander's deck, foil in its cabin column) flies until it comes out; only one that was above the
// ground lands on it. They lose life; spent ones go.
function stepParts(O, dt) {
  const P = O.view.parts, G = O._F.lv.ground, g = O._F.gravity; let w = 0;
  for (const q of P) {
    if ((q.life -= dt) <= 0) continue;
    const above = q.y >= G(q.x, q.z);
    q.x += q.vx * dt; q.z += q.vz * dt; q.y += (q.vy - g * dt / 2) * dt; q.vy -= g * dt;
    if (above) { const y = G(q.x, q.z); if (q.y <= y) { q.y = y; q.vx = q.vy = q.vz = 0; } }
    P[w++] = q;
  }
  P.length = w;
}

// The plume's light while the engine burns (flickering by O.rng); the cabin's while you're in it or crawling out.
function glow(O) {
  const L = O._L, Gl = O.view.glow, lift = O.wreck.lift, ph = O.phase;
  Gl.length = 0;
  if (ph === 'descent') { const U = FX.glow.plume, f = O.rng.range(U.flicker[0], U.flicker[1]), o = O._pl;
    o.y = L.y + lift + U.y; o.r = U.col[0] * f; o.g = U.col[1] * f; o.b = U.col[2] * f; Gl.push(o); }
  if (ph === 'descent' || ph === 'landed' || (ph === 'egress' && O._arc < O._S[2])) { const o = O._cl, C = O._C;
    o.x = C[0]; o.y = C[1] + lift; o.z = C[2]; Gl.push(o); }
}
