// The attract bot soak: 60 seeds played by the immortal bot from the wreck, at uneven frame times from 1/144 to 1/18 s cut into
// sub-steps of at most .05 s as main.js does. Each must reach the comms room within LIMIT s of sim time; any stall or timeout fails.
import { generateWorld } from '../src/gen/world.js';
import { makeRng } from '../src/gen/rng.js';
import { createFight, stepFight } from '../src/game/fight.js';
import { createBot, botStep } from '../src/game/bot.js';

const SEEDS = 60, LIMIT = 600, T0 = Date.now(), times = []; let fail = 0;
for (let s = 0; s < SEEDS; s++) {
  const seed = 'BOT-' + String(s).padStart(4, '0');
  try {
    const world = generateWorld(seed), F = createFight(world), bot = createBot(world, makeRng(seed + '/bot')), r = makeRng('dt' + seed);
    F.god = true; let t = 0;
    while (!bot.done && t < LIMIT) {
      const dt = Math.min(.25, r.range(1 / 144, 1 / 18)), n = Math.max(1, Math.ceil(dt / .05));
      for (let k = 0; k < n; k++) { const inp = botStep(bot, F, dt / n); stepFight(F, k ? { ...inp, use: false, weapon: -1, wheel: 0 } : inp, dt / n); }
      F.events.length = 0; t += dt;
    }
    if (bot.done === 'comms') times.push(t);
    else { fail++; console.error(seed, bot.done ?? 'timeout', 'at', t.toFixed(1), 's in', bot.stage, 'area', F.area, 'waypoint', bot.k); }
  } catch (e) { fail++; console.error(seed, e.message); }
}
times.sort((a, b) => a - b);
const at = q => (times.length ? times[Math.min(times.length - 1, Math.floor(q * times.length))].toFixed(1) : '-');
console.log(`bot soak: ${times.length}/${SEEDS} reached the comms room; sim time min ${at(0)} s, median ${at(.5)} s, max ${at(1)} s; failures ${fail}`);
console.log('bot soak wall time', ((Date.now() - T0) / 1000).toFixed(1) + ' s');
process.exit(fail ? 1 : 0);
