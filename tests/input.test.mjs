import test from 'node:test'; import assert from 'node:assert/strict';
// A stand-in for the few DOM globals createInput touches; the canvas is pointer-locked.
const on = {}, canvas = { addEventListener: (t, f) => { on['c' + t] = f; }, requestPointerLock: () => null };
globalThis.addEventListener = (t, f) => { on[t] = f; }; globalThis.document = { addEventListener: (t, f) => { on['d' + t] = f; }, pointerLockElement: canvas };
const { createInput } = await import('../src/game/input.js');
const I = createInput(canvas, { yaw: 0, pitch: 0 }), wheel = (deltaY, deltaMode = 0) => on.wheel({ deltaY, deltaMode });
test('the wheel steps once per 50 px of scroll, at most once per read (M6)', () => {
  for (let i = 0; i < 4; i++) wheel(10); assert.equal(I.read().wheel, 0); wheel(10); assert.equal(I.read().wheel, 1); assert.equal(I.read().wheel, 0);
  for (let i = 0; i < 30; i++) wheel(-12); assert.equal(I.read().wheel, -1); assert.equal(I.read().wheel, 0); // a touchpad flick: one step per read, not one per event
  for (let i = 0; i < 4; i++) wheel(-12); wheel(30); wheel(30); assert.equal(I.read().wheel, 1); }); // turning back starts over
test('one mouse notch is one step, in pixels, lines or pages (M6)', () => {
  for (const [d, m] of [[100, 0], [120, 0], [3, 1], [1, 2], [-100, 0]]) { wheel(d, m); assert.equal(I.read().wheel, Math.sign(d), `${d} mode ${m}`); assert.equal(I.read().wheel, 0, `${d} mode ${m}`); } });
test('the wheel reads deltaMode before deltaY, so Firefox reports lines (carry-over)', () => { const seen = [];
  on.wheel({ get deltaMode() { seen.push('mode'); return 1; }, get deltaY() { seen.push('y'); return 3; } }); assert.equal(seen[0], 'mode'); assert.equal(I.read().wheel, 1); });
