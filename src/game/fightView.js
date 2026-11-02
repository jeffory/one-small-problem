// The fight view: every frame it turns a Fight into Frame fields (camera, meshes, lights, sphere occluders, sprites,
// the first-person view model and the damage tint). It only reads the fight; its GPU work is the model upload and dispose.
import { uploadMesh, disposeMesh } from '../gfx/gl.js';
import { cameraBasis, chainTo, trs, setT, setRx, setRy, setSc, rot3To, I3 } from '../gfx/math.js';
import { buildModels, VIEW_MODEL } from './models.js';
import { RIGS, partMatrixTo, worldSpheresTo } from './rigs.js';
import { WEAPONS, TEAL } from './weapons.js';
import { PLAYER } from './player.js';

// Per-frame caps (16 lights, 8 spheres, 512 sprites of which at most 192 opaque); FAR culls aliens and small props at 80 m.
const MAX_L = 16, MAX_SPH = 8, MAX_SPR = 512, MAX_OPQ = 192, FAR = 80;
// R18: the pole (built upright, 1.6 m) is gripped GRIP m up its shaft at HOLD (camera space, like VIEW_MODEL.off), leaned
// LEAN rad forward (nearly level) and turned TURN rad in, so its tip rests right of and below the crosshair. A swing turns it
// SWING[0] rad left and lifts it SWING[1] rad, sweeping the tip across the centre.
const GRIP = .25, LEAN = 1.3, TURN = .12, HOLD = [.16, -.23, .36], SWING = [.9, .35];
// A bolt and its trail: [size, intensity] for each of its 4 sprites, spaced .03 s of flight apart.
const TRAIL = [[1, 1], [.7, .55], [.55, .35], [.42, .2]];
const byD = (a, b) => a.d - b.d, smooth = v => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x); };

