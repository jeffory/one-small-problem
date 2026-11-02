import test from 'node:test'; import assert from 'node:assert/strict'; import { fakeGL } from './fakegl.mjs';
import { uploadMesh, disposeMesh } from '../src/gfx/gl.js'; import { createMesh, box, finishMesh } from '../src/gfx/mesh.js'; import { MAT } from '../src/gfx/materials.js';
import { generateWorld } from '../src/gen/world.js'; import { buildSurfaceScene } from '../src/game/surfaceScene.js';
test('disposeMesh frees everything uploadMesh made', () => { const gl = fakeGL(), M = createMesh(); box(M, 0, 0, 0, 1, 1, 1, MAT.hull);
  const g = uploadMesh(gl, finishMesh(M)); assert.equal(gl.live.size, 5); disposeMesh(gl, g); assert.equal(gl.live.size, 0); });
test('the surface scene owns its frame fields and frees all it made', () => { const gl = fakeGL(), s = buildSurfaceScene(gl, generateWorld('APOLLO-4471'));
  assert.equal(s.sky, true); assert.equal(s.mode, 0); assert.equal(s.gravity, 3.0); assert.equal(s.fog.length, 3); assert.ok(s.fogDensity > 0);
  assert.ok(gl.live.size > 0); s.dispose(); assert.equal(gl.live.size, 0); });
import { buildBaseScene } from '../src/game/baseScene.js'; import { GRAVITY } from '../src/game/areas.js'; import { createFight } from '../src/game/fight.js';
const WW = generateWorld('APOLLO-4471');
test('the base scene: no sky, banded mode, murky fog, gravity 9 from the shared table, its lamps, two meshes, and it frees all it made', () => { const gl = fakeGL(), s = buildBaseScene(gl, WW.baseMap);
  assert.deepEqual([s.id, s.sky, s.mode, s.occTex, s.gravity, GRAVITY.base], ['base', false, 1, null, 9.0, 9.0]); assert.equal(s.lamps, WW.baseMap.lights); assert.equal(s.meshes.length, 2);
  const [r, g, b] = s.fog; assert.ok(g >= r && r > b && Math.max(r, g, b) < .03); assert.equal(createFight(WW, 2).gravity, s.gravity); s.dispose(); assert.equal(gl.live.size, 0); });
test('the surface scene names itself and lights the hangar door, then the switchback', () => { const gl = fakeGL(), s = buildSurfaceScene(gl, WW), d = WW.crater.door;
  assert.equal(s.id, 'surface'); assert.equal(s.gravity, GRAVITY.surface); assert.ok(Math.hypot(s.lamps[0].x - d.x, s.lamps[0].z - d.z) < 2);
  assert.deepEqual(s.lamps.slice(1), guideLights(WW)); s.dispose(); });
// R17: render-only guide lamps down the crater's switchback, in the surface scene's lamp list (so the 16-light selection, hysteresis
// and fade-in apply), over emissive beacon posts in the static mesh, which glow at any range, past the 30 m light selection.
import { guideLights, surfaceParts, GUIDE } from '../src/game/surfaceScene.js'; import { LIGHT } from '../src/gen/baseplan.js';
import { polylineLength, sampleBilinear } from '../src/gen/surface.js'; import { CRATER } from '../src/gen/crater.js';
test('guide lamps down the switchback: one by every vertex, about every 15 m, never more than 8, dim pools of radius about 6 (R17)', () => {
  for (const seed of ['APOLLO-4471', 'EAGLE-0001', 'SOAK-0042']) { const w = seed === 'APOLLO-4471' ? WW : generateWorld(seed), P = w.crater.path, G = guideLights(w);
    assert.ok(G.length >= P.length && G.length <= GUIDE.max && GUIDE.max === 8, `${seed}: ${G.length} guides`);
    for (const q of P) assert.ok(G.some(l => Math.hypot(l.x - q[0], l.z - q[1]) <= CRATER.half + 1), `${seed}: no guide by vertex ${q}`);
    for (const l of G) { assert.deepEqual([l.r, l.kind], [6, 0]); assert.ok([LIGHT.amber.col, LIGHT.teal.col].includes(l.col));
      const g = sampleBilinear(w.h, l.x, l.z); assert.ok(l.y > g + 1 && l.y < g + 3, 'stands on the ground'); }
    // along the path, guides sit about 15 m apart; with the cap of 8, no more than 20 m
    const L = polylineLength(P); assert.ok(L / (G.length - 1) <= 20 && (G.length === GUIDE.max || L / (G.length - 1) <= 15), `${seed}: ${G.length} over ${L.toFixed(0)} m`); } });
test('every guide lamp has a glowing beacon post in the surface scene static props mesh (R17)', () => { const { meshes: [, , props], lamps } = surfaceParts(WW), G = guideLights(WW);
  assert.deepEqual(lamps.slice(1), G);
  for (const l of G) { let glow = 0, stalk = 0;
    for (let i = 0; i < props.pos.length; i += 3) { const d = Math.hypot(props.pos[i] - l.x, props.pos[i + 2] - l.z), e = props.mat[i / 3 * 4 + 2];
      if (d < .4 && Math.abs(props.pos[i + 1] - l.y) < .4 && e > 0) glow++; if (d < .2 && props.pos[i + 1] < l.y - .5 && e === 0) stalk++; }
    assert.ok(glow > 8 && stalk > 4, `post at ${l.x}, ${l.z}: ${glow} glowing, ${stalk} stalk vertices`); } });
