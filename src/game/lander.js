// The lander as 11 pre-cut pieces, and its break-up: a seeded, fixed-step sim of the pieces flying apart and coming to rest
// under surface gravity. Lander space: +z is the front (the hatch and the ladder), y = 0 the base; the world placement is
// T(lander) * Ry(ly) with ly = atan2(spawn.dx, spawn.dz). Pure: the view draws each piece's mesh with pieceMatrix.
import { createMesh, vtx, quad, box, beam, prism, lathe, finishMesh } from '../gfx/mesh.js';
import { MAT } from '../gfx/materials.js';
import { sampleBilinear, LANDER_OCC, HALF, MAP_MARGIN } from '../gen/surface.js';
import { makeRng } from '../gen/rng.js';
import { GRAVITY } from './areas.js';

// The six foil sheets' outward normals (cos a, 0, sin a): every octagon face but the front (pi/2) and the back (3 pi/2).
const FOIL = [0, 1, 3, 4, 5, 7].map(k => k * Math.PI / 4);
// at: the pivot each mesh is built about (lander space). v: launch velocity (lander m/s); w: spin (yaw, pitch, roll rad/s);
// rest: the pivot's height above the ground at rest; up: rests upright (pitch 0, a slight roll).
export const PIECES = [
  { id: 'descent', at: [0, 0, 0], fly: 0 },
  { id: 'cabin', at: [0, 3.25, 0], fly: 1, rest: .8, v: [0, 13, 4], w: [2.2, 1.2, .7], up: 1 },
  { id: 'hatch', at: [-.38, 2.86, 1.33], fly: 1, rest: .03, v: [-2, 7, 9], w: [5, 3, 2] },
  { id: 'dish', at: [-1.1, 4.9, -.6], fly: 1, rest: .1, v: [-4, 10, 2], w: [3, 4, 5] },
  { id: 'ladder', at: [0, 1.3, 2.75], fly: 1, rest: .06, v: [1.5, 6, 8], w: [1, 2, 3] },
  ...FOIL.map((a, k) => ({ id: 'foil' + k, at: [1.88 * Math.cos(a), 1.72, 1.88 * Math.sin(a)], fly: 1, rest: .02, v: [6 * Math.cos(a), 7, 6 * Math.sin(a)], w: [3, 4, 3] })),
];
// h: the fixed step (s); bounce: the share of a hard landing's fall speed kept upward; slide: the share of horizontal speed and
// spin kept by a bounce; settle: the longest settleWreck runs (s).
export const WRECK = { g: GRAVITY.surface, h: 1 / 60, bounce: .3, slide: .6, settle: 30 };
// The cabin and the hatch; the hatch's open yaw (rad, about its hinge); a landing faster than BOUNCE_V m/s bounces, a slower one
// rests; an upright piece rests with this roll (rad).
const CABIN = 1, HATCH = 2, HATCH_OPEN = 1.9, BOUNCE_V = 1.5, UP_ROLL = .18;

// --- meshes (lander space) ---
const tri = (M, a, b, c, mt) => M.i.push(vtx(M, a[0], a[1], a[2], mt), vtx(M, b[0], b[1], b[2], mt), vtx(M, c[0], c[1], c[2], mt));
// The openings in the cabin's flat front face: the hatch (x within +-HX, y HY0-HY1), and the two triangular windows (|x| WI-WO,
// y WY0-WY1), each with its slant from the outer bottom corner to the inner top one; as (x, y) outlines, the hatch, then left, right.
const HX = .38, HY0 = 2.5, HY1 = 3.22, WI = .14, WO = .68, WY0 = 3.32, WY1 = 3.86;
const HATCH_HOLE = [[-HX, HY0], [HX, HY0], [HX, HY1], [-HX, HY1]];
const WINDOWS = [-1, 1].map(s => [[s * WO, WY0], [s * WI, WY0], [s * WI, WY1]]);
// The cabin's outer hull (circumradius 1.5) and its inner shell, .06 inside it (z of the front faces: 1.299 and 1.239).
const R_HULL = 1.5, R_IN = R_HULL - .06 * 2 / Math.sqrt(3);

