import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs'; import { generateWorld } from '../src/gen/world.js'; import { makeRng } from '../src/gen/rng.js';
import { sampleBilinear, LANDER_OCC } from '../src/gen/surface.js'; import { FLAG, LAYER } from '../src/gfx/materials.js'; import { segmentHits } from './helpers.mjs';
import { PIECES, WRECK, landerMeshes, createWreck, blast, stepWreck, settleWreck, wreckOcc, pieceMatrix } from '../src/game/lander.js'; import { surfaceParts } from '../src/game/surfaceScene.js';
const W = generateWorld('APOLLO-4471'), M = landerMeshes(), L = W.lander;
// Piece k's triangles in lander space, intact; the hatch (piece 2) opened by `open` rad about its hinge.
const tris = (k, open = 0) => { const m = M[k], c = Math.cos(-open), s = Math.sin(-open), at = PIECES[k].at, out = [];
  const P = i => { const x = m.pos[i * 3], y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2]; return k === 2 ? [x * c + z * s + at[0], y + at[1], -x * s + z * c + at[2]] : [x + at[0], y + at[1], z + at[2]]; };
  for (let i = 0; i < m.idx.length; i += 3) out.push([P(m.idx[i]), P(m.idx[i + 1]), P(m.idx[i + 2])]); return out; };
const snap = Wk => JSON.stringify(Wk.pieces.map(p => [p.x, p.y, p.z, p.yaw, p.pitch, p.roll, p.still]));
test('eleven pre-cut pieces: the descent stage stays, ten fly; together they are the look test\'s lander (opening)', () => {
  assert.deepEqual(PIECES.map(p => p.id), ['descent', 'cabin', 'hatch', 'dish', 'ladder', 'foil0', 'foil1', 'foil2', 'foil3', 'foil4', 'foil5']);
  assert.deepEqual(PIECES.map(p => p.fly ? 1 : 0), [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]); assert.equal(M.length, 11);
  for (let k = 0; k < 11; k++) { assert.ok(M[k].idx.length >= 12, PIECES[k].id); for (const t of tris(k)) for (const [x, y, z] of t) assert.ok(Math.abs(x) <= 3.9 && Math.abs(z) <= 3.9 && y >= -.15 && y <= 5.1, PIECES[k].id); } });
test('from the crouched eye you see out of both triangular windows; the hatch opening is blocked until the door swings open (opening)', () => {
  const eye = [0, 3.55, .2], all = open => [...tris(1), ...tris(2, open), ...tris(3), ...tris(4)];
  for (const sx of [-1, 1]) { const c = [sx * .32, 3.5, 1.299], b = [2 * c[0] - eye[0], 2 * c[1] - eye[1], 2 * c[2] - eye[2]]; assert.ok(!segmentHits(all(0), eye, b), `window ${sx}`); }
  const a = [0, 2.86, .5], b = [0, 2.86, 2.2]; assert.ok(segmentHits(all(0), a, b), 'closed hatch'); assert.ok(!segmentHits(all(1.9), a, b), 'open hatch'); });
test('the cabin\'s inner shell is never sunlit: bit 32, honoured by the world shader (opening)', () => { let n = 0; for (let i = 3; i < M[1].mat.length; i += 4) if (M[1].mat[i] & FLAG.shade) n++;
  assert.equal(FLAG.shade, 32); assert.ok(n > 30); assert.match(readFileSync('src/gfx/shaders/world.frag', 'utf8'), /f\s*&\s*32/); });
test('wreckOcc lowers only the cabin column to the deck; elsewhere it is the generated occlusion (opening)', () => { const o = wreckOcc(W), N = W.N, H = W.half; let low = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i, d = Math.hypot(i - H - L.x, j - H - L.z);
    if (d < LANDER_OCC.cabin[0]) { assert.equal(o[k], Math.fround(L.y + LANDER_OCC.deck[1])); low++; } else assert.equal(o[k], W.occ[k]); } // pre-flight F17: the shared constants
  assert.ok(low >= 4); assert.notEqual(o, W.occ); });
test('the break-up is seeded and fixed-step: at uneven frame rates it rests exactly where settleWreck says (opening)', () => {
  const A = settleWreck(W), B = createWreck(W), r = makeRng('dt'); blast(B, makeRng(W.seed + '/wreck')); let t = 0;
  while (t < WRECK.settle + 5) { const dt = r.range(1 / 144, 1 / 18); stepWreck(B, dt); t += dt; } assert.equal(snap(B), snap(A)); assert.equal(snap(settleWreck(W)), snap(A)); });
test('every flying piece comes to rest on the ground within WRECK.settle s, and the descent stage never moves (opening)', () => {
  for (const seed of ['APOLLO-4471', 'EAGLE-0001', 'SOAK-0042']) { const w = seed === W.seed ? W : generateWorld(seed), A = settleWreck(w), I = createWreck(w);
    A.pieces.forEach((p, k) => { assert.ok(p.still, `${seed} ${PIECES[k].id}`); if (!PIECES[k].fly) assert.deepEqual([p.x, p.y, p.z, p.yaw], [I.pieces[k].x, I.pieces[k].y, I.pieces[k].z, I.pieces[k].yaw]);
      else assert.ok(Math.abs(p.y - (sampleBilinear(w.h, p.x, p.z) + PIECES[k].rest)) < 1e-6, `${seed} ${PIECES[k].id} rests on the ground`); }); } });
test('the cabin spins off into the sky, over 20 m up and landing over 20 m away; 3 s after the blast at least 6 pieces are still flying (opening)', () => {
  const B = createWreck(W); blast(B, makeRng(W.seed + '/wreck')); const c = B.pieces[1]; let top = 0;
  for (let t = 0; t < 3; t += 1 / 60) { stepWreck(B, 1 / 60); top = Math.max(top, c.y - L.y); } assert.ok(B.pieces.filter(p => !p.still).length >= 6);
  for (let t = 0; t < WRECK.settle; t += 1 / 60) { stepWreck(B, 1 / 60); top = Math.max(top, c.y - L.y); } assert.ok(top > 20, `${top}`); assert.ok(Math.hypot(c.x - L.x, c.z - L.z) > 20); });
test('the static props no longer carry the lander (opening)', () => { const p = surfaceParts(W).meshes[2]; for (let i = 0; i < p.mat.length; i += 4) assert.notEqual(p.mat[i], LAYER.foil); });
test('the ascent stage rises by W.up: the cabin, hatch and dish only (Plan 6)', () => { const A = createWreck(W, { x: 0, y: 0, z: 0 }, 0), o = new Array(16); A.up = 5; // pre-flight F2: a Float32Array would compare a float32 with a double
  PIECES.forEach((_, k) => assert.equal(pieceMatrix(A, k, o)[13], A.pieces[k].y + (k >= 1 && k <= 3 ? 5 : 0), `${k}`)); });
