import test from 'node:test'; import assert from 'node:assert/strict'; import { fakeGL } from './fakegl.mjs';
import { sampleGround } from '../src/gen/surface.js'; import { generateWorld } from '../src/gen/world.js'; import { buildSurfaceScene } from '../src/game/surfaceScene.js';
import { createFight, stepFight, hurtPlayer } from '../src/game/fight.js'; import { createAlien } from '../src/game/aliens.js'; import { give } from '../src/game/weapons.js';
import { createFightView, fillFrame } from '../src/game/fightView.js'; import { cameraBasis, xf, dot } from '../src/gfx/math.js';
import { TAPE_GLINT, VIG } from '../src/game/fightView.js'; import { TAPE_R } from '../src/game/models.js'; import { tilt, setWreck } from '../src/game/fightView.js'; import { readFileSync } from 'node:fs'; import { settleWreck } from '../src/game/lander.js';
const W = generateWorld('APOLLO-4471'), gl = fakeGL(), scene = buildSurfaceScene(gl, W), V = createFightView(gl, scene);
const idle = { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 };
const frame = () => ({ ...scene, exposure: 1, lights: { pos: new Float32Array(64), col: new Float32Array(64), count: 0 }, spheres: new Float32Array(32) });
const put = (F, x, z) => Object.assign(F.player, { x, z, y: sampleGround(W, x, z) });
test('the frame carries the scene, nearby aliens and the planted flag', () => { const F = createFight(W), fr = frame(), a = F.aliens[0];
  put(F, a.x + 20, a.z); fillFrame(V, F, fr, 0); for (const m of V.static) assert.ok(fr.meshes.includes(m));
  assert.ok(fr.meshes.filter(m => m.gpu === V.gpu.skLeg).length >= 6); assert.ok(fr.meshes.some(m => m.gpu === V.gpu.flag));
  put(F, F.flag.x + 1, F.flag.z); stepFight(F, { ...idle, use: true }, 1 / 60); fillFrame(V, F, fr, 0); assert.ok(!fr.meshes.some(m => m.gpu === V.gpu.flag)); });
test('a crowded fight clips to 16 lights, 8 spheres and 512 sprites, nearest first (Review Focus 2)', () => { const F = createFight(W), fr = frame(), p = F.player, e = p.y + 1.7;
  F.canisters.length = 0; F.shotT = 9;
  for (let i = 0; i < 300; i++) F.bolts.push({ x: p.x + 1 + i, y: e, z: p.z, vx: 1, vy: 0, vz: 0, dmg: 1, r: .2, life: 9, col: [.3, 1, .8], team: 1, src: 99 });
  for (let i = 0; i < 400; i++) F.parts.push({ x: p.x, y: e, z: p.z - 2 - i * .01, vx: 0, vy: 0, vz: 0, kind: 'goo', life: 9 });
  for (let i = 0; i < 40; i++) F.aliens.push(createAlien({ type: 'sk', x: p.x - 3 - i, y: p.y, z: p.z + 2 }, 500 + i, F.encs[0]));
  assert.doesNotThrow(() => fillFrame(V, F, fr, 0)); assert.equal(fr.lights.count, 16);
  for (let i = 0; i < 16; i++) assert.ok(Math.hypot(fr.lights.pos[i * 4] - p.x, fr.lights.pos[i * 4 + 2] - p.z) <= 16 + 1e-3);
  let ns = 0; for (let i = 0; i < 8; i++) if (fr.spheres[i * 4 + 3] > 0) ns++; assert.equal(ns, 8); assert.ok(Math.abs(fr.spheres[0] - (p.x - 3)) < .5);
  assert.ok(fr.sprites.nOpaque + fr.sprites.nGlow <= 512); assert.ok(fr.sprites.nOpaque <= 192); });
test('the planted flag is drawn on the surface level only', () => { const fr = frame(), at = F => { fillFrame(V, F, fr, 0); return fr.meshes.some(m => m.gpu === V.gpu.flag); };
  assert.equal(at(createFight(W)), true); assert.equal(at(createFight(W, 1)), true); assert.equal(at(createFight(W, 2)), false); });
