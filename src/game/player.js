// Low-gravity player controller. Pure maths, no DOM. Units: metres, y up.
// At yaw 0 the player faces -z. y is the feet height; the eye is y + PLAYER.eye.
export const PLAYER = { eye: 1.7, walk: 4.5, run: 9, gSurface: 3.0, jumpV: 3.5, airControl: 2, stepUp: 0.35, substep: 0.25 };

export function createPlayer({ x, z, dx, dz }, ground) {
  return { x, y: ground(x, z), z, vx: 0, vy: 0, vz: 0, yaw: Math.atan2(-dx, -dz), pitch: 0, onGround: true };
}

export function stepPlayer(p, input, dt, ground, bound) {
  const s = Math.sin(p.yaw), c = Math.cos(p.yaw), speed = input.run ? PLAYER.run : PLAYER.walk;
  const dvx = (-s * input.fwd + c * input.strafe) * speed, dvz = (-c * input.fwd - s * input.strafe) * speed;
  if (p.onGround) { p.vx = dvx; p.vz = dvz; }
  else { const k = Math.min(1, PLAYER.airControl * dt); p.vx += (dvx - p.vx) * k; p.vz += (dvz - p.vz) * k; }
  if (input.jump && p.onGround) { p.vy = PLAYER.jumpV; p.onGround = false; }
  p.vy -= PLAYER.gSurface * dt;

  const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vz) * dt / PLAYER.substep)), h = dt / n;
  for (let i = 0; i < n; i++) {
    const nx = p.x + p.vx * h;
    if (ground(nx, p.z) - p.y > PLAYER.stepUp) p.vx = 0; else p.x = nx;
    const nz = p.z + p.vz * h;
    if (ground(p.x, nz) - p.y > PLAYER.stepUp) p.vz = 0; else p.z = nz;
  }
  p.x = Math.max(-bound, Math.min(bound, p.x));
  p.z = Math.max(-bound, Math.min(bound, p.z));

  p.y += p.vy * dt;
  const g = ground(p.x, p.z);
  if (p.y <= g) { p.y = g; p.vy = 0; p.onGround = true; }
  else if (p.onGround && p.vy <= 0 && p.y - g < 0.4) { p.y = g; p.vy = 0; }
  else p.onGround = false;
}
