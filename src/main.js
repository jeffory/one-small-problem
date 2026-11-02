// Boot and the game's state machine. The page opens on the title with an attract run behind it; New Game plays the URL's seed
// (or rolls one and writes it there); the end screen reports the run and leads back to the title, which clears the seed.
// States: 'title' -> 'opening' (Task 8) -> 'play' -> 'ending' (Task 5) -> 'end' -> 'title'.
import { makeRng, normalizeSeed, seedName } from './gen/rng.js';
import { generateWorld } from './gen/world.js';
import { checksumWorld } from './gen/checksum.js';
import { createGL } from './gfx/gl.js';
import { createRenderer } from './gfx/renderer.js';
import { createFight, stepFight, hurtPlayer, enterArea, DOOR_REACH } from './game/fight.js';
import { createFightView, fillFrame, setScene } from './game/fightView.js';
import { AREAS, areaStart } from './game/areas.js';
import { WEAPONS } from './game/weapons.js';
import { buildSurfaceScene } from './game/surfaceScene.js';
import { buildBaseScene } from './game/baseScene.js';
import { createInput } from './game/input.js';
import { createHud } from './ui/hud.js';
import { createMenus } from './ui/menus.js';
import { shareLink, recordBest } from './ui/score.js';

// The scene fields a frame carries (the view supplies the meshes and lights); the events whose text flashes up; where a death
// in each area sends you back to; no input at all; the help line in play.
const SCENE = ['sky', 'mode', 'sun', 'earth', 'curv', 'fog', 'fogDensity', 'occTex'], FLASH = new Set(['pickup', 'flag', 'golf', 'area']);
const BACK = ['the wreck', 'the crater rim', 'the lift', 'the comms room door'];
const IDLE = { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 };
const HELP = 'Click to look \u00b7 WASD move \u00b7 Shift run \u00b7 Space jump \u00b7 E use \u00b7 1-3 weapons \u00b7 mouse fire \u00b7 Esc pause';
const hud = createHud(), canvas = document.getElementById('c');
try { boot(); } catch (e) { hud.fatal('Could not start: ' + e.message); throw e; }

// A fresh mission name from the browser's random source.
function randomSeed() { return seedName(makeRng(String(crypto.getRandomValues(new Uint32Array(1))[0]))); }
// Even reading localStorage can throw (private modes, file:// in some browsers); null means no best times.
function storage() { try { return localStorage; } catch { return null; } }