test('the view model follows the weapon and is gone when dead', () => { const F = createFight(W), fr = frame();
  fillFrame(V, F, fr, 0); assert.equal(fr.view, null); put(F, F.flag.x + 1, F.flag.z); stepFight(F, { ...idle, use: true }, 1 / 60); fillFrame(V, F, fr, 0); assert.equal(fr.view.gpu, V.gpu.pole);
  give(F.ars, 1, 10); fillFrame(V, F, fr, 0); assert.equal(fr.view.gpu, V.gpu.pistol); F.hp = 1; hurtPlayer(F, 5, 0, 0, 0); fillFrame(V, F, fr, 0); assert.equal(fr.view, null); });
test('the vignette: a hit flares it by hurtT, low health pulses a rim at 1 Hz, death is heavy; never for god mode, a won fight, Houston\'s call or the opening (Plan 5, Review Focus 3)', () => {
  const F = createFight(W), fr = frame(), near = (a, b) => Math.abs(a - b) < 1e-9;
  fillFrame(V, F, fr, 0); assert.deepEqual([...fr.tint], [0, 0, VIG.reach]);
  hurtPlayer(F, 10, 0, 0, 0); fillFrame(V, F, fr, 0); assert.ok(near(fr.tint[0], VIG.hit * .5)); assert.equal(fr.tint[2], VIG.reach);
  for (let i = 0; i < 30; i++) stepFight(F, idle, 1 / 60); fillFrame(V, F, fr, 1); assert.equal(fr.tint[0], 0);
  F.hp = 20; for (const [t, k] of [[0, 1], [.25, 1 + VIG.pulse], [.75, 1 - VIG.pulse]]) { fillFrame(V, F, fr, t); assert.ok(near(fr.tint[0], VIG.low * k), `${t}`); }
  hurtPlayer(F, 10, 0, 0, 0); fillFrame(V, F, fr, .75); assert.ok(near(fr.tint[0], Math.max(VIG.hit * F.hurtT, VIG.low * (1 - VIG.pulse))));
  F.god = true; F.hurtT = 0; fillFrame(V, F, fr, .25); assert.equal(fr.tint[0], 0); F.god = false;
  F.won = true; F.hurtT = 0; fillFrame(V, F, fr, .25); assert.equal(fr.tint[0], 0); F.won = false; // a won fight below 30 hp shows no rim (pre-flight F6)
  F.ko = { phase: 'call', t: 0 }; F.hurtT = 0; fillFrame(V, F, fr, .25); assert.equal(fr.tint[0], 0); F.ko = null; // nor does Houston's call (Plan 6)
  hurtPlayer(F, 99, 0, 0, 0); fillFrame(V, F, fr, 0); assert.deepEqual([...fr.tint], [VIG.dead, 0, VIG.deadReach]);
  const O = createOpening(W, createFight(W)); stepOpening(O, idle, 1 / 60); fillFrame(V, O.view, fr, .25); assert.equal(fr.tint[0], 0); });
test('the held pole rests low, right of and below the crosshair, and its swing sweeps across the centre (R18)', () => { const F = createFight(W), fr = frame(), p = F.player;
  put(F, F.flag.x + 1, F.flag.z); stepFight(F, { ...idle, use: true }, 1 / 60);
  const tip = () => { fillFrame(V, F, fr, 0); const c = fr.cam, B = cameraBasis(c.yaw, c.pitch), q = xf(fr.view.model, [0, 1.6, 0]), d = [q[0] - c.x, q[1] - c.y, q[2] - c.z], z = dot(d, B.f); return [dot(d, B.r) / z, dot(d, B.u) / z]; };
  F.shotT = 9; const [x, y] = tip(), tan = Math.tan(31 * Math.PI / 180); assert.ok(x > .06 * tan && y < -.06 * tan, `rest ${x} ${y}`); // at least 6% of the half-height off both axes (8 px at 270p)
  let crossed = false; for (let t = 0; t < .3; t += .005) { F.shotT = t; const [sx, sy] = tip(); if (sx < 0 && Math.abs(sy) < .1 * tan) crossed = true; } assert.ok(crossed); });
