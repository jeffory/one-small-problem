import test from 'node:test'; import assert from 'node:assert/strict'; import { fakeGL } from './fakegl.mjs';
import { uploadMesh, disposeMesh } from '../src/gfx/gl.js'; import { createMesh, box, finishMesh } from '../src/gfx/mesh.js'; import { MAT } from '../src/gfx/materials.js';
import { generateSurface } from '../src/gen/surface.js'; import { buildSurfaceScene } from '../src/game/surfaceScene.js';
test('disposeMesh frees everything uploadMesh made', () => { const gl = fakeGL(), M = createMesh(); box(M, 0, 0, 0, 1, 1, 1, MAT.hull);
  const g = uploadMesh(gl, finishMesh(M)); assert.equal(gl.live.size, 5); disposeMesh(gl, g); assert.equal(gl.live.size, 0); });
test('the surface scene owns its frame fields and frees all it made', () => { const gl = fakeGL(), s = buildSurfaceScene(gl, generateSurface('APOLLO-4471'));
  assert.equal(s.sky, true); assert.equal(s.mode, 0); assert.equal(s.gravity, 3.0); assert.equal(s.fog.length, 3); assert.ok(s.fogDensity > 0);
  assert.ok(gl.live.size > 0); s.dispose(); assert.equal(gl.live.size, 0); });
