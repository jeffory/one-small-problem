// A recording stand-in for WebGL2: create* hands out tracked handles, delete* frees them (a double free throws), CONSTANTS are numbers, the rest do nothing.
export function fakeGL() {
  const live = new Set(), own = { live };
  return new Proxy(own, {
    get(o, k) {
      if (k in o) return o[k];
      if (typeof k !== 'string') return undefined;
      if (/^[A-Z][A-Z0-9_]*$/.test(k)) return 1;
      const m = /^(create|delete)([A-Z]\w*)$/.exec(k);
      if (m && m[1] === 'create') return () => { const h = { kind: m[2] }; live.add(h); return h; };
      if (m) return h => { if (!live.delete(h)) throw new Error('double free or foreign handle: ' + k); };
      return () => {};
    },
  });
}
