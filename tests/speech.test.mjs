import test from 'node:test'; import assert from 'node:assert/strict'; import { createSpeech, castVoices } from '../src/audio/speech.js'; import { VOICE } from '../src/game/script.js';
const fake = (voices = []) => { const W = { said: [], cancels: 0, on: {} };
  W.speechSynthesis = { getVoices: () => voices, speak: u => W.said.push(u), cancel: () => { W.cancels++; }, addEventListener: (t, f) => { W.on[t] = f; } };
  W.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } }; return W; };
const line = { id: 1, who: 'H', text: 'Houston, go ahead.' }, en = [{ name: 'en', lang: 'en-US', localService: true }];
test('no speechSynthesis: not ok, and say() does nothing (Review Focus 1)', () => { const S = createSpeech({}); assert.equal(S.ok, false); assert.equal(S.say(line, () => {}), false); assert.doesNotThrow(() => S.cancel()); });
test('voices that arrive late through voiceschanged make it ok; an English local voice is preferred (radio)', () => { const W = fake([]), S = createSpeech(W);
  const v = [{ name: 'de', lang: 'de-DE', localService: true }, { name: 'en-online', lang: 'en-US', localService: false }, { name: 'en-local', lang: 'en-GB', localService: true }];
  assert.equal(S.ok, false); W.speechSynthesis.getVoices = () => v; W.on.voiceschanged(); assert.equal(S.ok, true); S.say(line, () => {}); assert.equal(W.said[0].voice.name, 'en-local'); });
test('say() cancels what was queued, speaks with the speaker\'s pitch and rate at the set volume, and reports the end once (radio)', () => {
  const W = fake(en), S = createSpeech(W); let ends = 0; S.volume(.5); assert.equal(S.say(line, () => ends++), true); const u = W.said[0];
  assert.equal(W.cancels, 1); assert.equal(u.text, line.text); assert.deepEqual([u.pitch, u.rate], VOICE.H); assert.equal(u.volume, .5); u.onend(); u.onerror?.(); assert.equal(ends, 1); });
test('a speak() that throws is caught and reported as failed (Review Focus 1)', () => { const W = fake(en); W.speechSynthesis.speak = () => { throw new Error('no'); };
  assert.equal(createSpeech(W).say(line, () => {}), false); });
// R15: a voice that fails must not cut its line short
import { RADIO, createRadio, radioCue, stepRadio, radioDone } from '../src/game/radio.js'; import { makeRng } from '../src/gen/rng.js';
test('onEnd says whether the voice failed: not at its end or on our own cancel (interrupted, canceled), yes on any other error (R15)', () => {
  const got = []; for (const ev of [null, { error: 'interrupted' }, { error: 'canceled' }, { error: 'synthesis-failed' }, { error: 'network' }]) { const W = fake(en);
    W.speechSynthesis.speak = u => (ev ? u.onerror(ev) : u.onend()); createSpeech(W).say(line, f => got.push(f)); }
  assert.deepEqual(got, [false, false, false, true, true]); });
test('a voice that errors or throws at once leaves each line up as a subtitle for its unvoiced reading time, and the queue moves on (R15, Review Focus 1)', () => {
  for (const how of ['errors', 'throws']) { const W = fake(en), S = createSpeech(W), R = createRadio(makeRng('r')), failing = [], A = []; let spoke = 0;
    W.speechSynthesis.speak = u => { spoke++; if (how === 'throws') throw new Error('no'); failing.push(u); }; radioCue(R, 'telemetry'); radioCue(R, 'houston');
    for (let t = 0; t < 30; t += 1 / 60) { for (const u of failing.splice(0)) u.onerror({ error: 'synthesis-failed' }); // a frame after speak, as browsers do
      for (const a of stepRadio(R, 1 / 60, S.ok, false)) { A.push({ ...a, t: R.clock }); // what main.js's radioDo does with a say
        if (a.do === 'say' && a.line.voiced && !S.say(a.line, f => radioDone(R, a.line.id, f))) radioDone(R, a.line.id, true); } }
    const say = A.filter(a => a.do === 'say'), un = A.filter(a => a.do === 'unkey'); assert.equal(spoke, 3, how); assert.equal(say.length, 3, how); assert.equal(un.length, 3, how);
    say.forEach((s, i) => assert.ok(Math.abs(un[i].t - s.t - Math.max(RADIO.min, s.line.text.length / RADIO.cps)) <= 1 / 60 + 1e-9, `${how}: ${s.line.text}`)); } });
const v = (name, lang, local = true) => ({ name, lang, localService: local });
test('castVoices with 0, 1, 2 and 3 voices: Houston en-US, You another accent, the Switchboard a third or Houston\'s; input order never matters (Plan 5)', () => {
  assert.deepEqual(castVoices([]), { H: null, Y: null, S: null });
  const a = v('Alpha', 'en-GB'); assert.deepEqual(castVoices([a]), { H: a, Y: a, S: a });
  const us = v('Zed', 'en_US'), gb = v('Beth', 'en-GB'); assert.deepEqual(castVoices([gb, us]), { H: us, Y: gb, S: us });
  const L = [v('Zed', 'en-US'), v('Amy', 'en-US'), v('Kate', 'en-GB'), v('Hans', 'de-DE'), v('Online', 'en-US', false)];
  const c = castVoices(L); assert.deepEqual([c.H.name, c.Y.name, c.S.name], ['Amy', 'Kate', 'Zed']);
  assert.deepEqual(castVoices([...L].reverse()), c); });
test('a local voice beats a remote en-US one; non-English voices still speak; odd entries and a throwing getVoices never throw (Plan 5, Review Focus 4)', () => {
  const k = v('Kate', 'en-GB'), o = v('Online US', 'en-US', false); assert.deepEqual(castVoices([o, k]), { H: k, Y: o, S: k });
  const h = v('Hans', 'de-DE'); assert.deepEqual(castVoices([h]), { H: h, Y: h, S: h });
  assert.doesNotThrow(() => castVoices([{}, { name: 'x' }, { lang: 'en' }, v('d', 'en-US'), v('d', 'en-US')]));
  const W = fake(); W.speechSynthesis.getVoices = () => { throw new Error('no'); }; assert.equal(createSpeech(W).ok, false); });
test('each speaker speaks in their own voice at their own pitch and rate; a recast on voiceschanged leaves a line in flight alone: no cancel, no new utterance (Plan 5, pre-flight F3)', () => {
  const L = [v('Amy', 'en-US'), v('Kate', 'en-GB'), v('Zed', 'en-US')], W = fake(L), S = createSpeech(W);
  for (const who of ['H', 'Y', 'S']) S.say({ ...line, who }, () => {});
  assert.deepEqual(W.said.map(u => [u.voice.name, u.lang, u.pitch, u.rate]), [['Amy', 'en-US', ...VOICE.H], ['Kate', 'en-GB', ...VOICE.Y], ['Zed', 'en-US', ...VOICE.S]]);
  const u = W.said[2], c = W.cancels, n = W.said.length; W.speechSynthesis.getVoices = () => [v('Bob', 'en-US')]; W.on.voiceschanged();
  assert.equal(u.voice.name, 'Zed'); assert.deepEqual([W.cancels, W.said.length], [c, n]);
  S.say({ ...line, who: 'Y' }, () => {}); assert.equal(W.said.at(-1).voice.name, 'Bob'); });
