# One Small Problem, Plan 6: The Escape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a second level. Houston's reply is cut off by a knock-out; you wake in an alien prison, bang on the bars, kill the guard with the flag pole, fight to the exit lift, climb back to the rim and dash to a rescue lander before its clock runs out. Boarding ends the run: a lift-off seen from the cabin, then the stowaway sting.

**Architecture:**
- **The knock-out:** everything that decides anything stays in the pure sim, so the bot soak and the replay play both levels. Houston → knock-out → wake are phases of `F.ko`, stepped in `stepFight`; `main.js` only reacts to events.
- **The prison:** the base generator run on a second config. `generateBase`, `lightBase`, `planBase` and `buildBaseMeshes` read the config from the map (`B.cfg`); `BASE_PLAN` reproduces today's base bit for bit.
- **The escape plan** (areas 5–6): a route-generic planner factored out of `planFight`. It is joined to the surface level's plan at run time, never to `world.plan`, so level 1 hashes as before.
- **Where level 2's code lives:** tables and pure helpers in a new `src/game/escape.js`, state changes in `fight.js`, the lift-off in `src/game/liftoff.js` (shaped like the opening).

**Tech Stack:** as in Plan 5 (Node 22 `node:test`, `build.mjs`, Playwright on Chromium and Firefox, WebGL2, Web Audio, Web Speech).

**Spec:** `docs/superpowers/specs/2026-11-03-plan-6-escape-design.md` (binding, with its builder-check rulings in §4.1 and §6), an addendum to `2026-11-02-one-small-problem-design.md` (§3 and §6 bind) after `2026-11-03-plan-5-polish-design.md`. Rulings: `docs/superpowers/decisions.md`. The survey `.superpowers/escape-brief.md` is git-ignored; this plan restates what it uses.

**Builds on:** `main` at 11bcf76, where `dist/index.html` is 68,277 B. The goldens are APOLLO-4471 `60273c6a`, EAGLE-0001 `39762eb2` and SOAK-0042 `ee4eda57`.

## Global Constraints

- **Output:** one self-contained `.html`, at most **131,072 B** (`npm run build` fails over it); the Plan 6 ceiling is about **95 KB (97,280 B)**, or say why in Task 13's commit. `https://` and `file://`, no network, WebGL2, plain JS; everything under `src/`, `tools/` and `build.mjs` is 7-bit ASCII (`\u` escapes in strings).
- **Determinism:**
  - `src/gen` uses only `+ - * /`, bit ops and `Math.imul/sqrt/floor/ceil/round/trunc/min/max/abs`: no trig, `**` or `.sort(`.
  - New generation draws **new streams only**: `seed + '/prison'` (`+ '#' + attempt`), `'/prison/lights/'`, `'/prison/fight/'`, `'/prison/mesh'`, and `'/escape/climb/'`, `'/escape/dash/'`, `'/escape/golf/'`, `'/escape/site/'` (each `+ world.attempt`).
  - The level 1 parts must hash as before (Task 6).
- **Purity:** `src/game/escape.js` (T1) and `src/game/liftoff.js` (T9) join `SIM` in `tests/purity.test.mjs`. Fight randomness comes only from `F.rng`.
- **Coordinates:** yaw 0 faces -z (forward `(-sin yaw, -cos yaw)`); lander +z is the front (hatch, ladder). The rescue site stores its +z as a unit `(dx, dz)` (`src/gen` has no `atan2`); the game takes `ly = Math.atan2(dx, dz)`.
- **Areas only increase:**
  - `AREAS = ['surface','crater','base','comms','prison','climb','dash']`
  - `LEVEL = ['surface','surface','base','base','prison','surface','surface']`
  - A *stint* is a run of consecutive areas on one level: 0–1, 2–3, 4, 5–6. `populate(F, from)` takes only `from`'s stint.
- **Ids:** plan aliens from 1 (level 1, then the escape plan), opening 900+, hold 1000+, the rescue ring `RING.id` 2000+. Golf 0–2 surface, 3–4 base, 5 evidence locker, 6 dash.
- **Tables:**
  - Each table is pinned once, in the test that names it, and other tests read it (Plan 5 F1): `KO` (T1), `BREAK` (T5), `EXIT` (T7), `SHIP` `FLARE` `RING` (T8), `LIFT` (T9), `SIGHTS` (T11) and `ESCAPE` (T6, in `src/gen/encounters.js`).
  - Every number is a starting value for the hands-on check. The only retune is `SHIP.clock`, from the bot soak by the spec's rule (T12).
- **UI:** HUD text `#b8ae9c`, dim `#7a7266`, alert `#b8301a`. Overlays are `pointer-events:none`, and names read from outside are never `_`-prefixed.
- **Commits** end with the line `Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7`, passed as a second `-m`.
- **The game stays whole after every task, all tests green.** Until Task 10 the knock-out ends the run with the end screen; level 2 is built and proven through `ospTest` hooks (`prison`, `bang`, `lift`, `climb`, `dash`, `calm`, `turn`, `board`), and Task 10 opens the door.

### Rules that move (spec §3)

The rule each test guards stays; only its freeze point moves.

| Rule | Freeze point after Plan 6 | Tests that move |
|---|---|---|
| Plan 4 R8: a death in Houston's step leaves no Houston | the same, with `F.ko` in place of `F.won` | `hold.test` R8 (T1) |
| Plan 4 R9: time and kills freeze at Houston | `F.run` and scoring stop from Houston to the wake (T1), and for good at boarding, where `wonAt = F.run` (T9) | `hold.test` R9 (T1); `fight.test` kill rule (+`ko`, T1); smoke "comms array … end screen" (T1, T10); boarding tests (T9) |
| Plan 4 R16: no dawdle lines on hold or after Houston | none while knocked out (T1) or in the shut cell (T5) either | `radio.test` dawdling and the dawdle smoke (T1) |
| Plan 4 R18 + R26: the cut at Houston; only Houston after it; the ending gate | the cut stays; while `F.ko`, only Houston and wake lines pass; the end of the cut-off line triggers the knock-out (`KO.call` fallback); the `ENDING` gate moves to the sting | five `radio.test` tests (T1); smoke `throughEnding` → `throughCall` (T1) + `throughLift` (T9) |
| Plan 5 F6: no low-health rim once won | none while `F.ko` or `F.won` | `view.test` vignette (T1) |

## Review Focus

1. **A pause during Houston's call, the black or the wake, or mid cut-off line.** The knock-out happens once, its clock stops while paused, and a paused line replays (Plan 4 R15). Pinned in T1 (`knockOut` only acts in `'call'`) and T10 (smoke).
2. **Dying in the same step the guard dies.** You restart freed: bars open, its pistol and cells in your kit. Pinned in T5.
3. **E at the ladder in the clock's last step.** Boarding wins: E is read before the clock runs. Pinned in T9.
4. **Going back the way you came.** E at the hangar door in area 5 does nothing; back over the rim, area 6 stays area 6 with the arrow on the ship. Pinned in T7.
5. **A slow frame across the knock-out.** `ko`, `stamp`, `wake` and `woke` each fire once, in order. Pinned in T10.

---

### Task 1: Houston's call becomes the knock-out (the `F.won` split)

Until Task 10 the knock-out ends the run.

**Files:**
- Create: `src/game/escape.js`
- Modify: `src/game/{fight,radio,script,bot,fightView}.js`, `src/audio/audio.js`, `src/main.js`
- Test: `tests/{hold,radio,fight,view,purity}.test.mjs`, `tests/smoke.spec.mjs`

**Interfaces:**
- **`escape.js`** (pure): `export const KO` **[call]**, its values pinned in the second hold test below. `call` is the fallback (s) from Houston to the knock-out when no radio triggers it (bot, replay, Node); the rest are used in T10.
- **`F`** gains `run: 0` (the run clock) and `ko: null`. `F.won`/`F.wonAt` now mean boarded (T9).
- **`stepFight`:**
  - starts `F.time += dt; F.shotT += dt; if (!F.ko && !F.won) F.run += dt;`;
  - holds in step 5a only `if (F.hold && !F.ko && F.state === 'play' && F.hp > 0)`;
  - ends with `if (F.ko?.phase === 'call' && (F.ko.t += dt) >= KO.call) knockOut(F);`.
- **Houston:** `stepHold` at `HOLD.time` sets `F.ko = { phase: 'call', t: 0 }` and pushes `{ type: 'houston' }`. It no longer sets `won`/`wonAt`.
- **The split:**
  - `hurtPlayer` is a no-op if `F.state === 'dead' || F.ko || F.won`.
  - `killed`: `scored = !F.ko && !F.won && !a._foe`.
  - `restartArea` clears `F.ko`.
- **`export function knockOut(F) => boolean`:** false unless `F.ko?.phase === 'call'`; otherwise sets `F.ko = { phase: 'out', t: 0 }`, pushes `{ type: 'ko' }` and returns true. T10 extends it.
- **`radio.js`:**
  - `radioEvents` skips `if (F.ko && t !== 'houston' && t !== 'wake' || e.team)`.
  - `'houston'` leaves `PLAIN` and cues `'houston'` then `'rescue'`.
  - `dawdling` also needs `!F.ko`.
  - `export function silence(R)`: empties the queue, nulls `cur` and goes to `'gap'`. It returns `[{ do: 'off' }]` if a line was keyed, talking or keying down, else `[]`.
- **`script.js`:** `CUES.rescue = { seq: 1 }`; `SCRIPT.rescue = ["H|Copy. We heard. Rescue vehicle is go, touchdown at your lander in twenty min\u2014"]` (spec verbatim).
- **`bot.js`:** done `'houston'` on `F.ko || F.won` (T12 reworks this).
- **`vignette`:** the low rim also needs `!F.ko`.
- **`audio.js`:** `info().downs` counts closing tones (`key(false)` with a context).
- **`main.js`:**
  - **States:** `'title' -> 'opening' -> 'play' -> 'end' -> 'title'`. The `'ending'` state goes, so Houston's call is play with `F.ko`, and `pausable` is `'opening' || 'play'`.
  - **The cut-off line:** `radioDo` takes an `unkey` of a `line.key === 'rescue'` line as `hud.sub(''); audio.bed(false)`, with no closing tone, and sets `run.koDue`.
  - **`advance`:**
    - It begins `if (run.koDue) { run.koDue = false; knockOut(F); }`, so the knock-out's events are handled this frame.
    - A `'ko'` event plays `thud`, then `speech.cancel(); radioDo(R, silence(R)); finish();`.
    - `'houston'` keeps the R18/R26 cut but changes no state.
    - The `endingOver` branch goes; `ENDING` and `endingOver` stay in `hold.js` for T9.
  - **`finish()`:** needs `state === 'play'` and reports `F.wonAt ?? F.run`.
  - **`music()`:** in play, `F.ko ? null : F.hold ? 'hold' : MUSIC[F.area]`.
  - **The prompt:** `''` while `F.ko`.
  - **`ospTest.fight()`:** adds `run` and `ko: F.ko?.phase ?? null`.
  - **`clock()`:** `{ opening, hold, ko: F.ko?.t ?? null }`.

- [ ] **Step 1: Write and move the tests**

**`purity`:** add `'escape'` to `SIM`.

**`hold.test.mjs`** (import `knockOut`, `KO`):
- "the waves come out…": `!F.won` → `!F.ko`, and `assert.ok(F.won)` → `assert.ok(F.ko)`.
- `finale()` and its test: `!F.won` → `!F.ko`, and `F.won && t < 800` → `F.ko && t < 800`.
- R8: `[F.state, F.won]` → `[F.state, F.ko]` (expect `['dead', null]`); `[F.state, F.hold, F.won, F.wonAt]` → `[F.state, F.hold, F.ko, F.won]` (expect `['play', null, null, false]`); the last `F.won` check → `F.ko === null`.
- Replace the R9 test with:

```js
test('R9 moved: F.run and kills stop at Houston while F.time runs on', () => {
  const F = atArray(); F.god = true; stepFight(F, { ...idle, use: true }, 1 / 60); F.hold.plan = [0, 1].map(door => ({ at: 0, type: 'sk', door, wave: 0 }));
  stepFight(F, idle, 1 / 30); const [a, b] = F.aliens; hurtAlien(a, 999, 0, 0); stepFight(F, idle, 1 / 30); assert.equal(F.kills, 1);
  F.hold.t = HOLD.time - 1 / 60; stepFight(F, idle, 1 / 30); assert.deepEqual([F.ko.phase, F.won, F.wonAt], ['call', false, null]); const at = F.run, t0 = F.time;
  hurtAlien(b, 999, 0, 0); run(F, idle, 5); assert.equal(F.kills, 1); assert.equal(F.run, at); assert.ok(F.time > t0 + 4.9); });
const houston = () => { const F = atArray(); stepFight(F, { ...idle, use: true }, 1 / 60); F.aliens.length = 0; F.hold.plan.length = 0; F.hold.t = HOLD.time; stepFight(F, idle, 1 / 60); F.events.length = 0; return F; };
test('the knock-out comes KO.call s after Houston or at once by knockOut, only once; nothing hurts meanwhile (Review Focus 1)', () => {
  assert.deepEqual(KO, { call: 30, out: 5, stamp: 1.5, fade: 1, down: 3, getUp: .8, eye: .3, pitch: .6, hp: 70, text: 'ANOTHER SMALL PROBLEM' });
  const F = houston(); hurtPlayer(F, 500, 0, 0, 0); assert.equal(F.hp, 100); let t = 0, n = 0;
  while (F.ko.phase === 'call' && t < KO.call + 1) { stepFight(F, idle, .25); t += .25; n += F.events.filter(e => e.type === 'ko').length; F.events.length = 0; }
  assert.ok(Math.abs(t - KO.call) <= .25 + 1e-9, `${t}`); assert.equal(n, 1); assert.equal(knockOut(F), false);
  const G = houston(); assert.equal(knockOut(G), true); assert.equal(knockOut(G), false); assert.equal(G.events.filter(e => e.type === 'ko').length, 1); });
```

**`fight.test.mjs`**, the R25/R9 kill rule: loop over `['foe', 'won', 'ko']`, add `if (how === 'ko') F.ko = { phase: 'call', t: 0 };`, and reset with `F.won = false; F.ko = null;`.

**`view.test.mjs`**, the vignette test, after its `F.won` line: `F.ko = { phase: 'call', t: 0 }; F.hurtT = 0; fillFrame(V, F, fr, .25); assert.equal(fr.tint[0], 0); F.ko = null;`.

**`radio.test.mjs`** (import `silence`, and `KO` from escape.js):
- The script test's range becomes `>= 150 && <= 205`.
- The dawdle test drops `'ending'` and adds `assert.equal(dawdling('play', { ...F, ko: { phase: 'call' } }), false);`.
- Rename `WON` to `CALL = { ko: { phase: 'call', t: 0 }, won: false, hp: 100, state: 'play' }`; the line-68 test uses the same `ko`.
- Every expected queue holding the Houston pair gets `'rescue'` right after it.
- "…the punchline keys at once…":
  - loop `for (; t < KO.call; t += dt)` and break after the step that unkeys the rescue line (`ko = t`);
  - assert `said(A)` is `[...SCRIPT.houston, ...SCRIPT.rescue]`, the punchline keys before 6 s, and `u.t < ko < KO.call`.
- The R26 long test:
  - pass `{ ko: won ? { phase: 'call' } : null, hp: 10, state: 'play' }`;
  - its stop becomes `else if (won) { endT += dt; if (ko !== null || endT >= KO.call) break; }`, with `ko = endT` at the rescue unkey;
  - assert `punch < ko && ko < KO.call`.