// A cabin shell's front face at depth z, half-width hw, from y0 to y1, around the openings (bands between their edges).
function front(M, z, hw, y0, y1, mt) {
  const q = (x0, ya, x1, yb) => quad(M, [x0, ya, z], [x1, ya, z], [x1, yb, z], [x0, yb, z], mt);
  if (y0 < HY0) q(-hw, y0, hw, HY0);
  q(-hw, HY0, -HX, HY1); q(HX, HY0, hw, HY1); q(-hw, HY1, hw, WY0);
  q(-hw, WY0, -WO, WY1); q(-WI, WY0, WI, WY1); q(WO, WY0, hw, WY1);
  for (const s of [-1, 1]) tri(M, [s * WO, WY0, z], [s * WI, WY1, z], [s * WO, WY1, z], mt); // above each window's slant
  q(-hw, WY1, hw, y1);
}
// A hexagonal shell of circumradius r turned pi/3 (so its +z face is flat), walls from y0 to y1 and both caps.
function hexShell(M, r, y0, y1, mt) {
  const P = k => { const a = (k + 1) * Math.PI / 3; return [r * Math.cos(a), r * Math.sin(a)]; }; // P(0): the front-right corner
  for (let k = 1; k < 6; k++) { const A = P(k), B = P(k + 1); quad(M, [A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]], mt); }
  front(M, P(0)[1], P(0)[0], y0, y1, mt);
  for (const y of [y0, y1]) { const c = vtx(M, 0, y, 0, mt), ring = []; for (let k = 0; k < 6; k++) { const A = P(k); ring.push(vtx(M, A[0], y, A[1], mt)); }
    for (let k = 0; k < 6; k++) M.i.push(c, ring[k], ring[(k + 1) % 6]); }
}
// The convex polygon pts (x, y) grown by d: each corner moves out to where its two edges, pushed d outward, meet.
function grow(pts, d) {
  const n = pts.length, cx = pts.reduce((s, p) => s + p[0], 0) / n, cy = pts.reduce((s, p) => s + p[1], 0) / n;
  const out = (a, b) => { const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey); let nx = ey / l, ny = -ex / l;
    if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; } return [nx, ny]; };
  return pts.map((p, i) => { const a = out(pts[(i + n - 1) % n], p), b = out(p, pts[(i + 1) % n]), k = d / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * k, p[1] + (a[1] + b[1]) * k]; });
}
// An opening through the cabin wall: its reveal joins the outer hull (zo) to the inner shell (zi) along every edge, and a frame of
// square beams w thick runs round it outside the opening, on the hull.
function opening(M, pts, zi, zo, w) {
  const g = grow(pts, w);
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], a = g[i], b = g[(i + 1) % g.length];
    quad(M, [p[0], p[1], zi], [p[0], p[1], zo], [q[0], q[1], zo], [q[0], q[1], zi], MAT.hull);
    beam(M, [a[0], a[1], zo], [b[0], b[1], zo], w, MAT.hull); });
}

