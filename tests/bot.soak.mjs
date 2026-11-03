// The bot soak (spec 10): 60 seeds played by the immortal soak bot through the whole game, from the wreck down the crater, through
// the base to the comms array, the hold, Houston's call and the knock-out, the wake in the cell, the bang on the bars, the prison,
// its exit lift, the climb and the dash to boarding the rescue ship, at uneven frame times from 1/144 to 1/18 s cut into sub-steps
// of at most .05 s as main.js does. Each must board within LIMIT s of sim time; any stall, timeout or missed ship fails (pre-flight
// F10: a missed ship restarts the dash with a fresh clock, so a run that missed it would pass with only its last try measured).
// It also tunes the ship clock (spec 6): the worst run's dash, SHIP.clock - F.ship.left at boarding, must leave at least 30% of
// SHIP.clock spare.
import { generateWorld } from '../src/gen/world.js';
import { makeRng } from '../src/gen/rng.js';
import { createFight, stepFight } from '../src/game/fight.js';
import { createBot, botStep } from '../src/game/bot.js';
import { SHIP } from '../src/game/escape.js';

const SEEDS = 60, LIMIT = 1500, T0 = Date.now(), times = [], dashes = []; let fail = 0;
for (let s = 0; s < SEEDS; s++) {
  const seed = 'BOT-' + String(s).padStart(4, '0');
  try {
    const world = generateWorld(seed), F = createFight(world), bot = createBot(world, makeRng(seed + '/bot'), 'board'), r = makeRng('dt' + seed);
    F.god = true; let t = 0, missed = 0;
    while (!bot.done && t < LIMIT) {
      const dt = Math.min(.25, r.range(1 / 144, 1 / 18)), n = Math.max(1, Math.ceil(dt / .05));
      for (let k = 0; k < n; k++) { const inp = botStep(bot, F, dt / n); stepFight(F, k ? { ...inp, use: false, weapon: -1, wheel: 0 } : inp, dt / n); }
      for (const e of F.events) if (e.type === 'missed') missed++;
      F.events.length = 0; t += dt;
    }
    if (bot.done === 'board' && !missed) { times.push(t); dashes.push(SHIP.clock - F.ship.left); }
    else { fail++; console.error(seed, bot.done ?? 'timeout', 'at', t.toFixed(1), 's in', bot.stage, 'area', F.area, 'waypoint', bot.k, 'ships missed', missed); }
  } catch (e) { fail++; console.error(seed, e.message); }
}
const spread = L => { const S = L.slice().sort((a, b) => a - b), at = q => (S.length ? S[Math.min(S.length - 1, Math.floor(q * S.length))].toFixed(1) : '-'); return `min ${at(0)} s, median ${at(.5)} s, max ${at(1)} s`; };
console.log(`bot soak: ${times.length}/${SEEDS} boarded; sim time ${spread(times)}; failures ${fail}`);
const worst = Math.max(0, ...dashes);
console.log(`the dash (SHIP.clock ${SHIP.clock} s): ${spread(dashes)}; the worst leaves ${(SHIP.clock - worst).toFixed(1)} s spare`);
if (worst > .7 * SHIP.clock) { fail++; console.error(`SHIP.clock should be ${Math.ceil(worst / .7 / 10) * 10} s (spec 6: the worst run keeps 30% spare)`); }
console.log('bot soak wall time', ((Date.now() - T0) / 1000).toFixed(1) + ' s');
process.exit(fail ? 1 : 0);
