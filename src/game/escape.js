// The escape, level 2 (pure): its tables and helpers. The state changes they drive live in fight.js.

// The break-out in the prison cell. reach: how near (m) the bars E works; face: how squarely (forward . the direction to the bars)
// you must face them; guard, open: seconds from the bang to the guard coming and to the bars dropping; idle: seconds between the
// Switchboard's nudges in the shut cell; pa: seconds between its notices once you are out.
export const BREAK = { reach: 2, face: .5, guard: 3, open: 4.5, idle: 20, pa: 40 };

// The exit lift at the end of the prison. reach: how near (m) E takes you up to the climb.
export const EXIT = { reach: 2.5 };
export const exitOf = B => B.props.find(q => q.kind === 'exit');

// The knock-out. call: the most seconds from Houston picking up to the knock-out, the fallback when no radio ends the cut-off line
// first (the bot, replays, Node). The rest time the wake in the cell, which comes later; for now the knock-out ends the run.
// out: seconds of black; stamp: seconds into the black that text stamps; fade: seconds the light takes to come back; down: seconds
// on the floor, the look locked, eye m above it and pitched pitch rad, coming level; getUp: seconds to stand; hp: health on waking.
export const KO = { call: 30, out: 5, stamp: 1.5, fade: 1, down: 3, getUp: .8, eye: .3, pitch: .6, hp: 70, text: 'ANOTHER SMALL PROBLEM' };

// The rescue ship in the dash (area 6), the same lander as yours, coming down at the rescue site (world.escape.site) as you arrive.
// clock: seconds from arriving to it leaving without you; warn: the clock shows red under this; calls: the marks (s left) the radio
// calls; r: the deck's collision radius (m); reach: how near the ladder's foot (m) E boards; alt, descent: the opening's (m up, s
// down: it comes down the same curve); hatch: touchdown to the hatch opening (s); puffs: the touchdown's dust puffs.
export const SHIP = { clock: 240, warn: 30, calls: [180, 120, 60, 30], r: 2, reach: 1.6, alt: 24, descent: 9, hatch: 1, puffs: 40 };
// The red signal flare fired at touchdown, the goal you see from the rim (the ship itself is under the bent horizon): it climbs
// up m over rise s, then drifts down over fall s. size (m, a sprite half-size) and ang (rad) are its least size and least angular
// size, so it shows at 400 m; trail: its smoke puffs, gap s of flight apart; col: its HDR colour.
export const FLARE = { up: 150, rise: 3, fall: 40, size: .6, ang: .01, trail: 10, gap: .5, col: [2.4, .3, .08] };
// The rush: once the ship is down and you are within near m of it, waves (the hold's planner: [start s, budget]) come in from n
// points r m round it, ids from id; floaters fly hover m over the ground.
export const RING = { near: 60, r: [30, 40], n: 6, id: 2000, hover: 3.5, waves: [[0, 4], [5, 5], [10, 6], [15, 6]] };

const smooth = x => x * x * (3 - 2 * x);
// The ship's height over the site t s after you arrive: the opening's descent curve, 0 from touchdown.
export const shipLift = t => t >= SHIP.descent ? 0 : SHIP.alt * (1 - t / SHIP.descent) ** 2;
// The foot of the ship S's ladder, 3.9 m out of its front (the opening's EGRESS[3]).
export const ladderAt = S => ({ x: S.at.x + 3.9 * S.at.dx, z: S.at.z + 3.9 * S.at.dz });
// Where the flare is, back s before now (its smoke trail), or null before touchdown and once it is down.
export function flareAt(S, back = 0) {
  const a = S.t - SHIP.descent - back, F = FLARE;
  if (!(a >= 0 && a <= F.rise + F.fall)) return null;
  return { x: S.at.x, z: S.at.z, y: S.at.y + F.up * (a < F.rise ? smooth(a / F.rise) : 1 - (a - F.rise) / F.fall) };
}
// The rush's spawn points round at: one in each of RING.n equal slices of the circle, RING.r m out.
export function ringPoints(rng, at) {
  const P = [];
  for (let k = 0; k < RING.n; k++) {
    const a = (k + rng.next()) * 2 * Math.PI / RING.n, r = rng.range(...RING.r);
    P.push({ x: at.x + r * Math.cos(a), z: at.z + r * Math.sin(a) });
  }
  return P;
}
