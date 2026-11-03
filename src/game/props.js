// The look test's flag, the hangar-door bunker and the guide beacons. Visual geometry only. (The lander is lander.js's.)
import { box, beam, lathe, blob, transformFrom } from '../gfx/mesh.js';
import { MM, T, Ry } from '../gfx/math.js';
import { MAT } from '../gfx/materials.js';

// Pole planted 0.3 m into the ground at world (x, z); the cloth hangs off it toward +x.
export function buildFlag(M, x, z, groundAt) {
  const g = groundAt(x, z);
  beam(M, [x, g - .3, z], [x, g + 2.1, z], .025, MAT.hull);
  box(M, x, g + 1.42, z - .012, x + .9, g + 2.02, z + .012, MAT.hull);
}

// The hangar-door bunker: built at the origin with its door face toward +z, then placed on the pad and turned to face down the crater.
export function buildBunker(M, crater) {
  const b = crater.bunker, first = M.p.length / 3, W = MM(T(b.x, b.y, b.z), Ry(Math.atan2(b.ux, b.uz)));
  const hw = b.w / 2, hd = b.d / 2, dw = 1.3, dh = 3.2, rc = .4;
  box(M, -hw, 0, -hd, -dw, b.h, hd, MAT.wall);
  box(M, dw, 0, -hd, hw, b.h, hd, MAT.wall);
  box(M, -dw, dh, -hd, dw, b.h, hd, MAT.wall);
  box(M, -dw, 0, -hd, dw, dh, hd - rc, MAT.wall);
  box(M, -dw + .1, 0, hd - rc, -.08, dh - .1, hd - rc + .12, MAT.hull);
  box(M, .08, 0, hd - rc, dw - .1, dh - .1, hd - rc + .12, MAT.hull);
  box(M, -.08, 0, hd - rc, .08, dh - .1, hd - rc + .08, MAT.glass);
  box(M, -dw, b.h - .7, hd, dw, b.h - .5, hd + .05, MAT.coilB);
  transformFrom(M, first, W);
}

// A barred front: posts every .25 m across w along (ux, uz) from y to y + h, with a rail at each end, glowing teal.
export function buildBars(M, x, y, z, w, ux, uz, h) {
  const a = [x - ux * w / 2, z - uz * w / 2], b = [x + ux * w / 2, z + uz * w / 2], k = Math.round(w / .25);
  for (let i = 0; i <= k; i++) beam(M, [a[0] + (b[0] - a[0]) * i / k, y, a[1] + (b[1] - a[1]) * i / k], [a[0] + (b[0] - a[0]) * i / k, y + h, a[1] + (b[1] - a[1]) * i / k], .035, MAT.lamp);
  for (const v of [y + .05, y + h - .05]) beam(M, [a[0], v, a[1]], [b[0], v, b[1]], .035, MAT.lamp);
}

// R17: an alien beacon stalk under each guide lamp: a fleshy stalk from just under the ground up to a softly glowing bulb round the
// lamp. The bulb is emissive, so it shows at any range, even where the lamp itself isn't one of the frame's 16 lights.
export function buildGuides(M, lamps, groundAt) {
  for (const l of lamps) {
    lathe(M, [l.x, groundAt(l.x, l.z) - .3, l.z], [l.x, l.y - .1, l.z], [[0, .07], [.7, .04], [1, .03]], 6, MAT.fleshS);
    blob(M, [l.x, l.y, l.z], [.15, .2, .15], 8, 6, MAT.beacon, null);
  }
}
