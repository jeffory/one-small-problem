// The fight view: every frame it turns a Fight into Frame fields (camera, meshes, lights, sphere occluders, sprites,
// the first-person view model and the red hurt vignette). It only reads the fight, the scene's lamps and the landers (the wreck,
// and the rescue ship in the dash); its GPU work is the model and lander-piece upload and dispose. The opening's view (opening.js)
// is fight-shaped, with three optional
// fields a real fight never has: eye (the eye's height over the feet, else PLAYER.eye), glow ([{x, y, z, s, r, g, b}], more
// dynamic light candidates) and flash (0-1, the blast's white flash, to tint[1]).
import { uploadMesh, disposeMesh } from '../gfx/gl.js';
import { cameraBasis, chainTo, trs, setT, setRx, setRy, setSc, rot3To, I3 } from '../gfx/math.js';
import { buildModels, VIEW_MODEL, TAPE_R } from './models.js';
import { RIGS, partMatrixTo, worldSpheresTo } from './rigs.js';
import { WEAPONS, TEAL } from './weapons.js';
import { PLAYER } from './player.js'; import { RADIO } from './radio.js';
import { landerMeshes, pieceMatrix } from './lander.js';
import { FLARE, flareAt, wakeIn } from './escape.js'; import { FX } from './opening.js';

// Per-frame caps (16 lights, 8 spheres, 512 sprites of which at most 192 opaque); FAR culls aliens and small props at 80 m.
const MAX_L = 16, MAX_SPH = 8, MAX_SPR = 512, MAX_OPQ = 192, FAR = 80;
// R18: the pole (built upright, 1.6 m) is gripped GRIP m up its shaft at HOLD (camera space, like VIEW_MODEL.off), leaned
// LEAN rad forward (nearly level) and turned TURN rad in, so its tip rests right of and below the crosshair. A swing turns it
// SWING[0] rad left and lifts it SWING[1] rad, sweeping the tip across the centre.
const GRIP = .25, LEAN = 1.3, TURN = .12, HOLD = [.16, -.23, .36], SWING = [.9, .35];
// A bolt and its trail: [size, intensity] for each of its 4 sprites, spaced .03 s of flight apart.
const TRAIL = [[1, 1], [.7, .55], [.55, .35], [.42, .2]];
// The tape glint (Plan 5): every period s a roll flashes a small sprite for `on` s, offset per roll by position.
export const TAPE_GLINT = { period: 2.5, on: .15, size: .1 };
// Lights (pre-flight F18): dynamic lights (plasma, booms, the muzzle, canisters) may take MAX_DYN of the 16 slots from the
// lamps, which keep at least 16 - MAX_DYN. A lamp counts if its sphere comes within FOG_REACH m of the camera; one that was on
// last frame is HYST m nearer for ranking, and a lamp fades in at LIGHT_FADE per second from 0 the frame it joins.
export const MAX_DYN = 6, HYST = 4, LIGHT_FADE = 4, FOG_REACH = 30;
const byD = (a, b) => a.d - b.d, smooth = v => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x); };

export function createFightView(gl, scene, models = buildModels()) {
  const gpu = {}, pieces = landerMeshes().map(m => uploadMesh(gl, m));
  for (const k in models) gpu[k] = uploadMesh(gl, models[k]);
  const V = { gpu, pieces, dispose() { for (const k in gpu) disposeMesh(gl, gpu[k]); pieces.forEach(m => disposeMesh(gl, m)); },
    _wreck: null, _m: [], _c: [], _pool: [], _mats: [], _rots: [], _ents: [], _cam: {}, _tint: [0, 0, 0], _born: new WeakMap(), _ph: 0, _t: null,
    _spr: { data: new Float32Array(MAX_SPR * 8), nOpaque: 0, nGlow: 0 } };
  setScene(V, scene);
  return V;
}

// Points the view at a scene: its static meshes and its lamps. Every lamp starts off and dark, so the first frame fades them in.
// _w: per-lamp weight (0-1); _on: per-lamp on-last-frame flag; _sel: the lamps lit this frame, in slot order; _key: rank scratch.
export function setScene(V, scene) {
  const n = (V.lamps = scene.lamps ?? []).length, key = V._key = new Float64Array(n);
  V.static = scene.meshes; V._w = new Float32Array(n); V._on = new Uint8Array(n); V._sel = []; V._byKey = (a, b) => key[a] - key[b];
}

// The lander's pieces to draw (a wreck from lander.js: the opening's, or the run's settled one on the surface), or null for none.
export function setWreck(V, W) { V._wreck = W; }

