// Seeded RNG: xmur3 string hash feeding sfc32. Pure integer math, deterministic everywhere.
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const h = xmur3(seed);
  const f = sfc32(h(), h(), h(), h());
  return {
    next: f,
    range(a, b) { return a + f() * (b - a); },
    int(n) { return Math.floor(f() * n); },
  };
}

export function normalizeSeed(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw);
  if (s.charAt(0) === '#') s = s.slice(1);
  try { s = decodeURIComponent(s); } catch (e) { /* keep raw text */ }
  if (/[^\x00-\x7e]/.test(s)) return 'X-' + xmur3(s)().toString(16).toUpperCase().padStart(8, '0');
  s = s.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
  return s.length ? s : null;
}

export const SEED_WORDS = ('APOLLO EAGLE SATURN LUNA SELENE ORION AQUARIUS FALCON CHALLENGER SNOOPY SPIDER ' +
  'INTREPID ANTARES YANKEE GUMDROP ODYSSEY CASPER AMERICA COLUMBIA KITTYHAWK ENDEAVOUR CRATER REGOLITH MARE ' +
  'HOUSTON CAPCOM QUINDAR GEMINI MERCURY TITAN HADLEY DESCARTES').split(' ');

export function seedName(rng) {
  return SEED_WORDS[rng.int(32)] + '-' + String(rng.int(10000)).padStart(4, '0');
}
