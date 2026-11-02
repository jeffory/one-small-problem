import test from 'node:test'; import assert from 'node:assert/strict';
import { generateSurface, sampleGround, distToPolyline, MAX_STEP, MAP_MARGIN } from '../src/gen/surface.js';
import { passable } from '../src/gen/passable.js'; import { checksumWorld } from '../src/gen/checksum.js';
const W = generateSurface('APOLLO-4471'), cell = p => [Math.round(p.x + 256), Math.round(p.z + 256)];
test('same seed, same world; different seed, different world', () => {
  assert.equal(checksumWorld(generateSurface('APOLLO-4471')), checksumWorld(W)); assert.match(checksumWorld(W), /^[0-9a-f]{8}$/);
  assert.notEqual(checksumWorld(generateSurface('EAGLE-0001')), checksumWorld(W)); assert.ok(Number.isInteger(W.attempt) && W.attempt >= 0 && W.attempt < 8); });
test('collision heights never dip below terrain', () => { for (let i = 0; i < W.h.length; i++) assert.ok(W.occ[i] >= W.h[i]); });
test('rocks stay off the route and inside the map', () => { assert.ok(W.rocks.length > 150);
  for (const k of W.rocks) { assert.ok(distToPolyline(k.x, k.z, W.route) > 10); assert.ok(Math.abs(k.x) <= 232 && Math.abs(k.z) <= 232 && k.sx > 0 && k.sy > 0 && k.sz > 0); } });
test('route is walkable on the collision heights', () => { assert.ok(passable(W.occ, 512, cell(W.spawn), cell(W.rim), MAX_STEP, MAP_MARGIN)); });
test('lander blocks walking into it', () => { assert.ok(sampleGround(W, W.lander.x, W.lander.z) - W.lander.y > 4); });
test('passable: a full wall blocks, a gap lets through', () => {
  const g = new Float32Array(256); for (let j = 0; j < 16; j++) g[j * 16 + 8] = 5; assert.equal(passable(g, 16, [2, 2], [14, 14], 0.45), false);
  g[3 * 16 + 8] = 0; assert.equal(passable(g, 16, [2, 2], [14, 14], 0.45), true); });
test('generation is quick', () => { const t = performance.now(); generateSurface('SPEED-0001'); assert.ok(performance.now() - t < 2000); });
