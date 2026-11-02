// Keyboard (works with or without pointer lock) and pointer-lock mouse look, which turns the player directly.
const LOOK = .0022;

export function createInput(canvas, player) {
  const keys = new Set(), down = (...codes) => codes.some(c => keys.has(c));
  const locked = () => document.pointerLockElement === canvas;

  canvas.addEventListener('click', () => {
    if (locked()) return;
    const plain = () => canvas.requestPointerLock()?.catch?.(() => {});
    const raw = canvas.requestPointerLock({ unadjustedMovement: true });
    if (raw?.catch) raw.catch(plain);
  });
  document.addEventListener('mousemove', e => {
    if (!locked()) return;
    player.yaw -= e.movementX * LOOK;
    player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch - e.movementY * LOOK));
  });
  addEventListener('keydown', e => { keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear()); // no stuck keys after alt-tab

  return {
    read: () => ({
      fwd: down('KeyW', 'ArrowUp') - down('KeyS', 'ArrowDown'),
      strafe: down('KeyD', 'ArrowRight') - down('KeyA', 'ArrowLeft'),
      run: down('ShiftLeft', 'ShiftRight'),
      jump: down('Space'),
    }),
    locked,
  };
}
