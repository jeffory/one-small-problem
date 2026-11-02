// The end screen's numbers (pure): m:ss times, the share link for a seed, and the best time per seed. The store is
// localStorage or a stand-in; every read and write is inside try/catch, so a store that throws, holds garbage or is null
// just means no best (Review Focus 4).

// Seconds as m:ss, the seconds floored.
export function fmtTime(s) {
  const t = Math.floor(s);
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

// The page's own address without its hash, plus #SEED; from disk (file://) there is no link to share.
export function shareLink(href, seed) {
  return href.startsWith('file:') ? null : href.split('#')[0] + '#' + seed;
}

// The best time for a seed lives under osp.best.SEED as seconds. A lower time, or the first one, is written and is new.
export function recordBest(store, seed, time) {
  try {
    const key = 'osp.best.' + seed, v = parseFloat(store.getItem(key)), best = v >= 0 ? v : null; // NaN and garbage: no best
    if (best !== null && best <= time) return { best, isNew: false };
    store.setItem(key, String(time));
    return { best: time, isNew: true };
  } catch { return { best: null, isNew: false }; }
}
