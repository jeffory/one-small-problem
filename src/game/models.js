// Pure model builders (no GL): design-A aliens, held weapons, flag/pole and prop meshes as finishMesh output.
import { createMesh, vtx, quadIdx, box, blob, lathe, finishMesh } from '../gfx/mesh.js';
import { MAT } from '../gfx/materials.js';
import { vn3 } from '../gen/noise.js';
import { buildFlag } from './props.js';

// Held weapon placement in camera space, [right, up, forward]. Model-local -z points forward.
export const VIEW_MODEL = { off: [.15, -.16, .36], scale: .42 };

const lump = (sd, am = .32) => (a, b, c) => 1 + am * (vn3(a * 2.2 + sd, b * 2.2, c * 2.2, 0) - .5) + am * .44 * (vn3(a * 5 + sd, b * 5, c * 5, 0) - .5);
const make = fn => { const M = createMesh(); fn(M); return finishMesh(M); };
const disc = mt => make(M => {
  const c = vtx(M, 0, 0, 0, mt), r = [];
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; r.push(vtx(M, Math.cos(a), 0, Math.sin(a), mt)); }
  for (let k = 0; k < 12; k++) M.i.push(c, r[(k + 1) % 12], r[k]);
});

export function buildModels() {
  const skBody = make(m => {
    blob(m, [0, .55, -.25], [.4, .34, .48], 14, 10, MAT.flesh, lump(21, .25)); blob(m, [0, .5, .2], [.26, .2, .25], 10, 8, MAT.chitinF, lump(22, .2));
    for (const s of [-1, 1]) lathe(m, [s * .08, .44, .38], [s * .05, .36, .6], [[0, .045], [1, 0]], 6, MAT.chitin);
    for (const [x, y, z, r] of [[.07, .6, .42, .035], [-.07, .6, .42, .035], [.13, .55, .38, .025], [-.13, .55, .38, .025]]) blob(m, [x, y, z], [r, r, r], 6, 4, MAT.eye, null);
  });
  const skLeg = make(m => {
    lathe(m, [0, 0, 0], [.35, .28, 0], [[0, .05], [1, .04]], 7, MAT.chitin); blob(m, [.35, .28, 0], [.055, .055, .055], 7, 5, MAT.chitin, null);
    lathe(m, [.35, .28, 0], [.62, -.48, 0], [[0, .04], [1, .012]], 7, MAT.chitin);
  });
  const flBody = make(m => {
    lathe(m, [0, -.3, 0], [0, .62, 0], [[0, .5], [.12, .72], [.4, .78], [.7, .62], [.9, .36], [1, .05]], 16, MAT.flesh);
    lathe(m, [0, -.3, 0], [0, -.36, 0], [[0, .52], [1, .4]], 16, MAT.glowRing);
    blob(m, [0, -.4, 0], [.17, .12, .17], 10, 7, MAT.wetEye, null); blob(m, [0, -.5, 0], [.07, .05, .07], 8, 5, MAT.eye, null);
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283, c = Math.cos(a), s = Math.sin(a); lathe(m, [c * .38, -.3, s * .38], [c * .48, -1.55, s * .48], [[0, .07], [.5, .04], [1, .008]], 6, MAT.tent); }
  });
  const brBody = make(m => {
    blob(m, [0, 1.35, 0], [.62, .58, .5], 16, 12, MAT.flesh, lump(31, .25)); blob(m, [0, 1.62, -.18], [.74, .52, .58], 14, 10, MAT.chitinF, lump(32, .3));
    for (const s of [-1, 1]) blob(m, [s * .68, 1.78, 0], [.3, .24, .3], 10, 7, MAT.chitinF, lump(33 + s, .25));
    blob(m, [0, 1.5, .46], [.22, .2, .22], 10, 8, MAT.fleshS, lump(35, .2)); blob(m, [0, 1.38, .62], [.15, .06, .1], 8, 5, MAT.glass, null);
    for (const s of [-1, 1]) blob(m, [s * .08, 1.57, .66], [.04, .035, .03], 6, 4, MAT.eye, null);
    for (const s of [-1, 1]) { lathe(m, [s * .3, 1.0, 0], [s * .38, .1, .05], [[0, .2], [.5, .24], [1, .16]], 10, MAT.fleshS); blob(m, [s * .38, .08, .12], [.2, .1, .28], 8, 6, MAT.chitinF, null); }
  });
  const brClaw = make(m => {
    lathe(m, [0, 0, 0], [.22, -.62, .2], [[0, .16], [1, .12]], 10, MAT.fleshS); blob(m, [.22, -.62, .2], [.13, .13, .13], 8, 6, MAT.fleshS, null);
    blob(m, [.28, -.86, .36], [.17, .3, .17], 10, 8, MAT.chitinF, lump(36, .2)); blob(m, [.26, -1.0, .52], [.08, .2, .1], 8, 6, MAT.chitinF, null);
  });
  const brGun = make(m => {
    lathe(m, [0, 0, 0], [-.14, -.5, .22], [[0, .15], [1, .13]], 10, MAT.fleshS);
    lathe(m, [-.14, -.52, .15], [-.14, -.56, .95], [[0, .17], [.25, .2], [.75, .15], [.8, .17], [.86, .17], [.88, .12], [1, .1]], 12, MAT.chitin);
    lathe(m, [-.14, -.56, .93], [-.14, -.56, .97], [[0, .09], [1, .09]], 12, MAT.glowRing);
  });
  const pistol = make(m => {
    lathe(m, [0, 0, .06], [0, 0, -.46], [[0, .03], [.04, .052], [.14, .056], [.15, .047], [.19, .047], [.2, .056], [.56, .056], [.57, .044], [.82, .04], [.86, .05], [.9, .05], [.92, .034], [1, .028]], 16, MAT.gunMetal);
    for (let k = 0; k < 3; k++) lathe(m, [0, 0, -.13 - k * .075], [0, 0, -.16 - k * .075], [[0, .06], [.5, .069], [1, .06]], 16, MAT.coil);
    blob(m, [0, 0, -.465], [.026, .026, .02], 10, 6, MAT.coil, null);
    blob(m, [0, 0, .05], [.058, .058, .07], 12, 8, MAT.gunFlesh, lump(11));
    lathe(m, [0, -.035, .02], [0, -.2, .1], [[0, .03], [.5, .034], [1, .028]], 10, MAT.gunFlesh);
    lathe(m, [0, -.058, -.02], [0, -.052, -.36], [[0, .018], [.5, .022], [1, .014]], 8, MAT.gunFlesh);
  });
  // Scattergun: shorter, fatter barrel, flared bell muzzle, two coil rings, bigger flesh bulb. Spans z .10 .. -.50.
  const scatter = make(m => {
    lathe(m, [0, 0, .04], [0, 0, -.44], [[0, .05], [.05, .075], [.5, .08], [.58, .068], [.78, .074], [.88, .1], [.96, .135], [1, .125]], 16, MAT.gunMetal);
    for (let k = 0; k < 2; k++) lathe(m, [0, 0, -.1 - k * .11], [0, 0, -.14 - k * .11], [[0, .085], [.5, .097], [1, .085]], 16, MAT.coil);
    blob(m, [0, 0, -.46], [.03, .03, .04], 8, 6, MAT.coil, null);
    blob(m, [0, 0, .04], [.085, .085, .06], 12, 8, MAT.gunFlesh, lump(12));
    lathe(m, [0, -.05, .01], [0, -.21, .07], [[0, .035], [.5, .04], [1, .032]], 10, MAT.gunFlesh);
    lathe(m, [0, -.08, -.02], [0, -.075, -.34], [[0, .02], [.5, .025], [1, .016]], 8, MAT.gunFlesh);
  });
  // R18: a round shaft (the held pole is seen up close) and a small cloth near the tip, off toward +x
  const pole = make(m => { lathe(m, [0, 0, 0], [0, 1.6, 0], [[0, .024], [.97, .024], [1, .017]], 10, MAT.hull); box(m, 0, 1.4, -.006, .17, 1.57, .006, MAT.hull); });
  const flag = make(m => buildFlag(m, 0, 0, () => 0));
  const tape = make(m => lathe(m, [-.03, 0, 0], [.03, 0, 0], [[0, .07], [.06, .09], [.94, .09], [1, .07]], 14, MAT.tape));
  const cell = make(m => lathe(m, [0, 0, 0], [0, .25, 0], [[0, .01], [.1, .04], [.9, .04], [1, .01]], 10, MAT.coilB));
  const canister = make(m => {
    lathe(m, [0, 0, 0], [0, .8, 0], [[0, .26], [.04, .3], [.96, .3], [1, .24]], 14, MAT.gunMetal);
    lathe(m, [0, .3, 0], [0, .5, 0], [[0, .305], [1, .305]], 14, MAT.coilB);
    lathe(m, [0, .8, 0], [0, .9, 0], [[0, .12], [.5, .14], [1, .1]], 10, MAT.gunMetal);
  });
  const golf = make(m => blob(m, [0, 0, 0], [.06, .06, .06], 10, 7, MAT.golf, null)); // about three times real size, so it can be found
  return { skBody, skLeg, flBody, brBody, brClaw, brGun, pistol, scatter, pole, flag, tape, cell, canister, golf, discScorch: disc(MAT.scorch), discGoo: disc(MAT.goo) };
}
