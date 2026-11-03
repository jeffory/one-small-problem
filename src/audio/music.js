// The music: a small tracker. A song is {bpm, tracks}; a track is [instrument, base MIDI note, volume, order, patterns], 8 bars
// of 16 rows each ('.' rest, '-' hold, 'a'-'z' semitones above the base). Songs are composed, never seeded. Each is rendered once
// at boot on an OfflineAudioContext (22,050 Hz mono) and looped by the engine. Only plain Web Audio nodes are used.
export const SONGS = {
  surface: { bpm: 70, tracks: [
    ['drone', 33, .5, '00000000', ['a---------------']],
    ['pad', 52, .25, '01230123', ['f---------------', 'b---------------', 'd---------------', 'a---------------']],
    ['pad', 52, .2, '01230123', ['i---------------', 'f---------------', 'h---------------', 'd---------------']],
    ['bell', 69, .3, '01230123', ['h.......d...c...', '........a.......', 'f.......d...c...', 'c...a...........']]] },
  crater: { bpm: 88, tracks: [
    ['bass', 33, .45, '00110011', ['a.a.a.am..a.a.a.', 'i.i.i.ik..k.k.k.']],
    ['hat', 0, .12, '00000000', ['a.a.a.a.a.a.a.a.']],
    ['pad', 57, .18, '01010101', ['a---------------', 'i-------k-------']],
    ['pluck', 69, .22, '01020103', ['a..b..a.....h...', '................', 'a..b..a.....i.h.', 'm.......k...h...']]] },
  base: { bpm: 108, tracks: [
    ['kick', 0, .7, '01010101', ['a...a...a...a...', 'a...a...a..aa...']],
    ['snare', 0, .35, '00000001', ['....a.......a...', '....a.......a.aa']],
    ['hat', 0, .15, '00000000', ['..a...a...a...a.']],
    ['bass', 28, .5, '00110012', ['a.a.ma.ab.a.ma.a', 'd.d.pd.db.b.nb.b', 'a.a.ma.ab.b.b.b.']],
    ['lead', 64, .12, '01020103', ['a-------b-------', '................', 'd-------b-------', 'h---f---d---b---']]] },
  hold: { bpm: 100, tracks: [
    ['bass', 41, .4, '01230123', ['a.....h.a.....h.', 'f.....m.f.....m.', 'h.....o.h.....o.', 'a.....h.c.....e.']],
    ['pad', 53, .15, '01230123', ['e---------------', 'j---------------', 'l---------------', 'e---------------']],
    ['lead', 65, .2, '01230456', ['m...l.j.h.......', 'l...j.h.f.......', 'j...h.f.e...c...', 'e.f.h.a---------', 'm.o.q.r...q.o...', 'o...m.l.j.......', 'h.j.l.m---------']],
    ['bell', 77, .08, '01230456', ['m...l.j.h.......', 'l...j.h.f.......', 'j...h.f.e...c...', 'e.f.h.a---------', 'm.o.q.r...q.o...', 'o...m.l.j.......', 'h.j.l.m---------']],
    ['hat', 0, .08, '00000000', ['a.aa..a.a.aa..a.']]] },
  prison: { bpm: 76, tracks: [
    ['drone', 31, .45, '00000000', ['a---------------']],
    ['bass', 31, .35, '00110011', ['a.......a...b...', 'a.......a.a.f...']],
    ['pad', 50, .18, '01010101', ['a---------------', 'b---------------']],
    ['bell', 74, .14, '01020103', ['a.......g.......', '........f...a...', 'a.......h.......', 'g...f...a-------']],
    ['hat', 0, .06, '00000000', ['a.......a.......']]] },
  escape: { bpm: 120, tracks: [
    ['kick', 0, .7, '00000001', ['a...a...a...a...', 'a...a...a.a.a.aa']],
    ['snare', 0, .35, '00000001', ['....a.......a...', '....a.......a.aa']],
    ['hat', 0, .14, '00000000', ['a.aaa.aaa.aaa.aa']],
    ['bass', 33, .5, '00110022', ['a.aa.aa.a.aa.ama', 'f.ff.ff.f.ff.fhf', 'h.hh.hh.h.hh.hjh']],
    ['lead', 69, .14, '01020301', ['a...c...e...h...', '................', 'h...f...e...c...', 'e---d---c---a---']]] } };
