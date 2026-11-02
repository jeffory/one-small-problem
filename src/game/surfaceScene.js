// GPU scene for a generated surface: terrain, rocks, lander and flag, plus the shadow height texture, the sky lights, a lamp over
// the hangar door and the guide lamps down the crater's switchback.
import { uploadMesh, disposeMesh, createHeightTexture } from '../gfx/gl.js';
import { createMesh, vtx, quadIdx, blob, finishMesh } from '../gfx/mesh.js';
import { MAT } from '../gfx/materials.js';
import { norm, I4, I3 } from '../gfx/math.js';
import { vn3 } from '../gen/noise.js';
import { sampleBilinear } from '../gen/surface.js';
import { CRATER } from '../gen/crater.js';
import { buildLander, buildBunker, buildGuides } from './props.js';
import { GRAVITY } from './areas.js';
import { LIGHT } from '../gen/baseplan.js';

// R17: render-only guide lamps down the switchback, as the crater wall is in the sun's shadow: at most `max`, `r` m pools over beacon
// posts `h` m tall, stood `side` m out from the centre line, just off the walkable strip.
export const GUIDE = { max: 8, gap: 15, r: 6, h: 2.5, side: CRATER.half + .4 };

// One guide by every vertex of the switchback; then, while fewer than GUIDE.max, the leg with the longest gap between guides gets
// one more, until every gap is GUIDE.gap m or less. Each stands on its leg's downhill side, at the ledge's edge, where the rim and
// the legs above can see it (on the uphill side the cut hid most of them).
export function guideLights(world) {
  const P = world.crater.path, C = world.base, legs = [], out = [];
  for (let k = 0; k + 1 < P.length; k++) legs.push({ n: 1, L: Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]) });
  for (let m = P.length; m < GUIDE.max; m++) { const g = legs.reduce((a, b) => (b.L / b.n > a.L / a.n ? b : a)); if (g.L / g.n <= GUIDE.gap) break; g.n++; }
  // a guide by (x, z) on leg k, out to the side toward the crater's centre
  const put = (x, z, k) => {
    const ex = P[k + 1][0] - P[k][0], ez = P[k + 1][1] - P[k][1], l = Math.hypot(ex, ez), s = ex * (C.z - z) - ez * (C.x - x) < 0 ? -1 : 1;
    const gx = x - s * ez / l * GUIDE.side, gz = z + s * ex / l * GUIDE.side; // s * (-ez, ex) / l is the normal toward the centre
    out.push({ x: gx, y: sampleBilinear(world.h, gx, gz) + GUIDE.h, z: gz, r: GUIDE.r, col: LIGHT.teal.col, kind: 0 });
  };
  P.forEach((q, k) => {
    put(q[0], q[1], Math.min(k, legs.length - 1));
    if (k < legs.length) for (let j = 1; j < legs[k].n; j++) put(q[0] + (P[k + 1][0] - q[0]) * j / legs[k].n, q[1] + (P[k + 1][1] - q[1]) * j / legs[k].n, k);
  });
  return out;
}

// The scene's CPU meshes (terrain, rocks, props) and lamps (the hangar door's, then the guides).
export function surfaceParts(world) {
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
  const ground = (x, z) => sampleBilinear(h, x, z), yaw = Math.atan2(dx, dz), guides = guideLights(world);
  buildLander(props, L.x, L.y, L.z, yaw, ground);
  buildBunker(props, world.crater);
  buildGuides(props, guides, ground);
  // The hangar door's lamp hangs 4 m above the door, 1 m out along its facing.
  const d = world.crater.door;
  return { meshes: [terr, rocks, props].map(finishMesh), lamps: [{ x: d.x + d.dx, y: d.y + 4, z: d.z + d.dz, r: 6, col: LIGHT.teal.col, kind: 0 }, ...guides] };
}

export function buildSurfaceScene(gl, world) {
  const S = surfaceParts(world), { dx, dz } = world.spawn;
  const meshes = S.meshes.map(m => ({ gpu: uploadMesh(gl, m), model: I4, rot: I3 })), occTex = createHeightTexture(gl, world.occ, world.N);
  return {
    id: 'surface', sky: true, mode: 0, fog: [.010, .014, .011], fogDensity: .07, gravity: GRAVITY.surface,
    sun: norm([-.43, .17, -.9]),
    earth: norm([.8 * dx, .42, .8 * dz]),
    curv: 1 / 1800,
    meshes, occTex, lamps: S.lamps,
    dispose() { meshes.forEach(m => disposeMesh(gl, m.gpu)); gl.deleteTexture(occTex); },
  };
}
