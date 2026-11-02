// The alien base: a room graph on an 8 x 8 coarse grid of 12-tile cells, laid out as 96 x 96 tiles of 1 m, each
// with a floor and a ceiling height. Themes follow the critical path from the lift to the comms room. A layout that
// fails to construct or is rejected re-rolls with a fresh rng, up to BASE.attempts (32) attempts (ruling R2).
import { makeRng } from './rng.js';
import { reachMap } from './passable.js';

export const BASE = { n: 96, cell: 12, grid: 8, wall: 99, step: .35, minHead: 2.6, corridor: 3, lintel: 2.7, cover: 1.1, attempts: 32,
  crit: [8, 12], side: [3, 5], loops: [1, 2],
  ceil: { lift: 3.5, side: 3.5, plain: [4, 5], hangar: 8, lab: 4.5, reactor: 9, greenhouse: 6, comms: 9, corridor: 3 },
  size: { lift: 6, hangar: 10, lab: 9, reactor: 10, greenhouse: 10, side: [5, 7], plain: [6, 9] } };
export const THEME_AT = { hangar: 1, lab: .35, reactor: .6, greenhouse: .8 };
export const THEMES = ['plain', 'side', 'lift', 'hangar', 'lab', 'reactor', 'greenhouse', 'comms'];
export const PROPS = ['lift', 'saucer', 'jarRover', 'jarProbe', 'jar', 'core', 'bed', 'dish', 'strip'];
export const K = { wall: 0, floor: 1, cover: 2, prop: 3 };

// Neighbour offsets in scan order (-z, -x, +x, +z), and the four inward wall normals of a room.
const DIRS = [[0, -1], [-1, 0], [1, 0], [0, 1]], NORMALS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const CRATE = [[2, 1], [1, 2]], BED = [[2, 3], [3, 2]], TRIES = 40;
const span = (rng, r) => r[0] + rng.int(r[1] - r[0] + 1);
const gap = (v, lo, hi) => v < lo ? lo - v : v > hi ? v - hi : 0;
const prop = (kind, x, y, z, w = 0, d = 0, dx = 0, dz = 0) => ({ kind, x, y, z, w, d, dx, dz });

