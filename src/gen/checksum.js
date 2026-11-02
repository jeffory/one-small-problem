export function checksumWorld(world) {
  const rocks = new Float32Array(world.rocks.length * 6);
  world.rocks.forEach((k, i) => rocks.set([k.x, k.y, k.z, k.sx, k.sy, k.sz], i * 6));
  const route = new Float32Array(world.route.flat());
  const parts = [world.h, world.occ, route, rocks];
  // optional parts follow in a fixed order: plan, then crater and baseMap (later tasks)
  if (world.plan) {
    const T = { sk: 0, fl: 1, br: 2 }, K = { tape: 0, cells: 1 }, f = [];
    for (const e of world.plan.encounters) {
      f.push(e.x, e.z, e.p);
      for (const a of e.aliens) f.push(T[a.type], a.x, a.y, a.z);
    }
    for (const u of world.plan.pickups) f.push(K[u.kind], u.x, u.y, u.z);
    for (const c of world.plan.canisters) f.push(c.x, c.y, c.z);
    parts.push(new Float32Array(f));
  }
  let hash = 2166136261;
  for (const arr of parts) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
