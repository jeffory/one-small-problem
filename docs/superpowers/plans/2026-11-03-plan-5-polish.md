# One Small Problem, Plan 5: Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six changes the user asked for after the first play-test: aliens drop duct tape (the first kill always, later kills by chance), tape you can see, a red edge vignette in place of the hurt tint, a voice per radio speaker, a wayfinding arrow outdoors, and a flag pole that hits skitterers at your feet.

**Architecture:** Each change stays in the module that owns it: drops in `killed()` (`fight.js`), the swing in `meleeTargets` (`weapons.js`), tape looks in `models.js`, `bake.frag` and `fightView.js`, the vignette in `fightView.js` and `post.frag`, voices in `speech.js`, and the arrow's maths in `areas.js` with its DOM in `hud.js` and `shell.html`, wired in `main.js`. There are no new modules. Every rule is a pure function or table Node can test; the DOM and the GL get two smoke tests.

**Tech Stack:** as in Plan 4 (Node 22 `node:test`, `build.mjs`, Playwright on Chromium and Firefox, WebGL2, Web Speech).

**Spec:** `docs/superpowers/specs/2026-11-03-plan-5-polish-design.md`, an addendum to `docs/superpowers/specs/2026-11-02-one-small-problem-design.md` (its §3, §6.4 and §6.10 still bind). Earlier rulings: `docs/superpowers/decisions.md`.

**Builds on:** `main` at 591e038; `dist/index.html` is 66,941 B.

**Probes:** every test below, in its exact text, was run against a scratch prototype of all six tasks at 591e038.
- The unit suite passed (345 tests; the pre-flight amendments add one, the crater-arrow test, so 346). Only two existing tests broke, and this plan replaces both: weapons "melee reaches targets in front and in range only" and view "the screen flashes red when hurt, then fades; the tint is a bounded mix (R17)". The bot and replay tests stayed green with the extra rng draws.
- The build was 68,063 B. The two new smoke tests, plus the M7, pause and palette ones, passed in Chromium and Firefox. A paused hit at 85 hp raised the edge redness from 0.019 to 0.095 and left the centre's unchanged.
- Tape drop rates over 1,000 kills per kind on APOLLO-4471: skitterers 0.117, floaters 0.208, brutes 1.
- `crater.top` is 401–414 m from the spawn on three seeds, 3 m outside the rim radius; `crater.use` is 42–44 m beyond it.

**Not in this plan:** any generation change, retuning anything the spec doesn't name, and Plan 6's arrow targets and countdown.

## Global Constraints

- **Output:** one self-contained `.html` file of at most **131,072 bytes** on disk; `npm run build` fails over the cap. Expect about 68 KB. Above 75 KB, record why in the Task 7 commit.
- **Runs from** `https://` and `file://` with no network requests. WebGL2 only.
- **Code:** plain JavaScript, no runtime dependencies. Every file under `src/`, `tools/` and `build.mjs` is 7-bit ASCII: `\u` escapes in JS strings, CSS escapes (`\2227`) in `src/shell.html`.
- **Generation is untouched.** `src/gen/**` and `tests/golden.test.mjs` do not change, and the goldens stay APOLLO-4471 `60273c6a`, EAGLE-0001 `39762eb2` and SOAK-0042 `ee4eda57`. The `src/gen` determinism rules (only `+ - * /`, bit ops and `Math.imul/sqrt/floor/ceil/round/trunc/min/max/abs`) stay enforced by `tests/noise.test.mjs`.
- **The simulation is pure:** `src/game/{weapons,bolts,nav,rigs,aliens,fight,models,areas,baseMesh,bot,hold,lander,opening,script,radio}.js` and `src/ui/{settings,score}.js` never touch `document.`, `window.`, `gl.`, `performance.now`, `Date.now` or `Math.random` (`tests/purity.test.mjs`). Fight randomness comes only from `F.rng`. The arrow's maths goes in `areas.js`, already on that list.
- **Coordinates:** metres, y up. The player faces −z at yaw 0; forward is `(−sin yaw, −cos yaw)`, right is `(cos yaw, −sin yaw)`. An alien with yaw `a` faces `(sin a, 0, cos a)`.
- **Render budget:** `fillFrame` allocates no `Float32Array` once warm; the caps (16 lights, 8 spheres, 512 sprites) are unchanged; `frame.tint` stays the reused `V._tint`.
- **Tables:** new tuning lives in tables: `PICKUP.tapeDrop`, `PICKUP.tapeOff`, `WEAPONS[0].band`, `TAPE_R`, `TAPE_GLINT`, `VIG`, `WAY`. Each table's starting value is pinned once, in the test that names it, so a hands-on retune changes that table and its one pin together; every other test reads the table (pre-flight F1).
- **No blind tuning:** every number here is a starting value for the user's hands-on check (Task 7).
- **UI look (parent §2):** HUD text `#b8ae9c`, dim `#7a7266`, alert `#b8301a`; no saturated colours or gradients; every HUD overlay has `pointer-events:none`.
- **Names read from outside the bundle** are never `_`-prefixed: DOM ids `way`, `wa`, `wd`, GLSL uniforms, `ospTest` and `capture()` fields. No new `ospTest` hooks; `renderer.capture()` gains two fields (Task 4).
- **Earlier rulings hold:** tape you can't use stays on the ground (R11, Plan 2); a failing voice leaves its line to the subtitle (Plan 4 R15); nothing after Houston picks up scores (Plan 4 R9); alien-bolt kills don't score (Plan 4 R25) (pre-flight F11).

## Review Focus

1. **A tape drop beside a wall or on a steep slope** (a brute dying against a base wall, or an alien-bolt kill with you on the far side). The tape must never sit inside a wall or off a ledge. Pinned in Task 2.
2. **A yaw wound far past ±π** (`look()` never wraps it). The arrow must still point the right way, with an angle in (−π, π]. Pinned in Task 6.
3. **Low health that isn't really you:** the attract bot (god mode, hp held at 1 or more), the opening's view (no hp at all) and a fight won at low hp (pre-flight F6) must never show the pulsing rim behind the title, the opening or the end screen. Pinned in Task 4.
4. **Odd voice lists:** entries with no `name` or `lang`, Android's `en_US`, duplicate names, a throwing `getVoices()`, or only non-English voices (which still speak, as today). Casting never throws. Pinned in Task 5.
5. **A skitterer below you on the crater wall.** The band starts 0.3 m below your feet; one 1.5 m ahead and about 1 m down the slope, where the switchback fights happen, must still be hit by a level swing. Pinned in Task 1.

