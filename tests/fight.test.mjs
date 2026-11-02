import test from 'node:test'; import assert from 'node:assert/strict';
import { sampleGround } from '../src/gen/surface.js'; import { generateWorld } from '../src/gen/world.js'; import { PLAYER } from '../src/game/player.js'; import { give } from '../src/game/weapons.js';
import { createFight, stepFight, hurtPlayer, PICKUP, CANISTER, DEATH_TIME } from '../src/game/fight.js'; import { ALIENS } from '../src/game/aliens.js';
const W = generateWorld('APOLLO-4471'), idle = { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 };
const run = (F, inp, secs, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) stepFight(F, typeof inp === 'function' ? inp(t) : inp, dt); };
const put = (F, x, z) => { Object.assign(F.player, { x, z, y: F.lv.ground(x, z), vx: 0, vy: 0, vz: 0, kx: 0, kz: 0 }); };
const face = (F, x, y, z) => { const p = F.player, dx = x - p.x, dz = z - p.z; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(y - (p.y + PLAYER.eye), Math.hypot(dx, dz)); };
const grab = F => { put(F, F.flag.x + 1, F.flag.z); stepFight(F, { ...idle, use: true }, 1 / 60); };
const shootAt = (F, o, dmg = 999) => F.bolts.push({ x: o.x, y: o.y + 6, z: o.z, vx: 0, vy: -30, vz: 0, dmg, r: .2, life: 1, col: [1, 1, 1], team: 0, src: 0 });
const near = (a, b, d) => Math.hypot(a.x - b.x, a.z - b.z) < d;
test('the flag is grabbed with E only when you are next to it', () => { const F = createFight(W);
  put(F, F.flag.x + 5, F.flag.z); stepFight(F, { ...idle, use: true }, 1 / 60); assert.equal(F.flag.held, false);
  grab(F); assert.equal(F.flag.held, true); assert.equal(F.ars.cur, 0); assert.equal(F.entry.flagHeld, true); assert.ok(F.events.some(e => e.type === 'flag')); });
test('flag-pole hits kill the first skitterer, which drops the pistol', () => { const F = createFight(W); grab(F); const a = F.aliens.find(x => x.enc.first);
  put(F, a.x + 1.6, a.z); run(F, () => { if (a.state === 'dead') return idle; face(F, a.x, a.y + .5, a.z); return { ...idle, fire: true, fwd: Math.hypot(a.x - F.player.x, a.z - F.player.z) > 1.2 ? 1 : 0 }; }, 8);
  assert.equal(a.state, 'dead'); assert.equal(F.kills, 1); const drop = F.pickups.find(p => p.kind === 'pistol'); // may already be picked up where it fell
  if (drop) { assert.ok(near(drop, a, 1.5)); put(F, drop.x, drop.z); stepFight(F, idle, 1 / 60); } assert.equal(F.ars.owned[1], true); assert.equal(F.ars.cur, 1); assert.equal(F.ars.cells, PICKUP.pistol); });
test('alien bolts hurt you', () => { const F = createFight(W), e = F.encs[2]; put(F, e.x, e.z); run(F, idle, 8); assert.ok(F.hp < 100); assert.ok(F.events.some(x => x.type === 'hurt')); });
test('dying mid-chaos restarts you at the wreck with a clean, fresh area (Review Focus 1)', () => { const F = createFight(W), S = W.spawn; grab(F);
  give(F.ars, 1, 50); F.aliens[0].hp = 1; put(F, S.x + 40, S.z); F.hp = 1; hurtPlayer(F, 5, 0, 0, 0); assert.equal(F.state, 'dead');
  F.bolts.push({ x: S.x, y: 5, z: S.z + 3, vx: 0, vy: 0, vz: -2, dmg: 50, r: .3, life: 9, col: [1, 1, 1], team: 1, src: 99 }); F.canisters[0].fuse = 0.1; F.canisters[0].hp = 0;
  run(F, idle, DEATH_TIME + .1); assert.equal(F.state, 'play'); assert.ok(near(F.player, S, .5)); assert.equal(F.hp, 100);
  assert.deepEqual([F.bolts.length, F.parts.length, F.decals.length], [0, 0, 0]); assert.equal(F.aliens.length, W.plan.encounters.reduce((s, e) => s + e.aliens.length, 0));
  assert.ok(F.aliens.every(a => a.hp === ALIENS[a.type].hp)); assert.equal(F.canisters.length, W.plan.canisters.length); assert.ok(F.canisters.every(c => !(c.fuse > 0)));
  assert.deepEqual(F.ars.owned, [true, false, false]); assert.equal(F.ars.cells, 0); run(F, idle, 1); assert.equal(F.hp, 100); });
