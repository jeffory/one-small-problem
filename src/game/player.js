// Low-gravity player controller. Pure maths, no DOM. Units: metres, y up.
// At yaw 0 the player faces -z. y is the feet height; the eye is y + PLAYER.eye and the top of the head y + PLAYER.head.
export const PLAYER = { eye: 1.7, head: 1.85, walk: 4.5, run: 9, gSurface: 3.0, jumpV: 3.5, airControl: 2, stepUp: 0.35, substep: 0.25, radius: 0.4 };
// Indoors the body is a box: its corners sit E either side of the centre (just inside the radius, so a box flush against a
// wall doesn't read the wall's tile at its sides).
const E = PLAYER.radius - .02;

export function createPlayer({ x, z, dx, dz }, ground) {
  return { x, y: ground(x, z), z, vx: 0, vy: 0, vz: 0, yaw: Math.atan2(-dx, -dz), pitch: 0, onGround: true, kx: 0, kz: 0 };
}

export function knock(p, vx, vy, vz) {
  p.kx += vx; p.kz += vz;
  if (vy > 0) { p.vy = Math.max(p.vy, vy); p.onGround = false; }
}

// Is (x, z) blocked for feet at y: ground more than a step up, or a ceiling below the head?
const blocked = (ground, ceil, x, z, y) => ground(x, z) - y > PLAYER.stepUp || ceil(x, z) < y + PLAYER.head;
// Would a leading corner moving to (nx, nz) enter something it isn't already in? Only if that point is blocked and is worse
// (higher ground or a lower ceiling) than (ox, oz), where that box corner is now. So an overlap you already have, like a
// corner left over a bed you jumped beside, can be moved along or out of; a wall, which no box corner is ever in, never.
const enters = (ground, ceil, nx, nz, ox, oz, y) => blocked(ground, ceil, nx, nz, y) && (ground(nx, nz) > ground(ox, oz) || ceil(nx, nz) < ceil(ox, oz));
// Indoors, an axis move is refused if the middle (lx, lz) of the new leading edge is blocked (so an overlap is never deepened
// until the centre is over it, which would climb it), or if either of its corners, (sx, sz) to each side, enters something
// new; (ox, oz) is the middle of the box's edge on that side now.
const refused = (ground, ceil, lx, lz, ox, oz, sx, sz, y) => blocked(ground, ceil, lx, lz, y) ||
  enters(ground, ceil, lx - sx, lz - sz, ox - sx, oz - sz, y) || enters(ground, ceil, lx + sx, lz + sz, ox + sx, oz + sz, y);
// The lowest ceiling over the box's four corners.
const lowest = (ceil, x, z) => Math.min(ceil(x - E, z - E), ceil(x + E, z - E), ceil(x - E, z + E), ceil(x + E, z + E));

// Could the player stand at (x, z) at their current height? Outdoors (no ceil): the ground there is at most a step up.
// Indoors: all four box corners are, and none has a ceiling below the head.
export function fits(p, x, z, ground, ceil) {
  if (!ceil) return ground(x, z) - p.y <= PLAYER.stepUp;
  return !blocked(ground, ceil, x - E, z - E, p.y) && !blocked(ground, ceil, x + E, z - E, p.y) &&
    !blocked(ground, ceil, x - E, z + E, p.y) && !blocked(ground, ceil, x + E, z + E, p.y);
}

// ceil (indoors only): each axis move probes the box's leading edge (see refused), and the head stops at the lowest ceiling
// over the box. Outdoors (ceil null) one probe on the centre line, one radius ahead, as in Plan 2.
export function stepPlayer(p, input, dt, ground, bound, g = PLAYER.gSurface, ceil = null) {
  const s = Math.sin(p.yaw), c = Math.cos(p.yaw), speed = input.run ? PLAYER.run : PLAYER.walk;
  const len = Math.hypot(input.fwd, input.strafe), n0 = len > 1 ? 1 / len : 1, fwd = input.fwd * n0, str = input.strafe * n0;
  const dvx = (-s * fwd + c * str) * speed, dvz = (-c * fwd - s * str) * speed;
  if (p.onGround) { p.vx = dvx; p.vz = dvz; }
  else { const k = Math.min(1, PLAYER.airControl * dt); p.vx += (dvx - p.vx) * k; p.vz += (dvz - p.vz) * k; }
  if (input.jump && p.onGround) { p.vy = PLAYER.jumpV; p.onGround = false; }
  p.vy -= g * dt;

  const n = Math.max(1, Math.ceil(Math.hypot(p.vx + p.kx, p.vz + p.kz) * dt / PLAYER.substep)), h = dt / n;
  for (let i = 0; i < n; i++) {
    const mx = p.vx + p.kx, nx = p.x + mx * h, ex = nx + Math.sign(mx) * PLAYER.radius;
    if (ceil ? refused(ground, ceil, ex, p.z, p.x + Math.sign(mx) * E, p.z, 0, E, p.y) : ground(ex, p.z) - p.y > PLAYER.stepUp) p.vx = p.kx = 0;
    else p.x = nx;
    const mz = p.vz + p.kz, nz = p.z + mz * h, ez = nz + Math.sign(mz) * PLAYER.radius;
    if (ceil ? refused(ground, ceil, p.x, ez, p.x, p.z + Math.sign(mz) * E, E, 0, p.y) : ground(p.x, ez) - p.y > PLAYER.stepUp) p.vz = p.kz = 0;
    else p.z = nz;
  }
  p.x = Math.max(-bound, Math.min(bound, p.x));
  p.z = Math.max(-bound, Math.min(bound, p.z));

  p.y += p.vy * dt;
  if (ceil) { const top = lowest(ceil, p.x, p.z); if (p.y + PLAYER.head > top) { p.y = top - PLAYER.head; p.vy = Math.min(p.vy, 0); } }
  const gy = ground(p.x, p.z);
  if (p.y <= gy) { p.y = gy; p.vy = 0; p.onGround = true; }
  else if (p.onGround && p.vy <= 0 && p.y - gy < 0.4) { p.y = gy; p.vy = 0; }
  else p.onGround = false;
  if (p.onGround) { const d = Math.max(0, 1 - 6 * dt); p.kx *= d; p.kz *= d; }
}
