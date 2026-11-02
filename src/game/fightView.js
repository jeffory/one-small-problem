// The fight view: every frame it turns a Fight into Frame fields (camera, meshes, lights, sphere occluders, sprites,
// the first-person view model and the damage tint). It only reads the fight; its GPU work is the model upload and dispose.
import { uploadMesh, disposeMesh } from '../gfx/gl.js';
import { cameraBasis, MM, T, Rx, Ry, Sc, rot3, I3 } from '../gfx/math.js';
import { buildModels, VIEW_MODEL } from './models.js';
import { RIGS, partMatrix, worldSpheres } from './rigs.js';
import { WEAPONS, TEAL } from './weapons.js';
import { PLAYER } from './player.js';

// Per-frame caps (16 lights, 8 spheres, 512 sprites of which at most 192 opaque); FAR culls aliens and small props.
const MAX_L = 16, MAX_SPH = 8, MAX_SPR = 512, MAX_OPQ = 192, FAR = 150;
// R13: the pole (built upright, 1.6 m) is gripped GRIP m up its shaft, leaned LEAN rad forward and turned TURN rad across
// the view, like a spear held low at the right.
const GRIP = .25, LEAN = .95, TURN = .22;
// A bolt and its trail: [size, intensity] for each of its 4 sprites, spaced .03 s of flight apart.
const TRAIL = [[1, 1], [.7, .55], [.55, .35], [.42, .2]];
const byD = (a, b) => a.d - b.d, smooth = v => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x); };

export function createFightView(gl, scene, models = buildModels()) {
  const gpu = {};
  for (const k in models) gpu[k] = uploadMesh(gl, models[k]);
  return { gpu, static: scene.meshes, dispose() { for (const k in gpu) disposeMesh(gl, gpu[k]); },
    _m: [], _c: [], _pool: [], _cam: {}, _tint: [0, 0, 0], _born: new WeakMap(), _ph: 0, _t: null,
    _spr: { data: new Float32Array(MAX_SPR * 8), nOpaque: 0, nGlow: 0 } };
}

// A rotation taking +y to the unit normal n, placed at (x, y, z).
const tilt = (x, y, z, nx, ny, nz) => {
  const k = 1 / (1 + ny);
  return new Float32Array([1 - k * nx * nx, -nx, -k * nx * nz, 0, nx, ny, nz, 0, -k * nx * nz, -nz, 1 - k * nz * nz, 0, x, y, z, 1]);
};

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
  const M = frame.meshes = V._m;
  M.length = 0;
  for (const m of V.static) M.push(m);
  for (const a of F.aliens) {
    if (!near(a.x, a.z)) continue;
    // R13: a floater's 0.7 s wind-up keeps it lit
    const parts = RIGS[a.type].parts, fl = a.type === 'fl' && a.state === 'aim' ? Math.max(a.flash, .5) : a.flash;
    for (let i = 0; i < parts.length; i++) { const m = partMatrix(a, i); M.push({ gpu: G[parts[i].mesh], model: m, rot: rot3(m), flash: fl }); }
  }
  const fg = F.flag;
  if (!fg.held) M.push({ gpu: G.flag, model: T(fg.x, fg.y, fg.z), rot: I3 });
  for (const q of F.pickups) {
    if (!near(q.x, q.z)) continue;
    const gun = q.kind === 'pistol' || q.kind === 'scatter';
    const m = MM(T(q.x, q.y + (gun ? .45 : .3) + .1 * Math.sin(2.5 * t + q.x), q.z), Ry(1.5 * t), Sc(gun ? 1.6 : 1));
    M.push({ gpu: G[q.kind === 'cells' ? 'cell' : q.kind], model: m, rot: rot3(m) });
  }
  for (const c of F.canisters) if (near(c.x, c.z)) M.push({ gpu: G.canister, model: T(c.x, c.y, c.z), rot: I3, flash: c.fuse > 0 ? .8 : 0 });
  for (const d of F.decals) {
    if (!near(d.x, d.z)) continue;
    const m = MM(tilt(d.x + d.nx * .03, d.y + d.ny * .03, d.z + d.nz * .03, d.nx, d.ny, d.nz), Ry(d.yaw), Sc(d.r));
    M.push({ gpu: d.kind === 'goo' ? G.discGoo : G.discScorch, model: m, rot: rot3(m) });
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
  for (const c of C) {
    if (ns >= MAX_SPH) break;
    for (const s of worldSpheres(c.o)) if (ns < MAX_SPH) S.set(s, 4 * ns++);
  }

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
    const o = VIEW_MODEL.off, bx = o[0] + Math.cos(V._ph) * .005, by = o[1] + Math.sin(2 * V._ph) * .006;
    const Cm = new Float32Array([r[0], r[1], r[2], 0, u[0], u[1], u[2], 0, -f[0], -f[1], -f[2], 0, cx, cy, cz, 1]);
    const sw = W.melee && F.shotT < .3 ? Math.sin(Math.PI * F.shotT / .3) : 0, kick = W.melee ? 0 : .05 * Math.max(0, 1 - F.shotT / .15);
    const m = W.melee ? MM(Cm, T(bx, by, -o[2]), Rx(-1.2 * sw), Ry(TURN), Rx(-LEAN), Sc(VIEW_MODEL.scale), T(0, -GRIP, 0))
      : MM(Cm, T(bx, by, kick - o[2]), Sc(VIEW_MODEL.scale));
    frame.view = { gpu: G[W.melee ? 'pole' : W.id], model: m, rot: rot3(m) };
  }

  // 7. damage tint
  const K = frame.tint = V._tint;
  K[0] = dead ? .25 : .35 * F.hurtT; K[1] = K[2] = 0;
}