function boot() {
  // Pasting another seed link only changes the hash; reload so the new Moon is built from scratch.
  addEventListener('hashchange', () => location.reload());

  const { gl, hdrOK } = createGL(canvas), renderer = createRenderer(gl, hdrOK), V = createFightView(gl, { meshes: [] }), store = storage();
  // run: the Moon on screen, {kind: 'attract' | 'play', seed, world, scene, F}. state: where the flow is (see the top).
  let run = null, state = 'title';
  // Mouse look turns whichever run's player is on screen.
  const pov = { get yaw() { return run.F.player.yaw; }, set yaw(v) { run.F.player.yaw = v; },
    get pitch() { return run.F.player.pitch; }, set pitch(v) { run.F.player.pitch = v; } };
  const input = createInput(canvas, pov), menus = createMenus({ onNew: () => { input.lock(); newGame(); }, onBack: () => toTitle(true) });
  const frame = { exposure: 1, lights: { pos: new Float32Array(64), col: new Float32Array(64), count: 0 }, spheres: new Float32Array(32) }, RES = [180, 270, 360];
  let resI = 1, palMode = 1, lost = false, fp = '', warpK = 0, raf = 0, frames = 0, fault = false, t0 = performance.now(), last = t0, fpsN = 0, fpsT = 0;

  const resize = () => lost || renderer.resize(innerWidth, innerHeight, devicePixelRatio || 1, RES[resI]);
  addEventListener('resize', resize); resize();
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); lost = true; cancelAnimationFrame(raf);
    hud.fatal('Graphics context lost. Reload the page to continue.');
  });
  if (DEBUG) addEventListener('keydown', e => {
    if (e.code === 'KeyP') palMode = (palMode + 1) % 3; // 1 dithered -> 2 flat -> 0 off
    if (e.code === 'KeyG') run.F.god = !run.F.god;
    if (e.code === 'KeyB') enter();
    if (e.code === 'KeyN') warp(warpK++ % run.F.encs.length);
    if (e.code === 'KeyR') { resI = (resI + 1) % RES.length; resize(); }
  });

  // --- runs ---
  // The view draws the scene's meshes and lamps, and the frame takes its look.
  function useScene(scene) { setScene(V, scene); for (const k of SCENE) frame[k] = scene[k]; }
  // A fresh Moon on the surface, at the wreck. Attract runs are immortal.
  function startRun(kind, seed) {
    const world = generateWorld(seed), scene = buildSurfaceScene(gl, world), F = createFight(world);
    if (kind === 'attract') F.god = true;
    run = { kind, seed, world, scene, F }; warpK = 0;
    useScene(scene);
    if (DEBUG) fp = `#${seed} ${checksumWorld(world)}`;
  }
  function stopRun() { run?.scene.dispose(); }
  // A new level gets its own scene; the old one's GPU meshes are freed.
  function swap() {
    const next = run.F.lv.id === 'base' ? buildBaseScene(gl, run.world.baseMap) : buildSurfaceScene(gl, run.world);
    useScene(next); run.scene.dispose(); run.scene = next; warpK = 0;
  }

  // --- the flow ---
  // New Game plays the URL's seed, or rolls one and writes it there (replaceState: no new history entry).
  function newGame() {
    const seed = normalizeSeed(location.hash) ?? randomSeed();
    try { history.replaceState(null, '', '#' + seed); } catch {}
    stopRun(); startRun('play', seed);
    state = 'play'; menus.hide(); hud.mode('play'); hud.help(HELP); hud.seed('#' + seed);
  }
  // The title, with a fresh attract run behind it and the mouse let go (pre-flight F1). At boot the URL's seed stays, so a
  // shared link survives to New Game; Back to title clears it, so the next New Game rolls a fresh Moon.
  function toTitle(clear) {
    stopRun(); document.exitPointerLock?.();
    if (clear) try { history.replaceState(null, '', location.pathname + location.search); } catch {}
    startRun('attract', randomSeed());
    state = 'title';
    menus.title(true, normalizeSeed(location.hash)); hud.mode('none'); hud.seed('');
  }
  // The end screen: the fight's sim time (deaths count; the opening and pauses don't), lifetime kills, golf balls and the
  // seed's best time. The mouse is let go, so #back, #copy and #link take clicks (pre-flight F1).
  function finish() {
    if (state !== 'play' && state !== 'ending') return;
    const { F, seed } = run;
    state = 'end';
    menus.end({ time: F.time, kills: F.kills, golf: F.golf, link: shareLink(location.href, seed), seed, ...recordBest(store, seed, F.time) });
    hud.mode('none');
    document.exitPointerLock?.();
  }

  // dt seconds of the current state. Sub-steps are at most 0.05 s, and one-shot inputs (use, weapon, wheel) count on the
  // first only. The title steps the attract run with idle input; play and ending step yours, with flashes, status and prompt;
  // the end screen steps nothing. A level swap is handled for whatever run is on screen, and the events are cleared here, so
  // each call (a frame or an ff step) sees only its own (pre-flight F3).
  function advance(dt, inp) {
    const F = run.F, n = Math.max(1, Math.ceil(dt / .05)), h = dt / n, playing = state === 'play' || state === 'ending';
    if (state === 'title') for (let k = 0; k < n; k++) stepFight(F, IDLE, h);
    if (playing) for (let k = 0; k < n; k++) stepFight(F, k ? { ...inp, use: false, weapon: -1, wheel: 0 } : inp, h);
    for (const ev of F.events) if (ev.type === 'area' && ev.level) swap();
    if (playing) {
      const p = F.player, U = run.world.crater.use;
      hud.status({ hp: Math.ceil(F.hp), cells: F.ars.cells, weapon: WEAPONS[F.ars.cur]?.name ?? '' });
      for (const ev of F.events) if (FLASH.has(ev.type) && ev.text) hud.flash(ev.text);
      hud.prompt(F.state === 'dead' ? 'You died. Back to ' + BACK[F.area] + '...'
        : F.lv.id === 'surface' && !F.flag.held && Math.hypot(p.x - F.flag.x, p.z - F.flag.z) < 2.2 ? '[E] grab the flag'
        : F.area === 1 && Math.hypot(p.x - U.x, p.z - U.z) <= DOOR_REACH ? '[E] enter the hangar' : '');
    }
    F.events.length = 0;
  }

  // --- test and debug hooks, acting on the current run ---
  // The player at (x, z) on the level's ground, standing still, facing yaw.
  const place = (x, z, yaw) => Object.assign(run.F.player, { x, y: run.F.lv.ground(x, z), z, vx: 0, vy: 0, vz: 0, kx: 0, kz: 0, yaw, pitch: 0, onGround: true });
  // Encounter k of the current level: on the surface 18 m from its centre on the side toward the lander; in the base at its
  // room's `in`. Either way facing the centre.
  function warp(k) {
    const { F, world } = run, e = F.encs[k];
    if (F.lv.id === 'base') { const o = world.baseMap.rooms[e.room].in; place(o.x, o.z, Math.atan2(o.x - e.x, o.z - e.z)); return; }
    const L = world.lander; let dx = L.x - e.x, dz = L.z - e.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    place(e.x + dx * 18, e.z + dz * 18, Math.atan2(dx, dz));
  }
  // At the hangar door's use point facing the door (on the surface level; from the wreck this enters the crater first).
  function door() {
    const { F, world } = run;
    if (F.lv.id !== 'surface') return;
    if (F.area === 0) enterArea(F, 1);
    const U = world.crater.use, d = world.crater.door;
    place(U.x, U.z, Math.atan2(d.dx, d.dz));
  }
  function enter() { door(); stepFight(run.F, { ...IDLE, use: true }, .001); }
  // Fast-forward: sec seconds of 1/30 s steps, inp held on every one.
  function ff(sec, inp = {}) { for (let i = Math.round(sec * 30); i > 0; i--) advance(1 / 30, { ...IDLE, ...inp }); }
  const T = window.ospTest = {
    ready: false, hdr: hdrOK,
    get seed() { return run.kind === 'play' ? run.seed : normalizeSeed(location.hash); },
    get checksum() { return run.kind === 'play' ? checksumWorld(run.world) : null; },
    capture: () => renderer.capture(), frames: () => frames, fault: () => { fault = true; },
    state: () => state, play: () => newGame(), finish, ff,
    player: () => { const p = run.F.player; return { x: p.x, y: p.y, z: p.z }; },
    fight: () => { const F = run.F, p = F.player, s = areaStart(run.world, F.area);
      return { hp: F.hp, cells: F.ars.cells, cur: F.ars.cur, state: F.state, kills: F.kills, bolts: F.bolts.length, shots: F.shots, area: AREAS[F.area], golf: F.golf, time: F.time, atStart: Math.hypot(p.x - s.x, p.z - s.z) < 1 }; },
    area: () => AREAS[run.F.area],
    grab: () => { const F = run.F, p = F.player; p.x = F.flag.x + 1; p.z = F.flag.z; p.y = F.lv.ground(p.x, p.z); stepFight(F, { ...IDLE, use: true }, .001); },
    give: () => { const A = run.F.ars; for (let i = 0; i < WEAPONS.length; i++) A.owned[i] = true; A.cells = 150; if (A.cur < 0) A.cur = 0; },
    door, enter, warp, hurt: n => hurtPlayer(run.F, n, 0, 0, 0),
  };

  // --- the frame loop: advance the state, then draw the current run, in every state ---
  function tick(now) {
    try {
      if (fault) throw new Error('test fault');
      // Real time, so slow frames don't slow the game; a long stall skips at most 0.25 s.
      const el = Math.max(0, (now - last) / 1000); last = now;
      advance(Math.min(.25, el), input.read());
      frame.t = (now - t0) / 1000; frame.palMode = palMode;
      fillFrame(V, run.F, frame, frame.t);
      renderer.render(frame);
      if (!T.ready) { T.ready = true; hud.ready(); }
      if (DEBUG) {
        const F = run.F, p = F.player; fpsN++; fpsT += el;
        if (fpsT >= .5) { hud.debug(`${fp} \u00b7 ${state} \u00b7 ${AREAS[F.area]} \u00b7 ${Math.round(fpsN / fpsT)} fps \u00b7 ${RES[resI]}p \u00b7 palette ${['off', 'dithered', 'flat'][palMode]} \u00b7 hp ${Math.ceil(F.hp)} \u00b7 awake ${F.aliens.filter(a => a.state !== 'dead' && (a.enc.alerted || Math.hypot(p.x - a.enc.x, p.z - a.enc.z) < F.lv.wake)).length} \u00b7 bolts ${F.bolts.length}`); fpsN = fpsT = 0; }
      }
      frames++;
      if (!lost) raf = requestAnimationFrame(tick);
    } catch (e) {
      lost = true; cancelAnimationFrame(raf);
      hud.fatal('Something went wrong: ' + e.message + '. Reload the page to continue.'); throw e;
    }
  }
  toTitle(false);
  raf = requestAnimationFrame(tick);
}
