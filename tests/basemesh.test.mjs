import test from 'node:test'; import assert from 'node:assert/strict';
import { generateWorld } from '../src/gen/world.js'; import { K } from '../src/gen/base.js'; import { buildBaseMeshes } from '../src/game/baseMesh.js'; import { LAYER, LAYER_COUNT, MAT } from '../src/gfx/materials.js';
const M = generateWorld('APOLLO-4471').baseMap, { shell, props } = buildBaseMeshes(M);
const tris = m => { const o = []; for (let i = 0; i < m.idx.length; i += 3) { const [a, b, c] = [m.idx[i] * 3, m.idx[i + 1] * 3, m.idx[i + 2] * 3];
  o.push({ x: (m.pos[a] + m.pos[b] + m.pos[c]) / 3, y: (m.pos[a + 1] + m.pos[b + 1] + m.pos[c + 1]) / 3, z: (m.pos[a + 2] + m.pos[b + 2] + m.pos[c + 2]) / 3, ny: m.nrm[a + 1], layer: m.mat[m.idx[i] * 4] }); } return o; };
test('both meshes are clean: unit normals, baked layers, a sane size', () => { for (const m of [shell, props]) { assert.ok(m.idx.length >= 3);
  for (let i = 0; i < m.nrm.length; i += 3) assert.ok(Math.abs(Math.hypot(m.nrm[i], m.nrm[i + 1], m.nrm[i + 2]) - 1) < 1e-3);
  for (let i = 0; i < m.mat.length; i += 4) assert.ok(m.mat[i] >= 0 && m.mat[i] < LAYER_COUNT); } assert.ok((shell.pos.length + props.pos.length) / 3 < 150000); });
test('every walkable tile has a floor under it and a pipe ceiling over it', () => { const fl = new Map(), ce = new Map(), key = t => `${Math.round(t.x + M.half)},${Math.round(t.z + M.half)},${t.y.toFixed(2)}`;
  for (const t of tris(shell)) { if (t.ny > .99) fl.set(key(t), t.layer); if (t.ny < -.99) ce.set(key(t), t.layer); }
  for (let k = 0; k < M.n * M.n; k++) if (M.kind[k] === K.floor) { const i = k % M.n, j = k / M.n | 0;
    assert.ok([LAYER.grate, LAYER.regolith].includes(fl.get(`${i},${j},${M.floor[k].toFixed(2)}`)), `floor ${i}, ${j}`); assert.equal(ce.get(`${i},${j},${M.ceil[k].toFixed(2)}`), LAYER.pipes, `ceiling ${i}, ${j}`); } });
test('the themed rooms get their set pieces', () => { const T = tris(props), inside = (t, theme) => { const r = M.rooms.find(q => q.theme === theme), i = t.x + M.half, j = t.z + M.half;
  return i >= r.x0 - .5 && i < r.x1 - .5 && j >= r.z0 - .5 && j < r.z1 - .5; };
  for (const [layer, theme] of [[LAYER.glass, 'hangar'], [LAYER.foil, 'lab'], [LAYER.reactor, 'reactor'], [LAYER.flesh, 'greenhouse'], [LAYER.red, 'comms'], [LAYER.grate, 'lift']])
    assert.ok(T.some(t => t.layer === layer && inside(t, theme)), theme); });
test('wall panels never glow; the golf ball is small, white and findable', async () => { assert.equal(MAT.wall[2], 0); const { buildModels } = await import('../src/game/models.js'), g = buildModels().golf;
  let r = 0; for (let i = 0; i < g.pos.length; i += 3) r = Math.max(r, Math.hypot(g.pos[i], g.pos[i + 1], g.pos[i + 2])); assert.ok(r > .05 && r < .08); assert.equal(g.mat[0], LAYER.golf); });
// pre-flight F10 and ruling R4
test('the reactor core is visible: no shell wall or soffit stands in its footprint, and the core is built', () => {
  const core = M.props.find(p => p.kind === 'core'), R = 1.6 + .5;
  for (const t of tris(shell)) if (Math.abs(t.ny) < .5) assert.ok(Math.hypot(t.x - core.x, t.z - core.z) > R, `shell wall at ${t.x}, ${t.z}`);
  const P = tris(props).filter(t => t.layer === LAYER.reactor && Math.hypot(t.x - core.x, t.z - core.z) < 1.2);
  assert.ok(P.length > 8); assert.ok(Math.max(...P.map(t => t.y)) > 4);
  const ceilQ = tris(shell).filter(t => t.ny < -.99 && Math.hypot(t.x - core.x, t.z - core.z) < 1); assert.ok(ceilQ.length && ceilQ.every(t => Math.abs(t.y - core.d) < 1e-3)); });
test('the parked saucer is 4 m wide and its rim never overhangs a walkable tile', () => {
  const s = M.props.find(p => p.kind === 'saucer'); let rim = 0;
  for (let i = 0; i < props.pos.length; i += 3) { const x = props.pos[i] - s.x, z = props.pos[i + 2] - s.z, y = props.pos[i + 1];
    if (Math.abs(x) < 2.6 && Math.abs(z) < 2.6 && y > .4 && y < 2) rim = Math.max(rim, Math.hypot(x, z)); }
  assert.ok(rim > 1.95 && rim < 2.05, `rim ${rim}`);
  for (let k = 0; k < M.n * M.n; k++) { if (M.kind[k] !== K.floor && M.kind[k] !== K.cover) continue;
    const x = k % M.n - M.half - s.x, z = (k / M.n | 0) - M.half - s.z; if (Math.abs(x) < 4 && Math.abs(z) < 4) assert.ok(Math.max(Math.abs(x), Math.abs(z)) - .5 >= 0 && Math.hypot(Math.max(0, Math.abs(x) - .5), Math.max(0, Math.abs(z) - .5)) >= rim - 1e-3, `overhangs tile ${k}`); } });
