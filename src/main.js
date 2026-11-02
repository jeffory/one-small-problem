// Boot: seed from the URL hash, generate the Moon, build the GPU scene, then walk it.
import { makeRng, normalizeSeed, seedName } from './gen/rng.js';
import { generateSurface, sampleGround } from './gen/surface.js';
import { checksumWorld } from './gen/checksum.js';
import { createGL } from './gfx/gl.js';
import { createRenderer } from './gfx/renderer.js';
import { createFight, stepFight, hurtPlayer } from './game/fight.js';
import { createFightView, fillFrame } from './game/fightView.js';
import { WEAPONS } from './game/weapons.js';
import { buildSurfaceScene } from './game/surfaceScene.js';
import { createInput } from './game/input.js';
import { createHud } from './ui/hud.js';

const hud = createHud(), canvas = document.getElementById('c');
try { boot(); } catch (e) { hud.fatal('Could not start: ' + e.message); throw e; }

function boot() {
  const seed = normalizeSeed(location.hash) ?? seedName(makeRng(String(crypto.getRandomValues(new Uint32Array(1))[0])));
  try { history.replaceState(null, '', '#' + seed); } catch {}
  hud.seed('#' + seed);
  hud.help('Click to look \u00b7 WASD move \u00b7 Shift run \u00b7 Space jump \u00b7 E use \u00b7 1-3 weapons \u00b7 mouse fire');
  // Pasting another seed link only changes the hash; reload so the new Moon is built from scratch.
  addEventListener('hashchange', () => location.reload());

  const { gl, hdrOK } = createGL(canvas), renderer = createRenderer(gl, hdrOK);
  const world = generateSurface(seed), scene = buildSurfaceScene(gl, world), ground = (x, z) => sampleGround(world, x, z);
  const F = createFight(world, { gravity: scene.gravity }), V = createFightView(gl, scene), p = F.player, input = createInput(canvas, p), RES = [180, 270, 360];
  let resI = 1, palMode = 1, lost = false, shown = false, fp = DEBUG ? `#${seed} ${checksumWorld(world)}` : "", warpK = 0, raf = 0, frames = 0, fault = false, helpShown = true, t0 = performance.now(), last = t0, fpsN = 0, fpsT = 0;

  const resize = () => lost || renderer.resize(innerWidth, innerHeight, devicePixelRatio || 1, RES[resI]);
  addEventListener('resize', resize); resize();
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); lost = true; cancelAnimationFrame(raf);
    hud.fatal('Graphics context lost. Reload the page to continue.');
  });
  if (DEBUG) addEventListener('keydown', e => {
    if (e.code === 'KeyP') palMode = (palMode + 1) % 3; // 1 dithered -> 2 flat -> 0 off
    if (e.code === 'KeyG') F.god = !F.god;
    if (e.code === 'KeyN') warp(warpK++ % F.encs.length);
    if (e.code === 'KeyR') { resI = (resI + 1) % RES.length; resize(); }
  });

  // 18 m from encounter k's centre, on the side toward the lander, facing the encounter
  function warp(k) {
    const e = F.encs[k], L = world.lander; let dx = L.x - e.x, dz = L.z - e.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    p.x = e.x + dx * 18; p.z = e.z + dz * 18; p.y = ground(p.x, p.z); p.yaw = Math.atan2(dx, dz); p.pitch = 0;
  }
  const none = { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 };
  const frame = { ...scene, exposure: 1,
    lights: { pos: new Float32Array(64), col: new Float32Array(64), count: 0 }, spheres: new Float32Array(32) };
  function tick(now) {
    try {
      if (fault) throw new Error('test fault');
      // Real-time steps of at most 0.05 s, so slow frames don't slow the game; a long stall skips at most 0.25 s.
      const el = Math.max(0, (now - last) / 1000), dt = Math.min(.25, el), n = Math.max(1, Math.ceil(dt / .05)), inp = input.read(); last = now;
      for (let k = 0; k < n; k++) stepFight(F, k ? { ...inp, use: false, weapon: -1, wheel: 0 } : inp, dt / n);
      if (helpShown && input.locked()) { helpShown = false; hud.help(''); }
      frame.t = (now - t0) / 1000; frame.palMode = palMode;
      fillFrame(V, F, frame, frame.t);
      hud.status({ hp: Math.ceil(F.hp), cells: F.ars.cells, weapon: WEAPONS[F.ars.cur]?.name ?? '' });
      for (const ev of F.events) if (ev.type === 'pickup' || ev.type === 'flag') hud.flash(ev.text);
      hud.prompt(F.state === 'dead' ? 'You died. Back to the wreck...' : !F.flag.held && Math.hypot(p.x - F.flag.x, p.z - F.flag.z) < 2.2 ? '[E] grab the flag' : '');
      F.events.length = 0;
      renderer.render(frame);
      if (!shown) { shown = true; hud.ready(); }
      if (DEBUG) {
        fpsN++; fpsT += el;
        if (fpsT >= .5) { hud.debug(`${fp} \u00b7 ${Math.round(fpsN / fpsT)} fps \u00b7 ${RES[resI]}p \u00b7 palette ${['off', 'dithered', 'flat'][palMode]} \u00b7 hp ${Math.ceil(F.hp)} \u00b7 awake ${F.aliens.filter(a => a.state !== 'dead' && (a.enc.alerted || Math.hypot(p.x - a.enc.x, p.z - a.enc.z) < 60)).length} \u00b7 bolts ${F.bolts.length}`); fpsN = fpsT = 0; }
      }
      frames++;
      window.ospTest ??= { ready: true, seed, hdr: hdrOK, checksum: checksumWorld(world), capture: () => renderer.capture(), player: () => ({ x: p.x, y: p.y, z: p.z }), frames: () => frames,
        fight: () => ({ hp: F.hp, cells: F.ars.cells, cur: F.ars.cur, state: F.state, kills: F.kills, bolts: F.bolts.length, shots: F.shots, atSpawn: Math.hypot(p.x - world.spawn.x, p.z - world.spawn.z) < 1 }),
        grab: () => { p.x = F.flag.x + 1; p.z = F.flag.z; p.y = ground(p.x, p.z); stepFight(F, { ...none, use: true }, .001); },
        give: () => { for (let i = 0; i < WEAPONS.length; i++) F.ars.owned[i] = true; F.ars.cells = 150; if (F.ars.cur < 0) F.ars.cur = 0; },
        warp, hurt: n => hurtPlayer(F, n, 0, 0, 0), fault: () => { fault = true; } };
      if (!lost) raf = requestAnimationFrame(tick);
    } catch (e) {
      lost = true; cancelAnimationFrame(raf);
      hud.fatal('Something went wrong: ' + e.message + '. Reload the page to continue.'); throw e;
    }
  }
  raf = requestAnimationFrame(tick);
}
