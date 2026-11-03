// Base lamps and pacing. Both read a BaseMap and are pure functions of it (and its seed and attempt).
import { makeRng } from './rng.js';
import { BASE, K } from './base.js';
import { budgetAt } from './encounters.js';

// Lamp colours are the look test's. kind: 0 steady, 1 red flicker (spawn doors), 2 pulsing (reactor core).
export const LIGHT = { amber: { col: [1.3, .8, .32], r: 8 }, teal: { col: [.35, 1.3, .85], r: 8 }, red: { col: [2.2, .25, .08], r: 5, kind: 1 }, core: { col: [.5, 2.6, 1.6], r: 12, kind: 2 }, alarm: { col: [2.2, .25, .08], r: 8, kind: 1 } };
// LAMP_DROP: room lamps hang this far above the floor, the look test's height (R16).
export const LIGHT_CAP = 10, LAMP_DROP = 2.65, CORRIDOR_LAMP = 6, BASE_SCALE = .5;
// Heights above a floor tile where the cap is sampled: a standing eye and a jumping one (pre-flight F28).
const SAMPLE = [1.7, 2.4], TALL = 4.5, TRIES = 40;

export function lightBase(B) {
  const { n, half, floor, kind, room, rooms, cfg } = B, rng = makeRng(B.seed + B.cfg.stream + '/lights/' + B.attempt), lights = [];
  const cnt = SAMPLE.map(() => new Uint8Array(n * n));
  const wall = (i, j) => i < 0 || j < 0 || i >= n || j >= n || kind[j * n + i] === K.wall;
  // Can a point (in tile coordinates; tile k spans k - .5 to k + .5) see tile (bi, bj)'s centre? A 2D walk over every tile the
  // segment crosses, starting with the one it leaves the point through (a point on a tile edge belongs to the side it heads for):
  // any wall tile on it blocks, and at an exact tile corner either side's wall does.
  const sees = (ax, az, bi, bj) => {
    const dx = bi - ax, dz = bj - az, si = dx < 0 ? -1 : 1, sj = dz < 0 ? -1 : 1, ux = dx ? si / dx : 2, uz = dz ? sj / dz : 2;
    let i = si > 0 ? Math.floor(ax + .5) : Math.ceil(ax - .5), j = sj > 0 ? Math.floor(az + .5) : Math.ceil(az - .5);
    let tx = dx ? (i + .5 * si - ax) / dx : 2, tz = dz ? (j + .5 * sj - az) / dz : 2;
    if (wall(i, j)) return false;
    for (let s = 0; s < 4 * n && (i !== bi || j !== bj); s++) {
      if (tx < tz - 1e-9) { i += si; tx += ux; }
      else if (tz < tx - 1e-9) { j += sj; tz += uz; }
      else { if (wall(i + si, j) || wall(i, j + sj)) return false; i += si; j += sj; tx += ux; tz += uz; }
      if (wall(i, j)) return false;
    }
    return i === bi && j === bj;
  };
  // R16: how far a lamp at a point may reach, at most reach: the horizontal distance to the nearest non-wall tile square it cannot
  // see. Walls between spaces are at least 2 tiles thick, so this keeps light from passing through them without stopping it short
  // at the nearest wall the way a clearance bound did.
  const sight = (fx, fz, reach) => {
    let c = reach;
    const r = Math.ceil(reach) + 1;
    for (let j = Math.max(0, Math.floor(fz) - r); j <= Math.min(n - 1, Math.floor(fz) + r); j++)
      for (let i = Math.max(0, Math.floor(fx) - r); i <= Math.min(n - 1, Math.floor(fx) + r); i++) {
        if (kind[j * n + i] === K.wall) continue;
        const dx = Math.max(0, Math.abs(fx - i) - .5), dz = Math.max(0, Math.abs(fz - j) - .5), d = Math.sqrt(dx * dx + dz * dz);
        if (d < c && !sees(fx, fz, i, j)) c = d;
      }
    return c;
  };
  const add = (x, y, z, def) => {
    const fx = x + half, fz = z + half, r = sight(fx, fz, def.r), hit = [];
    const i0 = Math.max(0, Math.floor(fx - r)), i1 = Math.min(n - 1, Math.ceil(fx + r)), j0 = Math.max(0, Math.floor(fz - r)), j1 = Math.min(n - 1, Math.ceil(fz + r));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const t = j * n + i;
      if (kind[t] !== K.floor) continue;
      SAMPLE.forEach((up, s) => {
        const dx = i - fx, dz = j - fz, dy = floor[t] + up - y;
        if (dx * dx + dz * dz + dy * dy < r * r) hit.push(s, t);
      });
    }
    for (let q = 0; q < hit.length; q += 2) if (cnt[hit[q]][hit[q + 1]] >= LIGHT_CAP) return;
    for (let q = 0; q < hit.length; q += 2) cnt[hit[q]][hit[q + 1]]++;
    lights.push({ x, y, z, r, col: def.col, kind: def.kind || 0 });
  };

  const core = B.props.find((p) => p.kind === 'core');
  if (core) add(core.x, core.y + 3, core.z, LIGHT.core);
  for (const r of rooms) {
    const w = r.x1 - r.x0, h = r.z1 - r.z0, nx = Math.min(3, Math.ceil(w / 7)), nz = Math.min(3, Math.ceil(h / 7));
    const def = cfg.amber.includes(r.theme) ? LIGHT.amber : cfg.teal.includes(r.theme) ? LIGHT.teal : cfg.red.includes(r.theme) ? LIGHT.alarm : rng.next() < .6 ? LIGHT.amber : LIGHT.teal;
    const y = Math.min(r.ceil - .6, r.floor + LAMP_DROP);
    for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) add(r.x0 - .5 + w * (a + .5) / nx - half, y, r.z0 - .5 + h * (b + .5) / nz - half, def);
  }
  // On the room side of each alcove mouth, on the wall face above it (pre-flight F17).
  for (const d of B.spawnDoors) add(d.x + d.dx * .6, BASE.lintel + .2, d.z + d.dz * .6, LIGHT.red);
  for (const l of B.links) {
    const A = rooms[l.a], C = rooms[l.b], xl = A.x1 <= C.x0 || C.x1 <= A.x0, len = xl ? l.x1 - l.x0 : l.z1 - l.z0;
    const at = (s) => xl ? add(l.x0 - .5 + s - half, 2.5, l.z0 + 1 - half, pick()) : add(l.x0 + 1 - half, 2.5, l.z0 - .5 + s - half, pick());
    const pick = () => rng.next() < 2 / 3 ? LIGHT.amber : LIGHT.teal;
    if (len < CORRIDOR_LAMP) at(len / 2); else for (let s = 2; s < len; s += CORRIDOR_LAMP) at(s);
  }
  B.lights = lights;
  return lights;
}

