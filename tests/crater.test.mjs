import test from 'node:test'; import assert from 'node:assert/strict';
import { generateWorld } from '../src/gen/world.js'; import { CRATER } from '../src/gen/crater.js'; import { reachMap } from '../src/gen/passable.js'; import { checksumWorld } from '../src/gen/checksum.js';
import { sampleGround, distToPolyline, polylineLength, MAX_STEP, N, HALF, MAP_MARGIN } from '../src/gen/surface.js';
import { createMesh, finishMesh } from '../src/gfx/mesh.js'; import { buildBunker } from '../src/game/props.js';
const W = generateWorld('APOLLO-4471'), K = W.crater, B = W.base, g = (x, z) => sampleGround(W, x, z), cell = p => [Math.round(p.x + HALF), Math.round(p.z + HALF)];
const rad = ([x, z]) => Math.hypot(x - B.x, z - B.z) / B.R;
test('the switchback runs from the route end down the inner wall to the crater floor', () => {
  assert.deepEqual(K.path[0], W.route.at(-1)); assert.equal(K.path.length, CRATER.legs.length); assert.ok(rad(K.path.at(-1)) < .5);
  for (let k = 1; k < K.path.length; k++) assert.ok(rad(K.path[k]) < rad(K.path[k - 1]));
  assert.ok(K.ys[0] - K.door.y > 8, `drop ${K.ys[0] - K.door.y}`); assert.ok(polylineLength(K.path) > 1.5 * B.R); });
test('the switchback is walkable along its centreline and across its width, except inside each hairpin, which is a ledge', () => { for (let k = 0; k + 1 < K.path.length; k++) {
  const [ax, az] = K.path[k], [bx, bz] = K.path[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L), px = -(bz - az) / L, pz = (bx - ax) / L;
  const inner = q => { const o = K.path[q === k ? k - 1 : k + 2]; return Math.sign(px * (o[0] - K.path[q][0]) + pz * (o[1] - K.path[q][1])); }; // the side toward the other leg at bend q
  let prev = g(ax, az);
  for (let i = 1; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n, c = g(x, z); assert.ok(Math.abs(c - prev) <= MAX_STEP, `leg ${k} step ${i}`); prev = c;
    for (const s of [-1, 1]) { if ([k, k + 1].some(q => q >= 1 && q <= 3 && s === inner(q) && Math.hypot(x - K.path[q][0], z - K.path[q][1]) < 12)) continue; // pre-flight F2
      assert.ok(Math.abs(g(x + px * s * (CRATER.half - .5), z + pz * s * (CRATER.half - .5)) - c) <= MAX_STEP, `leg ${k} sample ${i} side ${s}`); } } } });
test('the hangar door is reachable from the spawn, and the bunker cannot be walked through', () => {
  const reach = reachMap(W.occ, N, cell(W.spawn), MAX_STEP, MAP_MARGIN), [i, j] = cell(K.use); assert.equal(reach[j * N + i], 1);
  const b = K.bunker; assert.ok(g(b.x, b.z) - b.y >= b.h - .01); assert.ok(Math.hypot(K.use.x - K.door.x, K.use.z - K.door.z) <= 2);
  assert.ok((K.use.x - K.door.x) * K.door.dx + (K.use.z - K.door.z) * K.door.dz > 0, 'the use spot is in front of the door'); });
test('no rock sits on the switchback', () => { for (const k of W.rocks) assert.ok(distToPolyline(k.x, k.z, K.path) > CRATER.half + Math.max(k.sx, k.sz), `rock at ${k.x}, ${k.z}`); });
test('the bunker mesh stands on its footprint', () => { const M = createMesh(); buildBunker(M, K); const m = finishMesh(M), b = K.bunker;
  for (let i = 0; i < m.pos.length; i += 3) { const dx = m.pos[i] - b.x, dz = m.pos[i + 2] - b.z, a = dx * b.ux + dz * b.uz, s = -dx * b.uz + dz * b.ux;
    assert.ok(Math.abs(a) <= b.d / 2 + .6 && Math.abs(s) <= b.w / 2 + .6 && m.pos[i + 1] >= b.y - .5 && m.pos[i + 1] <= b.y + b.h + 1); } });
test('the crater is in the checksum', () => { const a = generateWorld('APOLLO-4471'); a.crater.door.y += 1; assert.notEqual(checksumWorld(a), checksumWorld(W)); });
