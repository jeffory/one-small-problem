// Weapons: flag pole, plasma pistol, scattergun. Pure simulation, no DOM/GPU.
export const TEAL = [.3, 1, .8], SICK = [.8, 1, .3], MAX_CELLS = 150;
export const WEAPONS = [
  { id: 'flag', name: 'FLAG POLE', melee: true, dmg: 25, range: 2.2, cosArc: 0.8, cool: 0.65, knock: 7, cells: 0 },
  { id: 'pistol', name: 'PLASMA PISTOL', dmg: 12, cool: 0.18, cells: 1, n: 1, spread: 0, speed: 60, life: 1.2, size: .12, col: TEAL, muzzle: [.15, -.16, .55] },
  { id: 'scatter', name: 'PLASMA SCATTERGUN', dmg: 10, cool: 0.8, cells: 4, n: 5, spread: 0.1, speed: 40, life: 0.5, size: .16, col: TEAL, muzzle: [.15, -.16, .57] },
];
export const createArsenal = () => ({ owned: [false, false, false], cur: -1, cells: 0, cool: 0 });
export function give(a, i, cells) {
  const first = !a.owned[i];
  a.owned[i] = true;
  a.cells = Math.min(MAX_CELLS, a.cells + cells);
  if (first) a.cur = i;
  return first;
}
export function selectWeapon(a, i) {
  if (!a.owned[i] || a.cur === i) return false;
  a.cur = i; return true;
}
export function cycleWeapon(a, dir) {
  const n = WEAPONS.length;
  for (let k = 1; k <= n; k++) {
    const i = (((a.cur + dir * k) % n) + n) % n;
    if (a.owned[i]) { a.cur = i; return; }
  }
}
// M3: the cooldown carries its remainder, so the fire rate doesn't snap to the sub-step; idle banks at most one sub-step (<= .05 s).
export const coolWeapon = (a, dt) => { a.cool = Math.max(-Math.min(dt, .05), a.cool - dt); };
export function fireWeapon(a, eye, basis, aimPoint) {
  const w = a.cur;
  if (w < 0 || a.cool > 0) return null;
  const W = WEAPONS[w];
  if (a.cells < W.cells) {
    if (a.owned[0] && w !== 0) a.cur = 0;
    return null;
  }
  a.cool += W.cool;
  if (W.melee) return { melee: true, w };
  a.cells -= W.cells;
  const { f, r, u } = basis, m = W.muzzle, bolts = [];
  const p = [0, 1, 2].map(k => eye[k] + r[k] * m[0] + u[k] * m[1] + f[k] * m[2]);
  let d = [aimPoint[0] - p[0], aimPoint[1] - p[1], aimPoint[2] - p[2]];
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  d = d.map(v => v / l);
  for (let k = 0; k < W.n; k++) {
    const ang = W.n > 1 ? (k / (W.n - 1) * 2 - 1) * W.spread : 0, c = Math.cos(ang), s = Math.sin(ang);
    const v = [0, 1, 2].map(j => (d[j] * c + r[j] * s) * W.speed);
    bolts.push({ x: p[0], y: p[1], z: p[2], vx: v[0], vy: v[1], vz: v[2], dmg: W.dmg, r: W.size, life: W.life, col: W.col, team: 0, src: 0 });
  }
  return { bolts, w };
}
export function meleeTargets(eye, f, targets, range, cosArc) {
  const out = [];
  for (const t of targets) {
    const dx = t.x - eye[0], dy = t.y - eye[1], dz = t.z - eye[2], d = Math.hypot(dx, dy, dz);
    if (d - t.r > range) continue;
    if (d < 1e-6 || (dx * f[0] + dy * f[1] + dz * f[2]) / d >= cosArc) out.push(t);
  }
  return out;
}
