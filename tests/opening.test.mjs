import test from 'node:test'; import assert from 'node:assert/strict'; import { generateWorld } from '../src/gen/world.js'; import { flagSpot } from '../src/gen/surface.js'; import { makeRng } from '../src/gen/rng.js';
import { createFight } from '../src/game/fight.js'; import { PLAYER } from '../src/game/player.js'; import { settleWreck, stepWreck, WRECK } from '../src/game/lander.js';
import { OPEN, EGRESS, FX, createOpening, stepOpening } from '../src/game/opening.js';
const W = generateWorld('APOLLO-4471'), L = W.lander, idle = { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 };
const ahead = Math.atan2(-W.spawn.dx, -W.spawn.dz), wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const fresh = () => { const F = createFight(W); return { F, O: createOpening(W, F) }; };
// Where E plants the flag for player p: OPEN.plant ahead along the view and left of it (R12; left is (-cos yaw, sin yaw)).
const spot = p => { const { ahead: A, left: Lf } = OPEN.plant, s = Math.sin(p.yaw), c = Math.cos(p.yaw); return [p.x - s * A - c * Lf, p.z - c * A + s * Lf]; };
const has = (ev, type, key) => ev.find(e => e.type === type && (key === undefined || e.key === key));
// Steps with one input for secs (or until done), collecting events stamped with O.t.
const hold = (O, inp, secs, dt = 1 / 60, ev = []) => { for (let t = 0; t < secs - 1e-9 && O.phase !== 'done'; t += dt) { stepOpening(O, inp, dt); for (const e of O.events) ev.push({ ...e, t: O.t }); O.events.length = 0; } return ev; };
// A prompt player: waits for the hatch, looks ahead and holds W until on the ground, presses E once, then stands still, until `until` or done.
function prompt(O, F, until = 'done', dtf = () => 1 / 60, ev = []) { let used = false, t = 0;
  while (O.phase !== until && O.phase !== 'done' && t < 90) { const dt = dtf(), inp = { ...idle };
    if ((O.phase === 'landed' && O.hatch >= 1) || O.phase === 'egress') { F.player.yaw = ahead; inp.fwd = 1; }
    if (O.phase === 'ground' && !O.planted && !used) { inp.use = true; used = true; }
    stepOpening(O, inp, dt); for (const e of O.events) ev.push({ ...e, t: O.t }); O.events.length = 0; t += dt; }
  return ev; }
test('the opening starts in the cabin OPEN.alt up, the flag hidden, the engine on (opening)', () => { const { F, O } = fresh(), p = F.player;
  assert.equal(O.phase, 'descent'); assert.ok(Math.abs(p.y - (L.y + OPEN.alt + EGRESS[0][1])) < 1e-9); assert.ok(flat(p, L) < .5); assert.equal(F.flag.held, true);
  assert.equal(O.view.eye, EGRESS[0][3]); assert.equal(O.wreck.lift, OPEN.alt); assert.ok(has(hold(O, idle, 1 / 60), 'sfx', 'engine')); });
test('touchdown at OPEN.descent with Contact light; OPEN.hatch later the hatch swings open with the climb-out prompt (opening)', () => {
  const { F, O } = fresh(), ev = hold(O, idle, OPEN.descent + OPEN.hatch + OPEN.hatchT + .1), td = has(ev, 'radio', 'touchdown');
  assert.ok(td && Math.abs(td.t - OPEN.descent) <= 1 / 60 + 1e-9); assert.ok(has(ev, 'sfx', 'land') && has(ev, 'sfx', 'hatch')); assert.equal(O.wreck.lift, 0);
  assert.ok(Math.abs(F.player.y - (L.y + EGRESS[0][1])) < 1e-9); assert.deepEqual([O.phase, O.hatch, O.prompt], ['landed', 1, '[W] climb out']);
  assert.equal(O.wreck.hatch, 1, 'the door swings open on screen too (pre-flight F7)'); });
