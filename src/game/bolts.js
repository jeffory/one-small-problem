// Swept plasma bolts: each step tests the whole v*dt segment, so nothing tunnels.
// Bolt = {x,y,z,vx,vy,vz,dmg,r,life,col,team,src}; Hit = {b,t,x,y,z,n}: t is null and n the face normal for a level hit
// (floor, wall face or ceiling); a target hit has a t and no n.
const LIM = 256, RISE = .35;

// The floor's normal from central differences at +-0.5 m. A neighbour more than RISE above or below the centre (a wall or a
// ledge) counts as the centre's height, so a step isn't read as a slope.
export function groundNormal(ground, x, z) {
  const c = ground(x, z), at = (u, v) => { const g = ground(u, v); return Math.abs(g - c) > RISE ? c : g; };
  const gx = at(x + .5, z) - at(x - .5, z), gz = at(x, z + .5) - at(x, z - .5), l = Math.hypot(gx, 1, gz);
  return [-gx / l, 1 / l, -gz / l];
}

// Inside the floor, or (indoors) at or above the ceiling.
const solid = (ground, ceil, x, y, z) => y <= ground(x, z) || (ceil && y >= ceil(x, z));

export function stepBolts(bolts, dt, ground, targets, ceil = null) {
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
    // level: sample at most every 0.5 m along the segment
    const at = s => solid(ground, ceil, ox + dx * s, oy + dy * s, oz + dz * s);
    let gs = -1, fs = len > 0 ? -.5 / len : 0; // fs: the last free sample (before the first, half a metre back)
    const n = Math.max(1, Math.ceil(len / 0.5));
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      if (s >= best) break;
      if (at(s)) { gs = s; break; }
      fs = s;
    }
    let hit = null;
    if (gs >= 0) hit = levelHit(b, ground, ceil, ox, oy, oz, dx, dy, dz, gs, fs, at);
    else if (bt) hit = { b, t: bt, x: ox + dx * best, y: oy + dy * best, z: oz + dz * best };
    if (hit) { hits.push(hit); continue; }
    b.x = ox + dx; b.y = oy + dy; b.z = oz + dz; b.life -= dt;
    if (b.life <= 0 || Math.abs(b.x) > LIM || Math.abs(b.z) > LIM) continue;
    bolts[w++] = b;
  }
  bolts.length = w;
  return hits;
}

// The bolt's path is solid at s1 and free at s0 (the sample before; for a bolt that starts inside the level, half a metre
// back along its path, if that is free). Bisect 8 times, report the hit at the free end and say which face it hit:
// a wall (it is in ground that rose more than RISE) or a soffit (it is in a ceiling that dropped more than RISE) is a vertical
// face, met at the bolt's own height, with the normal of the axis it crossed; otherwise the ceiling or the floor.
function levelHit(b, ground, ceil, ox, oy, oz, dx, dy, dz, s1, s0, at) {
  if (at(s0)) s0 = s1; // it started inside the level and half a metre back is too: report where it started
  else for (let i = 0; i < 8; i++) { const m = (s0 + s1) / 2; if (at(m)) s1 = m; else s0 = m; }
  const x = ox + dx * s0, y = oy + dy * s0, z = oz + dz * s0, sx = ox + dx * s1, sy = oy + dy * s1, sz = oz + dz * s1;
  const g = ground(x, z), c = ceil ? ceil(x, z) : 0;
  const face = (u, v) => { const gu = ground(u, v); if (gu - g > RISE && sy <= gu) return true; const cu = ceil ? ceil(u, v) : c; return c - cu > RISE && sy >= cu; };
  if (face(sx, sz)) {
    const fx = face(sx, z), fz = face(x, sz), ax = fx !== fz ? fx : Math.abs(dx) >= Math.abs(dz);
    return { b, t: null, x, y, z, n: ax ? [dx > 0 ? -1 : 1, 0, 0] : [0, 0, dz > 0 ? -1 : 1] };
  }
  if (ceil && sy >= ceil(sx, sz)) return { b, t: null, x, y: c, z, n: [0, -1, 0] };
  return { b, t: null, x, y: g, z, n: groundNormal(ground, x, z) };
}
