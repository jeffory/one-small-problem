import test from 'node:test'; import assert from 'node:assert/strict';
import { generateSurface, sampleGround, distToPolyline, MAX_STEP, MAP_MARGIN, N, HALF } from '../src/gen/surface.js';
import { passable } from '../src/gen/passable.js'; import { checksumWorld } from '../src/gen/checksum.js';
const W = generateSurface('APOLLO-4471'), cell = p => [Math.round(p.x + HALF), Math.round(p.z + HALF)];
test('same seed, same world; different seed, different world', () => {
  assert.equal(checksumWorld(generateSurface('APOLLO-4471')), checksumWorld(W)); assert.match(checksumWorld(W), /^[0-9a-f]{8}$/);
  assert.notEqual(checksumWorld(generateSurface('EAGLE-0001')), checksumWorld(W)); assert.ok(Number.isInteger(W.attempt) && W.attempt >= 0 && W.attempt < 8); });
test('collision heights never dip below terrain', () => { for (let i = 0; i < W.h.length; i++) assert.ok(W.occ[i] >= W.h[i]); });
test('rocks stay off the route and inside the map', () => { assert.ok(W.rocks.length > 150);
  for (const k of W.rocks) { assert.ok(distToPolyline(k.x, k.z, W.route) > 10); assert.ok(Math.abs(k.x) <= 232 && Math.abs(k.z) <= 232 && k.sx > 0 && k.sy > 0 && k.sz > 0); } });
test('route centreline is walkable on the collision heights', () => {
  for (let k = 0; k + 1 < W.route.length; k++) {
    const [ax, az] = W.route[k], [bx, bz] = W.route[k + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az));
    let prev = sampleGround(W, ax, az);
    for (let i = 1; i <= n; i++) {
      const t = i / n, v = sampleGround(W, ax + (bx - ax) * t, az + (bz - az) * t);
      assert.ok(Math.abs(v - prev) <= MAX_STEP, `segment ${k} sample ${i}: delta ${v - prev}`); prev = v;
    }
  }
});
test('re-roll: reseeds per attempt and throws when nothing is accepted', () => {
  const r = generateSurface('APOLLO-4471', w => w.attempt >= 2);
  assert.equal(r.attempt, 2); assert.notEqual(checksumWorld(r), checksumWorld(W));
  assert.throws(() => generateSurface('NOPE-0001', () => false), /no passable layout for seed NOPE-0001/);
});
test('lander blocks walking into it', () => { assert.ok(sampleGround(W, W.lander.x, W.lander.z) - W.lander.y > 4); });
test('passable: a full wall blocks, a gap lets through', () => {
  const g = new Float32Array(HALF); for (let j = 0; j < 16; j++) g[j * 16 + 8] = 5; assert.equal(passable(g, 16, [2, 2], [14, 14], 0.45), false);
  g[3 * 16 + 8] = 0; assert.equal(passable(g, 16, [2, 2], [14, 14], 0.45), true); });
test('generation is quick', () => { const t = performance.now(); generateSurface('SPEED-0001'); assert.ok(performance.now() - t < 2000); });
test('the lander cannot be walked over at any frame rate', async () => {
  const { createPlayer, stepPlayer } = await import('../src/game/player.js'), ground = (x, z) => sampleGround(W, x, z), { lander: L, spawn: S } = W;
  for (const dt of [1 / 60, 1 / 144]) {
    const p = createPlayer({ x: L.x + 8 * S.dx, z: L.z + 8 * S.dz, dx: -S.dx, dz: -S.dz }, ground);
    for (let t = 0; t < 4; t += dt) stepPlayer(p, { fwd: 1, strafe: 0, run: false, jump: false }, dt, ground, 232);
    assert.ok(Math.hypot(p.x - L.x, p.z - L.z) >= 2.0 && p.y - L.y < 0.5, `dt ${dt}: dist ${Math.hypot(p.x - L.x, p.z - L.z)} y ${p.y - L.y}`);
  }
});