test('you can move the whole time except during the OPEN.down s knock-down (opening)', () => {
  for (const phase of ['descent', 'landed', 'egress', 'ground', 'company', 'down', 'up']) { const a = fresh(), b = fresh();
    prompt(a.O, a.F, phase); prompt(b.O, b.F, phase); assert.equal(a.O.phase, phase); a.F.player.yaw = b.F.player.yaw = ahead;
    hold(a.O, { ...idle, fwd: 1 }, .1); hold(b.O, idle, .1); const d = Math.hypot(a.F.player.x - b.F.player.x, a.F.player.y - b.F.player.y, a.F.player.z - b.F.player.z);
    if (phase === 'down') { assert.equal(d, 0); assert.equal(a.O.lock, true); } else { assert.ok(d > .01, `${phase}: W moved you ${d}`); assert.equal(a.O.lock, false); } } });
test('W carries you out: crawl through the hatch, stand on the porch, down the ladder, boot on the dust; S takes you back (opening)', () => {
  const { F, O } = fresh(), p = F.player; hold(O, idle, OPEN.descent + OPEN.hatch + OPEN.hatchT + .05); p.yaw = ahead;
  const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), crawl = (len(EGRESS[0], EGRESS[1]) + len(EGRESS[1], EGRESS[2])) / OPEN.crawl, climb = len(EGRESS[2], EGRESS[3]) / OPEN.climb;
  hold(O, { ...idle, fwd: 1 }, 1); assert.equal(O.phase, 'egress'); const d1 = flat(p, L); hold(O, { ...idle, fwd: -1 }, .3); assert.ok(flat(p, L) < d1, 'S backs you up');
  const ev = []; let eye = 9, t = 0; while (O.phase === 'egress' && t < 10) { hold(O, { ...idle, fwd: 1 }, 1 / 60, 1 / 60, ev); eye = Math.min(eye, O.view.eye); t += 1 / 60; }
  assert.equal(O.phase, 'ground'); assert.ok(t <= crawl + climb + .1, `${t}`); assert.ok(eye <= EGRESS[1][3] + .02, 'you crawl through the hatch');
  assert.ok(Math.abs(flat(p, L) - EGRESS[3][2]) < .05); assert.ok(Math.abs(p.y - F.lv.ground(p.x, p.z)) < 1e-6); assert.equal(O.view.eye, PLAYER.eye);
  assert.ok(has(ev, 'radio', 'step') && has(ev, 'sfx', 'step')); assert.equal(O.prompt, '[E] plant the flag'); });
test('E plants the flag OPEN.plant ahead and left of your view within range (R12); out of range Houston nags at OPEN.nag and plants it at the flag spot at OPEN.auto (opening)', () => {
  let { F, O } = fresh(), p = F.player; prompt(O, F, 'ground'); const ev = hold(O, { ...idle, use: true }, 1 / 60);
  assert.ok(O.planted && has(ev, 'radio', 'planted')); assert.equal(F.flag.held, false); assert.equal(O.prompt, '');
  const [fx, fz] = spot(p); assert.ok(Math.abs(F.flag.x - fx) < 1e-9 && Math.abs(F.flag.z - fz) < 1e-9); assert.equal(F.flag.y, F.lv.ground(F.flag.x, F.flag.z));
  ({ F, O } = fresh()); p = F.player; prompt(O, F, 'ground'); const t0 = O.t; p.yaw = ahead; const e2 = hold(O, { ...idle, fwd: 1, run: true }, 2.2);
  assert.ok(flat(p, L) > OPEN.near); hold(O, { ...idle, use: true }, .1, 1 / 60, e2); assert.equal(O.planted, false); assert.equal(O.prompt, '');
  hold(O, idle, OPEN.auto + .2 - (O.t - t0), 1 / 60, e2); const nag = has(e2, 'radio', 'nag'), auto = has(e2, 'radio', 'autoplant'), f = flagSpot(W);
  assert.ok(nag && Math.abs(nag.t - t0 - OPEN.nag) <= 1 / 30); assert.ok(auto && Math.abs(auto.t - t0 - OPEN.auto) <= 1 / 30);
  assert.ok(O.planted && Math.abs(F.flag.x - f.x) < 1e-9 && Math.abs(F.flag.z - f.z) < 1e-9); });
