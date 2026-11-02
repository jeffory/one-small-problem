// One-off GPU texture bake: bake.frag renders every material layer into two 256x256 texture arrays at load.
import { compileProgram } from './gl.js';
import { LAYER_COUNT } from './materials.js';
import FSQ_VS from './shaders/fsq.vert';
import BAKE_FS from './shaders/bake.frag';

const TS = 256;

function texArray(gl) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.log2(TS) + 1, gl.RGBA8, TS, TS, LAYER_COUNT);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
  return t;
}

// texA = albedo rgb + height a, texE = emissive rgb; both written at once through two colour attachments.
export function bakeTextures(gl) {
  const { p, u } = compileProgram(gl, FSQ_VS, BAKE_FS), texA = texArray(gl), texE = texArray(gl);
  const fb = gl.createFramebuffer(), vao = gl.createVertexArray();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  gl.viewport(0, 0, TS, TS); gl.useProgram(p); gl.bindVertexArray(vao); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  for (let l = 0; l < LAYER_COUNT; l++) {
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, texA, 0, l);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, texE, 0, l);
    gl.uniform1i(u.uLay, l); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindVertexArray(null);
  gl.deleteFramebuffer(fb); gl.deleteVertexArray(vao); gl.deleteProgram(p);
  for (const t of [texA, texE]) { gl.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.generateMipmap(gl.TEXTURE_2D_ARRAY); }
  return { texA, texE };
}
