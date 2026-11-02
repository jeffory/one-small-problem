// Low-gravity player controller. Pure maths, no DOM. Units: metres, y up.
// At yaw 0 the player faces -z. y is the feet height; the eye is y + PLAYER.eye.
export const PLAYER = { eye: 1.7, walk: 4.5, run: 9, gSurface: 3.0, jumpV: 3.5, airControl: 2, stepUp: 0.35, substep: 0.25, radius: 0.4 };

export function createPlayer({ x, z, dx, dz }, ground) {
  return { x, y: ground(x, z), z, vx: 0, vy: 0, vz: 0, yaw: Math.atan2(-dx, -dz), pitch: 0, onGround: true, kx: 0, kz: 0 };
}

export function knock(p, vx, vy, vz) {
  p.kx += vx; p.kz += vz;
  if (vy > 0) { p.vy = Math.max(p.vy, vy); p.onGround = false; }
}

export function stepPlayer(p, input, dt, ground, bound, g = PLAYER.gSurface) {
  const s = Math.sin(p.yaw), c = Math.cos(p.yaw), speed = input.run ? PLAYER.run : PLAYER.walk;
  const len = Math.hypot(input.fwd, input.strafe), n0 = len > 1 ? 1 / len : 1, fwd = input.fwd * n0, str = input.strafe * n0;
  const dvx = (-s * fwd + c * str) * speed, dvz = (-c * fwd - s * str) * speed;
  if (p.onGround) { p.vx = dvx; p.vz = dvz; }
  else { const k = Math.min(1, PLAYER.airControl * dt); p.vx += (dvx - p.vx) * k; p.vz += (dvz - p.vz) * k; }
  if (input.jump && p.onGround) { p.vy = PLAYER.jumpV; p.onGround = false; }
  p.vy -= g * dt;

  const n = Math.max(1, Math.ceil(Math.hypot(p.vx + p.kx, p.vz + p.kz) * dt / PLAYER.substep)), h = dt / n;
  for (let i = 0; i < n; i++) {
    const mx = p.vx + p.kx, nx = p.x + mx * h;
    if (ground(nx + Math.sign(mx) * PLAYER.radius, p.z) - p.y > PLAYER.stepUp) p.vx = p.kx = 0; else p.x = nx;
    const mz = p.vz + p.kz, nz = p.z + mz * h;
    if (ground(p.x, nz + Math.sign(mz) * PLAYER.radius) - p.y > PLAYER.stepUp) p.vz = p.kz = 0; else p.z = nz;
  }
  p.x = Math.max(-bound, Math.min(bound, p.x));
  p.z = Math.max(-bound, Math.min(bound, p.z));

  p.y += p.vy * dt;
  const gy = ground(p.x, p.z);
  if (p.y <= gy) { p.y = gy; p.vy = 0; p.onGround = true; }
  else if (p.onGround && p.vy <= 0 && p.y - gy < 0.4) { p.y = gy; p.vy = 0; }
  else p.onGround = false;
  if (p.onGround) { const d = Math.max(0, 1 - 6 * dt); p.kx *= d; p.kz *= d; }
}
