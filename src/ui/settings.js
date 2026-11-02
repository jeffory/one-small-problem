// The player's settings (pure): render height, palette, volume, mouse sensitivity and invert-Y. The store is localStorage or a
// stand-in; every read and write is inside try/catch, so a store that throws, holds garbage or is null means the defaults
// (Review Focus 4). Each field is checked on its own.
export const RES = [180, 270, 360, 0]; // internal heights; 0 is native
export const DEFAULTS = { res: 1, pal: true, vol: .8, sens: 1, invert: false };
const KEY = 'osp.settings', num = (v, lo, hi, d) => typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;

export function cleanSettings(o) {
  o = o && typeof o === 'object' ? o : {};
  return {
    res: Number.isInteger(o.res) && o.res >= 0 && o.res <= 3 ? o.res : DEFAULTS.res,
    pal: typeof o.pal === 'boolean' ? o.pal : DEFAULTS.pal,
    vol: num(o.vol, 0, 1, DEFAULTS.vol),
    sens: num(o.sens, .25, 3, DEFAULTS.sens),
    invert: typeof o.invert === 'boolean' ? o.invert : DEFAULTS.invert,
  };
}
export function loadSettings(store) {
  try { return cleanSettings(JSON.parse(store.getItem(KEY))); } catch { return { ...DEFAULTS }; }
}
export function saveSettings(store, s) {
  try { store.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}