test('company: three aliens rise down the route and the brute waves; three bolts streak into the cabin; then the silent blast with its flash, thud, glitter, dust ring and wreck (opening)', () => {
  const { F, O } = fresh(), ev = prompt(O, F, 'company'), cT = O.t, br = O.view.aliens[1];
  assert.deepEqual(O.view.aliens.map(a => a.type), OPEN.aliens.types); for (const a of O.view.aliens) assert.ok(Math.abs(flat(a, L) - OPEN.aliens.d) <= OPEN.aliens.side + 1);
  hold(O, idle, OPEN.wave + .6, 1 / 60, ev); assert.ok(br.wave > .5, 'the brute waves'); hold(O, idle, cT + OPEN.fire + .1 - O.t, 1 / 60, ev); assert.equal(O.view.bolts.length, 3);
  for (const b of O.view.bolts) { const dx = L.x - b.x, dy = L.y + 3.25 - b.y, dz = L.z - b.z; assert.ok((dx * b.vx + dy * b.vy + dz * b.vz) / (Math.hypot(dx, dy, dz) * Math.hypot(b.vx, b.vy, b.vz)) > .999); }
  hold(O, idle, OPEN.flight, 1 / 60, ev); const bl = has(ev, 'sfx', 'thud'), co = has(ev, 'radio', 'company');
  assert.ok(co && Math.abs(co.t - cT - OPEN.line) <= 1 / 30); assert.ok(bl && Math.abs(bl.t - cT - OPEN.fire - OPEN.flight) <= 1 / 30); assert.ok(has(ev, 'wreck') && O.wreck.blown);
  assert.deepEqual([O.phase, O.flash, O.view.bolts.length], ['down', 1, 0]); const n = k => O.view.parts.filter(q => q.kind === k).length; assert.ok(n('foil') >= 100 && n('puff') >= 40); });
test('the knock-down: the eye drops and turns toward Earth; then you get up, and OPEN.title s after the blast the title drops and the opening is done (opening)', () => {
  const { F, O } = fresh(), p = F.player, ev = prompt(O, F, 'down'), bT = O.t; hold(O, idle, OPEN.down - .05, 1 / 60, ev);
  assert.equal(O.phase, 'down'); assert.ok(Math.abs(wrap(p.yaw - ahead)) < .2 && Math.abs(p.pitch - OPEN.look) < .2); assert.ok(Math.abs(O.view.eye - OPEN.downEye) < 1e-9);
  hold(O, idle, .1, 1 / 60, ev); assert.deepEqual([O.phase, O.lock], ['up', false]); hold(O, idle, OPEN.getUp + .05, 1 / 60, ev); assert.equal(O.view.eye, PLAYER.eye);
  hold(O, idle, OPEN.title, 1 / 60, ev); const tel = has(ev, 'radio', 'telemetry'), ti = has(ev, 'title'), rt = has(ev, 'radio', 'title');
  assert.ok(tel && Math.abs(tel.t - bT - OPEN.tele) <= 1 / 30); assert.ok(ti && rt && Math.abs(ti.t - bT - OPEN.title) <= 1 / 30 && rt.t === ti.t);
  assert.ok(has(ev, 'sfx', 'stamp') && has(ev, 'done')); assert.equal(O.phase, 'done');
  assert.ok(F.parts.some(q => q.kind === 'foil') && F.parts.length <= 300, 'the glitter carries over into play (pre-flight F6)'); });
test('a prompt player is through in under 45 s; the same frame times replay it exactly; its wreck settles where settleWreck says (opening)', () => {
  const r = makeRng('odt'), dts = Array.from({ length: 6000 }, () => r.range(1 / 144, 1 / 18)), go = () => { const { F, O } = fresh(); let i = 0; prompt(O, F, 'done', () => dts[i++]); return { F, O }; };
  const a = go(), b = go(), s = w => JSON.stringify(w.pieces.map(q => [q.x, q.y, q.z, q.yaw, q.pitch, q.roll])); assert.equal(a.O.phase, 'done'); assert.ok(a.O.t < 45, `${a.O.t}`);
  assert.equal(JSON.stringify([a.O.t, a.F.player, a.F.flag, a.O.view.parts]), JSON.stringify([b.O.t, b.F.player, b.F.flag, b.O.view.parts])); assert.equal(s(a.O.wreck), s(b.O.wreck));
  for (let t = 0; t < WRECK.settle; t += 1 / 30) stepWreck(a.O.wreck, 1 / 30); assert.equal(s(a.O.wreck), s(settleWreck(W))); });
