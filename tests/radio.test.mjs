import test from 'node:test'; import assert from 'node:assert/strict'; import { makeRng } from '../src/gen/rng.js';
import { SCRIPT, CUES, WHO, VOICE } from '../src/game/script.js'; import { RADIO, createRadio, radioCue, radioEvents, stepRadio, radioDone, pauseRadio, radioIdle, silence } from '../src/game/radio.js'; import { KO } from '../src/game/escape.js';
const R0 = () => createRadio(makeRng('r')), always = { next: () => 0, int: () => 0, range: a => a };
const run = (R, secs, voiced = false, dawdle = false, dt = 1 / 60, out = []) => { for (let t = 0; t < secs - 1e-9; t += dt) for (const a of stepRadio(R, dt, voiced, dawdle)) out.push({ ...a, t: R.clock }); return out; };
const said = A => A.filter(a => a.do === 'key').map(a => a.line.who + '|' + a.line.text);
const keyOf = (ev, f = {}) => { const R = createRadio(always); radioEvents(R, ev, { kills: 2, hp: 100, state: 'play', ...f }); return R.q.map(l => l.key).join(); };
test('the script: 150 to 205 short lines "X|text" with known speakers, every cue scripted, and the spec\'s lines verbatim (radio)', () => {
  const all = Object.values(SCRIPT).flat(); assert.ok(all.length >= 150 && all.length <= 205, `${all.length}`); for (const l of all) assert.match(l, /^[HYS]\|.{2,90}$/);
  assert.deepEqual(Object.keys(SCRIPT).sort(), Object.keys(CUES).sort()); assert.deepEqual(Object.keys(WHO).sort(), ['H', 'S', 'Y']); for (const k in WHO) assert.equal(VOICE[k].length, 2);
  assert.equal(SCRIPT.golf.length, 5); assert.deepEqual(SCRIPT.touchdown, ['Y|Contact light. Engine stop.', "H|We copy, you're down. Beautiful work."]);
  assert.deepEqual(SCRIPT.step, ["Y|Okay Houston, I'm stepping off the\u2014"]); assert.deepEqual(SCRIPT.company, ['Y|\u2026Houston, are we expecting anyone?']);
  assert.deepEqual(SCRIPT.telemetry, ['H|\u2026say again? We just lost all telemetry from the lander.']); assert.deepEqual(SCRIPT.title, ['Y|Houston\u2026 we have one small problem.']);
  assert.deepEqual(SCRIPT.houston, ['H|Houston, go ahead.', 'Y|Houston\u2026 we have one small problem.']);
  assert.deepEqual(SCRIPT.rescue, ['H|Copy. We heard. Rescue vehicle is go, touchdown at your lander in twenty min\u2014']); });
test('a story cue plays every line in order: keyed up, spoken, keyed down, a gap, then the next (radio)', () => {
  const R = R0(); assert.ok(radioCue(R, 'touchdown')); const A = run(R, 20), keys = A.filter(a => a.do === 'key'); assert.deepEqual(said(A), SCRIPT.touchdown);
  assert.deepEqual(A.slice(0, 4).map(a => a.do), ['key', 'say', 'unkey', 'off']); assert.ok(Math.abs(A[1].t - A[0].t - RADIO.key) <= 1 / 60 + 1e-9);
  assert.ok(Math.abs(A[3].t - A[2].t - RADIO.key) <= 1 / 60 + 1e-9); assert.ok(keys[1].t - A[3].t >= RADIO.gap - 1e-9); assert.ok(radioIdle(R)); });
test('without a voice each line shows for max(RADIO.min, chars / RADIO.cps) (Review Focus 1)', () => { const R = R0(); radioCue(R, 'houston'); radioCue(R, 'telemetry');
  const A = run(R, 30), say = A.filter(a => a.do === 'say'), un = A.filter(a => a.do === 'unkey'); assert.equal(say.length, 3);
  say.forEach((s, i) => { assert.equal(s.line.voiced, false); assert.ok(Math.abs(un[i].t - s.t - Math.max(RADIO.min, s.line.text.length / RADIO.cps)) <= 1 / 60 + 1e-9, s.line.text); }); });
test('a voiced line ends at onend but not before RADIO.min, or by the fallback when onend never comes (Review Focus 1)', () => {
  let R = R0(); radioCue(R, 'telemetry'); let A = run(R, RADIO.key + .5, true); const s = A.find(a => a.do === 'say'); radioDone(R, s.line.id); run(R, 1.5, true, false, 1 / 60, A);
  assert.ok(Math.abs(A.find(a => a.do === 'unkey').t - s.t - RADIO.min) <= 1 / 60 + 1e-9);
  R = R0(); radioCue(R, 'telemetry'); A = run(R, 30, true); const s2 = A.find(a => a.do === 'say'), u2 = A.find(a => a.do === 'unkey');
  assert.ok(Math.abs(u2.t - s2.t - (RADIO.slack * s2.line.text.length / RADIO.cps + RADIO.pad)) <= 1 / 60 + 1e-9); assert.ok(radioIdle(R)); });