test('an aiming floater pulses between 0 and .22 at about 6 Hz instead of holding a wash-out flash (M1)', () => { const F = createFight(W), fr = frame(), a = F.aliens.find(x => x.type === 'fl');
  put(F, a.x + 10, a.z); a.state = 'aim'; a.flash = 0; const f = []; for (let i = 0; i < 40; i++) { fillFrame(V, F, fr, i / 240); f.push(fr.meshes.find(m => m.gpu === V.gpu.flBody).flash); }
  assert.ok(Math.min(...f) < .01 && Math.max(...f) > .2 && Math.max(...f) <= .22 + 1e-9); assert.ok(f[0] < .01 && f[20] > .21 && Math.abs(f[10] - .11) < .01); }); // 1/6 s period: trough, quarter, crest
test('dispose frees the uploaded models only', () => { const g2 = fakeGL(), s2 = buildSurfaceScene(g2, W), before = g2.live.size, V2 = createFightView(g2, s2);
  assert.ok(g2.live.size > before); V2.dispose(); assert.equal(g2.live.size, before); });
const r6 = v => Math.round(v * 1e6) / 1e6 + 0;
test('a ceiling decal faces down instead of turning into NaN (carry-over)', () => { const m = tilt(1, 3, 2, 0, -1, 0);
  assert.ok([...m].every(Number.isFinite)); assert.deepEqual(xf(m, [0, 1, 0]).map(r6), [1, 2, 2]); assert.deepEqual(xf(tilt(0, 0, 0, 1, 0, 0), [0, 1, 0]).map(r6), [1, 0, 0]); });
test('a busy frame allocates no Float32Array once warm (carry-over)', () => { const F = createFight(W), fr = frame(), p = F.player; give(F.ars, 0, 0); give(F.ars, 1, 50);
  for (let i = 0; i < 40; i++) F.aliens.push(createAlien({ type: ['sk', 'fl', 'br'][i % 3], x: p.x - 3 - i, y: p.y, z: p.z + 2 }, 500 + i, F.encs[0]));
  for (let i = 0; i < 100; i++) F.bolts.push({ x: p.x + 1 + i, y: p.y + 1.7, z: p.z, vx: 1, vy: 0, vz: 0, dmg: 1, r: .2, life: 9, col: [.3, 1, .8], team: 1, src: 99 });
  for (let i = 0; i < 60; i++) F.decals.push({ x: p.x + i % 8, y: p.y, z: p.z + 3, nx: 0, ny: 1, nz: 0, r: .3, yaw: i, kind: i % 2 ? 'goo' : 'scorch' });
  fillFrame(V, F, fr, 0); const Real = globalThis.Float32Array; let n = 0;
  globalThis.Float32Array = class extends Real { constructor(...a) { super(...a); n++; } };
  try { fillFrame(V, F, fr, 1 / 60); } finally { globalThis.Float32Array = Real; } assert.equal(n, 0); });
test('aliens draw out to 80 m, no further (carry-over)', () => { const F = createFight(W), fr = frame(), a = F.aliens[0], bodies = [V.gpu.skBody, V.gpu.flBody, V.gpu.brBody];
  F.aliens.length = 1; put(F, a.x + 70, a.z); fillFrame(V, F, fr, 0); assert.ok(fr.meshes.some(m => bodies.includes(m.gpu)));
  put(F, a.x + 100, a.z); fillFrame(V, F, fr, 0); assert.ok(!fr.meshes.some(m => bodies.includes(m.gpu))); });
test('sprites fade into the base fog like the world does (carry-over)', () => { const fs = readFileSync('src/gfx/shaders/sprite.frag', 'utf8'), r = readFileSync('src/gfx/renderer.js', 'utf8');
  for (const u of ['uFog', 'uFogD', 'uMode']) { assert.match(fs, new RegExp(`\\b${u}\\b`)); assert.match(r, new RegExp(`P\\.${u}\\b`)); } });