test('the beats keep time at 20, 60 and 144 fps: the same cues in the same order, each within two 20 fps frames, and the flag in the same spot (opening)', () => {
  const run = fps => { const { F, O } = fresh(); return { F, ev: prompt(O, F, 'done', () => 1 / fps) }; }, [a, b, c] = [20, 60, 144].map(run), cue = e => e.type + ':' + e.key;
  assert.equal(b.ev.length, 15); assert.equal(cue(b.ev.at(-1)), 'done:undefined');
  for (const r of [a, c]) { assert.deepEqual(r.ev.map(cue), b.ev.map(cue)); r.ev.forEach((e, i) => assert.ok(Math.abs(e.t - b.ev[i].t) <= 2 / 20 + 1e-9, `${cue(e)} at ${e.t}, ${b.ev[i].t} at 60 fps`));
    assert.ok(Math.abs(r.F.flag.x - b.F.flag.x) < 1e-9 && Math.abs(r.F.flag.z - b.F.flag.z) < 1e-9); } });
test('the descent: the plume and cabin lights; under OPEN.dust m the dust flies clean airless arcs at F.gravity and lies where it lands (opening)', () => {
  const { F, O } = fresh(), s = () => O.view.glow.map(o => o.s).join(); hold(O, idle, 4.5); assert.equal(s(), '9,2.2'); assert.ok(O.wreck.lift > OPEN.dust);
  assert.equal(O.view.parts.filter(q => q.kind === 'dust').length, 0); hold(O, idle, 3.5); const q = O.view.parts.findLast(q => q.kind === 'dust'), v = { ...q };
  hold(O, idle, .25); assert.deepEqual([q.vx, q.vz], [v.vx, v.vz]); assert.ok(Math.abs(q.vy - (v.vy - F.gravity * .25)) < 1e-9 && Math.abs(q.x - (v.x + v.vx * .25)) < 1e-9);
  assert.ok(Math.abs(q.y - (v.y + v.vy * .25 - F.gravity * .25 * .25 / 2)) < 1e-9); for (let k = 0; k < 300 && q.vx === v.vx; k++) hold(O, idle, 1 / 60);
  assert.deepEqual([q.vx, q.vy, q.vz, q.y], [0, 0, 0, F.lv.ground(q.x, q.z)]); assert.ok(q.life > 0, 'it lands before it fades'); assert.equal(O.phase, 'landed'); assert.equal(s(), '2.2'); prompt(O, F, 'ground'); assert.equal(s(), ''); });
test('the glitter handed on to play lies on or over the ground, none of it inside the lander\'s footing (opening, pre-flight F6)', () => {
  const { F, O } = fresh(), under = q => q.y < F.lv.ground(q.x, q.z); prompt(O, F); assert.ok(O.view.parts.some(q => q.kind === 'foil' && under(q)), 'some foil fell into the cabin column');
  assert.ok(F.parts.length >= 100 && !F.parts.some(under)); });
// R10: the drawn terrain at (x, z): the mesh's triangle there (each quad split from its (i, j) corner to (i + 1, j + 1)).
const drawn = (x, z) => { const gx = x + W.half, gz = z + W.half, i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, h = (a, b) => W.h[(j + b) * W.N + i + a];
  return fz >= fx ? h(0, 0) + (h(1, 1) - h(0, 1)) * fx + (h(0, 1) - h(0, 0)) * fz : h(0, 0) + (h(1, 0) - h(0, 0)) * fx + (h(1, 1) - h(1, 0)) * fz; };