export function planBase(B) {
  const { n, half, floor, ceil, kind, room, rooms, cfg } = B, rng = makeRng(B.seed + B.cfg.stream + '/fight/' + B.attempt), L = B.crit.length;
  const col = (t) => t % n, row = (t) => (t - (t % n)) / n, px = (t) => col(t) - half, pz = (t) => row(t) - half;
  const d2 = (t, o) => (px(t) - o.x) * (px(t) - o.x) + (pz(t) - o.z) * (pz(t) - o.z);
  const tall = (t) => ceil[t] - floor[t] >= TALL;
  // Per room, in scan order: its floor tiles, and the clear ones (all 8 neighbours are floor too).
  const flo = rooms.map(() => []), clear = rooms.map(() => []);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const t = j * n + i;
    if (kind[t] !== K.floor || room[t] < 0) continue;
    flo[room[t]].push(t);
    let ok = i > 0 && j > 0 && i < n - 1 && j < n - 1;
    for (let dj = -1; ok && dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (kind[t + dj * n + di] !== K.floor) ok = false;
    if (ok) clear[room[t]].push(t);
  }
  const cheb = (t, r) => r.in ? Math.max(Math.abs(col(t) - (r.in.x + half)), Math.abs(row(t) - (r.in.z + half))) : 99;
  const itemAt = (t, extra) => ({ x: px(t), y: floor[t], z: pz(t), area: cfg.area, ...extra });
  const themed = (th) => rooms.find((r) => r.theme === th);

  // 1. Encounters: who is in each room (positions come at step 4, after the canisters).
  const comp = [];
  for (let k = 1; k <= L - 2; k++) {
    const p = cfg.p[0] + (cfg.p[1] - cfg.p[0]) * k / (L - 1), Bk = Math.floor(budgetAt(p) * BASE_SCALE), types = [];
    let b = Bk;
    if (rooms[k].theme === cfg.brute || (Bk >= 6 && (k % 2 === 0 || p >= .8))) { types.push('br'); b -= 4; }
    if (clear[k].some(tall)) { // pre-flight F11: the rule reads the tile
      if (Bk >= 2 && b >= 2 && (k % 3 === 1 || rng.next() < .4)) { types.push('fl'); b -= 2; }
      if (Bk >= 8 && b >= 2 && rng.next() < .3) { types.push('fl'); b -= 2; }
    }
    while (b > 0) { types.push('sk'); b--; }
    comp.push({ k, p, types });
  }

  // 5 first, as it needs no rng: golf 3 and 4 sit on the clear tile farthest from `in` in the first two side rooms.
  const golf = [];
  const golfRooms = cfg.golf.room === 'side' ? B.side.slice(0, 2) : [themed(cfg.golf.room).id];
  golfRooms.forEach((r, i) => {
    const o = rooms[r].in || { x: 0, z: 0 };
    let best = -1, bd = -1;
    for (const t of clear[r]) { const d = d2(t, o); if (d > bd) { bd = d; best = t; } }
    if (best >= 0) golf.push(itemAt(best, { id: cfg.golf.id + i }));
  });

  // 2. Pickups.
  const pickups = [], near = (t, list, m) => list.every((o) => d2(t, o) >= m * m);
  const take = (kindName, r) => {
    const pool = clear[r].length ? clear[r] : flo[r];
    let t = -1;
    for (let q = 0; q < TRIES && t < 0; q++) { const c = pool[rng.int(pool.length)]; if (near(c, pickups, 1) && near(c, golf, 1)) t = c; }
    if (t < 0) t = pool[rng.int(pool.length)];
    pickups.push(itemAt(t, { kind: kindName }));
  };
  const brute = (k) => comp[k - 1].types.includes('br');
  for (let k = 1; k <= L - 3; k++) if (brute(k + 1)) take('tape', k);
  for (const r of B.side) take('tape', r);
  for (const th of cfg.tape) take('tape', themed(th).id);
  for (const th of cfg.cells) take('cells', themed(th).id);
  for (const r of B.side) if (!golfRooms.includes(r)) take('cells', r);

  // 3. Canisters, before the aliens (pre-flight F12).
  const canisters = [];
  for (const [th, want] of cfg.cans) {
    const r = themed(th), mine = [];
    // A spot is free when it is 1 m from the pickups and 1.2 m from the canisters; a next one lies 1.2 to 2.0 m from its predecessor.
    const free = (t) => near(t, pickups, 1) && near(t, canisters, 1.2), ring = (t, o) => { const d = d2(t, o); return d >= 1.2 * 1.2 && d <= 4; };
    for (let m = 0; m < want; m++) {
      const prev = mine[mine.length - 1];
      // The anchor needs a partner within reach, or a dead-end nook would drop the whole cluster.
      const pool = clear[r.id].filter((t) => free(t) && (prev ? ring(t, prev) : cheb(t, r) >= 3 && clear[r.id].some((u) => ring(u, { x: px(t), z: pz(t) }) && free(u))));
      if (!pool.length) break;
      mine.push(itemAt(pool[rng.int(pool.length)])); canisters.push(mine[mine.length - 1]);
    }
    if (mine.length < 2) for (const c of mine) canisters.splice(canisters.indexOf(c), 1);
  }

  // 4. Aliens.
  const encounters = comp.map(({ k, p, types }) => {
    const r = rooms[k], aliens = [];
    for (const type of types) {
      const fl = type === 'fl', ok = (t) => !fl || tall(t), spaced = (t, ma, mc) => near(t, aliens, ma) && near(t, canisters, mc);
      const pool = clear[k].filter((t) => ok(t) && cheb(t, r) >= 3);
      let t = -1;
      for (let q = 0; q < TRIES && t < 0 && pool.length; q++) { const c = pool[rng.int(pool.length)]; if (spaced(c, 2, 1.5)) t = c; }
      if (t < 0) t = clear[k].find((c) => ok(c) && spaced(c, 2, 1.5)) ?? -1;
      if (t < 0) t = flo[k].find((c) => ok(c) && spaced(c, 1, 1)) ?? -1;
      if (t < 0) t = flo[k].find(ok);
      aliens.push({ type, x: px(t), y: fl ? floor[t] + rng.range(1.8, 2.4) : floor[t], z: pz(t) });
    }
    return { x: (r.x0 + r.x1 - 1) / 2 - half, z: (r.z0 + r.z1 - 1) / 2 - half, p, room: k, first: false, area: cfg.area, aliens };
  });
  // The guard (Task 3): a lone skitterer at the cell block's door, prepended with no draws.
  if (cfg.guard) { const in1 = rooms[1].in; encounters.unshift({ x: in1.x, z: in1.z, p: cfg.p[0], room: 1, first: true, guard: true, area: cfg.area, aliens: [{ type: 'sk', x: in1.x, y: 0, z: in1.z }] }); }
  return { encounters, pickups, canisters, golf };
}
