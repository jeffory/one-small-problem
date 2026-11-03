// The four areas on two levels. A level is what the fight steps on: its ground and ceiling, bound, gravity, nav grid and plan.
// Pure: no DOM, GPU or clock.
import { sampleGround, N, HALF, MAP_MARGIN, MAX_STEP } from '../gen/surface.js';
import { BASE } from '../gen/base.js';

export const AREAS = ['surface', 'crater', 'base', 'comms'];
export const LEVEL = ['surface', 'surface', 'base', 'base'];
export const AREA_TEXT = ['', 'THE CRATER', 'THE BASE', 'THE COMMS ROOM'];
// Gravity per level (the scenes read it too); WAKE: how near an encounter's centre (m) its aliens wake before it is alerted.
export const GRAVITY = { surface: 3.0, base: 9.0 };
export const WAKE = { surface: 60, base: 30 };

// The base tile index nearest (x, z), or -1 outside the grid.
const tile = (M, x, z) => {
  const i = Math.round(x + M.half), j = Math.round(z + M.half);
  return i >= 0 && j >= 0 && i < M.n && j < M.n ? j * M.n + i : -1;
};

export function makeLevel(world, id) {
  if (id === 'surface') return { id, ground: (x, z) => sampleGround(world, x, z), ceil: null, bound: HALF - MAP_MARGIN, gravity: GRAVITY.surface,
    grid: world.occ, n: N, half: HALF, maxStep: MAX_STEP, wake: WAKE.surface, plan: world.plan };
  const M = world.baseMap, fl = M.floor, ce = M.ceil;
  return { id, ground: (x, z) => { const t = tile(M, x, z); return t < 0 ? BASE.wall : fl[t]; }, ceil: (x, z) => { const t = tile(M, x, z); return t < 0 ? 0 : ce[t]; },
    bound: M.half - 1, gravity: GRAVITY.base, grid: fl, n: M.n, half: M.half, maxStep: BASE.step, wake: WAKE.base, plan: M.plan };
}

export const areaStart = (world, k) => [world.spawn, world.crater.top, world.baseMap.start, world.baseMap.commsDoor][k];

// Areas only advance: over the base crater's rim into the crater, and onto a comms room tile in the base.
export function advanceArea(world, k, x, z) {
  const B = world.base, M = world.baseMap;
  if (k === 0 && Math.hypot(x - B.x, z - B.z) < B.R) return 1;
  if (k === 2) { const t = tile(M, x, z); if (t >= 0 && M.room[t] === M.crit.at(-1)) return 3; }
  return k;
}

// The wayfinding arrow (Plan 5). Within WAY.near m of the target it hides.
export const WAY = { near: 12 };
// Where the arrow points from p: only the outdoor areas have a goal. The crater follows the switchback (the path vertex after the nearest), then the door.
export function wayTarget(world, k, p) {
  if (k === 0) return world.crater.top;
  if (k !== 1) return null;
  const P = world.crater.path; let n = 0, best = Infinity;
  for (let i = 0; i < P.length; i++) { const d = Math.hypot(P[i][0] - p.x, P[i][1] - p.z); if (d < best) { best = d; n = i; } }
  return n + 1 < P.length ? { x: P[n + 1][0], z: P[n + 1][1] } : world.crater.use;
}
// null, or { ang, m }: the target's bearing from where you face (positive to the right, in (-pi, pi]) and its distance in whole metres.
export function wayfind(F) {
  const t = F.state === 'play' && wayTarget(F.world, F.area, F.player);
  if (!t) return null;
  const p = F.player, dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
  if (d < WAY.near) return null;
  return { ang: Math.atan2(dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw), -dx * Math.sin(p.yaw) - dz * Math.cos(p.yaw)), m: Math.round(d) };
}
