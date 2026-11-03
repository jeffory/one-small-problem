import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs'; import { FakeAC } from './fakeaudio.mjs';
import { createAudio, MIX } from '../src/audio/audio.js'; import { SFX, buildSfx, sfxFor } from '../src/audio/sfx.js'; import { ZZFX_RATE } from '../src/audio/zzfx.js';
const sfx = buildSfx(), spy = () => { const o = {}; o.AC = class extends FakeAC { constructor() { super(); o.ctx = this; } }; return o; };
const all = A => { A.start(); A.sfx('pistol'); A.song('base'); A.air(true); A.air(false); A.duck(true); A.duck(false); A.key(true); A.key(false); A.bed(true); A.bed(false); A.volume(.5); A.pause(); A.resume(); return A.info(); };
test('no AudioContext, a constructor that throws, or nodes that throw: every call is a silent no-op (Review Focus 2)', () => {
  for (const AC of [undefined, class { constructor() { throw new Error('blocked'); } }, class extends FakeAC { createGain() { throw new Error('x'); } }]) {
    const A = createAudio({ AC, sfx }); let info; assert.doesNotThrow(() => { info = all(A); }); assert.equal(info.ctx, null); assert.equal(info.downs, 0); } });
test('start() makes one context on the gesture and resumes it; SFX run through the air filter, MIX.vacuum Hz outside and MIX.air in the base; pause suspends (audio)', () => {
  const s = spy(); let made = 0; const AC = class extends s.AC { constructor() { super(); made++; } }, A = createAudio({ AC, sfx }); assert.equal(A.info().ctx, null);
  A.start(); A.start(); assert.equal(made, 1); assert.equal(A.info().ctx, 'running'); A.air(false); assert.equal(A.info().cut, MIX.vacuum); A.air(true); assert.equal(A.info().cut, MIX.air);
  A.pause(); assert.equal(A.info().ctx, 'suspended'); A.resume(); assert.equal(A.info().ctx, 'running'); });
test('one SFX name plays at most once per MIX.gap s; an unknown name is ignored (audio)', () => { const s = spy(), A = createAudio({ AC: s.AC, sfx }); A.start(); const n0 = A.info().plays;
  A.sfx('pistol'); A.sfx('pistol'); A.sfx('nope'); assert.equal(A.info().plays, n0 + 1); s.ctx.currentTime += MIX.gap + .01; A.sfx('pistol'); A.sfx('zap'); assert.equal(A.info().plays, n0 + 3); });
test('ducking pulls the music to MIX.duck of its level and back (audio)', () => { const s = spy(), A = createAudio({ AC: s.AC, sfx }); A.start();
  A.duck(true); assert.ok(Math.abs(A.info().music - MIX.music * MIX.duck) < 1e-9); A.duck(false); assert.ok(Math.abs(A.info().music - MIX.music) < 1e-9); });
test('key(true) sounds 2525 Hz and key(false) 2475 Hz for MIX.tone s, each with a burst of static; info().downs counts the closing tones (radio)', () => { const s = spy(), A = createAudio({ AC: s.AC, sfx }); A.start();
  let k = s.ctx.made.length; A.key(true); const o = s.ctx.made.slice(k).filter(n => n.kind === 'osc'); assert.equal(o.length, 1); assert.equal(o[0].frequency.value, 2525);
  assert.ok(Math.abs(o[0].stopped - o[0].started - MIX.tone) < 1e-9); assert.ok(s.ctx.made.slice(k).some(n => n.kind === 'src' && n.buffer));
  assert.equal(A.info().downs, 0); k = s.ctx.made.length; A.key(false); assert.equal(s.ctx.made.slice(k).find(n => n.kind === 'osc').frequency.value, 2475); assert.equal(A.info().downs, 1); });
test('sfxFor maps fight events to sounds, with alien shots and blasts fading by distance (audio)', () => { const p = { x: 0, z: 0 };
  assert.deepEqual([0, 1, 2].map(w => sfxFor({ type: 'fire', w }, p)), [['pole', 1], ['pistol', 1], ['scatter', 1]]);
  assert.deepEqual(sfxFor({ type: 'zap', x: 20, z: 0 }, p), ['zap', .5]); assert.equal(sfxFor({ type: 'zap', x: 50, z: 0 }, p), null);
  assert.deepEqual(sfxFor({ type: 'boom', x: 0, z: 40 }, p), ['boom', .5]); assert.deepEqual(sfxFor({ type: 'area', level: true }, p), ['door', 1]); assert.equal(sfxFor({ type: 'area', level: false }, p), null);
  for (const [t, n] of [['kill', 'kill'], ['hurt', 'hurt'], ['pickup', 'pickup'], ['flag', 'pickup'], ['golf', 'golf']]) assert.deepEqual(sfxFor({ type: t }, p), [n, 1]);
  assert.deepEqual(sfxFor({ type: 'hit' }, p), ['hit', .7]); assert.deepEqual(sfxFor({ type: 'sfx', key: 'thud' }, p), ['thud', 1]); assert.equal(sfxFor({ type: 'restart' }, p), null); });
