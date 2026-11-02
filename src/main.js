// Temporary renderer demo (Task 9 replaces it): a noise-height regolith patch, a rock and a hull box under a low sun.
import { createGL, uploadMesh, createHeightTexture } from './gfx/gl.js';
import { bakeTextures } from './gfx/bake.js';
import { createRenderer } from './gfx/renderer.js';
import { MAT } from './gfx/materials.js';
import { createMesh, vtx, quadIdx, blob, box, finishMesh } from './gfx/mesh.js';
import { norm, I4, I3 } from './gfx/math.js';
import { valueNoise2, vn3 } from './gen/noise.js';

const N = 512, HALF = 256, G = 64, X0 = -32, Z0 = -44, ground = (x, z) => valueNoise2(x / 6, z / 6, 1) * 1.5;
const { gl, hdrOK } = createGL(document.getElementById('c'));
const renderer = createRenderer(gl, hdrOK, bakeTextures(gl));

// Shadow heights: the grid's cells, raised under the props; everything off the grid casts nothing.
const occ = new Float32Array(N * N).fill(-1e4), terr = createMesh(), props = createMesh();
const stamp = (x, z, top) => { const k = (z + HALF) * N + x + HALF; occ[k] = Math.max(occ[k], top); };
for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const x = X0 + i, z = Z0 + j, y = ground(x, z); vtx(terr, x, y, z, MAT.regolith); stamp(x, z, y); }
for (let j = 0; j < G - 1; j++) for (let i = 0; i < G - 1; i++) { const a = j * G + i; quadIdx(terr, a, a + G, a + G + 1, a + 1); }

const rx = -3, rz = 8, rs = [1.5, .95, 1.25], ry = ground(rx, rz) - rs[1] * .3;
blob(props, [rx, ry, rz], rs, 12, 8, MAT.rock, (a, b, c) => 1 + .35 * (vn3(a * 1.7, b * 1.7, c * 1.7, 7) - .5) + .12 * (vn3(a * 4, b * 4, c * 4, 7) - .5), .6);
for (let z = rz - 2; z <= rz + 2; z++) for (let x = rx - 2; x <= rx + 2; x++) {
  const q = 1 - ((x - rx) ** 2 + (z - rz) ** 2) / (rs[0] * .85) ** 2; if (q > 0) stamp(x, z, ry + rs[1] * Math.sqrt(q));
}
const by = ground(4, 4);
box(props, 3, by - .3, 3, 5.4, by + 2.1, 5, MAT.hull);
for (let z = 3; z <= 5; z++) for (let x = 3; x <= 5; x++) stamp(x, z, by + 2.1);

const occTex = createHeightTexture(gl, occ, N);
const meshes = [terr, props].map(M => ({ gpu: uploadMesh(gl, finishMesh(M)), model: I4, rot: I3 }));
const sun = norm([-.43, .17, -.9]), earth = norm([.35, .3, -.8]), t0 = performance.now();
const lights = { pos: new Float32Array(64), col: new Float32Array(64), count: 0 }, spheres = new Float32Array(32);

const resize = () => renderer.resize(innerWidth, innerHeight, devicePixelRatio || 1);
addEventListener('resize', resize); resize();
function frame(now) {
  renderer.render({
    t: (now - t0) / 1000, cam: { x: 0, y: 2.5, z: 20, yaw: 0, pitch: -.15 }, sky: true, mode: 0, sun, earth, curv: 1 / 1800,
    fog: [.010, .014, .011], fogDensity: .07, meshes, occTex, lights, spheres, exposure: 1, palMode: 1,
  });
  window.ospTest ??= { ready: true, capture: () => renderer.capture() };
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
