// The final stand (pure): E at the comms array puts you on hold, and waves come out of the comms room's spawn doors until
// Houston picks up. This holds the table, the wave plan and where the array is; the fight runs the hold (fight.js).
import { COST } from '../gen/encounters.js';

// time: seconds on hold until Houston picks up; reach: how near the dish (m) E calls; waves: [start s, budget] each, spent at
// COST; gap: seconds between a wave's spawns; cap: the most hold aliens alive at once (the rest wait for a slot); msg: seconds
// between Mission Control's on-hold messages (the first at msg / 2); tape, cells: the supplies put on the dais, at the first
// tape + cells of spots (m from the dish, x and z) that are floor.
export const HOLD = { time: 90, reach: 2.5, waves: [[3, 2], [15, 3], [27, 4], [39, 5], [51, 6], [63, 7], [75, 8]], gap: .9, cap: 8, msg: 14,
  tape: 3, cells: 2, spots: [[2.5, 2.5], [-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [0, 2.5], [0, -2.5], [2.5, 0], [-2.5, 0]] };
// The ending: seconds from Houston picking up to the end screen, at least min (and the radio idle), at most max.
export const ENDING = { min: 6, max: 14 };

// The hold's spawns, [{at, type, door, wave}] in time order. Each wave spends its budget: a brute when the budget is at least 6
// (so 2 is left for the rest), then a floater on a coin flip if 2 is left, then skitterers; its spawns come HOLD.gap s apart,
// round the doors from a random one.
export function planWaves(rng, doors) {
  const P = [];
  HOLD.waves.forEach(([s, b], wave) => {
    const T = [];
    if (b >= 6) { T.push('br'); b -= COST.br; }
    if (b >= COST.fl && rng.next() < .5) { T.push('fl'); b -= COST.fl; }
    for (; b > 0; b -= COST.sk) T.push('sk');
    const d0 = rng.int(doors);
    T.forEach((type, i) => P.push({ at: s + i * HOLD.gap, type, door: (d0 + i) % doors, wave }));
  });
  return P;
}

// The comms array: the base's dish prop, on the dais at the room's centre.
export const dishOf = B => B.props.find(p => p.kind === 'dish');
// Where you stand to call: the dais tile west of the array, 1.58 m from its centre.
export function callSpot(B) { const d = dishOf(B); return { x: d.x - 1.5, z: d.z - .5 }; }
