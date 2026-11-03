# One Small Problem: decisions record

This file is the single place to find every decision made while building the game. Most of them were made autonomously while the user was away, either during plan execution or overnight on 2026-11-02/03. The user can overturn any of them.

## Where the decisions live

| What | Where |
|---|---|
| Design and the user's own decisions (tagged `[user]`), plus Claude's calls (`[call]`) | `docs/superpowers/specs/2026-11-02-one-small-problem-design.md` |
| Each plan's design calls, marked `[call]` in the text | `docs/superpowers/plans/*.md` |
| Pre-flight amendments, tagged `(pre-flight Fn)` in the plan text | Plans 3, 4 and 5 |
| Every execution ruling, deferred minor finding and parked item for Plans 3, 4 and 5 | `docs/superpowers/ledgers/*.md` |
| The user's pending hands-on checklist | below, and in project memory (`hands-on-checklist`) |

## State at the end of the overnight run (2026-11-03)

- `main` is at ed62a19.
  - Plan 1 merged at a25892a, Plan 2 at e43f407, Plan 3 at 400d576 and Plan 4 at ed62a19.
  - All merges were local fast-forwards; there is no remote.
- The game is complete: title and attract bot, opening, surface, crater, base, comms-room final stand, end screen, pause and settings, sound effects, music and radio.
- Release `dist/index.html` is 66,858 B, 51% of the 131,072 B cap.
- Tests: 330 unit, 126 smoke (chromium and firefox), the 1000-seed soak and the 60-seed bot soak all pass.
- Golden checksums (at ed62a19; re-pinned by H4 below):
  - APOLLO-4471 `ca0c9fe6`
  - EAGLE-0001 `dd7f8ffc`
  - SOAK-0042 `5671ed28`
- If any generation table changes, re-pin the goldens in the same commit.
- WebKit/Safari was never run. Playwright's WebKit can't launch on Fedora 44 because it needs libicu74 and libjpeg-turbo8.
- The user has not yet played Plans 2–4 on real hardware.

## State after Plan 5 (overnight run 2, 2026-11-04)

- The user asked for a second overnight run: Plan 5 (polish) and Plan 6 (the escape, a second level). Their approved list and the designs are in `docs/superpowers/specs/2026-11-03-plan-5-polish-design.md` and `2026-11-03-plan-6-escape-design.md`.
- Before Plan 5, `main` gained the CI fix (281663a): GitHub's runners have no GPU and no sound card, so Firefox runs headed under xvfb with a silent PulseAudio sink, the pause-menu flash check waits for the flash, and CI retries a failed test once. It was proven in an Ubuntu 24.04 container (126/126) but **has not been pushed**: no push happens without the user's say-so.
- Plan 5 was merged locally (fast-forward). 348 unit tests, the 1000-seed soak, the 60-seed bot soak and 130 smoke tests pass. The release is about 68.3 KB. Generation is untouched, so the goldens are unchanged.

## How the overnight run worked

The user said: "continue on the plans overnight, make your own choices, we can always change it later".

- Opus subagents drafted Plans 3 and 4 with writing-plans. An Opus pre-flight scan then checked each plan. It found 28 defects in Plan 3 and 29 in Plan 4, and all were fixed in the plan text before execution.
- Each task ran subagent-driven: an implementer, then a task review, then fix rounds if needed. Each plan finished with a whole-branch final review, one fix wave and a scoped re-review.
- Gameplay was never retuned blind. Tuning is deferred to the hands-on check.

## Plan 2 (Fight) rulings

These were made during Plan 2 execution. The Plan 2 ledger was deleted after merge, so this list is the record.

| Ruling | Decision |
|---|---|
| R1 | `hurtPlayer` makes death synchronous: hp ≤ 0 enters `'dead'` at once. |
| R2 | Melee also counts as a shot: it resets `shotT` and emits `fire`. |
| R3 | The encounters↔surface import cycle was allowed by reading only inside functions. Plan 3 removed it with `generateWorld`. |
| R5 | flagSpot test tolerance is 1e-6, because of float32. |
| R6 | Pickup forward offset is ±4 m. |
| R7 | Behaviour defaults: floaters and brutes hold still while aiming, turning is instant, and knock-back slides corpses. |
| R8 | Guards: no bites from below, no floater shots beyond sight, floaters never clip the ground. |
| R9 | The skitterer bump distance is 1.0 m, between two chasing skitterers only. The plan's 0.7 m sat inside the separation distance. |
| R10 | `F.kills` is a lifetime stat. |
| R11 | Pickups you can't use stay on the ground when you're full. |
| R12 | Alien lumps use the shipped noise, not the spike's. |
| R13 | Pole pose, later replaced; the floater aim flash, later a pulse. |
| R14 | The hands-on check is deferred. |