test('a death mid-jump falls and slides to rest instead of freezing in the air (M4)', () => { const F = createFight(W), p = F.player, S = W.spawn;
  put(F, S.x + 30, S.z); const x0 = p.x, g0 = p.y; Object.assign(p, { y: g0 + 1, vy: 1, vx: 3, onGround: false }); /* lands about 1.2 s later */ F.hp = 1; hurtPlayer(F, 5, 0, 0, 0); assert.equal(F.state, 'dead');
  run(F, idle, 1.8); const a = { x: p.x, y: p.y, z: p.z }; assert.ok(p.onGround && Math.abs(p.y - sampleGround(W, p.x, p.z)) < 1e-6); assert.ok(Math.abs(p.x - x0) > .5);
  run(F, idle, .4); assert.equal(F.state, 'dead'); assert.deepEqual([p.x, p.y, p.z], [a.x, a.y, a.z]); });
test('shooting one canister sets off its cluster and hurts what stands nearby', () => { const F = createFight(W), c = F.canisters[0], a = F.aliens.at(-1);
  const mates = F.canisters.filter(d => Math.hypot(d.x - c.x, d.z - c.z) <= 4.5); Object.assign(a, { x: c.x + 2, z: c.z, y: sampleGround(W, c.x + 2, c.z) });
  shootAt(F, c, 20); run(F, idle, 1.5); for (const m of mates) assert.ok(!F.canisters.includes(m)); assert.ok(F.events.filter(e => e.type === 'boom').length >= mates.length);
  assert.ok(F.decals.filter(d => d.kind === 'scorch').length >= mates.length); assert.ok(a.hp < ALIENS[a.type].hp); });
test('kills splash goo that arcs down and sticks', () => { const F = createFight(W), a = F.aliens[0]; shootAt(F, a); run(F, idle, .2);
  assert.ok(F.parts.some(p => p.kind === 'goo')); run(F, idle, 6); assert.equal(F.parts.filter(p => p.kind === 'goo').length, 0); assert.ok(F.decals.some(d => d.kind === 'goo')); });
test('scorch and goo keep separate decal rings of 40 and 24; every 3rd landed goo particle sticks (M5)', () => { const F = createFight(W), S = W.spawn, g = sampleGround(W, S.x, S.z);
  const goo = n => { for (let i = 0; i < n; i++) F.parts.push({ x: S.x - 3 + i * .05, y: g + .5, z: S.z - 3, vx: 0, vy: 0, vz: 0, kind: 'goo', life: 9 }); run(F, idle, 1.5); };
  const count = k => F.decals.filter(d => d.kind === k).length;
  goo(30); assert.equal(count('goo'), 10);
  for (let i = 0; i < 50; i++) F.bolts.push({ x: S.x + 5 + (i % 10), y: g + 4, z: S.z + 5 + (i / 10 | 0), vx: 0, vy: -30, vz: 0, dmg: 1, r: .1, life: 1, col: [1, 1, 1], team: 1, src: 99 });
  run(F, idle, .5); assert.equal(count('scorch'), 40); assert.equal(count('goo'), 10);
  goo(120); assert.equal(count('goo'), 24); assert.equal(count('scorch'), 40); assert.equal(F.decals.length, 64); });
test('brutes drop the scattergun; floaters drop cells', () => { const F = createFight(W), br = F.aliens.find(a => a.type === 'br'), fl = F.aliens.find(a => a.type === 'fl');
  shootAt(F, br); shootAt(F, fl); run(F, idle, 3); assert.ok(F.pickups.some(p => p.kind === 'scatter' && near(p, br, 1.5))); assert.ok(F.pickups.some(p => p.kind === 'cells' && near(p, fl, 2.5))); });
test('duct tape heals only when you are hurt', () => { const F = createFight(W), t = F.pickups.find(p => p.kind === 'tape');
  put(F, t.x, t.z); stepFight(F, idle, 1 / 60); assert.ok(F.pickups.includes(t)); F.hp = 50; stepFight(F, idle, 1 / 60); assert.ok(!F.pickups.includes(t)); assert.equal(F.hp, 50 + PICKUP.tape); });
test('walking into a brute that stands still stops you at the radius sum at 20, 60 and 144 fps (R16)', () => { for (const dt of [1 / 20, 1 / 60, 1 / 144]) {
  const F = createFight(W), b = F.aliens.find(a => a.type === 'br'), R = ALIENS.br.radius + PLAYER.radius, x = b.x, z = b.z;
  F.aliens.length = 0; F.aliens.push(b); F.canisters.length = 0; b.state = 'recover'; b.st = -99; // alone, and recovering for 100 s
  const flat = k => { for (let s = 0; s <= 4; s += .25) if (Math.abs(sampleGround(W, x + s * Math.sin(k), z + s * Math.cos(k)) - b.y) > .3) return false; return true; };
  const k = [0, 1, 2, 3, 4, 5, 6, 7].map(i => i * Math.PI / 4).find(flat); assert.ok(k !== undefined);
  put(F, x + 4 * Math.sin(k), z + 4 * Math.cos(k)); face(F, x, F.player.y + PLAYER.eye, z); run(F, { ...idle, fwd: 1 }, 2, dt);
  const d = Math.hypot(F.player.x - x, F.player.z - z); assert.ok(Math.abs(d - R) <= .05, `dt ${dt}: ${d}`); assert.equal(b.state, 'recover'); assert.deepEqual([b.x, b.z], [x, z]); } });
