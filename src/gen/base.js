// The alien base: a room graph on an 8 x 8 coarse grid of 18-tile cells, laid out as 144 x 144 tiles of 1 m, each
// with a floor and a ceiling height. Themes follow the critical path from the lift to the comms room. A layout that
// fails to construct or is rejected re-rolls with a fresh rng, up to BASE.attempts (32) attempts (ruling R2).
import { makeRng } from './rng.js';
import { reachMap } from './passable.js';

// cell: 18 m (was 12) and jitter: rooms sit within 1 tile of their cell's centre, so corridors run 6 m or more between
// rooms and the player has somewhere to fall back to (hands-on, 2026-11-03: the 12 m grid gave 3 m corridors).
export const BASE = { n: 144, cell: 18, grid: 8, jitter: 1, wall: 99, step: .35, minHead: 2.6, corridor: 3, lintel: 2.7, cover: 1.1, attempts: 32,
  crit: [8, 12], side: [3, 5], loops: [1, 2],
  ceil: { lift: 3.5, side: 3.5, plain: [4, 5], hangar: 8, lab: 4.5, reactor: 9, greenhouse: 6, comms: 9, corridor: 3,
    cell: 2.8, cellblock: 4.5, guard: 4, interro: 3.5, evidence: 3.5, hall: 7 },
  size: { lift: 6, hangar: 10, lab: 9, reactor: 10, greenhouse: 10, side: [5, 7], plain: [6, 9],
    cell: 5, cellblock: { long: 15, short: 8 }, guard: [8, 10], interro: 7, evidence: [7, 9] } };
// A base's config: the generator reads everything that makes one base differ from another here (Plan 6). BASE_PLAN is the
// Moon base: rng stream, span ranges, theme order along the path, light colours, pickups and the pacing curve.
export const BASE_PLAN = { stream: '/base', area: 2, attempts: BASE.attempts, crit: BASE.crit, side: BASE.side, loops: BASE.loops,
  start: 'lift', first: 'hangar', end: 'comms', at: [['lab', .35], ['reactor', .6], ['greenhouse', .8]], p: [.5, 1],
  golf: { room: 'side', id: 3 }, cells: ['hangar', 'reactor'], cans: [['hangar', 3], ['reactor', 3], ['greenhouse', 2]],
  amber: ['lift', 'hangar', 'comms'], teal: ['lab', 'reactor', 'greenhouse'], red: [], guard: false, brute: null, tape: [] };
// The prison (Plan 6): its own rng stream, 6 to 8 rooms from the barred cell to the lift hall, one loop.
export const PRISON_PLAN = { ...BASE_PLAN, stream: '/prison', area: 4, attempts: 64, crit: [6, 8], side: [2, 3], loops: [1, 1],
  start: 'cell', first: 'cellblock', end: 'hall', at: [['guard', .4], ['interro', .6], ['evidence', .8]], p: [.4, .9],
  guard: true, brute: 'guard', golf: { room: 'evidence', id: 5 }, cells: ['evidence', 'guard'], tape: ['evidence'],
  cans: [['guard', 3], ['evidence', 2]], amber: ['guard', 'interro', 'evidence'], teal: ['cell', 'cellblock', 'side'], red: ['hall'] };
export const THEMES = ['plain', 'side', 'lift', 'hangar', 'lab', 'reactor', 'greenhouse', 'comms', 'cell', 'cellblock', 'guard', 'interro', 'evidence', 'hall'];
export const PROPS = ['lift', 'saucer', 'jarRover', 'jarProbe', 'jar', 'core', 'bed', 'dish', 'strip', 'bars', 'cow', 'chair', 'shelf', 'exit'];
export const K = { wall: 0, floor: 1, cover: 2, prop: 3 };

// Neighbour offsets in scan order (-z, -x, +x, +z), and the four inward wall normals of a room.
const DIRS = [[0, -1], [-1, 0], [1, 0], [0, 1]], NORMALS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const CRATE = [[2, 1], [1, 2]], BED = [[2, 3], [3, 2]], TRIES = 40;
const span = (rng, r) => r[0] + rng.int(r[1] - r[0] + 1);
const gap = (v, lo, hi) => v < lo ? lo - v : v > hi ? v - hi : 0;
const prop = (kind, x, y, z, w = 0, d = 0, dx = 0, dz = 0) => ({ kind, x, y, z, w, d, dx, dz });