import { buildBaseScene } from '../src/game/baseScene.js'; import { setScene, LIGHT_FADE, MAX_DYN } from '../src/game/fightView.js'; import { tilePath } from './helpers.mjs'; import { PLAYER } from '../src/game/player.js';
const baseFrame = S => ({ ...frame(), sky: S.sky, mode: S.mode, fog: S.fog, fogDensity: S.fogDensity, curv: S.curv, occTex: null });
const MB = W.baseMap;
test('walking the base, no lamp that reaches you is dropped, and lamps that join fade in from dark (Review Focus 4)', () => {
  const g = fakeGL(), S = buildBaseScene(g, MB), Vb = createFightView(g, S), F = createFight(W, 2), fr = baseFrame(S), p = F.player, pts = tilePath(MB, MB.start, MB.commsDoor);
  F.canisters.length = 0; let t = 0, prev = [];
  for (let k = 0; k + 1 < pts.length; k++) for (let s = 0; s < 1; s += .1) {
    p.x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * s; p.z = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * s; p.y = F.lv.ground(p.x, p.z); t += 1 / 60; fillFrame(Vb, F, fr, t);
    const c = fr.cam, sel = [...Vb._sel];
    for (const i of prev) if (!sel.includes(i)) { const L = MB.lights[i]; assert.ok(Math.hypot(c.x - L.x, c.y - L.y, c.z - L.z) >= L.r, `lamp ${i} dropped while it lit you`); }
    for (const i of sel) if (!prev.includes(i)) assert.ok(Vb._w[i] <= LIGHT_FADE / 60 + 1e-6, `lamp ${i} popped in`);
    prev = sel; } });
test('a crowded base fight takes at most 6 slots from the lamps (Review Focus 4)', () => { const g = fakeGL(), S = buildBaseScene(g, MB), Vb = createFightView(g, S), F = createFight(W, 2), fr = baseFrame(S), p = F.player;
  for (let i = 0; i < 300; i++) F.bolts.push({ x: p.x + .1 * i, y: p.y + 1.7, z: p.z, vx: 1, vy: 0, vz: 0, dmg: 1, r: .2, life: 9, col: [.3, 1, .8], team: 1, src: 99 });
  fillFrame(Vb, F, fr, 0); assert.equal(fr.lights.count, 16); assert.ok(Vb._sel.length >= 16 - MAX_DYN);
  MB.lights.forEach((L, i) => { if (Math.hypot(fr.cam.x - L.x, fr.cam.y - L.y, fr.cam.z - L.z) < L.r) assert.ok(Vb._sel.includes(i), `lamp ${i}`); }); });
test('red lamps flicker and the core pulses; steady lamps hold once faded in', () => { const g = fakeGL(), S = buildBaseScene(g, MB), Vb = createFightView(g, S), F = createFight(W, 2), fr = baseFrame(S), p = F.player;
  for (const kind of [0, 1, 2]) { const i = MB.lights.findIndex(l => l.kind === kind), L = MB.lights[i], seen = new Set();
    p.x = L.x; p.z = L.z; p.y = L.y - PLAYER.eye; setScene(Vb, S); // the eye sits in the lamp (the core lamp stands inside solid tiles)
    for (let t = 0; t < 3; t += .05) { fillFrame(Vb, F, fr, t); if (t > .5) seen.add(fr.lights.col[Vb._sel.indexOf(i) * 4].toFixed(3)); }
    assert.equal(seen.size > 1, kind > 0, `kind ${kind}`); } });
test('the flag is not drawn in the base, and golf balls glint', () => { const g = fakeGL(), S = buildBaseScene(g, MB), Vb = createFightView(g, S), F = createFight(W, 2), fr = baseFrame(S);
  fillFrame(Vb, F, fr, 0); assert.ok(!fr.meshes.some(m => m.gpu === Vb.gpu.flag)); const b = F.balls[0]; F.player.x = b.x + 3; F.player.z = b.z;
  let glints = 0; for (let t = 0; t < 2.5; t += .05) { fillFrame(Vb, F, fr, t); if (fr.meshes.some(m => m.gpu === Vb.gpu.golf)) glints += fr.sprites.nGlow > 0; } assert.ok(glints >= 1); });
