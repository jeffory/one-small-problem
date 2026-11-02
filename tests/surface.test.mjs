import test from 'node:test'; import assert from 'node:assert/strict';
import { makeRng } from '../src/gen/rng.js';
import { N, pickLayout, buildRoute, buildHeightfield, craterProfile, distToPolyline, polylineLength, sampleBilinear } from '../src/gen/surface.js';
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
test('craterProfile shape', () => {
  assert.ok(near(craterProfile(0, 5), -1.6)); assert.ok(near(craterProfile(0, 20), -4.992)); assert.ok(near(craterProfile(1, 20), 1.5));
  assert.equal(craterProfile(1.8, 20), 0); assert.ok(Math.abs(craterProfile(0.999, 20) - craterProfile(1.001, 20)) < 0.05);
});
test('layout: lander south-west, base crater north-east', () => { for (const s of ['A', 'B', 'C', 'D']) { const L = pickLayout(makeRng(s));
  assert.ok(L.lander.x < -140 && L.lander.z > 140 && L.base.x > 120 && L.base.z < -120 && L.base.R >= 55 && L.base.R < 68);
  assert.ok(near(Math.hypot(L.spawn.x - L.lander.x, L.spawn.z - L.lander.z), 6, 1e-6)); } });
test('route runs spawn -> rim, 300-900 m, inside the map', () => { const rng = makeRng('ROUTE'), L = pickLayout(rng), r = buildRoute(rng, L);
  assert.equal(r.length, 9); assert.deepEqual(r[0], [L.spawn.x, L.spawn.z]);
  assert.ok(near(Math.hypot(r[8][0] - L.base.x, r[8][1] - L.base.z), L.base.R * 1.05, 1e-6));
  const len = polylineLength(r); assert.ok(len > 300 && len < 900, `len ${len}`); for (const [x, z] of r) assert.ok(Math.abs(x) <= 216 && Math.abs(z) <= 216);
  assert.equal(distToPolyline(r[3][0], r[3][1], r), 0); });
test('height field: gentle along the route, flat pad, base crater first', () => {
  const rng = makeRng('APOLLO-4471'), L = pickLayout(rng), route = buildRoute(rng, L), { h, craters } = buildHeightfield(rng, L, route);
  assert.equal(h.length, N * N); assert.equal(craters[0][2], L.base.R);
  for (let k = 0; k < 8; k++) { const [ax, az] = route[k], [bx, bz] = route[k + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az));
    for (let s = 0; s < n; s++) { const t0 = s / n, t1 = (s + 1) / n;
      const d = Math.abs(sampleBilinear(h, ax + (bx - ax) * t1, az + (bz - az) * t1) - sampleBilinear(h, ax + (bx - ax) * t0, az + (bz - az) * t0));
      assert.ok(d < 0.45, `slope ${d} on segment ${k}`); } }
  for (let a = 0; a < 16; a++) { const x = L.lander.x + 3.5 * Math.cos(a), z = L.lander.z + 3.5 * Math.sin(a); assert.ok(Math.abs(sampleBilinear(h, x, z) - L.lander.y) < 0.3); }
});
test('sampleBilinear is exact on grid points', () => { const h = new Float32Array(N * N).map((_, i) => i % 97); assert.equal(sampleBilinear(h, 10 - 256, 20 - 256), h[20 * N + 10]); });
