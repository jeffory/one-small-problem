import { THEMES, PROPS } from './base.js';

// The plan layout; the base plan carries each encounter's room after its p.
function planBytes(plan, withRoom) {
  const T = { sk: 0, fl: 1, br: 2 }, K = { tape: 0, cells: 1 }, f = [];
  for (const e of plan.encounters) {
    f.push(e.area, e.x, e.z, e.p);
    if (withRoom) f.push(e.room);
    for (const a of e.aliens) f.push(T[a.type], a.x, a.y, a.z);
  }
  for (const u of plan.pickups) f.push(u.area, K[u.kind], u.x, u.y, u.z);
  for (const c of plan.canisters) f.push(c.area, c.x, c.y, c.z);
  for (const g of plan.golf) f.push(g.id, g.x, g.y, g.z);
  return new Float32Array(f);
}

export function checksumWorld(world) {
  const rocks = new Float32Array(world.rocks.length * 6);
  world.rocks.forEach((k, i) => rocks.set([k.x, k.y, k.z, k.sx, k.sy, k.sz], i * 6));
  const route = new Float32Array(world.route.flat());
  const parts = [world.h, world.occ, route, rocks];
  // optional parts follow in a fixed order: plan, then crater, then baseMap
  if (world.plan) parts.push(planBytes(world.plan, false));
  if (world.crater) {
    const K = world.crater, { door: d, use: u, bunker: b } = K;
    parts.push(new Float32Array([...K.path.flat(), ...K.ys, d.x, d.y, d.z, d.dx, d.dz, u.x, u.z, b.x, b.z, b.ux, b.uz, b.w, b.d, b.h, b.y]));
  }
  if (world.baseMap) {
    const B = world.baseMap, f = [];
    parts.push(B.floor, B.ceil, B.kind, B.room);
    for (const r of B.rooms) f.push(r.x0, r.z0, r.x1, r.z1, r.floor, r.ceil, THEMES.indexOf(r.theme));
    for (const l of B.links) f.push(l.a, l.b, l.loop ? 1 : 0, l.x0, l.z0, l.x1, l.z1);
    for (const l of B.lights || []) f.push(l.x, l.y, l.z, l.r, ...l.col, l.kind);
    for (const p of B.props) f.push(PROPS.indexOf(p.kind), p.x, p.y, p.z, p.w, p.d, p.dx, p.dz);
    for (const o of [B.start, B.commsDoor, ...B.spawnDoors]) f.push(o.x, o.z, o.dx, o.dz);
    parts.push(new Float32Array(f));
    if (B.plan) parts.push(planBytes(B.plan, true));
  }
  let hash = 2166136261;
  for (const arr of parts) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
