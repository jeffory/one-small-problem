// The audio engine. Nothing here may break the game: no AudioContext, a constructor or node that throws, a suspended context and
// rejected resume/suspend promises are all survived (every public method catches its own errors), and the context is only made
// by start(), on the user's first New Game click. Buses: sfx -> air filter -> master, music -> master, radio -> master (with the
// noise bed). In vacuum the filter is a low-pass at MIX.vacuum Hz, a thud through the suit; in the base it is open.
import { ZZFX_RATE } from './zzfx.js';
export const MIX = { music: .45, sfx: .7, radio: .5, duck: .35, vacuum: 380, air: 18000, tones: [2525, 2475], tone: .25, toneVol: .12, bed: .025, gap: .06 };
const quiet = p => { try { p?.catch?.(() => {}); } catch {} };
export function createAudio({ AC = globalThis.AudioContext ?? globalThis.webkitAudioContext, sfx, songs = null }) {
  let ctx = null, dead = !AC, G = null, bufs = {}, vol = 1, inAir = false, ducked = false, song = null, plays = 0;
  const last = {}, safe = f => (...a) => { if (dead) return; try { return f(...a); } catch { /* audio never breaks the game */ } };
  const gain = (v, to) => { const g = ctx.createGain(); g.gain.value = v; g.connect(to); return g; };
  const musicLevel = () => MIX.music * (ducked ? MIX.duck : 1);
  const ramp = (param, v, k = .08) => { try { param.setTargetAtTime(v, ctx.currentTime, k); } catch { param.value = v; } };
  const A = {
    start: () => {
      if (dead) return;
      try {
        if (!ctx) {
          const c = new AC();
          const master = c.createGain(); master.gain.value = vol; master.connect(c.destination);
          const g = { c, master }; ctx = c;
          g.music = gain(musicLevel(), master); g.radio = gain(MIX.radio, master);
          g.filter = c.createBiquadFilter(); g.filter.type = 'lowpass'; g.filter.frequency.value = inAir ? MIX.air : MIX.vacuum; g.filter.connect(master);
          g.sfx = gain(MIX.sfx, g.filter);
          g.bed = gain(0, g.radio); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = .7; bp.connect(g.bed);
          const nb = c.createBuffer(1, ZZFX_RATE, ZZFX_RATE), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          const ns = c.createBufferSource(); ns.buffer = nb; ns.loop = true; ns.connect(bp); ns.start();
          for (const k in sfx) { const b = c.createBuffer(1, sfx[k].length, ZZFX_RATE); b.getChannelData(0).set(sfx[k]); bufs[k] = b; }
          G = g;
        }
        quiet(ctx.resume());
      } catch { dead = true; ctx = G = null; }
    },
    sfx: safe((name, v = 1) => {
      if (!G || !bufs[name]) return; const t = ctx.currentTime;
      if (t - (last[name] ?? -1e9) < MIX.gap) return;
      last[name] = t; const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = bufs[name]; g.gain.value = v; s.connect(g); g.connect(G.sfx); s.start(); plays++;
    }),
    air: safe(on => { inAir = !!on; if (G) ramp(G.filter.frequency, on ? MIX.air : MIX.vacuum, .02); }),
    duck: safe(on => { ducked = !!on; if (G) ramp(G.music.gain, musicLevel()); }),
    key: safe(up => {
      if (!G) return; const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.frequency.value = MIX.tones[up ? 0 : 1]; g.gain.value = MIX.toneVol; o.connect(g); g.connect(G.radio); o.start(t); o.stop(t + MIX.tone);
      const s = ctx.createBufferSource(); s.buffer = bufs.static; if (s.buffer) { s.connect(G.radio); s.start(t); }
    }),
    bed: safe(on => { if (G) ramp(G.bed.gain, on ? MIX.bed : 0, .05); }),
    volume: safe(v => { vol = v; if (G) G.master.gain.value = v; }),
    song: safe(name => { song = name ?? null; }),
    pause: safe(() => { if (ctx) quiet(ctx.suspend()); }),
    resume: safe(() => { if (ctx) quiet(ctx.resume()); }),
    info: () => ({ ctx: ctx ? ctx.state : null, air: inAir, duck: ducked, cut: G ? G.filter.frequency.value : null, music: G ? G.music.gain.value : null, plays, song,
      songs: songs ? Object.keys(songs) : [] }),
  };
  return A;
}
