// Boot and the game's state machine. The page opens on the title with an attract run behind it; New Game plays the URL's seed
// (or rolls one and writes it there), starting with the opening; the end screen reports the run and leads back to the title,
// which clears the seed.
// States: 'title' -> 'opening' -> 'play' -> 'liftoff' -> 'end' -> 'title'. Houston's call is play with F.ko set; its knock-out
// takes you, still in play, through the black and the wake into the prison (level 2). Boarding the rescue ship ends play: the
// lift-off, seen from its cabin, then the sting and the fade to the end screen.
import { makeRng, normalizeSeed, seedName } from './gen/rng.js';
import { generateWorld } from './gen/world.js';
import { checksumWorld } from './gen/checksum.js';
import { createGL } from './gfx/gl.js';
import { createRenderer } from './gfx/renderer.js';
import { createFight, stepFight, hurtPlayer, enterArea, knockOut, skipTo, canBang, atExit, atLadder, openBars, DOOR_REACH } from './game/fight.js';
import { createFightView, fillFrame, setScene, setWreck } from './game/fightView.js';
import { AREAS, areaStart, wayfind } from './game/areas.js';
import { exitOf, ladderAt, LIFT, koLight, koLock } from './game/escape.js';
import { WEAPONS } from './game/weapons.js';
import { buildSurfaceScene } from './game/surfaceScene.js';
import { buildBaseScene } from './game/baseScene.js';
import { settleWreck, stepWreck } from './game/lander.js';
import { createOpening, stepOpening } from './game/opening.js';
import { createLiftoff, stepLiftoff } from './game/liftoff.js';
import { createBot, botStep } from './game/bot.js';
import { HOLD, dishOf, callSpot, endingOver } from './game/hold.js';
import { WHO } from './game/script.js';
import { createRadio, radioCue, radioEvents, stepRadio, radioDone, pauseRadio, cutReaction, cutAll, dawdling, silence } from './game/radio.js';
import { createAudio } from './audio/audio.js';
import { buildSfx, sfxFor } from './audio/sfx.js';
import { renderSongs } from './audio/music.js';
import { createSpeech } from './audio/speech.js';
import { createInput, look } from './game/input.js';
import { createHud, HELP_TIME } from './ui/hud.js';
import { createMenus } from './ui/menus.js';
import { shareLink, recordBest, fmtTime } from './ui/score.js';
import { RES, loadSettings, saveSettings } from './ui/settings.js';

