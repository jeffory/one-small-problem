import test from 'node:test'; import assert from 'node:assert/strict'; import { FakeOffline } from './fakeaudio.mjs';
import { SONGS, INST, songNotes, songLength, renderSong, renderSongs, PEAK, TAIL } from '../src/audio/music.js';
test('four songs as compact patterns: every pattern 16 rows of a-z . -, every order 8 bars of existing patterns, every instrument known (music)', () => {
  assert.deepEqual(Object.keys(SONGS), ['surface', 'crater', 'base', 'hold']);
  for (const [k, s] of Object.entries(SONGS)) for (const [inst, base, vol, order, pats] of s.tracks) { assert.ok(INST[inst], `${k} ${inst}`); assert.equal(order.length, 8);
    for (const c of order) assert.ok(+c < pats.length); for (const p of pats) assert.match(p, /^[a-z.\-]{16}$/); assert.ok(vol > 0 && vol <= 1 && base >= 0); } });
test('the decoder: a note starts on its row, holds through -, stops at . or the bar line, at the pitch above the track base (music)', () => {
  const n = songNotes(SONGS.surface), step = 15 / 70, bell = n.find(q => q.i === 'bell'), at8 = n.find(q => q.i === 'bell' && Math.abs(q.t - 8 * step) < 1e-9);
  assert.deepEqual([n[0].i, n[0].t, n[0].f, n[0].v], ['drone', 0, 55, .5]); assert.ok(Math.abs(n[0].d - 16 * step) < 1e-9);
  assert.ok(Math.abs(bell.f - 440 * 2 ** (7 / 12)) < 1e-9 && Math.abs(bell.d - step) < 1e-9); assert.ok(at8 && Math.abs(at8.f - 440 * 2 ** (3 / 12)) < 1e-9);
  assert.equal(n.length, 42); });
test('every song is 8 bars of 15 to 30 s, and its pitched notes lie between 30 Hz and 2 kHz (music)', () => {
  for (const s of Object.values(SONGS)) { const L = songLength(s); assert.ok(L >= 15 && L <= 30, `${L}`);
    for (const q of songNotes(s)) { assert.ok(q.t >= 0 && q.t < L); if (!['kick', 'snare', 'hat'].includes(q.i)) assert.ok(q.f >= 30 && q.f <= 2000, `${q.i} ${q.f}`); } } });
test('renderSong builds on any OfflineAudioContext-like class, and resolves null without one or when it throws (Review Focus 2)', async () => {
  const b = await renderSong(SONGS.base, 22050, FakeOffline); assert.equal(b.length, Math.ceil(songLength(SONGS.base) * 22050));
  assert.equal(await renderSong(SONGS.base, 22050, undefined), null); assert.equal(await renderSong(SONGS.base, 22050, class { constructor() { throw new Error('no'); } }), null); });
test('a rendered song is normalised once so its peak is at most PEAK, and a quiet one is left alone (music)', async () => {
  const mk = v => class extends FakeOffline { startRendering() { const b = this.createBuffer(1, this.length, this.sampleRate), d = b.getChannelData(0); d[10] = v; d[11] = -v / 2; return Promise.resolve(b); } };
  for (const v of [1.5, 3]) { const d = (await renderSong(SONGS.base, 22050, mk(v))).getChannelData(0); let p = 0; for (const x of d) p = Math.max(p, Math.abs(x)); assert.ok(p <= PEAK + 1e-6 && p > PEAK - 1e-3, `${p}`); }
  assert.equal((await renderSong(SONGS.base, 22050, mk(.5))).getChannelData(0)[10], .5); });
test('the tail past the last bar is folded onto the start of the loop (added), then the buffer is trimmed and normalised (music)', async () => {
  const n = Math.ceil(songLength(SONGS.base) * 22050), m = Math.ceil(TAIL * 22050);
  const C = class extends FakeOffline { startRendering() { const b = this.createBuffer(1, this.length, this.sampleRate), d = b.getChannelData(0); d[0] = .25; d[n] = .5; d[n + 7] = -.25; d[n + m - 1] = .125; assert.equal(this.length, n + m); return Promise.resolve(b); } };
  const b = await renderSong(SONGS.base, 22050, C), d = b.getChannelData(0); assert.equal(b.length, n); assert.equal(d[0], .75); assert.equal(d[7], -.25); assert.equal(d[m - 1], .125); });
test('renderSongs gives one promise per song in a fixed order; one that hangs or throws loses only itself (Review Focus 2)', async () => {
  const o = renderSongs(FakeOffline); assert.deepEqual(Object.keys(o), Object.keys(SONGS)); for (const k in o) assert.equal((await o[k]).length, Math.ceil(songLength(SONGS[k]) * 22050));
  const bad = renderSongs(class { constructor() { throw new Error('x'); } }); for (const k in bad) assert.equal(await bad[k], null); });
