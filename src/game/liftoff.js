// The lift-off, spec 7 "never leave the helmet": a pure director for the end of the run, from boarding the rescue ship to the
// stowaway sting. You ride in its cabin at the opening's crouched eye, looking out of the front, as the ascent stage (the cabin,
// the hatch and the dish) climbs off the descent stage at LIFT.acc over its engine's glow; the aliens round the site turn to the
// ship and wave; at LIFT.sting s a click in the cabin, and the sting. You can look about but not move. It fills a fight-shaped view
// for fillFrame and pushes sound and radio cues for the shell. Pure: no DOM, GPU or clock, and no randomness.
import { LIFT } from './escape.js';
import { WAVE_TIME, waveAt } from './aliens.js';
import { EGRESS, FX } from './opening.js';

// The ascent engine's light, m over the lander's base (lander space y): .3 m under its nozzle at the cabin's floor (2.45), as the
// opening's plume light (FX.glow.plume.y) sits .3 m under the descent bell's mouth.
const ENGINE = 2.15;

// The lift-off for a fight F just boarded (F.won, F.ship landed): you stand at EGRESS[0] in the ship's cabin facing its front
// (lander +z), looking down through the hatch as the opening does; the live aliens are the view's.
export function createLiftoff(F) {
  const S = F.ship, at = S.at, c = Math.cos(S.W.ly), s = Math.sin(S.W.ly), [x, y, z, eye] = EGRESS[0], p = F.player, U = FX.glow.plume;
  Object.assign(p, { x: at.x + c * x + s * z, y: at.y + y, z: at.z - s * x + c * z, vx: 0, vy: 0, vz: 0, kx: 0, kz: 0, onGround: true, land: 0,
    yaw: Math.atan2(-at.dx, -at.dz), pitch: -.3 }); // in place: the input module holds this object
  const glow = { x: at.x, y: at.y + ENGINE, z: at.z, s: U.s, r: U.col[0], g: U.col[1], b: U.col[2] };
  // _F: the fight; _y, _gy: your feet's and the engine light's heights before the climb; _glow: that light
  return { t: 0, sting: false, events: [], _F: F, _y: p.y, _gy: glow.y, _glow: glow,
    view: { player: p, state: 'play', deadT: 0, ars: { cur: -1 }, shotT: 9, hurtT: 0, lv: F.lv, flag: F.flag, ship: S, aliens: F.aliens.filter(a => a.state !== 'dead'),
      bolts: [], parts: [], booms: [], decals: [], pickups: [], canisters: [], balls: [], glow: [glow], eye, flash: 0 } };
}

// dt seconds of the lift-off: the ascent stage, you and its light LIFT.acc t^2 / 2 up; each alien faces the ship and waves, on its
// own beat (their clocks run on, so a waving leg still swishes); crossing LIFT.sting, the click and the sting, once.
export function stepLiftoff(L, dt) {
  const S = L._F.ship, t = L.t += dt, up = S.W.up = LIFT.acc * t * t / 2;
  L.view.player.y = L._y + up; L._glow.y = L._gy + up;
  for (const a of L.view.aliens) { a.t += dt; a.yaw = Math.atan2(S.at.x - a.x, S.at.z - a.z); a.wave = waveAt((t + .37 * a.id) % WAVE_TIME); }
  if (!L.sting && t >= LIFT.sting) { L.sting = true; L.events.push({ type: 'sfx', key: 'click' }, { type: 'radio', key: 'sting' }); }
  return L;
}
