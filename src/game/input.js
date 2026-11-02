// Keyboard (works with or without pointer lock) and pointer-lock mouse look, which turns the player directly.
const LOOK = .0022;

export function createInput(canvas, player) {
  const keys = new Set(), once = new Set(); let btn = false, wheel = 0, weapon = -1;
  const down = (...codes) => codes.some(c => keys.has(c));
  const locked = () => document.pointerLockElement === canvas;

  canvas.addEventListener('click', () => {
    if (locked()) return;
    const plain = () => canvas.requestPointerLock()?.catch?.(() => {});
    const raw = canvas.requestPointerLock({ unadjustedMovement: true });
    if (raw?.catch) raw.catch(plain);
  });
  // Fire only counts a button pressed while already locked, so the click that captures the mouse never shoots.
  canvas.addEventListener('mousedown', e => { if (e.button === 0 && locked()) btn = true; });
  addEventListener('mouseup', e => { if (e.button === 0) btn = false; });
  addEventListener('wheel', e => { if (locked() && e.deltaY) wheel = e.deltaY > 0 ? 1 : -1; }, { passive: true });
  document.addEventListener('mousemove', e => {
    if (!locked()) return;
    player.yaw -= e.movementX * LOOK;
    player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch - e.movementY * LOOK));
  });
  addEventListener('keydown', e => {
    keys.add(e.code); if (e.code === 'Space') e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyE') once.add('use');
    if (e.code >= 'Digit1' && e.code <= 'Digit3') weapon = e.code.charCodeAt(5) - 49;
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); btn = false; }); // no stuck keys after alt-tab

  return {
    read: () => { const r = {
      fwd: down('KeyW', 'ArrowUp') - down('KeyS', 'ArrowDown'),
      strafe: down('KeyD', 'ArrowRight') - down('KeyA', 'ArrowLeft'),
      run: down('ShiftLeft', 'ShiftRight'),
      jump: down('Space'),
      fire: btn && locked(), use: once.has('use'), weapon, wheel,
    }; once.clear(); weapon = -1; wheel = 0; return r; },
    locked,
  };
}
