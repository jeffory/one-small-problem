// Mission Control's radio, spec 4.7. Cues from the opening and the fight pick lines from the SCRIPT, and a queue plays them one
// at a time: keyed up (a Quindar tone), spoken when a voice exists and always subtitled, keyed down, then a gap. Story lines (seq
// and crit cues) are never dropped and play first, in the order cued; behind them waits at most one reaction, the newest replacing
// any still waiting, dropped once it has waited RADIO.stale s; after a reaction the radio keeps quiet RADIO.chat s. The shell applies
// the actions stepRadio returns. Pure: its clock is R.clock, advanced only by stepRadio, and its randomness the rng it is made with.
import { SCRIPT, CUES } from './script.js';

// Seconds unless noted. key: each Quindar tone, before and after a line; gap: between lines; min: the shortest a line is up; cps:
// the reading speed (characters a second) that times a line with no voice; slack, pad: a voiced line whose onend never comes ends
// slack x its reading time + pad after it starts; stale: a reaction waiting longer is dropped; chat: the quiet after a reaction;
// low: the health under which a hit gets a "low" line; dawdle: play without progress per dawdle line; multi: [kills, within s].
export const RADIO = { key: .25, gap: .5, min: 1.6, cps: 14, slack: 1.5, pad: 2, stale: 5, chat: 4, low: 30, dawdle: 50, multi: [3, 4] };
const EPS = 1e-9, NONE = Object.freeze([]), PROGRESS = new Set(['kill', 'pickup', 'flag', 'golf', 'area', 'restart', 'hold']);
const PLAIN = { flag: 'grab', dead: 'dead', restart: 'restart', boom: 'boom', hold: 'hold', holdmsg: 'holding', houston: 'houston' };
const AREA_CUES = new Set(['crater', 'base', 'comms']);

// R.q: the lines waiting, {id, key, who (a WHO letter), text, crit, at (R.clock when cued), voiced}; R.cur: the line on the air.
// _t: when the phase began; _quiet: no reaction keys up before it; _used: once cues spent; _next: when each cooling cue is allowed
// again; _bags: each cue's unplayed lines; _kills: recent kill times; _idle: the dawdle clock; _id: the last line id.
export function createRadio(rng, script = SCRIPT, cues = CUES) {
  return { clock: 0, q: [], cur: null, phase: 'idle', _rng: rng, _script: script, _cues: cues, _t: 0, _quiet: 0, _used: {}, _next: {}, _bags: {}, _kills: [], _idle: 0, _id: 0 };
}

// One line index of cue key from its shuffle-bag, refilled when empty.
function draw(R, key, n) {
  let B = R._bags[key];
  if (!B || !B.length) B = R._bags[key] = Array.from({ length: n }, (_, i) => i);
  return B.splice(R._rng.int(B.length), 1)[0];
}

// Cues key (n: the line for an `at` cue). False if it is unknown, a spent once cue, cooling down or loses its chance roll.
export function radioCue(R, key, n) {
  const c = R._cues[key], L = R._script[key];
  if (!c || !L || (c.at && !L[n - 1]) || (c.once && R._used[key]) || R.clock < (R._next[key] ?? 0) || (c.p < 1 && R._rng.next() >= c.p)) return false;
  const crit = !!(c.seq || c.crit), q = R.q, picked = c.seq ? L : [L[c.at ? n - 1 : draw(R, key, L.length)]];
  let w = 0;
  while (w < q.length && q[w].crit) w++;
  if (!crit) q.length = w; // the newest reaction wins
  q.splice(w, 0, ...picked.map(s => ({ id: ++R._id, key, who: s[0], text: s.slice(2), crit, at: R.clock, voiced: false, done: false })));
  if (c.cool) R._next[key] = R.clock + c.cool;
  if (c.once) R._used[key] = true;
  return true;
}

