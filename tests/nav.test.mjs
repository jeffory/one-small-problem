import test from 'node:test'; import assert from 'node:assert/strict';
import { lineOfSight, createField, updateField, fieldDir } from '../src/game/nav.js';
const n = 64, half = 32, g = new Float32Array(n * n); for (let j = 10; j < 54; j++) g[j * n + 30] = 5; for (let i = 20; i <= 30; i++) { g[10 * n + i] = 5; g[53 * n + i] = 5; } // a ']' cup opening to -x
const ground = (x, z) => g[Math.round(z + half) * n + Math.round(x + half)] ?? 0;
test('line of sight: clear over flat ground, blocked by a wall, clear over its top', () => { const wall = x => (Math.abs(x) < .5 ? 3 : 0);
  assert.equal(lineOfSight(() => 0, [-5, 1.7, 0], [5, 1.7, 0]), true); assert.equal(lineOfSight(wall, [-5, 1.7, 0], [5, 1.7, 0]), false); assert.equal(lineOfSight(wall, [-5, 4, 0], [5, 4, 0]), true); });
test('the field leads around a wall to the player', () => { const F = createField(); updateField(F, g, n, half, 20, 0, 0.45);
  let x = -10, z = 0, k = 0; for (; k < 400 && Math.hypot(x - 20, z) > 1.5; k++) { const d = fieldDir(F, x, z); assert.ok(d, `stuck at ${x},${z}`); x += Math.round(d[0]); z += Math.round(d[1]); assert.ok(ground(x, z) < 1, `walked into the wall at ${x},${z}`); }
  assert.ok(k < 400); });
test('no direction outside the window or on unreachable cells', () => { const F = createField(); updateField(F, new Float32Array(512 * 512), 512, 256, 0, 0, 0.45);
  assert.equal(fieldDir(F, 100, 0), null); assert.equal(fieldDir(F, 0, 0), null); assert.ok(fieldDir(F, 10, 0)); });
test('a field update is quick', () => { const F = createField(), G = new Float32Array(512 * 512), t = performance.now(); for (let i = 0; i < 100; i++) updateField(F, G, 512, 256, i, 0, 0.45); assert.ok(performance.now() - t < 300); });