test('a stale onend from an earlier line never ends the current one (radio)', () => { const R = R0(); radioCue(R, 'houston'); const A = run(R, RADIO.key + .1, true), first = A.find(a => a.do === 'say').line;
  radioDone(R, first.id); run(R, 5, true, false, 1 / 60, A); assert.equal(A.filter(a => a.do === 'say').length, 2); radioDone(R, first.id);
  assert.equal(run(R, RADIO.min + .5, true).filter(a => a.do === 'unkey').length, 0, 'still talking'); });
test('reactions: once-only, cooldowns and chances; the newest waiting reaction wins; story lines go first and a reaction behind them goes stale (radio)', () => {
  const R = R0(); assert.equal(radioCue(R, 'grab'), true); run(R, 10); assert.equal(radioCue(R, 'grab'), false, 'once');
  assert.equal(radioCue(R, 'low'), true); run(R, 10); assert.equal(radioCue(R, 'low'), false, 'cooling down'); run(R, CUES.low.cool); assert.equal(radioCue(R, 'low'), true); run(R, 10);
  radioCue(R, 'crater'); radioCue(R, 'base'); let w = said(run(R, 10)); assert.equal(w.length, 1); assert.ok(SCRIPT.base.includes(w[0]), 'the newest waiting reaction wins');
  radioCue(R, 'comms'); radioCue(R, 'touchdown'); w = said(run(R, 20)); assert.deepEqual(w, SCRIPT.touchdown, 'the story first; the reaction behind it went stale');
  let n = 0; for (let i = 0; i < 200; i++) { R.clock += CUES.kill.cool + 1; if (radioCue(R, 'kill')) n++; } assert.ok(n > 20 && n < 60, `kill cue chance: ${n}/200`); });
test('fight events map to cues (radio)', () => {
  assert.equal(keyOf([{ type: 'kill', kind: 'sk', n: 1 }]), 'first'); /* pre-flight F25: the event's n, not F.kills */ assert.equal(keyOf([{ type: 'kill', kind: 'br' }]), 'brute'); assert.equal(keyOf([{ type: 'kill', kind: 'fl' }]), 'floater');
  assert.equal(keyOf([{ type: 'kill', kind: 'sk' }]), 'kill'); assert.equal(keyOf([1, 2, 3].map(() => ({ type: 'kill', kind: 'sk' }))), 'multi');
  assert.equal(keyOf([{ type: 'hurt' }], { hp: 20 }), 'low'); assert.equal(keyOf([{ type: 'hurt' }], { hp: 80 }), ''); assert.equal(keyOf([{ type: 'hurt', cause: 'fall' }], { hp: 20 }), 'fall');
  for (const id of ['crater', 'base', 'comms']) assert.equal(keyOf([{ type: 'area', id }]), id); assert.equal(keyOf([{ type: 'area', id: 'surface' }]), '');
  for (const [type, key] of [['dead', 'dead'], ['restart', 'restart'], ['flag', 'grab'], ['boom', 'boom'], ['holdmsg', 'holding']]) assert.equal(keyOf([{ type }]), key);
  for (const kind of ['pistol', 'scatter', 'tape', 'cells']) assert.equal(keyOf([{ type: 'pickup', kind }]), kind);
  assert.equal(keyOf([{ type: 'hold' }]), 'hold,hold,hold'); assert.equal(keyOf([{ type: 'houston' }]), 'houston,houston,rescue');
  const R = createRadio(always); radioEvents(R, [{ type: 'golf', n: 3 }], { kills: 0, hp: 100, state: 'play' }); assert.equal('H|' + R.q[0].text, SCRIPT.golf[2]); });
test('dawdling: RADIO.dawdle s with no progress cues a dawdle line, only while counting (radio)', () => { const R = R0(), F = { kills: 0, hp: 100, state: 'play' };
  assert.equal(said(run(R, RADIO.dawdle - 1, false, true)).length, 0); radioEvents(R, [{ type: 'area', id: 'surface' }], F);
  assert.equal(said(run(R, RADIO.dawdle - 1, false, true)).length, 0, 'progress restarts the clock'); const w = said(run(R, 12, false, true));
  assert.equal(w.length, 1); assert.ok(SCRIPT.dawdle.includes(w[0])); assert.equal(said(run(R0(), RADIO.dawdle + 5)).length, 0); });
