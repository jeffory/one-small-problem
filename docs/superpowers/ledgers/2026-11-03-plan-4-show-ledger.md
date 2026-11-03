# SDD ledger — plan: docs/superpowers/plans/2026-11-03-plan-4-show.md

Branch: plan-4-show (in place). Branch start: 400d576 (main). Plan committed: f5b6fed.
Spec: docs/superpowers/specs/2026-11-02-one-small-problem-design.md.
Context: overnight autonomous run (/loop; user delegated all choices; memory overnight-autonomy). Plan drafted by an Opus subagent with writing-plans; its [call] list is in the plan. Pre-flight scan delegated to an Opus subagent (plan is 166 KB); controller rules on findings.
Model plan: opus for tasks 2, 4, 5, 6, 7, 8, 11, 12; sonnet for 1, 3, 9, 10. Reviewers: opus for 2, 4, 5, 7, 8, 11; sonnet otherwise. Final review opus.

## Progress
Pre-flight: 29 findings (1 blocking, 6 major, 22 minor) in preflight.md (pairs + self-consistency tables there). Probes: Task 1 applied in scratch passes 231/231; headless chromium+firefox grant pointer lock, have AudioContext/OfflineAudioContext; firefox headless has espeak voices; size est. 64-70 KB.
Ruling R1 (pre-flight F1-F29): accept every finding's proposed smallest fix, written into the owning task's text before Task 1 (plan amendment commit), including F1 (finish/toTitle exit pointer lock), F3 (advance() clears F.events), F2 (walking allowed during descent/company), F4/F5 (stub getVoices empty in those smoke tests; Task 12 test.setTimeout 120 s), F6/F7 (glitter carried over at the title drop; hatch state copied to the wreck). — probe-verified; blocking/major ones would fail their own tests or ship visible glitches. — If wrong: small per-task rework, visible in the amendment diff.
Plan amended: 509646e (F1-F29 applied, 178,574 B). Choices: F4 noVoices helper; F13 stamp uses #b8ae9c; F15 descent lander shadow accepted; F16 dawdle cooldown dropped; F17 gridField/reachMap duplication accepted (reachMap is gen, returns flags). Global constraints copy refreshed.
Task 1: dispatched (BASE 509646e, sonnet)
Task 1: implementer DONE_WITH_CONCERNS 235549d (231 unit, soak clean, 46 smoke, 43,320 B; goldens unchanged). No RED captured (tests written after). Review dispatched (sonnet)
Task 1: review ✅ Approved (all 4 new tests fail on restored old behaviour in scratch).
Task 1: minor (deferred): duplicate follow-cap expression at fight.js:142/:165; no test that los uses muzzleAt; stalk cap has no floor.
Task 1: complete (commits 509646e..235549d, review clean)
Task 2: dispatched (BASE 235549d, opus)
Task 2: implementer DONE 89c13db (235 unit, soak 0, 58 smoke, 45,501 B; F1 test mutation-checked). Calls: help line no longer hides on lock; #seed shown only in play; pov proxy until Task 3; finish() only in play/ending; buttons blur on click.
Ruling R2: the help line shows at the start of each play run and hides after 20 s of play time (spec: minimal Quake-like HUD; the pause menu will carry the controls). — If wrong: one constant.
Task 2: R2 applied 5f503db (235 unit, 60 smoke, 45,520 B). Accepted: #seed shown only in play (attract seed never looks like the player's). Review dispatched (opus)
Task 2: review ✅ Approved (opus; probes: no GPU leaks over 3 title/play/end cycles incl. base swap; throwing localStorage end screen OK; fatal paths on end screen OK).
Ruling R3 (carry to Task 3): the pause menu shows the controls (the HELP text) so R2's premise holds; New Game/Back click handlers run inside the same fatal path as tick (lost=true, cancel raf, hud.fatal) — Task 2 minor 1; add a smoke test with a throwing Storage (getItem/setItem) covering settings + end screen — Task 2 minor 2. — all touch Task 3's files (main.js, settings, pause). — If wrong: small UI copy change.
Task 2: minor (deferred): "without WebGL2" fatal-overlay assertion vacuous; file:// hash-write check dropped (plan-mandated); #seed also visible on the end screen; report count nit.
Task 2: complete (commits 235549d..5f503db, review clean)
Task 3: dispatched (BASE 5f503db, sonnet) with R3
Task 3: implementer DONE 463f4c5 (239 unit, soak 0, 70 smoke, 47,197 B). R3 done (guard() fatal path, #controls, throwing-Storage smoke). No RED run for unit tests. Note for Task 8: pausable() covers play/ending only — add the opening. Review dispatched (sonnet)
Task 3: review — Important 1: Esc after a fatal error (or context loss) pops #pause over #msg (pausable() ignores `lost`). Fix round 1 dispatched.
Task 3: minor (deferred): Esc keydown / pointerlockchange handlers not wrapped by guard; R3 smoke covers only New Game; pause test doesn't assert frozen bolts/aliens; two near-duplicate storage-throw tests; frame.t keeps animating during pause (cosmetic); real-Chrome Esc resume may not re-lock (keyboard play unaffected).
Task 3: fix round 1 done 305338a (239 unit, 74 smoke). Re-review dispatched (sonnet)
Task 3: fix round 1/5 (1 addressed, 0 open — no pause after fatal/context loss; commits 463f4c5..305338a)
Task 3: complete (commits 5f503db..305338a, review clean after 1 fix round)
Task 4: dispatched (BASE 305338a, opus)
Task 4: implementer NEEDS_CONTEXT (uncommitted; 244 unit, bot soak 59/60 under F18's stall rule — BOT-0036 stalls behind the hangar bunker after knock-backs). Probe's rule (stall when still > BOT.stall): 480/480 runs, 60/60 soak.
Ruling R4: revert pre-flight F18 to the plan drafter's probed stall rule (stall when `still` > BOT.stall, 45 s); the brief's pen test passes either way. — evidence: 480/480 vs 468/480. — If wrong: an attract run in a real stall takes up to ~47 s to give up.
Ruling R5: fix the pre-existing flaky Task 3 smoke test "Esc pauses and releases the mouse" (chromium under parallel load; fails at 305338a too) by polling pointerLockElement instead of a single read. — test-only. — If wrong: nothing.
Task 4: implementer DONE_WITH_CONCERNS b6c710e (R4) + 9f2ba9c (R5 test: wait for lock before Esc) (244 unit, bot 60/60, 76/76 smoke twice, 48,629 B). Found a real race: a late-granted pointer lock can arrive after pause/finish/toTitle, so the end screen or title holds the lock (breaks F1).
Ruling R6: input tracks lock intent; pause/finish/toTitle/quit clear it, and a lock that arrives while intent is off is released at once (pointerlockchange -> exitPointerLock); add a smoke test that requests a lock after finish() and expects it released and #back clickable. Separate commit. — real product bug against F1. — If wrong: nothing visible.
Task 4: R6 done 4ad68fe (245 unit, 80/80 smoke twice, 48,620 B). Review dispatched (opus) over b6c710e, 9f2ba9c, 4ad68fe.
Task 4: review ✅ Approved (opus; bot pure/deterministic, 3-4 us/step; R6 traced on every path).
Note (carry to Tasks 9 & 11): attract runs must stay silent — gate SFX/music/radio hooks on run kind/state.
Task 4: minor (deferred → final review): no structural cap on attract run length (suggest F.time > 600 -> done='stall'); fail() doesn't release a held lock (one input.unlock()); per-frame allocations in bot.js:87/:109 and nav descend/fieldDir closure; older pre-R6 lock race (ms window); no test that a wanted lock is kept ~300 ms; input.test restores; PITCH literal duplicated.
Task 4: complete (commits 305338a..4ad68fe, review clean)
Task 5: dispatched (BASE 4ad68fe, opus)
Task 5: implementer DONE 597614f (252 unit, soak 0, bot 60/60, 86 smoke, 49,655 B; goldens unchanged; mutation-checked). Finale bot knocked > 1 m from the call spot 3-21% of the hold (always returns). Radio gate placeholder quiet=true for Task 11. Review dispatched (opus)
Task 5: review ❌ Needs fixes (opus). Important 1: finale bot pinned behind the dish pedestal on hold (no field steering, no jiggle); BOT-0028 >1 m away 36% of the hold; test passes even with an idle hold stage.
Ruling R7: finale bot steers by bot.cf (baseField to the call spot) when not parked, straight line inside the call tile; test asserts the longest stretch > 1 m from the call spot stays < 5 s on its seeds; brief wording becomes "walks back to within 1 m after a knock". — bot is test tooling but its test must prove the hold. — If wrong: nothing player-facing.
Ruling R8 (deliberately in this round; a player-facing bug): stepHold does nothing unless F.state === 'play', and restartArea resets F.won — a death in Houston's step must not reach the ending or leave a frozen hold. Add a test. — If wrong: nothing.
Ruling R9: end-screen time freezes at Houston (F.wonAt), so best times don't depend on voice/speech speed and ending kills don't count (kills also frozen at Houston). — fairness for best-time-per-seed. — If wrong: time includes ~6-14 s of ending.
Task 5: minor (deferred): no committed replay through the stand; dishOf per frame in area 3; callSpot allocation in bot; spawn on a player standing in an alcove (bodies() separates).
Task 5: fix round 1 dispatched (resume implementer)
Task 5: fix round 1 done d3c635d (254 unit, bot 60/60, soak 0, 86 smoke, 49,751 B). R7: bot runs home on hold (worst off-spot 3.55 s over 120 seeds). R8 guard state==='play' && hp>0. R9 kills not counted after Houston. Re-review dispatched (sonnet)
Task 5: fix round 1/5 (3 addressed, 0 open — R7 bot hold, R8 no Houston while dead, R9 time/kills freeze at Houston; commits 597614f..d3c635d)
Task 5: minor (deferred → final review): a blast/bolt death in steps 6-8 of Houston's step still sets won (one-step window; main.js:167 checks only its own state); parked bot's dodge drifts it briefly.
Task 5: complete (commits 4ad68fe..d3c635d, review clean after 1 fix round)
Task 6: dispatched (BASE d3c635d, opus)
Task 6: implementer DONE_WITH_CONCERNS 787ce45 (264 unit, soak 0, 88 smoke, goldens unchanged, 52,183 B). Carry to Task 8: refresh frame.occTex after scene.wreck(). Debris: no collision/shadow, spread 21-95 m, foil sheets part-buried. Review dispatched (sonnet)
Task 6: review ✅ Approved (determinism, goldens, earlier tests all hold; screenshots gritty). Controller viewed 6-intact-oblique + 12-blast-1.2s: on-style.
Task 6: carry → Task 8: refresh frame.occTex after scene.wreck() (useScene copies it once).
Task 6: minor (deferred → final review): resting cabin ~37 m down the route has no collision (walk-through) — candidate fix: a cylinder push-out like canisters; flying foil sheets read saturated orange-gold in sun (look pass); debris 80-95 m culled; debris rests on world.h not rock stamps; front/back faces have no foil (brief table).
Task 6: complete (commits d3c635d..787ce45, review clean)
Task 7: dispatched (BASE 787ce45, opus)
Task 7: implementer DONE_WITH_CONCERNS 8feac0f (275 unit, soak 0, 88 smoke, 52,176 B; prompt player through in 32.7 s). Concerns: floater removed 0.4 m in the air at blast+3 s; all foil life exactly 9 s (~130 specks vanish together 3.5 s into play); flag planted near the deck can float ~0.3 m on the ramp.
Ruling R10: fix all three before review — foil life jittered from the opening's seeded rng (e.g. 7-11 s, mean 9 s per the brief); the opening floater is removed only after it has landed (or sinks/fades out on the ground); the planted flag stands on the ground the game draws under the pole base (sample the bare terrain at the pole, not the deck ramp). — visible showpiece glitches. — If wrong: small look tweaks.
Task 7: R10 done 6f33538 (278 unit, 88 smoke, 52,176 B). Flag ground = occ with deck disc reset to bare terrain (1 MB copy once at plant). Review dispatched (opus)
Task 7: review ❌ Needs fixes (opus). Important 1 (plan-mandated, cross-task): with Task 11's FIFO radio and OPEN timings, a prompt planter hears "are we expecting anyone?" after the blast and the title line after the stamp.
Ruling R11: gate the company beat on the step line: O._compT = max(t, O._groundT + OPEN.talk) + OPEN.company with a new OPEN.talk = 3.5 (reviewer's model: every line lands before its beat, title line ~0.3 s after the stamp). Also in this round (cheap, same file): drawnGround becomes a 4-tap allocation-free sample living beside wreckOcc in lander.js (Minor 1); the private FX tuning table is exported and named with the tuning tables, and test 12 reads it (Minor 2). — storyboard order is user-approved. — If wrong: aliens appear up to ~3.5 s later for prompt planters.
Task 7: carry → Task 11: add a Houston nag line if the player stays in the cabin (phase landed) > ~20 s (Minor 7).
Task 7: minor (deferred → hands-on): knock-down mostly airborne (1.7 s of 2 s, peak ~1.2 m); opening aliens ~6-12 px at 40 m rising from flat ground (spec says over a crater rim); plume stops on the future deck height; small per-step closures.
Task 7: fix round 1 dispatched (resume implementer)
Task 7: fix round 1 done be8139a (279 unit, 88 smoke). Blast at 30.67 s, stamp 36.17 s for a prompt planter; new FIFO radio test 15. drawnGround 4-tap in lander.js; FX exported. Global constraints copy: FX added to tuning tables.
Task 7: carry → Task 8: throughOpening smoke helper must add OPEN.talk; refresh frame.occTex after scene.wreck().
Task 7: re-review dispatched (sonnet)
Task 7: fix round 1/5 (3 addressed, 0 open — R11 radio gate, drawnGround 4-tap, FX table; commits 6f33538..be8139a)
Task 7: carry → Task 11: opening test 15 duplicates SCRIPT lines and queue constants (SAY table); Task 11 should export them and make test 15 import them (cross-check).
Task 7: complete (commits 787ce45..be8139a, review clean after 1 fix round)
Task 8: dispatched (BASE be8139a, opus) with carries: occTex refresh after scene.wreck(); throughOpening adds OPEN.talk; pausable() must include the opening.
Task 8: implementer DONE_WITH_CONCERNS 5ab040d (282 unit, soak 0, 94 smoke, goldens unchanged, 56,757 B; all four carry-overs done, mutation-checked). Concerns: planted flag's cloth hides the company actors on 60/60 seeds when planting at the prompt; touchdown dust arcs barely read; blast/glitter/dust ring happen behind the default view (debris shows in the knock-down view).
Ruling R12: the flag plants ~1 m to the left of the view line (cloth hangs away from the view centre) and the company actors stand ~20 deg right of the facing direction, so the waving alien is visible from the prompt plant spot; add a test that the sight line from the plant spot's eye to the waving alien misses the flag cloth on >= 20 seeds. Concerns 2-3 accepted for the hands-on check (spec: you look up at Earth while debris drifts; the cabin is thrown into that view). — the company beat is a storyboard beat. — If wrong: small staging offsets.
Task 8: R12 done a2cbea4 (283 unit, 94 smoke, 56,829 B). Review dispatched (opus)
Task 8: review ✅ Approved (opus; state flow clean, opening render allocation-free once warm, +4.6 KB is opening.js entering the bundle).
Task 8: minor (deferred → final fix wave candidate): R12 flag cloth 1 m ahead fills ~43%x45% of the company frame (reads as a dark slab); raise OPEN.plant.ahead to ~1.75 m (table-only; R12 test guards the sight line).
Task 8: minor (deferred): no smoke for quit/fault/context-loss mid-opening; stamp check depends on a 3.5 s real-time unstamp timer; auto-plant far away puts the company 96-224 m from the lander (works; untested); foil twinkles while paused.
Task 8: complete (commits be8139a..a2cbea4, review clean)
Task 9: dispatched (BASE a2cbea4, sonnet) — carry: attract runs silent; pause suspends sound; audio never breaks the game.
Task 9: implementer DONE 01d1f65 (292 unit, seeds pass, 98 smoke, 58,997 B). One unconfirmed chromium pause-test failure during a concurrent run. Review dispatched (sonnet)
Task 9: review ✅ Approved (every audio path guarded; attract silent; context only on first click; filter follows level).
Task 9: carry → Task 10: guard buildSfx() at boot with try/catch -> {} (and the same for song rendering) so a generator throw can't show the fatal screen.
Task 9: minor (deferred): air/vacuum smoke checks only the flag (not crater, cut value, New Game from base); throwing-constructor only unit-tested; no footsteps in the opening (brief reading).
Task 9: complete (commits a2cbea4..01d1f65, review clean)
Task 10: dispatched (BASE 01d1f65, sonnet)
Task 10: implementer DONE_WITH_CONCERNS f59718c (298 unit, seeds 0, smoke 101/102 then fixed a Task 9 air-test race; 60,729 B). Songs unheard; rendered peaks ~1.5 (surface/base) may clip the master with sfx; MIX.fade 0.5 added; boot guarded. After the first New Game, the title plays surface under attract (plan call).
Ruling R13: normalise each rendered song to a peak <= 0.9 at render time and add a guarded DynamicsCompressorNode (limiter) on the master before the destination; re-run the full smoke suite. — prevents clipping; by-ear tuning stays for the hands-on. — If wrong: slightly quieter music.
Task 10: R13 done ea8482f (300 unit, 102/102 smoke, 60,806 B). Review dispatched (sonnet)
Task 10: review ❌ Needs fixes. Important 1: probable click at the loop seam (buffers cut at songLength; drone/pad releases truncated; brief Step 4 requires no click).
Ruling R14: render songLength + a tail (>= the longest release, ~2 s) and fold the tail additively onto the buffer start, so the loop is seamless; add a test that the seam jump (|end - start| and slope) is within the buffer's normal sample-to-sample range on all four songs. Also in this round (cheap): songs land per song (a callback/promise per song) so the wanted song starts as soon as its own buffer is ready, and a hung startRendering only loses that song. — If wrong: a few KB more render time.
Task 10: minor (deferred): crossfade test only counts sources; music map branches untested (opening pre/post title, houston none, area-3 restart, end hold); limiter fallback assert trivial; New Game surface blip (inaudible); compressor makeup gain on the master needs a by-ear check.
Task 10: fix round 1 dispatched (resume implementer)
Task 10: fix round 1 done 5f792c2 (302 unit, 104 smoke, 60,886 B). Re-review dispatched (sonnet)
Task 10: fix round 1/5 (2 addressed, 0 open — R14 seamless loop fold, per-song landing; commits ea8482f..5f792c2)
Task 10: complete (commits 01d1f65..5f792c2, review clean after 1 fix round)
Task 11: dispatched (BASE 5f792c2, opus) with carries: attract silent; opening test 15's SAY table imports Task 11's exported SCRIPT/queue constants; a Houston cabin nag after ~20 s in phase landed; Task 5's quiet=true placeholder becomes radioIdle.
Task 11: implementer DONE_WITH_CONCERNS c395dde (319 unit, soak 0, 110 smoke, 66,323 B, goldens unchanged; all 4 carry-overs done; script 151 lines with the cabin nag).
Ruling R15: a speech error (other than interrupted/canceled) does not end the line; the line continues as subtitle-only for its normal unvoiced duration (Review Focus 1: no voices / failing voices). Add a unit test with a fake voice that errors at once.
Ruling R16: the dawdle clock does not run while on hold (F.hold active) or after Houston. Add a test.
Task 11: minor (deferred): once-only reactions are spent even if their line goes stale behind story lines.
Task 11: R15/R16 done 30b4246 (322 unit, soak 0, 112 smoke, 66,399 B). Review dispatched (opus)
Task 11: review ✅ Approved (opus; copy verbatim, ASCII, pure/seeded, ending can't hang, 66,399 B).
Task 11: minor (deferred → final fix wave candidates): reaction cues after Houston step on the punchline and stretch the ending (skip reactions once F.won); music un-ducks/re-ducks between lines of one sequence (keep duck while R.q non-empty); ending gate untested (radioIdle vs ENDING.min/max); some lines clash with triggers (dawdle "standing still", "base is that way" inside the base, fall lines mention the switchback anywhere); R15 carve-out effectively dead; long comment lines.
Task 11: complete (commits 5f792c2..30b4246, review clean)
Ruling R17: Task 12 skips the hands-on step on real hardware (user away; same as Plans 2/3) and records it as pending; if WebKit can't run on this machine, record that and keep chromium+firefox. — If wrong: nothing; the user does the check.
Task 12: dispatched (BASE 30b4246, opus)
Task 12: implementer DONE 55a956e (322 unit, goldens unchanged, soak 0, bot 60/60, 114 smoke, 66,399 B; WebKit can't launch on Fedora 44: missing libicu74/libjpeg-turbo8; hands-on pending). Review dispatched (sonnet)
Task 12: review ✅ Approved (two-game flow, no fixed waits, mutation-checked). Hands-on checklist gaps (Plan 2 Step 5 / Plan 3 Step 3 items) — controller compiles the full checklist in the final summary and memory.
Task 12: complete (commits 30b4246..55a956e, review clean)
Final review: dispatched (opus), range 400d576..55a956e
Final review: With fixes (opus; 322 unit, 114 smoke, bot 60/60, soak clean, 66,399 B, goldens unchanged). Important: I1 ending punchline cut off / stepped on; I2 pause controls saturated blue. Minors M3-M10. No rulings overturned; R12 amended (1.75 m), R4 gets a hard cap.
Ruling R18: after Houston only the houston event reaches the radio; a non-critical reaction on air is cut when Houston fires; tests for the ending gate. — the game's final joke. — If wrong: a reaction line is cut short at the end.
Ruling R19: #pause input accent-color #7a7266 (palette). — spec no-saturated-UI anti-goal.
Ruling R20: fail() and context loss also pause audio, cancel speech and release the pointer lock.
Ruling R21: BOT.max = 600 s hard cap on attract runs (amends R4).
Ruling R22: OPEN.plant.ahead = 1.75 (amends R12).
Ruling R23: radio 'off' keeps the music ducked while a critical line waits (R.q.some(l => l.crit)).
Ruling R24: hide #prompt/#flash while paused; no wrap on the sensitivity label.
Ruling R25: KILLS excludes kills by alien bolts (team 1); Houston's kill reactions follow suit. — If wrong: one condition.
Final: deferred (can wait / hands-on): M8 boot cost + memory (buildSfx 155 ms, engine sfx 55% of samples, source arrays kept), M9 attract-silence smoke depth, and every "can wait" triage line.
Final fix wave: dispatched (BASE 55a956e, opus), list at final-fixes.md
Final fix wave: DONE_WITH_CONCERNS 9f51f50..7a83c7c (328 unit, soak 0, bot 60/60, 126 smoke, goldens unchanged, 66,844 B). Residual: with a dead-onend voice, a reaction starting 76.5-77 s into the hold delays the last 'holding' line onto Houston, so ENDING.max still cuts the punchline. Pause slider tracks/unchecked box stay browser light grey (not saturated; hands-on).
Ruling R26 (completes R18 within the same wave): on Houston, cutReaction also cuts a 'holding' (switchboard hold) line on air, and waiting holding lines are dropped from the queue; test the dead-onend case. — the punchline is the game's last beat. — If wrong: a hold message is cut at Houston.
Final fix wave: R26 done ed62a19 (330 unit, 126 smoke, 66,858 B). Scoped re-review dispatched (opus) over 55a956e..ed62a19.
Final fix wave re-review (opus): all 8 addressed (R18+R26, R19, R20, R21, R22, R23, R24, R25), no new breakage.
Final: parked — canister blasts set off by alien bolts still count toward KILLS (per R25's wording) — Ruling: park for the hands-on. — If wrong: one more condition.
Final: parked — pause slider tracks/unchecked checkbox stay browser light grey (not saturated) — Ruling: hands-on look pass.
Controller verification on ed62a19: 330 unit, seeds 0 failures, bot 60/60, 126/126 smoke, 66,858 B.
