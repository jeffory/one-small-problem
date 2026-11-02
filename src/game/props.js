// The look test's lander and flag. Visual geometry only; the lander's shadow/collision heights are stamped in gen/surface.js.
import { box, beam, prism, lathe, blob, transformFrom } from '../gfx/mesh.js';
import { MM, T, Ry, xf } from '../gfx/math.js';
import { MAT } from '../gfx/materials.js';

// Built at the origin facing +z (the hatch windows), then placed at (x, y, z) and turned by yaw.
// groundAt(x, z) is the terrain height in world space; each footpad reaches it.
export function buildLander(M, x, y, z, yaw, groundAt) {
  const first = M.p.length / 3, W = MM(T(x, y, z), Ry(yaw));
  // descent stage: gold-foil octagon over a dark engine bell
  prism(M, 0, 1.0, 0, 2.0, 1.45, 8, MAT.foil, Math.PI / 8);
  prism(M, 0, .5, 0, .6, .55, 10, MAT.glass);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), fx = ca * 3.4, fz = sa * 3.4;
    const foot = xf(W, [fx, 0, fz]), fg = groundAt(foot[0], foot[2]) - y;
    beam(M, [ca * 1.7, 1.9, sa * 1.7], [fx, fg + .25, fz], .07, MAT.hull);
    beam(M, [ca * 1.9, 1.05, sa * 1.9], [fx, fg + .35, fz], .045, MAT.hull);
    prism(M, fx, fg - .05, fz, .42, .14, 8, MAT.hull);
  }
  // ascent stage: hexagonal cabin, two windows and the hatch on the +z face, top hatch, antenna dish, side thrusters
  prism(M, 0, 2.45, 0, 1.5, 1.6, 6, MAT.hull, Math.PI / 3);
  box(M, -.75, 3.35, 1.27, -.2, 3.75, 1.34, MAT.glass);
  box(M, .2, 3.35, 1.27, .75, 3.75, 1.34, MAT.glass);
  box(M, -.38, 2.5, 1.27, .38, 3.22, 1.33, MAT.hull);
  prism(M, 0, 4.05, 0, .55, .35, 8, MAT.hull);
  beam(M, [-.6, 4.0, -.4], [-1.1, 4.9, -.6], .03, MAT.hull);
  prism(M, -1.1, 4.9, -.6, .45, .06, 10, MAT.hull);
  for (const s of [-1, 1]) box(M, s * 1.45 - .15, 3.0, -.2, s * 1.45 + .15, 3.3, .2, MAT.hull);
  transformFrom(M, first, W);
}

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

// R17: an alien beacon stalk under each guide lamp: a fleshy stalk from just under the ground up to a softly glowing bulb round the
// lamp. The bulb is emissive, so it shows at any range, even where the lamp itself isn't one of the frame's 16 lights.
export function buildGuides(M, lamps, groundAt) {
  for (const l of lamps) {
    lathe(M, [l.x, groundAt(l.x, l.z) - .3, l.z], [l.x, l.y - .1, l.z], [[0, .07], [.7, .04], [1, .03]], 6, MAT.fleshS);
    blob(M, [l.x, l.y, l.z], [.15, .2, .15], 8, 6, MAT.beacon, null);
  }
}
