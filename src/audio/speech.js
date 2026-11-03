// The radio's voice: the browser's own speech synthesis (spec 4.7), which can't go through Web Audio, so the radio filter never
// touches it. Nothing waits for a voice: the voices are read now and again on every voiceschanged (Chrome's online voices can take
// seconds, some setups have none), and until one is chosen ok is false and lines run as subtitles only. Every method catches its own
// errors: no speechSynthesis, no SpeechSynthesisUtterance, or a throwing speak never break the game.
import { VOICE } from '../game/script.js';

export function createSpeech(win = globalThis) {
  let voice = null, vol = 1;
  // An English local voice, else any English one, else the first.
  const choose = () => {
    try { const all = win.speechSynthesis.getVoices() || [], en = all.filter(v => /^en/i.test(v.lang || '')); voice = en.find(v => v.localService) || en[0] || all[0] || null; } catch { voice = null; }
  };
  try { if (win.speechSynthesis) { choose(); win.speechSynthesis.addEventListener('voiceschanged', choose); } } catch {}
  return {
    get ok() { return !!voice; },
    // Speaks line {who, text} at its speaker's pitch and rate, cancelling anything queued; onEnd runs once, on its end or an
    // error. False if it could not be spoken.
    say(line, onEnd) {
      try {
        const S = win.speechSynthesis; if (!S) return false;
        S.cancel();
        const u = new win.SpeechSynthesisUtterance(line.text), [pitch, rate] = VOICE[line.who] || [1, 1];
        let ended = false;
        if (voice) { u.voice = voice; u.lang = voice.lang; }
        u.pitch = pitch; u.rate = rate; u.volume = vol;
        u.onend = u.onerror = () => { if (!ended) { ended = true; try { onEnd(); } catch {} } };
        S.speak(u);
        return true;
      } catch { return false; }
    },
    cancel() { try { win.speechSynthesis?.cancel(); } catch {} },
    volume(v) { vol = v; },
  };
}
