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
// M4: props with no collision stand where nobody can be. The lift's pipes stand in the room's concave corners; a body that fits
// anywhere in the lift (all four box corners clear, as player.fits checks) keeps its radius clear of every pipe face.
import { PLAYER, fits, createPlayer, stepPlayer } from '../src/game/player.js'; import { makeLevel, GRAVITY } from '../src/game/areas.js';
const WM = generateWorld('APOLLO-4471'), LB = makeLevel(WM, 'base');
const segD = (px, pz, ax, az, bx, bz) => { const ex = bx - ax, ez = bz - az, l = ex * ex + ez * ez, t = l ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l)) : 0; return Math.hypot(px - ax - ex * t, pz - az - ez * t); };
test('the lift pipes stand flush in the lift room corners, so nobody standing in the lift overlaps one (M4)', () => {
  const r = M.rooms[0], x0 = r.x0 - .5 - M.half, x1 = r.x1 - .5 - M.half, z0 = r.z0 - .5 - M.half, z1 = r.z1 - .5 - M.half, segs = [];
  // the pipe faces in the lift reaching below 2.4 m (lamp drops hang higher), as horizontal segments
  for (let i = 0; i < props.idx.length; i += 3) { const v = [0, 1, 2].map(k => props.idx[i + k] * 3), P = v.map(a => [props.pos[a], props.pos[a + 1], props.pos[a + 2]]);
    if (props.mat[props.idx[i] * 4] !== LAYER.pipes || Math.min(...P.map(p => p[1])) > 2.4) continue;
    if (P.some(p => p[0] < x0 - .2 || p[0] > x1 + .2 || p[2] < z0 - .2 || p[2] > z1 + .2)) continue;
    for (let k = 0; k < 3; k++) segs.push([P[k][0], P[k][2], P[(k + 1) % 3][0], P[(k + 1) % 3][2]]); }
  assert.ok(segs.length >= 3 * 12, 'pipes in the lift');
  for (const s of segs) for (const [ax, az] of [[s[0], s[1]], [s[2], s[3]]]) assert.ok(Math.min(Math.hypot(ax - x0, az - z0), Math.hypot(ax - x0, az - z1), Math.hypot(ax - x1, az - z0), Math.hypot(ax - x1, az - z1)) < .15, `pipe at ${ax}, ${az} is not in a corner`);
  for (let x = x0; x <= x1; x += .05) for (let z = z0; z <= z1; z += .05) { if (!fits({ y: 0 }, x, z, LB.ground, LB.ceil)) continue;
    for (const s of segs) assert.ok(segD(x, z, ...s) >= PLAYER.radius - 1e-9, `a body at ${x.toFixed(2)}, ${z.toFixed(2)} overlaps a pipe`); } });
test('greenhouse beds are too tall to jump onto at any frame rate, and their stalks grow only over the bed (M4)', () => {
  // every stalk and eye vertex in the greenhouse stands 2 cm or more inside a bed (SOAK-0944's stalks used to lean past the edge)
  for (const B of [M, generateWorld('SOAK-0944').baseMap]) { const gh = B.rooms.find(q => q.theme === 'greenhouse'), P = B === M ? props : buildBaseMeshes(B).props;
    const onBed = (x, z) => { const t = Math.round(z + B.half) * B.n + Math.round(x + B.half); return B.room[t] === gh.id && B.kind[t] === K.prop; };
    for (let i = 0; i < P.pos.length; i += 3) { const x = P.pos[i], z = P.pos[i + 2], m = P.mat[i / 3 * 4];
      if ((m === LAYER.flesh || m === LAYER.eye) && B.room[Math.round(z + B.half) * B.n + Math.round(x + B.half)] === gh.id) assert.ok(onBed(x - .02, z - .02) && onBed(x + .02, z + .02), `${B.seed}: stalk vertex at ${x}, ${z} is at a bed edge`); } }
  const beds = M.props.filter(p => p.kind === 'bed');
  // run and jump at the bed's long side from the floor tile beside its middle
  for (const b of beds) for (const dt of [1 / 20, 1 / 60, 1 / 144]) { const hw = b.w / 2, hd = b.d / 2, along = hw >= hd, sx = along ? 0 : 1, sz = along ? 1 : 0;
    const p = createPlayer({ x: b.x - sx * (hw + .6), z: b.z - sz * (hd + .6), dx: sx, dz: sz }, LB.ground); let top = 0;
    for (let t = 0; t < 2; t += dt) { stepPlayer(p, { fwd: 1, strafe: 0, run: true, jump: true }, dt, LB.ground, LB.bound, GRAVITY.base, LB.ceil); top = Math.max(top, LB.ground(p.x, p.z)); }
    assert.ok(top < .5, `${Math.round(1 / dt)} fps: stood on the bed at ${b.x}, ${b.z}`); } });
test('greenhouse stalk eyes glow dimly, not as bright as plasma; aliens keep their bright eyes (I4)', async () => {
  const gh = M.rooms.find(q => q.theme === 'greenhouse'), { buildModels } = await import('../src/game/models.js'); let n = 0;
  assert.ok(MAT.stalkEye && MAT.stalkEye[0] === LAYER.eye && MAT.stalkEye[2] <= MAT.eye[2] / 4, 'a dim eye material');
  for (let i = 0; i < props.mat.length; i += 4) { const v = i / 4, x = props.pos[v * 3], z = props.pos[v * 3 + 2];
    if (props.mat[i] === LAYER.eye && M.room[Math.round(z + M.half) * M.n + Math.round(x + M.half)] === gh.id) { n++; assert.equal(props.mat[i + 2], Math.fround(MAT.stalkEye[2]), `eye at ${x}, ${z}`); } }
  assert.ok(n > 0, 'greenhouse eyes');
  const eyes = Object.values(buildModels()).flatMap(m => { const o = []; for (let i = 0; i < m.mat.length; i += 4) if (m.mat[i] === LAYER.eye) o.push(m.mat[i + 2]); return o; });
  assert.ok(eyes.length && eyes.includes(Math.fround(MAT.eye[2])), 'aliens keep MAT.eye'); });

test('greenhouse stalk eyes stay at least 4 cm clear of every lamp fixture, on the six seeds where they poked in (carry-over)', () => {
  for (const seed of ['SOAK-0023', 'SOAK-0074', 'SOAK-0083', 'SOAK-0099', 'SOAK-0120', 'SOAK-0136']) {
    const B = generateWorld(seed).baseMap, m = buildBaseMeshes(B).props, L = B.lights.filter(l => !l.kind); let g = 9;
    for (let i = 0; i < m.pos.length; i += 3) { const k = i / 3 * 4; if (m.mat[k] !== MAT.stalkEye[0] || m.mat[k + 2] !== Math.fround(MAT.stalkEye[2])) continue;
      for (const l of L) g = Math.min(g, Math.hypot(Math.max(0, Math.abs(m.pos[i] - l.x) - .16), Math.max(0, Math.abs(m.pos[i + 1] - l.y) - .1), Math.max(0, Math.abs(m.pos[i + 2] - l.z) - .16))); }
    assert.ok(g >= .04, `${seed}: ${g}`); } });
