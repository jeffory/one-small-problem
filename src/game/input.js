// Keyboard (works with or without pointer lock) and pointer-lock mouse look, which turns the player directly.
// M6: the wheel accumulates scroll (lines and pages as 40 and 800 px) and steps once per WHEEL px, at most once per read; the
// remainder is dropped after a step, so a 100-120 px mouse notch is one step, and turning back starts over.
const LOOK = .0022, WHEEL = 50;

export function createInput(canvas, player) {
  const keys = new Set(), once = new Set(); let btn = false, scroll = 0, weapon = -1;
  const down = (...codes) => codes.some(c => keys.has(c));
  const locked = () => document.pointerLockElement === canvas;

  // Asks for the lock on the canvas (raw movement where the browser has it); a refusal is caught, never thrown. A click on the
  // canvas asks, and so does the New Game button.
  const lock = () => {
    if (locked()) return;
    const plain = () => canvas.requestPointerLock()?.catch?.(() => {});
    const raw = canvas.requestPointerLock({ unadjustedMovement: true });
    if (raw?.catch) raw.catch(plain);
  };
  canvas.addEventListener('click', lock);
  // Fire only counts a button pressed while already locked, so the click that captures the mouse never shoots.
  canvas.addEventListener('mousedown', e => { if (e.button === 0 && locked()) btn = true; });
  addEventListener('mouseup', e => { if (e.button === 0) btn = false; });
  addEventListener('wheel', e => {
    const mode = e.deltaMode; // read first: Firefox reports lines (mode 1), and deltaY is only meaningful with its mode
    if (!locked() || !e.deltaY) return;
    const d = e.deltaY * ([1, 40, 800][mode] || 1);
    scroll = scroll * d < 0 ? d : scroll + d;
  }, { passive: true });
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
      fire: btn && locked(), use: once.has('use'), weapon, wheel: Math.abs(scroll) < WHEEL ? 0 : Math.sign(scroll),
    }; once.clear(); weapon = -1; if (r.wheel) scroll = 0; return r; },
    locked, lock,
  };
}
