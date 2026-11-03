# SDD ledger — plan: docs/superpowers/plans/2026-11-02-plan-3-base.md

Branch: plan-3-base (in place). Branch start: e43f407 (main). Plan committed: 7ac3b19.
Spec: docs/superpowers/specs/2026-11-02-one-small-problem-design.md.
Context: overnight autonomous run (/loop, user delegated all choices; see memory overnight-autonomy). Plan drafted by an Opus subagent (writing-plans); its [call] list is in the plan.
Process note: the pre-flight scan is delegated to an Opus subagent (writes preflight.md) because the plan is 115 KB; the controller rules on its findings below.
Model plan: implementers sonnet for gen/mesh tasks (1-5, 9), opus for 6, 7, 8, 10, 11; reviewers sonnet, opus for 6, 7, 8, 10; final review opus.

## Rulings

## Progress
Pre-flight: 28 findings (9 blocking, 9 major, 10 minor) in preflight.md (pairs + self-consistency tables there).
Ruling R1 (pre-flight F1-F28): accept every finding's proposed smallest fix, written into the plan text before Task 1 (plan amendment commit), with these choices: F2 = skip inner-side width samples within 12 m of P1..P3 and document the hairpin inside as a drop-down ledge; F7 = gate on "no seed exhausts its 8 attempts" and print the attempt histogram, drop the 9-cell fallback; F8 = comms room +2..+22 with alcoves at +1; F12 = canister clusters placed before aliens, aliens keep 1.5 m from canisters; F16 = LEAK 1.5; F18 = nDyn = min(dynCount, 16 - min(lampCandidates, 16 - MAX_DYN)); F24 = re-pin goldens after the hands-on step. — each is probe-verified by the scanner and the plan's own tests fail without the blocking ones. — If wrong: small per-task rework, visible in the amendment diff.
Plan amended: 73ef48f (F1-F28 applied, 124,003 B). Global constraints copy refreshed. Note: golden.test fails with ???????? until Task 12 Step 4 (by design).
Task 1: dispatched (BASE 73ef48f, sonnet)
Task 1: implementer DONE 8ed727e (137 unit, soak 0, 40 smoke, 30,109 B); RED partial (cycle + generateWorld tests not seen failing). Review dispatched (sonnet)
Task 1: review ✅ Approved. ⚠️ resolved by controller: checksums at e43f407 (generateSurface) vs 8ed727e (generateWorld) identical for APOLLO-4471 5884abf5, EAGLE-0001 106ca54a, SOAK-0042 d58e41e8; reviewer mutated the cycle test to fail.
Task 1: minor (deferred): sprite-fog test only regex-matches shader/renderer source (no uniform-call assertion).
Task 1: minor (deferred): cycle-test import regex misses double-quoted/multi-line/side-effect imports.
Task 1: complete (commits 73ef48f..8ed727e, review clean)
Task 2: dispatched (BASE 8ed727e, sonnet)
Task 2: implementer DONE_WITH_CONCERNS 25b6f29 (143 unit, soak 0 fail/0 reroll, 40 smoke, 31,462 B); switchback worst centreline step 0.4152 (gate 0.45). Review dispatched (sonnet)
Task 2: review ✅ Approved. ⚠️ smoke/test counts per implementer report.
Task 2: minor (deferred): switchback centreline step reaches 0.415 m near hairpins (SOAK-0957; nearest-segment ownership blended by bilinear sampling); bounded < 0.45 over 7000 seeds; lerp across ownership near vertices would tighten.
Task 2: minor (deferred): doorReachable reject path never exercised (0 re-rolls); no test forces it.
Task 2: complete (commits 8ed727e..25b6f29, review clean)
Task 3: dispatched (BASE 25b6f29, sonnet)
Task 3: implementer DONE a4ea9f4 (145 unit, soak 0); golf fallbacks never fired (3000/3000 by rocks). Review dispatched (sonnet)
Task 3: review ✅ Approved. Surface plan verified identical to 25b6f29 on 5 seeds (area tags stripped).
Task 3: minor (deferred): golf fallbacks 1/2 and the throw have no committed test (probe with rocks removed: fallback 1 meets 20 m).
Task 3: minor (deferred): crater "inside base.R" asserted for one seed only; soak doesn't check it. Golf has no spacing from pickups/canisters/aliens.
Task 3: complete (commits 25b6f29..a4ea9f4, review clean)
Task 4: dispatched (BASE a4ea9f4, opus — upgraded from sonnet: most algorithmic gen task, pre-flight found 4 defects here)
Task 4: implementer DONE_WITH_CONCERNS bb0af76 (154 unit, soak 0; base re-roll 28%: lab twin-jar placement adds ~5%). 6 of 320,000 WORD-NNNN seeds exhaust 8 attempts and throw.
Ruling R2: base attempt cap 8 -> 32 (same seed+attempt scheme), so exhaustion probability ~0.28^32 ~ 1e-18; the soak gate stays "no seed exhausts". — spec anti-goal: no seed may fail; spec says seed+1 on failure. — If wrong: a few ms more generation on unlucky seeds.
Task 4: R2 applied 2faecc1 (155 unit, soak 0; all 320,000 WORD-NNNN seeds build, worst attempt 10). Review dispatched (opus)
Task 4: review ✅ Approved (opus; 600-seed probe: determinism, graph shape, walkability, headroom >= 2.70, sealed ring all hold).
Ruling R3: `in` = the first room tile past the corridor (implementer's reading) — works for Task 7's commsDoor - 3*dir test on 600 seeds. — If wrong: the start shifts one tile.
Ruling R4 (carry to Task 9): the parked saucer is drawn 4 m wide to match its ±2 m footprint (plan says 5 m but the footprint is 4x4), so its rim never overhangs walkable tiles. — plan-internal conflict found by the Task 4 review. — If wrong: a slightly smaller saucer.
Task 4: minor (deferred): R2 test pins exact attempt outcomes for six seeds (attempt >= 8) — brittle to Task 12 retuning; relax to "builds".
Task 4: minor (deferred): lift start faces the wall beside the doorway in ~19% of seeds (cosmetic).
Task 4: minor (deferred): soak doesn't check headroom/solid walls/worst step (hold by construction); plain room record ceil is a double vs Float32 tile ceil.
Task 4: complete (commits a4ea9f4..2faecc1, review clean)
Task 5: dispatched (BASE 2faecc1, sonnet)
Task 5: implementer DONE 520ac2d (161 unit, soak 0). Judgement calls: canister anchor needs a partner tile (greenhouse drops 10/1000, soak fails only on hangar/reactor drops); alien fallback 1 skips the 3-tile-from-in rule; golf first, pickups 1 m from golf. Review dispatched (sonnet)
Task 5: review ✅ Approved. Surface/crater plans unchanged (base streams isolated, base checksum part appended last).
Task 5: minor (deferred, tuning at hands-on): ~35% of base rooms have alien pairs < 2 m via the brief's fallback 2 (budgets of 7-9 aliens); soak should print the count.
Task 5: minor (deferred): no asserts for canister ring 1.2-2.0 m, lamp hang <= LAMP_DROP, base plan in checksum; base.test checks one seed; greenhouse cluster drops 10/1000 silently.
Task 5: minor (deferred): `pick` referenced before its const declaration in baseplan.js (works; reorder).
Task 5: complete (commits 2faecc1..520ac2d, review clean)
Task 6: dispatched (BASE 520ac2d, opus)
Task 6: implementer DONE_WITH_CONCERNS 3fe31e7 (172 unit, 37,854 B). RF5 probes clean at 20/60/144 fps (>= 0.380 m from walls). Concerns: floater centre-line probe lets body clip pillar corners; floaters above ~1.7 m can't pass 2.7 m lintels (stay in room); dead-straight push into a jamb stops. Review dispatched (opus)
Task 6: review ❌ Needs fixes (opus). Surface gameplay bit-identical to 520ac2d over 2,400 uneven frames (only effect positions moved); RF5 holds on real maps at 20/60/144.
  Important 1 (plan-mandated): floater centre-line probe lets its 0.75 m body sink into convex corners (pillars, reactor disc, jars, saucer, jambs).
  Important 2 (plan-mandated): airborne box corner can land inside a jumpable obstacle (0.5 m bed) and the two-corner probe then refuses all moves along it; frame-rate dependent.
Ruling R5: floaters probe the leading edge at two lateral points (like the player's box) for each axis move indoors; test: a floater circling a 1x1 pillar keeps its centre >= 0.5 m from the corner at 20/60/144 fps. — spec: grotesque aliens must read solid; corners exist in every themed room. — If wrong: floaters hug corners slightly less tightly.
Ruling R6: the player's indoor corner probe refuses an axis move only when a leading corner enters a blocked tile it was not already in (overlap can always be escaped); test: the reviewer's snag repro (run along a 0.5 m row, jump, strafe in) does not refuse forward motion after landing, at 20/60/144 fps; all RF5 tests still pass. — box-vs-tile snag is a stuck-player bug. — If wrong: a corner can stay visually inside a bed edge (invisible in first person).
Ruling R7: floaters cannot pass base lintels (they hold their room) — accepted; walls already confine them and they don't use the nav field. — If wrong: Plan 4 tuning.
Ruling R8: a dead-straight push into a door jamb stops the player — accepted standard box collision (3-tile doorways, diagonal approaches slide). — If wrong: hands-on tuning.
Task 6: minor (deferred): steps < RISE misclassify ~0.2-0.3% of level hits (lintel face 0.3 m drop -> ceiling hit at y 3.0); cosmetic scorch placement.
Task 6: minor (deferred): stepBolts allocates an `at` closure per bolt per sub-step.
Task 6: fix round 1 dispatched (resume implementer)
Task 6: fix round 1 done f619765 (175 unit; snag 0 stuck; floater centre > 0.5 m from walls; surface replay identical). Re-review dispatched (sonnet)
Task 6: fix round 1/5 (2 addressed, 0 open — R5 floater edge probes, R6 overlap allowance; commits 3fe31e7..f619765)
Task 6: minor (deferred): floater probes exactly 1.0 m apart rely on round() tile lookup (theoretical straddle at exact boundaries); no diagonal-approach floater test.
Task 6: complete (commits 520ac2d..f619765, review clean after 1 fix round)
Task 7: dispatched (BASE f619765, opus)
Task 7: implementer NEEDS_CONTEXT (uncommitted; 184/185, smoke 40/40, 38,450 B; surface replay bit-identical). Brief test "a base fight: walk into the hangar" can't pass: 5 hangar skitterers kill the idle player at 5.3 s and restartArea restores hp 100 by 7.8 s.
Ruling R9: that test sets F.god = true before put(...) (hp floors at 1, so hp < 100 still proves base aliens hurt you). — plan test defect. — If wrong: nothing; the test still proves damage.
Ruling R10: accept the implementer's guard that makes no decal or particle inside the level (3-7% of alien muzzles start inside walls, leaving buried scorch/goo) and the fightView flag draw guard (unlisted file). — prevents invisible decals eating the 40/24 rings. — If wrong: veto = delete two guards.
Task 7: minor (deferred, hands-on): 3-7% of base alien muzzles start inside walls (those bolts die at the wall face); 5 hangar skitterers kill an idle player in ~5 s.
Task 7: implementer DONE 2380a1a (185 unit, 40 smoke, 38,450 B). Review dispatched (opus)
Task 7: review ❌ Needs fixes (opus). Surface gameplay bit-identical on 8 seeds; base replay deterministic; Task 8 interfaces present.
  Important 1 (plan-mandated): groundNormal's RISE clamp reads surface slopes > ~35 deg as steps, so surface decal normals are off by up to ~78 deg on ~10% of the surface / ~25% of the crater.
Ruling R11: groundNormal's step clamp applies indoors only (groundNormal(ground,x,z,rise=RISE); levelHit passes ceil ? RISE : Infinity; fight.js callers pass F.lv.ceil ? undefined : Infinity) — reviewer-verified to restore bit-identical surface decals on 4 seeds. — If wrong: nothing visible indoors.
Task 7: minor (deferred → final review): base alien muzzles inside walls (brute muzzle 1.31 m vs radius .8): cheap fix = fire from [a.x, m[1], a.z] when lv.ceil and the muzzle is solid (0 buried bolts; balance: more hits). Rig spheres ~1% in walls (visual).
Task 7: minor (deferred): canister blasts ignore walls indoors (Plan 2 behaviour).
Task 7: minor (deferred): surface bit-identity is empirical (particle wall rule could shift rng on steep terrain); untested particle ceiling clamp, aimPoint ceiling, indoor fits in bodies(); PLAYER.gSurface remains a second gravity source.
Task 7: fix round 1 dispatched (resume implementer)
Task 7: fix round 1 done 9750b4c (186 unit, 40 smoke; 96/96 snapshots identical incl. decal normals). Re-review dispatched (sonnet)
Task 7: fix round 1/5 (1 addressed, 0 open — R11 indoor-only clamp; commits 2380a1a..9750b4c)
Task 7: complete (commits f619765..9750b4c, review clean after 1 fix round)
Task 8: dispatched (BASE 9750b4c, opus)
Task 8: implementer DONE_WITH_CONCERNS 2ee0772 (195 unit, 38,954 B). Concerns: flag grab after walking back from crater re-snapshots entry (Plan 2 code); E at door before Task 11 draws surface scene; comms death removes all base aliens (brief rule). Review dispatched (opus)
Task 8: review ❌ Needs fixes (opus). RF1/RF2 tests mutation-proven; determinism across area changes probed identical.
  Important 1: a flag grab in the crater re-snapshots the whole inventory into entry (crater cells kept on death while crater pickups respawn); reproduced by walking.
Ruling R12: a flag grab only adds the flag to the snapshot: F.entry.owned[0] = true; F.entry.flagHeld = true (uniform variant (a); also closes Plan 2's area-0 duplication where surface cells taken before the flag were saved and respawned). Add the reviewer's regression test. Also add (deliberately, in the same round) the reviewer's two restart-rule assertions (current-area pickups not duplicated per death; earlier golf balls kept) — they guard real regressions and cost nothing. — checkpoint rule is a global constraint. — If wrong: area-0 deaths restore pre-flag cells to 0 (strictly the documented rule).
Task 8: minor (deferred): no committed replay across an area change (probe shows determinism; Task 12 can pin).
Task 8: fix round 1 dispatched (resume implementer)
Task 8: fix round 1 done 30ec812 (197 unit). Re-review dispatched (sonnet)
Task 8: fix round 1/5 (2 addressed, 0 open — R12 flag snapshot + restart-rule guards, mutation-proven; commits 2ee0772..30ec812)
Task 8: complete (commits 9750b4c..30ec812, review clean after 1 fix round)
Task 9: dispatched (BASE 30ec812, sonnet) with R4 (saucer 4 m)
Task 9: implementer DONE_WITH_CONCERNS e7aa066 (203 unit, 40 smoke, 20-layer bake, 39,354 B). F10 mutation-proven; saucer rim 2.0 m.
Ruling R13: greenhouse stalks stay static (WORLD_VS sway term is object-space -y; stalks are world-space y >= 0) unless Task 10 finds a cheap fix; core radii 1.5/.9 to fit the 1.6 footprint; corridor pipes .35 m in from each wall at 2.55. — small look calls. — If wrong: hands-on tweaks.
Task 9: review dispatched (sonnet)
Task 9: review ✅ Approved (6-seed probe: 0 missing wall faces, correct winding; shell 12-15k verts, props 7.5-8.4k).
Task 9: minor (deferred): no committed test for open-to-wall face coverage; saucer test has a vacuous clause; lift grate check loose; strip colour by id parity may mismatch lamps; a capped-out red light leaves a spawn door with no red box.
Task 9: complete (commits 30ec812..e7aa066, review clean)
Task 10: dispatched (BASE e7aa066, opus)
Task 10: implementer DONE_WITH_CONCERNS e82ce92 (212 unit, 39,811 B; warm crowded base frame allocation-free; screenshots match look brief). Added 2 tests that catch 4 broken rankings; dropped a duplicate import from the brief's test.
Ruling R14: keep F18 as written (canisters count base-wide toward the 6 dynamic slots) — the only effect is lamps 6-8 m beyond their reach switching off, which contribute no light there. — If wrong: count dynamic lights within FOG_REACH only.
Task 10: minor (deferred, hands-on): reactor core column and greenhouse eye blobs render near plasma brightness (spec: plasma brightest; reactor is "glowing").
Task 10: review dispatched (opus)
Task 10: review ✅ Approved (opus; 3 seeds x 3 fps crowd walk: 0 holder drops, fade 0.250 s at all rates; dispose frees all).
Task 10: minor (deferred → final fix wave): greenhouse eye blobs use MAT.eye (emissive 2.2) and clip flat white as bright as plasma (anti-goal); fix = own dim tuple e.g. [8,1,.5,8] at baseMesh.js:88. Optional: MAT.reactor emissive 1.4 -> ~1.1.
Task 10: minor (deferred, look review): leaving lamps snap off (plan [call]); 2-5 visible events per walk.
Task 10: minor (deferred): allocation test only on surface; no committed fade-fps test; golf glint test loose; surface lamp height untested.
Task 10: complete (commits e7aa066..e82ce92, review clean)
Task 11: dispatched (BASE e82ce92, opus)
Task 11: implementer DONE_WITH_CONCERNS f9f746d (212 unit, soak 0, 46 smoke, 42,498 B). Added a frames() wait to the context-loss test so the base is drawn before the loss. ~19 aliens awake at the lift on APOLLO-4471 (WAKE 30 m).
Controller observation (t11/chromium_crater_mid.png): the crater interior is in pitch-black sun shadow, so the switchback descent is nearly invisible (only the teal door lamp shows). Hangar shot (t11/chromium_base_0_hangar.png) is on-style but very dark. For final-review triage.
Task 11: review dispatched (sonnet)
Task 11: review ✅ Approved (scene swap disposes once, rebuilds only on level change; handler kept).
Task 11: minor (deferred): context-loss test wait doesn't assert the swap; no test for "no rebuild on death"/double dispose; atStart ignores y; ~19 aliens awake at the lift (WAKE.base 30 m, hands-on).
Task 11: complete (commits e82ce92..f9f746d, review clean)
Ruling R15: Task 12 skips the hands-on step (user is away; same as Plan 2 R14) and pins the golden checksums now, at the end of Task 12 (F24 said "after hands-on"; no generation tables will change tonight). If the user's hands-on later retunes generation tables, the goldens are re-pinned in that tuning commit. — If wrong: a one-line re-pin.
Task 12: dispatched (BASE f9f746d, sonnet)
Task 12: implementer DONE 72d7fe3 (214 unit, soak 0 in 47.6 s, 46 smoke, 42,498 B). Goldens APOLLO-4471 0d01a4f8, EAGLE-0001 3a474bfb, SOAK-0042 7392d7bb. Review dispatched (sonnet)
Task 12: review ✅ Approved (Math.random mutation fails the replay; goldens real; soak gates unchanged).
Task 12: minor (deferred): replay asserts don't check F.area === 2 at snapshots or that a level event fired; smoke computes its own NODE_SUM instead of importing GOLDEN; draw-order changes are invisible to same-process replay.
Task 12: complete (commits f9f746d..72d7fe3, review clean)
Final review: dispatched (opus), range e43f407..72d7fe3
Final review (opus, retry after an API safeguard false positive): With fixes. I1 base lamps light almost no floor (74% of tiles in band 0; LEAK isotropic clamp); I2 crater interior in sun shadow on every seed (0/150 doors lit); I3 switchback optional (straight drop to the door in 4-5 s on 40/40 seeds); I4 greenhouse eyes flat white. Minors M1-M7.
Ruling R16 (overturns R1/F16's isotropic LEAK clamp): each lamp's radius is bounded by the distance to the nearest walkable tile hidden from it (2D tile line of sight), not by the nearest wall; lamps hang at floor + 2.65 (look test). Keep LIGHT_CAP; re-pin goldens (R15); add a unit test that >= 60% of walkable base tiles get band >= 1 light, and a smoke mean-brightness floor for the base frame (M6). — measured root cause of the dark base; no-leak guarantee kept because walls are >= 2 tiles. — If wrong: retune two constants.
Ruling R17: crater guide lights, render-only: small dim emissive posts plus point lamps (r ~6, amber/teal, dark style) at each switchback vertex and every ~15 m, at most 8, through the surface scene's lamp list. No checksum change. The sun stays. — a whole area played in black is unreadable. — If wrong: remove the posts.
Ruling R18: fall damage. Landing faster than FALL.safe = 7 m/s costs FALL.dmg = 8 hp per m/s over (table in player or fight; pure; a 'hurt' event with cause 'fall' for Plan 4's radio). Lunar and base jumps land at ~3.5 m/s and a 1 m base drop at ~4.2, so normal play never triggers it; a 15 m drop costs ~20, a 30 m drop ~51. — makes the switchback the sensible route (option b of I3) without moving encounters. — If wrong: retune or remove the table entry.
Ruling R19: greenhouse eyes use their own dim tuple [8,1,.5,8] (I4); canister blasts indoors are gated by lineOfSight (M3); the lift pillar pipes and greenhouse stalks either get collision or move flush to walls (M4, implementer's choice).
Final: deferred (hands-on/Plan 4): M1 base draw calls (248-455; cull if the 890M drops below 60 fps), M2 plasma/blast light through base walls, M5 golf throw path, M7 muzzle-flash allocation, and every "can wait" triage line.
Final fix wave: dispatched (BASE 72d7fe3, opus)
Final fix wave: DONE_WITH_CONCERNS 72d7fe3..400d576 (227 unit, soak 0, 46 smoke, 43,222 B; goldens ca0c9fe6/dd7f8ffc/5671ed28; base floor band>=1 28% -> 70-76%). Deviation I3: outdoor feet follow falling ground at most 7 m/s so fall damage is frame-rate independent (dive costs 10-11 hp at 20/60/144). Concerns: falls are a toll not a barrier (jump-held dives cost 0 on 4/10 seeds; switchback worst landing 6.56 vs 7); pillars block lamp sight; greenhouse beds 1.1 m; smoke brightness floor tight (26 vs 29.0). Controller viewed fix/final-shots hangar + crater: readable, beacon visible.
Final fix wave: scoped re-review dispatched (opus)
Final fix wave re-review (opus): all 6 addressed (I1, I2, I3 as ruled, I4, M3, M4), no new Critical/Important. Goldens re-pinned in the generating commits; smoke floor stable (29.0 +/- .01, fails at 25.2).
Final: parked — walking (not running) straight down the crater wall costs 0 hp and beats the switchback (8.5-10 s vs 10.8-13.5 s) — Ruling: park for the user's hands-on; R18 taxes only running; crater fights guard the pad. — If wrong: Plan 4 adds a slope/landing rule or moves encounters.
Final: parked → Plan 4 carry-over Task 1 — the outdoor glue cap (7 m/s) launches the player off slopes > ~38 deg when running (~18 launches/h in fight-like play off-route); Plan 2 surface feel changed — Ruling: Plan 4's first task limits the glue cap to the crater area (area 1). — If wrong: off-route crater walls feel floatier until then.
Final: parked → Plan 4 carry-over — greenhouse stalk eyes can poke into lamp fixtures on 6/150 seeds; plan text Task 5 line 635 still says LEAK = 1.5 / LAMP_DROP 3.2 (superseded note at 647) — Ruling: carry over; cosmetic.
