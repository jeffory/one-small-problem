import test from 'node:test'; import assert from 'node:assert/strict'; import { buildModels, VIEW_MODEL } from '../src/game/models.js';
import { RIGS, partMatrix, muzzleWorld } from '../src/game/rigs.js'; import { WEAPONS } from '../src/game/weapons.js'; import { LAYER_COUNT, MAT } from '../src/gfx/materials.js'; import { xf } from '../src/gfx/math.js';
const M = buildModels(), rest = type => ({ type, x: 0, y: 0, z: 0, yaw: 0, t: 0, gait: 0, aim: 0, claw: 0, wave: 0, fall: 0 });
const verts = (m, mat) => { const o = []; for (let i = 0; i < m.pos.length; i += 3) o.push(xf(mat, [m.pos[i], m.pos[i + 1], m.pos[i + 2]])); return o; };
const posed = type => RIGS[type].parts.flatMap((p, k) => verts(M[p.mesh], partMatrix(rest(type), k)));
test('every model is clean: triangles, unit normals, baked layers', () => { for (const [k, m] of Object.entries(M)) { assert.ok(m.idx.length >= 3, k);
  for (let i = 0; i < m.nrm.length; i += 3) assert.ok(Math.abs(Math.hypot(m.nrm[i], m.nrm[i + 1], m.nrm[i + 2]) - 1) < 1e-3, k);
  for (let i = 0; i < m.mat.length; i += 4) assert.ok(m.mat[i] >= 0 && m.mat[i] < LAYER_COUNT, k); }
  for (const m of Object.values(MAT)) assert.ok(m[0] < LAYER_COUNT); });
test('every rig part has a model', () => { for (const R of Object.values(RIGS)) for (const p of R.parts) assert.ok(M[p.mesh], p.mesh); });
test('alien sizes read right: skitterer under a metre, brute about 2.4 m', () => { const top = t => Math.max(...posed(t).map(v => v[1]));
  assert.ok(top('sk') > .6 && top('sk') < 1.0, `sk ${top('sk')}`); assert.ok(top('br') > 2.0 && top('br') < 2.6, `br ${top('br')}`); assert.ok(Math.min(...posed('fl').map(v => v[1])) < -1.2); });
test("each alien's muzzle sits on its own weapon part", () => { for (const type of ['sk', 'fl', 'br']) { const R = RIGS[type], m = muzzleWorld(rest(type));
  const d = Math.min(...verts(M[R.parts[R.muzzle.part].mesh], partMatrix(rest(type), R.muzzle.part)).map(v => Math.hypot(v[0] - m[0], v[1] - m[1], v[2] - m[2])));
  assert.ok(d < .15, `${type} muzzle is ${d} m from its part`); } });
test('the held guns fire from their own muzzles', () => { for (const [k, w] of [['pistol', 1], ['scatter', 2]]) { const v = verts(M[k], new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  const tip = v.reduce((a, b) => (b[2] < a[2] ? b : a)), at = [VIEW_MODEL.off[0] + VIEW_MODEL.scale * tip[0], VIEW_MODEL.off[1] + VIEW_MODEL.scale * tip[1], VIEW_MODEL.off[2] - VIEW_MODEL.scale * tip[2]];
  at.forEach((x, i) => assert.ok(Math.abs(x - WEAPONS[w].muzzle[i]) < .03, `${k} axis ${i}: ${x} vs ${WEAPONS[w].muzzle[i]}`)); } });
test('scatter is at most 0.6 long; discs face up; props have the specified sizes', () => {
  const zs = verts(M.scatter, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])).map(v => v[2]); assert.ok(Math.max(...zs) - Math.min(...zs) <= .6, 'scatter length');
  for (const k of ['discScorch', 'discGoo']) { assert.equal(M[k].idx.length, 36, k); for (let i = 0; i < M[k].nrm.length; i += 3) assert.ok(M[k].nrm[i + 1] > .99, k); }
  const top = Math.max(...verts(M.canister, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])).map(v => v[1])); assert.ok(top >= .8 && top < 1, 'canister height'); });
test('the golf ball model is a small ball in the golf material', () => { assert.ok(M.golf); assert.equal(M.golf.mat[0], MAT.golf[0]); assert.equal(MAT.golf[0], 19); });
