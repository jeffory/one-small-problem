import test from 'node:test'; import assert from 'node:assert/strict';
import { createMesh, box, beam, prism, blob, lathe, transformFrom, finishMesh } from '../src/gfx/mesh.js';
import { T, Ry, mul, I4, xf, cameraBasis } from '../src/gfx/math.js';
const MAT = [0, 1, 0, 0], unit = d => { for (let k = 0; k < d.nrm.length; k += 3) assert.ok(Math.abs(Math.hypot(d.nrm[k], d.nrm[k + 1], d.nrm[k + 2]) - 1) < 1e-5); };
const counts = (fn) => { const M = createMesh(); fn(M); const d = finishMesh(M); unit(d); return [d.pos.length / 3, d.idx.length]; };
test('primitive vertex/index counts', () => {
  assert.deepEqual(counts(M => box(M, 0, 0, 0, 1, 1, 1, MAT)), [24, 36]);
  assert.deepEqual(counts(M => beam(M, [0, 0, 0], [0, 2, 0], .1, MAT)), [24, 36]);
  assert.deepEqual(counts(M => prism(M, 0, 0, 0, 1, 1, 6, MAT)), [38, 72]);
  assert.deepEqual(counts(M => blob(M, [0, 0, 0], [1, 1, 1], 8, 6, MAT)), [63, 288]);
  assert.deepEqual(counts(M => lathe(M, [0, 0, 0], [0, 1, 0], [[0, .5], [.5, .6], [1, .4]], 8, MAT)), [45, 144]);
  assert.deepEqual(counts(M => lathe(M, [0, 0, 0], [0, 1, 0], [[0, .5], [1, 0]], 8, MAT)), [27, 72]);
});
test('transformFrom moves only later vertices', () => { const M = createMesh(); box(M, 0, 0, 0, 1, 1, 1, MAT); box(M, 0, 0, 0, 1, 1, 1, MAT); transformFrom(M, 24, T(10, 0, 0));
  assert.equal(M.p[0], 0); assert.equal(M.p[24 * 3], 10); });
test('matrix helpers', () => { assert.deepEqual([...mul(I4, T(1, 2, 3))], [...T(1, 2, 3)]); assert.deepEqual(xf(T(1, 2, 3), [0, 0, 0]), [1, 2, 3]);
  const p = xf(Ry(Math.PI / 2), [0, 0, 1]); assert.ok(Math.abs(p[0] - 1) < 1e-6 && Math.abs(p[2]) < 1e-6);
  const { f, r, u } = cameraBasis(0, 0); assert.deepEqual([f, r, u].map(v => v.map(x => Math.round(x) + 0)), [[0, 0, -1], [1, 0, 0], [0, 1, 0]]); });