---

### Task 1: The flag pole hits spiders

**Files:**
- Modify: `src/game/weapons.js` (`WEAPONS[0]`, `meleeTargets`)
- Modify: `src/game/fight.js` (`fire`)
- Test: `tests/weapons.test.mjs`, `tests/fight.test.mjs`

**Interfaces:**
- **`WEAPONS[0]`** becomes `{ id: 'flag', name: 'FLAG POLE', melee: true, dmg: 25, range: 2.6, cosArc: .65, band: [-.3, 2.2], cool: .65, knock: 7, cells: 0 }`. `band` is the swing's height band in metres above the player's feet: 0.3 m below the feet to 0.5 m above the eye. **[call]** It is stored as numbers because `weapons.js` doesn't import `player.js`; a test pins `band[1] === PLAYER.eye + .5`.
- **`meleeTargets(x, y, z, yaw, targets, W) => targets[]`** replaces `meleeTargets(eye, f, targets, range, cosArc)`. `(x, y, z)` are the player's feet and `W` is the weapon row; targets are `{x, y, z, r}` spheres. A target is hit, in input order, when all three hold:
  - its horizontal distance `h` from `(x, z)` has `h − t.r ≤ W.range`;
  - `[t.y − t.r, t.y + t.r]` overlaps `[y + W.band[0], y + W.band[1]]`;
  - `h < 1e-6`, or the horizontal unit direction to it dotted with `(−sin yaw, −cos yaw)` is at least `W.cosArc`. Pitch plays no part.