// The fight's events as cues, one per event. The progress events restart the dawdle clock.
export function radioEvents(R, events, F) {
  for (const e of events) {
    const t = e.type;
    if (PROGRESS.has(t)) R._idle = 0;
    if (t === 'kill') {
      const K = R._kills, [many, within] = RADIO.multi;
      K.push(R.clock);
      while (R.clock - K[0] > within) K.shift();
      radioCue(R, e.n === 1 ? 'first' : K.length >= many ? (K.length = 0, 'multi') : e.kind === 'br' ? 'brute' : e.kind === 'fl' ? 'floater' : 'kill');
    } else if (t === 'hurt') {
      if (e.cause === 'fall') radioCue(R, 'fall');
      else if (F.hp < RADIO.low && F.state === 'play') radioCue(R, 'low');
    } else if (t === 'pickup') radioCue(R, e.kind);
    else if (t === 'golf') radioCue(R, 'golf', e.n);
    else if (t === 'area') { if (AREA_CUES.has(e.id)) radioCue(R, e.id); }
    else if (PLAIN[t]) radioCue(R, PLAIN[t]);
  }
}

const go = (R, phase, a) => { R.phase = phase; R._t = R.clock; return [a]; };
// The line in the air ends: a reaction keeps the radio quiet RADIO.chat s; a gap follows.
const over = R => { if (!R.cur.crit) R._quiet = R.clock + RADIO.chat; R.cur = null; return go(R, 'gap', { do: 'off' }); };

// dt seconds of the radio (voiced: a speech voice exists now; dawdle: the dawdle clock runs). At most one phase change a step,
// returned as actions: key (tone and subtitle up), say (speak it if voiced), unkey (tone, the keyed dot off), off (subtitle down).
export function stepRadio(R, dt, voiced, dawdle) {
  R.clock += dt;
  const now = R.clock, q = R.q, L = R.cur, el = now - R._t;
  if (dawdle && (R._idle += dt) >= RADIO.dawdle - EPS) { R._idle = 0; radioCue(R, 'dawdle'); }
  const last = q[q.length - 1];
  if (last && !last.crit && now - last.at > RADIO.stale) q.pop();
  switch (R.phase) {
    case 'idle':
      if (!q.length || !(q[0].crit || now >= R._quiet)) return NONE;
      R.cur = q.shift(); R.cur.voiced = !!voiced;
      return go(R, 'key', { do: 'key', line: R.cur });
    case 'key': return el < RADIO.key - EPS ? NONE : go(R, 'talk', { do: 'say', line: L });
    case 'talk': {
      const n = L.text.length, end = !L.voiced ? Math.max(RADIO.min, n / RADIO.cps) : L.done ? RADIO.min : RADIO.slack * n / RADIO.cps + RADIO.pad;
      return el < end - EPS ? NONE : go(R, 'unkey', { do: 'unkey', line: L });
    }
    case 'unkey': return el < RADIO.key - EPS ? NONE : over(R);
    default: if (el >= RADIO.gap - EPS) { R.phase = 'idle'; R._t = now; } return NONE; // the gap
  }
}

// onend for line id; one for any other line (a stale onend) is ignored.
export function radioDone(R, id) { if (R.cur && R.cur.id === id) R.cur.done = true; }

// The game pauses: a story line keyed or talking goes back to the head of the queue (a copy with a new id, so its cancelled
// utterance's onend can't end the replay) to play again from the start; a reaction is dropped. One keying down just ends.
export function pauseRadio(R) {
  const L = R.cur;
  if (R.phase === 'key' || R.phase === 'talk') {
    if (L.crit) R.q.unshift({ ...L, id: ++R._id, voiced: false, done: false });
    R.cur = null; go(R, 'idle', null);
    return [{ do: 'off' }];
  }
  return R.phase === 'unkey' ? over(R) : [];
}

// Nothing on the air or waiting.
export function radioIdle(R) { return !R.cur && !R.q.length && (R.phase === 'idle' || R.phase === 'gap'); }
