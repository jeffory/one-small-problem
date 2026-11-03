// The sound effects as ZzFX parameter lists (starting points, tuned by ear), rendered once at boot, and the map from game events
// to them. Volumes fall off with the horizontal distance for far sources.
import { zzfxG } from './zzfx.js';
export const SFX = { pistol: [.4, .05, 600, 0, .02, .1, 2, 2, -24, 0, 0, 0, 0, .3], scatter: [.6, .05, 300, 0, .05, .25, 4, 1, -8, 0, 0, 0, 0, 1],
  pole: [.3, .1, 180, .02, .05, .1, 4, 0, 6], zap: [.25, .1, 900, 0, .03, .15, 1, 1, -40, 0, 0, 0, 0, .2], hit: [.3, .1, 140, 0, .02, .08, 4, 1, -10, 0, 0, 0, 0, 2],
  kill: [.5, .1, 90, 0, .08, .3, 3, 2, -5, 0, 0, 0, 0, 2, 0, 0, 0, .5], boom: [.9, .1, 50, 0, .2, .8, 4, .5, -2, 0, 0, 0, 0, 3, 0, 0, 0, .4, .1],
  hurt: [.5, .1, 220, 0, .03, .15, 2, 1, -30, 0, 0, 0, 0, 1], pickup: [.4, 0, 660, 0, .05, .15, 1, 1, 0, 0, 220, .05], golf: [.4, 0, 1320, 0, .02, .5, 0, 1, 0, 0, 660, .08],
  door: [.5, .05, 70, .05, .4, .3, 2, 1, 0, 0, 0, 0, 0, .5], step: [.15, .2, 90, 0, .01, .05, 4, 1, 0, 0, 0, 0, 0, 3], engine: [.5, 0, 38, .5, 8, .6, 4, 1, 0, 0, 0, 0, 0, 5],
  land: [.7, 0, 60, 0, .1, .5, 4, 1, -3, 0, 0, 0, 0, 2], hatch: [.4, .05, 120, .02, .2, .2, 2, 1, 2, 0, 0, 0, 0, .3], thud: [1, 0, 42, .01, .25, 1.4, 0, 1, -1],
  stamp: [.8, 0, 55, 0, .05, .6, 3, 1, -4, 0, 0, 0, 0, 1], static: [.3, 0, 2000, 0, .1, .02, 4, 1, 0, 0, 0, 0, 0, 9] };
export function buildSfx() { const o = {}; for (const k in SFX) o[k] = zzfxG(...SFX[k]); return o; }
const WEAPON_SFX = ['pole', 'pistol', 'scatter'], PLAIN = { kill: 'kill', hurt: 'hurt', pickup: 'pickup', flag: 'pickup', golf: 'golf' };
export function sfxFor(e, p) {
  const fall = R => 1 - Math.hypot(e.x - p.x, e.z - p.z) / R, far = (n, R) => { const v = fall(R); return v > 0 ? [n, v] : null; };
  switch (e.type) {
    case 'fire': return [WEAPON_SFX[e.w], 1];
    case 'zap': return far('zap', 40);
    case 'boom': return far('boom', 80);
    case 'hit': return ['hit', .7];
    case 'area': return e.level ? ['door', 1] : null;
    case 'sfx': return [e.key, 1];
    default: return PLAIN[e.type] ? [PLAIN[e.type], 1] : null;
  }
}