test('pausing replays an interrupted story line from its start and drops an interrupted reaction (Review Focus 3)', () => {
  const R = R0(); radioCue(R, 'telemetry'); run(R, RADIO.key + 1); assert.deepEqual(pauseRadio(R).map(a => a.do), ['off']); assert.deepEqual(said(run(R, 10)), SCRIPT.telemetry);
  const Q = R0(); radioCue(Q, 'base'); run(Q, RADIO.key + .5); pauseRadio(Q); assert.equal(said(run(Q, 10)).length, 0); assert.ok(radioIdle(Q)); });
test('radioIdle is true only with nothing playing or waiting; the same rng and cues give the same lines (radio)', () => {
  const R = R0(); assert.ok(radioIdle(R)); radioCue(R, 'houston'); assert.ok(!radioIdle(R)); run(R, 15); assert.ok(radioIdle(R));
  const go = () => { const Q = createRadio(makeRng('same')), A = []; for (const k of ['crater', 'dead', 'tape', 'kill', 'dawdle', 'holding', 'holding']) { radioCue(Q, k); run(Q, 12, false, false, 1 / 60, A); } return said(A); };
  assert.deepEqual(go(), go()); });
test('a pause as a line keys down just ends it; a replayed story line ignores the onend of the utterance the pause cancelled (Review Focus 3)', () => {
  const R = R0(); radioCue(R, 'houston'); const first = run(R, RADIO.key + .1, true).find(a => a.do === 'say').line; pauseRadio(R);
  const again = run(R, RADIO.key + .1, true).find(a => a.do === 'say').line; radioDone(R, first.id); // the cancelled utterance's onend, arriving late
  assert.equal(again.text, first.text); assert.notEqual(again.id, first.id);
  assert.equal(run(R, RADIO.min + .5, true).filter(a => a.do === 'unkey').length, 0, 'the replay is still talking');
  const Q = R0(); radioCue(Q, 'telemetry'); while (Q.phase !== 'unkey') stepRadio(Q, 1 / 60, false, false);
  assert.deepEqual(pauseRadio(Q).map(a => a.do), ['off']); assert.ok(radioIdle(Q)); assert.equal(said(run(Q, 10)).length, 0, 'not replayed'); });
test('an at cue with no such line is refused (radio)', () => { const R = R0(); assert.equal(radioCue(R, 'golf', SCRIPT.golf.length + 1), false); assert.equal(radioCue(R, 'golf', 0), false); assert.equal(R.q.length, 0); });
import { dawdling } from '../src/game/radio.js';
test('the dawdle clock runs only in play, never on hold, in Houston\'s call or once boarded (R16, moved in Plan 6)', () => { const F = { hold: null, won: false };
  assert.equal(dawdling('play', F), true); for (const s of ['title', 'opening', 'end']) assert.equal(dawdling(s, F), false, s);
  assert.equal(dawdling('play', { ...F, hold: { t: 3 } }), false, 'on hold'); assert.equal(dawdling('play', { ...F, won: true }), false, 'boarded');
  assert.equal(dawdling('play', { ...F, ko: { phase: 'call' } }), false); });
// R18 (a): once Houston has picked up (F.ko), the fight's events cue nothing but Houston, so no reaction steps on the punchline
test('after Houston picks up, a pickup, a kill, a hurt or a golf ball queues nothing; Houston itself still queues (R18)', () => {
  const F = { ko: { phase: 'call', t: 0 }, won: false, hp: 10, state: 'play' }, ev = [{ type: 'pickup', kind: 'tape' }, { type: 'kill', kind: 'br', n: 9 }, { type: 'kill', kind: 'sk', n: 1 }, { type: 'hurt' }, { type: 'golf', n: 2 }, { type: 'boom' }];
  let R = createRadio(always); radioEvents(R, ev, F); assert.deepEqual(R.q, []);
  R = createRadio(always); radioEvents(R, [{ type: 'houston' }, ...ev], F); assert.deepEqual(R.q.map(l => l.key), ['houston', 'houston', 'rescue']); });
