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
import { createBot, botStep } from './game/bot.js';
import { HOLD, ENDING, dishOf, callSpot } from './game/hold.js';
import { createInput, look } from './game/input.js';
import { createHud, HELP_TIME } from './ui/hud.js';
import { createMenus } from './ui/menus.js';
import { shareLink, recordBest, fmtTime } from './ui/score.js';
import { RES, loadSettings, saveSettings } from './ui/settings.js';

// The scene fields a frame carries (the view supplies the meshes and lights); the events whose text flashes up; where a death
// in each area sends you back to; no input at all; the help line, shown as a run starts and hidden after HELP_TIME s of it (R2).
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
  // run: the Moon on screen, {kind: 'attract' | 'play', seed, world, scene, F, bot (attract only)}. state: where the flow is (see the
  // top). endT: seconds of the ending so far.
  let run = null, state = 'title', endT = 0;
  // S: the settings (loaded once, kept in memory even where the store refuses them). Paused: the pause menu is up, nothing
  // advances. lockLostAt: when a lost pointer lock paused the game, so the Esc that did it can't also resume it.
  let S = loadSettings(store), paused = false, lockLostAt = -1e9, appliedRes = -1;
  // Menu clicks run inside the fatal path too: an exception stops the loop and shows the message, as in tick.
  const guard = f => (...a) => { try { f(...a); } catch (e) { fail(e); throw e; } };
  const input = createInput(canvas), menus = createMenus({ onNew: guard(() => { input.lock(); newGame(); }), onBack: guard(() => toTitle(true)),
    onResume: guard(() => resume()), onQuit: guard(() => quit()), onSetting: guard(setting) });
  const frame = { exposure: 1, lights: { pos: new Float32Array(64), col: new Float32Array(64), count: 0 }, spheres: new Float32Array(32) };
  let palMode = S.pal ? 1 : 0, lost = false, fp = '', warpK = 0, raf = 0, frames = 0, fault = false, t0 = performance.now(), last = t0, fpsN = 0, fpsT = 0;

  // Native (RES 0) is the window's height in device pixels, at most 2 per CSS pixel.
  const resize = () => lost || renderer.resize(innerWidth, innerHeight, devicePixelRatio || 1, RES[S.res] || Math.round(innerHeight * Math.min(2, devicePixelRatio || 1)));
  // Settings take effect at once; the render targets are rebuilt only when the resolution changes.
  function apply() { palMode = S.pal ? 1 : 0; if (S.res !== appliedRes) { appliedRes = S.res; resize(); } }
  function setting(s) { S = s; saveSettings(store, S); apply(); }
  addEventListener('resize', resize); apply();
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); lost = true; cancelAnimationFrame(raf);
    hud.fatal('Graphics context lost. Reload the page to continue.');
  });
  if (DEBUG) addEventListener('keydown', e => {
    if (e.code === 'KeyP') palMode = (palMode + 1) % 3; // 1 dithered -> 2 flat -> 0 off
    if (e.code === 'KeyG') run.F.god = !run.F.god;
    if (e.code === 'KeyB') enter();
    if (e.code === 'KeyN') warp(warpK++ % run.F.encs.length);
    if (e.code === 'KeyR') { S = { ...S, res: (S.res + 1) % RES.length }; apply(); }
  });

  // --- pause ---
  // Never after a fatal error or a lost context: the message stays on top and nothing is left to resume.
  const pausable = () => !lost && (state === 'play' || state === 'ending');
  function unpause() { paused = false; menus.pause(false); }
  // Esc or a lost pointer lock: the pause menu goes up, the frame keeps drawing, and the mouse is let go (headless browsers
  // keep the lock on Esc, so this doesn't rely on the browser).
  function pause() {
    if (!pausable() || paused) return;
    paused = true; menus.pause(true, S, HELP); input.unlock();
  }
  function resume() { unpause(); input.lock(); }
  function quit() { unpause(); toTitle(true); }
  // The lock is held only while it is wanted, in play or the ending, unpaused (R6). One that arrives otherwise (a request still
  // in flight when the game paused, finished or quit) is let go at once, so the menus' buttons take clicks (pre-flight F1);
  // that release never pauses. Losing a wanted lock while playing pauses.
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) { if (!input.wanted() || paused || !pausable()) input.unlock(); }
    else if (input.wanted() && pausable() && !paused) { pause(); lockLostAt = performance.now(); }
  });
  addEventListener('keydown', e => {
    if (e.code !== 'Escape' || e.repeat || lost) return;
    if (!paused) pause(); else if (performance.now() - lockLostAt > 300) resume();
  });

  // --- runs ---
  // The view draws the scene's meshes and lamps, and the frame takes its look.
  function useScene(scene) { setScene(V, scene); for (const k of SCENE) frame[k] = scene[k]; }
  // A fresh Moon on the surface, at the wreck. Attract runs are immortal and played by the bot (never the opening).
  function startRun(kind, seed) {
    const world = generateWorld(seed), scene = buildSurfaceScene(gl, world), F = createFight(world);
    run = { kind, seed, world, scene, F }; warpK = 0;
    if (kind === 'attract') { F.god = true; run.bot = createBot(world, makeRng(seed + '/bot')); }
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
    stopRun(); startRun('play', seed); unpause();
    state = 'play'; menus.hide(); hud.mode('play'); hud.help(HELP); hud.seed('#' + seed);
  }
  // The title, with a fresh attract run behind it and the mouse let go (pre-flight F1). At boot the URL's seed stays, so a
  // shared link survives to New Game; Back to title clears it, so the next New Game rolls a fresh Moon.
  function toTitle(clear) {
    stopRun(); unpause(); input.unlock();
    if (clear) try { history.replaceState(null, '', location.pathname + location.search); } catch {}
    startRun('attract', randomSeed());
    state = 'title';
    menus.title(true, normalizeSeed(location.hash)); hud.mode('none'); hud.seed('');
  }
  // The end screen: the fight's sim time up to Houston picking up (deaths count; the opening, pauses and the ending don't, R9),
  // lifetime kills (frozen at Houston too), golf balls and the seed's best time. The mouse is let go, so #back, #copy and #link
  // take clicks (pre-flight F1).
  function finish() {
    if (state !== 'play' && state !== 'ending') return;
    const { F, seed } = run, time = F.wonAt ?? F.time;
    state = 'end'; unpause();
    menus.end({ time, kills: F.kills, golf: F.golf, link: shareLink(location.href, seed), seed, ...recordBest(store, seed, time) });
    hud.mode('none');
    input.unlock();
  }

  // dt seconds of the current state. Sub-steps are at most 0.05 s, and one-shot inputs (use, weapon, wheel) count on the
  // first only. The title steps the attract run with the bot's input; play and ending step yours, with flashes, status and
  // prompt; the end screen steps nothing. A level swap is handled for whatever run is on screen, and the events are cleared
  // here, so each call (a frame or an ff step) sees only its own (pre-flight F3). When the bot is done (the comms room, or
  // stalled) a fresh attract Moon replaces it; the hash is never touched. Houston picking up starts the ending, which goes to
  // the end screen after ENDING.min s once the radio is idle, or after ENDING.max s whatever it is saying.
  function advance(dt, inp) {
    const F = run.F, B = run.bot, n = Math.max(1, Math.ceil(dt / .05)), h = dt / n, playing = state === 'play' || state === 'ending';
    if (state === 'title') for (let k = 0; k < n && !B.done; k++) { const b = botStep(B, F, h); stepFight(F, k ? { ...b, use: false, weapon: -1, wheel: 0 } : b, h); }
    if (playing) for (let k = 0; k < n; k++) stepFight(F, k ? { ...inp, use: false, weapon: -1, wheel: 0 } : inp, h);
    for (const ev of F.events) if (ev.type === 'area' && ev.level) swap();
    if (playing) {
      const p = F.player, U = run.world.crater.use;
      hud.status({ hp: Math.ceil(F.hp), cells: F.ars.cells, weapon: WEAPONS[F.ars.cur]?.name ?? '' });
      if (F.time >= HELP_TIME) hud.help('');
      for (const ev of F.events) if (FLASH.has(ev.type) && ev.text) hud.flash(ev.text);
      const d = F.area === 3 && dishOf(run.world.baseMap);
      hud.prompt(F.state === 'dead' ? 'You died. Back to ' + BACK[F.area] + '...'
        : F.lv.id === 'surface' && !F.flag.held && Math.hypot(p.x - F.flag.x, p.z - F.flag.z) < 2.2 ? '[E] grab the flag'
        : F.area === 1 && Math.hypot(p.x - U.x, p.z - U.z) <= DOOR_REACH ? '[E] enter the hangar'
        : d && !F.hold && Math.hypot(p.x - d.x, p.z - d.z) <= HOLD.reach ? '[E] call Houston'
        : F.hold && !F.won ? 'ON HOLD ' + fmtTime(F.hold.t) : '');
    }
    if (state === 'play' && F.events.some(e => e.type === 'houston')) { state = 'ending'; endT = 0; }
    else if (state === 'ending') {
      const quiet = true; // the radio is idle (always, until Task 11 gives it a queue)
      if ((endT += dt) >= ENDING.min && quiet || endT >= ENDING.max) finish();
    }
    F.events.length = 0;
    if (state === 'title' && B.done) { stopRun(); startRun('attract', randomSeed()); }
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
  // At the comms array's call spot facing the dish, one tiny step on so the area turns to the comms room (from the surface,
  // through the hangar door first).
  function comms() {
    const { F, world } = run, c = callSpot(world.baseMap), d = dishOf(world.baseMap);
    if (F.lv.id === 'surface') enter();
    place(c.x, c.z, Math.atan2(c.x - d.x, c.z - d.z)); stepFight(F, IDLE, .001);
  }
  // Fast-forward: sec seconds of 1/30 s steps, inp held on every one.
  function ff(sec, inp = {}) { for (let i = Math.round(sec * 30); i > 0; i--) advance(1 / 30, { ...IDLE, ...inp }); }
  const T = window.ospTest = {
    ready: false, hdr: hdrOK,
    get seed() { return run.kind === 'play' ? run.seed : normalizeSeed(location.hash); },
    get checksum() { return run.kind === 'play' ? checksumWorld(run.world) : null; },
    capture: () => renderer.capture(), frames: () => frames, fault: () => { fault = true; }, paused: () => paused, settings: () => ({ ...S }),
    state: () => state, play: () => newGame(), finish, ff,
    attract: () => run.bot ? { seed: run.seed, stage: run.bot.stage, done: run.bot.done } : null,
    player: () => { const p = run.F.player; return { x: p.x, y: p.y, z: p.z }; },
    fight: () => { const F = run.F, p = F.player, s = areaStart(run.world, F.area);
      return { hp: F.hp, cells: F.ars.cells, cur: F.ars.cur, state: F.state, kills: F.kills, bolts: F.bolts.length, shots: F.shots, area: AREAS[F.area], golf: F.golf, time: F.time, atStart: Math.hypot(p.x - s.x, p.z - s.z) < 1,
        hold: F.hold?.t ?? null, won: F.won, wonAt: F.wonAt }; },
    area: () => AREAS[run.F.area],
    grab: () => { const F = run.F, p = F.player; p.x = F.flag.x + 1; p.z = F.flag.z; p.y = F.lv.ground(p.x, p.z); stepFight(F, { ...IDLE, use: true }, .001); },
    give: () => { const A = run.F.ars; for (let i = 0; i < WEAPONS.length; i++) A.owned[i] = true; A.cells = 150; if (A.cur < 0) A.cur = 0; },
    door, enter, warp, comms, hurt: n => hurtPlayer(run.F, n, 0, 0, 0), god: on => { run.F.god = on; },
    // The clocks that pause stops: the opening's (Task 8), the hold's and the ending's, each null when not running.
    clock: () => ({ opening: null, hold: run.F.hold?.t ?? null, ending: state === 'ending' ? endT : null }),
  };

  // --- the frame loop: advance the state, then draw the current run, in every state ---
  function tick(now) {
    try {
      if (fault) throw new Error('test fault');
      // Real time, so slow frames don't slow the game; a long stall skips at most 0.25 s.
      const el = Math.max(0, (now - last) / 1000); last = now;
      const inp = input.read();
      if (!paused) { if (pausable()) look(run.F.player, inp.lookX, inp.lookY, S.sens, S.invert); advance(Math.min(.25, el), inp); }
      frame.t = (now - t0) / 1000; frame.palMode = palMode;
      fillFrame(V, run.F, frame, frame.t);
      renderer.render(frame);
      if (!T.ready) { T.ready = true; hud.ready(); }
      if (DEBUG) {
        const F = run.F, p = F.player; fpsN++; fpsT += el;
        if (fpsT >= .5) { hud.debug(`${fp} \u00b7 ${state} \u00b7 ${AREAS[F.area]} \u00b7 ${Math.round(fpsN / fpsT)} fps \u00b7 ${RES[S.res] || 'native'}p \u00b7 palette ${['off', 'dithered', 'flat'][palMode]} \u00b7 hp ${Math.ceil(F.hp)} \u00b7 awake ${F.aliens.filter(a => a.state !== 'dead' && (a.enc.alerted || Math.hypot(p.x - a.enc.x, p.z - a.enc.z) < F.lv.wake)).length} \u00b7 bolts ${F.bolts.length}`); fpsN = fpsT = 0; }
      }
      frames++;
      if (!lost) raf = requestAnimationFrame(tick);
    } catch (e) { fail(e); throw e; }
  }
  // Anything that throws in the loop or a menu click stops the frames and says so.
  function fail(e) {
    lost = true; cancelAnimationFrame(raf);
    hud.fatal('Something went wrong: ' + e.message + '. Reload the page to continue.');
  }
  toTitle(false);
  raf = requestAnimationFrame(tick);
}