The final-review fix wave added:

| Ruling | Decision |
|---|---|
| R15 | Canisters keep 1.2 m apart. |
| R16 | The player collides with live walkers and canisters. |
| R17 | The hurt tint is a capped mix after tone mapping. |
| R18 | The pole is held low. |
| R19 | Minor wave: floater pulse, cooldown carry, the dead body falls, separate decal rings, wheel accumulator, HUD pointer-events, the health number turns red, fallback to the best affordable weapon, and a replay test. |

## Plan 3 (The base) rulings

The full text, with the cost of each ruling if it turns out wrong, is in `ledgers/2026-11-02-plan-3-base-ledger.md`.

| Ruling | Decision |
|---|---|
| R1 | All 28 pre-flight fixes accepted. Notable choices: comms room spans +2..+22 with alcoves at +1, the re-roll gate is "no seed exhausts", and canisters are placed before aliens. |
| R2 | The base re-rolls up to 32 attempts, not 8, so no seed fails. |
| R3 | The lift arrival tile is the first room tile past the corridor. |
| R4 | The saucer is 4 m wide, to fit its footprint. |
| R5 | Floaters probe their leading edge at two points. |
| R6 | An existing box overlap never pins the player. |
| R7 | Floaters can't pass lintels, so they hold their room. |
| R8 | A dead-straight push into a door jamb stops you. |
| R9 | One base test uses god mode. |
| R10 | No decals or particles are spawned inside walls. |
| R11 | The groundNormal step clamp applies indoors only. |
| R12 | Grabbing the flag adds only the flag to the checkpoint snapshot. |
| R13 | Greenhouse stalks are static. Core radii are 1.5 and 0.9. |
| R14 | The dynamic-light formula stays as written. |
| R15 | Goldens are pinned before the hands-on check. |
| R16 | Overturns F16: lamp radius is bounded by hidden floor (2D sight), not the nearest wall, and lamps hang at +2.65 m. This took base floor lit from 28% to about 74%. |
| R17 | Dim crater guide beacons, render-only. |
| R18 | Fall damage: more than 7 m/s costs 8 hp per m/s. |
| R19 | Greenhouse eyes dimmed, indoor blasts gated by line of sight, and lift pipes get collision. |

Parked at the end of Plan 3:
- Walking down the crater wall is free and faster than the switchback. This is for the hands-on check.
- The outdoor fall-speed cap launched players off steep slopes. Plan 4 Task 1 limited it to the crater.

## Plan 4 (Show) rulings

The full text, with the cost of each ruling if it turns out wrong, is in `ledgers/2026-11-03-plan-4-show-ledger.md`.

| Ruling | Decision |
|---|---|
| R1 | All 29 pre-flight fixes accepted. Among them: the end screen releases pointer lock, `advance()` clears events, and walking is allowed during the descent. |
| R2 | The help line hides after 20 s of play. |
| R3 | The pause menu lists the controls. New Game and Back go through the fatal path. A throwing-storage smoke test was added. |
| R4 | The bot stall rule reverts to the drafter's probed rule (480/480). |
| R5 | A flaky pause smoke test was fixed. |
| R6 | Pointer-lock intent is tracked, so a late lock is released. |
| R7 | The finale bot paths back to its call spot. |
| R8 | Dying in Houston's step can't reach the ending. |
| R9 | End-screen time and kills freeze at Houston. |
| R10 | Glitter life is jittered, the dead floater lands before removal, and the flag stands on the drawn ground. |
| R11 | The aliens' entrance waits for the first-step radio line (`OPEN.talk` = 3.5). This keeps the radio in storyboard order. |
| R12 + R22 | The flag is planted 1.75 m ahead and 1 m left, with aliens about 20° right, so the wave is visible. |
| R13 | Songs are normalised to a 0.9 peak, with a master limiter. |
| R14 | Seamless song loops: the tail is folded in, and each song lands on its own. |
| R15 | A failing speech voice falls back to subtitles for the whole line. |
| R16 | No dawdle lines on hold or after Houston. |
| R17 | The hands-on check is deferred, and WebKit is recorded as unable to launch. |
| R18 + R26 | When Houston picks up, reactions and hold chatter are cut so the punchline lands. Only Houston reaches the radio after that. |
| R19 | Pause controls use accent-color #7a7266. |
| R20 | A fatal error or context loss pauses audio, cancels speech and unlocks the pointer. |
| R21 | Attract runs cap at 600 s. |
| R23 | Music stays ducked while a critical line waits. |
| R24 | The HUD is hidden behind the pause menu. |
| R25 | KILLS excludes alien-bolt kills. |