export const songLength = s => 8 * 16 * 15 / s.bpm;
export function songNotes(song) {
  const step = 15 / song.bpm, out = [];
  for (const [i, base, v, order, pats] of song.tracks) for (let bar = 0; bar < 8; bar++) {
    const p = pats[+order[bar]];
    for (let r = 0; r < 16; r++) {
      const c = p.charCodeAt(r); if (c < 97) continue;
      let n = 1; while (r + n < 16 && p[r + n] === '-') n++;
      out.push({ t: (bar * 16 + r) * step, d: n * step, f: 440 * 2 ** ((base + c - 97 - 69) / 12), i, v });
    }
  }
  return out;
}
// A recipe plays one note into the destination. env: attack to v, hold to d, release to silence; returns the stop time.
const osc = (c, type, f, t, to) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.connect(to); o.start(t); return o; };
const lp = (c, type, f, to, Q = 1) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; b.connect(to); return b; };
const env = (c, v, t, d, a, r, to) => {
  const g = c.createGain(), p = g.gain, ea = Math.min(a, d); p.setValueAtTime(0, t); p.linearRampToValueAtTime(v, t + ea); p.setValueAtTime(v, t + d); p.linearRampToValueAtTime(0, t + d + r); g.connect(to); return [g, t + d + r + .02];
};
const decay = (c, v, t, len, to) => { const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + len); g.connect(to); return [g, t + len + .02]; };
const stops = (list, e) => list.forEach(o => o.stop(e));
export const INST = {
  drone: (c, q, to) => { const [g, e] = env(c, q.v, q.t, q.d, .8, 1, to), f = lp(c, 'lowpass', 400, g); stops([osc(c, 'sawtooth', q.f, q.t, f), osc(c, 'sawtooth', q.f * 1.006, q.t, f)], e); },
  pad: (c, q, to) => { const [g, e] = env(c, q.v, q.t, q.d, .25, .6, to), f = lp(c, 'lowpass', 1400, g), s = c.createGain(); s.gain.value = .3; s.connect(f);
    stops([osc(c, 'triangle', q.f, q.t, f), osc(c, 'sawtooth', q.f * 1.004, q.t, s)], e); },
  bass: (c, q, to) => { const [g, e] = env(c, q.v, q.t, q.d, .005, .08, to), f = lp(c, 'lowpass', 1200, g, 4); f.frequency.setValueAtTime(1200, q.t); f.frequency.exponentialRampToValueAtTime(180, q.t + .25);
    stops([osc(c, 'sawtooth', q.f, q.t, f)], e); },
  pluck: (c, q, to) => { const [g, e] = decay(c, q.v, q.t, .35, to); stops([osc(c, 'square', q.f, q.t, lp(c, 'lowpass', 2200, g))], e); },
  bell: (c, q, to) => { const [g, e] = decay(c, q.v, q.t, 1.4, to), s = c.createGain(); s.gain.value = .3; s.connect(g); stops([osc(c, 'sine', q.f, q.t, g), osc(c, 'sine', q.f * 2.76, q.t, s)], e); },
  lead: (c, q, to) => { const [g, e] = env(c, q.v, q.t, q.d, .02, .15, to), f = lp(c, 'lowpass', 1800, g), o = osc(c, 'square', q.f, q.t, f), l = c.createGain();
    l.gain.value = q.f * .012; l.connect(o.frequency); stops([o, osc(c, 'sine', 5.5, q.t, l)], e); },
  kick: (c, q, to) => { const [g, e] = decay(c, q.v, q.t, .3, to), o = osc(c, 'sine', 120, q.t, g); o.frequency.setValueAtTime(120, q.t); o.frequency.exponentialRampToValueAtTime(40, q.t + .12); stops([o], e); },
  snare: (c, q, to, nz) => { const [g, e] = decay(c, q.v, q.t, .14, to), s = noise(c, lp(c, 'bandpass', 1800, g, .8), nz, q.t); stops([s], e); },
  hat: (c, q, to, nz) => { const [g, e] = decay(c, q.v, q.t, .04, to), s = noise(c, lp(c, 'highpass', 7000, g), nz, q.t); stops([s], e); },
};
const noise = (c, to, buf, t) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(to); s.start(t); return s; };
export const PEAK = .9, TAIL = 2.5; // every rendered song is scaled once so its peak is at most PEAK; TAIL s covers the longest release or decay
// Folds the render's tail onto the start of the loop (added, so a note ringing past the last bar rings under the first), trims to n
// frames and scales to PEAK. Resolves the song's mono buffer, or null where there is no OfflineAudioContext or anything throws or rejects.
export async function renderSong(song, sr = 22050, Ctx = globalThis.OfflineAudioContext) {
  try {
    if (!Ctx) return null;
    const n = Math.ceil(songLength(song) * sr), m = Math.ceil(TAIL * sr), c = new Ctx(1, n + m, sr), nz = c.createBuffer(1, sr, sr), d = nz.getChannelData(0);
    for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1;
    for (const q of songNotes(song)) INST[q.i](c, q, c.destination, nz);
    const x = (await c.startRendering()).getChannelData(0), b = c.createBuffer(1, n, sr), y = b.getChannelData(0);
    for (let i = 0; i < n; i++) y[i] = x[i] + (i < m ? x[n + i] : 0);
    let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(y[i]));
    if (pk > PEAK) for (let i = 0, k = PEAK / pk; i < n; i++) y[i] *= k;
    return b;
  } catch { return null; }
}
// One promise per song, so a song that hangs or fails loses only itself. Each render starts after the last one's notes were
// scheduled and a timer tick has passed: the order is fixed, and boot is never blocked by more than one song's scheduling.
export function renderSongs(Ctx) {
  const o = {}; let gate = Promise.resolve();
  for (const k in SONGS) { gate = gate.then(() => new Promise(r => setTimeout(r))); const g = gate; o[k] = g.then(() => renderSong(SONGS[k], 22050, Ctx)).catch(() => null); }
  return o;
}
