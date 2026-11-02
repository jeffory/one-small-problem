// The one way to build a world: the surface (with its crater switchback), then the fight plan on top of it (later tasks add the base).
import { generateSurface, surfaceAccept, N, HALF, MAX_STEP, MAP_MARGIN } from './surface.js';
import { passable } from './passable.js';
import { carveCrater } from './crater.js';
import { planFight } from './encounters.js';

const cell = (p) => [Math.round(p.x + HALF), Math.round(p.z + HALF)];

// Carving mutates the candidate world, so a rejected candidate is simply dropped with the re-roll.
function doorReachable(w) {
  w.crater = carveCrater(w);
  return passable(w.occ, N, cell(w.spawn), cell(w.crater.use), MAX_STEP, MAP_MARGIN);
}

export function generateWorld(seed) {
  const world = generateSurface(seed, (w) => surfaceAccept(w) && doorReachable(w));
  world.plan = planFight(world);
  return world;
}