test('you are pushed out of canisters, and corpses do not block (R16)', () => { const F = createFight(W), c = F.canisters[0], a = F.aliens[0];
  put(F, c.x + .3, c.z); stepFight(F, idle, 1 / 60); assert.ok(Math.hypot(F.player.x - c.x, F.player.z - c.z) >= CANISTER.radius + PLAYER.radius - 1e-9);
  assert.deepEqual([c.x, c.z], [W.plan.canisters[0].x, W.plan.canisters[0].z]); a.state = 'dead'; a._died = F.time; put(F, a.x + .2, a.z); stepFight(F, idle, 1 / 60); assert.ok(Math.hypot(F.player.x - a.x, F.player.z - a.z) < .3); });
test('a fight replays identically from the same inputs', () => { const play = () => { const F = createFight(W); grab(F); give(F.ars, 1, 100); const e = F.encs[1];
  run(F, t => { face(F, e.x, F.player.y + 1.5, e.z); return { ...idle, fwd: 1, fire: Math.floor(t * 4) % 2 === 0 }; }, 20);
  return JSON.stringify([F.player.x, F.player.z, F.hp, F.kills, F.shots, F.bolts.length, F.aliens.map(a => [a.hp, a.x, a.z])]); };
  assert.equal(play(), play()); });
test('twenty seconds of every encounter awake steps quickly', () => { const F = createFight(W); for (const e of F.encs) e.alerted = e.waved = true;
  const t = performance.now(); run(F, idle, 20); assert.ok(performance.now() - t < 1500, `${performance.now() - t} ms`); });
import { lineOfSight } from '../src/game/nav.js'; import { K } from '../src/gen/base.js'; import { worldSpheres } from '../src/game/rigs.js';
// M3: indoors a canister blast reaches only what it can see. Spots on walkable floor near a base canister, well inside its 5 m blast:
// behind a wall (no sight line at any height from the blast centre; 2-4.7 m off, as a wall is 2 tiles thick) or in the open (2-3.5 m).
const blastSpots = (F, c) => { const B = W.baseMap, o = [c.x, c.y + .4, c.z], L = F.lv, hid = [], seen = [];
  for (let t = 0; t < B.n * B.n; t++) { if (B.kind[t] !== K.floor) continue; const x = t % B.n - B.half, z = (t / B.n | 0) - B.half, y = B.floor[t], d = Math.hypot(x - c.x, z - c.z);
    if (d < 2 || d > 4.7) continue; const vis = [.3, .9, 1.5].map(h => lineOfSight(L.ground, o, [x, y + h, z], L.ceil));
    if (vis.every(v => !v)) hid.push({ x, y, z, d }); else if (vis.every(v => v) && d <= 3.5) seen.push({ x, y, z, d }); }
  return { hid: hid.sort((a, b) => a.d - b.d), seen: seen.sort((a, b) => a.d - b.d) }; };
test('indoors a canister blast stops at walls: nothing behind one is hurt, knocked or set off; what it sees still is (M3)', () => {
  const setup = () => { const F = createFight(W, 2), c = F.canisters.find(q => blastSpots(F, q).hid.length && blastSpots(F, q).seen.length); assert.ok(c, 'a canister with a wall near it');
    F.canisters.length = 0; F.canisters.push(c); const a = F.aliens[0]; F.aliens.length = 0; F.aliens.push(a); a.state = 'recover'; a.st = -99; return { F, c, a, ...blastSpots(F, c) }; };
  const boom = F => { F.canisters[0].hp = 0; run(F, idle, .3); assert.ok(F.events.some(e => e.type === 'boom')); };
  { const { F, a, hid, seen } = setup(), h = hid[0], s = seen[0]; put(F, h.x, h.z); Object.assign(a, { x: s.x, y: s.y, z: s.z });
    const hp = ALIENS[a.type].hp; boom(F); assert.equal(F.hp, 100, 'the player behind the wall'); assert.deepEqual([F.player.kx, F.player.kz], [0, 0]); assert.ok(a.hp < hp, 'the alien in sight'); }
  { const { F, a, hid, seen } = setup(), h = hid[0], s = seen[0], o = { x: h.x, y: h.y, z: h.z, hp: CANISTER.hp, fuse: 0, id: -99, area: 2 };
    put(F, s.x, s.z); Object.assign(a, { x: h.x, y: h.y, z: h.z }); F.canisters.push(o); const hp = ALIENS[a.type].hp;
    assert.ok([.3, .9, 1.5].every(k => !lineOfSight(F.lv.ground, [F.canisters[0].x, F.canisters[0].y + .4, F.canisters[0].z], [worldSpheres(a)[0][0], h.y + k, worldSpheres(a)[0][2]], F.lv.ceil)));
    boom(F); assert.ok(F.hp < 100, 'the player in sight'); assert.equal(a.hp, hp, 'the alien behind the wall'); assert.ok(F.canisters.includes(o) && o.hp === CANISTER.hp && !(o.fuse > 0), 'the canister behind the wall'); } });
