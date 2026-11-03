import test from 'node:test'; import assert from 'node:assert/strict'; import { createSpeech } from '../src/audio/speech.js'; import { VOICE } from '../src/game/script.js';
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