test('every SFX renders a short, non-silent ZzFX buffer, and the generator keeps its MIT notice (audio)', () => {
  assert.deepEqual(Object.keys(sfx).sort(), Object.keys(SFX).sort()); assert.equal(ZZFX_RATE, 44100); assert.match(readFileSync('src/audio/zzfx.js', 'utf8'), /MIT License/);
  for (const [k, b] of Object.entries(sfx)) { let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); assert.ok(b.length > 100 && b.length <= 10 * ZZFX_RATE, k); assert.ok(m > .02 && m <= 2, `${k} peak ${m}`); } });
// pre-flight F21: an unhandled rejection here fails the test file
test('a context whose resume() and suspend() reject stays silent and unbroken, with no unhandled rejection (Review Focus 2)', async () => {
  const AC = class extends FakeAC { resume() { return Promise.reject(new Error('blocked')); } suspend() { return Promise.reject(new Error('no')); } }, A = createAudio({ AC, sfx });
  assert.doesNotThrow(() => { A.start(); A.sfx('pistol'); A.pause(); A.resume(); A.start(); }); await new Promise(r => setTimeout(r, 20)); });
const fakeSong = v => ({ length: 4, getChannelData: () => Float32Array.of(0, v, -v, 0) });
test('song(): recorded while silent, starts when the context and buffer both exist, crossfades MIX.fade s, and a song asked for early starts when its buffer arrives (music)', async () => {
  let doneB, doneH; const songs = { base: new Promise(r => { doneB = r; }), hold: new Promise(r => { doneH = r; }), dead: new Promise(() => {}) }, s = spy(), A = createAudio({ AC: s.AC, sfx, songs });
  A.song('base'); assert.equal(A.info().song, 'base'); A.start(); const loops = () => s.ctx.made.filter(n => n.kind === 'src' && n.loop && n.buffer?.length === 4);
  assert.equal(loops().length, 0); doneB(fakeSong(.5)); await new Promise(r => setTimeout(r, 0)); assert.equal(loops().length, 1); doneH(fakeSong(.25)); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(A.info().songs, { base: .5, hold: .25 }); assert.equal(loops().length, 1);
  A.song('base'); assert.equal(loops().length, 1); A.song('hold'); const h = loops(); assert.equal(h.length, 2);
  A.song(null); assert.equal(A.info().song, null); });
test('a rejected or garbage songs promise, and no songs at all, leave the engine silent and unbroken (Review Focus 2)', async () => {
  for (const songs of [{ a: Promise.reject(new Error('x')) }, { a: Promise.resolve({}) }, { a: Promise.resolve(null) }, null]) { const A = createAudio({ AC: FakeAC, sfx, songs }); A.start(); A.song('a'); await new Promise(r => setTimeout(r, 0)); assert.deepEqual(A.info().songs, {}); } });
test('the master runs through a limiter when DynamicsCompressorNode exists, and straight to the destination when it does not (audio)', () => {
  const comp = []; const P = v => ({ value: v }), AC1 = class extends FakeAC { createDynamicsCompressor() { const k = { threshold: P(0), knee: P(0), ratio: P(1), attack: P(0), release: P(0), to: null, connect(n) { this.to = n; } }; comp.push(k); return k; } };
  const A = createAudio({ AC: AC1, sfx }); A.start(); assert.equal(comp.length, 1); assert.ok(comp[0].threshold.value <= -3 && comp[0].ratio.value >= 10 && comp[0].attack.value <= .01); assert.equal(comp[0].to.kind, 'dest');
  const s = spy(), B = createAudio({ AC: s.AC, sfx }); B.start(); assert.equal(B.info().ctx, 'running');
  const m = s.ctx.made.find(n => n.kind === 'gain' && n.out.includes(s.ctx.destination)); assert.ok(m); });
