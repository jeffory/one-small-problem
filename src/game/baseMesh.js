// The base's static geometry, built on the CPU from a BaseMap: the shell (floors, walls, ceilings, soffits, lintels)
// and the themed props, as two finishMesh outputs so the renderer needs two draw calls. Pure: no GL, no DOM.
import { createMesh, quad, box, beam, prism, blob, lathe, finishMesh } from '../gfx/mesh.js';
import { MAT } from '../gfx/materials.js';
import { buildBars } from './props.js';
import { K } from '../gen/base.js';
import { makeRng } from '../gen/rng.js';
import { vn3 } from '../gen/noise.js';

const EPS = 1e-3, TEAL = { lab: 1, reactor: 1, greenhouse: 1 };
const HULL_WET = [MAT.hull[0], MAT.hull[1], MAT.hull[2], 64]; // Sputnik-style probe sphere
const lump = (a, b, c) => 1 + .25 * (vn3(a * 2.2 + 5, b * 2.2, c * 2.2, 0) - .5) + .12 * (vn3(a * 5 + 5, b * 5, c * 5, 0) - .5);

// A horizontal tile square at height y, facing up (floor) or down (ceiling).
const floorQ = (M, x, z, y, mt) => quad(M, [x - .5, y, z - .5], [x - .5, y, z + .5], [x + .5, y, z + .5], [x + .5, y, z - .5], mt);
const ceilQ = (M, x, z, y, mt) => quad(M, [x - .5, y, z - .5], [x + .5, y, z - .5], [x + .5, y, z + .5], [x - .5, y, z + .5], mt);
// A vertical quad along the edge a -> b from y0 to y1, wound so its normal is (nx, nz).
function wallQ(M, ax, az, bx, bz, y0, y1, nx, nz, mt) {
  if (-(bz - az) * nx + (bx - ax) * nz < 0) { [ax, bx] = [bx, ax]; [az, bz] = [bz, az]; }
  quad(M, [ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], mt);
}
// An axis-aligned slab centred at (cx, cz): a0..a1 along the axis (ux, uz), +-t across it.
const slab = (M, cx, cz, ux, uz, a0, a1, t, y0, y1, mt) =>
  box(M, ux ? cx + a0 : cx - t, y0, uz ? cz + a0 : cz - t, ux ? cx + a1 : cx + t, y1, uz ? cz + a1 : cz + t, mt);

