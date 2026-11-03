// Frame pipeline (as the look test): low-res float target -> sky -> world meshes -> opaque sprites -> additive glows
// -> depth clear and the first-person view model -> palette/dither post into a low-res RGBA8 target -> nearest-neighbour
// blit to the canvas.
import { compileProgram, createHeightTexture, texParams } from './gl.js';
import { bakeTextures } from './bake.js';
import { LAYER } from './materials.js';
import { PALETTE, paletteFloats } from './palette.js';
import { persp, mul, viewM, cameraBasis } from './math.js';
import FSQ_VS from './shaders/fsq.vert';
import WORLD_VS from './shaders/world.vert';
import WORLD_FS from './shaders/world.frag';
import SKY_FS from './shaders/sky.frag';
import POST_FS from './shaders/post.frag';
import SPRITE_VS from './shaders/sprite.vert';
import SPRITE_FS from './shaders/sprite.frag';

const FOV = 62 * Math.PI / 180, Z3 = [0, 0, 0];

/**
 * tex defaults to a fresh bake; pass bakeTextures(gl) to share one bake.
 * Frame = {t, cam: {x, y, z, yaw, pitch}, sky, mode: 0 surface | 1 base, sun, earth, curv, fog, fogDensity,
 *   meshes: [{gpu: uploadMesh(), model: mat4, rot: mat3, flash?: 0-1 hit flash}], occTex (null = nothing casts terrain shadows),
 *   lights: {pos: vec4[16] xyz+radius, col: vec4[16], count}, spheres: vec4[8] xyz+radius, exposure, palMode: 0 off | 1 dithered | 2 flat,
 *   sprites?: {data: Float32Array(512 * 8) of x, y, z, size, r, g, b, 0 (opaque discs first, then glows), nOpaque, nGlow},
 *   view?: {gpu, model, rot} | null (drawn after a depth clear), tint?: [k, w, reach] where k mixes the screen edges toward blood red (capped at .85)
 *   over reach (0-1, how far in from the edges), and w (the opening's blast flash) toward warm off-white, capped at .85}
 * Missing sprites, view and tint mean none, none and zero.
 */
