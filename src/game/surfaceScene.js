// GPU scene for a generated surface: terrain, rocks, lander and flag, plus the shadow height texture and the sky lights.
import { uploadMesh, disposeMesh, createHeightTexture } from '../gfx/gl.js';
import { createMesh, vtx, quadIdx, blob, finishMesh } from '../gfx/mesh.js';
import { MAT } from '../gfx/materials.js';
import { norm, I4, I3 } from '../gfx/math.js';
import { vn3 } from '../gen/noise.js';
import { sampleBilinear } from '../gen/surface.js';
import { buildLander } from './props.js';

export function buildSurfaceScene(gl, world) {
  const { N, half, h, lander: L, spawn: { dx, dz } } = world, terr = createMesh(), rocks = createMesh(), props = createMesh();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) vtx(terr, i - half, h[j * N + i], j - half, MAT.regolith);
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const a = j * N + i; quadIdx(terr, a, a + N, a + N + 1, a + 1); }

  // The world keeps each rock's radii, not its base size s; the larger footprint radius stands in for it (s * 0.8..1.4).
  for (const r of world.rocks) {
    const big = Math.max(r.sx, r.sz) > .8, sd = r.seed;
    blob(rocks, [r.x, r.y, r.z], [r.sx, r.sy, r.sz], big ? 12 : 8, big ? 8 : 6, MAT.rock,
      (a, b, c) => 1 + .35 * (vn3(a * 1.7 + sd, b * 1.7, c * 1.7, 0) - .5) + .12 * (vn3(a * 4 + sd, b * 4, c * 4, 0) - .5),
      r.yaw01 * 2 * Math.PI);
  }

  // The lander's front faces down the route.
  const ground = (x, z) => sampleBilinear(h, x, z), yaw = Math.atan2(dx, dz);
  buildLander(props, L.x, L.y, L.z, yaw, ground);

  const meshes = [terr, rocks, props].map(M => ({ gpu: uploadMesh(gl, finishMesh(M)), model: I4, rot: I3 })), occTex = createHeightTexture(gl, world.occ, N);
  return {
    sky: true, mode: 0, fog: [.010, .014, .011], fogDensity: .07, gravity: 3.0,
    sun: norm([-.43, .17, -.9]),
    earth: norm([.8 * dx, .42, .8 * dz]),
    curv: 1 / 1800,
    meshes, occTex,
    dispose() { meshes.forEach(m => disposeMesh(gl, m.gpu)); gl.deleteTexture(occTex); },
  };
}