- **`fire()` in `fight.js`** calls `meleeTargets(p.x, p.y, p.z, p.yaw, T, W)`, with `T` built as today (each live alien's first world sphere, each canister at `y + CAN_Y`). Damage, cooldown and knock-back are unchanged; knock-back still uses the camera's `f`.

- [ ] **Step 1: Write the failing tests**

In `tests/weapons.test.mjs`, import `PLAYER` from `../src/game/player.js`, then replace the test "melee reaches targets in front and in range only" with:

```js
test('the pole judges its swing side to side: 2.6 m past the radius, cosArc .65, feet -.3 to eye +.5; pitch plays no part (Plan 5)', () => {
  const W = WEAPONS[0], d2r = Math.PI / 180, at = (deg, d, y = .55, r = .4) => ({ x: d * Math.sin(deg * d2r), y, z: -d * Math.cos(deg * d2r), r });
  assert.deepEqual([W.range, W.cosArc, W.band[0], W.band[1], W.dmg, W.cool, W.knock], [2.6, .65, -.3, PLAYER.eye + .5, 25, .65, 7]);
  const hit = [at(0, 1.2), at(40, 1.2), at(-45, 1.2), at(0, 2.95), at(0, 1.5, -.6), at(0, 1.5, 2.5), at(0, 0)];
  const miss = [at(180, 1.2), at(90, 1.2), at(55, 1.2), at(0, 3.05), at(0, 1.5, -.8), at(0, 1.5, 2.7)];
  assert.deepEqual(meleeTargets(0, 0, 0, 0, [...hit, ...miss], W), hit);
  const left = { x: -1.2, y: .55, z: 0, r: .4 }; assert.deepEqual(meleeTargets(0, 0, 0, Math.PI / 2, [left], W), [left]);
  const up = { x: 5, y: 10.55, z: -1.2, r: .4 }; assert.deepEqual(meleeTargets(5, 10, 0, 0, [up], W), [up]); });
```

In `tests/fight.test.mjs`:
- add `createAlien` to the `aliens.js` import
- add `WEAPONS` to the `weapons.js` import
- add `stub` and `swing` (below; Task 2's wall test uses `stub` too):

```js
// A fight on stub ground G (`stub`, shared with Task 2) with the player at the origin, level (pitch 0), facing -z, holding the pole, and skitterers at spots
// [x, z] facing the player; one swing, then each skitterer's hp.
const stub = (G, x = 0) => { const F = createFight(W); F.lv.ground = F._ctx.ground = G; F.aliens.length = F.canisters.length = 0;
  Object.assign(F.player, { x, y: 0, z: 0, vx: 0, vy: 0, vz: 0, kx: 0, kz: 0 }); return F; }; // (pre-flight F10)
const swing = (G, spots) => { const F = stub(G), p = F.player; Object.assign(p, { yaw: 0, pitch: 0, onGround: true }); give(F.ars, 0, 0);
  const sk = spots.map(([x, z], i) => { const a = createAlien({ type: 'sk', x, y: G(x, z), z }, 900 + i, F.encs[0]); a.yaw = Math.atan2(-x, -z); a.area = 0; F.aliens.push(a); return a; });
  stepFight(F, { ...idle, fire: true }, 1 / 60); return sk.map(a => a.hp); };
test('a level pole swing hits a skitterer at your feet 1.2 m ahead and one 40 deg aside, not one behind (Plan 5)', () => {
  const r = 40 * Math.PI / 180, hurt = ALIENS.sk.hp - WEAPONS[0].dmg;
  assert.deepEqual(swing(() => 0, [[0, -1.2], [1.2 * Math.sin(r), -1.2 * Math.cos(r)], [0, 1.2]]), [hurt, hurt, ALIENS.sk.hp]); });
test('a skitterer 1.5 m ahead and 1 m down a slope is hit by a level swing (Review Focus 5)', () => {
  assert.deepEqual(swing((x, z) => (z < 0 ? .7 * z : 0), [[0, -1.5]]), [ALIENS.sk.hp - WEAPONS[0].dmg]); });
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/weapons.test.mjs tests/fight.test.mjs`

Expected: FAIL. `W.band` is undefined; the fight tests get `[30, 30, 30]` and `[30]`, because today's cone misses a skitterer at your feet.

- [ ] **Step 3: Implement**

Change `WEAPONS[0]` and `meleeTargets` as in Interfaces, and update the call in `fire()`.

- [ ] **Step 4: Run the tests**

Run: `npm test`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/weapons.js src/game/fight.js tests/weapons.test.mjs tests/fight.test.mjs
git commit -m "fight: the flag pole judges its swing side to side over a height band (cosArc .65, reach 2.6) so it hits skitterers at your feet"
```

---

### Task 2: Health drops

**Files:**
- Modify: `src/game/fight.js` (`PICKUP`, `killed`)
- Test: `tests/fight.test.mjs`

**Interfaces:**
- **`PICKUP`** gains `tapeDrop: { sk: .1, fl: .2, br: 1 }` and `tapeOff: .7`.
- **`killed(F, a)`:** after today's drop (unchanged), it may push one `{ kind: 'tape', x, y, z, n: PICKUP.tape, area: a.area }`. With `scored = !F.won && !a._foe` (today's kill-count test, Plan 4 R9 and R25, now named):
  - **First kill:** if `scored` and `F.kills` has just become 1, tape drops with no roll. `F.kills` is lifetime (R10), so this happens once a run, in whichever area.
  - **Otherwise by chance,** for every kill, scored or not: with `c = PICKUP.tapeDrop[a.type]`, tape drops if `c >= 1` or `F.rng.next() < c`. **[call]** The rng is drawn only when `0 < c < 1` and it isn't the first kill, after the pistol roll.
- **Where it lies:** alone, at `(a.x, gy, a.z)` like other drops. **[call]** Beside another drop, `PICKUP.tapeOff` m from `(a.x, a.z)` horizontally toward the player (along +x if the player is within 1e-6), at `F.lv.ground` there; but if that ground differs from `gy` by more than `WALL` (0.35, already in `fight.js`) in either direction (`Math.abs`, unlike the one-sided `buried()`), at `(a.x, gy, a.z)`, so it never lands in a wall or off a ledge (pre-flight F2).
- Tape you can't use stays where it lies (R11; `collect` is unchanged).

- [ ] **Step 1: Write the failing tests**

In `tests/fight.test.mjs`, add `hurtAlien` to the `aliens.js` import, then add:

```js
const kill = (F, a, foe) => { hurtAlien(a, 999, 0, 0); if (foe) a._foe = 1; stepFight(F, idle, 1 / 60); };
test('the first scoring kill drops tape .7 m from its other drop toward you; a later kill only by chance (Plan 5)', () => {
  const F = createFight(W); F.pickups.length = 0; F.rng.next = () => .999; // no chance roll succeeds
  const a = F.aliens.find(x => x.enc.first), b = F.aliens.find(x => x.type === 'sk' && !x.enc.first);
  kill(F, a); assert.equal(F.kills, 1); const gun = F.pickups.find(p => p.kind === 'pistol'), tape = F.pickups.find(p => p.kind === 'tape');
  assert.ok(gun && tape); assert.equal(tape.n, PICKUP.tape); assert.equal(tape.area, a.area);
  const p = F.player, dx = tape.x - gun.x, dz = tape.z - gun.z, d = Math.hypot(dx, dz), toward = (dx * (p.x - gun.x) + dz * (p.z - gun.z)) / d / Math.hypot(p.x - gun.x, p.z - gun.z);
  assert.ok(Math.abs(d - PICKUP.tapeOff) < 1e-9 && toward > .999, `${d} ${toward}`);
  const n = F.pickups.length; kill(F, b); assert.equal(F.kills, 2); assert.equal(F.pickups.length, n); });
test('an alien-bolt kill (Plan 4 R25) or a kill after Houston (Plan 4 R9) is not the first kill; the next scoring kill is (Plan 5)', () => {
  for (const how of ['foe', 'won']) { const F = createFight(W); F.pickups.length = 0; F.rng.next = () => .999; const [a, b] = F.aliens.filter(x => x.type === 'sk' && !x.enc.first);
    if (how === 'won') F.won = true; kill(F, a, how === 'foe'); assert.equal(F.kills, 0); assert.ok(!F.pickups.some(p => p.kind === 'tape'), how);
    F.won = false; kill(F, b); assert.equal(F.kills, 1); assert.equal(F.pickups.filter(p => p.kind === 'tape').length, 1, how); } });
test('after the first kill tape drops by chance from the sim rng: skitterers 10%, floaters 20%, brutes always (Plan 5)', () => {
  const F = createFight(W), S = W.spawn, x = S.x + 30, z = S.z, enc = { x, z, p: 0, first: false, area: 0, room: -1, alerted: false, waved: false };
  F.aliens.length = 0; F.kills = 1; assert.deepEqual(PICKUP.tapeDrop, { sk: .1, fl: .2, br: 1 });
  for (const [type, i0] of [['sk', 5000], ['fl', 7000], ['br', 9000]]) { F.pickups.length = 0;
    for (let i = 0; i < 1000; i++) { const a = createAlien({ type, x, y: sampleGround(W, x, z), z }, i0 + i, enc); a.area = 0; F.aliens.push(a); kill(F, a); }
    const rate = F.pickups.filter(p => p.kind === 'tape').length / 1000; assert.ok(Math.abs(rate - PICKUP.tapeDrop[type]) < .04, `${type} ${rate}`); } });
test('a dropped tape never lands in a wall or off a ledge: where .7 m toward you the ground is more than WALL higher or lower it lies at the alien (Review Focus 1, pre-flight F2)', () => {
  for (const [px, h, want] of [[5, 0, .7], [5, 9, 0], [5, -9, 0], [-5, 9, -.7]]) {
    const G = (x, z) => (x > .3 ? h : 0), F = stub(G, px); F.pickups.length = 0; F.kills = 1;
    const a = createAlien({ type: 'br', x: 0, y: 0, z: 0 }, 900, F.encs[0]); a.area = 0; F.aliens.push(a); kill(F, a);
    const t = F.pickups.find(p => p.kind === 'tape'); assert.ok(Math.abs(t.x - want) < 1e-9 && t.z === 0 && t.y === 0, `${px} ${h}: ${t.x}`); } });
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/fight.test.mjs`

Expected: FAIL. No tape drops, and `PICKUP.tapeDrop` is undefined.

- [ ] **Step 3: Implement**

Change `PICKUP` and `killed()` as in Interfaces. Update the `PICKUP` comment to say tape drops come from the sim rng, so the goldens are untouched.

- [ ] **Step 4: Run the tests**

Run: `npm test && npm run test:bot`

Expected: all pass with the goldens unchanged, and the bot soak passes. If an existing test pinned an rng-dependent value after a kill, re-derive it and say so in the commit message (the prototype found none).

- [ ] **Step 5: Commit**

```bash
git add src/game/fight.js tests/fight.test.mjs
git commit -m "fight: the first scoring kill drops duct tape; later kills drop it by chance (sk 10%, fl 20%, br always) from the sim rng"
```

---

### Task 3: Tape you can see

**[call]** The spec's "no floating, no spinning" is read literally. Today every pickup floats (guns 0.45 m up, the rest 0.3 m), bobs and spins (pre-flight F13); from now on tape alone lies still on its edge on the ground, like a dropped roll, while guns and cells keep their bob and spin.

**Files:**
- Modify: `src/game/models.js` (tape model, new `TAPE_R`)
- Modify: `src/gfx/shaders/bake.frag` (layer 11)
- Modify: `src/game/fightView.js` (pickup loop, glints, new `TAPE_GLINT`)
- Test: `tests/models.test.mjs`, `tests/view.test.mjs`, `tests/glsl.test.mjs`

**Interfaces:**
- **`models.js`:** `export const TAPE_R = .144`. The tape is today's lathe at 1.6×, still along x: x −.048 to .048, profile `[[0, .112], [.06, TAPE_R], [.94, TAPE_R], [1, .112]]`, 14 segments, `MAT.tape`.
- **`bake.frag` layer 11 [call]:** a brighter, slightly cool silver with the same weave: `a=vec4(vec3(.34,.35,.37)+.12*wv,wv);}` (was `.16+.08*wv`), commented "tape: silver cloth tape, fine diagonal weave".
- **`fightView.js` [call]:**
  - A tape pickup is drawn with `trs(mat(), q.x, q.y + TAPE_R - .01, q.z, 2.4 * (q.x + q.z), 1)`: sunk 1 cm for grit, at a fixed yaw, with no bob, spin or halo.
  - `export const TAPE_GLINT = { period: 2.5, on: .15, size: .1 }`. A tape near the camera adds one glow sprite at `(q.x, q.y + 2 * TAPE_R - .03, q.z)`, size `TAPE_GLINT.size`, in the golf glint's colour `(.5, .5, .45)`, while `mod(t + 1.3 * (q.x + q.z), period) < on`. `mod` is the non-negative remainder, since coordinates can be negative, so each roll glints on its own beat.

- [ ] **Step 1: Write the failing tests**

In `tests/models.test.mjs`, import `TAPE_R` from `models.js`, then add:

```js
test('the tape roll is 1.6x its old size: radius TAPE_R .144 and .096 wide, in the tape material (Plan 5)', () => { const P = M.tape.pos; let r = 0, w = 0;
  for (let i = 0; i < P.length; i += 3) { w = Math.max(w, Math.abs(P[i])); r = Math.max(r, Math.hypot(P[i + 1], P[i + 2])); }
  assert.equal(TAPE_R, .144); assert.ok(Math.abs(r - TAPE_R) < 1e-6 && Math.abs(w - .048) < 1e-6, `${r} ${w}`); assert.equal(M.tape.mat[0], MAT.tape[0]); });
```

In `tests/view.test.mjs`, import `TAPE_R` from `../src/game/models.js` and `TAPE_GLINT` from `fightView.js`, then add:

```js
test('tape lies still on its edge on the ground and glints for .15 s in every 2.5 s (Plan 5)', () => { const F = createFight(W), fr = frame(), q = F.pickups.find(p => p.kind === 'tape');
  put(F, q.x + 4, q.z); const at = t => { fillFrame(V, F, fr, t); return fr.meshes.find(m => m.gpu === V.gpu.tape && Math.hypot(m.model[12] - q.x, m.model[14] - q.z) < 1e-3); };
  const a = [...at(0).model], b = [...at(1.3).model]; assert.deepEqual(a, b); assert.ok(Math.abs(a[13] - (q.y + TAPE_R - .01)) < 1e-5);
  let on = 0; for (let t = 0; t < TAPE_GLINT.period; t += .05) { fillFrame(V, F, fr, t); const D = fr.sprites.data;
    for (let i = fr.sprites.nOpaque; i < fr.sprites.nOpaque + fr.sprites.nGlow; i++) if (Math.hypot(D[i * 8] - q.x, D[i * 8 + 1] - (q.y + 2 * TAPE_R - .03), D[i * 8 + 2] - q.z) < 1e-3) { on++; break; } }
  const want = TAPE_GLINT.on / .05; assert.ok(on >= Math.floor(want) && on <= Math.ceil(want) + 1, `${on}`); }); // derived from the table (pre-flight F1)
```

In `tests/glsl.test.mjs`, add:

```js
test('the tape layer is a brighter silver (Plan 5)', () => {
  assert.match(readFileSync('src/gfx/shaders/bake.frag', 'utf8'), /uLay==11\)\{[^}]*a=vec4\(vec3\(\.34,\.35,\.37\)\+\.12\*wv,wv\)/); });
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/models.test.mjs tests/view.test.mjs tests/glsl.test.mjs`

Expected: FAIL. `models.test.mjs` and `view.test.mjs` don't load (no export `TAPE_R` / `TAPE_GLINT`), and the bake line doesn't match (pre-flight F4).

- [ ] **Step 3: Implement**

Make the three changes as in Interfaces.

- [ ] **Step 4: Run the tests**

Run: `npm test`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/models.js src/gfx/shaders/bake.frag src/game/fightView.js tests/models.test.mjs tests/view.test.mjs tests/glsl.test.mjs
git commit -m "look: duct tape is a 1.6x brighter silver roll lying still on its edge, with the golf balls' glint on its own beat"
```