function descent(M) {
  prism(M, 0, 1.0, 0, 2.0, 1.45, 8, MAT.hull, Math.PI / 8);
  // the engine bell: dark, open at the bottom (an inner cone up to the throat, the lip, the flared outside)
  lathe(M, [0, .5, 0], [0, 1.05, 0], [[.5, 0], [0, .5], [0, .6], [.4, .5], [1, .32]], 10, MAT.glass);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2, dx = Math.sin(a), dz = Math.cos(a), P = (r, y, s = 0) => [dx * r + dz * s, y, dz * r - dx * s]; // k = 0 is +z
    beam(M, P(1.7, 1.9), P(3.4, .25), .07, MAT.hull);
    beam(M, P(1.9, 1.05), P(3.4, .35), .045, MAT.hull);
    beam(M, P(3.4, .3), P(3.4, .06), .055, MAT.hull); // the strut's foot, down into the pad
    for (const s of [-1, 1]) beam(M, P(1.75, 1.25, .65 * s), P(2.6, 1.03), .03, MAT.hull); // side braces to the main strut
    prism(M, dx * 3.4, -.05, dz * 3.4, .42, .14, 8, MAT.hull);
  }
}
function cabin(M) {
  const zo = R_HULL * Math.sqrt(3) / 2, zi = R_IN * Math.sqrt(3) / 2;
  hexShell(M, R_HULL, 2.45, 4.05, MAT.hull);
  hexShell(M, R_IN, 2.5, 4.05 - .06, MAT.cabin);
  for (const hole of [HATCH_HOLE, ...WINDOWS]) opening(M, hole, zi, zo, .02);
  // the instrument panels, tilted back on the two front-oblique inner faces, with a few indicator lights
  for (const s of [-1, 1]) {
    const nx = s * Math.sqrt(3) / 2, nz = .5, tx = -s * .5, tz = Math.sqrt(3) / 2, P = (u, y, d) => [(zi - d) * nx + u * tx, y, (zi - d) * nz + u * tz];
    quad(M, P(-.55, 2.95, .14), P(.55, 2.95, .14), P(.55, 3.3, .03), P(-.55, 3.3, .03), MAT.cabin);
    quad(M, P(-.55, 2.95, .14), P(.55, 2.95, .14), P(.55, 2.95, 0), P(-.55, 2.95, 0), MAT.cabin);
    for (const [u, y] of [[-.35, 3.05], [-.1, 3.18], [.15, 3.05], [.38, 3.2]]) { const p = P(u, y, .15 - (y - 2.95) * .11 / .35); // just proud of the panel
      box(M, p[0] - .018, p[1] - .018, p[2] - .018, p[0] + .018, p[1] + .018, p[2] + .018, MAT.coil); }
  }
  // inside, aft: the equipment rack on the back wall and the ascent engine's cover
  box(M, -.6, 2.5, -zi, .6, 3.3, -zi + .22, MAT.cabin);
  prism(M, 0, 2.5, -.55, .42, .34, 8, MAT.cabin);
  // outside: the aft equipment bay, the docking tunnel and its rim, two VHF antennas, and the RCS quads with their nozzles
  box(M, -.7, 2.6, -zo - .35, .7, 3.7, -zo + .04, MAT.hull);
  prism(M, 0, 4.05, 0, .55, .35, 8, MAT.hull);
  prism(M, 0, 4.34, 0, .62, .05, 8, MAT.hull);
  for (const s of [-1, 1]) {
    beam(M, [s * .7, 4.05, -.95], [s * 1.1, 4.6, -1.35], .012, MAT.hull);
    const x = s * 1.45;
    box(M, x - .15, 3.0, -.2, x + .15, 3.3, .2, MAT.hull);
    for (const [a, b] of [[[x, 3.3, 0], [x, 3.46, 0]], [[x, 3.0, 0], [x, 2.84, 0]], [[x, 3.15, .2], [x, 3.15, .36]], [[x, 3.15, -.2], [x, 3.15, -.36]]]) beam(M, a, b, .035, MAT.hull);
  }
}
function hatch(M) {
  box(M, -.38, 2.5, 1.31, .38, 3.22, 1.35, MAT.hull);
  box(M, .22, 2.83, 1.35, .32, 2.89, 1.375, MAT.hull); // the handle
  box(M, -.4, 2.56, 1.33, -.36, 3.16, 1.365, MAT.hull); // the hinge
}
function dish(M) {
  beam(M, [-.6, 4.0, -.4], [-1.1, 4.9, -.6], .03, MAT.hull);
  prism(M, -1.1, 4.9, -.6, .45, .06, 10, MAT.hull);
  beam(M, [-1.1, 4.96, -.6], [-1.1, 5.05, -.6], .015, MAT.hull); // the feed
}
function ladder(M) {
  box(M, -.45, 2.4, 1.3, .45, 2.46, 2.2, MAT.hull); // the porch (its top 1 cm over the deck, so the two never fight for depth)
  for (const s of [-1, 1]) beam(M, [s * .22, 2.4, 2.2], [s * .22, .15, 3.3], .03, MAT.hull);
  for (let i = 0; i < 8; i++) { const t = (i + .5) / 8, y = 2.4 - 2.25 * t, z = 2.2 + 1.1 * t; beam(M, [-.22, y, z], [.22, y, z], .018, MAT.hull); }
}
// A foil sheet, 1.3 x 1.2, crinkled up to .015 either side of radius 1.88 (so .03 thick), as separate facets that catch the sun.
function foil(M, a, k) {
  const nx = Math.cos(a), nz = Math.sin(a), I = 5, J = 4;
  const P = (i, j) => { const h = ((Math.imul(i + 7 * k, 73856093) ^ Math.imul(j + 3, 19349663)) >>> 0) % 1001 / 500 - 1, r = 1.88 + .015 * h, u = -.65 + 1.3 * i / I;
    return [r * nx - u * nz, 1.12 + 1.2 * j / J, r * nz + u * nx]; };
  for (let j = 0; j < J; j++) for (let i = 0; i < I; i++) quad(M, P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1), MAT.foil);
}
const BUILD = [descent, cabin, hatch, dish, ladder, ...FOIL.map((a, k) => M => foil(M, a, k))];