Parked at the end of Plan 4:
- Canister blasts set off by alien bolts still count as kills.
- Pause slider tracks are the browser's light grey.
- Boot cost: `buildSfx` takes about 155 ms, and the 9 s engine sound is 55% of all SFX samples.
- The attract-silence smoke test only checks the radio.

## Hands-on rulings (after the user's first play-test, 2026-11-03)

The user reported: "it's extremely difficult when you go into the base because there's so many aliens. Either reduce the amount of aliens or increase the length of corridors so the player has room to run." A headless probe over 40 seeds backed that up: base corridors had a median length of 3 m (basically doorways), about 55 aliens, and an idle player at the lift took 100 damage in about 4.6 s. The immortal bot took about 1100 damage in the base, against about 545 on the surface and in the crater combined. Both changes were made.

| Ruling | Decision |
|---|---|
| H1 | Longer corridors: base cells go from 12 m to 18 m (map 96 → 144 tiles), and rooms sit within 1 tile of their cell's centre (`BASE.jitter`). Corridors now run 6–15 m (median 10). The comms room stays 20 × 20, centred in its block, and its one corridor shifts inside it. `src/gen/base.js` |
| H2 | Fewer aliens: `BASE_SCALE` 0.7 → 0.5. That cuts the base from a median of 55 aliens to 38. Brutes still need a room budget of 6 or more, so the first even room may have none. `src/gen/baseplan.js` |
| H3 | Result: the bot's base damage drops from about 1100 to about 590, roughly the same as the surface and crater combined. The hangar crowd no longer wakes while you stand at the lift (median 0 alerted after 10 s, was 6). |
| H4 | The goldens were re-pinned: APOLLO-4471 `60273c6a`, EAGLE-0001 `39762eb2`, SOAK-0042 `ee4eda57`. The R2 slow-seed list moved to APOLLO-2428, EAGLE-4739, CRATER-7635 and MERCURY-5618; 60,000 seeds all generate within 10 of 32 attempts. |
| H5 | The user asked: "Can the aliens drop like 20% more ammo?" Every alien drop carries 20% more cells: pistol 20 → 24, scattergun 16 → 19, floater cells 15 → 18. Drop chances are unchanged, so the rng and the goldens are too; placed tape and cells and the final-stand supplies stay at 25. `PICKUP` in `src/game/fight.js` |

If it is still too hard (or now too easy), the knobs are `BASE_SCALE` (alien budget), `BASE.cell` (corridor length) and `PICKUP` (drop sizes). 18 is the most a 20 m comms room allows: past that, its shifted corridor no longer stays inside the neighbouring room's band. Shorter cells also need the soak's 6–15 m corridor bound changed.

## Plan 5 (polish) rulings

The full text, with the cost of each ruling if wrong, is in `ledgers/2026-11-03-plan-5-polish-ledger.md`.

| Ruling | Decision |
|---|---|
| F1 | Each tuning table's starting value is pinned once, in the test that names it, so a hands-on retune changes the table and its one pin. |
| F2 | A dropped tape never lands in a wall or off a ledge (symmetric height check). |
| F3 | A recast of voices never cuts the line being spoken. |
| F6 | No low-health red rim after Houston picks up, so the win and the end screen don't pulse red. |
| F7 → FR1 | In the crater the arrow follows the switchback. F7's first rule (the vertex after the nearest one) swung backward mid-leg, so the final review replaced it: aim at the end of the nearest switchback leg, then the next corner once within 12 m, then the door. |
| F8, F9 | Hands-on checks: the pole can't reach floaters overhead; with exactly one local voice, You and the Switchboard can land on an online voice. |
| F10-F14 | Test-helper sharing, stale comments, qualified R-numbers, superseded Plan 2 checklist lines. |
| FR3 | Voices are told apart by name, so a duplicated voice entry is never cast twice. |
| FR4 | The vignette (`VIG`) and tape glint (`TAPE_GLINT`) tables are pinned like the others. |

