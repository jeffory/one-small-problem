// Swept plasma bolts: each step tests the whole v*dt segment, so nothing tunnels.
// Bolt = {x,y,z,vx,vy,vz,dmg,r,life,col,team,src}; Hit = {b,t,x,y,z}, t null for ground.
const LIM = 256;
export function stepBolts(bolts, dt, ground, targets) {
  const hits = [];
  let w = 0;
  for (let bi = 0; bi < bolts.length; bi++) {
    const b = bolts[bi], ox = b.x, oy = b.y, oz = b.z, dx = b.vx * dt, dy = b.vy * dt, dz = b.vz * dt;
    const len = Math.hypot(dx, dy, dz);
    let best = 2, bt = null;
    // targets: ray vs sphere grown by bolt radius, earliest s in [0,1]
    const a = dx * dx + dy * dy + dz * dz;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.id === b.src) continue;
      const R = t.r + b.r, mx = ox - t.x, my = oy - t.y, mz = oz - t.z;
      // cheap reject: segment bounding box vs sphere
      if (t.x + R < Math.min(ox, ox + dx) || t.x - R > Math.max(ox, ox + dx) ||
          t.y + R < Math.min(oy, oy + dy) || t.y - R > Math.max(oy, oy + dy) ||
          t.z + R < Math.min(oz, oz + dz) || t.z - R > Math.max(oz, oz + dz)) continue;
      const c = mx * mx + my * my + mz * mz - R * R;
      let s;
      if (c <= 0) s = 0;
      else {
        if (a < 1e-12) continue;
        const bh = mx * dx + my * dy + mz * dz, disc = bh * bh - a * c;
        if (bh >= 0 || disc < 0) continue;
        s = (-bh - Math.sqrt(disc)) / a;
        if (s > 1) continue;
      }
      if (s < best) { best = s; bt = t; }
    }
    // ground: sample at most every 0.5 m along the segment
    let gs = -1;
    const n = Math.max(1, Math.ceil(len / 0.5));
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      if (s >= best) break;
      if (oy + dy * s <= ground(ox + dx * s, oz + dz * s)) { gs = s; break; }
    }
    let hit = null;
    if (gs >= 0) {
      const x = ox + dx * gs, z = oz + dz * gs;
      hit = { b, t: null, x, y: ground(x, z), z };
    } else if (bt) hit = { b, t: bt, x: ox + dx * best, y: oy + dy * best, z: oz + dz * best };
    if (hit) { hits.push(hit); continue; }
    b.x = ox + dx; b.y = oy + dy; b.z = oz + dz; b.life -= dt;
    if (b.life <= 0 || Math.abs(b.x) > LIM || Math.abs(b.z) > LIM) continue;
    bolts[w++] = b;
  }
  bolts.length = w;
  return hits;
}
