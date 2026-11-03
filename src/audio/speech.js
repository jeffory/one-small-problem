// The radio's voice: the browser's own speech synthesis (spec 4.7), which can't go through Web Audio, so the radio filter never
// touches it. Nothing waits for a voice: the voices are read now and again on every voiceschanged (Chrome's online voices can take
// seconds, some setups have none), and until Houston's is cast ok is false and lines run as subtitles only. Every method catches its own
// errors: no speechSynthesis, no SpeechSynthesisUtterance, or a throwing speak never break the game.
import { VOICE } from '../game/script.js';

// Casts the radio's four speakers from the browser's voices (Plan 5). Pure; each field is a voice from all, or null. The list is the
// English voices (every voice if there are none), local first then by name, so input order never matters; the pool is its local
// voices if any (Chrome's online voices on Linux are the ones that misbehave, R15). Houston takes the pool's first en-US, You the
// pool's first voice with another accent, the Switchboard the list's first voice that is neither, the Pilot the list's first voice that is none of those three (else the Switchboard's), and each falls back to Houston.
export function castVoices(all) {
  const none = { H: null, Y: null, S: null, P: null };
  try {
    const en = (all || []).filter(v => /^en/i.test(v?.lang || '')), src = en.length ? en : (all || []).filter(v => v);
    const name = v => String(v.name || ''), list = [...src].sort((a, b) => (!!b.localService - !!a.localService) || (name(a) < name(b) ? -1 : name(a) > name(b) ? 1 : 0));
    const local = list.filter(v => v.localService), pool = local.length ? local : list, acc = v => String(v.lang || '').replace('_', '-').toLowerCase();
    const H = pool.find(v => acc(v) === 'en-us') || list[0] || null;
    const Y = pool.find(v => name(v) !== name(H) && acc(v) !== acc(H)) || list.find(v => name(v) !== name(H)) || H;
    const S = list.find(v => name(v) !== name(H) && name(v) !== name(Y)) || H;
    const P = list.find(v => name(v) !== name(H) && name(v) !== name(Y) && name(v) !== name(S)) || S;
    return { H, Y, S, P };
  } catch { return none; }
}

export function createSpeech(win = globalThis) {
  let cast = castVoices([]), vol = 1;
  const recast = () => { try { cast = castVoices(win.speechSynthesis.getVoices() || []); } catch { cast = castVoices([]); } };
  try { if (win.speechSynthesis) { recast(); win.speechSynthesis.addEventListener('voiceschanged', recast); } } catch {}
  return {
    get ok() { return !!cast.H; },
    // Speaks line {who, text} at its speaker's pitch and rate, cancelling anything queued. onEnd(failed) runs once: on its end, or
    // on an error, failed unless the error is our own cancel (interrupted or canceled), so a voice that fails leaves the line to
    // its subtitle (R15). False if it could not be spoken.
    say(line, onEnd) {
      try {
        const S = win.speechSynthesis; if (!S) return false;
        S.cancel();
        const u = new win.SpeechSynthesisUtterance(line.text), [pitch, rate] = VOICE[line.who] || [1, 1];
        let ended = false; const end = failed => { if (!ended) { ended = true; try { onEnd(failed); } catch {} } };
        const voice = cast[line.who] || cast.H; if (voice) { u.voice = voice; u.lang = voice.lang; }
        u.pitch = pitch; u.rate = rate; u.volume = vol;
        u.onend = () => end(false); u.onerror = e => end(!/^(interrupted|canceled)$/.test(e?.error));
        S.speak(u);
        return true;
      } catch { return false; }
    },
    cancel() { try { win.speechSynthesis?.cancel(); } catch {} },
    volume(v) { vol = v; },
  };
}