// One attempt. Returns null when the construction fails (see the brief: dead-end walk, no comms block, no side-room
// cell, no loop candidate, no spot for a required piece).
function build(seed, attempt, rng, cfg) {
  const { n, cell: C, grid: G } = BASE, half = n >> 1, T = (i, j) => j * n + i;
  const own = new Int16Array(G * G).fill(-1), at = (x, y) => x >= 0 && x < G && y >= 0 && y < G ? own[y * G + x] : -2;

  // 1. The critical path: L - 1 single cells by a self-avoiding walk, then the 2 x 2 comms block beside the last one.
  const L = span(rng, cfg.crit), cells = [];
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
  const S = span(rng, cfg.side), parent = [];
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
  const target = span(rng, cfg.loops), loops = [], ok = (r) => r > 0 && r !== L - 1;
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
  theme[0] = cfg.start; theme[1] = cfg.first; theme[L - 1] = cfg.end;
  for (const [t, f] of cfg.at) theme[Math.round(f * (L - 1))] = t;
  for (let s = 0; s < S; s++) theme.push('side');

  // 5. Rooms to tiles. Every single-cell room covers its cell's central band [+C/2-2, +C/2+2) (the corridor band), keeps
  //    a wall tile at each cell edge and sits within BASE.jitter tiles of centred; the comms room (20 x 20) is centred in
  //    its 2 x 2 block, from +C-10 to +C+10, so the block's outer bands always stay wall.
  const floor = new Float32Array(n * n).fill(BASE.wall), ceil = new Float32Array(n * n), kind = new Uint8Array(n * n), room = new Int16Array(n * n).fill(-1);
  const H = C >> 1, place = (c, wd) => {
    const mid = c + ((C - wd) >> 1), lo = Math.max(c + 1, c + H + 2 - wd, mid - BASE.jitter), hi = Math.min(c + H - 2, c + C - 1 - wd, mid + BASE.jitter);
    return lo + rng.int(hi - lo + 1);
  };
  const rooms = [];
  for (let id = 0; id < L + S; id++) {
    const th = theme[id], cs = cells[id];
    let x0, z0, x1, z1;
    if (th === cfg.end) { x0 = bx * C + C - 10; z0 = by * C + C - 10; x1 = x0 + 20; z1 = z0 + 20; }
    else {
      // The cell block's long side runs along its entry link, along x when that link's cells share a row.
      const sz = BASE.size[th], blk = sz.long !== undefined, xl = blk && lc[id - 1][0][1] === lc[id - 1][1][1];
      const wd = blk ? (xl ? sz.long : sz.short) : typeof sz === 'number' ? sz : span(rng, sz), ht = blk ? (xl ? sz.short : sz.long) : typeof sz === 'number' ? sz : span(rng, sz);
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
    const lo = (xl ? ca[0] < cb[0] : ca[1] < cb[1]) ? A : Bm, hi = lo === A ? Bm : A, cm = Bm.theme === cfg.end ? Bm : null;
    let r0 = (xl ? ca[1] : ca[0]) * C + (C >> 1) - 2 + rng.int(2);
    // The comms room (20 wide) is narrower than its block's two corridor bands: its one corridor shifts inside it.
    if (cm) r0 = Math.min(Math.max(r0, xl ? cm.z0 : cm.x0), (xl ? cm.z1 : cm.x1) - W);
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
    if (name) props.push(prop(name, px + fw / 2 - .5 - half, base, pz + fh / 2 - .5 - half, name === 'bed' || name === 'shelf' ? fw : 0, name === 'bed' || name === 'shelf' ? fh : 0));
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
      // M4: beds stand as tall as cover, so nobody jumps onto one and walks through its stalks.
      const beds = 2 + rng.int(3);
      if (!feature(r, BED, true, K.prop, BASE.cover, 'bed')) return null;
      for (let k = 1; k < beds; k++) feature(r, BED, false, K.prop, BASE.cover, 'bed');
    } else if (th === 'plain') {
      if (w >= 7 && h >= 7 && rng.next() < .4) { const lift = rng.next() < .5 ? .3 : -.3; band(r, 2, (t) => { floor[t] = lift; }); }
      if (w >= 8 && h >= 8) for (let k = 0; k < 2; k++) feature(r, [[1, 1]], false, K.wall, 0);
      for (let k = 0; k < 2; k++) feature(r, CRATE, false, K.cover, BASE.cover);
    } else if (th === 'cellblock') {
      // Alcoves along both long walls, from 2 tiles in from each corner, then every 3: the 2 wall-band tiles just outside
      // the room, kept as a recess (wall to collision, sight and nav) behind a barred mouth. (nx, nz) points into the room.
      const xl = w >= h, len = xl ? w : h, ux = xl ? 1 : 0, uz = 1 - ux, alc = [];
      for (const side of [-1, 1]) for (let p = 2; p + 1 <= len - 3; p += 3) {
        const nx = xl ? 0 : -side, nz = xl ? -side : 0;
        const i0 = xl ? r.x0 + p : side < 0 ? r.x0 - 1 : r.x1, j0 = xl ? (side < 0 ? r.z0 - 1 : r.z1) : r.z0 + p, tl = [];
        let ok = true;
        for (let m = 0; m < 2; m++) {
          const i = i0 + ux * m, j = j0 + uz * m;
          if (kind[T(i, j)] !== K.wall || kind[T(i - nx, j - nz)] !== K.wall) ok = false;
          for (const [di, dj] of doors[r.id]) if (Math.max(Math.abs(di - i), Math.abs(dj - j)) < 2) ok = false;
          tl.push(T(i, j));
        }
        if (ok) alc.push({ tl, nx, nz, i0, j0 });
      }
      if (!alc.length) return null;
      for (const a of alc) {
        for (const t of a.tl) { kind[t] = K.prop; floor[t] = BASE.wall; ceil[t] = r.ceil; room[t] = r.id; }
        props.push(prop('bars', a.i0 + ux / 2 + a.nx / 2 - half, 0, a.j0 + uz / 2 + a.nz / 2 - half, 2, 0, a.nx, a.nz));
      }
      const c = alc[rng.int(alc.length)];
      props.push(prop('cow', c.i0 + ux / 2 - half, 0, c.j0 + uz / 2 - half, 0, 0, c.nx, c.nz));
    } else if (th === 'guard') {
      for (let k = 4 + rng.int(3); k > 0; k--) feature(r, CRATE, false, K.cover, BASE.cover);
    } else if (th === 'interro') {
      if (!feature(r, [[2, 2]], true, K.prop, 1, 'chair')) return null;
    } else if (th === 'evidence') {
      if (!feature(r, [[3, 1], [1, 3]], true, K.prop, 2, 'shelf')) return null;
      for (let k = 1 + rng.int(3); k > 0; k--) feature(r, [[3, 1], [1, 3]], false, K.prop, 2, 'shelf');
    } else if (th === 'hall') {
      // The exit lift's dais: a centred 4 x 4 at +.3. It is a prop while the crates are placed, so none stands on it or in the
      // one-tile ring round it (a footprint's ring must be floor), then floor again (final review FR3).
      band(r, 8, (t) => { floor[t] = .3; kind[t] = K.prop; });
      props.push(prop('exit', cx, .3, cz));
      for (let k = 8 + rng.int(3); k > 0; k--) feature(r, CRATE, false, K.cover, BASE.cover);
      band(r, 8, (t) => { kind[t] = K.floor; });
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
  // A cell start is shut by bars across link 0's corridor mouth: the 3 corridor tiles touching the cell, the middle one the centre.
  let bars = null;
  if (cfg.start === 'cell') {
    const l = links[0], xl = lc[0][0][1] === lc[0][1][1], tiles = [];
    for (let m = 0; m < W; m++) tiles.push(xl ? T(lift.x1 === l.x0 ? l.x0 : l.x1 - 1, l.z0 + m) : T(l.x0 + m, lift.z1 === l.z0 ? l.z0 : l.z1 - 1));
    const mid = tiles[W >> 1];
    bars = { tiles, x: mid % n - half, z: (mid - mid % n) / n - half, dx: start.dx, dz: start.dz };
  }
  const commsDoor = { x: comms.in.x, z: comms.in.z, dx: into[L - 1][0], dz: into[L - 1][1] };
  const crit = [], side = [];
  for (let k = 0; k < L + S; k++) (k < L ? crit : side).push(k);
  return { seed, attempt, cfg, n, half, floor, ceil, kind, room, rooms, links, crit, side, start, commsDoor, spawnDoors, props, bars };
}

// Accept a layout when every walkable tile is reachable from the start by steps of at most BASE.step.
export function baseAccept(B) {
  const reach = reachMap(B.floor, B.n, [Math.round(B.start.x + B.half), Math.round(B.start.z + B.half)], BASE.step, 0);
  for (let t = 0; t < B.n * B.n; t++) if (B.kind[t] === K.floor && reach[t] !== 1) return false;
  return true;
}

export function generateBase(seed, accept = baseAccept, cfg = BASE_PLAN) {
  for (let attempt = 0; attempt < cfg.attempts; attempt++) {
    const B = build(seed, attempt, makeRng(seed + cfg.stream + (attempt ? '#' + attempt : '')), cfg);
    if (B && accept(B)) return B;
  }
  throw new Error('no base layout for seed ' + seed);
}