// Each piece's mesh, in PIECES order: built in lander space, then moved so its pivot is the origin.
export function landerMeshes() {
  return PIECES.map(({ at }, k) => { const M = createMesh(); BUILD[k](M);
    for (let i = 0; i < M.p.length; i += 3) { M.p[i] -= at[0]; M.p[i + 1] -= at[1]; M.p[i + 2] -= at[2]; }
    return finishMesh(M); });
}

// --- the break-up ---
// The intact lander: every piece at its place, lift 0 (the opening raises it), the hatch shut, nothing flying.
export function createWreck(world) {
  const L = world.lander, ly = Math.atan2(world.spawn.dx, world.spawn.dz), c = Math.cos(ly), s = Math.sin(ly);
  const pieces = PIECES.map(({ at, fly }) => ({ x: L.x + c * at[0] + s * at[2], y: L.y + at[1], z: L.z - s * at[0] + c * at[2],
    yaw: ly, pitch: 0, roll: 0, vx: 0, vy: 0, vz: 0, wy: 0, wp: 0, wr: 0, still: !fly }));
  return { world, ly, lift: 0, hatch: 0, blown: false, acc: 0, pieces };
}

// o = T(x, y + lift, z) * Ry(yaw) * Rx(pitch) * Rz(roll) for piece k; until the blast the hatch swings open by W.hatch.
export function pieceMatrix(W, k, o) {
  const p = W.pieces[k], yaw = k === HATCH && !W.blown ? W.ly - HATCH_OPEN * W.hatch : p.yaw;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(p.pitch), sp = Math.sin(p.pitch), cr = Math.cos(p.roll), sr = Math.sin(p.roll);
  o[0] = cy * cr + sy * sp * sr; o[1] = cp * sr; o[2] = cy * sp * sr - sy * cr; o[3] = 0;
  o[4] = sy * sp * cr - cy * sr; o[5] = cp * cr; o[6] = sy * sr + cy * sp * cr; o[7] = 0;
  o[8] = sy * cp; o[9] = -sp; o[10] = cy * cp; o[11] = 0;
  o[12] = p.x; o[13] = p.y + W.lift; o[14] = p.z; o[15] = 1;
  return o;
}

