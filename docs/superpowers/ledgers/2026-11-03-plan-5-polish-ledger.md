# SDD ledger — plan: docs/superpowers/plans/2026-11-03-plan-5-polish.md

Branch plan-5-polish from main 591e038; docs commit 543d634. Spec: docs/superpowers/specs/2026-11-03-plan-5-polish-design.md (addendum to the 2026-11-02 spec). Overnight run 2: rule, do not ask.

## Pre-flight
Scan: preflight.md (Opus; built all six tasks in a scratch copy: 345 unit, bot 60/60, 130 smoke pass, 68,102 B). 0 blockers, 3 should-fix, 11 minor.
- F1 Ruling: accept: reword the Tables constraint to "each table's starting value is pinned once, in the test that names it"; derive T3's glint bound from TAPE_GLINT.on — the plan's own constraint said never in test literals — cost if wrong: a retune touches one pin per table.
- F2 Ruling: accept: the wall test becomes a height table covering ledges (Math.abs) — Review Focus 1 says never off a ledge — cost if wrong: none.
- F3 Ruling: accept: the recast test asserts no cancel and no new speak — spec §4 "a line in flight keeps its voice" was unpinned — cost if wrong: none.
- F4, F5, F11, F13 Ruling: accept the wording fixes (expected FAIL text, stale fightView comments, plan-qualified R-numbers, pickup heights) — cost if wrong: none.
- F6 Ruling: accept with `&& !F.won`: no low-health rim after Houston, so the win and end screen don't pulse red; one assertion in the T4 view test — cost if wrong: a low-hp win shows no rim (cosmetic).
- F7 Ruling: change the call: in the crater (area 1) the arrow follows the switchback: target the crater.path vertex after the one nearest the player, and crater.use after the last vertex, instead of a straight line down the wall (which steers players into fall damage, Plan 3 R18) — cost if wrong: a few lines of code and one test; the user may prefer the straight line.
- F8 Ruling: accept as a Task 7 hands-on note (the pole can't reach floaters overhead) — the spec mandates the band — cost if wrong: hands-on retune of the band top.
- F9 Ruling: accept: reword the [call] to "a local voice always wins Houston's slot and the pool"; Task 7 hands-on note about You's lines on Chrome — cost if wrong: You may be unvoiced on Chrome/Linux with one local voice.
- F10 Ruling: accept: one `stub(G, x)` test helper shared by Tasks 1 and 2 — cost if wrong: none.
- F12 Ruling: accept: Task 7 marks the Plan 2 hands-on lines "Hurt tint strength" and "Tape visibility" superseded — cost if wrong: none.
- F14 Ruling: no change (numbers kept, pinned by test) — cost if wrong: none.

## Tasks
- Pre-flight amendments applied: 77eeb7f (plan text, tagged (pre-flight Fn)).

Task 1: dispatched (sonnet, implementer a9dbc87603671288e; BASE 77eeb7f)
Task 1: ⚠️ verified by controller: PLAYER.eye 1.7 (band top 2.2 agrees), npm test 332/332
Task 1: minor (deferred): weapons.js:75 comment says 'of the feet' for a horizontal reach check
Task 1: complete (commits 77eeb7f..df7d400, review clean)
Task 2: dispatched (sonnet, implementer aaf31154d8633fcac; BASE df7d400)
Task 2: ⚠️ verified by controller: npm test 336/336 (goldens pass), bot soak 60/60
Task 2: minor (deferred): fight.js:61-63 long line, name c2, &&/|| precedence without parentheses (readability)
Task 2: complete (commits df7d400..1649978, review clean)
Task 3: dispatched (sonnet, implementer a86fe2b8f73218d07; BASE 1649978)
Task 3: concern (no RED run recorded) resolved by controller: the new tests run against 1649978 fail as the plan expects (glsl assertion fails; models/view tests don't load: no export TAPE_R/TAPE_GLINT)
Task 3: minor (deferred): TAPE_GLINT sits under the 'Lights (pre-flight F18)' comment in fightView.js; TAPE_R export wedged between imports in models.js:4
Task 3: complete (commits 1649978..887871f, review clean)
Task 4: dispatched (sonnet, implementer a54eeed8c115149bb; BASE 887871f)
Note: main moved to 281663a (CI fix). Rebase plan-5-polish onto main after Task 7, before the final review (ledger SHAs above refer to pre-rebase commits).
Task 4: ⚠️ verified by controller: npm test 340/340; smoke thresholds re-checked in Task 7's full smoke run and on CI
Task 4: minor (deferred): post.frag:3 header comment line overlong; view.test.mjs uses createOpening imported only at line 107
Task 4: complete (commits 887871f..19e8c30, review clean)
Task 5: dispatched (sonnet, implementer a35a35c023749ccad; BASE 19e8c30)
Task 5: ⚠️ verified by controller: npm test 343/343
Task 5: minor (deferred): the 'odd entries' speech test asserts only doesNotThrow, not the resulting cast
Task 5: note: castVoices is a fixed {H,Y,S}; Plan 6's Pilot (P) needs a small extension there
Task 5: complete (commits 19e8c30..4c865bf, review clean)
Task 6: dispatched (sonnet, implementer af70b108af5e021dd; BASE 4c865bf)
Task 6: ⚠️ verified by controller: npm test 346/346
Task 6: minor (deferred): areas.js:44 'F.state === play && wayTarget()' yields false|object (clearer as a ternary); ang can be exactly -π directly behind (visually identical)
Task 6: complete (commits 4c865bf..989b527, review clean)
REBASE onto main 281663a (clean, no conflicts). New SHAs: docs 4b6eb47, pre-flight 30db566, T1 c8734f7, T2 0b99353, T3 af51cf6, T4 7a534de, T5 3a3de2f, T6 0e18a4b. MERGE_BASE for the final review: 281663a.
Task 7: dispatched (sonnet, implementer a3fc66f09a285eeaa; BASE 0e18a4b)
Task 7: ⚠️ (suite evidence summarised without raw output) — controller re-running every suite with raw output to scratchpad/p5-verify.log
Task 7: minor (deferred): task-7-report gives summary lines, no raw suite output
Task 7: complete (commits 0e18a4b..0c50a90, review clean)
Final review: dispatched (opus, aabd2b3fda7482908) over 281663a..0c50a90
Task 7 ⚠️ resolved by controller re-run at 0c50a90 (raw log scratchpad/p5-verify.log): unit 346/346; src/gen + golden diff vs 591e038 empty; seeds 1000 failures 0; bot 60/60 (max 274.6 s); smoke 130 passed (5.8 m); build 68,218 B (52.0%).

## Final review (opus, 281663a..0c50a90): With fixes — 0 critical, 1 important, 4 minor
- FR1 (Important) Ruling: replace the F7 crater rule (aim at the vertex after the nearest vertex), which swings backward or skips corners mid-leg on every probed seed, with the reviewer's prototyped rule: aim at the end vertex of the nearest switchback segment (by projection); once within WAY.near of that vertex aim at the next one (crater.use after the last), so the 12 m hide only applies at the door; plus a test that walks each leg in steps and checks the target index never goes down or skips — my own F7 ruling was the defect — cost if wrong: ~6 lines; the user may still prefer another rule.
- FR2 (Minor) Ruling: controller does it at merge: copy the ledger to docs/superpowers/ledgers/ and update decisions.md (index, state, Plan 5 rulings) — cost if wrong: none.
- FR3 (Minor) Ruling: fix: castVoices compares voices by name, so a duplicated entry can't give Houston and You the same voice — cost if wrong: none.
- FR4 (Minor) Ruling: fix: pin VIG and TAPE_GLINT starting values once (the Tables constraint) — cost if wrong: none.
- FR5 (Minor) Ruling: fix: the voices hands-on line in decisions.md also names the Switchboard — cost if wrong: none.
- Deferred minors triage: all "can wait"; the fix wave also takes the free readability wins in files it touches anyway (fight.js c2 → chance with parentheses; a one-line TAPE_GLINT comment next to its loop; TAPE_R below the imports) — cost if wrong: none.
- Declined-to-judge list (pole through walls, knock-back by pitch, god-mode hit flare behind the title, tape on top of a blocked drop, dead vignette snaps, glint size at range, floaters overhead, the Plan 6 spec's "blurred by the vignette") — Ruling: none of these change Plan 5; the glint size and the dead vignette go to the hands-on check; "blurred" in the Plan 6 spec is Plan 6's to settle (fix the wording there: the vignette doesn't blur).
Final fix wave: commits c9b7473 (FR1 arrow), 4158bdc (FR3 + FR5), 85c1265 (FR4 + readability); npm test 348/348, bot 60/60, build 68,277 B, wayfinding|M7 smoke 4/4. Implementer re-derived the crater test's past-the-door probe (encoded the old rule). Scoped re-review dispatched (sonnet, ad202c728f87ed6cc).