export function buildBaseMeshes(B) {
  const { n, half, floor, ceil, kind, room, rooms } = B, S = createMesh(), P = createMesh(), rng = makeRng(B.seed + B.cfg.stream + '/mesh');
  const inGrid = (i, j) => i >= 0 && j >= 0 && i < n && j < n, open = (i, j) => inGrid(i, j) && kind[j * n + i] !== K.wall;
  // The visual floor and ceiling: props keep their collision floor and ceiling, but are drawn with the room's (pre-flight F10).
  const vf = t => kind[t] === K.prop ? Math.fround(rooms[room[t]].floor) : floor[t], vc = t => kind[t] === K.prop ? Math.fround(rooms[room[t]].ceil) : ceil[t];
  const tileOf = (x, z) => Math.round(z + half) * n + Math.round(x + half);
  // The highest collision floor under a footprint of half-extent hw round (x, z).
  const topAt = (x, z, hw) => { let y = 0; for (let j = Math.round(z + half - hw); j <= Math.round(z + half + hw); j++) for (let i = Math.round(x + half - hw); i <= Math.round(x + half + hw); i++) {
    const t = j * n + i; if (open(i, j) && Math.abs(i - half - x) < hw && Math.abs(j - half - z) < hw) y = Math.max(y, floor[t]); } return y; };

  // ---- the shell ----
  const DIR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const t = j * n + i;
    if (kind[t] === K.wall) continue;
    const x = i - half, z = j - half, f = vf(t), c = vc(t), th = rooms[room[t]]?.theme;
    floorQ(S, x, z, f, th === 'greenhouse' ? MAT.soil : kind[t] === K.cover ? MAT.crate : MAT.grate); ceilQ(S, x, z, c, MAT.pipes);
    for (const [di, dj] of DIR) {
      const ex = x + di * .5, ez = z + dj * .5, px = dj ? .5 : 0, pz = di ? .5 : 0;
      if (!open(i + di, j + dj)) { wallQ(S, ex - px, ez - pz, ex + px, ez + pz, f, c, -di, -dj, MAT.wall); continue; }
      if (di + dj < 0) continue; // each open pair once, from its -x / -z tile
      const o = (j + dj) * n + i + di, fo = vf(o), co = vc(o);
      if (Math.abs(f - fo) > EPS) { const lowIsT = f < fo, hi = lowIsT ? o : t; wallQ(S, ex - px, ez - pz, ex + px, ez + pz, Math.min(f, fo), Math.max(f, fo), lowIsT ? -di : di, lowIsT ? -dj : dj, kind[hi] === K.cover ? MAT.crate : MAT.wall); }
      if (Math.abs(c - co) > EPS) { const tallIsT = c > co; wallQ(S, ex - px, ez - pz, ex + px, ez + pz, Math.min(c, co), Math.max(c, co), tallIsT ? -di : di, tallIsT ? -dj : dj, MAT.wall); }
    }
  }

  // ---- the props ----
  const jar = (p, rad, top) => { // an open frame: no transparency in the renderer
    lathe(P, [p.x, p.y, p.z], [p.x, p.y + .2, p.z], [[0, rad * .9], [.4, rad], [1, rad]], 14, MAT.gunMetal);
    lathe(P, [p.x, top - .2, p.z], [p.x, top, p.z], [[0, rad], [.6, rad], [1, rad * .9]], 14, MAT.gunMetal);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, sx = p.x + Math.cos(a) * rad * .92, sz = p.z + Math.sin(a) * rad * .92; beam(P, [sx, p.y + .2, sz], [sx, top - .2, sz], .025, MAT.hull); }
  };
  for (const p of B.props) {
    const { x, y, z } = p;
    if (p.kind === 'lift') {
      lathe(P, [x, y, z], [x, y + .04, z], [[0, 1.5], [1, 1.5]], 20, MAT.grate);
      // M4: a floor-to-ceiling pipe centred on each concave room corner, so only a .09 m square shows and no body reaches it; a
      // corner the doorway runs into is a straight wall there, so it gets none.
      const r = rooms[room[tileOf(x, z)]];
      for (const [ci, cj, oi, oj] of [[r.x0, r.z0, -1, -1], [r.x1 - 1, r.z0, 1, -1], [r.x0, r.z1 - 1, -1, 1], [r.x1 - 1, r.z1 - 1, 1, 1]])
        if (!open(ci + oi, cj) && !open(ci, cj + oj)) beam(P, [ci + oi / 2 - half, y, cj + oj / 2 - half], [ci + oi / 2 - half, r.ceil, cj + oj / 2 - half], .09, MAT.pipes);
    } else if (p.kind === 'saucer') { // R4: 4 m wide, matching its footprint
      lathe(P, [x, y + .5, z], [x, y + 1.5, z], [[0, .7], [.2, 1.7], [.45, 2], [.65, 1.75], [.85, 1], [1, .5]], 24, MAT.hull);
      blob(P, [x, y + 1.4, z], [.65, .5, .65], 14, 8, MAT.glass, null);
      lathe(P, [x, y + .52, z], [x, y + .68, z], [[0, 1], [.5, 1.2], [1, 1]], 24, MAT.glowRing);
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + .5, c = Math.cos(a), s = Math.sin(a); beam(P, [x + c * 1.15, y + .7, z + s * 1.15], [x + c * 1.6, y, z + s * 1.6], .06, MAT.hull); }
    } else if (p.kind === 'jarRover') {
      const top = topAt(x, z, 1); jar(p, .85, top);
      box(P, x - .36, y + .3, z - .22, x + .36, y + .55, z + .22, MAT.foil);
      for (const wx of [-.25, 0, .25]) for (const s of [-1, 1]) lathe(P, [x + wx, y + .15, z + s * .27], [x + wx, y + .15, z + s * .27 + .06], [[0, .13], [1, .13]], 8, MAT.glass);
      beam(P, [x + .25, y + .55, z], [x + .25, y + 1.1, z], .02, MAT.hull); box(P, x + .19, y + 1.1, z - .08, x + .33, y + 1.2, z + .08, MAT.gunMetal);
    } else if (p.kind === 'jarProbe') {
      const top = topAt(x, z, 1); jar(p, .85, top);
      blob(P, [x, y + .6, z], [.28, .28, .28], 12, 8, HULL_WET, null);
      for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; lathe(P, [x + Math.cos(a) * .2, y + .62, z + Math.sin(a) * .2], [x + Math.cos(a) * .75, y + .35, z + Math.sin(a) * .75], [[0, .014], [1, .006]], 5, MAT.hull); }
    } else if (p.kind === 'jar') {
      const top = topAt(x, z, .5); jar(p, .4, top);
      blob(P, [x, y + .5, z], [.2, .24, .2], 10, 7, MAT.flesh, lump);
    } else if (p.kind === 'core') { // the look test's stack, narrower so it stays inside the footprint
      prism(P, x, y, z, 1.5, .6, 10, MAT.wall); prism(P, x, y + .6, z, .9, 4.6, 10, MAT.reactor); prism(P, x, y + 5.2, z, 1.5, .5, 10, MAT.wall);
      beam(P, [x, y + 5.7, z], [x, p.d, z], .3, MAT.pipes);
    } else if (p.kind === 'bed') {
      const hw = p.w / 2, hd = p.d / 2, tp = topAt(x, z, Math.max(p.w, p.d) / 2 + .1);
      box(P, x - hw + .04, y, z - hd + .04, x + hw - .04, tp - .05, z + hd - .04, MAT.crate); box(P, x - hw + .1, tp - .05, z - hd + .1, x + hw - .1, tp, z + hd - .1, MAT.soil);
      for (let k = 3 + rng.int(4); k > 0; k--) {
        const sx = x + rng.range(-hw + .4, hw - .4), sz = z + rng.range(-hd + .4, hd - .4), h0 = rng.range(.8, 1.5), lx = rng.range(-.25, .25), lz = rng.range(-.25, .25);
        let h = h0; for (const l of B.lights) if (!l.kind && Math.abs(sx + lx - l.x) < .28 && Math.abs(sz + lz - l.z) < .28) h = Math.min(h, l.y - .27 - tp); // eye clears the fixture
        lathe(P, [sx, tp, sz], [sx + lx, tp + h, sz + lz], [[0, .05], [.5, .032], [1, .012]], 6, MAT.tent); blob(P, [sx + lx, tp + h + .05, sz + lz], [.07, .07, .07], 7, 5, MAT.stalkEye, null);
      }
    } else if (p.kind === 'dish') {
      const top = topAt(x, z, 1), ax = [.5, .86, -.15], l = Math.hypot(ax[0], ax[1], ax[2]), d = ax.map(v => v / l), a = [x, top + .15, z], at = t => [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
      box(P, x - 1, y + .6, z - 1, x + 1, top, z + 1, MAT.hull);
      const back = [], front = []; // a thin paraboloid shell: out along the underside, back along the inside, so the bowl stays open
      for (let k = 0; k <= 6; k++) { const r = 1.35 * k / 6, f = r * r / 4; back.push([f, r]); front.unshift([f + .05, r]); }
      lathe(P, a, at(1), [...back, ...front], 16, MAT.hull);
      lathe(P, at(.5), at(1), [[0, .02], [1, .02]], 5, MAT.gunMetal); lathe(P, at(.95), at(1.15), [[0, .1], [1, .03]], 8, MAT.gunMetal);
    } else if (p.kind === 'bars') {
      buildBars(P, x, y, z, p.w, Math.abs(p.dz), Math.abs(p.dx), 2.6);
    } else if (p.kind === 'cow') { // along the alcove, head toward +u; a is along it, c across it, both in metres from the alcove's centre
      const ux = Math.abs(p.dz), uz = Math.abs(p.dx), at = (a, up, c = 0) => [x + ux * a + uz * c, y + up, z + uz * a + ux * c];
      blob(P, at(0, .95), ux ? [.75, .45, .35] : [.35, .45, .75], 12, 8, MAT.hull, null);
      blob(P, at(.82, 1.05), ux ? [.26, .24, .2] : [.2, .24, .26], 10, 7, MAT.hull, null);
      for (const a of [-.5, .5]) for (const c of [-.2, .2]) beam(P, at(a, 0, c), at(a, .6, c), .05, MAT.gunMetal);
      for (const c of [-.14, .14]) beam(P, at(.8, 1.25, c), at(.8, 1.55, c * 2.2), .025, MAT.gunMetal);
    } else if (p.kind === 'chair') { // a reclined seat on a pedestal (2 x 2, 1 m tall), a probe arm down from the ceiling
      const top = rooms[room[tileOf(x, z)]].ceil;
      lathe(P, [x, y, z], [x, y + .85, z], [[0, .6], [.5, .3], [1, .45]], 10, MAT.gunMetal);
      beam(P, [x - .15, y + .92, z], [x + .65, y + .88, z], .3, MAT.hull); beam(P, [x - .15, y + .95, z], [x - .65, y + 1.5, z], .3, MAT.hull);
      beam(P, [x + .3, top, z + .5], [x + .3, y + 2.2, z + .5], .04, MAT.gunMetal); beam(P, [x + .3, y + 2.2, z + .5], [x - .05, y + 1.7, z + .15], .035, MAT.gunMetal);
      lathe(P, [x - .05, y + 1.7, z + .15], [x - .15, y + 1.5, z + .05], [[0, .05], [1, .004]], 6, MAT.gunMetal);
    } else if (p.kind === 'shelf') { // posts and three boards, 2 m tall, junk on every board
      const ux = p.w > p.d ? 1 : 0, uz = 1 - ux, hl = (ux ? p.w : p.d) / 2 - .06, hs = (ux ? p.d : p.w) / 2 - .06;
      for (const a of [-hl, hl]) for (const c of [-hs, hs]) beam(P, [x + ux * a + uz * c, y, z + uz * a + ux * c], [x + ux * a + uz * c, y + 2, z + uz * a + ux * c], .04, MAT.crate);
      for (const up of [.1, 1, 1.9]) {
        box(P, x - (ux ? hl : hs), y + up - .03, z - (uz ? hl : hs), x + (ux ? hl : hs), y + up + .03, z + (uz ? hl : hs), MAT.crate);
        for (let k = 1 + rng.int(3); k > 0; k--) {
          const a = rng.range(-hl + .2, hl - .2), sz = rng.range(.12, .3), ht = rng.range(.1, .35), cx = x + ux * a, cz = z + uz * a;
          box(P, cx - sz, y + up + .03, cz - sz, cx + sz, y + up + .03 + ht, cz + sz, rng.next() < .5 ? MAT.foil : MAT.gunMetal);
        }
      }
    } else if (p.kind === 'exit') { // the escape lift: a raised grate disc, four posts and an amber ring at 3 m
      lathe(P, [x, y - .3, z], [x, y + .04, z], [[0, 1.6], [1, 1.6]], 20, MAT.grate);
      for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, px = x + Math.cos(a) * 1.5, pz = z + Math.sin(a) * 1.5; beam(P, [px, y, pz], [px, y + 3, pz], .06, MAT.hull); }
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, b = (k + 1) * Math.PI / 8; beam(P, [x + Math.cos(a) * 1.6, y + 3, z + Math.sin(a) * 1.6], [x + Math.cos(b) * 1.6, y + 3, z + Math.sin(b) * 1.6], .04, MAT.amber); }
    } else if (p.kind === 'strip') {
      const ux = Math.abs(p.dz), uz = Math.abs(p.dx), t = tileOf(x + p.dx * .5, z + p.dz * .5), th = rooms[room[t]]?.theme;
      slab(P, x + p.dx * .025, z + p.dz * .025, ux, uz, -.6, .6, .025, y - .03, y + .03, TEAL[th] || (th !== 'hangar' && (room[t] & 1)) ? MAT.lamp : MAT.amber);
    }
  }

  // Spawn doors: two hull leaves at the back of each alcove, a red lamp box on the room-side wall face above the mouth (pre-flight F17).
  for (const d of B.spawnDoors) {
    const ux = Math.abs(d.dz), uz = Math.abs(d.dx), cx = d.x - d.dx * .44, cz = d.z - d.dz * .44, f = floor[tileOf(d.x, d.z)];
    slab(P, cx, cz, ux, uz, -.95, -.03, .05, f, f + 2.3, MAT.hull); slab(P, cx, cz, ux, uz, .03, .95, .05, f, f + 2.3, MAT.hull);
    const l = (B.lights || []).find(q => q.kind === 1 && Math.abs(q.x - (d.x + d.dx * .6)) < .05 && Math.abs(q.z - (d.z + d.dz * .6)) < .05);
    if (l) slab(P, l.x - d.dx * .05, l.z - d.dz * .05, ux, uz, -.15, .15, .05, l.y - .08, l.y + .08, MAT.red);
  }
  // Lamp fixtures: a pipe drop from the ceiling and a small box in the lamp's colour. The core has none; the red lamps are the door boxes.
  for (const l of B.lights || []) {
    const t = tileOf(l.x, l.z); if (kind[t] === K.wall) continue;
    if (l.kind === 1) { // pre-flight F20: spawn doors carry the red lamps' boxes; one without a door (the lift hall's) gets a small box of its own
      if (!B.spawnDoors.some(d => Math.abs(l.x - (d.x + d.dx * .6)) < .05 && Math.abs(l.z - (d.z + d.dz * .6)) < .05)) { box(P, l.x - .15, l.y - .08, l.z - .15, l.x + .15, l.y + .08, l.z + .15, MAT.red); beam(P, [l.x, vc(t), l.z], [l.x, l.y + .08, l.z], .03, MAT.pipes); }
      continue;
    }
    if (l.kind) continue; // kind 2, the reactor core's pulse, has no fixture
    const c = vc(t); if (c - l.y < .12) continue;
    beam(P, [l.x, c, l.z], [l.x, l.y + .1, l.z], .03, MAT.pipes); box(P, l.x - .16, l.y - .1, l.z - .16, l.x + .16, l.y + .1, l.z + .16, l.col[0] > l.col[2] ? MAT.amber : MAT.lamp);
  }
  // Corridors: two pipe runs along the sides, .35 m in from each wall.
  for (const l of B.links) {
    const A = rooms[l.a], C = rooms[l.b], xl = A.x1 <= C.x0 || C.x1 <= A.x0, y = 2.55, w = .09, o = .35;
    const x0 = l.x0 - .5 - half, x1 = l.x1 - .5 - half, z0 = l.z0 - .5 - half, z1 = l.z1 - .5 - half;
    for (const s of [o, -o]) {
      if (xl) { const zz = s > 0 ? z0 + s : z1 + s; beam(P, [x0, y, zz], [x1, y, zz], w, MAT.pipes); }
      else { const xx = s > 0 ? x0 + s : x1 + s; beam(P, [xx, y, z0], [xx, y, z1], w, MAT.pipes); }
    }
  }
  return { shell: finishMesh(S), props: finishMesh(P) };
}
