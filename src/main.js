// Boot: seed from the URL hash, generate the Moon, build the GPU scene, then walk it.
import { makeRng, normalizeSeed, seedName } from './gen/rng.js';
import { generateSurface, sampleGround, HALF, MAP_MARGIN } from './gen/surface.js';
import { checksumWorld } from './gen/checksum.js';
import { createGL } from './gfx/gl.js';
import { createRenderer } from './gfx/renderer.js';
import { createPlayer, stepPlayer, PLAYER } from './game/player.js';
import { buildSurfaceScene } from './game/surfaceScene.js';
import { createInput } from './game/input.js';
import { createHud } from './ui/hud.js';

const hud = createHud(), canvas = document.getElementById('c');
try { boot(); } catch (e) { hud.fatal('Could not start: ' + e.message); throw e; }

function boot() {
  const seed = normalizeSeed(location.hash) ?? seedName(makeRng(String(crypto.getRandomValues(new Uint32Array(1))[0])));
  try { history.replaceState(null, '', '#' + seed); } catch {}
  hud.seed('#' + seed);
  hud.help('Click to look around \u00b7 WASD move \u00b7 Shift run \u00b7 Space jump');
  // Pasting another seed link only changes the hash; reload so the new Moon is built from scratch.
  addEventListener('hashchange', () => location.reload());

  const { gl, hdrOK } = createGL(canvas), renderer = createRenderer(gl, hdrOK);
  const world = generateSurface(seed), scene = buildSurfaceScene(gl, world), ground = (x, z) => sampleGround(world, x, z);
  const p = createPlayer(world.spawn, ground), input = createInput(canvas, p), RES = [180, 270, 360];
  let resI = 1, palMode = 1, lost = false, raf = 0, helpShown = true, t0 = performance.now(), last = t0, fpsN = 0, fpsT = 0;

  const resize = () => lost || renderer.resize(innerWidth, innerHeight, devicePixelRatio || 1, RES[resI]);
  addEventListener('resize', resize); resize();
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); lost = true; cancelAnimationFrame(raf);
    hud.fatal('Graphics context lost. Reload the page to continue.');
  });
  if (DEBUG) addEventListener('keydown', e => {
    if (e.code === 'KeyP') palMode = (palMode + 1) % 3; // 1 dithered -> 2 flat -> 0 off
    if (e.code === 'KeyR') { resI = (resI + 1) % RES.length; resize(); }
  });

  const frame = { sky: true, mode: 0, ...scene, fog: [.010, .014, .011], fogDensity: .07, exposure: 1,
    lights: { pos: new Float32Array(64), col: new Float32Array(64), count: 0 }, spheres: new Float32Array(32) };
  function tick(now) {
    const el = Math.max(0, (now - last) / 1000), dt = Math.min(.05, el); last = now;
    stepPlayer(p, input.read(), dt, ground, HALF - MAP_MARGIN);
    if (helpShown && input.locked()) { helpShown = false; hud.help(''); }
    frame.t = (now - t0) / 1000; frame.palMode = palMode;
    frame.cam = { x: p.x, y: p.y + PLAYER.eye, z: p.z, yaw: p.yaw, pitch: p.pitch };
    renderer.render(frame);
    if (DEBUG) {
      fpsN++; fpsT += el;
      if (fpsT >= .5) { hud.debug(`${Math.round(fpsN / fpsT)} fps \u00b7 ${RES[resI]}p \u00b7 palette ${['off', 'dithered', 'flat'][palMode]}`); fpsN = fpsT = 0; }
    }
    window.ospTest ??= { ready: true, seed, checksum: checksumWorld(world), capture: () => renderer.capture(), player: () => ({ x: p.x, y: p.y, z: p.z }) };
    if (!lost) raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
}
