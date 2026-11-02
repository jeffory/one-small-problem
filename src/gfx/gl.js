// WebGL2 context, shader programs, mesh upload and the shadow height texture.

export function createGL(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, stencil: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 unavailable');
  return { gl, hdrOK: !!gl.getExtension('EXT_color_buffer_float') };
}

function shader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
  return s;
}

// defines {K: V} become `#define K V` lines right after the `#version` line. u.name is a uniform location or null.
export function compileProgram(gl, vs, fs, defines = {}) {
  const def = Object.entries(defines).map(([k, v]) => `#define ${k} ${v}\n`).join('');
  const inject = src => { const i = src.indexOf('\n') + 1; return src.slice(0, i) + def + src.slice(i); };
  const p = gl.createProgram(), sh = [shader(gl, gl.VERTEX_SHADER, inject(vs)), shader(gl, gl.FRAGMENT_SHADER, inject(fs))];
  for (const s of sh) gl.attachShader(p, s);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  for (const s of sh) { gl.detachShader(p, s); gl.deleteShader(s); }
  const loc = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); loc[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name); }
  return { p, u: new Proxy(loc, { get: (o, k) => o[k] ?? null }) };
}

// data = finishMesh() output {pos, nrm, mat, idx}; attribute locations 0 = pos, 1 = nrm, 2 = mat.
export function uploadMesh(gl, data) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  [[data.pos, 3], [data.nrm, 3], [data.mat, 4]].forEach(([d, size], loc) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  });
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: data.idx.length };
}

// n x n heights (row-major, z rows) as R16F, LINEAR, CLAMP_TO_EDGE: the world shader marches sun rays through it.
export function createHeightTexture(gl, f32, n) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, n, n, 0, gl.RED, gl.FLOAT, f32);
  texParams(gl, gl.TEXTURE_2D, gl.LINEAR, gl.LINEAR);
  return t;
}

export function texParams(gl, target, min, mag) {
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, min); gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, mag);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