test('the blast\'s glitter thins out: each speck\'s life is drawn from FX.foil.life, the expiries spread over 3 s or more (opening, R10)', () => {
  const { F, O } = fresh(); prompt(O, F, 'down'); const L9 = O.view.parts.filter(q => q.kind === 'foil').map(q => q.life), [lo, hi] = FX.foil.life;
  assert.equal(L9.length, FX.foil.n); assert.ok(L9.every(l => l >= lo && l <= hi)); assert.ok(Math.max(...L9) - Math.min(...L9) >= 3, `${Math.min(...L9)}-${Math.max(...L9)}`);
  assert.ok(Math.abs(L9.reduce((a, b) => a + b) / L9.length - (lo + hi) / 2) < .5); });
test('the floater comes down to the ground before it goes, never vanishing in mid-air (opening, R10)', () => {
  const { F, O } = fresh(); prompt(O, F, 'company'); const fl = O.view.aliens.find(a => a.type === 'fl'); prompt(O, F, 'down');
  while (O.view.aliens.includes(fl) && O.phase !== 'done') hold(O, idle, 1 / 60); assert.notEqual(O.phase, 'done', 'it goes before the title drop');
  assert.ok(Math.abs(fl.y - F.lv.ground(fl.x, fl.z)) <= .05, `${fl.y - F.lv.ground(fl.x, fl.z)} m up when it went`); });
test('a flag planted 3.5 m out, facing the lander, stands on the drawn ground, not on the deck\'s collision ramp (opening, R10)', () => {
  const { F, O } = fresh(), p = F.player; prompt(O, F, 'ground'); const u = [W.spawn.dx, W.spawn.dz], d = OPEN.far + 1e-6;
  p.x = L.x + u[0] * d; p.z = L.z + u[1] * d; p.y = F.lv.ground(p.x, p.z); p.yaw = Math.atan2(u[0], u[1]); hold(O, { ...idle, use: true }, 1 / 60);
  const [fx, fz] = spot(p); assert.ok(O.planted && Math.abs(F.flag.x - fx) < 1e-9 && Math.abs(F.flag.z - fz) < 1e-9 && flat(F.flag, L) < OPEN.far - .5); assert.ok(F.lv.ground(F.flag.x, F.flag.z) - drawn(F.flag.x, F.flag.z) > .1, 'the ramp is there');
  assert.ok(Math.abs(F.flag.y - drawn(F.flag.x, F.flag.z)) <= .05, `${F.flag.y - drawn(F.flag.x, F.flag.z)} m off the ground`); });
// R11: the plan's unvoiced radio queue (Task 11: RADIO key .25, gap .5, min 1.6, cps 14; story lines first in, first out, each keying
// on once the one before has unkeyed and gapped) over the opening's SCRIPT lines (the nag at its longest). Each is {key, talk, end}.
const RQ = { key: .25, gap: .5, min: 1.6, cps: 14 }, SAY = { touchdown: ['Contact light. Engine stop.', "We copy, you're down. Beautiful work."],
  step: ["Okay Houston, I'm stepping off the—"], nag: ["Whenever you're ready with that flag. No pressure. Just the whole planet watching."],
  autoplant: ["We're going to count that as planted."], planted: ['Flag is up. It looks great on the telemetry.'], company: ['…Houston, are we expecting anyone?'],
  telemetry: ['…say again? We just lost all telemetry from the lander.'], title: ['Houston… we have one small problem.'] };
const radio = ev => { let free = 0; const out = []; for (const e of ev) if (e.type === 'radio') for (const s of SAY[e.key]) {
  const talk = Math.max(free, e.t) + RQ.key, end = talk + Math.max(RQ.min, s.length / RQ.cps); out.push({ key: e.key, talk, end }); free = end + RQ.key + RQ.gap; } return out; };
