import test from 'node:test'; import assert from 'node:assert/strict'; import { makeRng } from '../src/gen/rng.js';
import { SCRIPT, CUES, WHO, VOICE } from '../src/game/script.js'; import { RADIO, createRadio, radioCue, radioEvents, stepRadio, radioDone, pauseRadio, radioIdle } from '../src/game/radio.js';
const R0 = () => createRadio(makeRng('r')), always = { next: () => 0, int: () => 0, range: a => a };
const run = (R, secs, voiced = false, dawdle = false, dt = 1 / 60, out = []) => { for (let t = 0; t < secs - 1e-9; t += dt) for (const a of stepRadio(R, dt, voiced, dawdle)) out.push({ ...a, t: R.clock }); return out; };
const said = A => A.filter(a => a.do === 'key').map(a => a.line.who + '|' + a.line.text);
const keyOf = (ev, f = {}) => { const R = createRadio(always); radioEvents(R, ev, { kills: 2, hp: 100, state: 'play', ...f }); return R.q.map(l => l.key).join(); };
test('the script: 140 to 160 short lines "X|text" with known speakers, every cue scripted, and the spec\'s lines verbatim (radio)', () => {
  const all = Object.values(SCRIPT).flat(); assert.ok(all.length >= 140 && all.length <= 160, `${all.length}`); for (const l of all) assert.match(l, /^[HYS]\|.{2,90}$/);
  assert.deepEqual(Object.keys(SCRIPT).sort(), Object.keys(CUES).sort()); assert.deepEqual(Object.keys(WHO).sort(), ['H', 'S', 'Y']); for (const k in WHO) assert.equal(VOICE[k].length, 2);
  assert.equal(SCRIPT.golf.length, 5); assert.deepEqual(SCRIPT.touchdown, ['Y|Contact light. Engine stop.', "H|We copy, you're down. Beautiful work."]);
  assert.deepEqual(SCRIPT.step, ["Y|Okay Houston, I'm stepping off the\u2014"]); assert.deepEqual(SCRIPT.company, ['Y|\u2026Houston, are we expecting anyone?']);
  assert.deepEqual(SCRIPT.telemetry, ['H|\u2026say again? We just lost all telemetry from the lander.']); assert.deepEqual(SCRIPT.title, ['Y|Houston\u2026 we have one small problem.']);
  assert.deepEqual(SCRIPT.houston, ['H|Houston, go ahead.', 'Y|Houston\u2026 we have one small problem.']); });
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
  assert.equal(keyOf([{ type: 'hold' }]), 'hold,hold,hold'); assert.equal(keyOf([{ type: 'houston' }]), 'houston,houston');
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
test('the dawdle clock runs only in play, never on hold or after Houston picks up (R16)', () => { const F = { hold: null, won: false };
  assert.equal(dawdling('play', F), true); for (const s of ['title', 'opening', 'ending', 'end']) assert.equal(dawdling(s, F), false, s);
  assert.equal(dawdling('play', { ...F, hold: { t: 3 } }), false, 'on hold'); assert.equal(dawdling('play', { ...F, won: true }), false, 'after Houston'); });