test('under pressure a lamp that holds you outranks 16 kept by hysteresis, and hysteresis keeps a lit lamp over a nearer one (Review Focus 4)', () => {
  const F = createFight(W, 2), p = F.player, x0 = p.x, y = p.y + PLAYER.eye, at = (x, z, r) => ({ x: x0 + x, y, z: p.z + z, r, col: [1, 1, 1], kind: 0 });
  const lamps = Array.from({ length: 16 }, (_, k) => at(5 * Math.cos(k * Math.PI / 8 + .1), 5 * Math.sin(k * Math.PI / 8 + .1), 4.5)), H = lamps.push(at(7, 0, 6)) - 1;
  const Vs = createFightView(fakeGL(), { meshes: [], lamps }), fr = frame(); F.canisters.length = 0;
  fillFrame(Vs, F, fr, 0); assert.equal(fr.lights.count, 16); assert.ok(!Vs._sel.includes(H)); // 17 within reach: the one 1 m off waits
  p.x = x0 + 1.5; fillFrame(Vs, F, fr, 1 / 60); assert.ok(Vs._sel.includes(H), 'a lamp that holds the camera is lit'); assert.equal(Vs._w[H], 0);
  p.x = x0; fillFrame(Vs, F, fr, 2 / 60); assert.ok(Vs._sel.includes(H), 'kept by hysteresis'); assert.ok(Vs._w[H] > 0);
  for (let i = 0; i < 30; i++) F.bolts.push({ x: x0 + .1 * i, y, z: p.z, vx: 1, vy: 0, vz: 0, dmg: 1, r: .2, life: 9, col: [.3, 1, .8], team: 1, src: 99 });
  fillFrame(Vs, F, fr, 3 / 60); assert.equal(fr.lights.count, 16); assert.equal(Vs._sel.length, 16 - MAX_DYN, 'plasma gets its MAX_DYN slots'); });
test('by the hangar door a crowded surface fight ranks the door lamp first and leaves the bolts their slots (pre-flight F18, R17)', () => { const F = createFight(W, 1), p = F.player, d = W.crater.door;
  put(F, d.x + 3 * d.dx, d.z + 3 * d.dz); F.canisters.length = 0;
  for (let i = 0; i < 300; i++) F.bolts.push({ x: p.x + 1 + i, y: p.y + 1.7, z: p.z, vx: 1, vy: 0, vz: 0, dmg: 1, r: .2, life: 9, col: [.3, 1, .8], team: 1, src: 99 });
  const fr = frame(), L = scene.lamps[0]; fillFrame(V, F, fr, 0); const n = V._sel.length; assert.equal(V._sel[0], 0); assert.ok(n >= 1 && n <= 16 - MAX_DYN); assert.equal(fr.lights.count, 16);
  assert.deepEqual([...fr.lights.pos.slice(0, 4)], [L.x, L.y, L.z, L.r].map(Math.fround)); assert.ok(fr.lights.pos[4 * 15] === Math.fround(p.x + 16 - n)); }); // the lamps (the door's first, then the nearby guides), then the nearest bolts
test('the wreck draws its eleven pieces on the surface without allocating, and none once cleared (opening)', () => { const F = createFight(W), fr = frame(); setWreck(V, settleWreck(W)); put(F, W.spawn.x, W.spawn.z);
  fillFrame(V, F, fr, 0); assert.equal(fr.meshes.filter(m => V.pieces.includes(m.gpu)).length, 11);
  const Real = globalThis.Float32Array; let n = 0; globalThis.Float32Array = class extends Real { constructor(...a) { super(...a); n++; } };
  try { fillFrame(V, F, fr, 1 / 60); } finally { globalThis.Float32Array = Real; } assert.equal(n, 0);
  setWreck(V, null); fillFrame(V, F, fr, 0); assert.equal(fr.meshes.filter(m => V.pieces.includes(m.gpu)).length, 0); });
