// The one way to build a world: the surface, then the fight plan on top of it (later tasks add the crater and the base).
import { generateSurface } from './surface.js';
import { planFight } from './encounters.js';

export function generateWorld(seed) {
  const world = generateSurface(seed);
  world.plan = planFight(world);
  return world;
}