- Keep the `endingOver` unit test.
- Add:

```js
test('silence: the radio dies at once, queue and all, with no closing tone (Plan 6)', () => {
  const R = createRadio(always); radioCue(R, 'houston'); radioCue(R, 'rescue'); run(R, .5); assert.deepEqual(silence(R), [{ do: 'off' }]);
  assert.deepEqual([R.cur, R.q.length], [null, 0]); assert.ok(run(R, 3).every(a => a.do !== 'unkey')); assert.deepEqual(silence(R), []); });
```

**`smoke.spec.mjs`** (import `KO` from escape.js and `HOLD`):
- **"the comms array…":**
  - poll `fight().ko` not null instead of `'ending'`, with an `#end` timeout of `40_000`;
  - R9: `expect(f.time - f.run).toBeGreaterThan(5)`, with `'TIME ' + fmtTime(f.run)`.
- **"pausing on hold or mid-ending…":** becomes "…or in Houston's call…", using `fight().ko === 'call'` and `clock().ko`.
- **The dawdle smoke:** poll `fight().ko` to `'call'`.
- **"two whole games":** `#end` timeout `40_000`.
- **Replace `throughEnding` and its two tests with:**

```js
// R18 moved: on hold to just before Houston (cueing the switchboard intro `holds` times), then through the call to the knock-out.
const throughCall = (page, holds = 0) => page.evaluate(([n, H]) => { const o = window.ospTest, sub = () => document.getElementById('sub').textContent, s = []; o.god(true);
  for (let i = 0; i < 3000 && o.clock().hold < H - .1; i++) o.ff(1 / 30);
  for (let i = 0; i < n; i++) o.cue('hold');
  for (let i = 0; i < 3000 && o.fight().ko !== 'out' && o.state() === 'play'; i++) { const r = o.radio(); s.push({ t: o.clock().ko, line: r.line, sub: sub(), downs: o.audio().downs }); o.ff(1 / 30); }
  return { s, state: o.state(), sub: sub(), downs: o.audio().downs, ko: o.fight().ko }; }, [holds, HOLD.time]);
test('R18 moved: the knock-out comes as the rescue line\'s talk ends, with no closing tone', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await toComms(page); await onHold(page); const r = await throughCall(page), last = r.s.at(-1);
  expect(r.s.some(x => x.sub.includes('one small problem'))).toBe(true); expect(last.line).toContain('twenty min'); expect(last.t).toBeLessThan(KO.call);
  expect(r.downs).toBe(last.downs); expect([r.state, r.sub, r.ko]).toEqual(['end', '', 'out']); expect(errors).toEqual([]); });
test('R18 moved: at KO.call the knock-out comes whatever is on the air', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await toComms(page); await onHold(page); const r = await throughCall(page, 3), last = r.s.at(-1);
  expect(Math.abs(last.t - KO.call)).toBeLessThanOrEqual(2 / 30); expect(last.line).not.toBe(null); expect(r.s.some(x => x.sub.includes('twenty min'))).toBe(false);
  expect([r.state, r.sub, r.ko]).toEqual(['end', '', 'out']); expect(errors).toEqual([]); });
```

- [ ] **Step 2: Run them to see them fail:** `node --test tests/hold.test.mjs tests/radio.test.mjs tests/fight.test.mjs tests/view.test.mjs tests/purity.test.mjs`. Expected: FAIL (no `escape.js`, no `knockOut`, no `silence`).

- [ ] **Step 3: Implement** as in Interfaces. Update the header comments of `main.js` (states), `fight.js` (`F.ko`) and `radio.js` (R18 "while knocked out").

- [ ] **Step 4: Run the tests:** `npm test`, then `npm run test:smoke -- -g "final stand|R18|dawdle|two whole games|end screen"`. Expected: all pass, with the goldens unchanged.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "sim: Houston's call is the knock-out (F.ko); F.won means boarded; F.run stops while knocked out" -m "Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7"
```

---

### Task 2: A config pass on the base generator

Today's base must come out exactly: its golden part doesn't move.

**Files:**
- Modify: `src/gen/base.js`, `src/gen/baseplan.js`, `src/game/baseMesh.js`
- Test: `tests/base.test.mjs`

**Interfaces:**
- **`base.js`:**

  ```js
  export const BASE_PLAN = { stream: '/base', area: 2, attempts: BASE.attempts, crit: BASE.crit, side: BASE.side, loops: BASE.loops,
    start: 'lift', first: 'hangar', end: 'comms', at: [['lab', .35], ['reactor', .6], ['greenhouse', .8]], p: [.5, 1],
    golf: { room: 'side', id: 3 }, cells: ['hangar', 'reactor'], cans: [['hangar', 3], ['reactor', 3], ['greenhouse', 2]],
    amber: ['lift', 'hangar', 'comms'], teal: ['lab', 'reactor', 'greenhouse'], red: [] };
  ```

  `THEME_AT` goes.
- **`generateBase(seed, accept = baseAccept, cfg = BASE_PLAN)`:** draws on `makeRng(seed + cfg.stream + (attempt ? '#' + attempt : ''))`, `cfg.attempts` times. `build(seed, attempt, rng, cfg)` returns the map with `cfg`.
- **Inside `build`:**
  - Spans come from `cfg.crit`, `cfg.side` and `cfg.loops`.
  - The 2×2 end block, with step 6's corridor shift, is `cfg.end`.
  - Step 4 is `theme[0] = cfg.start; theme[1] = cfg.first; theme[L - 1] = cfg.end; for (const [t, f] of cfg.at) theme[Math.round(f * (L - 1))] = t;`.
- **`lightBase`:** draws on `makeRng(B.seed + B.cfg.stream + '/lights/' + B.attempt)`. A room's lamp: amber if its theme is in `cfg.amber`, else teal if in `cfg.teal`, else `LIGHT.alarm` (T3) if in `cfg.red`, else today's roll.
- **`planBase`:**
  - Draws on `makeRng(B.seed + B.cfg.stream + '/fight/' + B.attempt)`.
  - `p = cfg.p[0] + (cfg.p[1] - cfg.p[0]) * k / (L - 1)`, bitwise today's.
  - Items take `area: cfg.area`.
  - Golf rooms are `cfg.golf.room === 'side' ? B.side.slice(0, 2) : [themed(cfg.golf.room).id]`, with ids from `cfg.golf.id`.
  - Cells go in `cfg.cells`; canisters follow `cfg.cans`. Draws stay in today's order.
- **`buildBaseMeshes`:** draws on `makeRng(B.seed + B.cfg.stream + '/mesh')`.

- [ ] **Step 1: Write the failing test**

In `tests/base.test.mjs` (import `BASE_PLAN`, `baseAccept`):

```js
test('the generator reads its config: BASE_PLAN is today\'s base; another stream or order is another map (Plan 6)', () => {
  assert.equal(B.cfg, BASE_PLAN); assert.deepEqual([BASE_PLAN.stream, BASE_PLAN.start, BASE_PLAN.first, BASE_PLAN.end, BASE_PLAN.p, BASE_PLAN.area], ['/base', 'lift', 'hangar', 'comms', [.5, 1], 2]);
  const cfg = { ...BASE_PLAN, stream: '/other', at: [['greenhouse', .35], ['lab', .6], ['reactor', .8]] }, O = generateBase('APOLLO-4471', baseAccept, cfg);
  assert.equal(O.cfg, cfg); assert.notDeepEqual(O.floor, B.floor); assert.equal(O.crit.map(r => O.rooms[r].theme).filter(t => t !== 'plain').join(), 'lift,hangar,greenhouse,lab,reactor,comms'); });
```

- [ ] **Step 2: Run it to see it fail:** `node --test tests/base.test.mjs`. Expected: FAIL (`BASE_PLAN` isn't exported).

- [ ] **Step 3: Implement** as in Interfaces. Only where values come from changes.

- [ ] **Step 4: Run the tests:** `npm test && npm run test:seeds`. Expected: all pass, with **`golden.test.mjs` green and unchanged**, which is the proof.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "gen: the base generator reads a config; BASE_PLAN reproduces today's base" -m "Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7"
```

---

### Task 3: The prison map

**Files:**
- Modify: `src/gen/{base,baseplan,world}.js`, `src/game/{props,baseMesh}.js`, `tests/seeds.soak.mjs`
- Create: `tests/prison.test.mjs`

**Interfaces:**
- **Names (appended, so old indices and the base hash stay):**
  - `THEMES` += `'cell','cellblock','guard','interro','evidence','hall'`
  - `PROPS` += `'bars','cow','chair','shelf','exit'`
- **`BASE.ceil` / `BASE.size`:**
  - `BASE.ceil` += `cell: 2.8, cellblock: 4.5, guard: 4, interro: 3.5, evidence: 3.5, hall: 7`.
  - `BASE.size` += `cell: 5, cellblock: { long: 15, short: 8 }, guard: [8, 10], interro: 7, evidence: [7, 9]`.
  - **[call]** The cell block's long side runs along its entry link `lc[id - 1]`, along x when that link's cells share a row.
- **The prison config:**

  ```js
  export const PRISON_PLAN = { ...BASE_PLAN, stream: '/prison', area: 4, attempts: 64, crit: [6, 8], side: [2, 3], loops: [1, 1],
    start: 'cell', first: 'cellblock', end: 'hall', at: [['guard', .4], ['interro', .6], ['evidence', .8]], p: [.4, .9],
    guard: true, brute: 'guard', golf: { room: 'evidence', id: 5 }, cells: ['evidence', 'guard'], tape: ['evidence'],
    cans: [['guard', 3], ['evidence', 2]], amber: ['guard', 'interro', 'evidence'], teal: ['cell', 'cellblock', 'side'], red: ['hall'] };
  ```

  - `BASE_PLAN` gains `guard: false, brute: null, tape: []`.
  - **[call]** 64 attempts: one loop among 6–8 rooms re-rolls more.
  - **[call]** `p` runs from .4 at the cell to .9 at the hall, by the base's formula.
  - **[call]** Side rooms ("empty cells") get tape, and, holding no golf, cells by the base's rule; you start with a pole.
- **Step 7 features [call]:**
  - **`cellblock`: alcoves along both long walls**, from 2 tiles in from each corner, then every 3:
    - An alcove is the 2 wall-band tiles just outside the room.
    - Skip it unless both tiles, and those beyond them, are `K.wall`, and it lies ≥ 2 tiles (Chebyshev) from every doorway tile.
    - Its tiles get `kind K.prop, floor BASE.wall, ceil r.ceil, room r.id`: wall to collision, sight and nav, a recess to the mesh.
    - Push `prop('bars', mouth x, 0, mouth z, 2, 0, nx, nz)`, with `(nx, nz)` the inward normal.
    - One alcove (`rng.int`) also gets `prop('cow', centre, …, 0, 0, nx, nz)`.
    - No alcoves → null.
  - **`guard`:** `4 + rng.int(3)` optional `CRATE`s.
  - **`interro`:** required `feature(r, [[2, 2]], true, K.prop, 1, 'chair')`.
  - **`evidence`:** required `feature(r, [[3, 1], [1, 3]], true, K.prop, 2, 'shelf')`, then `1 + rng.int(3)` optional. `feature` keeps `w`/`d` for `'shelf'` as for `'bed'`.
  - **`hall`:** `band(r, 8, t => { floor[t] = .3; })`, `props.push(prop('exit', cx, .3, cz))`, `8 + rng.int(3)` optional `CRATE`s, no spawn doors.
- **Step 8:** a `'cell'` start gives the map `bars: { tiles, x, z, dx, dz }`.
  - `tiles` are the 3 tiles of link 0's corridor row touching room 0, and `(x, z)` the middle one.
  - `(dx, dz) = into[1]`, out of the cell, as `start`.
  - Otherwise `bars: null`.
- **`baseplan.js`:**
  - `LIGHT.alarm = { col: [2.2, .25, .08], r: 8, kind: 1 }` **[call]**.
  - `cfg.brute`'s room takes a brute first (`b -= 4`).
  - Each `cfg.tape` theme gets a `take('tape')` after the side rooms'.
  - `cfg.guard` prepends, with no draws, `{ x: in1.x, z: in1.z, p: cfg.p[0], room: 1, first: true, guard: true, area: cfg.area, aliens: [{ type: 'sk', x: in1.x, y: 0, z: in1.z }] }`, where `in1 = rooms[1].in`.
- **`world.js`:** `world.prisonMap = generateBase(seed, baseAccept, PRISON_PLAN); lightBase(world.prisonMap); world.prisonMap.plan = planBase(world.prisonMap);`. It isn't hashed until T6.
- **`props.js`:** `export function buildBars(M, x, y, z, w, ux, uz, h)`: `beam` posts r .035 every .25 m across `w` along `(ux, uz)`, from `y` to `y + h`, with top and bottom rails, in `MAT.lamp` (glowing teal).
- **`baseMesh.js` props [call]** (free shapes within these footprints):
  - **`bars`:** `buildBars`, h 2.6.
  - **`cow`:** a `blob` body `[.75, .45, .35]` at y .95, with a head, `beam` legs and horns; `MAT.hull`, legs `MAT.gunMetal`.
  - **`chair`:** a reclined seat on a pedestal, under a probe arm `beam` from the ceiling with a `lathe` tip.
  - **`shelf`:** posts and three boards (`MAT.crate`), 2 m tall, carrying junk from the mesh rng.
  - **`exit`:** a `MAT.grate` disc r 1.6, four posts to 3 m and a `MAT.amber` ring.

- [ ] **Step 1: Write the failing tests**

Create `tests/prison.test.mjs`:

```js
import test from 'node:test'; import assert from 'node:assert/strict'; import { generateWorld } from '../src/gen/world.js'; import { reachMap } from '../src/gen/passable.js';
import { generateBase, baseAccept, BASE, PRISON_PLAN, THEMES, PROPS, K } from '../src/gen/base.js';
const W = generateWorld('APOLLO-4471'), P = W.prisonMap, n = P.n, h = P.half, tile = o => Math.round(o.z + h) * n + Math.round(o.x + h);
test('the prison: own stream; cell, cellblock, guard, interro, evidence, hall in order; 2-3 side rooms; one loop', () => {
  assert.deepEqual(THEMES.slice(0, 8), ['plain', 'side', 'lift', 'hangar', 'lab', 'reactor', 'greenhouse', 'comms']); assert.deepEqual(PROPS.slice(0, 9), ['lift', 'saucer', 'jarRover', 'jarProbe', 'jar', 'core', 'bed', 'dish', 'strip']);
  assert.equal(P.cfg, PRISON_PLAN); assert.deepEqual(generateBase('APOLLO-4471', baseAccept, PRISON_PLAN).floor, P.floor); assert.notDeepEqual(P.floor, W.baseMap.floor);
  assert.ok(P.crit.length >= 6 && P.crit.length <= 8 && P.side.length >= 2 && P.side.length <= 3); assert.equal(P.links.filter(l => l.loop).length, 1);
  assert.equal(P.crit.map(r => P.rooms[r].theme).filter(t => t !== 'plain').join(), 'cell,cellblock,guard,interro,evidence,hall'); });
test('the cell: 5 x 5, low; its only doorway is the three bar tiles; all floor reachable once they open', () => {
  const c = P.rooms[0], b = P.bars; assert.deepEqual([c.x1 - c.x0, c.z1 - c.z0, c.ceil], [5, 5, BASE.ceil.cell]); assert.ok(BASE.ceil.cell < 3);
  assert.equal(b.tiles.length, 3); assert.deepEqual([b.dx, b.dz], [P.start.dx, P.start.dz]);
  for (const t of b.tiles) assert.ok(P.kind[t] === K.floor && P.room[t] < 0 && Math.hypot(t % n - h - b.x, (t / n | 0) - h - b.z) <= 1 + 1e-9);
  const shut = P.floor.slice(); for (const t of b.tiles) shut[t] = BASE.wall;
  const r = reachMap(shut, n, [Math.round(P.start.x + h), Math.round(P.start.z + h)], BASE.step, 0); let k = 0;
  for (let t = 0; t < n * n; t++) if (r[t] === 1) { assert.equal(P.room[t], 0); k++; } assert.equal(k, 25); assert.ok(baseAccept(P)); });
test('the cell block: 15 x 8, barred alcoves nobody walks into, one holding the cow', () => {
  const r = P.rooms[1], bars = P.props.filter(q => q.kind === 'bars'), cow = P.props.filter(q => q.kind === 'cow'), w = r.x1 - r.x0, d = r.z1 - r.z0;
  assert.deepEqual([r.theme, Math.max(w, d), Math.min(w, d)], ['cellblock', 15, 8]); assert.ok(bars.length >= 2); assert.equal(cow.length, 1);
  for (const q of bars) { const ux = Math.abs(q.dz), uz = Math.abs(q.dx); assert.equal(q.w, 2);
    for (const s of [-.5, .5]) { const t = tile({ x: q.x - q.dx * .5 + ux * s, z: q.z - q.dz * .5 + uz * s }); assert.ok(P.kind[t] === K.prop && P.room[t] === 1 && P.floor[t] >= BASE.wall); } }
  assert.ok(bars.some(q => Math.hypot(q.x - q.dx * .5 - cow[0].x, q.z - q.dz * .5 - cow[0].z) < .6)); });
test('the lift hall: 20 x 20, the exit lift raised at its centre, crates, no spawn doors, the only red lamps', () => {
  const r = P.rooms[P.crit.at(-1)], e = P.props.find(q => q.kind === 'exit');
  assert.deepEqual([r.theme, r.x1 - r.x0, r.z1 - r.z0, P.spawnDoors.length], ['hall', 20, 20, 0]); assert.deepEqual([e.x, e.z], [(r.x0 + r.x1 - 1) / 2 - h, (r.z0 + r.z1 - 1) / 2 - h]);
  assert.equal(P.floor[tile(e)], Math.fround(.3)); assert.ok(P.kind.some((k, t) => k === K.cover && P.room[t] === r.id));
  const red = P.lights.filter(l => l.kind === 1); assert.ok(red.length > 0 && red.every(l => P.room[tile(l)] === r.id)); });
test('the prison plan: the guard first; a brute in the guard room; golf 5, tape and cells in evidence; p .4-.9; area 4', () => {
  const L = P.crit.length, E = P.plan.encounters, g = E[0], in1 = P.rooms[1].in, ev = P.rooms.find(r => r.theme === 'evidence'), inEv = q => P.room[tile(q)] === ev.id;
  assert.deepEqual([g.first, g.guard, g.room, g.area, g.x, g.z, g.aliens.map(a => [a.type, a.x, a.z])], [true, true, 1, 4, in1.x, in1.z, [['sk', in1.x, in1.z]]]);
  assert.equal(E.length, L - 1); E.slice(1).forEach((e, i) => { assert.equal(e.room, i + 1); assert.ok(Math.abs(e.p - (.4 + .5 * (i + 1) / (L - 1))) < 1e-9 && !e.first); });
  assert.ok(E.find(e => P.rooms[e.room].theme === 'guard').aliens.some(a => a.type === 'br'));
  assert.deepEqual(P.plan.golf.map(b => [b.id, inEv(b)]), [[5, true]]); assert.ok(['tape', 'cells'].every(k => P.plan.pickups.some(q => q.kind === k && inEv(q))));
  for (const q of [...E, ...P.plan.pickups, ...P.plan.canisters, ...P.plan.golf]) assert.equal(q.area, 4); });
```

In `tests/seeds.soak.mjs`, add `checkPrison(seed, world.prisonMap)` for every seed. It checks:
- tests 1–2's counts, order, loop and sealed cell, plus `baseAccept`;
- golf 5, the guard and the guard room's brute;
- every item and alien on reachable floor.

It also prints a re-roll histogram. A seed that exhausts the attempts fails.

- [ ] **Step 2: Run them to see them fail:** `node --test tests/prison.test.mjs`. Expected: FAIL (no `PRISON_PLAN`, no `W.prisonMap`).

- [ ] **Step 3: Implement** as in Interfaces.

- [ ] **Step 4: Run the tests:** `npm test && npm run test:seeds`. Expected: all pass, the goldens unchanged, every prison generated. If a seed exhausts 64 attempts, report BLOCKED with the seed; don't change the room counts.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "gen: the prison (PRISON_PLAN): barred cell, cell block and cow, guard room, interrogation, evidence, lift hall" -m "Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7"
```

---

### Task 4: The prison level and the energy bars

**Files:**
- Modify: `src/game/{areas,fight,models,fightView}.js`, `src/main.js`, `tests/{areas,view}.test.mjs`, `tests/smoke.spec.mjs`
- Create: `tests/escape.test.mjs`

**Interfaces:**
- **`areas.js`:**
  - Area 4 is `'prison'` (`LEVEL` `'prison'`, text `'THE CELLS'`); `GRAVITY.prison = 9`, `WAKE.prison = 30`.
  - `areaStart` reads a table of getters; entry 4 is `w => w.prisonMap.start`.
  - `export const stintEnd = k => { while (LEVEL[k + 1] === LEVEL[k]) k++; return k; }`.
  - **`makeLevel`**, off the surface:
    - takes `M = id === 'base' ? world.baseMap : world.prisonMap`;
    - its `grid` is `M.floor.slice()`, which `ground` reads;
    - it adds `map: M` and `bars: M.bars?.tiles ?? null`.
  - `export function setBars(lv, shut)` sets `lv.grid[t]` to `BASE.wall` or `lv.map.floor[t]` on the bar tiles.
- **`fight.js`:**
  - **`populate(F, from)`:** takes `from <= area <= stintEnd(from)`; ids are as today.
  - **`arrive(F, k)`**, called at the end of `createFight`, `enterArea` (always) and `restartArea`: at k 4 it sets `F.cell = { shut: true }` and `setBars(F.lv, true)`; at k 5 it sets `F.cell = null` (T5 extends this).
  - **`export function openBars(F)`:** `F.cell.shut = false; setBars(F.lv, false); F.events.push({ type: 'bars' })`.
  - **`export function strip(F)`:** owned `[true, false, false]`, cells 0, `cur` 0, `cool` 0, the flag held, `hp = KO.hp`.
  - **`export function skipTo(F, k)`:** `if (F.area < 4 && k >= 4) strip(F); F.ko = null; F.hold = null; enterArea(F, k);`.
- **The bars on screen:**
  - `models.js`: a `bars` model (`buildBars`, 3 m wide along x, 2.7 m tall).
  - `fightView.js`: while `F.cell?.shut`, draws `G.bars` at `F.lv.map.bars` with `trs(mat(), b.x, 0, b.z, Math.atan2(b.dx, b.dz), 1)`.
- **`main.js`:**
  - `swap()` builds `lv.id === 'surface' ? buildSurfaceScene(gl, run.world) : buildBaseScene(gl, lv.map)`, and `useScene` calls `audio.air(lv.id !== 'surface')`.
  - `BACK` gains `'the cell'`; `MUSIC` gains `'base'` (T11 makes it `'prison'`).
  - `ospTest.prison = () => skipTo(run.F, 4)`; `fight()` adds `cell: F.cell && { ...F.cell }`.

- [ ] **Step 1: Write the failing tests**

`areas.test.mjs`:
- The first test pins `AREAS.slice(0, 4)` and its `GRAVITY` entries, and loops `k < AREAS.length`.
- The populate test compares `C.encs.length` with `C.lv.plan.encounters.length`.

Create `tests/escape.test.mjs` (later tasks append to it):

```js
import test from 'node:test'; import assert from 'node:assert/strict'; import { generateWorld } from '../src/gen/world.js'; import { BASE } from '../src/gen/base.js';
import { AREAS, LEVEL, GRAVITY, makeLevel, areaStart, stintEnd } from '../src/game/areas.js'; import { lineOfSight, updateField, UNK } from '../src/game/nav.js'; import { give } from '../src/game/weapons.js';
import { createFight, stepFight, hurtPlayer, skipTo, openBars, DEATH_TIME } from '../src/game/fight.js'; import { KO } from '../src/game/escape.js';
const W = generateWorld('APOLLO-4471'), P = W.prisonMap, idle = { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 };
const run = (F, inp, secs, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) stepFight(F, inp, dt); };
const put = (F, x, z) => Object.assign(F.player, { x, z, y: F.lv.ground(x, z), vx: 0, vy: 0, vz: 0, kx: 0, kz: 0 });
const face = (F, x, z) => { F.player.yaw = Math.atan2(F.player.x - x, F.player.z - z); F.player.pitch = 0; };
const near = (p, s, d = .5) => Math.hypot(p.x - s.x, p.z - s.z) < d;
const fieldAt = (F, x, z) => { const f = F.field; return f.d[(Math.round(z + f.half) - f.oz) * f.n + Math.round(x + f.half) - f.ox]; };
const cellF = () => { const F = createFight(W); skipTo(F, 4); F.events.length = 0; return F; };
test('area 4 is the prison: its own level, gravity 9, started in the cell; stints keep levels apart', () => {
  assert.deepEqual([AREAS[4], LEVEL[4], GRAVITY.prison, stintEnd(0), stintEnd(2), stintEnd(4)], ['prison', 'prison', 9, 1, 3, 4]);
  const F = createFight(W, 4); assert.deepEqual([F.lv.id, F.lv.map, F.gravity, F.cell.shut], ['prison', P, 9, true]); assert.equal(areaStart(W, 4), P.start);
  assert.ok(near(F.player, P.start)); assert.ok(F.aliens.length > 0 && [...F.aliens, ...F.pickups].every(q => q.area === 4)); assert.equal(makeLevel(W, 'base').map, W.baseMap); });
test('shut bars block walking, sight and the nav field; open, the doorway is floor again; the map never changes', () => {
  const F = createFight(W, 4), b = P.bars, p = F.player, out = [b.x + b.dx * 3, b.z + b.dz * 3], see = () => lineOfSight(F.lv.ground, [p.x, p.y + 1.5, p.z], [out[0], p.y + 1.5, out[1]], F.lv.ceil);
  F.aliens.length = 0; for (const t of b.tiles) assert.equal(F.lv.grid[t], BASE.wall); assert.equal(see(), false);
  face(F, b.x, b.z); run(F, { ...idle, fwd: 1 }, 2); assert.ok((p.x - b.x) * b.dx + (p.z - b.z) * b.dz < -.5, 'stopped short');
  updateField(F.field, F.lv.grid, F.lv.n, F.lv.half, p.x, p.z, F.lv.maxStep); assert.equal(fieldAt(F, ...out), UNK);
  openBars(F); for (const t of b.tiles) assert.equal(F.lv.grid[t], P.floor[t]); assert.ok(see()); assert.ok(F.events.some(e => e.type === 'bars'));
  updateField(F.field, F.lv.grid, F.lv.n, F.lv.half, p.x, p.z, F.lv.maxStep); assert.notEqual(fieldAt(F, ...out), UNK);
  run(F, { ...idle, fwd: 1 }, 2); assert.ok((p.x - b.x) * b.dx + (p.z - b.z) * b.dz > .5, 'through'); for (const t of b.tiles) assert.equal(P.floor[t], 0); });
test('skipTo the prison strips you to the flag pole at KO.hp, checkpoint too; a death restarts you, bars shut', () => {
  const F = createFight(W, 3); give(F.ars, 1, 99); give(F.ars, 2, 0); F.hp = 40; skipTo(F, 4);
  assert.deepEqual([F.area, F.lv.id, F.hp, F.ars.owned, F.ars.cells, F.ars.cur, F.flag.held, F.ko], [4, 'prison', KO.hp, [true, false, false], 0, 0, true, null]);
  assert.deepEqual([F.entry.owned, F.entry.cells, F.entry.flagHeld], [[true, false, false], 0, true]); assert.ok(F.events.some(e => e.type === 'area' && e.level));
  openBars(F); hurtPlayer(F, 999, 0, 0, 0); run(F, idle, DEATH_TIME + .1); assert.ok(F.cell.shut && near(F.player, P.start)); for (const t of P.bars.tiles) assert.equal(F.lv.grid[t], BASE.wall); });
```

`view.test.mjs` (import `openBars`):

```js
test('the cell bars are drawn while shut, gone once open (Plan 6)', () => { const F = createFight(W, 4), fr = frame(), has = () => fr.meshes.some(m => m.gpu === V.gpu.bars);
  fillFrame(V, F, fr, 0); assert.ok(has()); openBars(F); fillFrame(V, F, fr, 0); assert.ok(!has()); });
```

`smoke.spec.mjs`:

```js
const area = page => page.evaluate(() => window.ospTest.area());
test('the prison renders palette-true and lit, with air; you hold the pole at 70 hp behind shut bars (Plan 6)', async ({ page }) => {
  const errors = watchErrors(page); await start(page); await page.evaluate(() => window.ospTest.prison()); await expect.poll(() => area(page)).toBe('prison');
  const f = await fight(page); expect([f.cell.shut, f.hp, f.cur]).toEqual([true, KO.hp, 0]); expect(await page.evaluate(() => window.ospTest.audio().air)).toBe(true);
  const s = await page.evaluate(() => window.ospTest.capture()); expect(s.inPalette).toBe(1); expect(s.colours).toBeGreaterThan(6); expect(s.black).toBeLessThan(.9); expect(errors).toEqual([]); });
```

- [ ] **Step 2: Run them to see them fail:** `node --test tests/escape.test.mjs tests/areas.test.mjs tests/view.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement** as in Interfaces.