---

### Task 4: The red hurt vignette

This replaces the full-frame hurt tint, and with it the old view test of Plan 2 R17. Plan 2 R17's "capped mix after tone mapping" survives as a 0.85 cap.

**Files:**
- Modify: `src/game/fightView.js` (new `VIG` and `vignette`; step 7 of `fillFrame`)
- Modify: `src/gfx/shaders/post.frag`
- Modify: `src/gfx/renderer.js` (`capture()`; the `tint` line of the header comment)
- Test: `tests/view.test.mjs`, `tests/glsl.test.mjs`, `tests/smoke.spec.mjs`

**Interfaces:**
- **`frame.tint` (`uK`)** becomes `[k, w, reach]`: the vignette strength, the opening's white flash (unchanged), and how far in from the edges the red grows (0..1).
- **`fightView.js`:** `export const VIG = { hit: .6, low: .22, pulse: .35, hz: 1, reach: .4, dead: .8, deadReach: .8 }` **[call]**, and `export function vignette(F, t, K)`, which writes `K[0]` and `K[2]`, leaves `K[1]` and returns `K`:
  - dead: `K[0] = VIG.dead`, `K[2] = VIG.deadReach`;
  - otherwise: `K[0] = max(VIG.hit * F.hurtT, low)`, `K[2] = VIG.reach`, where `low = VIG.low * (1 + VIG.pulse * sin(2π · VIG.hz · t))` when `F.hp < RADIO.low` (30, from `radio.js`), `!F.god` and `!F.won`, else 0 (pre-flight F6). **[call]** God mode (the attract bot) never shows the rim, nor does the opening's view, which has no `hp`, nor does a won fight (`hurtPlayer` is a no-op after Houston, so the rim would pulse on through the ending and the end screen).
  - `F.hurtT` already flares by the hit (`+dmg/20`, capped at 1) and decays at 2/s, so the flare fades in about half a second.
  - `fillFrame` step 7 becomes `vignette(F, t, K); K[1] = F.flash || 0;`.
