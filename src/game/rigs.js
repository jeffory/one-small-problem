// Pure design-A alien rigs: part lists with animation-state transforms, sphere occluders and muzzle points.
import { I4, chainTo, mulTo, setT, setRx, setRy, setRz, xf } from '../gfx/math.js';
const PI = Math.PI, sin = Math.sin, cos = Math.cos;
// Each part's at(a, o) writes its local matrix into o. Module scratch matrices keep the whole chain allocation-free.
const still = (a, o) => (o.set(I4), o), M1 = new Float32Array(16), M2 = new Float32Array(16), M3 = new Float32Array(16), RB = new Float32Array(16), RP = new Float32Array(16);
const sk = { parts: [{ mesh: 'skBody', at: still }], spheres: [[0, .55, -.2, .4], [0, .5, .22, .24]], muzzle: { part: 0, p: [0, .38, .64] } };
for (let i = 0; i < 6; i++) {
  const s = i < 3 ? 1 : -1, k = i % 3, by = [-.55, 0, .55][k], hip = [s * .16, .5, .18 - k * .18], ph = ((k + (s > 0 ? 0 : 1)) % 2) * PI;
  sk.parts.push({ mesh: 'skLeg', at: (a, o) => {
    if (i === 0 && a.wave > 0) return chainTo(o, setT(M1, hip[0], hip[1], hip[2]), setRy(M2, by + .5 * sin(a.t * 12)), setRz(M3, -1.1 * a.wave));
    const sw = .35 * sin(a.gait + ph), li = .3 * Math.max(0, cos(a.gait + ph));
    return chainTo(o, setT(M1, hip[0], hip[1], hip[2]), setRy(M2, s > 0 ? by + sw : PI - (by + sw)), setRz(M3, li));
  } });
}
const fl = { parts: [{ mesh: 'flBody', at: (a, o) => chainTo(o, setRz(M1, .1 * sin(a.t * .9)), setRx(M2, .07 * sin(a.t * 1.3))) }], spheres: [[0, .2, 0, .72]], muzzle: { part: 0, p: [0, -.55, 0] } };
const br = { parts: [{ mesh: 'brBody', at: still },
  { mesh: 'brClaw', at: (a, o) => chainTo(o, setT(M1, .74, 1.62, 0), setRx(M2, .22 * sin(a.t * 1.7) - .15 - 1.6 * a.claw), setRz(M3, -1.2 * a.wave)) },
  { mesh: 'brGun', at: (a, o) => chainTo(o, setT(M1, -.74, 1.62, 0), setRx(M2, .07 * sin(a.t * 2.3) - a.aim)) }],
  spheres: [[0, 1.4, 0, .72], [0, 1.9, -.1, .5]], muzzle: { part: 2, p: [-.14, -.56, 1.0] } };
export const RIGS = { sk, fl, br };
export const alienBaseTo = (o, a) => chainTo(o, setT(M1, a.x, a.y + (a.type === 'sk' ? .03 * Math.abs(sin(a.gait)) : 0), a.z), setRy(M2, a.yaw), setRz(M3, 1.5 * a.fall));
export const partMatrixTo = (o, a, k) => { alienBaseTo(RB, a); return mulTo(o, RB, RIGS[a.type].parts[k].at(a, RP)); };
export const alienBase = a => alienBaseTo(new Float32Array(16), a);
export const partMatrix = (a, k) => partMatrixTo(new Float32Array(16), a, k);
export const muzzleWorld = a => { const m = RIGS[a.type].muzzle; return xf(partMatrix(a, m.part), m.p); };
export const worldSpheres = a => { const b = alienBase(a); return RIGS[a.type].spheres.map(s => { const p = xf(b, s); return [p[0], p[1], p[2], s[3]]; }); };
// Writes alien a's spheres (x, y, z, r) into S from slot n, stopping at slot cap; returns the next free slot.
export const worldSpheresTo = (S, n, a, cap) => {
  const b = alienBaseTo(RB, a);
  for (const s of RIGS[a.type].spheres) {
    if (n >= cap) break;
    const j = n++ * 4;
    S[j] = b[0] * s[0] + b[4] * s[1] + b[8] * s[2] + b[12]; S[j + 1] = b[1] * s[0] + b[5] * s[1] + b[9] * s[2] + b[13];
    S[j + 2] = b[2] * s[0] + b[6] * s[1] + b[10] * s[2] + b[14]; S[j + 3] = s[3];
  }
  return n;
};