test('the radio keeps the storyboard\'s order: each line is spoken before its beat, and the title line on the stamp (opening, R11)', () => {
  for (const plants of [true, false]) { // a prompt planter, and one who never presses E (nag, then autoplant)
    const { F, O } = fresh(), ev = prompt(O, F, 'ground'); if (plants) hold(O, { ...idle, use: true }, 1 / 60, 1 / 60, ev);
    while (O.phase !== 'company') hold(O, idle, 1 / 60, 1 / 60, ev); const rise = O.t; hold(O, idle, 60, 1 / 60, ev);
    const R = radio(ev), at = k => R.find(l => l.key === k).talk, when = type => has(ev, type).t, story = plants ? ['step', 'planted'] : ['step', 'nag', 'autoplant'];
    assert.deepEqual(R.map(l => l.key), ['touchdown', 'touchdown', ...story, 'company', 'telemetry', 'title']);
    assert.ok(R[1].end < at('step'), 'down and copied before the first step');
    for (const k of story) assert.ok(at(k) < rise, `${k} before the aliens rise (${at(k).toFixed(2)} vs ${rise.toFixed(2)})`);
    assert.ok(at('company') < when('wreck'), `"expecting anyone?" before the blast (${at('company').toFixed(2)} vs ${when('wreck').toFixed(2)})`);
    assert.ok(at('telemetry') < when('title'), `the telemetry line before the title drop (${at('telemetry').toFixed(2)} vs ${when('title').toFixed(2)})`);
    assert.ok(Math.abs(at('title') - when('title')) <= 1.5, `"one small problem" on the stamp (${at('title').toFixed(2)} vs ${when('title').toFixed(2)})`); } });
// R12: does the segment from e to q cross the flag cloth's box (props.js buildFlag: .9 m along world +x from the pole, 1.42-2.02 m
// up, .024 m thick), grown by pad on every side?
import { seedName } from '../src/gen/rng.js'; import { worldSpheres } from '../src/game/rigs.js'; import { cameraBasis } from '../src/gfx/math.js';
const crossesCloth = (e, q, f, pad = .05) => { const lo = [f.x - pad, f.y + 1.42 - pad, f.z - .012 - pad], hi = [f.x + .9 + pad, f.y + 2.02 + pad, f.z + .012 + pad]; let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) { const d = q[i] - e[i]; if (Math.abs(d) < 1e-12) { if (e[i] < lo[i] || e[i] > hi[i]) return false; continue; }
    const a = (lo[i] - e[i]) / d, b = (hi[i] - e[i]) / d; t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b)); if (t0 > t1) return false; }
  return true; };
test('planting at the prompt, the waving brute is in view and no sight line to it crosses the flag\'s cloth, on 24 seeds, mouse untouched or looking down the route (opening, R12)', () => {
  const tan = Math.tan(31 * Math.PI / 180);
  for (let k = 0; k < 24; k++) { const seed = k ? seedName(makeRng('R12/' + k)) : 'APOLLO-4471', w = generateWorld(seed), route = Math.atan2(-w.spawn.dx, -w.spawn.dz);
    for (const look of [null, route]) { const F = createFight(w), O = createOpening(w, F), p = F.player, how = `${seed}, ${look === null ? 'mouse untouched' : 'looking down the route'}`; let used = false;
      while (O.phase !== 'company' && O.t < 90) { const inp = { ...idle };
        if ((O.phase === 'landed' && O.hatch >= 1) || O.phase === 'egress') { if (look !== null) p.yaw = look; inp.fwd = 1; }
        if (O.phase === 'ground' && !O.planted && !used) inp.use = used = true;
        stepOpening(O, inp, 1 / 60); O.events.length = 0; }
      const ev = hold(O, idle, OPEN.wave + .6), br = O.view.aliens.find(a => a.type === 'br'), e = [p.x, p.y + O.view.eye, p.z], B = cameraBasis(p.yaw, p.pitch);
      assert.ok(used && !has(ev, 'radio', 'autoplant') && br.wave > .5, `${how}: planted at the prompt, and the brute waves`);
      for (const s of worldSpheres(br)) { const d = [s[0] - e[0], s[1] - e[1], s[2] - e[2]], z = d[0] * B.f[0] + d[1] * B.f[1] + d[2] * B.f[2];
        const sx = (d[0] * B.r[0] + d[1] * B.r[1] + d[2] * B.r[2]) / z / (tan * 16 / 9), sy = (d[0] * B.u[0] + d[1] * B.u[1] + d[2] * B.u[2]) / z / tan;
        assert.ok(z > 0 && Math.abs(sx) < .9 && Math.abs(sy) < .9, `${how}: the brute is in a 16:9 view (${sx.toFixed(2)}, ${sy.toFixed(2)})`);
        assert.ok(!crossesCloth(e, s, F.flag), `${how}: the cloth hides the brute`); } } } });