- [ ] **Step 4: Run the tests:** `npm test`, then `npm run test:smoke -- -g "prison|base"`. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "sim: the prison level (area 4) and its energy bars" -m "Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7"
```

---

### Task 5: The break-out beat and the cell's checkpoint

**Files:**
- Modify: `src/game/{escape,fight,radio,script}.js`, `src/audio/sfx.js`, `src/main.js`, `tests/{escape,radio}.test.mjs`, `tests/smoke.spec.mjs`

**Interfaces:**
- **`BREAK` [call]** (values pinned in the first test below):
  - E's reach (m) and squareness (forward · the direction to the bars);
  - seconds from the bang to the guard (`guard`) and to the bars dropping (`open`);
  - seconds between nudges in the shut cell (`idle`) and between PA notices once out (`pa`).
- **`F.cell`** = `{ shut, bang: null, idle: 0, nudges: 0, pa: 0, freed }`. `arrive(F, 4)` keeps `freed` across restarts, with `shut = !freed`.
- **`export function canBang(F)`:** `F.area === 4 && F.state === 'play' && !F.ko && F.cell.shut && F.cell.bang === null && d <= BREAK.reach && (d < 1e-6 || fwd · dir >= BREAK.face)`, with `d` and `dir` from the player to `F.world.prisonMap.bars`.
- **Step 2:** `if (input.use && canBang(F)) { F.cell.bang = 0; F.events.push({ type: 'bang' }); }`.
- **After step 3** (living, area 4, `!F.ko`):
  - **Shut and unbanged:** `idle += dt`. At `BREAK.idle`, `idle -= BREAK.idle` and push `{ type: 'nudge', n: ++nudges }`.
  - **Banged:** `bang += dt`.
    - Crossing `BREAK.guard` spawns the guard from the level plan's `encounters[0]` (`guard: true`): `createAlien(e.aliens[0], 1, F.encs[0])` with `area` 4; set `F.encs[0].alerted` and push `{ type: 'guard' }`.
    - Crossing `BREAK.open` calls `openBars(F)`.
  - **Open:** `pa += dt`. At `BREAK.pa`, push `{ type: 'pa' }`.
- **`populate`:** encs carry `guard: !!e.guard`. The guard encounter's aliens are not spawned, but their ids still count.
- **`killed`:** tape always drops when `a.enc.guard` (it is `first`, so it drops a pistol too). For the guard, also:
  - `F.cell.freed = true`;
  - `F.entry.owned[1] = true; F.entry.cells = Math.min(MAX_CELLS, F.entry.cells + PICKUP.pistol)`, like Plan 3 R12;
  - push `{ type: 'freed' }`.
- **`radio.js`:**
  - `PLAIN` gains `bang`, `guard`, `freed` and `pa`.
  - `'nudge'` cues `radioCue(R, 'nudge', e.n)`.
  - `dawdling` also needs `!F.cell?.shut`.
- **`script.js`** (14 lines):
  - `bang: { crit: 1 }`: `["S|PRISONER. QUIET."]`
  - `nudge: { at: 1 }`: `["H|Try banging on the door. Works in every movie.", "H|Still with us? The bars. Bang on the bars.", "Y|Hello? Room service?", "H|Flight suggests making a nuisance of yourself. You're good at that."]`
  - `guard: { crit: 1 }`: `["H|One guard, coming to check on you. You have a flag pole. We like those odds."]`
  - `freed: { seq: 1 }`: `["S|PRISONER OUT OF BOUNDS. PLEASE REMAIN CALM.", "H|Taken out with a flag pole. Somewhere a historian just fainted."]`
  - `pa: { cool: 30 }`: `["S|ATTENTION. A PRISONER IS LOOSE. DO NOT FEED THE PRISONER.", "S|REMINDER. THE INTERROGATION CHAIR IS NOT FOR STAFF USE.", "S|WILL THE OWNER OF THE COW PLEASE COLLECT THE COW.", "S|ALL GUARDS TO CELL ONE. ALL GUARDS. ANY GUARDS.", "S|THIS FACILITY HAS GONE ZERO DAYS WITHOUT AN ESCAPE.", "S|PLEASE RETURN TO YOUR CELL. THANK YOU FOR YOUR COOPERATION."]`
- **`sfx.js` [call]:** `SFX.bang = [.8, .05, 180, 0, .02, .25, 3, 1, 0, 0, 0, 0, .05, 2]` (a clang); `SFX.bars = [.5, .05, 900, .01, .05, .3, 1, 1, -30]` (a falling zap); `sfxFor` maps both.
- **`main.js`:**
  - The prompt shows `canBang(F) ? '[E] bang on the bars'` after the dead one.
  - `ospTest.bang(press = true)` puts you 1.2 m inside the bars facing them and, if `press`, steps one E.

- [ ] **Step 1: Write the failing tests**

In `escape.test.mjs`, import `hurtAlien`, `canBang`, `PICKUP`, `BREAK`, `dawdling` and `MAX_CELLS`, then add:

```js
const atBars = (F, d = 1.2) => { const b = P.bars; put(F, b.x - b.dx * d, b.z - b.dz * d); face(F, b.x, b.z); };
const banged = () => { const F = cellF(); atBars(F); stepFight(F, { ...idle, use: true }, 1 / 60); return F; };
test('the break-out: facing the bars, E bangs once; the guard at BREAK.guard s, the bars drop at BREAK.open s', () => {
  assert.deepEqual(BREAK, { reach: 2, face: .5, guard: 3, open: 4.5, idle: 20, pa: 40 });
  const F = cellF(), b = P.bars; atBars(F, 3); assert.equal(canBang(F), false); atBars(F); F.player.yaw += Math.PI; assert.equal(canBang(F), false);
  atBars(F); assert.ok(canBang(F)); stepFight(F, { ...idle, use: true }, 1 / 60); assert.ok(F.events.some(e => e.type === 'bang')); assert.equal(canBang(F), false);
  run(F, idle, BREAK.guard - .1); assert.ok(!F.aliens.some(a => a.enc.guard)); run(F, idle, .2); const g = F.aliens.find(a => a.enc.guard);
  assert.ok(g && g.id === 1 && g.type === 'sk' && g.area === 4 && g.enc.alerted && g.enc.first && F.cell.shut); assert.ok(Math.hypot(g.x - P.rooms[1].in.x, g.z - P.rooms[1].in.z) < 1);
  run(F, idle, BREAK.open - BREAK.guard); assert.equal(F.cell.shut, false); for (const t of b.tiles) assert.equal(F.lv.grid[t], P.floor[t]);
  stepFight(F, { ...idle, use: true }, 1 / 60); assert.equal(F.aliens.filter(a => a.enc.guard).length, 1, 'E again does nothing'); });
test('spec 4.1: the guard drops pistol and tape; once it is dead you restart freed with them, and no guard', () => {
  const F = banged(); run(F, idle, BREAK.guard + .1); const g = F.aliens.find(a => a.enc.guard); hurtAlien(g, 999, 0, 0); stepFight(F, idle, 1 / 60);
  assert.deepEqual(F.pickups.filter(q => Math.hypot(q.x - g.x, q.z - g.z) < 1).map(q => q.kind).sort(), ['pistol', 'tape']);
  assert.ok(F.cell.freed && F.events.some(e => e.type === 'freed')); assert.deepEqual([F.entry.owned, F.entry.cells], [[true, true, false], PICKUP.pistol]);
  hurtPlayer(F, 999, 0, 0, 0); run(F, idle, DEATH_TIME + .1); assert.deepEqual([F.area, F.cell.shut, F.ars.owned, F.ars.cells, F.ars.cur], [4, false, [true, true, false], PICKUP.pistol, 1]);
  for (const t of P.bars.tiles) assert.equal(F.lv.grid[t], P.floor[t]); run(F, idle, BREAK.open + 1); assert.ok(!F.aliens.some(a => a.enc.guard)); });
test('spec 4.1: dying while the guard lives replays the beat: bars shut, no guard until you bang again', () => {
  const F = banged(); run(F, idle, BREAK.open + .1); assert.equal(F.cell.shut, false); hurtPlayer(F, 999, 0, 0, 0); run(F, idle, DEATH_TIME + .1);
  assert.deepEqual([F.cell.shut, F.cell.bang, F.cell.freed, F.ars.owned], [true, null, false, [true, false, false]]);
  run(F, idle, BREAK.open + 1); assert.ok(F.cell.shut && !F.aliens.some(a => a.enc.guard)); });
test('dying in the step the guard dies still frees you (Review Focus 2)', () => {
  const F = banged(); run(F, idle, BREAK.guard + .1); hurtAlien(F.aliens.find(a => a.enc.guard), 999, 0, 0); F.hp = 0; stepFight(F, idle, 1 / 60);
  assert.deepEqual([F.state, F.cell.freed], ['dead', true]); run(F, idle, DEATH_TIME + .1);
  assert.deepEqual([F.state, F.cell.shut, F.ars.owned[1], F.ars.cells], ['play', false, true, Math.min(MAX_CELLS, PICKUP.pistol)]); });
test('the shut cell nudges every BREAK.idle s with no dawdling; none after the bang; once out a PA every BREAK.pa s', () => {
  const F = cellF(), ev = []; for (let t = 0; t < 2 * BREAK.idle + 1; t += 1 / 30) { stepFight(F, idle, 1 / 30); ev.push(...F.events.filter(e => e.type === 'nudge').map(e => e.n)); F.events.length = 0; }
  assert.deepEqual(ev, [1, 2]); assert.equal(dawdling('play', F), false); atBars(F); stepFight(F, { ...idle, use: true }, 1 / 60); F.events.length = 0;
  run(F, idle, BREAK.open + .1); assert.ok(!F.events.some(e => e.type === 'nudge')); F.god = true; run(F, idle, BREAK.pa); assert.ok(F.events.some(e => e.type === 'pa')); });
```

In `radio.test.mjs`:
- "fight events map to cues" gains `assert.equal(keyOf([{ type: 'bang' }]), 'bang'); assert.equal(keyOf([{ type: 'nudge', n: 1 }]), 'nudge');`.
- The script test gains `assert.deepEqual(SCRIPT.bang, ['S|PRISONER. QUIET.']); assert.equal(SCRIPT.nudge[0], 'H|Try banging on the door. Works in every movie.');`.

In `smoke.spec.mjs` (import `BREAK`):

```js
test('the bars open: the prompt, a bang, the Switchboard, a guard, the bars drop (Plan 6)', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await page.evaluate(() => window.ospTest.prison()); await expect.poll(() => area(page)).toBe('prison');
  await page.evaluate(() => window.ospTest.bang(false)); await expect(page.locator('#prompt')).toHaveText('[E] bang on the bars'); await page.evaluate(() => window.ospTest.bang());
  await expect.poll(() => page.evaluate(() => window.ospTest.radio().line)).toContain('PRISONER. QUIET.'); await page.evaluate(s => window.ospTest.ff(s), BREAK.open + .2);
  const f = await fight(page); expect([f.cell.shut, f.cell.bang > BREAK.open]).toEqual([false, true]); expect(errors).toEqual([]); });
```

- [ ] **Step 2: Run them to see them fail:** `node --test tests/escape.test.mjs tests/radio.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement** as in Interfaces.

- [ ] **Step 4: Run the tests:** `npm test`, then `npm run test:smoke -- -g "bars|prison"`. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "sim: the break-out: bang, the guard, the bars drop; a dead guard frees the cell checkpoint" -m "Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7"
```

---

### Task 6: A route-generic planner and the escape plans

The checksum appends the prison and the escape plan here, and the goldens are re-pinned once.

**Files:**
- Modify: `src/gen/{encounters,world,checksum}.js`, `src/game/areas.js`, `tests/{golden,encounters,areas}.test.mjs`, `tests/seeds.soak.mjs`

**Interfaces:**
- **`routePlanner(world)`** builds today's `reach` and returns `{ standable, compose, place, pick, cluster3, golfIn, plan }`.
  - `plan = { encounters: [], pickups: [], canisters: [], golf: [] }`; `pick` and `cluster3` read and push into it.
  - `golfIn(gr, pts, [lo, hi], id, area)` is today's golf loop body for one band.
  - `planFight` becomes a thin caller: the same calls, arguments and order. **The level 1 hash test is the proof.**
- **`ESCAPE` [call]**, values pinned in the first encounters test below.
- **`export function planEscape(world) => { encounters, pickups, canisters, golf, site }`**, on a fresh planner:
  - **Climb** (area 5, `'/escape/climb/'`, along `up` = `crater.path` reversed):
    - encounters at `climbAt` of its length, with `p = climbP[0] + (climbP[1] - climbP[0]) * at`, placed by `place(c, compose(p, i, cr), [-6, 6], [-4, 8], up, at * Lp, cr)`;
    - tape at .5 and cells at .8, with a canister cluster 5–9 m from the last encounter, as level 1's crater.
  - **Dash** (area 6, `'/escape/dash/'`, along `back` = the route reversed, rim → spawn):
    - `count = max(5, floor((Lr - FIRST_AT) / GAP))`, with encounters at `s = FIRST_AT + k * (Lr - 8 - FIRST_AT) / count`;
    - `p = dashP[0] + (dashP[1] - dashP[0]) * s / Lr`, placed by `place(c, compose(p, k, rng), [-14, 14], [-4, 10], back, s + 12, rng)`, none `first`;
    - level 1's four `onRoute` pickups, and canister clusters at hosts `[1, 3, last]`.
  - **Golf** (`'/escape/golf/'`): `golfIn(gr, back, ESCAPE.golf, 6, 6)`.
  - **Site** (`'/escape/site/'`):
    - Up to `tries` candidates, each a direction by rejection (as `cluster3`) at a distance in `site` from `world.lander`.
    - The first passes if `standable`, all rocks are ≥ `rockGap + max(sx, sz)` away, and `world.h` within 4 m varies ≤ `flat`.
    - Failing that, take the flattest standable candidate; throw `'no rescue site for seed ' + seed` only if none was standable.
    - The result is `{ x, y: sampleGround(world, x, z), z, dx, dz }`, with `(dx, dz)` the unit vector toward `world.rim` **[call]**, so the ladder faces you as you come.
- **`world.js`:** `world.escape = planEscape(world)`, last.
- **`checksum.js`:**
  - The baseMap block becomes `mapParts(B)`, which also hashes `B.bars ? [...tiles, x, z, dx, dz] : []`. That is empty for the base, so its bytes don't change.
  - `checksumWorld(world, levelOne = false)`: unless `levelOne`, it appends `mapParts(prisonMap)`, `planBytes(prison plan, true)`, `planBytes(world.escape, false)` and the site `[x, y, z, dx, dz]`.
- **`makeLevel(world, 'surface')`:** `plan` concatenates `world.plan` and `world.escape` list by list, level 1 first.

- [ ] **Step 1: Write the failing tests**

`golden.test.mjs`:

```js
// Re-pinned in Plan 6 Task 6, which appended the prison and the escape plan; re-pin in any later commit that changes generation (R15).
const GOLDEN = { 'APOLLO-4471': '<step 4>', 'EAGLE-0001': '<step 4>', 'SOAK-0042': '<step 4>' };
const LEVEL_ONE = { 'APOLLO-4471': '60273c6a', 'EAGLE-0001': '39762eb2', 'SOAK-0042': 'ee4eda57' }; // before Plan 6 (H4)
test('the level 1 parts hash as before Plan 6 (Plan 6)', () => { for (const [s, c] of Object.entries(LEVEL_ONE)) assert.equal(checksumWorld(generateWorld(s), true), c, s); });
```

`encounters.test.mjs` (import `planEscape`, `ESCAPE`):

```js
test('the escape plan: areas 5-6; the climb like the crater; the dash p .6-1, full budgets; golf 6 off the route', () => {
  const E = W.escape, C = E.encounters.filter(e => e.area === 5), D = E.encounters.filter(e => e.area === 6);
  assert.deepEqual(ESCAPE, { climbAt: [.25, .6, .95], climbP: [.35, .5], dashP: [.6, 1], golf: [.4, .65], site: [20, 30], flat: .6, rockGap: 6, tries: 80 });
  assert.ok([...E.encounters, ...E.pickups, ...E.canisters, ...E.golf].every(q => q.area === 5 || q.area === 6)); assert.deepEqual(planEscape(W), E);
  assert.equal(C.length, 3); C.forEach((e, i) => assert.ok(Math.abs(e.p - (.35 + .15 * ESCAPE.climbAt[i])) < 1e-9 && cost(e) === budgetAt(e.p)));
  assert.ok(D.length >= 6 && D.every(e => e.p >= .6 && e.p <= 1 && !e.first && cost(e) === budgetAt(e.p)));
  assert.deepEqual(E.golf.map(b => [b.id, b.area]), [[6, 6]]); assert.ok(distToPolyline(E.golf[0].x, E.golf[0].z, W.route) >= 20); });