- **`post.frag`:** the vignette replaces the `min(.18, uK.x)` tint, after tone mapping and gamma and before the flash and the palette. `main` starts:

  ```glsl
  void main(){ivec2 ip=ivec2(gl_FragCoord.xy);vec3 c=pow(1.-exp(-texelFetch(uS,ip,0).rgb*uX),vec3(1./2.2));
   vec2 q=gl_FragCoord.xy/vec2(textureSize(uS,0))*2.-1.;float v=clamp((length(q)-1.+uK.z)/max(uK.z,.001),0.,1.);
   c=mix(c,vec3(.45,.04,.02),min(.85,uK.x)*v*v);
   c=mix(c,vec3(.94,.91,.86),min(.85,uK.y));
  ```

  The middle stays clear inside `length(q) < 1 − reach`, mid-edges and corners reach full strength, and dead (reach .8) leaves only the middle fifth. Update the header comment to match.
- **`renderer.js` `capture()`** also returns `edge` and `mid`, the mean redness `max(0, r − (g + b) / 2) / 255` over the pixels within `w / 8` of the left or right side or `h / 8` of the top or bottom (`edge`), and over the centre box `|x + .5 − w / 2| < w / 8 && |y + .5 − h / 2| < h / 8` (`mid`).

- [ ] **Step 1: Write the failing tests**

In `tests/view.test.mjs`, import `VIG` from `fightView.js`, then replace the test "the screen flashes red when hurt, then fades; the tint is a bounded mix (R17)" with:

```js
test('the vignette: a hit flares it by hurtT, low health pulses a rim at 1 Hz, death is heavy; never for god mode, a won fight or the opening (Plan 5, Review Focus 3)', () => {
  const F = createFight(W), fr = frame(), near = (a, b) => Math.abs(a - b) < 1e-9;
  fillFrame(V, F, fr, 0); assert.deepEqual([...fr.tint], [0, 0, VIG.reach]);
  hurtPlayer(F, 10, 0, 0, 0); fillFrame(V, F, fr, 0); assert.ok(near(fr.tint[0], VIG.hit * .5)); assert.equal(fr.tint[2], VIG.reach);
  for (let i = 0; i < 30; i++) stepFight(F, idle, 1 / 60); fillFrame(V, F, fr, 1); assert.equal(fr.tint[0], 0);
  F.hp = 20; for (const [t, k] of [[0, 1], [.25, 1 + VIG.pulse], [.75, 1 - VIG.pulse]]) { fillFrame(V, F, fr, t); assert.ok(near(fr.tint[0], VIG.low * k), `${t}`); }
  hurtPlayer(F, 10, 0, 0, 0); fillFrame(V, F, fr, .75); assert.ok(near(fr.tint[0], Math.max(VIG.hit * F.hurtT, VIG.low * (1 - VIG.pulse))));
  F.god = true; F.hurtT = 0; fillFrame(V, F, fr, .25); assert.equal(fr.tint[0], 0); F.god = false;
  F.won = true; F.hurtT = 0; fillFrame(V, F, fr, .25); assert.equal(fr.tint[0], 0); F.won = false; // a won fight below 30 hp shows no rim (pre-flight F6)
  hurtPlayer(F, 99, 0, 0, 0); fillFrame(V, F, fr, 0); assert.deepEqual([...fr.tint], [VIG.dead, 0, VIG.deadReach]);
  const O = createOpening(W, createFight(W)); stepOpening(O, idle, 1 / 60); fillFrame(V, O.view, fr, .25); assert.equal(fr.tint[0], 0); });
```

In `tests/glsl.test.mjs`, add:

```js
test('the post pass draws an edge vignette toward blood red by uK.x (capped at .85) over reach uK.z, before the flash and the palette (Plan 5)', () => {
  const s = readFileSync('src/gfx/shaders/post.frag', 'utf8'), v = s.search(/c=mix\(c,vec3\(\.45,\.04,\.02\),min\(\.85,uK\.x\)\*v\*v\)/);
  assert.ok(v > 0 && s.includes('length(q)-1.+uK.z') && v < s.indexOf('vec3(.94,.91,.86)') && v < s.indexOf('if(uP>0)')); assert.doesNotMatch(s, /min\(\.18/); });
```

At the end of `tests/smoke.spec.mjs`, add the test below. It pauses so that only the vignette changes between the two captures. `hurt(15)` leaves 85 hp, which is not low health.

