// GPU scene for the base: the shell and props built from the BaseMap, in murky green-brown fog, lit only by banded point
// lights (its generated lamps plus the fight's plasma). No sky, no sun shadows, no curvature.
import { uploadMesh, disposeMesh } from '../gfx/gl.js';
import { I4, I3 } from '../gfx/math.js';
import { buildBaseMeshes } from './baseMesh.js';
import { GRAVITY } from './areas.js';

export function buildBaseScene(gl, B) {
  const { shell, props } = buildBaseMeshes(B), meshes = [shell, props].map(M => ({ gpu: uploadMesh(gl, M), model: I4, rot: I3 }));
  return {
    id: 'base', sky: false, mode: 1, fog: [.013, .015, .009], fogDensity: .075, gravity: GRAVITY.base,
    sun: [0, 1, 0], earth: [0, 0, -1], curv: 0,
    meshes, occTex: null, lamps: B.lights,
    dispose() { meshes.forEach(m => disposeMesh(gl, m.gpu)); },
  };
}
