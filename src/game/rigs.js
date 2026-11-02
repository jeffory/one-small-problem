// Pure design-A alien rigs: part lists with animation-state transforms, sphere occluders and muzzle points.
import { I4, T, Rx, Ry, Rz, MM, mul, xf } from '../gfx/math.js';
const PI = Math.PI, still = () => I4, sin = Math.sin, cos = Math.cos;
const sk = { parts: [{ mesh: 'skBody', at: still }], spheres: [[0, .55, -.2, .4], [0, .5, .22, .24]], muzzle: { part: 0, p: [0, .38, .64] } };
for (let i = 0; i < 6; i++) {
  const s = i < 3 ? 1 : -1, k = i % 3, by = [-.55, 0, .55][k], hip = [s * .16, .5, .18 - k * .18], ph = ((k + (s > 0 ? 0 : 1)) % 2) * PI;
  sk.parts.push({ mesh: 'skLeg', at: a => {
    if (i === 0 && a.wave > 0) return MM(T(hip[0], hip[1], hip[2]), Ry(by + .5 * sin(a.t * 12)), Rz(-1.1 * a.wave));
    const sw = .35 * sin(a.gait + ph), li = .3 * Math.max(0, cos(a.gait + ph));
    return MM(T(hip[0], hip[1], hip[2]), Ry(s > 0 ? by + sw : PI - (by + sw)), Rz(li));
  } });
}
const fl = { parts: [{ mesh: 'flBody', at: a => MM(Rz(.1 * sin(a.t * .9)), Rx(.07 * sin(a.t * 1.3))) }], spheres: [[0, .2, 0, .72]], muzzle: { part: 0, p: [0, -.55, 0] } };
const br = { parts: [{ mesh: 'brBody', at: still },
  { mesh: 'brClaw', at: a => MM(T(.74, 1.62, 0), Rx(.22 * sin(a.t * 1.7) - .15 - 1.6 * a.claw), Rz(-1.2 * a.wave)) },
  { mesh: 'brGun', at: a => MM(T(-.74, 1.62, 0), Rx(.07 * sin(a.t * 2.3) - a.aim)) }],
  spheres: [[0, 1.4, 0, .72], [0, 1.9, -.1, .5]], muzzle: { part: 2, p: [-.14, -.56, 1.0] } };
export const RIGS = { sk, fl, br };
export const alienBase = a => MM(T(a.x, a.y + (a.type === 'sk' ? .03 * Math.abs(sin(a.gait)) : 0), a.z), Ry(a.yaw), Rz(1.5 * a.fall));
export const partMatrix = (a, k) => mul(alienBase(a), RIGS[a.type].parts[k].at(a));
export const muzzleWorld = a => { const m = RIGS[a.type].muzzle; return xf(partMatrix(a, m.part), m.p); };
export const worldSpheres = a => { const b = alienBase(a); return RIGS[a.type].spheres.map(s => { const p = xf(b, s); return [p[0], p[1], p[2], s[3]]; }); };