test('the rescue site: 20-30 m from your lander, flat, clear of rocks, its ladder facing the rim', () => {
  for (const s of ['APOLLO-4471', 'EAGLE-0001', 'SOAK-0042']) { const w = generateWorld(s), S = w.escape.site, L = w.lander, d = Math.hypot(S.x - L.x, S.z - L.z);
    assert.ok(d >= 20 && d <= 30, `${s} ${d}`); assert.ok(Math.abs(Math.hypot(S.dx, S.dz) - 1) < 1e-9 && S.dx * (w.rim.x - S.x) + S.dz * (w.rim.z - S.z) > 0);
    assert.ok(w.rocks.every(k => Math.hypot(k.x - S.x, k.z - S.z) >= ESCAPE.rockGap + Math.max(k.sx, k.sz)), s); assert.equal(S.y, sampleGround(w, S.x, S.z));
    let lo = Infinity, hi = -Infinity; for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (i * i + j * j <= 16) {
      const y = w.h[(Math.round(S.z + HALF) + j) * N + Math.round(S.x + HALF) + i]; lo = Math.min(lo, y); hi = Math.max(hi, y); }
    assert.ok(hi - lo <= ESCAPE.flat, `${s} ${hi - lo}`); } });
```

`areas.test.mjs`:

```js
test('the surface level carries both plans, level 1 first; a level 1 fight has only areas 0-1 (Plan 6)', () => { const F = createFight(W);
  assert.equal(F.lv.plan.encounters.length, W.plan.encounters.length + W.escape.encounters.length); assert.equal(F.lv.plan.golf.length, W.plan.golf.length + 1);
  assert.ok([...F.aliens, ...F.pickups, ...F.canisters, ...F.balls].every(q => q.area <= 1)); });
```

`seeds.soak.mjs`, per seed:
- the escape plan's counts, areas, p ranges and `stands` walkers;
- golf 6 standable and ≥ 20 m off the route;
- the site in range, rock-clear and flat.

It **fails** on any seed whose site came from the fallback.

- [ ] **Step 2: Run them to see them fail:** `node --test tests/golden.test.mjs tests/encounters.test.mjs tests/areas.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement** as in Interfaces.

- [ ] **Step 4: Re-pin, then run the tests**

The level 1 test must be green before `GOLDEN` is touched; if it isn't, the refactor moved a draw, so fix the refactor, not the test. Then pin the actual values the golden test's failures print.

Run: `npm test && npm run test:seeds && npm run test:bot`

Expected: all pass. "Same Moon as Node" compares to Node, so it needs no change.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "gen: route-generic planner and the escape plan; checksum appends prison and escape; goldens re-pinned" -m "Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7"
```

---

### Task 7: The exit lift and the climb (areas 5 and 6)

**Files:**
- Modify: `src/game/{escape,areas,fight,radio,script}.js`, `src/main.js`, `tests/escape.test.mjs`, `tests/smoke.spec.mjs`

**Interfaces:**
- **`escape.js`:** `export const EXIT = { reach: 2.5 }`; `export const exitOf = B => B.props.find(q => q.kind === 'exit')`.
- **`areas.js`:**
  - The tables take their final values; `AREA_TEXT` ends `'THE CLIMB','THE DASH'`.
  - Starts:
    - area 5: `{ x: use.x, z: use.z, dx: door.dx, dz: door.dz }`, outside the door facing the switchback;
    - area 6: `{ x: top.x, z: top.z, dx, dz }`, with `(dx, dz)` the unit vector toward `w.lander`.
  - `export const CRATER_AREAS = [1, 5]`, used for `fight.js`'s two `F.area === 1 ? FALL.safe : Infinity`.
  - `advanceArea`: `k === 5` outside the crater's `R` → 6.
  - `wayTarget`:
    - area 1's walk becomes `follow(P, p, end)`; area 1 is `follow(crater.path, p, crater.use)`, unchanged;
    - area 5 is `follow(reversed crater.path, p, crater.top)`;
    - area 6 is the site's `{ x, z }`;
    - area 4 is null.
- **`fight.js`:**
  - `export const atExit = F => F.area === 4 && F.state === 'play' && !F.ko && dist(player, exitOf(map)) <= EXIT.reach`.
  - Step 2: `if (input.use && atExit(F)) enterArea(F, 5)`.
- **`radio.js`:** `AREA_CUES` += `'climb'`, `'dash'`.
- **`script.js`** (6 lines):
  - `climb: {}`: `["H|That lift came up in the crater. You're right where you went in.", "H|Same switchback, other direction. Mind the drop.", "Y|Houston, I'm out. Heading up.", "H|Up the path. You know about the drop."]`
  - `dash: { seq: 1 }`: `["H|Rescue is on final, coming down by your lander.", "H|It's the same model as yours. Try not to let them blow this one up."]` (the second spec verbatim)
- **`main.js`:**
  - The prompt shows `atExit(F) ? '[E] take the lift'`.
  - `BACK` += `'the hangar door','the crater rim'`; `MUSIC` += `'crater','surface'` (T11 sets `'escape'`).
  - `ospTest.lift()`: `prison()` if `area < 4`, `openBars` if shut, put you at the exit, step one E.
  - `ospTest.climb()` / `dash()`: `skipTo(run.F, 5 / 6)`.

- [ ] **Step 1: Write the failing tests**

In `escape.test.mjs`, import `AREA_TEXT`, `advanceArea`, `wayTarget`, `wayfind`, `atExit`, `EXIT` and `exitOf`, then add:

```js
test('areas 5-6 on the surface: the climb starts at the hangar door facing out, the dash at the rim facing your lander', () => {
  assert.deepEqual(AREAS, ['surface', 'crater', 'base', 'comms', 'prison', 'climb', 'dash']); assert.deepEqual(LEVEL.slice(4), ['prison', 'surface', 'surface']);
  assert.deepEqual(AREA_TEXT.slice(4), ['THE CELLS', 'THE CLIMB', 'THE DASH']); assert.equal(EXIT.reach, 2.5); const U = W.crater.use, d = W.crater.door, T = W.crater.top, s6 = areaStart(W, 6);
  assert.deepEqual(areaStart(W, 5), { x: U.x, z: U.z, dx: d.dx, dz: d.dz }); const l = Math.hypot(W.lander.x - T.x, W.lander.z - T.z);
  assert.deepEqual([s6.x, s6.z], [T.x, T.z]); assert.ok(Math.abs(s6.dx - (W.lander.x - T.x) / l) < 1e-12 && Math.abs(s6.dz - (W.lander.z - T.z) / l) < 1e-12);
  const F = createFight(W, 5), n1 = W.plan.encounters.reduce((s, e) => s + e.aliens.length, 0);
  assert.ok(F.aliens.length > 0 && F.aliens.every(a => (a.area === 5 || a.area === 6) && a.id > n1)); assert.ok(F.balls.every(b => b.id === 6)); });
test('E at the exit lift takes you up to the climb: a fresh surface at the hangar door', () => {
  const F = cellF(), e = exitOf(P); openBars(F); put(F, e.x + 1, e.z); assert.ok(atExit(F)); stepFight(F, { ...idle, use: true }, 1 / 60);
  assert.deepEqual([F.area, F.lv.id, F.gravity, F.cell], [5, 'surface', GRAVITY.surface, null]); assert.ok(near(F.player, W.crater.use, 1e-9));
  assert.ok(F.events.some(v => v.type === 'area' && v.area === 5 && v.level && v.text === 'THE CLIMB')); assert.deepEqual(F.entry.owned, F.ars.owned); });
test('back the way you came: E at the door does nothing in the climb; over the rim is the dash, back down stays the dash (Review Focus 4)', () => {
  const F = createFight(W, 5), B = W.base; stepFight(F, { ...idle, use: true }, 1 / 60); assert.deepEqual([F.area, F.lv.id], [5, 'surface']);
  assert.deepEqual([advanceArea(W, 5, B.x, B.z), advanceArea(W, 5, B.x + B.R * 1.01, B.z), advanceArea(W, 6, B.x, B.z)], [5, 6, 6]);
  const G = createFight(W, 6); put(G, B.x + B.R * .9, B.z); stepFight(G, idle, 1 / 60); assert.equal(G.area, 6); assert.deepEqual(wayTarget(W, 6, G.player), { x: W.escape.site.x, z: W.escape.site.z }); });
test('the arrow climbs the switchback to the rim, then points at the rescue site; none in the prison', () => {
  const K = W.crater.path, n = K.length, vx = i => ({ x: K[i][0], z: K[i][1] }); for (let i = n - 1; i > 1; i--) assert.deepEqual(wayTarget(W, 5, vx(i)), vx(i - 1), `${i}`);
  const t = wayTarget(W, 5, vx(1)); assert.deepEqual([t.x, t.z], [W.crater.top.x, W.crater.top.z]); assert.equal(wayTarget(W, 4, P.start), null); assert.ok(wayfind(createFight(W, 5))); });
```

`smoke.spec.mjs`:

```js
test('the lift to the climb: up outside the hangar door, the surface palette-true, the arrow showing (Plan 6)', async ({ page }) => {
  const errors = watchErrors(page); await start(page); await page.evaluate(() => window.ospTest.lift()); await expect.poll(() => area(page)).toBe('climb');
  await expect(page.locator('#way')).toBeVisible(); expect(await page.evaluate(() => window.ospTest.audio().air)).toBe(false);
  const s = await page.evaluate(() => window.ospTest.capture()); expect(s.inPalette).toBe(1); expect(s.colours).toBeGreaterThan(8); expect(errors).toEqual([]); });
```

- [ ] **Step 2: Run them to see them fail:** `node --test tests/escape.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement** as in Interfaces. Plan 5's area 1 arrow tests pass unchanged.

- [ ] **Step 4: Run the tests:** `npm test`, then `npm run test:smoke -- -g "climb|wayfinding|prison"`. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "sim: the exit lift, the climb (area 5) and the dash (area 6)" -m "Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7"
```

---

### Task 8: The dash: the rescue ship, its flare, its clock and the rush

**Files:**
- Modify: `src/game/{escape,lander,hold,fight,fightView,radio,script}.js`, `src/gfx/renderer.js`, `src/ui/hud.js`, `src/shell.html`, `src/main.js`
- Test: `tests/{escape,view,hold,radio}.test.mjs`, `tests/smoke.spec.mjs`

**Interfaces:**
- **`escape.js` [call]:** `SHIP`, `FLARE` and `RING`, their values pinned in the first three tests below.
  - **`SHIP`:** `alt` and `descent` are the opening's. `r` is the deck's collision radius, `reach` E's reach from the ladder foot, `hatch` the seconds from touchdown to the hatch opening, `puffs` the touchdown dust ring.
  - **`FLARE`:** `size` (m) and `ang` (rad) are its least size, so it shows at 400 m.
  - **Helpers:**
    - `shipLift(t) = t >= SHIP.descent ? 0 : SHIP.alt * (1 - t / SHIP.descent) ** 2`;
    - `ladderAt(S) = { x: S.at.x + 3.9 * S.at.dx, z: S.at.z + 3.9 * S.at.dz }` (`EGRESS[3]`);
    - `flareAt(S, back = 0)`: with `a = S.t - SHIP.descent - back`, null unless `0 <= a <= rise + fall`, else `{ x: S.at.x, z: S.at.z, y: S.at.y + up * (a < rise ? smooth(a / rise) : 1 - (a - rise) / fall) }`;
    - `ringPoints(rng, at)`: `RING.n` points at angle `(k + rng.next()) * 2 * Math.PI / n` and radius `rng.range(...RING.r)`.
- **`lander.js`:**
  - `createWreck(world, L = world.lander, ly = Math.atan2(world.spawn.dx, world.spawn.dz))`.
  - `pieceMatrix` adds `W.up` (default 0) to pieces 1–3 only: the ascent stage (cabin, hatch, dish).
- **`hold.js`:** `planWaves(rng, doors, waves = HOLD.waves)`.
- **`fight.js`:**
  - **`arrive(F, 6)`:** `F.ship = { t: 0, left: SHIP.clock, landed: false, calls: 0, at: site, W, ring: null }`, with `W = createWreck(world, site, Math.atan2(site.dx, site.dz))` and `W.lift = SHIP.alt`. Below 6, `F.ship = null`.
  - **`stepShip(F, dt)`**, after step 3 (living, area 6, `!F.won`):
    - `t += dt`, and `W.lift = shipLift(t)`.
    - **Touchdown:** `landed`, push `{ type: 'flare' }`, and `SHIP.puffs` `'puff'` particles from `F.rng` in a ring r 2.2: v 9–14 outward, up 1–2.5, life 3, s .35–.7. These are `FX.puff`'s values, inlined because `fight.js` can't import `opening.js`.
    - `W.hatch = clamp01((t - SHIP.descent - SHIP.hatch) / .8)`.
    - **The clock:** `left -= dt`; each `calls` mark crossed pushes `{ type: 'clock', n: ++calls }`.
    - **Missed:** at `left <= 0`, `F.state = 'dead'; F.deadT = 0;` and push `{ type: 'missed' }`, with no `'dead'` cue.
    - **The rush:** once landed, within `RING.near` and with no ring yet:
      - `ring = { t: 0, plan: planWaves(F.rng, RING.n, RING.waves), next: 0, enc, pts: ringPoints(F.rng, at) }`, with `enc` alerted at the site in area 6;
      - push `{ type: 'rush' }`.
    - **Shared spawning:** the hold's spawn loop becomes `spawnWaves(F, H, pts, id0, area, hover)` for both, capped at `HOLD.cap`. Ring floaters fly at ground + `RING.hover`.
  - **`bodies()`:** pushes you out of `(at.x, at.z)` by `SHIP.r + PLAYER.radius` while `F.ship`.
- **`fightView.js`**, while `F.ship`:
  - the 11 pieces of `F.ship.W`, **never culled at `FAR`**;
  - before touchdown, a light at the bell (`FX.glow.plume`'s colour, s 9);
  - with `flareAt(S)`: a glow sprite in `FLARE.col`, size `max(FLARE.size, d * FLARE.ang)`;
  - the smoke trail: for k 1..`trail`, an opaque `(.18, .18, .17)` sprite at `flareAt(S, k * gap)`, size .4 + .15k.
- **Radio:**
  - `radio.js`: `PLAIN` += `flare`, `rush`, `missed`; `'clock'` cues `radioCue(R, 'countdown', e.n)`.
  - `script.js`: `WHO.P = 'PILOT'`, `VOICE.P = [.8, 1.1]`, and 10 lines:
    - `flare: { seq: 1 }`: `["H|Pilot's down. He's put up a flare. Follow the flare.", "P|Rescue One on the ground. I don't love it here."]`
    - `countdown: { at: 1 }`: `["H|Pilot says three minutes.", "H|Pilot says two minutes. He's tapping the glass.", "P|One minute. I'm not kidding.", "H|Pilot says he's serious this time."]`
    - `rush: { seq: 1 }`: `["P|Contacts! Lots of contacts, coming over the ridge!", "H|Run. Just run.", "P|I'm not waiting forever, buddy."]`
    - `missed: { crit: 1 }`: `["H|They'll come round again. Be at the ship this time."]`
- **`renderer.js`:** `capture()` gains `hot`, the count of pixels with `r >= 140 && r - max(g, b) >= 60`.
- **HUD [call]:**
  - Markup and CSS:
    - `<div id="clk"></div>` after `#way`;
    - `#clk{position:fixed;left:50%;top:50px;transform:translateX(-50%);display:none}`, `#clk.on{display:block}`, `#clk.low{color:#b8301a}`, `.paused #clk{visibility:hidden}`;
    - `#clk` joins the pointer-events list; `#flash` moves from 56 to 76 px.
  - `hud.clock(s)`: null hides it; otherwise ``SHIP LEAVES ${fmtTime(Math.ceil(s))}``, with class `low` under `SHIP.warn`, written on change. `#clk` joins `MODES.play` and `fatal`.