// The blast, on the ground only: the hatch is open from now on, and every flying piece takes its launch velocity and spin
// (turned into the world), each scaled by one jitter in .8-1.2; the foil spins get random signs; the cabin's are exact. It goes up
// and forward, over the spawn toward Earth, so the knock-down's view shows it.
export function blast(W, rng) {
  if (W.lift !== 0) throw new Error('blast: the lander is still in the air');
  if (W.blown) return W;
  W.hatch = 1; W.blown = true; W.pieces[HATCH].yaw = W.ly - HATCH_OPEN;
  const c = Math.cos(W.ly), s = Math.sin(W.ly);
  PIECES.forEach((P, k) => {
    if (!P.fly) return;
    const p = W.pieces[k], j = k === CABIN ? 1 : rng.range(.8, 1.2), sg = () => P.id.startsWith('foil') && rng.next() < .5 ? -1 : 1, [vx, vy, vz] = P.v;
    p.vx = (c * vx + s * vz) * j; p.vy = vy * j; p.vz = (c * vz - s * vx) * j;
    p.wy = P.w[0] * j * sg(); p.wp = P.w[1] * j * sg(); p.wr = P.w[2] * j * sg();
  });
  return W;
}

const snap = a => Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
// dt seconds of the break-up, in whole WRECK.h steps (the remainder waits in W.acc), so where the pieces land never depends on
// the frame rate. Debris falls at the surface's gravity, bounces off the height field when it lands fast, and otherwise rests:
// flat on a face (pitch and roll to the nearest quarter turn) or, if upright, nearly level.
export function stepWreck(W, dt) {
  if (!W.blown) return W;
  const { g, h, bounce, slide } = WRECK, lim = HALF - MAP_MARGIN, ground = W.world.h;
  for (W.acc += dt; W.acc >= h; W.acc -= h) for (let k = 0; k < PIECES.length; k++) {
    const P = PIECES[k], p = W.pieces[k];
    if (!P.fly || p.still) continue;
    p.vy -= g * h;
    p.x = Math.max(-lim, Math.min(lim, p.x + p.vx * h)); p.y += p.vy * h; p.z = Math.max(-lim, Math.min(lim, p.z + p.vz * h));
    p.yaw += p.wy * h; p.pitch += p.wp * h; p.roll += p.wr * h;
    const top = sampleBilinear(ground, p.x, p.z) + P.rest;
    if (p.y > top) continue;
    p.y = top;
    if (p.vy < -BOUNCE_V) { p.vy *= -bounce; p.vx *= slide; p.vz *= slide; p.wy *= slide; p.wp *= slide; p.wr *= slide; }
    else { p.vx = p.vy = p.vz = p.wy = p.wp = p.wr = 0; p.still = true; p.pitch = P.up ? 0 : snap(p.pitch); p.roll = P.up ? UP_ROLL : snap(p.roll); }
  }
  return W;
}

// The wreck as every run without the opening finds it: blown with the run's own seed and stepped, a second at a time, until it all
// lies still (at most WRECK.settle s).
export function settleWreck(world) {
  const W = blast(createWreck(world), makeRng(world.seed + '/wreck'));
  for (let t = 0; t < WRECK.settle && W.pieces.some(p => !p.still); t++) stepWreck(W, 1);
  return W;
}

// The wreck's shadow heights: the generated occlusion with the cabin's column (every sample within LANDER_OCC.cabin's radius)
// lowered to the deck. The sim keeps the generated column (out of reach: the deck is higher than a jump), so generation is unchanged.
export function wreckOcc(world) {
  const { N, half, lander: L } = world, o = new Float32Array(world.occ), r = LANDER_OCC.cabin[0], deck = L.y + LANDER_OCC.deck[1];
  for (let j = Math.max(0, Math.floor(L.z + half - r)); j <= Math.min(N - 1, Math.ceil(L.z + half + r)); j++)
    for (let i = Math.max(0, Math.floor(L.x + half - r)); i <= Math.min(N - 1, Math.ceil(L.x + half + r)); i++)
      if (Math.hypot(i - half - L.x, j - half - L.z) < r) o[j * N + i] = deck;
  return o;
}
