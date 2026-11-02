import test from 'node:test'; import assert from 'node:assert/strict';
// A stand-in for the few DOM globals createInput touches; the canvas is pointer-locked.
const on = {}, canvas = { addEventListener: (t, f) => { on['c' + t] = f; }, requestPointerLock: () => null };
globalThis.addEventListener = (t, f) => { on[t] = f; }; globalThis.document = { addEventListener: (t, f) => { on['d' + t] = f; }, pointerLockElement: canvas };
const { createInput, look, LOOK } = await import('../src/game/input.js');
const I = createInput(canvas), wheel = (deltaY, deltaMode = 0) => on.wheel({ deltaY, deltaMode });
test('the wheel steps once per 50 px of scroll, at most once per read (M6)', () => {
  for (let i = 0; i < 4; i++) wheel(10); assert.equal(I.read().wheel, 0); wheel(10); assert.equal(I.read().wheel, 1); assert.equal(I.read().wheel, 0);
  for (let i = 0; i < 30; i++) wheel(-12); assert.equal(I.read().wheel, -1); assert.equal(I.read().wheel, 0); // a touchpad flick: one step per read, not one per event
  for (let i = 0; i < 4; i++) wheel(-12); wheel(30); wheel(30); assert.equal(I.read().wheel, 1); }); // turning back starts over
test('one mouse notch is one step, in pixels, lines or pages (M6)', () => {
  for (const [d, m] of [[100, 0], [120, 0], [3, 1], [1, 2], [-100, 0]]) { wheel(d, m); assert.equal(I.read().wheel, Math.sign(d), `${d} mode ${m}`); assert.equal(I.read().wheel, 0, `${d} mode ${m}`); } });
test('the wheel reads deltaMode before deltaY, so Firefox reports lines (carry-over)', () => { const seen = [];
  on.wheel({ get deltaMode() { seen.push('mode'); return 1; }, get deltaY() { seen.push('y'); return 3; } }); assert.equal(seen[0], 'mode'); assert.equal(I.read().wheel, 1); });
test('mouse look accumulates while locked; look() applies it with sensitivity and invert-Y, pitch clamped (settings)', () => {
  on.dmousemove({ movementX: 10, movementY: -5 }); on.dmousemove({ movementX: 5, movementY: 0 }); const r = I.read(); assert.deepEqual([r.lookX, r.lookY], [15, -5]);
  const z = I.read(); assert.deepEqual([z.lookX, z.lookY], [0, 0]);
  const p = { yaw: 0, pitch: 0 }; look(p, 100, 50, 2, false); assert.ok(Math.abs(p.yaw + 100 * LOOK * 2) < 1e-12 && Math.abs(p.pitch + 50 * LOOK * 2) < 1e-12);
  const q = { yaw: 0, pitch: 0 }; look(q, 0, 50, 1, true); assert.ok(q.pitch > 0); look(q, 0, -1e6, 1, false); assert.equal(q.pitch, 1.5); });
// R6: the plain fallback runs only while the lock is still wanted; a raw request refused after unlock() (late, as headless
// Chromium does under load) never asks again, and one refused while wanted still falls back
test('a raw pointer lock refused after unlock() never falls back to a plain request (R6)', async () => {
  const calls = [], saved = canvas.requestPointerLock, tick = () => new Promise(r => setTimeout(r)); let refuse;
  document.pointerLockElement = null; document.exitPointerLock = () => calls.push('exit');
  canvas.requestPointerLock = o => { calls.push(o ? 'raw' : 'plain'); return o ? new Promise((_, no) => { refuse = no; }) : Promise.resolve(); };
  I.lock(); assert.equal(I.wanted(), true); I.unlock(); assert.equal(I.wanted(), false); refuse(new Error('NotSupportedError')); await tick();
  I.lock(); refuse(new Error('NotSupportedError')); await tick();
  assert.deepEqual(calls, ['raw', 'exit', 'raw', 'plain']);
  canvas.requestPointerLock = saved; document.pointerLockElement = canvas; });