```js
test('a hit reddens the edges of the frame and leaves its centre (Plan 5)', async ({ page }) => {
  const errors = watchErrors(page), frames = () => page.evaluate(() => window.ospTest.frames()), cap = () => page.evaluate(() => window.ospTest.capture());
  await start(page); await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(true);
  let f = await frames(); await expect.poll(frames).toBeGreaterThan(f + 1); const a = await cap();
  await page.evaluate(() => window.ospTest.hurt(15)); f = await frames(); await expect.poll(frames).toBeGreaterThan(f + 1); const b = await cap();
  expect(b.edge - a.edge).toBeGreaterThan(.02); expect(Math.abs(b.mid - a.mid)).toBeLessThan(.01); expect(errors).toEqual([]); });
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/view.test.mjs tests/glsl.test.mjs`

Expected: FAIL. `view.test.mjs` doesn't load (no export `VIG`), and the post pass still has `min(.18` (pre-flight F4).

- [ ] **Step 3: Implement**

Make the `fightView.js`, `post.frag` and `renderer.js` changes as in Interfaces, and update the step-7 comment and the file header in `fightView.js`, which still describe the damage tint (pre-flight F5).

- [ ] **Step 4: Run the unit tests, then the smoke tests**

Run: `npm test`, then `npm run test:smoke -- -g "reddens|palette-true"`

Expected: all pass, in Chromium and Firefox. The palette tests still see `inPalette` 1, which also shows the post shader compiled.

- [ ] **Step 5: Commit**

```bash
git add src/game/fightView.js src/gfx/shaders/post.frag src/gfx/renderer.js tests/view.test.mjs tests/glsl.test.mjs tests/smoke.spec.mjs
git commit -m "look: a red edge vignette replaces the hurt tint: it flares on a hit, pulses a rim below 30 hp and closes in on death"
```

---

### Task 5: A voice per speaker

**Files:**
- Modify: `src/audio/speech.js`
- Test: `tests/speech.test.mjs`