export function createRenderer(gl, hdrOK, tex = bakeTextures(gl)) {
  const canvas = gl.canvas, empty = gl.createVertexArray(), noOcc = createHeightTexture(gl, new Float32Array([-1e4]), 1);
  const world = compileProgram(gl, WORLD_VS, WORLD_FS, { L_ROCK: LAYER.rock.toFixed(1), L_MACRO: LAYER.macro.toFixed(1) });
  const sky = compileProgram(gl, FSQ_VS, SKY_FS), post = compileProgram(gl, FSQ_VS, POST_FS, { NP: PALETTE.length });
  gl.useProgram(world.p); gl.uniform1i(world.u.uA, 0); gl.uniform1i(world.u.uE, 1); gl.uniform1i(world.u.uOcc, 2);
  gl.useProgram(post.p); gl.uniform1i(post.u.uS, 3); gl.uniform3fv(post.u.P, paletteFloats());
  // Sprites: one instance per 8 floats of a DYNAMIC_DRAW buffer; location 0 = xyz + size, 1 = colour.
  const spr = compileProgram(gl, SPRITE_VS, SPRITE_FS), sVao = gl.createVertexArray(), sBuf = gl.createBuffer();
  gl.bindVertexArray(sVao);
  for (const l of [0, 1]) { gl.enableVertexAttribArray(l); gl.vertexAttribDivisor(l, 1); }
  gl.bindVertexArray(null);
  // WebGL2 has no base instance, so each draw points the attributes at its first sprite (needs sVao and sBuf bound).
  const from = i => { gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, i * 32); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, i * 32 + 16); };
  let w = 1, h = 1, hdrTex = null, ldrTex = null, depthRB = null, fboH = null, fboL = null;

  const target = fmt => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h); texParams(gl, gl.TEXTURE_2D, gl.NEAREST, gl.NEAREST);
    return t;
  };
  const fbo = (t, depth) => {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (depth) gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    return f;
  };

  function resize(cssW, cssH, dpr, resH = 270) {
    const k = Math.min(2, dpr);
    canvas.width = Math.max(1, Math.round(cssW * k)); canvas.height = Math.max(1, Math.round(cssH * k));
    h = resH; w = Math.max(1, Math.round(resH * canvas.width / canvas.height));
    gl.deleteTexture(hdrTex); gl.deleteTexture(ldrTex); gl.deleteRenderbuffer(depthRB); gl.deleteFramebuffer(fboH); gl.deleteFramebuffer(fboL);
    hdrTex = target(hdrOK ? gl.RGBA16F : gl.RGBA8); ldrTex = target(gl.RGBA8);
    depthRB = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, depthRB); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    fboH = fbo(hdrTex, depthRB); fboL = fbo(ldrTex, null); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function render(F) {
    const { f, r, u } = cameraBasis(F.cam.yaw, F.cam.pitch), eye = [F.cam.x, F.cam.y, F.cam.z], asp = w / h;
    const clear = F.mode === 1 ? F.fog : [0, 0, 0];
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboH); gl.viewport(0, 0, w, h); gl.clearColor(clear[0], clear[1], clear[2], 1);
    gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    if (F.sky) {
      const S = sky.u;
      gl.disable(gl.DEPTH_TEST); gl.useProgram(sky.p);
      gl.uniform3fv(S.uF, f); gl.uniform3fv(S.uR, r); gl.uniform3fv(S.uU, u); gl.uniform3fv(S.uSun, F.sun); gl.uniform3fv(S.uEarth, F.earth);
      gl.uniform1f(S.uTan, Math.tan(FOV / 2)); gl.uniform1f(S.uAsp, asp); gl.bindVertexArray(empty); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    const U = world.u;
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.useProgram(world.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex.texA);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex.texE);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, F.occTex || noOcc);
    const VP = mul(persp(FOV, asp, .05, 700), viewM(eye, f, r, u));
    gl.uniformMatrix4fv(U.uVP, false, VP);
    gl.uniform3fv(U.uCam, eye); gl.uniform3fv(U.uSun, F.sun); gl.uniform3fv(U.uFog, F.fog); gl.uniform1f(U.uFogD, F.fogDensity);
    gl.uniform1f(U.uT, F.t); gl.uniform1f(U.uCurv, F.curv); gl.uniform1i(U.uMode, F.mode); gl.uniform1i(U.uNL, F.lights.count);
    gl.uniform4fv(U.uL, F.lights.pos); gl.uniform4fv(U.uLC, F.lights.col); gl.uniform4fv(U.uSph, F.spheres);
    const draw = m => {
      gl.uniformMatrix4fv(U.uMod, false, m.model); gl.uniformMatrix3fv(U.uRot, false, m.rot); gl.uniform1f(U.uFl, m.flash || 0);
      gl.bindVertexArray(m.gpu.vao); gl.drawElements(gl.TRIANGLES, m.gpu.count, gl.UNSIGNED_INT, 0);
    };
    F.meshes.forEach(draw);
    // Opaque discs write depth; the glows after them add light without writing it.
    const S = F.sprites, no = S ? S.nOpaque : 0, ng = S ? S.nGlow : 0;
    if (no + ng) {
      const P = spr.u;
      gl.useProgram(spr.p); gl.uniformMatrix4fv(P.uVP, false, VP); gl.uniform3fv(P.uR, r); gl.uniform3fv(P.uU, u);
      gl.uniform3fv(P.uCam, eye); gl.uniform1f(P.uCurv, F.curv);
      gl.uniform1i(P.uMode, F.mode); gl.uniform1f(P.uFogD, F.fogDensity); gl.uniform3fv(P.uFog, F.fog);
      gl.bindVertexArray(sVao); gl.bindBuffer(gl.ARRAY_BUFFER, sBuf); gl.bufferData(gl.ARRAY_BUFFER, S.data, gl.DYNAMIC_DRAW, 0, (no + ng) * 8);
      if (no) { from(0); gl.uniform1i(P.uG, 0); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, no); }
      if (ng) {
        from(no); gl.uniform1i(P.uG, 1); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, ng); gl.disable(gl.BLEND); gl.depthMask(true);
      }
    }
    // The view model gets a clean depth buffer so it never sinks into the world; world uniforms are still set.
    if (F.view) { gl.clear(gl.DEPTH_BUFFER_BIT); gl.useProgram(world.p); draw(F.view); }
    // Post reads the float target from unit 3, which no world sampler uses, so there is no feedback loop.
    gl.disable(gl.DEPTH_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, fboL); gl.useProgram(post.p);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, hdrTex);
    gl.uniform1i(post.u.uP, F.palMode); gl.uniform1f(post.u.uX, F.exposure); gl.uniform3fv(post.u.uK, F.tint || Z3);
    gl.bindVertexArray(empty); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fboL); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  }

  // Reads back the low-res palette target: fractions of in-palette and pure-black pixels, distinct RGB count, and the mean of
  // (r + g + b) / 3 over the frame (0-255), and the mean redness max(0, r - (g + b) / 2) / 255 of the edge band
  // (within w / 8 of the left or right side or h / 8 of the top or bottom) and of the centre box (|dx| < w / 8, |dy| < h / 8).
  function capture() {
    const px = new Uint8Array(w * h * 4), pal = new Set(PALETTE.map(s => parseInt(s, 16))), seen = new Set();
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fboL); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    let inPal = 0, black = 0, sum = 0, eS = 0, eN = 0, mS = 0, mN = 0;
    for (let i = 0; i < px.length; i += 4) { const c = px[i] << 16 | px[i + 1] << 8 | px[i + 2]; seen.add(c); if (pal.has(c)) inPal++; if (!c) black++; sum += px[i] + px[i + 1] + px[i + 2];
      const x = (i >> 2) % w, y = ((i >> 2) - x) / w, red = Math.max(0, px[i] - (px[i + 1] + px[i + 2]) / 2) / 255;
      if (x < w / 8 || x >= w - w / 8 || y < h / 8 || y >= h - h / 8) { eS += red; eN++; }
      if (Math.abs(x + .5 - w / 2) < w / 8 && Math.abs(y + .5 - h / 2) < h / 8) { mS += red; mN++; } }
    return { w, h, inPalette: inPal / (w * h), black: black / (w * h), colours: seen.size, mean: sum / 3 / (w * h), edge: eN ? eS / eN : 0, mid: mN ? mS / mN : 0 };
  }

  return { resize, render, capture };
}