// The scene fields a frame carries (the view supplies the meshes and lights); the events whose text flashes up (the knock-out's
// THE CELLS as you stand); where a death in each area sends you back to; no input at all; the help line, shown as a run starts
// and hidden after HELP_TIME s of it (R2).
const SCENE = ['sky', 'mode', 'sun', 'earth', 'curv', 'fog', 'fogDensity', 'occTex'], FLASH = new Set(['pickup', 'flag', 'golf', 'area', 'woke']);
// Footsteps on the ground play every STRIDE metres walked, at STEP_VOL.
const STRIDE = 1.6, STEP_VOL = .4;
const BACK = ['the wreck', 'the crater rim', 'the lift', 'the comms room door', 'the cell', 'the hangar door', 'the crater rim'];
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
  // run: the Moon on screen, {kind: 'attract' | 'play', seed, world, scene, F, wreck (the lander's pieces), O (the opening while
  // it plays, else null), moving (the wreck is still settling after the opening), R (the radio, play only: attract runs stay
  // silent), bot (attract only), koDue (the cut-off line's talk has ended: the next advance knocks you out), L (the lift-off while
  // it plays, else null), fade (s into the fade to the end screen once the lift-off's end gate opens, else null)}.
  // state: where the flow is (see the top).
  let run = null, state = 'title';
  // S: the settings (loaded once, kept in memory even where the store refuses them). Paused: the pause menu is up, nothing
  // advances. lockLostAt: when a lost pointer lock paused the game, so the Esc that did it can't also resume it.
  // Generated sound can never stop the game: a throwing generator leaves no effects, and the songs render after boot, one promise each (any failure
  // leaves that one out). The AudioContext itself waits for the first New Game click.
  let sfx = {}; try { sfx = buildSfx(); } catch {}
  const audio = createAudio({ sfx, songs: (() => { try { return renderSongs(); } catch { return {}; } })() });
  // The radio's voice, when the browser has one (lines are subtitled either way; nothing waits for voices to load).
  const speech = createSpeech();
  // The music map: the title the surface song, the opening none until its title drop, play the area's song (the hold's on hold,
  // none in Houston's call), the lift-off the dash's until the sting, then none, the end screen the hold music. Asked every frame;
  // the engine ignores a repeat.
  const MUSIC = ['surface', 'crater', 'base', 'base', 'prison', 'escape', 'escape'];
  const music = () => audio.song(state === 'title' || state === 'opening' && run.titled ? 'surface' : state === 'play' ? run.F.ko ? null : run.F.hold ? 'hold' : MUSIC[run.F.area]
    : state === 'liftoff' ? run.L.sting ? null : MUSIC[6] : state === 'end' ? 'hold' : null);
  let S = loadSettings(store), paused = false, lockLostAt = -1e9, appliedRes = -1;
  // Menu clicks run inside the fatal path too: an exception stops the loop and shows the message, as in tick.
  const guard = f => (...a) => { try { f(...a); } catch (e) { fail(e); throw e; } };
  const input = createInput(canvas), menus = createMenus({ onNew: guard(() => { audio.start(); input.lock(); newGame(true); }), onBack: guard(() => toTitle(true)),
    onResume: guard(() => resume()), onQuit: guard(() => quit()), onSetting: guard(setting) });
  const frame = { exposure: 1, lights: { pos: new Float32Array(64), col: new Float32Array(64), count: 0 }, spheres: new Float32Array(32) };
  let palMode = S.pal ? 1 : 0, lost = false, fp = '', warpK = 0, raf = 0, frames = 0, fault = false, t0 = performance.now(), last = t0, fpsN = 0, fpsT = 0;

  // Native (RES 0) is the window's height in device pixels, at most 2 per CSS pixel.
  const resize = () => lost || renderer.resize(innerWidth, innerHeight, devicePixelRatio || 1, RES[S.res] || Math.round(innerHeight * Math.min(2, devicePixelRatio || 1)));
  // Settings take effect at once; the render targets are rebuilt only when the resolution changes.
  function apply() { audio.volume(S.vol); speech.volume(S.vol); palMode = S.pal ? 1 : 0; if (S.res !== appliedRes) { appliedRes = S.res; resize(); } }
  function setting(s) { S = s; saveSettings(store, S); apply(); }
  addEventListener('resize', resize); apply();
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); lost = true; cancelAnimationFrame(raf);
    hud.fatal('Graphics context lost. Reload the page to continue.'); halt();
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
  const pausable = () => !lost && (state === 'opening' || state === 'play' || state === 'liftoff');
  function unpause() { paused = false; menus.pause(false); }
  // Esc or a lost pointer lock: the pause menu goes up, the frame keeps drawing, and the mouse is let go (headless browsers
  // keep the lock on Esc, so this doesn't rely on the browser). The radio stops mid-line: a story line plays again from its start
  // on resume, a reaction is dropped.
  function pause() {
    if (!pausable() || paused) return;
    paused = true; audio.pause(); if (run.R) radioDo(run.R, pauseRadio(run.R)); speech.cancel(); menus.pause(true, S, HELP); input.unlock();
  }
  function resume() { unpause(); audio.resume(); input.lock(); }
  function quit() { unpause(); toTitle(true); }
  // The lock is held only while it is wanted, in the opening, play or the lift-off, unpaused (R6). One that arrives otherwise (a
  // request still in flight when the game paused, finished or quit) is let go at once, so the menus' buttons take clicks
  // (pre-flight F1); that release never pauses. Losing a wanted lock while playing pauses.
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) { if (!input.wanted() || paused || !pausable()) input.unlock(); }
    else if (input.wanted() && pausable() && !paused) { pause(); lockLostAt = performance.now(); }
  });
  addEventListener('keydown', e => {
    if (e.code !== 'Escape' || e.repeat || lost) return;
    if (!paused) pause(); else if (performance.now() - lockLostAt > 300) resume();
  });

  // --- runs ---
  // The view draws the scene's meshes and lamps, and on the surface the run's wreck; the frame takes the scene's look.
  function useScene(scene) { setScene(V, scene); setWreck(V, scene.id === 'surface' ? run.wreck : null); for (const k of SCENE) frame[k] = scene[k]; audio.air(run.F.lv.id !== 'surface'); }
  // A fresh Moon on the surface, at the wreck (the lander as the opening leaves it); intact, the lander stands whole for the
  // opening, which brings its own (newGame). Attract runs are immortal and played by the bot (never the opening, spec 4.1).
  function startRun(kind, seed, { intact = false } = {}) {
    const world = generateWorld(seed), scene = buildSurfaceScene(gl, world, intact), F = createFight(world);
    run = { kind, seed, world, scene, F, wreck: intact ? null : settleWreck(world), O: null, moving: false, R: kind === 'play' ? createRadio(makeRng(seed + '/radio')) : null,
      L: null, fade: null }; warpK = 0;
    if (kind === 'attract') { F.god = true; run.bot = createBot(world, makeRng(seed + '/bot')); }
    useScene(scene);
    if (DEBUG) fp = `#${seed} ${checksumWorld(world)}`;
  }
  function stopRun() { hush(); run?.scene.dispose(); }
  // The radio off at once, whatever it was saying: no voice, subtitle or keyed dot, noise bed or duck (pre-flight F11).
  function hush() { speech.cancel(); hud.sub(''); audio.bed(false); audio.duck(false); }
  // The radio's actions: the subtitle and its keyed dot, the Quindar tones with their static, the noise bed under the line, the
  // music ducked while a line is on, and the voice when the line has one (a voice that fails, at once or by its onerror, leaves
  // the line up for its unvoiced reading time, R15). off leaves out key(false), which would sound the closing tone, so a line cut
  // short by a pause stops dead (pre-flight F11); it keeps the duck while a story line waits, so the music doesn't swell between
  // the lines of a sequence, but not for a reaction alone (R23). The rescue line is cut off: as its talk ends the subtitle and the
  // bed go with no closing tone, and the next advance knocks you out (spec 2).
  function radioDo(R, acts) {
    for (const { do: d, line } of acts) {
      if (d === 'key') { hud.sub(WHO[line.who] + ': ' + line.text, true); audio.key(true); audio.duck(true); audio.bed(true); }
      else if (d === 'say') { if (line.voiced && !speech.say(line, failed => radioDone(R, line.id, failed))) radioDone(R, line.id, true); }
      else if (d === 'unkey' && line.key === 'rescue') { hud.sub(''); audio.bed(false); run.koDue = true; }
      else if (d === 'unkey') { hud.sub(WHO[line.who] + ': ' + line.text, false); audio.key(false); audio.bed(false); }
      else { hud.sub(''); audio.duck(R.q.some(l => l.crit)); audio.bed(false); }
    }
  }
  // A new level gets its own scene (the base and the prison are built from their maps); the old one's GPU meshes are freed.
  function swap() {
    const lv = run.F.lv, next = lv.id === 'surface' ? buildSurfaceScene(gl, run.world) : buildBaseScene(gl, lv.map);
    useScene(next); run.scene.dispose(); run.scene = next; warpK = 0;
  }

  // --- the flow ---
  // New Game plays the URL's seed, or rolls one and writes it there (replaceState: no new history entry). The New Game button
  // starts with the opening, on an intact lander; ospTest.play() skips it, into play at the settled wreck.
  function newGame(opening) {
    const seed = normalizeSeed(location.hash) ?? randomSeed();
    try { history.replaceState(null, '', '#' + seed); } catch {}
    stopRun(); startRun('play', seed, { intact: opening }); unpause(); menus.hide();
    if (!opening) return play();
    run.O = createOpening(run.world, run.F); run.wreck = run.O.wreck; run.moving = true; setWreck(V, run.wreck);
    state = 'opening'; hud.mode('opening'); hud.prompt('');
  }
  // Into play: the status line, the help line (shown as each run starts) and the seed.
  function play() { state = 'play'; hud.mode('play'); hud.help(HELP); hud.seed('#' + run.seed); }
  // The title, with a fresh attract run behind it and the mouse let go (pre-flight F1). At boot the URL's seed stays, so a
  // shared link survives to New Game; Back to title clears it, so the next New Game rolls a fresh Moon.
  function toTitle(clear) {
    stopRun(); unpause(); audio.resume(); input.unlock();
    if (clear) try { history.replaceState(null, '', location.pathname + location.search); } catch {}
    startRun('attract', randomSeed());
    state = 'title'; music();
    menus.title(true, normalizeSeed(location.hash)); hud.mode('none'); hud.seed('');
  }
  // The end screen, from the lift-off (or ospTest.finish in play): the run's clock, F.run (deaths count; the opening, pauses,
  // Houston's call and the knock-out don't, R9), or once boarded the time then (F.wonAt), lifetime kills (not counted in the call
  // or the knock-out either), golf balls and the seed's best time. The mouse is let go, so #back, #copy and #link take clicks
  // (pre-flight F1). A lift-off's fade stays down behind it.
  function finish() {
    if (state !== 'play' && state !== 'liftoff') return;
    const { F, seed } = run, time = F.wonAt ?? F.run;
    state = 'end'; run.L = null; unpause(); hush(); music();
    menus.end({ time, kills: F.kills, golf: F.golf, link: shareLink(location.href, seed), seed, ...recordBest(store, seed, time) });
    hud.mode('none');
    input.unlock();
  }

  // dt seconds of the current state. Sub-steps are at most 0.05 s, and one-shot inputs (use, weapon, wheel) count on the
  // first only. The title steps the attract run with the bot's input; the opening steps its director with yours, with its
  // prompt: the blast swaps the scene's shadow map for the wreck's, the title drop stamps the title, and at its end play takes
  // over; play steps yours, with flashes, status and prompt; the end screen steps nothing. In the opening and play the radio
  // takes the opening's cues and the fight's events, then steps (its dawdle clock runs in play, off hold, R16).
  // After the opening the wreck keeps settling, a call at a time, until every piece is still (pre-flight F29). A level swap is handled for whatever run is on screen, and the events (the fight's and the opening's) are
  // cleared here, so each call (a frame or an ff step) sees only its own (pre-flight F3). When the bot is done (the comms room, or
  // stalled) a fresh attract Moon replaces it; the hash is never touched. Houston picking up starts Houston's call and cuts a
  // reaction or on-hold message on the air, its voice with it, so the punchline comes at once (R18, R26). The knock-out (after
  // the cut-off line, which a frame's start turns into it here, or at KO.call in the fight) thuds and kills the radio, before it
  // can step again, and takes the HUD down; in its black and on the cell floor no other sound plays and nothing flashes (pre-flight
  // F13: not the level change's door; Houston's call before it sounds and flashes as usual), the stamp slams on in the opening's
  // style, and the HUD comes back as you stand (THE CELLS flashes). Boarding starts the lift-off (from the next advance): its
  // director steps in sub-steps, its click and sting cued as the opening's are, the radio stepping as in play; once the sting has
  // been on ENDING.min s with the radio idle (or ENDING.max s whatever is on the air) the fade runs LIFT.fade s, then the end screen.
  function advance(dt, inp) {
    if (run.koDue) { run.koDue = false; knockOut(run.F); }
    const F = run.F, B = run.bot, O = run.O, n = Math.max(1, Math.ceil(dt / .05)), h = dt / n, playing = state === 'play';
    if (state === 'title') for (let k = 0; k < n && !B.done; k++) { const b = botStep(B, F, h); stepFight(F, k ? { ...b, use: false, weapon: -1, wheel: 0 } : b, h); }
    if (playing) for (let k = 0; k < n; k++) stepFight(F, k ? { ...inp, use: false, weapon: -1, wheel: 0 } : inp, h);
    if (run.moving && !O) { stepWreck(run.wreck, dt); run.moving = run.wreck.pieces.some(p => !p.still); }
    if (state === 'opening') {
      for (let k = 0; k < n && O.phase !== 'done'; k++) stepOpening(O, k ? { ...inp, use: false, weapon: -1, wheel: 0 } : inp, h);
      hud.prompt(O.prompt);
      for (const ev of O.events) {
        if (ev.type === 'wreck') { run.scene.wreck(); frame.occTex = run.scene.occTex; } // useScene copied the intact one, now deleted
        else if (ev.type === 'sfx') audio.sfx(ev.key);
        else if (ev.type === 'radio') radioCue(run.R, ev.key);
        else if (ev.type === 'title') { hud.stamp(); run.titled = true; }
        else if (ev.type === 'done') { run.O = null; play(); }
      }
      O.events.length = 0;
    }
    if (state === 'liftoff') {
      const L = run.L;
      for (let k = 0; k < n; k++) stepLiftoff(L, h);
      for (const ev of L.events) { if (ev.type === 'sfx') audio.sfx(ev.key); else if (ev.type === 'radio') radioCue(run.R, ev.key); }
      L.events.length = 0;
    }
    for (const ev of F.events) if (ev.type === 'area' && ev.level) swap();
    if (playing) {
      const p = F.player, U = run.world.crater.use, W = run.walk ??= { x: p.x, z: p.z, d: 0 };
      const out = koLock(F); // the knock-out's black and the floor
      if (!out) for (const ev of F.events) { const s = sfxFor(ev, p); if (s) audio.sfx(s[0], s[1]); }
      const stride = Math.hypot(p.x - W.x, p.z - W.z); W.x = p.x; W.z = p.z;
      if (p.onGround && stride < 3 && !out) for (W.d += stride; W.d >= STRIDE; W.d -= STRIDE) audio.sfx('step', STEP_VOL);
      hud.status({ hp: Math.ceil(F.hp), cells: F.ars.cells, weapon: WEAPONS[F.ars.cur]?.name ?? '' });
      hud.way(wayfind(F));
      hud.clock(F.ship && F.state === 'play' && !F.ko ? F.ship.left : null);
      if (F.time >= HELP_TIME) hud.help('');
      for (const ev of F.events) {
        if (ev.type === 'stamp') { hud.stamp(ev.text); audio.sfx('stamp'); }
        else if (ev.type === 'woke') hud.mode('play');
        if (FLASH.has(ev.type) && ev.text && !out) hud.flash(ev.text);
      }
      const d = F.area === 3 && dishOf(run.world.baseMap);
      hud.prompt(F.ko ? '' : F.state === 'dead' ? F.ship?.left <= 0 ? 'The ship left without you. Back to the crater rim...' : 'You died. Back to ' + BACK[F.area] + '...'
        : F.lv.id === 'surface' && !F.flag.held && Math.hypot(p.x - F.flag.x, p.z - F.flag.z) < 2.2 ? '[E] grab the flag'
        : canBang(F) ? '[E] bang on the bars'
        : atExit(F) ? '[E] take the lift'
        : atLadder(F) ? '[E] board'
        : F.area === 1 && Math.hypot(p.x - U.x, p.z - U.z) <= DOOR_REACH ? '[E] enter the hangar'
        : d && !F.hold && Math.hypot(p.x - d.x, p.z - d.z) <= HOLD.reach ? '[E] call Houston'
        : F.hold ? 'ON HOLD ' + fmtTime(F.hold.t) : '');
    }
    const R = run.R;
    if (state === 'play' && F.events.some(e => e.type === 'ko')) { audio.sfx('thud'); speech.cancel(); radioDo(R, silence(R)); hud.mode('none'); }
    if (state === 'play' && F.events.some(e => e.type === 'board')) { // the line on the air, story or reaction, is cut: only the boarding line and the sting air in the lift-off
      state = 'liftoff'; run.L = createLiftoff(F); run.fade = null; hud.mode('none'); hud.prompt('');
      const cut = cutAll(R); if (cut.length) { speech.cancel(); radioDo(R, cut); }
    }
    if (R && (state === 'opening' || state === 'play' || state === 'liftoff')) { radioEvents(R, F.events, F); radioDo(R, stepRadio(R, dt, speech.ok, dawdling(state, F))); }
    if (state === 'play' && F.events.some(e => e.type === 'houston')) { const cut = cutReaction(R); if (cut.length) { speech.cancel(); radioDo(R, cut); } }
    if (state === 'liftoff') {
      if (run.fade !== null) { if ((run.fade += dt) >= LIFT.fade - 1e-9) finish(); }
      else if (run.L.sting && endingOver(run.L.t - LIFT.sting, R)) run.fade = 0;
    }
    F.events.length = 0; music();
    if (state === 'title' && B.done) { stopRun(); startRun('attract', randomSeed()); }
  }

  // --- test and debug hooks, acting on the current run ---
  // The player at (x, z) on the level's ground, standing still, facing yaw.
  const place = (x, z, yaw) => Object.assign(run.F.player, { x, y: run.F.lv.ground(x, z), z, vx: 0, vy: 0, vz: 0, kx: 0, kz: 0, yaw, pitch: 0, onGround: true });
  // Encounter k of the current level: on the surface 18 m from its centre on the side toward the lander; indoors (the base or
  // the prison, a level with a map) at its room's `in` on that map. Either way facing the centre (pre-flight F26).
  function warp(k) {
    const { F, world } = run, e = F.encs[k];
    if (F.lv.map) { const o = F.lv.map.rooms[e.room].in; place(o.x, o.z, Math.atan2(o.x - e.x, o.z - e.z)); return; }
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
    state: () => state, play: () => { audio.start(); newGame(false); }, audio: () => audio.info(), songBuffer: k => audio.buffer(k), finish, ff,
    // The opening while it plays ({phase, t, prompt}), else null; whether the frame draws the scene's live shadow map (it changes
    // at the blast).
    opening: () => run.O && { phase: run.O.phase, t: run.O.t, prompt: run.O.prompt }, occ: () => frame.occTex === run.scene.occTex,
    attract: () => run.bot ? { seed: run.seed, stage: run.bot.stage, done: run.bot.done } : null,
    player: () => { const p = run.F.player; return { x: p.x, y: p.y, z: p.z }; },
    wreck: () => ({ n: run.wreck.pieces.length, still: run.wreck.pieces.filter(p => p.still).length }),
    fight: () => { const F = run.F, p = F.player, s = areaStart(run.world, F.area);
      return { hp: F.hp, cells: F.ars.cells, cur: F.ars.cur, state: F.state, kills: F.kills, bolts: F.bolts.length, shots: F.shots, area: AREAS[F.area], golf: F.golf, time: F.time, atStart: Math.hypot(p.x - s.x, p.z - s.z) < 1,
        hold: F.hold?.t ?? null, won: F.won, wonAt: F.wonAt, run: F.run, ko: F.ko?.phase ?? null, cell: F.cell && { ...F.cell } }; },
    area: () => AREAS[run.F.area],
    grab: () => { const F = run.F, p = F.player; p.x = F.flag.x + 1; p.z = F.flag.z; p.y = F.lv.ground(p.x, p.z); stepFight(F, { ...IDLE, use: true }, .001); },
    give: () => { const A = run.F.ars; for (let i = 0; i < WEAPONS.length; i++) A.owned[i] = true; A.cells = 150; if (A.cur < 0) A.cur = 0; },
    door, enter, warp, comms, hurt: n => hurtPlayer(run.F, n, 0, 0, 0), god: on => { run.F.god = on; },
    // Straight into the prison's cell (area 4), stripped as the knock-out leaves you.
    prison: () => skipTo(run.F, 4),
    // Up the exit lift: from before the prison, into the cell first; the bars opened, you at the lift, one E.
    lift: () => { const F = run.F, e = exitOf(F.world.prisonMap); if (F.area < 4) skipTo(F, 4); if (F.cell.shut) openBars(F); place(e.x + 1, e.z, 0); stepFight(F, { ...IDLE, use: true }, .001); },
    // The start of the climb (area 5) or the dash (area 6).
    climb: () => skipTo(run.F, 5), dash: () => skipTo(run.F, 6),
    // The rescue ship in the dash ({landed, left: its clock, site}), else null; calm: every alien gone; turn: you face yaw, pitch.
    ship: () => { const S = run.F.ship; return S && { landed: S.landed, left: S.left, site: { x: S.at.x, z: S.at.z } }; },
    calm: () => { run.F.aliens.length = 0; }, turn: (yaw, pitch) => { Object.assign(run.F.player, { yaw, pitch }); },
    // 1.2 m inside the bars facing them; with press, one E.
    bang: (press = true) => { const F = run.F, b = F.world.prisonMap.bars; place(b.x - b.dx * 1.2, b.z - b.dz * 1.2, Math.atan2(-b.dx, -b.dz));
      if (press) stepFight(F, { ...IDLE, use: true }, .001); },
    // The radio of a play run: the subtitle of the line on the air (null between lines), the cues of the lines waiting and the
    // dawdle clock (s); cue(key) cues its lines.
    radio: () => run.R && { line: run.R.cur && WHO[run.R.cur.who] + ': ' + run.R.cur.text, queued: run.R.q.map(l => l.key), dawdle: run.R._idle },
    cue: k => run.R && radioCue(run.R, k),
    // At the rescue ship's ladder facing it, one E (it boards once the ship is down); nothing outside the dash.
    board: () => { const F = run.F, S = F.ship; if (!S) return; const l = ladderAt(S); place(l.x, l.z, Math.atan2(S.at.dx, S.at.dz)); stepFight(F, { ...IDLE, use: true }, .001); },
    // The clocks that pause stops: the opening's, the hold's, Houston's call's (to the knock-out), the lift-off's and its fade's
    // (s into the fade to the end screen), each null when not running.
    clock: () => ({ opening: run.O?.t ?? null, hold: run.F.hold?.t ?? null, ko: run.F.ko?.t ?? null, liftoff: run.L?.t ?? null, fade: run.fade }),
  };

  // --- the frame loop: advance the state, then draw the current run, in every state ---
  function tick(now) {
    try {
      if (fault) throw new Error('test fault');
      // Real time, so slow frames don't slow the game; a long stall skips at most 0.25 s.
      const el = Math.max(0, (now - last) / 1000); last = now;
      const inp = input.read();
      // The mouse doesn't look while the opening holds the view (the knock-down) or the knock-out does (the black and the floor).
      if (!paused) { if (pausable() && !run.O?.lock && !koLock(run.F)) look(run.F.player, inp.lookX, inp.lookY, S.sens, S.invert); advance(Math.min(.25, el), inp); }
      frame.t = (now - t0) / 1000; frame.palMode = palMode;
      // the knock-out's black and its light coming back, and the lift-off's fade to the end screen, which stays down behind it
      frame.exposure = koLight(run.F) * (run.fade === null ? 1 : Math.max(0, 1 - run.fade / LIFT.fade));
      // the opening and the lift-off draw their own fight-shaped views (the cabin's eye, actors, glows, glitter and the flash)
      fillFrame(V, run.O ? run.O.view : run.L ? run.L.view : run.F, frame, frame.t);
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
    hud.fatal('Something went wrong: ' + e.message + '. Reload the page to continue.'); halt();
  }
  // After a fatal error or a lost context nothing is left running under the message: the sound stops, the voice is cancelled and
  // the mouse let go (R20). After the message, so it shows whatever these do.
  function halt() { audio.pause(); speech.cancel(); input.unlock(); }
  toTitle(false);
  raf = requestAnimationFrame(tick);
}