// R18 (b): Houston picking up cuts a reaction on the air, so the punchline never waits behind it (a voice whose onend never comes
// would hold a reaction for its whole fallback); a story line on the air plays on, and with nothing on the air there is nothing to cut
import { cutReaction } from '../src/game/radio.js'; import { ENDING, endingOver } from '../src/game/hold.js';
const CALL = { ko: { phase: 'call', t: 0 }, won: false, hp: 100, state: 'play' }, PUNCH = SCRIPT.houston[1].slice(2);
test('Houston picking up cuts a reaction on the air, keyed, talking or keying down, and the Houston pair keys within .6 s; a story line plays on (R18)', () => {
  for (const voiced of [true, false]) for (const phase of ['key', 'talk', 'unkey']) {
    const R = createRadio(always); radioCue(R, 'low'); while (R.phase !== phase) stepRadio(R, 1 / 60, voiced, false); assert.equal(R.cur.key, 'low');
    radioEvents(R, [{ type: 'houston' }], CALL); const c0 = R.clock; assert.deepEqual(cutReaction(R).map(a => a.do), ['off'], phase); assert.equal(R.cur, null);
    const k = run(R, 1, voiced).find(a => a.do === 'key'); assert.equal(k.line.text, SCRIPT.houston[0].slice(2)); assert.ok(k.t - c0 <= .6, `${phase}: keyed ${(k.t - c0).toFixed(3)} s after`); }
  const Q = createRadio(always); radioCue(Q, 'hold'); run(Q, .5, true); radioEvents(Q, [{ type: 'houston' }], CALL);
  assert.deepEqual(cutReaction(Q), []); assert.equal(Q.cur.key, 'hold', 'a story line is never cut'); assert.deepEqual(Q.q.map(l => l.key), ['hold', 'hold', 'houston', 'houston', 'rescue']);
  const E = createRadio(always); assert.deepEqual(cutReaction(E), [], 'idle'); radioCue(E, 'low'); run(E, 4); assert.equal(E.phase, 'gap'); assert.deepEqual(cutReaction(E), [], 'in the gap'); });
// R18 moved (Plan 6): Houston's call in main.js's order (the fight's events, the radio's step, then on Houston the cut) with a voice
// whose onend never comes, a reaction on the air as Houston picks up, and a pickup and kills during the call; the end of the rescue
// line's talk is the knock-out, which must come before the KO.call fallback
test('with a voice whose onend never comes and a reaction on the air at Houston, the punchline keys at once, and the rescue line follows it and ends before KO.call (R18)', () => {
  const R = createRadio(always), dt = 1 / 60, A = []; radioCue(R, 'low'); run(R, .5, true);
  radioEvents(R, [{ type: 'houston' }], CALL); cutReaction(R); let t = 0, ko = null;
  for (; t < KO.call; t += dt) { if (Math.abs(t - 3) < dt / 2) radioEvents(R, [{ type: 'pickup', kind: 'tape' }, { type: 'kill', kind: 'br', n: 9 }], CALL);
    const acts = stepRadio(R, dt, true, false); for (const a of acts) A.push({ ...a, t }); if (acts.some(a => a.do === 'unkey' && a.line.key === 'rescue')) { ko = t; break; } }
  assert.deepEqual(said(A), [...SCRIPT.houston, ...SCRIPT.rescue]); const k = A.find(a => a.do === 'key' && a.line.text === PUNCH), u = A.find(a => a.do === 'unkey' && a.line.text === PUNCH);
  assert.ok(k.t < 6, `punchline keyed at ${k.t.toFixed(2)} s`); assert.ok(u.t < ko && ko < KO.call, `punchline ends at ${u.t.toFixed(2)} s, the knock-out at ${ko} s`); });
// R18 (c): the ending's gate: the end screen comes ENDING.min s after its start once the radio is idle, else as it goes idle, and
// at ENDING.max whatever is on the air (Plan 6 moves the gate from Houston to the sting after lift-off; unused until then)
test('the ending lasts ENDING.min s with the radio idle, waits for a line still on the air, and stops at ENDING.max for a line that never ends (R18)', () => {
  const R = createRadio(always); assert.ok(radioIdle(R)); assert.equal(endingOver(ENDING.min - .01, R), false); assert.equal(endingOver(ENDING.min, R), true);
  radioCue(R, 'houston'); assert.equal(endingOver(ENDING.min, R), false, 'the punchline still to come'); assert.equal(endingOver(ENDING.max, R), true);
  // a voiced line whose onend never comes, long enough that its fallback outlasts the ending
  const L = createRadio(always, { x: ['H|' + 'a'.repeat(200)] }, { x: { crit: 1 } }), dt = 1 / 30; radioCue(L, 'x'); let t = 0;
  assert.ok(RADIO.slack * 200 / RADIO.cps + RADIO.pad > ENDING.max);
  for (; !endingOver(t, L); t += dt) stepRadio(L, dt, true, false);
  assert.ok(Math.abs(t - ENDING.max) <= dt + 1e-9, `${t}`); assert.equal(L.phase, 'talk', 'still on the air'); });