**Interfaces:**
- **`export function castVoices(all) => { H, Y, S }`** is pure; each field is a voice from `all` or `null`, and it never throws on odd entries.
  1. **The list:** the English voices (`/^en/i` on `lang || ''`), or every voice if there are none (today's fallback), copied and sorted local (`localService`) first, then by `name`. **[call]** Names compare by plain `<` and `>`, not `localeCompare`, so every locale gets the same order.
  2. **The pool:** the list's local voices if there are any, else the whole list. **[call]** A local voice always wins Houston's slot and the pool; Chrome's online voices on Linux are the ones that misbehave (Plan 4 R15). With exactly one local English voice, rule 5's fallback may still give You a remote one (pre-flight F9).
  3. **The accent:** `acc(v) = String(v.lang || '').replace('_', '-').toLowerCase()`.
  4. **Houston:** `H` is the pool's first voice with accent `'en-us'`, else the list's first, else `null`.
  5. **You:** `Y` is the pool's first voice that isn't `H` and has a different accent, else the list's first that isn't `H`, else `H`.
  6. **The Switchboard:** `S` is the list's first voice that is neither `H` nor `Y`, else `H`.
- **`createSpeech(win)`** keeps a `cast` (`castVoices([])` at first) and recasts at start and on every `voiceschanged`; a throwing `getVoices` gives the empty cast. `ok` is `!!cast.H`. `say` uses `cast[line.who] || cast.H` for `u.voice` and `u.lang`. **[call]** `VOICE`'s pitch and rate are still always applied, so with one voice they tell the speakers apart. A line already speaking keeps its voice, and every other path is unchanged (Plan 4 R15).

- [ ] **Step 1: Write the failing tests**

In `tests/speech.test.mjs`, add `castVoices` to the `speech.js` import, then add:

```js
const v = (name, lang, local = true) => ({ name, lang, localService: local });
test('castVoices with 0, 1, 2 and 3 voices: Houston en-US, You another accent, the Switchboard a third or Houston\'s; input order never matters (Plan 5)', () => {
  assert.deepEqual(castVoices([]), { H: null, Y: null, S: null });
  const a = v('Alpha', 'en-GB'); assert.deepEqual(castVoices([a]), { H: a, Y: a, S: a });
  const us = v('Zed', 'en_US'), gb = v('Beth', 'en-GB'); assert.deepEqual(castVoices([gb, us]), { H: us, Y: gb, S: us });
  const L = [v('Zed', 'en-US'), v('Amy', 'en-US'), v('Kate', 'en-GB'), v('Hans', 'de-DE'), v('Online', 'en-US', false)];
  const c = castVoices(L); assert.deepEqual([c.H.name, c.Y.name, c.S.name], ['Amy', 'Kate', 'Zed']);
  assert.deepEqual(castVoices([...L].reverse()), c); });
test('a local voice beats a remote en-US one; non-English voices still speak; odd entries and a throwing getVoices never throw (Plan 5, Review Focus 4)', () => {
  const k = v('Kate', 'en-GB'), o = v('Online US', 'en-US', false); assert.deepEqual(castVoices([o, k]), { H: k, Y: o, S: k });
  const h = v('Hans', 'de-DE'); assert.deepEqual(castVoices([h]), { H: h, Y: h, S: h });
  assert.doesNotThrow(() => castVoices([{}, { name: 'x' }, { lang: 'en' }, v('d', 'en-US'), v('d', 'en-US')]));
  const W = fake(); W.speechSynthesis.getVoices = () => { throw new Error('no'); }; assert.equal(createSpeech(W).ok, false); });
test('each speaker speaks in their own voice at their own pitch and rate; a recast on voiceschanged leaves a line in flight alone: no cancel, no new utterance (Plan 5, pre-flight F3)', () => {
  const L = [v('Amy', 'en-US'), v('Kate', 'en-GB'), v('Zed', 'en-US')], W = fake(L), S = createSpeech(W);
  for (const who of ['H', 'Y', 'S']) S.say({ ...line, who }, () => {});
  assert.deepEqual(W.said.map(u => [u.voice.name, u.lang, u.pitch, u.rate]), [['Amy', 'en-US', ...VOICE.H], ['Kate', 'en-GB', ...VOICE.Y], ['Zed', 'en-US', ...VOICE.S]]);
  const u = W.said[2], c = W.cancels, n = W.said.length; W.speechSynthesis.getVoices = () => [v('Bob', 'en-US')]; W.on.voiceschanged();
  assert.equal(u.voice.name, 'Zed'); assert.deepEqual([W.cancels, W.said.length], [c, n]);
  S.say({ ...line, who: 'Y' }, () => {}); assert.equal(W.said.at(-1).voice.name, 'Bob'); });
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/speech.test.mjs`

Expected: FAIL. `castVoices` is not exported.

- [ ] **Step 3: Implement**

Write `castVoices` and use it in `createSpeech`, as in Interfaces. Update the file's header comment.

- [ ] **Step 4: Run the tests**

Run: `npm test`

Expected: all pass. The existing "an English local voice is preferred" test still picks `en-local`.

- [ ] **Step 5: Commit**

```bash
git add src/audio/speech.js tests/speech.test.mjs
git commit -m "radio: Houston, You and the Switchboard each get their own browser voice where there is more than one"
```

---

### Task 6: The wayfinding arrow

**Files:**
- Modify: `src/game/areas.js` (new `WAY`, `wayTarget`, `wayfind`)
- Modify: `src/ui/hud.js` (new `way`; the `MODES.play` and `fatal` lists)
- Modify: `src/shell.html` (`#way` markup and CSS; `#flash` moves down)
- Modify: `src/main.js` (calls `hud.way` in play)
- Test: `tests/areas.test.mjs`, `tests/smoke.spec.mjs`

**Interfaces:**
- **`areas.js`:**
  - `export const WAY = { near: 12 }`: within `WAY.near` m of the target the arrow hides.
  - `export function wayTarget(world, k, p) => {x, z} | null`, with `p` the player (pre-flight F7). **[call]** Only areas 0 and 1 are outdoors with a goal; the base (2) and the comms room (3) return null. Plan 6 appends its targets here.
    - Area 0 (surface): `world.crater.top`, unchanged. (`crater.path[0]` is the top, the head of the switchback.)
    - Area 1 (crater): the arrow follows the switchback instead of pointing straight down the wall at the door (a dive that costs hp, Plan 3 R18). The target is the `world.crater.path` vertex (`[x, z]`, returned as `{x, z}`) after the one nearest `p` by plain horizontal distance, or `world.crater.use` once the nearest vertex is the last one.
  - `export function wayfind(F) => null | { ang, m }` is null unless `F.state === 'play'` and the area has a target (`wayTarget(F.world, F.area, F.player)`), and null if the horizontal distance `d` to it is under `WAY.near`. `m = Math.round(d)`. `ang` is the target's bearing from where you face, positive to the right, in (−π, π] for any yaw; with `(dx, dz)` from player to target:

      ```js
      ang = Math.atan2(dx * Math.cos(yaw) - dz * Math.sin(yaw), -dx * Math.sin(yaw) - dz * Math.cos(yaw))
      ```

- **`src/shell.html` [call]:** markup `<div id="way"><div id="wa"></div><div id="wd"></div></div>` after `#flash`, and this CSS:

    ```css
    #way{position:fixed;left:50%;top:8px;transform:translateX(-50%);text-align:center;visibility:hidden}
    #way.on{visibility:visible}
    .paused #way.on{visibility:hidden}
    #wa{display:inline-block;font-size:20px;line-height:1}
    #wa::before{content:'\2227'}
    #wd{color:#7a7266}
    ```

  `#flash` moves from `top:12px` to `top:56px`, so pickup flashes sit under the arrow, and `#way` joins the `pointer-events:none` list.
- **`hud.js`:** `way(w)` toggles class `on` on `#way` by `!!w`. When shown, it sets `#wa`'s `transform` to `rotate(<deg>deg)`, with `<deg> = Math.round(w.ang * 180 / Math.PI)` (positive is clockwise), and `#wd`'s text to `` `${w.m} m` ``, each written only when it changes, like `status`. `#way` joins `MODES.play`, so the modes `none` and `opening` hide it, and the elements `fatal` hides.
- **`main.js`:** in `advance`'s playing branch, after `hud.status(...)`, call `hud.way(state === 'play' ? wayfind(F) : null)`. So the arrow hides in the opening, title and end screen (modes), while paused (`.paused`), in the ending, and when dead, indoors or within 12 m (`wayfind`).

- [ ] **Step 1: Write the failing tests**

In `tests/areas.test.mjs`:
- add `WAY, wayfind, wayTarget` to the `areas.js` import
- add `enterArea` to the `fight.js` import
- add (two tests for the arrow's target and angle, then one for hiding):

```js
test('the arrow points at the rim (crater.top) on the surface, in whole metres, positive to the right, for any wound yaw (Plan 5, Review Focus 2)', () => {
  const F = createFight(W), T = W.crater.top, S = W.spawn, at = (x, z, yaw) => Object.assign(F.player, { x, z, yaw });
  assert.equal(wayTarget(W, 0, S), T); assert.equal(wayTarget(W, 2, S), null); assert.equal(wayTarget(W, 3, S), null);
  const y0 = Math.atan2(-(T.x - S.x), -(T.z - S.z)); at(S.x, S.z, y0); const w = wayfind(F);
  assert.equal(w.m, Math.round(Math.hypot(T.x - S.x, T.z - S.z))); assert.ok(Math.abs(w.ang) < 1e-9);
  for (const [dy, want] of [[Math.PI / 2, Math.PI / 2], [-Math.PI / 2, -Math.PI / 2], [Math.PI, Math.PI], [20 * Math.PI + .3, .3]]) { F.player.yaw = y0 + dy;
    const a = wayfind(F).ang; assert.ok(Math.abs(Math.abs(a) - Math.abs(want)) < 1e-6 && (want === Math.PI || Math.sign(a) === Math.sign(want)), `${dy}: ${a}`); assert.ok(a > -Math.PI - 1e-12 && a <= Math.PI + 1e-12); }
 });
test('in the crater the arrow follows the switchback: the vertex after the nearest one, then the hangar door (crater.use) after the last (Plan 5, pre-flight F7)', () => {
  const F = createFight(W), P = W.crater.path, U = W.crater.use, at = (x, z, yaw = 0) => Object.assign(F.player, { x, z, yaw }), vx = i => ({ x: P[i][0], z: P[i][1] });
  assert.ok(P.length >= 3); for (let i = 0; i < P.length - 1; i++) assert.deepEqual(wayTarget(W, 1, vx(i)), vx(i + 1), `${i}`);
  assert.deepEqual(wayTarget(W, 1, vx(P.length - 1)), U);
  assert.deepEqual(wayTarget(W, 1, { x: P[0][0] + 1, z: P[0][1] }), vx(1)); // near the top: the next vertex, not the door
  assert.deepEqual(wayTarget(W, 1, { x: U.x + 3 * (U.x - P.at(-1)[0]), z: U.z + 3 * (U.z - P.at(-1)[1]) }), U); // past the end: the door
  enterArea(F, 1); at(P[1][0], P[1][1] + 30.4); assert.deepEqual(wayfind(F), { ang: 0, m: 30 }); // nearest is path[0], so it aims at path[1], due -z
  const L = P.at(-1); at(U.x + 3 * (U.x - L[0]), U.z + 3 * (U.z - L[1]), Math.atan2(-(U.x - (U.x + 3 * (U.x - L[0]))), -(U.z - (U.z + 3 * (U.z - L[1]))))); const w = wayfind(F);
  assert.ok(Math.abs(w.ang) < 1e-9 && w.m === Math.round(3 * Math.hypot(U.x - L[0], U.z - L[1]))); });
test('the arrow hides within WAY.near of its target, when dead, and indoors (Plan 5)', () => { const F = createFight(W), T = W.crater.top;
  assert.equal(WAY.near, 12); Object.assign(F.player, { x: T.x + WAY.near + .1, z: T.z }); assert.ok(wayfind(F)); F.player.x = T.x + WAY.near - .1; assert.equal(wayfind(F), null);
  F.player.x = T.x + 50; F.state = 'dead'; assert.equal(wayfind(F), null); for (const k of [2, 3]) assert.equal(wayfind(createFight(W, k)), null); });
```

In `tests/smoke.spec.mjs`:
- add `'way'` to the id list of the test "the HUD overlays let the capture click through to the canvas (M7)"
- at the end, add:

```js
test('the wayfinding arrow shows on the surface in whole metres, and hides while paused and in the base (Plan 5)', async ({ page }) => {
  const errors = watchErrors(page), way = page.locator('#way'); await start(page);
  await expect(way).toBeVisible(); await expect(page.locator('#wd')).toHaveText(/^\d+ m$/);
  await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(true); await expect(way).toBeHidden();
  await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(false); await expect(way).toBeVisible();
  await page.evaluate(() => window.ospTest.enter()); await expect.poll(() => page.evaluate(() => window.ospTest.area())).toBe('base'); await expect(way).toBeHidden();
  expect(errors).toEqual([]); });
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/areas.test.mjs`

Expected: FAIL. `wayfind` is not exported.

- [ ] **Step 3: Implement**

Make the `areas.js`, `hud.js`, `shell.html` and `main.js` changes as in Interfaces.

- [ ] **Step 4: Run the unit tests, then the smoke tests**

Run: `npm test`, then `npm run test:smoke -- -g "wayfinding|capture click|pause"`

Expected: all pass, including `tests/purity.test.mjs` and `tests/ascii.test.mjs`, in Chromium and Firefox.

- [ ] **Step 5: Commit**

```bash
git add src/game/areas.js src/ui/hud.js src/shell.html src/main.js tests/areas.test.mjs tests/smoke.spec.mjs
git commit -m "hud: a wayfinding chevron at the top centre points to the rim, then the hangar door, with the distance in metres"
```

---

### Task 7: The whole game, verified, and the hands-on checklist

**Files:**
- Modify: `docs/superpowers/decisions.md` (hands-on checklist)

- [ ] **Step 1: Run every test**

Run: `npm test && npm run test:seeds && npm run test:bot && npm run test:smoke && npm run build && ls -l dist/index.html`

Expected: every unit test passes with the goldens green; the 1,000-seed and 60-seed bot soaks are clean; every smoke test passes in Chromium and Firefox (about 5–12 minutes); the build succeeds at no more than 131,072 B (expect about 68 KB). `git diff 591e038 -- src/gen tests/golden.test.mjs` is empty. If anything fails, fix the cause in the owning task's code as its own commit; never loosen a test to pass.

- [ ] **Step 2: Add the Plan 5 hands-on items**

In `docs/superpowers/decisions.md`, first change the Plan 2 hands-on lines "Hurt tint strength" and "Tape visibility" to say "superseded by Plan 5 (vignette / tape)" (pre-flight F12). Then, under `## Hands-on checklist`, add this section above `### Plan 4`:

```markdown
### Plan 5
- **Vignette** (`VIG` in `src/game/fightView.js`): is the hit flare strong enough without hiding the fight? Below 30 hp, is the slow pulse noticeable but not tiring? Does the dead vignette read? After Houston the rim is off even at low hp (pre-flight F6); is the win screen calm?
- **Arrow** (`WAY` in `src/game/areas.js`): helpful without being a crutch? It hides within 12 m of the rim and the hangar door. In the crater it follows the switchback vertex by vertex, then the door (pre-flight F7); does it keep you on the path, and does it flip when you cut across? Pickup flashes moved down to 56 px; do they clash? Does the chevron glyph render in your fonts?
- **Voices** (`castVoices` in `src/audio/speech.js`): which voices do Chrome and Firefox pick for Houston, You and the Switchboard, and are they easy to tell apart? On Chrome, are You's lines actually voiced, or lost to an online voice (Plan 4 R15)? (pre-flight F9)
- **Tape** (`TAPE_R`, `TAPE_GLINT`, layer 11 in `bake.frag`): can you spot it from a distance? Does it still read as a roll of tape now it lies still on its edge, while other pickups bob and spin?
- **Flag pole** (`WEAPONS[0]`): fair against skitterers now? Any surprise hits on things beside you? It can no longer reach a surface floater overhead (they hover 3-4.5 m up, above the band's top); fine? (pre-flight F8)
- **Drops** (`PICKUP.tapeDrop`): with the first-kill tape and chance drops, is the game now too easy? Every brute drops tape, final stand included.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/decisions.md
git commit -m "docs: Plan 5 hands-on checklist; Plan 2 tint and tape lines superseded"
```