- **`main.js`:**
  - `hud.clock(F.ship && F.state === 'play' && !F.ko ? F.ship.left : null)`.
  - When `F.ship?.left <= 0`, the dead prompt reads `'The ship left without you. Back to the crater rim...'`.
  - New hooks:
    - `ospTest.ship()`: `{ landed, left, site: { x, z } }`;
    - `calm()`: empties `F.aliens`;
    - `turn(yaw, pitch)`.

- [ ] **Step 1: Write the failing tests**

In `escape.test.mjs`, import `SHIP`, `FLARE`, `RING`, `shipLift`, `flareAt`, `HOLD`, `planWaves`, `OPEN` (opening.js), `PLAYER`, `makeRng` and `COST`, then add:

```js
test('the ship comes down on the opening\'s curve, lands, fires its flare 150 m up, opens its hatch', () => {
  assert.deepEqual(SHIP, { clock: 240, warn: 30, calls: [180, 120, 60, 30], r: 2, reach: 1.6, alt: 24, descent: 9, hatch: 1, puffs: 40 }); assert.deepEqual([SHIP.alt, SHIP.descent], [OPEN.alt, OPEN.descent]);
  assert.deepEqual(FLARE, { up: 150, rise: 3, fall: 40, size: .6, ang: .01, trail: 10, gap: .5, col: [2.4, .3, .08] });
  const F = createFight(W, 6), S = F.ship, st = W.escape.site; F.aliens.length = 0; assert.deepEqual([S.landed, S.left, S.W.lift], [false, SHIP.clock, SHIP.alt]); assert.equal(shipLift(SHIP.descent / 2), SHIP.alt / 4);
  run(F, idle, SHIP.descent - .05); assert.ok(!S.landed && S.W.lift > 0 && flareAt(S) === null);
  run(F, idle, .1); assert.ok(S.landed && S.W.lift === 0 && F.events.some(e => e.type === 'flare') && F.parts.some(q => q.kind === 'puff'));
  run(F, idle, FLARE.rise); const f = flareAt(S); assert.ok(Math.abs(f.y - st.y - FLARE.up) < .5 && f.x === st.x && f.z === st.z);
  run(F, idle, FLARE.fall); assert.equal(flareAt(S), null); assert.equal(S.W.hatch, 1); });
test('the ship clock calls its marks; at 0 the ship leaves and the dash restarts at the rim, ship and clock fresh', () => {
  const F = createFight(W, 6), ev = []; F.aliens.length = 0; let t = 0;
  while (F.state === 'play' && t < SHIP.clock + 1) { stepFight(F, idle, .1); t += .1; for (const e of F.events) if (e.type === 'clock' || e.type === 'missed') ev.push(e.n ?? e.type); F.events.length = 0; }
  assert.ok(Math.abs(t - SHIP.clock) < .11, `${t}`); assert.deepEqual(ev, [1, 2, 3, 4, 'missed']); run(F, idle, DEATH_TIME + .1);
  assert.deepEqual([F.state, F.area, F.ship.landed], ['play', 6, false]); assert.ok(F.ship.left > SHIP.clock - .2 && near(F.player, areaStart(W, 6))); });
test('the rush: once landed and near, waves from RING.n points 30-40 m round the ship, ids from RING.id, at most HOLD.cap alive', () => {
  assert.deepEqual(RING, { near: 60, r: [30, 40], n: 6, id: 2000, hover: 3.5, waves: [[0, 4], [5, 5], [10, 6], [15, 6]] });
  const P0 = planWaves(makeRng('r'), RING.n, RING.waves); RING.waves.forEach(([, b], w) => assert.equal(P0.filter(q => q.wave === w).reduce((s, q) => s + COST[q.type], 0), b));
  const F = createFight(W, 6), st = W.escape.site; F.aliens.length = 0; F.god = true; put(F, st.x + RING.near - 5, st.z); run(F, idle, 1); assert.equal(F.ship.ring, null);
  run(F, idle, SHIP.descent); assert.ok(F.ship.ring && F.events.some(e => e.type === 'rush')); assert.equal(F.ship.ring.pts.length, RING.n);
  for (const q of F.ship.ring.pts) { const d = Math.hypot(q.x - st.x, q.z - st.z); assert.ok(d >= RING.r[0] - 1e-9 && d <= RING.r[1] + 1e-9); }
  for (let i = 0; i < 600; i++) { stepFight(F, idle, 1 / 30); const R = F.aliens.filter(a => a.id >= RING.id && a.state !== 'dead'); assert.ok(R.length <= HOLD.cap && R.every(a => a.area === 6 && a.enc.alerted)); }
  assert.ok(F.aliens.some(a => a.id >= RING.id)); });
test('the landed ship is solid: you are pushed off its deck', () => {
  const F = createFight(W, 6), st = W.escape.site; F.aliens.length = 0; run(F, idle, SHIP.descent + .1); put(F, st.x + .5, st.z); stepFight(F, idle, 1 / 60);
  assert.ok(Math.hypot(F.player.x - st.x, F.player.z - st.z) >= SHIP.r + PLAYER.radius - 1e-6); });
```

In `view.test.mjs` (import `flareAt`, `FLARE`, `SHIP`):

```js
test('the ship is drawn at any distance; its flare is one glow sprite at least FLARE.size (Plan 6)', () => {
  const F = createFight(W, 6), fr = frame(), S = F.ship; F.aliens.length = 0; fillFrame(V, F, fr, 0);
  assert.ok(Math.hypot(F.player.x - S.at.x, F.player.z - S.at.z) > 300); assert.equal(fr.meshes.filter(m => V.pieces.includes(m.gpu)).length, 11);
  S.t = SHIP.descent + FLARE.rise; S.landed = true; fillFrame(V, F, fr, 0); const f = flareAt(S), D = fr.sprites.data; let glow = 0;
  for (let i = fr.sprites.nOpaque; i < fr.sprites.nOpaque + fr.sprites.nGlow; i++) if (Math.hypot(D[i * 8] - f.x, D[i * 8 + 1] - f.y, D[i * 8 + 2] - f.z) < 1e-3 && D[i * 8 + 3] >= FLARE.size) glow++;
  assert.equal(glow, 1); });
```

The other unit tests:
- **`hold.test.mjs`, the `planWaves` test:** add `assert.deepEqual(planWaves(makeRng('w'), 3), planWaves(makeRng('w'), 3, HOLD.waves));`.
- **`radio.test.mjs`, the script test:**
  - The speaker regex becomes `/^[HYSP]\|.{2,90}$/`, and `WHO`'s keys `['H', 'P', 'S', 'Y']`.
  - Add `assert.deepEqual([SCRIPT.flare[0], SCRIPT.countdown[0], SCRIPT.countdown[3], SCRIPT.missed[0]], ["H|Pilot's down. He's put up a flare. Follow the flare.", 'H|Pilot says three minutes.', "H|Pilot says he's serious this time.", "H|They'll come round again. Be at the ship this time."]);`.

`smoke.spec.mjs` (import `SHIP`, `FLARE`): add `'clk'` to the M7 id list, and:

```js
const twoFrames = async page => { const f = await page.evaluate(() => window.ospTest.frames()); await expect.poll(() => page.evaluate(() => window.ospTest.frames())).toBeGreaterThan(f + 1); };
test('from the rim the ship lands out of sight, but its red flare climbs above the horizon (Plan 6, spec 6)', async ({ page }) => {
  const errors = watchErrors(page), cap = () => page.evaluate(() => window.ospTest.capture()); await start(page);
  await page.evaluate(() => { const o = window.ospTest; o.god(true); o.dash(); o.calm(); }); await expect.poll(() => area(page)).toBe('dash');
  await page.evaluate(() => { const o = window.ospTest, s = o.ship().site, p = o.player(); o.turn(Math.atan2(p.x - s.x, p.z - s.z), .05); });
  await twoFrames(page); const a = await cap(); await page.evaluate(s => window.ospTest.ff(s), SHIP.descent + FLARE.rise + 1); await twoFrames(page); const b = await cap();
  expect(b.hot).toBeGreaterThan(a.hot); expect(b.inPalette).toBe(1); expect(errors).toEqual([]); });
test('the dash shows SHIP LEAVES m:ss under the arrow, red under SHIP.warn s (Plan 6)', async ({ page }) => {
  const errors = watchErrors(page), clk = page.locator('#clk'); await start(page); await page.evaluate(() => { const o = window.ospTest; o.god(true); o.dash(); o.calm(); });
  await expect(clk).toHaveText(/^SHIP LEAVES [34]:\d\d$/); await expect(clk).not.toHaveClass(/low/); await page.evaluate(s => window.ospTest.ff(s), SHIP.clock - SHIP.warn + 1);
  await expect(clk).toHaveClass(/low/); await expect(clk).toHaveText(/^SHIP LEAVES 0:\d\d$/); expect(errors).toEqual([]); });
```

- [ ] **Step 2: Run them to see them fail:** `node --test tests/escape.test.mjs tests/view.test.mjs tests/hold.test.mjs tests/radio.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement** as in Interfaces; `opening.js` keeps `createWreck(world)`.

- [ ] **Step 4: Run the tests:** `npm test`, then `npm run test:smoke -- -g "flare|SHIP LEAVES|capture click|wayfinding"`. Expected: all pass. If `b.hot` doesn't rise, measure the frame where the flare should be first. A flare truly below the horizon contradicts the spec's builder check, so report BLOCKED with the numbers; don't retune.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "dash: the rescue ship, its flare, SHIP LEAVES and the rush" -m "Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7"
```

---

### Task 9: Boarding and the lift-off

**Files:**
- Create: `src/game/liftoff.js`
- Modify: `src/game/{escape,fight,radio,script}.js`, `src/audio/sfx.js`, `src/main.js`, `tests/{escape,lander,purity}.test.mjs`, `tests/smoke.spec.mjs`

**Interfaces:**
- **`LIFT` [call]** (pinned in the first test below): the ascent's climb (m/s²), the seconds from boarding to the sting, and the fade (s) after the end gate.
- **`fight.js`:**
  - `export const atLadder = F => F.area === 6 && F.state === 'play' && F.ship?.landed && !F.won && dist(player, ladderAt(F.ship)) <= SHIP.reach`.
  - Step 2, before the ship's clock: `if (input.use && atLadder(F)) { F.won = true; F.wonAt = F.run; F.events.push({ type: 'board' }); }`.
