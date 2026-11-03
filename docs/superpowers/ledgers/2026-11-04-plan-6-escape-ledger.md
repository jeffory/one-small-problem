# SDD ledger — plan: docs/superpowers/plans/2026-11-04-plan-6-escape.md

Branch plan-6-escape from main 11bcf76; plan commit 794de93. Spec: docs/superpowers/specs/2026-11-03-plan-6-escape-design.md (+ the 2026-11-02 spec, Plan 5 spec). Overnight run 2: rule, do not ask.

## Pre-flight
Scan: preflight.md (Opus; built T1, T2, T3, T6 in a scratch copy: their tests pass, today's base and level 1 hash unchanged, 21,000 prison seeds without exhausting attempts). 27 findings: 5 blocker, 8 should-fix, 14 minor.
- F1 Ruling: accept: enterArea rebuilds on a new stint as well as a new level (`fresh = LEVEL[k] !== F.lv.id || stintEnd(k) !== stintEnd(F.area)`), so skipTo/ospTest hooks place you at the area start; walking 0→1, 2→3, 5→6 is unchanged — without it three level-2 tests pass vacuously — cost if wrong: small.
- F2 Ruling: accept: compare pieceMatrix output with Math.fround or a plain Array — cost if wrong: none.
- F3 Ruling: accept: the knock-out black check uses capture().mean < 5 (the dithered palette lifts pure black) — cost if wrong: none.
- F4 Ruling: accept: carry the phase overshoot (t -= phase length) so wake timing is exact, and keep sensible tolerances — cost if wrong: none.
- F5 Ruling: accept: the Pilot voice test expects the rule's actual result ('Online'), and the fourth voice is named so it sorts last ('Zoe') — cost if wrong: none.
- F6 Ruling: accept: the no-closing-tone check compares against the sample taken at the rescue line itself — cost if wrong: none.
- F7 Ruling: accept: the planner gains walk() and switchback() helpers used by both planFight and planEscape (no duplicated logic blocks); verified in scratch that level 1 still hashes the same — cost if wrong: a larger refactor in T6.
- F8 Ruling: accept: the SHIP LEAVES smoke reads its minutes from SHIP.clock (T12 may retune it) — cost if wrong: none.
- F9 Ruling: accept: capture().hot uses r >= 100 && r - max(g,b) >= 40 (measured 6-8 px at every flare height, 0 before) — cost if wrong: a flaky flare smoke.
- F10 Ruling: accept: the bot soak fails on any 'missed' ship event — spec §6's 30% spare — cost if wrong: none.
- F11 Ruling: accept: knock-out smokes pause right after the call and drive time with ff — cost if wrong: none.
- F12 Ruling: accept: the song seam smoke covers 6 songs incl. prison and escape — cost if wrong: none.
- F13 Ruling: accept: no door sfx while F.ko (the thud is the knock-out's only sound) — spec §2 — cost if wrong: none.
- F14 Ruling: accept: one shared puff table read by the opening and the ship — cost if wrong: none.
- F15 Ruling: accept: the pieceMatrix W.up change moves to T9 with its test — cost if wrong: none.
- F16 Ruling: accept: the bot's 'ko' stage is stall-exempt like 'hold' — cost if wrong: none.
- F17 Ruling: accept: T1's grep adds "Houston's call" and that test waits 40 s — cost if wrong: none.
- F18 Ruling: accept: the 'stamp' event plays the opening's stamp sfx — spec "in the opening's style" — cost if wrong: none.
- F19 Ruling: accept: the golf line edits move from T11 to T10 with GOLF_TOTAL 7 — cost if wrong: none.
- F20 Ruling: accept: baseMesh draws a red fixture box for kind-1 lamps that have no spawn door (the lift hall's alarm lamps) — cost if wrong: none.
- F21, F22, F25, F26 Ruling: accept the wording/coverage fixes (R-citation, F6 in the moved-rules table, encounters also take cfg.area, DEBUG warp branches on F.lv.map) — cost if wrong: none.
- F23 Ruling: accept: the silence test asserts run(R, 3) is [] — cost if wrong: none.
- F24 Ruling: [call]: a missed ship restarts area 6 at the rim like a death, and the ship's departure is not shown (it is out of sight from most of the dash); recorded in T13's calls table — cost if wrong: a visible lift-off on a miss is a later polish.
- F27 Ruling: accept: §4.1 (builder check) takes precedence over §3's "bars already open"; noted in T13's calls table — cost if wrong: none.

## Tasks
- Pre-flight amendments applied: ebdaa93 (plan 111,904 B; F1-F27 tagged).

Task 1: dispatched (opus, implementer a4af21c5cdfc77b5f; BASE ebdaa93)
Task 1: DONE_WITH_CONCERNS (judgement calls): 'ko' handler before the radio step; two equivalent main.js simplifications; extra tests (SCRIPT.rescue pin, downs in audio.test); NOTE for T9: the radio filter is F.ko only now, so after boarding fight events cue lines again — T9 must handle that for the sting.
Task 1: ⚠️ verified by controller: npm test 350/350, bot 60/60 (smoke re-run deferred to T13/final, as concurrent runs would collide)
Task 1: minor (deferred, plan-mandated): hold.test.mjs:70 R9-moved test lost its b.state === 'dead' precondition — Ruling: re-add in the final fix wave (fight.test's 'ko' case covers the rule meanwhile) — cost if wrong: none
Task 1: minor (deferred): the 'ko'-before-stepRadio order is not pinned by a test (no closing tone on the KO.call fallback)
Task 1: minor (deferred): radio silence() only tested mid-talk (key/unkey/gap cases)
Task 1: minor (deferred, plan-mandated): throughCall smokes check state 'end' but not #end display (covered by other smokes)
Task 1: complete (commits ebdaa93..9f549b4, review clean)
Task 2: dispatched (sonnet, implementer a9bef69464eeddc62; BASE 9f549b4)
Task 2: ⚠️ verified by controller: npm test 351/351, golden ok and file unchanged, seeds failures 0
Task 2: minor (deferred): baseplan.js lightBase/planBase read B.cfg.stream after destructuring cfg (cosmetic)
Task 2: note for T3: add LIGHT.alarm (cfg.red would crash without it), and give a non-comms end block its own feature branch (base.js:203 'comms' literal)
Task 2: complete (commits 9f549b4..1e43353, review clean)
Task 3: dispatched (sonnet, implementer a76631d7b9b44261d; BASE 1e43353)
Task 3: ⚠️ verified by controller: npm test 357/357 (golden ok, golden file unchanged); recess rendering and the F20 red box go to the hands-on check
Task 3: minor (deferred): alcove bars 2.6 m in a 4.5 m recess leave a dark gap (hands-on look; fix would be h = ceil - .1); baseMesh 'if (l.kind) continue' now only filters kind 2 (comment it); prison mesh test doesn't assert recess walls
Task 3: complete (commits 1e43353..447de3b, review clean)
Task 4: dispatched (opus, implementer aefa92a81051f43bc; BASE 447de3b)
Task 4: DONE_WITH_CONCERNS (minor): F1 stint rule untestable until T7 (T7's skipTo 5/6 tests must assert the area start); a same-level stint skip rebuilds the scene + door sfx (test hooks only); F26 warp faces the encounter; prison smoke reads audio().air once (possible flake)
Task 4: ⚠️ verified by controller: npm test 361/361
Task 4: Ruling (carry to T5): arrive() clears F.cell for every k !== 4, not only k 5 (a skip from 4 to 6 would draw a shut cell on the surface and throw) — reviewer minor 2 — cost if wrong: none
Task 4: carry to T7: skipTo 5/6 tests must assert the area start (F1 stint rule untested until then); decide whether a same-level stint skip should swap the scene and play the door sfx
Task 4: carry to T12: bot.js:50 baseField reads B.floor (ignores bars) and bot.js:81 F.lv.id !== 'base' treats the prison as surface; switch to F.lv.grid and F.lv.map
Task 4: minor (deferred, plan-mandated): prison smoke reads audio().air once (race; poll it); stintEnd loops forever for k >= LEVEL.length and makeLevel maps unknown ids to the prison (guard)
Task 4: complete (commits 447de3b..d6d4517, review clean)
Task 5: dispatched (sonnet, implementer aa4bf2baecd5310d1; BASE d6d4517)
Task 5: DONE_WITH_CONCERNS: stintEnd(5) loops forever until areas 5/6 exist (same as T4 minor 3) — Ruling: T7 adds areas 5-6 AND a bounds guard in stintEnd (k + 1 < LEVEL.length), and its skipTo tests cover 4→6 for the F.cell clear — cost if wrong: none
Task 5: ⚠️ verified by controller: npm test 367/367 (covers the guard encounter and restart path tests)
Task 5: minor (deferred, plan-mandated): the cell nudges stop after the 4th line (cycle ((n-1)%4)+1 so a stuck player keeps hearing them); 'arriving elsewhere clears the cell' test uses area 3 until T7
Task 5: complete (commits d6d4517..624e56a, review clean)
Task 6: dispatched (opus, implementer a49bdc010eec3edd0; BASE 624e56a)
Task 6: goldens re-pinned: APOLLO-4471 60273c6a→056f5ff0, EAGLE-0001 39762eb2→02f376fb, SOAK-0042 ee4eda57→d5ee2960; checksumWorld(w, true) still gives the old values; level 1 plan deepStrictEqual to the old planFight on 600 seeds
Task 6: carry to T8: the dash's last encounter is clamped to the route start, so its full-budget wave (brute included) sits at the wreck, on top of the rush ring — T8 should consider it; hands-on
Task 6: ⚠️ verified by controller: npm test 371/371; GOLF_TOTAL 7 is Task 10's (planned); F.encs holding area 5-6 encs in level 1 is harmless (only the debug warp iterates them)
Task 6: carry to T8: keep escape items (aliens, canisters, pickups, golf 6) clear of the rescue site (the ship gets a collision cylinder): assert a clearance in the soak or have rescueSite reject candidates near plan items
Task 6: minor (deferred): the rescue site's fallback and throw paths are never exercised by a committed test
Task 6: complete (commits 624e56a..6837ff6, review clean)
Task 7: dispatched (sonnet, implementer a263e90771815f010; BASE 6837ff6) with rulings: stintEnd bounds guard; skipTo 5/6 tests assert area start + 4→6 clears F.cell; decide same-level stint skip sfx
Task 7: Ruling (implementer's call, accepted): a same-level stint skip via test hooks keeps the scene rebuild + door sfx (hooks only; the real 4→5 move is a level change) — cost if wrong: none
Task 7: concern: ospTest.lift() from before area 4 triggers two scene rebuilds in one frame (hook only, wasteful)
Task 7: ⚠️ verified by controller: npm test 379/379
Task 7: minor (deferred): ospTest.lift() throws (F.cell.shut) or misplaces past area 4 — guard or no-op; two scene swaps per call; stray space in a test title
Task 7: complete (commits 6837ff6..71bbba5, review clean)
Task 8: dispatched (opus, implementer a51608c04446a6d4f; BASE 71bbba5) with carries: site clearance asserted in the seed soak; measure the live-alien count at the rush
Task 8: DONE_WITH_CONCERNS: (1) the rush is too crowded — standing still, 13-35 live aliens within 60 m of the ship at the rush (median 22, peak median 30, max 47), because the dash's last full-budget encounter (12-14 aliens with a brute) is clamped to the wreck on the ring's band; (2) the flare shows from the rim for ~16-25 s after touchdown then drops below the horizon (hands-on); (3) the flare is never culled when sprites are full; the clock turns red on whole seconds.
Task 8: Ruling (before review, correctness vs the user's 'too many aliens' feedback): (a) the dash's encounter walk stops 60 m short of the rescue site (a planner end-margin, level 1 unchanged); (b) the rush ring spawns only while fewer than RUSH.cap = 8 aliens are live within 60 m of the ship (as the hold caps at 8). (a) changes the escape plan, so the goldens are re-pinned a second time for the escape part only — the level-1 hash test must stay green and unchanged — cost if wrong: a second re-pin; the finale may now be too easy (hands-on).
Task 8: fix round (pre-review) 21ec56c: ESCAPE.shipGap 60 m + RING.cap 8; goldens re-pinned (2nd time, escape part only): APOLLO-4471 056f5ff0→cab7471e, EAGLE-0001 02f376fb→2b8d1c18, SOAK-0042 d5ee2960→0f2620e9; LEVEL_ONE unchanged. Probe (idle at 58 m, no kills) live within 60 m: rush median 22→8, peak median 30→12, max 47→22 (at the ladder: peak median 8, max 16).
Task 8: Ruling: accept the result; no further tuning before the hands-on check (no blind tuning): the worst idle-probe seeds still peak above 12 (the last dash encounter just past the 60 m gap; a real player fights it on the way), and short routes pack the six dash encounters closer (pairs under 40 m: 72→124 of 1000). Both go to the hands-on list with the levers named (gap 75-80 m; keep each encounter's aliens out of the gap; allow fewer than six dash encounters) — cost if wrong: a crowded finale until tuned.
Task 8: ⚠️ verified by controller: npm test 385/385
Task 8: Ruling: the dash's top p is now ~.93 (not 1.0) because the walk stops 60 m short — keep it: slightly easier fits the user's difficulty feedback and the rush is the climax — cost if wrong: one line (scale by L - end) 
Task 8: minor (deferred): seeds.soak shipGap variable name vs ESCAPE.shipGap and a misplaced 'Printed, not gated' comment; no test that a clock event cues countdown line n; no test of the missed-ship prompt; countdown lines are plain reactions and can be displaced in a fight (hands-on); ring points can fall outside the surface bound (0 stuck in a 60-seed sim; hands-on)
Task 8: complete (commits 71bbba5..21ec56c, review clean)
Task 9: dispatched (opus, implementer a01e6e2f111447049; BASE 21ec56c) with the T1 carry: nothing but boarding/lift-off/sting lines reaches the radio after boarding (+ test)
Task 9: DONE_WITH_CONCERNS (minor): a reaction cued at boarding can still play around the board line (never reaches the sting: stale at 5 s, sting at 6 s) — candidate: cut reactions at boarding like Houston (final wave); the flare freezes at boarding so the cabin can rise through it within ~43 s of touchdown; hatch shut if boarding within ~1.8 s (hooks only); corpses/pickups/canisters/decals vanish at boarding; no lift-off engine sound — candidate: reuse the opening's engine sfx (final wave)
Task 9: review: Needs fixes — Important: a reaction waiting or on the air at boarding still airs during the lift-off and delays the sting ~2.2 s past its click (reproduced; the implementer's 'never reaches the sting' claim was wrong). Minors: no pause-holds-the-lift-off test; the flare freezes at boarding; the engine glow lacks flicker.
Task 9: fix round 1/5 dispatched (resume implementer): cut reactions at boarding (drop waiting non-crit lines; cut one on the air, as at Houston) + test; also the flare keeps moving in the lift-off and a pause-holds-lift-off test
Task 9: fix round 1/5 (3 addressed, 0 open; commits c631e91..6b9f32a): boarding drops waiting reactions and cuts one on the air; flareAt null once aboard; pause-holds-lift-off smoke
Task 9: ⚠️ verified by controller: npm test 392/392
Task 9: minor (deferred): the main.js board-handler cut has no direct test (wiring read and correct); hatch shut if boarding right after touchdown (hooks only); corpses/pickups vanish at boarding; no lift-off engine sound; engine glow lacks flicker
Task 9: complete (commits 21ec56c..6b9f32a, 1 fix round)
Task 10: dispatched (opus, implementer a5f9af3761b2c2c79; BASE 6b9f32a)
Task 10: Ruling (accept implementer's call): F13's sfx/flash skip applies while koLock(F) (the black and the cell floor), not all of F.ko — F.ko spans Houston's live call (up to 30 s), and the literal reading would mute every shot there; a smoke counts sfx at the knock-out frame (thud only) and fails without the gate — cost if wrong: none
Task 10: Ruling (accept): the R9 knock-out smoke asserts f.run === f0.run at the exact stand-up moment instead of the brief's ff-based '< .5' (which could not pass) — stricter — cost if wrong: none
Task 10: ⚠️ verified by controller: npm test 395/395 (full smoke 150/150 per report; re-run at T13/final)
Task 10: minor (deferred, plan-mandated): replay.test's guard dies to an alien bolt (team 1), not the pole, and the test doesn't assert freed — tune input so the pole connects and assert cell.freed; escape.test doesn't pin kills/golf/found carry-over across knockOut; stale comments main.js:348 (clock hook) and hud.js:2 ('none' also through the knock-out); skipTo hooks mid-knock-out leave the HUD hidden (test-only); a few sfx dropped in the KO.call fallback frame; the stamp's real-time timer runs while paused (as the opening's)
Task 10: complete (commits 6b9f32a..998b5e0, review clean)
Task 11: dispatched (sonnet, implementer a87103ca65268324a; BASE 998b5e0)
Task 11: ⚠️ verified by controller: song seam/pre-render smokes 4/4 (both browsers, 6 songs incl. prison and escape); build 76,106 B
Task 11: minor (deferred): speech.js:77 doc comment ~190 chars (wrap); fight.js lost a blank line before the skipTo comment
Task 11: complete (commits 998b5e0..5be7747, review clean)
Task 12: dispatched (opus, implementer ad78d91a292482841; BASE 5be7747) with carries: bot reads F.lv.grid (bars) and branches on F.lv.map (prison indoors)
Task 12: DONE_WITH_CONCERNS: SHIP.clock 240→430 s (dash min 131.6 / median 183.9 / max 300.1 s; worst keeps 30.2% spare; at 240 s 10/60 missed once); two bot bugs fixed (prison field starts from the floor tile nearest the lift — a hall crate sat on the lift tile on 5/60 seeds; the climb picks its leg by distance and height, never >1 m above its footing — BOT-0033 looped). Concerns: 430 s probably generous for a human (hands-on); thin margin (worst 300.1 s vs 301 s limit); attract bot byte-identical.
Task 12: Ruling: the prison generator places a crate on the exit lift tile on 5/60 seeds (looks wrong; lift still works) — fix in the final fix wave together with any other generation fixes, one prison-part golden re-pin, level 1 unchanged — cost if wrong: none
Task 12: ⚠️ verified by controller: npm test 399/399; the long ff(SHIP.clock - SHIP.warn + 1) smoke is covered by T13's full smoke run
Task 12: Ruling: after the final fix wave (which changes some prisons and so some bot runs), re-derive SHIP.clock from the soak and round up to the next 30 s so a later small trajectory change doesn't flap it — the spec says 'at least 30% spare' — cost if wrong: a slightly longer clock
Task 12: minor (deferred): the soak's recommendation understates when ships are missed (count a missed dash as >= SHIP.clock); after a miss the dash keeps its old walk state; stale comments bot.js:25 (R21 297 s), escape.js:27 (300.1 s), bot.js:59-60 (crate on the lift as normal — remove floorNear or reword once the generator fix lands); no focused tests for the two bot fixes
Task 12: complete (commits 5be7747..ab047f4, review clean)
Task 13: dispatched (sonnet, implementer a40fde1d6aa809ebd; BASE ab047f4)
Task 13: review: Needs fixes — Important: the Plan 6 calls table lacks the plan's own [call]s and doesn't name the plan file; Minor: stale 'user has not yet played Plans 2-4' line; suite evidence summarised (controller re-runs everything before merge anyway).
Task 13: fix round 1/5 dispatched (resume implementer a40fde1d6aa809ebd): add the plan's [call] rows + plan path; reword the stale line
Task 13: fix round 1/5 (2 findings: plan path named + stale line fixed; the calls rows complete but 8 task labels wrong; commits d3d2e82..56806ac)
Task 13: fix round 2/5 dispatched: relabel SFX.click T10→T9 and 7 prison rows T4→T3
Task 13: fix round 2 committed 327ce26 (labels); scoped re-review + final review dispatched in parallel
Final review: dispatched (opus, a9f99370442e36056) over 11bcf76..327ce26; T13 round-2 re-review (sonnet, a6d2d580c3bbf328d) in parallel
Task 13: fix round 2/5 (1 addressed, 0 open; commit 327ce26)
Task 13: complete (commits ab047f4..327ce26, 2 fix rounds)

## Final review (opus, 11bcf76..327ce26): With fixes — 0 critical, 4 important, minors
- FR1 (Important) Ruling: fix: on 'board' drop the whole radio queue and cut whatever line is on the air (story or reaction, no closing tone; a small exported cutAll); radio unit test for boarding 3-12 s after the rush — the T9 fix covered only reactions; rush lines are seq — cost if wrong: none.
- FR2 (Important) Ruling: fix now, applying the user's own H2 remedy: a dash alien budget scale of .5 (like BASE_SCALE), folded into this wave's single escape re-pin, before the clock is re-derived. Measured before: dash 59/62/75 aliens (6 brutes) + rush ~10-13; bot damage on the dash ~1020 vs base-after-H2 ~470, i.e. the level the user called "extremely difficult" — not blind tuning: the user's stated preference — cost if wrong: the dash may feel light (hands-on; lever named).
- FR3 (Important) Ruling: the crate fix clears the whole lift dais (crates may not use the 4x4 raised band; keep a ring clear) with a seed-soak/prison.test assertion (no K.cover on the dais); then remove bot.js floorNear and its comment. Measured: a crate on the lift's centre tiles on 17.5% of seeds, anywhere on the dais on 36% — cost if wrong: none.
- FR4 (Important) Ruling: fix the soak's recommendation (a missed dash counts as at least SHIP.clock; round up to the next 30 s), then re-derive SHIP.clock after FR2/FR3, and update escape.js:27, the SHIP pin, decisions.md's clock and goldens lines and the hands-on line — cost if wrong: none.
- Minors taken into the wave: kills/golf/found carry-over assertion across knockOut (spec §3); poll the prison smoke's audio().air (flake); re-add hold.test's b.state === 'dead' precondition (T1, already ruled); the "base is that way" dawdle line limited to level 1 areas; cycle the cell nudges after the fourth; comment pass (bot.js:25, hud.js:2, main.js:348, escape.js:27, fight.js blank line, baseMesh 'if (l.kind) continue', speech.js comment wrap).
- Everything else in the reviewer's "can wait" list: Ruling: can wait (all test-hook, cosmetic or already covered). Hands-on: aliens don't collide with the rescue ship; countdown lines displaceable (lever crit); props, songs, voices, flare window, fps on the dash.
Final fix wave: dispatched (opus, a90e1a42598d62544) per final-fixes.md (FR1 sting, FR2 dash scale .5, FR3 dais crates, FR4 soak + clock, minors)
Final fix wave: commits 327ce26..ae0536f (FR1 2d0cd91, FR2+FR3 ce0b28d, b7eaa05, FR4 e8844c6 + e8d6c6c, minors 0fbc4f7 db7567f, docs a89028f ae0536f). Dash aliens 62→20 median; bot dash damage 1018→598; crate on dais 36%→0; sting delay 5.8→0 s; SHIP.clock 430→300 (worst dash 200.5 s, 33% spare); goldens re-pinned f39142f2/18bac48f/0920e393, LEVEL_ONE unchanged; 403 unit, seeds clean, bot 60/60, smoke 76+76, 76,638 B.
Final fix wave: Ruling: the dash keeps its 6-7 brutes (compose's B >= 4 rule unchanged) and its bot damage (598) stays above the base's after H2 (~470) — accept: it is the finale, and no further tuning before the hands-on check — cost if wrong: hands-on retune (lever: a dash brute cap or dashScale).
Final fix wave: re-review: all findings addressed, no new Critical/Important (latent: draw() edge case for a one-line lv1 cue).
Controller re-run at ae0536f: unit 403/403; level-1 gen files unchanged vs 11bcf76; seeds failures 0; bot 60/60 boarded (dash min 97.0 / median 138.5 / max 200.5 s, 99.5 s spare at 300 s); smoke 152 passed (7.9 m); build 76,638 B (58.5%).