// R26 (completes R18): Houston also ends the hold's chatter: an on-hold message on the air is cut like a reaction, and those still
// waiting are dropped; the switchboard intro and the Houston pair never are
import { HOLD } from '../src/game/hold.js';
test('Houston cuts an on-hold message on the air and drops those waiting, keeping the Houston pair (R26)', () => {
  const R = createRadio(always); radioCue(R, 'holding'); run(R, .5, true); radioCue(R, 'holding'); radioCue(R, 'low'); assert.equal(R.cur.key, 'holding');
  radioEvents(R, [{ type: 'houston' }], CALL); assert.deepEqual(cutReaction(R).map(a => a.do), ['off']); assert.equal(R.cur, null);
  assert.deepEqual(R.q.map(l => l.key), ['houston', 'houston', 'rescue', 'low'], 'the waiting on-hold message is dropped');
  const Q = createRadio(always); radioCue(Q, 'low'); run(Q, .5, true); radioCue(Q, 'holding'); radioEvents(Q, [{ type: 'houston' }], CALL);
  assert.deepEqual(cutReaction(Q).map(a => a.do), ['off']); assert.deepEqual(Q.q.map(l => l.key), ['houston', 'houston', 'rescue']); });
// R26: the case R18 left open, the hold from E to the knock-out in main.js's order with a voice whose onend never comes (the slack
// fallback), the longest lines, the switchboard intro at 0, an on-hold message every HOLD.msg s from HOLD.msg / 2, and a reaction
// keyed in the half second before the last of them (77 s), which pushes it onto the air as Houston picks up at HOLD.time. Before
// R26 the pair keyed 3.25-3.73 s late and the ending's cap cut the punchline off; now it keys at .5 s and ends at 11.45 s, and
// (Plan 6) the rescue line's unkey, the knock-out, comes before the KO.call fallback.
const longest = L => L.reduce((m, l, i) => (l.length > L[m].length ? i : m), 0);
const LONG = { next: () => 0, int: n => (n === SCRIPT.low.length ? longest(SCRIPT.low) : n === SCRIPT.holding.length ? longest(SCRIPT.holding) : 0), range: a => a };
test('with a voice whose onend never comes and an on-hold message on the air at Houston, the pair keys within .6 s, and the punchline and then the rescue line end before KO.call (R26)', () => {
  for (const react of [76.5, 76.75, 76.98]) {
    const R = createRadio(LONG), dt = 1 / 60; radioCue(R, 'hold'); let t = 0, msgs = 0, won = false, endT = 0, onAir = null, keyed = null, punch = null, ko = null;
    for (let i = 0; i < 200 / dt; i++) {
      const ev = [];
      if (!won) { while (t >= HOLD.msg / 2 + msgs * HOLD.msg - 1e-9) ev.push({ type: 'holdmsg', n: msgs++ }); if (Math.abs(t - react) < dt / 2) ev.push({ type: 'hurt' }); if (t >= HOLD.time - 1e-9) { won = true; ev.push({ type: 'houston' }); } }
      radioEvents(R, ev, { ko: won ? { phase: 'call' } : null, hp: 10, state: 'play' });
      for (const a of stepRadio(R, dt, true, false)) { if (a.do === 'key' && a.line.key === 'houston' && keyed === null) keyed = endT; if (a.do === 'unkey' && a.line.text === PUNCH) punch = endT;
        if (a.do === 'unkey' && a.line.key === 'rescue') ko = endT; }
      if (ev.some(e => e.type === 'houston')) { onAir = R.cur?.key; cutReaction(R); } else if (won) { endT += dt; if (ko !== null || endT >= KO.call) break; }
      t += dt; }
    assert.equal(onAir, 'holding', `${react}: an on-hold message on the air at Houston`); assert.ok(keyed !== null && keyed <= .6, `${react}: the pair keyed ${keyed} s after Houston`);
    assert.ok(punch !== null && punch < ko && ko < KO.call, `${react}: punchline ends at ${punch} s, the knock-out at ${ko} s`); } });
test('silence: the radio dies at once, queue and all, with no closing tone (Plan 6)', () => {
  const R = createRadio(always); radioCue(R, 'houston'); radioCue(R, 'rescue'); run(R, .5); assert.deepEqual(silence(R), [{ do: 'off' }]);
  assert.deepEqual([R.cur, R.q.length], [null, 0]); assert.deepEqual(run(R, 3), []); assert.deepEqual(silence(R), []); }); // pre-flight F23: the queue is empty, so nothing keys or unkeys