- **`liftoff.js`** (pure):
  - `createLiftoff(F) => L = { t: 0, sting: false, events: [], view }`:
    - `F.player` goes to the ship's lander-space `EGRESS[0]`, with yaw toward the ship's +z and pitch −.3.
    - `view = { player: F.player, state: 'play', deadT: 0, ars: { cur: -1 }, shotT: 9, hurtT: 0, lv: F.lv, flag: F.flag, ship: F.ship, aliens: the live ones, bolts: [], parts: [], booms: [], decals: [], pickups: [], canisters: [], balls: [], glow: [engine], eye: EGRESS[0][3], flash: 0 }`.
  - `stepLiftoff(L, dt)`:
    - `t += dt`; `F.ship.W.up = LIFT.acc * t * t / 2`; you ride at cabin height + `up`, over the engine glow (`FX.glow.plume`'s colour).
    - Each live alien gets `yaw = atan2(at.x - a.x, at.z - a.z)` and `wave = waveAt((t + .37 * a.id) % WAVE_TIME)`.
    - Crossing `LIFT.sting` pushes `{ type: 'sfx', key: 'click' }` and `{ type: 'radio', key: 'sting' }`, and sets `sting`.
- **Radio and sound:**
  - `radio.js`: `PLAIN.board = 'board'`.
  - `script.js`: `board: { seq: 1 }`: `["P|Welcome aboard. Strap in. Don't touch anything."]`; `sting: { seq: 1 }`: `["Y|Houston\u2026 we have one more small problem."]` (spec verbatim).
  - `sfx.js`: `SFX.click = [.3, 0, 1800, 0, .01, .02, 1, 1, 0, 0, 0, 0, .12, 0, 0, 0, .06]` **[call]**.
- **`main.js`:**
  - **States:** `… 'play' -> 'liftoff' -> 'end' …`; `pausable` adds `'liftoff'`. The prompt shows `atLadder(F) ? '[E] board'` (spec §6).
  - **On `'board'`:** `state = 'liftoff'; run.L = createLiftoff(F); run.fade = null; hud.mode('none'); hud.prompt('');`.
  - **In `'liftoff'`:**
    - step `stepLiftoff` in sub-steps, handling its `sfx`/`radio` events like the opening's;
    - step the radio as in play;
    - once `run.L.sting && run.fade === null && endingOver(run.L.t - LIFT.sting, R)`, set `run.fade = 0`; then `run.fade += dt`, and at `LIFT.fade`, `finish()`.
  - **The frame:** exposure is multiplied by `run.fade === null ? 1 : max(0, 1 - run.fade / LIFT.fade)`; `fillFrame` draws `run.L.view`. You can look but not move.
  - **The end:** `finish()` takes `'play'` or `'liftoff'` and clears `run.L`. `music()` in `'liftoff'` is `run.L.sting ? null : MUSIC[6]`.
  - **Hooks:** `ospTest.board()` puts you at `ladderAt` and steps one E; `clock()` adds `liftoff: run.L?.t ?? null`.

- [ ] **Step 1: Write the failing tests**

- **`purity.test.mjs`:** add `'liftoff'` to `SIM`.
- **`lander.test.mjs`** (import `pieceMatrix`):

```js
test('the ascent stage rises by W.up: the cabin, hatch and dish only (Plan 6)', () => { const A = createWreck(W, { x: 0, y: 0, z: 0 }, 0), o = new Float32Array(16); A.up = 5;
  PIECES.forEach((_, k) => assert.equal(pieceMatrix(A, k, o)[13], A.pieces[k].y + (k >= 1 && k <= 3 ? 5 : 0), `${k}`)); });
```

- **`escape.test.mjs`** (import `LIFT`, `ladderAt`, `atLadder`, `createLiftoff`, `stepLiftoff`, `createAlien`, and `EGRESS` from opening.js):

```js
const landed = () => { const F = createFight(W, 6); F.aliens.length = 0; run(F, idle, SHIP.descent + .1); F.events.length = 0; return F; };
test('R9 moved: E at the landed ship\'s ladder boards it; the run clock stops for good, nothing hurts; not before, not from afar', () => {
  assert.deepEqual(LIFT, { acc: 2, sting: 6, fade: .8 }); const E = createFight(W, 6), l0 = ladderAt(E.ship); E.aliens.length = 0; put(E, l0.x, l0.z);
  stepFight(E, { ...idle, use: true }, 1 / 60); assert.equal(E.won, false, 'not before touchdown');
  const F = landed(), l = ladderAt(F.ship); put(F, l.x + SHIP.reach + .5, l.z); assert.equal(atLadder(F), false); put(F, l.x, l.z); assert.ok(atLadder(F));
  stepFight(F, { ...idle, use: true }, 1 / 60); assert.deepEqual([F.won, F.wonAt], [true, F.run]); assert.ok(F.events.some(e => e.type === 'board'));
  const r = F.run, hp = F.hp; run(F, idle, 2); hurtPlayer(F, 500, 0, 0, 0); assert.deepEqual([F.run, F.hp, F.state], [r, hp, 'play']); });
test('E at the ladder in the clock\'s last step boards (Review Focus 3)', () => {
  const F = landed(), l = ladderAt(F.ship); put(F, l.x, l.z); F.ship.left = 1 / 120; stepFight(F, { ...idle, use: true }, 1 / 60);
  assert.deepEqual([F.won, F.state], [true, 'play']); assert.ok(!F.events.some(e => e.type === 'missed')); });
test('the lift-off: the ascent stage rises with you, the aliens turn and wave, the sting at LIFT.sting s, once', () => {
  const F = landed(), st = W.escape.site, l = ladderAt(F.ship), a = createAlien({ type: 'sk', x: st.x + 20, y: F.lv.ground(st.x + 20, st.z), z: st.z }, 2500, F.encs[0]);
  a.area = 6; F.aliens.push(a); put(F, l.x, l.z); stepFight(F, { ...idle, use: true }, 1 / 60); const L = createLiftoff(F), y0 = F.player.y, ev = []; let waved = 0;
  assert.equal(L.view.eye, EGRESS[0][3]); assert.ok(L.view.aliens.includes(a));
  for (let t = 0; t < LIFT.sting + 1; t += 1 / 30) { stepLiftoff(L, 1 / 30); ev.push(...L.events.map(e => e.key)); L.events.length = 0; waved = Math.max(waved, a.wave); }
  assert.ok(Math.abs(F.ship.W.up - LIFT.acc * L.t * L.t / 2) < 1e-9 && F.player.y - y0 > 10); assert.deepEqual(ev, ['click', 'sting']); assert.ok(L.sting && waved > .9);
  assert.ok(Math.abs(Math.atan2(st.x - a.x, st.z - a.z) - a.yaw) < 1e-9); });
```

- **`smoke.spec.mjs`** (import `LIFT`, `ENDING`):

```js
const toLiftoff = async page => { await page.evaluate(() => { const o = window.ospTest; o.god(true); o.dash(); o.calm(); }); await expect.poll(() => area(page)).toBe('dash');
  await page.evaluate(s => window.ospTest.ff(s), SHIP.descent + .5); await page.evaluate(() => window.ospTest.board()); await expect.poll(() => state(page)).toBe('liftoff'); };
// R18 moved: the end gate runs from the sting. 1/30 s steps through the lift-off, cueing the switchboard intro `holds` times at the sting.
const throughLift = (page, holds = 0) => page.evaluate(([n, sting]) => { const o = window.ospTest, sub = () => document.getElementById('sub').textContent, s = []; let cued = false;
  for (let i = 0; i < 3000 && o.state() === 'liftoff'; i++) { const c = o.clock().liftoff;
    if (c >= sting) { if (!cued) { cued = true; for (let k = 0; k < n; k++) o.cue('hold'); } const r = o.radio(); s.push({ t: c - sting, idle: !r.line && !r.queued.length, line: r.line, sub: sub() }); }
    o.ff(1 / 30); }
  return { s, T: s.at(-1).t + 1 / 30, state: o.state(), sub: sub() }; }, [holds, LIFT.sting]);
test('R9 moved: boarding, the lift-off, then the end screen with the time at boarding (Plan 6)', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await toLiftoff(page); const f = await fight(page); expect(f.won).toBe(true);
  await expect(page.locator('#end')).toBeVisible({ timeout: 30_000 }); await expect(page.locator('#stats')).toContainText('TIME ' + fmtTime(f.wonAt)); expect(errors).toEqual([]); });
test('R18 moved: the end screen comes ENDING.min s after the sting once the radio is idle, then the fade', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await toLiftoff(page); const r = await throughLift(page), idle = r.s.find(x => x.idle)?.t ?? r.T;
  expect(r.s.some(x => x.sub.includes('one more small problem'))).toBe(true); expect(r.T).toBeGreaterThanOrEqual(ENDING.min + LIFT.fade - 1e-6);
  expect(r.T).toBeLessThanOrEqual(Math.max(ENDING.min, idle) + LIFT.fade + 2 / 30 + 1e-6); expect([r.state, r.sub]).toEqual(['end', '']); expect(errors).toEqual([]); });
test('R18 moved: at ENDING.max after the sting the fade starts whatever is on the air', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await toLiftoff(page); const r = await throughLift(page, 3), last = r.s.at(-1);
  expect(Math.abs(r.T - ENDING.max - LIFT.fade)).toBeLessThanOrEqual(2 / 30); expect(last.line).not.toBe(null); expect([r.state, r.sub]).toEqual(['end', '']); expect(errors).toEqual([]); });
```

- [ ] **Step 2: Run them to see them fail:** `node --test tests/escape.test.mjs tests/lander.test.mjs tests/purity.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement** as in Interfaces. Update `main.js`'s header for the new states.

- [ ] **Step 4: Run the tests:** `npm test`, then `npm run test:smoke -- -g "boarding|R18|pause"`. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "end: boarding, the lift-off from the cabin and the stowaway sting" -m "Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7"
```

---

### Task 10: The knock-out goes live: the wake, the stamp, two-level score

**Files:**
- Modify: `src/game/{escape,fight,fightView,radio,script}.js`, `src/ui/{hud,score}.js`, `src/main.js`
- Test: `tests/{escape,view,replay,checkpoints,score,radio}.test.mjs`, `tests/smoke.spec.mjs`

**Interfaces:**
- **`knockOut(F)`** (still only from `'call'`): push `{ type: 'ko' }`; `strip(F); F.hold = null; enterArea(F, 4);` (so the cell's checkpoint is the stripped kit); then `F.ko = { phase: 'out', t: 0 }; F.player.pitch = KO.pitch; F.eye = KO.eye;`.
- **`stepFight`**, after the clocks: `if (F.ko && (F.ko.phase === 'out' || F.ko.phase === 'down')) { wake(F, dt); return; }`. The phases:
  - **`'out'`:** `t += dt`. Crossing `KO.stamp` pushes `{ type: 'stamp', text: KO.text }`. At `KO.out` → `{ phase: 'down', t: 0 }`, and push `{ type: 'wake' }`.
  - **`'down'`:** `stepPlayer` with no input, `p.pitch = KO.pitch * (1 - t / KO.down)`, `F.eye = KO.eye`. At `KO.down` → `{ phase: 'up', t: 0 }`.
  - **`'up'`:** the normal step (you can move). After step 11, `t += dt` and `F.eye = KO.eye + (PLAYER.eye - KO.eye) * min(1, t / KO.getUp)`. At `KO.getUp`: `F.ko = null; F.eye = undefined;` and push `{ type: 'woke', text: AREA_TEXT[4] }`.
- **`GOLF_TOTAL = 7`** **[call]**, here because runs are now two levels long.
- **`escape.js` helpers:**
  - `koLight(F)`: 1, except 0 in `'out'` and `min(1, t / KO.fade)` in `'down'`;
  - `koLock(F)`: `!!F.ko && (phase 'out' || 'down')`;
  - `wakeIn(F)`: 0..1 across `'down'` + `'up'`.
- **`vignette`:** in `'down'`/`'up'`, `K[0] = VIG.dead * (1 - wakeIn(F))`, `K[2] = VIG.deadReach` ("the Plan 5 vignette closed in", with no blur).
- **The wake lines:**
  - `radio.js`: `PLAIN.wake = 'wake'`.
  - `script.js`: `wake: { seq: 1 }`: `["H|\u2026come in. Come in. You were out for two hours.", "Y|They took my guns.", "H|Did they take the flag? \u2026They left the flag. They think it's a religious item."]` (spec verbatim).
- **`hud.stamp(text = 'ONE SMALL PROBLEM')`** sets `#stamp`'s text.
- **`score.js`:** bests are keyed `'osp.best2.' + seed`, so a one-level best never beats a two-level run.
- **`main.js`:**
  - `'ko'` no longer calls `finish()`: it plays `thud`, cancels speech, runs `radioDo(R, silence(R))` and sets `hud.mode('none')`.
  - `'stamp'` calls `hud.stamp(ev.text)`; `'woke'` calls `hud.mode('play')` and joins `FLASH`.
  - Flashes are skipped while `F.ko`.
  - Exposure is `koLight(run.F)` times the lift-off fade.
  - Mouse look is skipped while `run.O?.lock || koLock(run.F)`.

- [ ] **Step 1: Write the failing tests**

`escape.test.mjs` (import `knockOut`, `koLight`, `koLock`, `wakeIn`):

```js
const calling = () => { const F = createFight(W, 3); F.aliens.length = 0; F.ko = { phase: 'call', t: 0 }; return F; };
const through = (F, dt) => { const ev = [], at = {}, p = F.player, x = p.x, z = p.z; let t = 0, moved = 0;
  while (F.ko && t < 20) { stepFight(F, { ...idle, fwd: 1 }, dt); t += dt; for (const e of F.events) if (['stamp', 'wake', 'woke'].includes(e.type)) { ev.push(e.type); at[e.type] = t; }
    F.events.length = 0; if (F.ko && F.ko.phase !== 'up') moved = Math.max(moved, Math.hypot(p.x - x, p.z - z)); } return { ev, at, moved }; };
test('the knock-out: stripped into the shut cell; black, the stamp, the wake on the floor, look locked, up, THE CELLS', () => {
  const F = calling(); give(F.ars, 1, 80); F.hp = 33; assert.ok(knockOut(F)); const r0 = F.run;
  assert.deepEqual([F.area, F.lv.id, F.ko.phase, F.hp, F.ars.owned, F.ars.cells, F.flag.held, F.cell.shut, F.hold], [4, 'prison', 'out', KO.hp, [true, false, false], 0, true, true, null]);
  assert.deepEqual([F.entry.owned, F.entry.cells, koLight(F), koLock(F), F.eye], [[true, false, false], 0, 0, true, KO.eye]);
  const { ev, at, moved } = through(F, 1 / 30); assert.deepEqual(ev, ['stamp', 'wake', 'woke']); assert.equal(moved, 0, 'still on the floor');
  assert.ok(Math.abs(at.stamp - KO.stamp) < .04 && Math.abs(at.wake - KO.out) < .04 && Math.abs(at.woke - KO.out - KO.down - KO.getUp) < .08, JSON.stringify(at));
  assert.deepEqual([F.ko, F.eye, koLight(F), koLock(F), wakeIn(F)], [null, undefined, 1, false, 0]); assert.ok(F.run - r0 < .04, 'the run clock stopped'); });
test('a slow frame across the knock-out: each event once, in order (Review Focus 5)', () => { const F = calling(); knockOut(F); assert.deepEqual(through(F, .25).ev, ['stamp', 'wake', 'woke']); });
```

The other unit tests:
- **`view.test.mjs`, the vignette test:** `F.ko = { phase: 'down', t: 0 }; fillFrame(V, F, fr, 0); assert.deepEqual([fr.tint[0], fr.tint[2]], [VIG.dead, VIG.deadReach]); F.ko = null;`.
- **`checkpoints.test.mjs`:** `GOLF_TOTAL` 5 → 7.
- **`score.test.mjs`:** `'osp.best.'` → `'osp.best2.'` throughout.
- **`radio.test.mjs`:** add `assert.deepEqual(SCRIPT.wake, ['H|\u2026come in. Come in. You were out for two hours.', 'Y|They took my guns.', "H|Did they take the flag? \u2026They left the flag. They think it's a religious item."]);` and `assert.equal(keyOf([{ type: 'wake' }], { ko: { phase: 'down' } }), 'wake,wake,wake');`.

`replay.test.mjs` (import `HOLD`, `callSpot`, `setScene`):

```js
const IDLE = { fwd: 0, strafe: 0, run: false, jump: false, fire: false, use: false, weapon: -1, wheel: 0 };
// Plan 6: on hold with the waves cleared, Houston 1 s in, KO.call later the knock-out and the wake; in the cell walk at the bars
// pressing E every 40 frames, then swing at the guard. The view swaps to the prison's scene on the level event.
function playKo(view) {
  const F = createFight(W, 3), p = F.player, r = makeRng('replay-ko'), out = { kos: 0, kills: 0, snaps: [] }, s = callSpot(W.baseMap), b = W.prisonMap.bars;
  Object.assign(p, { x: s.x, z: s.z, y: F.lv.ground(s.x, s.z) }); stepFight(F, { ...IDLE, use: true }, 1 / 60); F.hold.plan.length = 0; F.hold.t = HOLD.time - 1; F.god = true;
  let V = null, frame = null, t = 0; if (view) { const gl = fakeGL(), sc = buildBaseScene(gl, W.baseMap); V = createFightView(gl, sc); frame = { ...sc, exposure: 1 }; }
  const snap = () => JSON.stringify([F.time, F.run, F.area, F.ko, F.cell, F.hp, F.kills, p, F.ars, F.bolts, F.parts, F.pickups, F.aliens.map(a => ({ ...a, enc: F.encs.indexOf(a.enc) })), F.rng.next()]);
  for (let i = 0; i < 2000; i++) {
    const el = r.range(1 / 144, 1 / 18), dt = Math.min(.25, el), n = Math.max(1, Math.ceil(dt / .05)), g = F.aliens.find(a => a.enc.guard && a.state !== 'dead'), cell = F.area === 4 && !F.ko;
    if (cell) p.yaw = g ? Math.atan2(p.x - g.x, p.z - g.z) : Math.atan2(p.x - b.x, p.z - b.z);
    const inp = { ...IDLE, fwd: cell ? 1 : 0, use: i % 40 === 0, fire: !!g && i % 3 === 0 };
    for (let k = 0; k < n; k++) stepFight(F, k ? { ...inp, use: false } : inp, dt / n);
    for (const e of F.events) { if (e.type === 'ko') out.kos++; if (e.type === 'kill') out.kills++; if (view && e.type === 'area' && e.level) setScene(V, buildBaseScene(fakeGL(), W.prisonMap)); }
    F.events.length = 0; t += el; if (view) fillFrame(V, F, frame, t); if (i === 1000 || i === 1999) out.snaps.push(snap()); }
  out.F = F; return out; }
test('a run through the knock-out into the cell, the bang and the guard replays bit for bit, with or without the view (Plan 6)', () => {
  const a = playKo(false), b = playKo(true); assert.equal(a.kos, 1); assert.deepEqual([a.F.area, a.F.ko], [4, null]); assert.ok(a.F.cell.bang !== null, 'banged');
  assert.equal(a.snaps[0], b.snaps[0]); assert.equal(a.snaps[1], b.snaps[1]); assert.equal(a.kills, b.kills); });
```

`smoke.spec.mjs`:
- The two `throughCall` tests expect `['play', '', 'out']`, and add `expect(await area(page)).toBe('prison');`.
- "the comms array…" is replaced by the first test below.
- "two whole games": after `ff(91)`, add `await expect.poll(() => area(page), { timeout: 40_000 }).toBe('prison'); await page.evaluate(s => window.ospTest.ff(s), KO.out + KO.down + KO.getUp + 1); await toLiftoff(page);`, then wait for `#end` (`40_000`), with `test.setTimeout(240_000)`.
- Add:

```js
test('R9 moved: the knock-out: black, ANOTHER SMALL PROBLEM, the wake in the cell, THE CELLS; the clock froze through it', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await toComms(page); await onHold(page); await throughCall(page); const f0 = await fight(page);
  await page.evaluate(s => window.ospTest.ff(s), KO.stamp + .1); await expect(page.locator('#stamp')).toHaveText(KO.text); await expect(page.locator('#stamp')).toBeVisible();
  await twoFrames(page); expect((await page.evaluate(() => window.ospTest.capture())).black).toBeGreaterThan(.95);
  await page.evaluate(s => window.ospTest.ff(s), KO.out - KO.stamp + .1); expect((await fight(page)).ko).toBe('down');
  await page.evaluate(s => window.ospTest.ff(s), KO.down + KO.getUp + .2); const f = await fight(page); expect([f.ko, f.area]).toEqual([null, 'prison']);
  expect(f.run - f0.run).toBeLessThan(.5); await expect(page.locator('#flash')).toContainText('THE CELLS'); expect(errors).toEqual([]); });
test('pausing in the black or the wake freezes the knock-out (Review Focus 1)', async ({ page }) => {
  await noVoices(page); await start(page); await toComms(page); await onHold(page); await throughCall(page);
  for (const s of [KO.stamp, KO.out - KO.stamp + .5]) { await page.evaluate(x => window.ospTest.ff(x), s); await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(true);
    const c = (await clock(page)).ko; await page.waitForTimeout(600); expect((await clock(page)).ko).toBe(c); await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(false); }
  expect((await fight(page)).area).toBe('prison'); });
```

- [ ] **Step 2: Run them to see them fail:** `node --test tests/escape.test.mjs tests/view.test.mjs tests/replay.test.mjs tests/checkpoints.test.mjs tests/score.test.mjs tests/radio.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement** as in Interfaces.

- [ ] **Step 4: Run the tests:** `npm test`, then `npm run test:smoke`. Expected: the whole smoke suite passes in both browsers.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "sim: the knock-out goes live: black, the stamp, the wake; GOLF_TOTAL 7; osp.best2" -m "Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7"
```

---

### Task 11: Radio flavour, the Pilot's voice and two songs

**Files:**
- Modify: `src/game/{escape,fight,radio,script}.js`, `src/audio/{speech,music}.js`, `src/main.js`
- Test: `tests/{escape,radio,speech,music}.test.mjs`, `tests/smoke.spec.mjs`

**Interfaces:**
- **`SIGHTS` [call]** (m; pinned in the test below).
- **`fight.js`:** `F.seen = {}` (lifetime). For the living in area 4 with `!F.ko`, the first time you are within `SIGHTS[k]` of the prison's `k` prop, set `F.seen[k]` and push `{ type: k === 'exit' ? 'hall' : k }`.
- **`radio.js`:** `PLAIN` gains `cow`, `chair` and `hall`; `'golf'` cues `e.id === 5 ? radioCue(R, 'evidence') : radioCue(R, 'golf', e.n)`.
- **`script.js`** (9 lines, 196 in all):
  - `cow: { seq: 1 }`: `["Y|Is that a cow?", "H|That would explain a lot of reports from Nebraska."]` (spec verbatim)
  - `chair: { seq: 1 }`: `["H|Do not sit in the chair.", "Y|I wasn't going to sit in the chair."]`
  - `evidence: { once: 1 }`: `["H|Evidence item one: a golf ball. They're building a case against Shepard."]`
  - `hall: { seq: 1 }`: `["S|ATTENTION. THE LIFT IS FOR STAFF ONLY.", "H|That's a lift. Up is good. Up is where we are."]`
  - `golf[4]` becomes `"H|Five. Flight has started a spreadsheet."`, and `golf` gains `"H|Six. They really were collecting them."` and `"H|That's all seven. Shepard always said his slice was out of this world."`.
- **`speech.js`:** `castVoices(all) => { H, Y, S, P }`; `P` is the list's first voice other than H, Y and S, else S. `VOICE.P` always applies.
- **`music.js`:** `SONGS` gains prison (slow and tense: a semitone rub over a G drone, 25.3 s) and escape (driving, 16 s):

  ```js
  prison: { bpm: 76, tracks: [
    ['drone', 31, .45, '00000000', ['a---------------']],
    ['bass', 31, .35, '00110011', ['a.......a...b...', 'a.......a.a.f...']],
    ['pad', 50, .18, '01010101', ['a---------------', 'b---------------']],
    ['bell', 74, .14, '01020103', ['a.......g.......', '........f...a...', 'a.......h.......', 'g...f...a-------']],
    ['hat', 0, .06, '00000000', ['a.......a.......']]] },
  escape: { bpm: 120, tracks: [
    ['kick', 0, .7, '00000001', ['a...a...a...a...', 'a...a...a.a.a.aa']],
    ['snare', 0, .35, '00000001', ['....a.......a...', '....a.......a.aa']],
    ['hat', 0, .14, '00000000', ['a.aaa.aaa.aaa.aa']],
    ['bass', 33, .5, '00110022', ['a.aa.aa.a.aa.ama', 'f.ff.ff.f.ff.fhf', 'h.hh.hh.h.hh.hjh']],
    ['lead', 69, .14, '01020301', ['a...c...e...h...', '................', 'h...f...e...c...', 'e---d---c---a---']]] },
  ```

- **`main.js`:** `MUSIC = ['surface','crater','base','base','prison','escape','escape']`.

- [ ] **Step 1: Write the failing tests**

**`radio.test.mjs`:**
- The range becomes `>= 190 && <= 205`, and `SCRIPT.golf.length` becomes 7.
- Add `assert.deepEqual(SCRIPT.cow, ['Y|Is that a cow?', 'H|That would explain a lot of reports from Nebraska.']);`.
- "fight events map to cues" gains `assert.equal(keyOf([{ type: 'golf', n: 4, id: 5 }]), 'evidence'); assert.equal(keyOf([{ type: 'cow' }]), 'cow,cow');`.

**`speech.test.mjs`:** each `castVoices` expectation gains `P`:
- `[]` → `P: null`, `[a]` → `P: a`, and the two-voice case → `P: us` (S's voice);
- the five-voice case → `c.P.name === 'Hans'`;
- the third test loops `['H', 'Y', 'S', 'P']` with a fourth voice `v('Bea', 'en-AU')`, expecting `['Bea', 'en-AU', ...VOICE.P]`.

**`music.test.mjs`:** the keys become `['surface', 'crater', 'base', 'hold', 'prison', 'escape']`.

**`escape.test.mjs`** (import `SIGHTS`):

```js
test('the prison\'s sights: near the cow, the chair and the exit lift each cue once a run', () => {
  assert.deepEqual(SIGHTS, { cow: 5, chair: 4, exit: 12 }); const F = cellF(), ev = []; openBars(F); F.aliens.length = 0; F.god = true;
  for (const k of ['cow', 'chair', 'exit', 'cow']) { const q = P.props.find(o => o.kind === k), d = SIGHTS[k] - .5; put(F, q.x + q.dx * d, q.z + q.dz * d); stepFight(F, idle, 1 / 60);
    ev.push(...F.events.filter(e => ['cow', 'chair', 'hall'].includes(e.type)).map(e => e.type)); F.events.length = 0; }
  assert.deepEqual(ev, ['cow', 'chair', 'hall']); });
```

The cow is probed `d` m into the room along its facing. The chair and the exit have `dx = dz = 0`, so the probe puts you on them.

**`smoke.spec.mjs`:** "the four songs pre-render…" becomes six, with the extended key list. Add:

```js
test('the prison song plays in the cells, the escape song on the climb (music)', async ({ page }) => {
  const song = () => page.evaluate(() => window.ospTest.audio().song); await start(page); await page.evaluate(() => window.ospTest.prison()); await expect.poll(song).toBe('prison');
  await page.evaluate(() => window.ospTest.lift()); await expect.poll(song).toBe('escape'); });
```

- [ ] **Step 2: Run them to see them fail:** `node --test tests/radio.test.mjs tests/speech.test.mjs tests/music.test.mjs tests/escape.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement** as in Interfaces; `speech.js`'s header now says four speakers.

- [ ] **Step 4: Run the tests:** `npm test`, then `npm run test:smoke -- -g "music|songs|loops"`. Expected: all pass, including the seam test for both new songs.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "radio and music: prison flavour lines, the Pilot's voice, prison and escape songs" -m "Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7"
```

---

### Task 12: The bot through both levels, and its soak

**Files:**
- Modify: `src/game/bot.js`, `tests/{bot,hold}.test.mjs`, `tests/bot.soak.mjs` (and `escape.js`/`escape.test.mjs` only on a `SHIP.clock` retune)

**Interfaces:**
- **`createBot(world, rng, to = 'comms')`:** `to` is `'comms'` (attract), `'houston'` (the finale test) or `'board'` (the soak). `BOT.full = 1500` **[call]** is the stall limit (s) of a `'board'` run.
- **Done, in order:**
  1. `to === 'comms' && F.area === 3` → `'comms'`;
  2. `to === 'houston' && F.ko` → `'houston'`;
  3. `F.won` → `'board'`;
  4. `F.time > (to === 'board' ? BOT.full : BOT.max)` → `'stall'`.
- **Stage:**

  ```js
  F.ko ? 'ko' : F.lv.id === 'base' ? (F.area < 3 ? 'base' : F.hold ? 'hold' : 'call') : F.lv.id === 'prison' ? (F.cell.shut ? 'cell' : 'prison')
    : F.area <= 1 ? (F.flag.held ? 'route' : 'flag') : F.area === 5 ? 'climb' : 'dash'
  ```

  - **`'ko'`:** `IDLE`.
  - **`'cell'`:**
    - The goal is the bars' middle, with `use = canBang(F)`.
    - After the bang it parks and fights the guard.
    - It is exempt from the stall rule, like `'hold'`.
  - **`'prison'`:** `baseField(prisonMap, exit)`, as `'base'`, with `use = atExit(F)`.
  - **`'climb'`:** waypoints `[use, ...crater.path reversed]`, with the field `gridField(occ, N, top, MAX_STEP, Infinity, MAP_MARGIN)`.
  - **`'dash'`:** waypoints `[top, ...route.slice(0, -1).reverse(), ladderAt(F.ship)]`, with the field to that ladder spot, and `use = atLadder(F)`.
  - **`'route'`:** its block becomes generic over each stage's `{ path, field, use }`, rebuilt on stage change. The attract stages keep today's path, field and door rule, so the attract bot plays exactly as before.

- [ ] **Step 1: Write the failing tests**

- **`hold.test.mjs`:** `createBot(…, true)` → `'houston'`.
- **`bot.test.mjs`:** `run(world, secs, finale = false)` becomes `run(world, secs, to = 'comms', k = 0, until = () => false)`, which calls `skipTo(F, k)` when `k >= 4` and stops at `until(F)`. Import `skipTo` and `SHIP`, and add:

```js
test('the soak bot breaks out: bangs, beats the guard, takes the lift within 300 s (Plan 6)', () => {
  const { F, bot, t } = run(W, 400, 'board', 4, f => f.area >= 5); assert.ok(F.area === 5 && t < 300, `${bot.stage} ${t}`); });
test('from the climb the soak bot boards the ship with the clock to spare (Plan 6)', () => {
  const { F, bot, t } = run(W, 600, 'board', 5); assert.equal(bot.done, 'board', `${bot.stage} ${t}`); assert.ok(F.won && F.ship.left > .3 * SHIP.clock, `${F.ship.left}`); });
```

- **`bot.soak.mjs`:**
  - Uses `createBot(world, makeRng(seed + '/bot'), 'board')` with `LIMIT` 1500; success is `bot.done === 'board'`.
  - Records `dash = SHIP.clock - F.ship.left` per run, and prints min, median and max of the board times and of the dash.
  - **Fails** if the worst `dash > .7 * SHIP.clock`, printing `SHIP.clock should be ${Math.ceil(worst / .7 / 10) * 10} s (spec 6: the worst run keeps 30% spare)`.
  - Its header says it plays the whole game.

- [ ] **Step 2: Run them to see them fail:** `node --test tests/bot.test.mjs tests/hold.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement** as in Interfaces.

- [ ] **Step 4: Run the tests and the soak**

Run: `npm test && npm run test:bot`

Expected: all pass, 60/60 boarded.
- A printed `SHIP.clock` recommendation is the spec's tuning rule. Set it, update `SHIP`'s pin (and any `calls` mark that no longer fits), rerun, and give the numbers in the commit.
- Any other failure is a bug in the bot or the sim. Never raise `BOT.full` to pass.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "bot: the soak bot plays both levels to boarding and checks the ship clock" -m "Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7"
```

---

### Task 13: The whole game verified, the size, the hands-on checklist

**Files:**
- Modify: `docs/superpowers/decisions.md`

- [ ] **Step 1: Run every test**

Run: `npm test && npm run test:seeds && npm run test:bot && npm run test:smoke && npm run build && ls -l dist/index.html`

Expected: all unit tests (goldens and the level 1 hash test included), the seed soak (both maps, the escape plans), the bot soak (60/60 boarded) and the smoke suite in Chromium and Firefox pass. Report the size against about 95 KB (97,280 B), with the reason in the commit if over. `git diff 11bcf76 -- src/gen/surface.js src/gen/crater.js src/gen/passable.js src/gen/rng.js src/gen/noise.js` is empty. Fix any failure in the owning task's code as its own commit; never loosen a test.

- [ ] **Step 2: Record Plan 6 in `docs/superpowers/decisions.md`**

Add:
- **"State after Plan 6":** merge commit, size, test counts, new goldens and the final `SHIP.clock`.
- **A "Plan 6 (escape) calls" table:** this plan's `[call]`s, by table.

Mark R8, R9, R16 and R18 + R26 in the Plan 4 table "moved by Plan 6 (see the plan's Rules that move)". Under `## Hands-on checklist`, above `### Plan 5`, add:

```markdown
### Plan 6
- **Knock-out** (`KO` in `src/game/escape.js`): do the cut-off line, the thud and the black land? Is ANOTHER SMALL PROBLEM readable? Is the wake (eye on the floor, look locked, the vignette opening) readable; is 70 hp right?
- **Break-out** (`BREAK`): does "bang on the bars" read as the thing to do (the 20 s nudge)? The guard's 3 s / 4.5 s timing? Prison difficulty with a flag pole, then a fresh pistol, and the guard room's warden?
- **Fairness after a death in the prison:** guard dead, you keep its pistol and the bars stay open; guard alive, the beat replays.
- **The climb:** does the reversed switchback feel fresh enough? Does the arrow help going up?
- **The dash** (`SHIP`, `FLARE`, `RING`): does the flare read from the rim (it is all you see)? The clock's length, the countdown jokes, the rush round the ship?
- **Lift-off** (`LIFT`): the cabin view, the ground falling away, the aliens waving; does the stowaway sting land; the fade's timing.
- **Voices and songs:** the Pilot's voice in Chrome and Firefox; the prison and escape songs by ear.
- **Run time and fps:** about 20-30 minutes on a first play? fps in the prison and on the dash with the ring alive.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/decisions.md
git commit -m "docs: Plan 6 state, calls, moved rulings and hands-on checklist" -m "Claude-Session: https://claude.ai/code/session_01FNs5CY5HQgPxxGzTsprcX7"
```