// A rotation taking +y to the unit normal n, placed at (x, y, z). A normal straight down (a ceiling) would divide by zero, so
// it gets the half-turn about x instead (local +y maps to -y).
export const tilt = (x, y, z, nx, ny, nz, o = new Float32Array(16)) => {
  if (ny < -.9999) o.set([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, x, y, z, 1]);
  else { const k = 1 / (1 + ny); o.set([1 - k * nx * nx, -nx, -k * nx * nz, 0, nx, ny, nz, 0, -k * nx * nz, -nz, 1 - k * nz * nz, 0, x, y, z, 1]); }
  return o;
};
const TA = new Float32Array(16), TB = new Float32Array(16), TC = new Float32Array(16);

export function fillFrame(V, F, frame, t) {
  const p = F.player, dead = F.state === 'dead', W = dead ? null : WEAPONS[F.ars.cur] || null, G = V.gpu;
  const dt = V._t === null ? 0 : Math.max(0, Math.min(.25, t - V._t));
  V._t = t;
  // 1. camera: the eye; after death it slumps to the ground and tips up to the sky
  const k = dead ? smooth(F.deadT / .7) : 0, cam = frame.cam = V._cam, eye = F.eye ?? PLAYER.eye;
  cam.x = p.x; cam.y = p.y + eye + (.35 - eye) * k; cam.z = p.z; cam.yaw = p.yaw; cam.pitch = p.pitch + (.6 - p.pitch) * k;
  const cx = cam.x, cy = cam.y, cz = cam.z, B = cameraBasis(cam.yaw, cam.pitch), { f, r, u } = B;
  const near = (x, z) => (x - cx) * (x - cx) + (z - cz) * (z - cz) < FAR * FAR;
  // the muzzle flash, for guns only (a pole swing also resets shotT)
  const mz = W && !W.melee && F.shotT < .06 ? [0, 1, 2].map(j => [cx, cy, cz][j] + r[j] * W.muzzle[0] + u[j] * W.muzzle[1] + f[j] * W.muzzle[2]) : null;

  // Candidates for the capped lists come from a pool of reused records, so a crowded frame doesn't allocate them anew.
  const C = V._c, pool = V._pool; let pn = 0;
  const add = (x, y, z, s, cr, cg, cb, o) => {
    const c = pool[pn] ??= {}; pn++;
    c.x = x; c.y = y; c.z = z; c.s = s; c.r = cr; c.g = cg; c.b = cb; c.o = o; c.d = (x - cx) * (x - cx) + (y - cy) * (y - cy) + (z - cz) * (z - cz);
    C.push(c);
  };
  const reset = () => { C.length = 0; pn = 0; };
  // how many to keep, the nearest first when there are too many
  const keep = n => { if (C.length > n) C.sort(byD); return Math.min(n, C.length); };

  // 2. meshes
  // Matrices, rotations and mesh entries come from pools that restart each frame, so a warm frame allocates none of them.
  let nm = 0, nr = 0, ne = 0;
  const mat = () => V._mats[nm++] ??= new Float32Array(16);
  const ent = (gpu, model, rot, flash) => {
    const e = V._ents[ne++] ??= {};
    e.gpu = gpu; e.model = model; e.rot = rot || rot3To(V._rots[nr++] ??= new Float32Array(9), model); e.flash = flash; return e;
  };
  const M = frame.meshes = V._m;
  M.length = 0;
  for (const m of V.static) M.push(m);
  const R = V._wreck;
  if (R) for (let k = 0; k < R.pieces.length; k++) { const q = R.pieces[k]; if (near(q.x, q.z)) M.push(ent(V.pieces[k], pieceMatrix(R, k, mat()))); }
  // the rescue ship, never culled at FAR: it shows the moment it clears the horizon
  const Sh = F.ship;
  if (Sh) for (let k = 0; k < Sh.W.pieces.length; k++) M.push(ent(V.pieces[k], pieceMatrix(Sh.W, k, mat())));
  for (const a of F.aliens) {
    if (!near(a.x, a.z)) continue;
    // R13 as amended by M1: a floater's 0.7 s wind-up pulses its flash between 0 and .22 at 6 Hz (a hit still flashes it fully)
    const parts = RIGS[a.type].parts, fl = a.type === 'fl' && a.state === 'aim' ? Math.max(a.flash, .11 - .11 * Math.cos(12 * Math.PI * t)) : a.flash;
    for (let i = 0; i < parts.length; i++) M.push(ent(G[parts[i].mesh], partMatrixTo(mat(), a, i), null, fl));
  }
  const fg = F.flag; // planted on the surface level only
  if (!fg.held && F.lv.id === 'surface') M.push(ent(G.flag, setT(mat(), fg.x, fg.y, fg.z), I3));
  for (const q of F.pickups) {
    if (!near(q.x, q.z)) continue;
    if (q.kind === 'tape') { M.push(ent(G.tape, trs(mat(), q.x, q.y + TAPE_R - .01, q.z, 2.4 * (q.x + q.z), 1))); continue; } // lies still on the ground
    const gun = q.kind === 'pistol' || q.kind === 'scatter';
    M.push(ent(G[q.kind === 'cells' ? 'cell' : q.kind], trs(mat(), q.x, q.y + (gun ? .45 : .3) + .1 * Math.sin(2.5 * t + q.x), q.z, 1.5 * t, gun ? 1.6 : 1)));
  }
  for (const c of F.canisters) if (near(c.x, c.z)) M.push(ent(G.canister, setT(mat(), c.x, c.y, c.z), I3, c.fuse > 0 ? .8 : 0));
  for (const b of F.balls) if (near(b.x, b.z)) M.push(ent(G.golf, setT(mat(), b.x, b.y + .06, b.z), I3));
  if (F.cell?.shut) { const b = F.lv.map.bars; M.push(ent(G.bars, trs(mat(), b.x, 0, b.z, Math.atan2(b.dx, b.dz), 1))); } // across the cell's doorway
  for (const d of F.decals) {
    if (!near(d.x, d.z)) continue;
    const m = chainTo(mat(), tilt(d.x + d.nx * .03, d.y + d.ny * .03, d.z + d.nz * .03, d.nx, d.ny, d.nz, TA), setRy(TB, d.yaw), setSc(TC, d.r));
    M.push(ent(d.kind === 'goo' ? G.discGoo : G.discScorch, m));
  }

  // 3. lights: the scene's lamps first, then the nearest of bolts, booms, the muzzle flash, canisters, the opening's glows
  // (pre-flight F18) and the rescue ship's engine as it comes down (the opening's plume light)
  reset();
  if (F.glow) for (const o of F.glow) add(o.x, o.y, o.z, o.s, o.r, o.g, o.b);
  if (Sh && !Sh.landed) { const U = FX.glow.plume; add(Sh.at.x, Sh.at.y + Sh.W.lift + U.y, Sh.at.z, U.s, U.col[0], U.col[1], U.col[2]); }
  for (const b of F.bolts) add(b.x, b.y, b.z, 7, b.col[0] * 1.3, b.col[1] * 1.3, b.col[2] * 1.3);
  for (const o of F.booms) { const e = 1 - o.age / .6; add(o.x, o.y, o.z, 12, 2.4 * e, 1.6 * e, .7 * e); }
  if (mz) add(mz[0], mz[1], mz[2], 6, TEAL[0] * 1.5, TEAL[1] * 1.5, TEAL[2] * 1.5);
  for (const c of F.canisters) add(c.x, c.y + .4, c.z, 3, .1, .35, .25);
  // Lamp candidates reach within FOG_REACH of the camera. Those whose sphere holds the camera rank first (their d - r is
  // negative, and the tier offset puts them below every other key); the rest rank by d - r, HYST nearer if on last frame.
  const lamps = V.lamps, w = V._w, on = V._on, key = V._key, sel = V._sel;
  sel.length = 0;
  for (let i = 0; i < lamps.length; i++) {
    const o = lamps[i], g = Math.sqrt((o.x - cx) * (o.x - cx) + (o.y - cy) * (o.y - cy) + (o.z - cz) * (o.z - cz)) - o.r;
    if (g < FOG_REACH) { key[i] = g < 0 ? g - 1e3 : g - (on[i] ? HYST : 0); sel.push(i); }
  }
  const nDyn = Math.min(C.length, MAX_L - Math.min(sel.length, MAX_L - MAX_DYN));
  if (sel.length > MAX_L - nDyn) { sel.sort(V._byKey); sel.length = MAX_L - nDyn; }
  // A lamp that joins starts dark, one that stays brightens, one that leaves goes dark (on: 2 marks this frame's set).
  for (const i of sel) { w[i] = on[i] ? Math.min(1, w[i] + LIGHT_FADE * dt) : 0; on[i] = 2; }
  for (let i = 0; i < lamps.length; i++) if (on[i] === 2) on[i] = 1; else { on[i] = 0; w[i] = 0; }
  const L = frame.lights ??= { pos: new Float32Array(MAX_L * 4), col: new Float32Array(MAX_L * 4), count: 0 }, lp = L.pos, lc = L.col;
  const light = (j, x, y, z, s, cr, cg, cb) => { j *= 4; lp[j] = x; lp[j + 1] = y; lp[j + 2] = z; lp[j + 3] = s; lc[j] = cr; lc[j + 1] = cg; lc[j + 2] = cb; lc[j + 3] = 0; };
  // kind 0 is steady, 1 (spawn doors) flickers off to .12, 2 (the reactor core) pulses
  for (let i = 0; i < sel.length; i++) {
    const o = lamps[sel[i]], c = o.col, a = w[sel[i]] * (o.kind === 1 ? (Math.sin(17 * t) + Math.sin(5.3 * t) > .6 ? .12 : 1) : o.kind === 2 ? .7 + .3 * Math.sin(3.1 * t) : 1);
    light(i, o.x, o.y, o.z, o.r, c[0] * a, c[1] * a, c[2] * a);
  }
  const nd = keep(nDyn);
  for (let i = 0; i < nd; i++) { const c = C[i]; light(sel.length + i, c.x, c.y, c.z, c.s, c.r, c.g, c.b); }
  L.count = sel.length + nd;

  // 4. sphere occluders: the live aliens nearest the camera, in order, until 8
  reset();
  for (const a of F.aliens) if (a.state !== 'dead') add(a.x, a.y, a.z, 0, 0, 0, 0, a);
  C.sort(byD);
  const S = frame.spheres ??= new Float32Array(MAX_SPH * 4);
  S.fill(0);
  let ns = 0;
  for (const c of C) { if (ns >= MAX_SPH) break; ns = worldSpheresTo(S, ns, c.o, MAX_SPH); }

  // 5. sprites: opaque goo, dust, the dust-ring puffs and the flare's smoke trail (at most 192), then glows until 512
  const P = frame.sprites = V._spr, D = P.data;
  const put = (i, c) => { const j = i * 8; D[j] = c.x; D[j + 1] = c.y; D[j + 2] = c.z; D[j + 3] = c.s; D[j + 4] = c.r; D[j + 5] = c.g; D[j + 6] = c.b; D[j + 7] = 0; };
  reset();
  for (const q of F.parts) {
    if (q.kind === 'goo') add(q.x, q.y, q.z, .07, .25, .3, .05);
    else if (q.kind === 'dust') add(q.x, q.y, q.z, .1, .18, .17, .15);
    else if (q.kind === 'puff') add(q.x, q.y, q.z, q.s, .2, .19, .17);
  }
  if (Sh) for (let k = 1; k <= FLARE.trail; k++) { const q = flareAt(Sh, k * FLARE.gap); if (q) add(q.x, q.y, q.z, .4 + .15 * k, .18, .18, .17); }
  const no = P.nOpaque = keep(MAX_OPQ);
  for (let i = 0; i < no; i++) put(i, C[i]);
  reset();
  // A bolt is white-hot for its first .06 s; the sim keeps no age, so the view notes when it first saw each one.
  for (const b of F.bolts) {
    let t0 = V._born.get(b);
    if (t0 === undefined) V._born.set(b, t0 = t);
    const hot = t - t0 < .06 ? 1.8 : 1;
    for (let j = 0; j < 4; j++) {
      const o = .03 * j, e = TRAIL[j][1] * hot;
      add(b.x - b.vx * o, b.y - b.vy * o, b.z - b.vz * o, b.r * TRAIL[j][0], b.col[0] * e, b.col[1] * e, b.col[2] * e);
    }
  }
  // sparks; the foil's glitter, small dim gold specks each twinkling on its own phase; the descent's exhaust, fading as it dies
  for (const q of F.parts) {
    if (q.kind === 'spark') { const e = Math.min(1, q.life * 5); add(q.x, q.y, q.z, .06, 1.2 * e, .5 * e, .12 * e); }
    else if (q.kind === 'foil') { const e = .25 + .75 * Math.max(0, Math.sin(11 * t + q.ph)); add(q.x, q.y, q.z, .045, .9 * e, .65 * e, .22 * e); }
    else if (q.kind === 'plume') { const e = Math.min(1, 8 * q.life); add(q.x, q.y, q.z, q.s, 1.3 * e, .8 * e, .35 * e); }
  }
  for (const o of F.booms) if (o.age < .4) add(o.x, o.y, o.z, 3 * (1 - o.age / .4), 1.2, .8, .35);
  if (mz) add(mz[0], mz[1], mz[2], .1, TEAL[0], TEAL[1], TEAL[2]);
  // the rescue ship's red flare, at least FLARE.ang across however far, and kept first however crowded the frame: it is the goal
  const fl = Sh && flareAt(Sh);
  if (fl) { const d = Math.sqrt((fl.x - cx) * (fl.x - cx) + (fl.y - cy) * (fl.y - cy) + (fl.z - cz) * (fl.z - cz)), c = FLARE.col;
    add(fl.x, fl.y, fl.z, Math.max(FLARE.size, d * FLARE.ang), c[0], c[1], c[2]); C[C.length - 1].d = -1; }
  // a golf ball glints for .15 s every 2.5 s, each on its own beat
  for (const b of F.balls) if (near(b.x, b.z) && (t + 1.7 * b.id) % 2.5 < .15) add(b.x, b.y + .06, b.z, .08, .5, .5, .45);
  for (const q of F.pickups) if (q.kind === 'tape' && near(q.x, q.z)) {
    const ph = t + 1.3 * (q.x + q.z); if (ph - TAPE_GLINT.period * Math.floor(ph / TAPE_GLINT.period) < TAPE_GLINT.on) add(q.x, q.y + 2 * TAPE_R - .03, q.z, TAPE_GLINT.size, .5, .5, .45);
  }
  const ng = P.nGlow = keep(MAX_SPR - no);
  for (let i = 0; i < ng; i++) put(no + i, C[i]);

  // 6. view model: the held weapon in camera space, bobbing with the walk; guns kick back, the pole swings
  V._ph += dt * (p.onGround ? Math.hypot(p.vx, p.vz) : 0) * 1.6;
  if (!W) frame.view = null;
  else {
    const o = W.melee ? HOLD : VIEW_MODEL.off, bx = o[0] + Math.cos(V._ph) * .005, by = o[1] + Math.sin(2 * V._ph) * .006;
    const Cm = mat(); Cm.set([r[0], r[1], r[2], 0, u[0], u[1], u[2], 0, -f[0], -f[1], -f[2], 0, cx, cy, cz, 1]);
    const sw = W.melee && F.shotT < .3 ? Math.sin(Math.PI * F.shotT / .3) : 0, kick = W.melee ? 0 : .05 * Math.max(0, 1 - F.shotT / .15);
    const m = W.melee ? chainTo(mat(), Cm, setT(mat(), bx, by, -o[2]), setRy(mat(), SWING[0] * sw), setRx(mat(), SWING[1] * sw), setRy(mat(), TURN), setRx(mat(), -LEAN), setSc(mat(), VIEW_MODEL.scale), setT(mat(), 0, -GRIP, 0))
      : chainTo(mat(), Cm, setT(mat(), bx, by, kick - o[2]), setSc(mat(), VIEW_MODEL.scale));
    frame.view = ent(G[W.melee ? 'pole' : W.id], m);
  }

  // 7. hurt vignette: tint = [k, w, reach]. k is how far the post pass mixes the screen edges toward blood red (it caps that at
  // .85, after tone mapping), reach how far in from the edges the red grows; w is the opening's white flash, mixed toward warm
  // off-white (capped at .85, F14).
  const K = frame.tint = V._tint;
  vignette(F, t, K); K[1] = F.flash || 0;
}

// The hurt vignette (Plan 5): a hit flares it by hurtT, below RADIO.low hp a rim pulses at VIG.hz, death closes it in, and so does
// the knock-out's wake on the cell floor, opening as you get up (Plan 6). God mode, Houston's call (F.ko), a won fight and the
// opening's view (no hp) never show the rim. Writes K[0] and K[2], leaves K[1], returns K.
export const VIG = { hit: .6, low: .22, pulse: .35, hz: 1, reach: .4, dead: .8, deadReach: .8 };
export function vignette(F, t, K) {
  if (F.state === 'dead') { K[0] = VIG.dead; K[2] = VIG.deadReach; return K; }
  if (F.ko?.phase === 'down' || F.ko?.phase === 'up') { K[0] = VIG.dead * (1 - wakeIn(F)); K[2] = VIG.deadReach; return K; }
  const low = F.hp < RADIO.low && !F.god && !F.ko && !F.won ? VIG.low * (1 + VIG.pulse * Math.sin(2 * Math.PI * VIG.hz * t)) : 0;
  K[0] = Math.max(VIG.hit * F.hurtT, low); K[2] = VIG.reach; return K;
}