Starting values to tune by hand: the swing (`WEAPONS[0]`: reach 2.6, arc .65, band −.3 to 2.2), tape drops (`PICKUP.tapeDrop`: skitterer 10%, floater 20%, brute always; first scoring kill always), tape size (`TAPE_R` .144), the vignette (`VIG`), the arrow (`WAY.near` 12 m).

## Deferred minor findings

Every "minor (deferred)" line, with its triage, is in the two ledgers. The Plan 4 final review triaged them all as "can wait" or "hands-on", apart from the ones the fix wave fixed.

## Hands-on checklist

Use this on real hardware (Radeon 890M, Chrome and Firefox). Tuning goes in the tables only.

### Plan 5
- **Vignette** (`VIG` in `src/game/fightView.js`): is the hit flare strong enough without hiding the fight? Below 30 hp, is the slow pulse noticeable but not tiring? Does the dead vignette read? After Houston the rim is off even at low hp (pre-flight F6); is the win screen calm?
- **Arrow** (`WAY` in `src/game/areas.js`): helpful without being a crutch? It hides within 12 m of the rim and the hangar door. In the crater it follows the switchback vertex by vertex, then the door (pre-flight F7); does it keep you on the path, and does it flip when you cut across? Pickup flashes moved down to 56 px; do they clash? Does the chevron glyph render in your fonts?
- **Voices** (`castVoices` in `src/audio/speech.js`): which voices do Chrome and Firefox pick for Houston, You and the Switchboard, and are they easy to tell apart? On Chrome, are You's lines actually voiced, or lost to an online voice (Plan 4 R15)? The Switchboard can also land on an online voice when there is exactly one local voice. (pre-flight F9)
- **Tape** (`TAPE_R`, `TAPE_GLINT`, layer 11 in `bake.frag`): can you spot it from a distance? Does it still read as a roll of tape now it lies still on its edge, while other pickups bob and spin?
- **Flag pole** (`WEAPONS[0]`): fair against skitterers now? Any surprise hits on things beside you? It can no longer reach a surface floater overhead (they hover 3-4.5 m up, above the band's top); fine? (pre-flight F8)
- **Drops** (`PICKUP.tapeDrop`): with the first-kill tape and chance drops, is the game now too easy? Every brute drops tape, final stand included.

### Plan 4
- **Title:** does the attract bot look believable? Does the title music play after the first game?
- **Opening:**
  - Do all the beats land, with good comic timing?
  - The flash shouldn't glare, and the glitter should read as specks.
  - Check the dust ring and the touchdown dust arcs.
  - The cabin tumbles toward Earth, and the knock-down is mostly airborne.
  - The company aliens are tiny at 40 m and rise from flat ground. Check the flag framing at 1.75 m.
  - Foil sheets look orange in sun.
  - There are no footsteps in the opening.
- **Radio:**
  - Subtitles should work alone.
  - With a real voice, check for overlaps and cut-offs, especially the punchline with Chrome's Linux voices.
  - Some lines clash with their triggers, e.g. "the base is that way" said inside the base.
- **Sound:**
  - Muffled outside and open in the base.
  - Ducking and Quindar tones.
  - Limiter makeup gain.
  - SFX and song tables, by ear.
- **Final stand:**
  - It lasts about 90 s. Is it winnable?
  - Aliens can spawn onto a player standing in an alcove.
- **End screen:**
  - The share link works over https, and the seed code with Copy works from disk.
  - Best time per seed.
  - KILLS rules.
- **Esc:**
  - Pausing releases the mouse, and settings persist.
  - In real Chrome, Esc-resume may not re-lock the pointer.
- **Resting cabin:** you can walk through it.
- **Overall:**
  - A run takes 10–15 minutes.
  - 60 fps or better.
  - Try Safari if possible.

### Plan 3
- Crater readability with the beacons.
- Walking down the crater wall is free, and running dives cost 10–30 hp.
- Base darkness and readability.
- fps at the lift (248–455 draws before H1's bigger layout; re-check).
- Hangar difficulty: an idle player died in about 5 s. First play-test said the base was far too hard; see H1–H3. Re-check.
- Floaters in 10 m rooms.
- Lamps snap off as you leave them.
- Reactor brightness against plasma.
- Plasma light shows through walls.
- Golf glint.
- Sliding past corners and lintels.
- The Firefox mouse wheel.

### Plan 2
- Hurt tint strength: superseded by Plan 5 (vignette).
- Pole pose.
- Floater telegraph pulse.
- Canister lethality.
- Skitterer bite rate.
- Tape visibility: superseded by Plan 5 (tape).
- fps near the rim.