export function createFightView(gl, scene, models = buildModels()) {
  const gpu = {};
  for (const k in models) gpu[k] = uploadMesh(gl, models[k]);
  return { gpu, static: scene.meshes, dispose() { for (const k in gpu) disposeMesh(gl, gpu[k]); },
    _m: [], _c: [], _pool: [], _mats: [], _rots: [], _ents: [], _cam: {}, _tint: [0, 0, 0], _born: new WeakMap(), _ph: 0, _t: null,
    _spr: { data: new Float32Array(MAX_SPR * 8), nOpaque: 0, nGlow: 0 } };
}

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
  // 1. camera: the eye; after death it slumps to the ground and tips up to the sky
  const k = dead ? smooth(F.deadT / .7) : 0, cam = frame.cam = V._cam;
  cam.x = p.x; cam.y = p.y + PLAYER.eye + (.35 - PLAYER.eye) * k; cam.z = p.z; cam.yaw = p.yaw; cam.pitch = p.pitch + (.6 - p.pitch) * k;
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
  for (const a of F.aliens) {
    if (!near(a.x, a.z)) continue;
    // R13 as amended by M1: a floater's 0.7 s wind-up pulses its flash between 0 and .22 at 6 Hz (a hit still flashes it fully)
    const parts = RIGS[a.type].parts, fl = a.type === 'fl' && a.state === 'aim' ? Math.max(a.flash, .11 - .11 * Math.cos(12 * Math.PI * t)) : a.flash;
    for (let i = 0; i < parts.length; i++) M.push(ent(G[parts[i].mesh], partMatrixTo(mat(), a, i), null, fl));
  }
  const fg = F.flag;
  if (!fg.held) M.push(ent(G.flag, setT(mat(), fg.x, fg.y, fg.z), I3));
  for (const q of F.pickups) {
    if (!near(q.x, q.z)) continue;
    const gun = q.kind === 'pistol' || q.kind === 'scatter';
    M.push(ent(G[q.kind === 'cells' ? 'cell' : q.kind], trs(mat(), q.x, q.y + (gun ? .45 : .3) + .1 * Math.sin(2.5 * t + q.x), q.z, 1.5 * t, gun ? 1.6 : 1)));
  }
  for (const c of F.canisters) if (near(c.x, c.z)) M.push(ent(G.canister, setT(mat(), c.x, c.y, c.z), I3, c.fuse > 0 ? .8 : 0));
  for (const d of F.decals) {
    if (!near(d.x, d.z)) continue;
    const m = chainTo(mat(), tilt(d.x + d.nx * .03, d.y + d.ny * .03, d.z + d.nz * .03, d.nx, d.ny, d.nz, TA), setRy(TB, d.yaw), setSc(TC, d.r));
    M.push(ent(d.kind === 'goo' ? G.discGoo : G.discScorch, m));
  }

  // 3. lights: the 16 nearest of bolts, booms, the muzzle flash and canisters
  reset();
  for (const b of F.bolts) add(b.x, b.y, b.z, 7, b.col[0] * 1.3, b.col[1] * 1.3, b.col[2] * 1.3);
  for (const o of F.booms) { const e = 1 - o.age / .6; add(o.x, o.y, o.z, 12, 2.4 * e, 1.6 * e, .7 * e); }
  if (mz) add(mz[0], mz[1], mz[2], 6, TEAL[0] * 1.5, TEAL[1] * 1.5, TEAL[2] * 1.5);
  for (const c of F.canisters) add(c.x, c.y + .4, c.z, 3, .1, .35, .25);
  const L = frame.lights ??= { pos: new Float32Array(MAX_L * 4), col: new Float32Array(MAX_L * 4), count: 0 }, nl = L.count = keep(MAX_L);
  for (let i = 0; i < nl; i++) { const c = C[i], q = L.pos, l = L.col, j = i * 4; q[j] = c.x; q[j + 1] = c.y; q[j + 2] = c.z; q[j + 3] = c.s; l[j] = c.r; l[j + 1] = c.g; l[j + 2] = c.b; l[j + 3] = 0; }

  // 4. sphere occluders: the live aliens nearest the camera, in order, until 8
  reset();
  for (const a of F.aliens) if (a.state !== 'dead') add(a.x, a.y, a.z, 0, 0, 0, 0, a);
  C.sort(byD);
  const S = frame.spheres ??= new Float32Array(MAX_SPH * 4);
  S.fill(0);
  let ns = 0;
  for (const c of C) { if (ns >= MAX_SPH) break; ns = worldSpheresTo(S, ns, c.o, MAX_SPH); }

  // 5. sprites: opaque goo and dust (at most 192), then glows until 512
  const P = frame.sprites = V._spr, D = P.data;
  const put = (i, c) => { const j = i * 8; D[j] = c.x; D[j + 1] = c.y; D[j + 2] = c.z; D[j + 3] = c.s; D[j + 4] = c.r; D[j + 5] = c.g; D[j + 6] = c.b; D[j + 7] = 0; };
  reset();
  for (const q of F.parts) {
    if (q.kind === 'goo') add(q.x, q.y, q.z, .07, .25, .3, .05);
    else if (q.kind === 'dust') add(q.x, q.y, q.z, .1, .18, .17, .15);
  }
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
  for (const q of F.parts) if (q.kind === 'spark') { const e = Math.min(1, q.life * 5); add(q.x, q.y, q.z, .06, 1.2 * e, .5 * e, .12 * e); }
  for (const o of F.booms) if (o.age < .4) add(o.x, o.y, o.z, 3 * (1 - o.age / .4), 1.2, .8, .35);
  if (mz) add(mz[0], mz[1], mz[2], .1, TEAL[0], TEAL[1], TEAL[2]);
  const ng = P.nGlow = keep(MAX_SPR - no);
  for (let i = 0; i < ng; i++) put(no + i, C[i]);

  // 6. view model: the held weapon in camera space, bobbing with the walk; guns kick back, the pole swings
  const dt = V._t === null ? 0 : Math.max(0, Math.min(.25, t - V._t));
  V._t = t; V._ph += dt * (p.onGround ? Math.hypot(p.vx, p.vz) : 0) * 1.6;
  if (!W) frame.view = null;
  else {
    const o = W.melee ? HOLD : VIEW_MODEL.off, bx = o[0] + Math.cos(V._ph) * .005, by = o[1] + Math.sin(2 * V._ph) * .006;
    const Cm = mat(); Cm.set([r[0], r[1], r[2], 0, u[0], u[1], u[2], 0, -f[0], -f[1], -f[2], 0, cx, cy, cz, 1]);
    const sw = W.melee && F.shotT < .3 ? Math.sin(Math.PI * F.shotT / .3) : 0, kick = W.melee ? 0 : .05 * Math.max(0, 1 - F.shotT / .15);
    const m = W.melee ? chainTo(mat(), Cm, setT(mat(), bx, by, -o[2]), setRy(mat(), SWING[0] * sw), setRx(mat(), SWING[1] * sw), setRy(mat(), TURN), setRx(mat(), -LEAN), setSc(mat(), VIEW_MODEL.scale), setT(mat(), 0, -GRIP, 0))
      : chainTo(mat(), Cm, setT(mat(), bx, by, kick - o[2]), setSc(mat(), VIEW_MODEL.scale));
    frame.view = ent(G[W.melee ? 'pole' : W.id], m);
  }

  // 7. damage tint (R17): tint[0] is how far the post pass mixes the tone-mapped image toward blood red (it caps that at .18);
  // dead holds a mild fixed shift
  const K = frame.tint = V._tint;
  K[0] = dead ? .12 : .18 * F.hurtT; K[1] = K[2] = 0;
}