import { createOpening, stepOpening, OPEN } from '../src/game/opening.js';
test('the opening frame: glitter as small dim gold glows, the dust ring as opaque puffs, the flash in tint[1], the eye override, the cabin light (opening)', () => {
  const F = createFight(W), O = createOpening(W, F), fr = frame(); stepOpening(O, idle, 1 / 60); O.events.length = 0; fillFrame(V, O.view, fr, 0);
  assert.ok(Math.abs(fr.cam.y - (F.player.y + O.view.eye)) < 1e-6);
  assert.ok(fr.lights.count >= 1); assert.equal(fr.tint[1], 0);
  let t = 0; for (let used = false; O.phase !== 'down' && t < 90; t += 1 / 60) { const inp = { ...idle };
    if ((O.phase === 'landed' && O.hatch >= 1) || O.phase === 'egress') inp.fwd = 1; if (O.phase === 'ground' && !used) { inp.use = used = true; } stepOpening(O, inp, 1 / 60); O.events.length = 0; }
  fillFrame(V, O.view, fr, t); assert.equal(fr.tint[1], 1); const D = fr.sprites.data, glows = [];
  for (let i = fr.sprites.nOpaque; i < fr.sprites.nOpaque + fr.sprites.nGlow; i++) glows.push([...D.subarray(i * 8 + 3, i * 8 + 7)]);
  assert.ok(glows.some(([s, r, g, b]) => Math.abs(s - .045) < 1e-6 && r > g && g > b && r <= .9 + 1e-6), 'gold glitter');
  let puffs = 0; for (let i = 0; i < fr.sprites.nOpaque; i++) if (D[i * 8 + 3] >= .35) puffs++; assert.ok(puffs >= 20, 'the dust ring'); });
test('a real fight sets no flash and no eye override (opening)', () => { const F = createFight(W), fr = frame(); fillFrame(V, F, fr, 0);
  assert.equal(fr.tint[1], 0); assert.ok(Math.abs(fr.cam.y - (F.player.y + PLAYER.eye)) < 1e-6); });
test('the starting values of VIG and TAPE_GLINT (Plan 5, pinned once; a hands-on retune changes the table and this pin)', () => {
  assert.deepEqual(VIG, { hit: .6, low: .22, pulse: .35, hz: 1, reach: .4, dead: .8, deadReach: .8 }); assert.deepEqual(TAPE_GLINT, { period: 2.5, on: .15, size: .1 }); });
test('tape lies still on its edge on the ground and glints for .15 s in every 2.5 s (Plan 5)', () => { const F = createFight(W), fr = frame(), q = F.pickups.find(p => p.kind === 'tape');
  put(F, q.x + 4, q.z); const at = t => { fillFrame(V, F, fr, t); return fr.meshes.find(m => m.gpu === V.gpu.tape && Math.hypot(m.model[12] - q.x, m.model[14] - q.z) < 1e-3); };
  const a = [...at(0).model], b = [...at(1.3).model]; assert.deepEqual(a, b); assert.ok(Math.abs(a[13] - (q.y + TAPE_R - .01)) < 1e-5);
  let on = 0; for (let t = 0; t < TAPE_GLINT.period; t += .05) { fillFrame(V, F, fr, t); const D = fr.sprites.data;
    for (let i = fr.sprites.nOpaque; i < fr.sprites.nOpaque + fr.sprites.nGlow; i++) if (Math.hypot(D[i * 8] - q.x, D[i * 8 + 1] - (q.y + 2 * TAPE_R - .03), D[i * 8 + 2] - q.z) < 1e-3) { on++; break; } }
  const want = TAPE_GLINT.on / .05; assert.ok(on >= Math.floor(want) && on <= Math.ceil(want) + 1, `${on}`); }); // derived from the table (pre-flight F1)