// One attempt. Returns null when the construction fails (see the brief: dead-end walk, no comms block, no side-room
// cell, no loop candidate, no spot for a required piece).
function build(seed, attempt, rng) {
  const { n, cell: C, grid: G } = BASE, half = n >> 1, T = (i, j) => j * n + i;
  const own = new Int16Array(G * G).fill(-1), at = (x, y) => x >= 0 && x < G && y >= 0 && y < G ? own[y * G + x] : -2;

  // 1. The critical path: L - 1 single cells by a self-avoiding walk, then the 2 x 2 comms block beside the last one.
  const L = span(rng, BASE.crit), cells = [];
  let x = rng.int(G), y = rng.int(G);
  own[y * G + x] = 0; cells.push([[x, y]]);
  for (let k = 1; k < L - 1; k++) {
    const free = [];
    for (const [dx, dy] of DIRS) if (at(x + dx, y + dy) === -1) free.push([x + dx, y + dy]);
    if (!free.length) return null;
    [x, y] = free[rng.int(free.length)]; own[y * G + x] = k; cells.push([[x, y]]);
  }
  const blocks = [];
  for (let by = 0; by < G - 1; by++) for (let bx = 0; bx < G - 1; bx++) {
    if (own[by * G + bx] !== -1 || own[by * G + bx + 1] !== -1 || own[(by + 1) * G + bx] !== -1 || own[(by + 1) * G + bx + 1] !== -1) continue;
    if ((x >= bx - 1 && x <= bx + 2 && y >= by && y <= by + 1) || (x >= bx && x <= bx + 1 && y >= by - 1 && y <= by + 2)) blocks.push([bx, by]);
  }
  if (!blocks.length) return null;
  const [bx, by] = blocks[rng.int(blocks.length)];
  own[by * G + bx] = own[by * G + bx + 1] = own[(by + 1) * G + bx] = own[(by + 1) * G + bx + 1] = L - 1;
  cells.push([[bx, by], [bx + 1, by], [bx, by + 1], [bx + 1, by + 1]]);
  // Links remember the two cells they cross; the comms end is its block cell beside the last path cell.
  const links = [], lc = [];
  const link = (a, b, loop, ca, cb) => { links.push({ a, b, loop, x0: 0, z0: 0, x1: 0, z1: 0 }); lc.push([ca, cb]); };
  for (let k = 0; k < L - 2; k++) link(k, k + 1, false, cells[k][0], cells[k + 1][0]);
  link(L - 2, L - 1, false, [x, y], [Math.min(Math.max(x, bx), bx + 1), Math.min(Math.max(y, by), by + 1)]);

  // 2. Side rooms: free cells beside path rooms 1 .. L-2.
  const S = span(rng, BASE.side), parent = [];
  for (let s = 0; s < S; s++) {
    const cand = [];
    for (let cy = 0; cy < G; cy++) for (let cx = 0; cx < G; cx++) if (own[cy * G + cx] === -1)
      for (const [dx, dy] of DIRS) { const o = at(cx + dx, cy + dy); if (o >= 1 && o <= L - 2) cand.push([cx, cy, o]); }
    if (!cand.length) return null;
    const [cx, cy, o] = cand[rng.int(cand.length)];
    own[cy * G + cx] = L + s; cells.push([[cx, cy]]); parent.push(o);
    link(o, L + s, false, cells[o][0], [cx, cy]);
  }

  // 3. Loops between unlinked neighbours, never the lift or the comms room.
  const target = span(rng, BASE.loops), loops = [], ok = (r) => r > 0 && r !== L - 1;
  const linked = (a, b) => links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
  for (let cy = 0; cy < G; cy++) for (let cx = 0; cx < G; cx++) {
    const a = own[cy * G + cx];
    if (!ok(a)) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const b = at(cx + dx, cy + dy);
      if (ok(b) && b !== a && !linked(a, b)) loops.push([a, b, [cx, cy], [cx + dx, cy + dy]]);
    }
  }
  if (!loops.length) return null;
  for (let t = 0; t < target && loops.length; t++) { const [a, b, ca, cb] = loops.splice(rng.int(loops.length), 1)[0]; link(a, b, true, ca, cb); }

  // 4. Themes along the path.
  const theme = [];
  for (let k = 0; k < L; k++) theme.push('plain');
  theme[0] = 'lift'; theme[THEME_AT.hangar] = 'hangar'; theme[L - 1] = 'comms';
  for (const t of ['lab', 'reactor', 'greenhouse']) theme[Math.round(THEME_AT[t] * (L - 1))] = t;
  for (let s = 0; s < S; s++) theme.push('side');

  // 5. Rooms to tiles. Every single-cell room covers its cell's central band [+4, +8) and keeps a wall tile at each
  //    cell edge; the comms room covers its block from +2 to +22, so its outer bands +0 and +23 always stay wall.
  const floor = new Float32Array(n * n).fill(BASE.wall), ceil = new Float32Array(n * n), kind = new Uint8Array(n * n), room = new Int16Array(n * n).fill(-1);
  const place = (c, wd) => { const lo = Math.max(c + 1, c + 8 - wd), hi = Math.min(c + 4, c + 11 - wd); return lo + rng.int(hi - lo + 1); };
  const rooms = [];
  for (let id = 0; id < L + S; id++) {
    const th = theme[id], cs = cells[id];
    let x0, z0, x1, z1;
    if (th === 'comms') { x0 = bx * C + 2; z0 = by * C + 2; x1 = x0 + 20; z1 = z0 + 20; }
    else {
      const sz = BASE.size[th], wd = typeof sz === 'number' ? sz : span(rng, sz), ht = typeof sz === 'number' ? sz : span(rng, sz);
      x0 = place(cs[0][0] * C, wd); z0 = place(cs[0][1] * C, ht); x1 = x0 + wd; z1 = z0 + ht;
    }
    const c = th === 'plain' ? rng.range(BASE.ceil.plain[0], BASE.ceil.plain[1]) : BASE.ceil[th];
    rooms.push({ id, cells: cs, x0, z0, x1, z1, floor: 0, ceil: c, theme: th, crit: id < L ? id : -1, parent: id < L ? -1 : parent[id - L], in: null });
    for (let j = z0; j < z1; j++) for (let i = x0; i < x1; i++) { const t = T(i, j); kind[t] = K.floor; floor[t] = 0; ceil[t] = c; room[t] = id; }
  }

  // 6. Corridors: 3 wide across the shared cell edge, between the rooms' facing sides, lintels at both ends.
  //    The room tiles at each end are doorway tiles; the entered room's `in` sits on the middle row, one step inside.
  const doors = rooms.map(() => []), into = rooms.map(() => null), tile = (i, j) => ({ x: i - half, z: j - half }), W = BASE.corridor;
  links.forEach((l, k) => {
    const [ca, cb] = lc[k], A = rooms[l.a], Bm = rooms[l.b], xl = ca[1] === cb[1];
    const lo = (xl ? ca[0] < cb[0] : ca[1] < cb[1]) ? A : Bm, hi = lo === A ? Bm : A, r0 = (xl ? ca[1] : ca[0]) * C + 4 + rng.int(2);
    if (xl) { l.x0 = lo.x1; l.x1 = hi.x0; l.z0 = r0; l.z1 = r0 + W; } else { l.z0 = lo.z1; l.z1 = hi.z0; l.x0 = r0; l.x1 = r0 + W; }
    for (let j = l.z0; j < l.z1; j++) for (let i = l.x0; i < l.x1; i++) {
      const t = T(i, j), end = xl ? i === l.x0 || i === l.x1 - 1 : j === l.z0 || j === l.z1 - 1;
      kind[t] = K.floor; floor[t] = 0; ceil[t] = end ? BASE.lintel : BASE.ceil.corridor;
    }
    for (let m = 0; m < W; m++) {
      if (xl) { doors[lo.id].push([l.x0 - 1, r0 + m]); doors[hi.id].push([l.x1, r0 + m]); }
      else { doors[lo.id].push([r0 + m, l.z0 - 1]); doors[hi.id].push([r0 + m, l.z1]); }
    }
    if (l.loop) return;
    const inHi = Bm === hi, d = xl ? (inHi ? [1, 0] : [-1, 0]) : (inHi ? [0, 1] : [0, -1]), mid = r0 + (W >> 1);
    Bm.in = xl ? tile(inHi ? l.x1 : l.x0 - 1, mid) : tile(mid, inHi ? l.z1 : l.z0 - 1);
    into[l.b] = d;
  });

  // 7. Features. Every footprint keeps a one-tile ring of its own room's floor (rings may be shared), sits on one
  //    floor height and stays 2 tiles (Chebyshev) from every doorway tile; centrepieces only need the ring.
  const props = [], spawnDoors = [];
  const fits = (r, px, pz, fw, fh) => {
    if (px < r.x0 + 1 || pz < r.z0 + 1 || px + fw > r.x1 - 1 || pz + fh > r.z1 - 1) return false;
    const f0 = floor[T(px, pz)];
    for (let j = pz - 1; j <= pz + fh; j++) for (let i = px - 1; i <= px + fw; i++) {
      const t = T(i, j);
      if (kind[t] !== K.floor || room[t] !== r.id) return false;
      if (i >= px && i < px + fw && j >= pz && j < pz + fh && floor[t] !== f0) return false;
    }
    for (const [di, dj] of doors[r.id]) if (Math.max(gap(di, px, px + fw - 1), gap(dj, pz, pz + fh - 1)) < 2) return false;
    return true;
  };
  // A required piece picks among every valid spot in scan order; an optional one gets TRIES random tries.
  const feature = (r, shapes, required, k, rise, name) => {
    let spot = null;
    if (required) {
      const c = [];
      for (let pz = r.z0 + 1; pz < r.z1 - 1; pz++) for (let px = r.x0 + 1; px < r.x1 - 1; px++)
        for (const s of shapes) if (fits(r, px, pz, s[0], s[1])) c.push([px, pz, s[0], s[1]]);
      if (c.length) spot = c[rng.int(c.length)];
    } else for (let t = 0; t < TRIES && !spot; t++) {
      const s = shapes[shapes.length > 1 ? rng.int(shapes.length) : 0];
      const px = r.x0 + 1 + rng.int(r.x1 - r.x0 - 1 - s[0]), pz = r.z0 + 1 + rng.int(r.z1 - r.z0 - 1 - s[1]);
      if (fits(r, px, pz, s[0], s[1])) spot = [px, pz, s[0], s[1]];
    }
    if (!spot) return false;
    const [px, pz, fw, fh] = spot, base = floor[T(px, pz)];
    for (let j = pz; j < pz + fh; j++) for (let i = px; i < px + fw; i++) {
      const t = T(i, j);
      kind[t] = k;
      if (k === K.wall) { floor[t] = BASE.wall; ceil[t] = 0; } else floor[t] = base + rise;
    }
    if (name) props.push(prop(name, px + fw / 2 - .5 - half, base, pz + fh / 2 - .5 - half, name === 'bed' ? fw : 0, name === 'bed' ? fh : 0));
    return true;
  };
  // Tiles within R m of the room centre (doubled coordinates keep the test in integers).
  const disc = (r, R, k, fl, ce) => {
    const sx = r.x0 + r.x1 - 1, sz = r.z0 + r.z1 - 1;
    for (let j = r.z0; j < r.z1; j++) for (let i = r.x0; i < r.x1; i++) {
      const t = T(i, j), u = 2 * i - sx, v = 2 * j - sz;
      if (u * u + v * v <= 4 * R * R) { kind[t] = k; floor[t] = fl; if (ce >= 0) ceil[t] = ce; }
    }
  };
  const band = (r, inset, fn) => { for (let j = r.z0 + inset; j < r.z1 - inset; j++) for (let i = r.x0 + inset; i < r.x1 - inset; i++) fn(T(i, j)); };
  for (const r of rooms) {
    const w = r.x1 - r.x0, h = r.z1 - r.z0, cx = (r.x0 + r.x1 - 1) / 2 - half, cz = (r.z0 + r.z1 - 1) / 2 - half, th = r.theme;
    if (th === 'lift') props.push(prop('lift', cx, 0, cz));
    else if (th === 'hangar') { disc(r, 2.5, K.prop, 2, -1); props.push(prop('saucer', cx, 0, cz, 5)); }
    else if (th === 'reactor') { disc(r, 1.6, K.prop, BASE.wall, 0); props.push(prop('core', cx, 0, cz, 0, r.ceil)); }
    else if (th === 'lab') {
      if (!feature(r, [[2, 2]], true, K.prop, 2.4, 'jarRover') || !feature(r, [[2, 2]], true, K.prop, 2.4, 'jarProbe')) return null;
      for (let k = 2 + rng.int(3); k > 0; k--) feature(r, [[1, 1]], false, K.prop, 1.8, 'jar');
    } else if (th === 'greenhouse') {
      const beds = 2 + rng.int(3);
      if (!feature(r, BED, true, K.prop, .5, 'bed')) return null;
      for (let k = 1; k < beds; k++) feature(r, BED, false, K.prop, .5, 'bed');
    } else if (th === 'plain') {
      if (w >= 7 && h >= 7 && rng.next() < .4) { const lift = rng.next() < .5 ? .3 : -.3; band(r, 2, (t) => { floor[t] = lift; }); }
      if (w >= 8 && h >= 8) for (let k = 0; k < 2; k++) feature(r, [[1, 1]], false, K.wall, 0);
      for (let k = 0; k < 2; k++) feature(r, CRATE, false, K.cover, BASE.cover);
    } else if (th === 'comms') {
      // The dais and the dish pedestal: a centred 6 x 6 at +.3, its inner 4 x 4 at +.6, the centre 2 x 2 a prop.
      band(r, 7, (t) => { floor[t] = .3; }); band(r, 8, (t) => { floor[t] = .6; }); band(r, 9, (t) => { kind[t] = K.prop; floor[t] = 2.5; });
      props.push(prop('dish', cx, 0, cz));
      // Spawn doors: 2 x 1 alcoves in the wall band next to the room (+1 low, +22 high), one on each wall but the
      // entry wall, a fourth on the opposite wall at least 4 tiles from the third, all 3 tiles clear of the corners.
      const e = into[r.id], walls = NORMALS.filter(([nx, nz]) => nx * e[0] + nz * e[1] === 0), nd = 3 + rng.int(2);
      walls.push([0 - e[0], 0 - e[1]]);
      let prev = -1;
      for (let k = 0; k < nd; k++) {
        const [nx, nz] = walls[Math.min(k, 2)], ux = nz !== 0 ? 1 : 0, uz = 1 - ux;
        let p;
        if (k < 3) p = 3 + rng.int(13);
        else { const c = []; for (let q = 3; q <= 15; q++) if (Math.abs(q - prev) >= 4) c.push(q); p = c[rng.int(c.length)]; }
        prev = p;
        const i0 = nx > 0 ? r.x0 - 1 : nx < 0 ? r.x1 : r.x0 + p, j0 = nz > 0 ? r.z0 - 1 : nz < 0 ? r.z1 : r.z0 + p;
        for (let m = 0; m < 2; m++) {
          const t = T(i0 + ux * m, j0 + uz * m);
          kind[t] = K.floor; floor[t] = 0; ceil[t] = BASE.lintel; room[t] = r.id;
          doors[r.id].push([i0 + ux * m + nx, j0 + uz * m + nz]);
        }
        spawnDoors.push({ x: i0 + ux / 2 - half, z: j0 + uz / 2 - half, dx: nx, dz: nz });
      }
      for (let k = 8 + rng.int(3); k > 0; k--) feature(r, CRATE, false, K.cover, BASE.cover);
    }
  }

  // Glow strips: floor(.4 E) rooms other than the lift and comms, one strip each on a random wall-facing tile edge.
  const pool = [];
  for (let id = 1; id < L + S; id++) if (id !== L - 1) pool.push(id);
  for (let s = Math.floor(.4 * pool.length); s > 0; s--) {
    const r = rooms[pool.splice(rng.int(pool.length), 1)[0]], edges = [];
    for (let j = r.z0; j < r.z1; j++) for (let i = r.x0; i < r.x1; i++)
      for (const [di, dj] of DIRS) { const t = T(i + di, j + dj); if (kind[t] === K.wall && room[t] !== r.id) edges.push([i, j, di, dj]); }
    const [i, j, di, dj] = edges[rng.int(edges.length)];
    props.push(prop('strip', i + di / 2 - half, floor[T(i, j)] + rng.range(1.6, 2.2), j + dj / 2 - half, 0, 0, 0 - di, 0 - dj));
  }

  // 8. The start (the lift's centre tile, facing along its one corridor) and the comms door (comms `in`, facing in).
  const lift = rooms[0], comms = rooms[L - 1];
  const start = { x: ((lift.x0 + lift.x1) >> 1) - half, z: ((lift.z0 + lift.z1) >> 1) - half, dx: into[1][0], dz: into[1][1] };
  const commsDoor = { x: comms.in.x, z: comms.in.z, dx: into[L - 1][0], dz: into[L - 1][1] };
  const crit = [], side = [];
  for (let k = 0; k < L + S; k++) (k < L ? crit : side).push(k);
  return { seed, attempt, n, half, floor, ceil, kind, room, rooms, links, crit, side, start, commsDoor, spawnDoors, props };
}

// Accept a layout when every walkable tile is reachable from the start by steps of at most BASE.step.
export function baseAccept(B) {
  const reach = reachMap(B.floor, B.n, [Math.round(B.start.x + B.half), Math.round(B.start.z + B.half)], BASE.step, 0);
  for (let t = 0; t < B.n * B.n; t++) if (B.kind[t] === K.floor && reach[t] !== 1) return false;
  return true;
}

export function generateBase(seed, accept = baseAccept) {
  for (let attempt = 0; attempt < BASE.attempts; attempt++) {
    const B = build(seed, attempt, makeRng(seed + '/base' + (attempt ? '#' + attempt : '')));
    if (B && accept(B)) return B;
  }
  throw new Error('no base layout for seed ' + seed);
}
