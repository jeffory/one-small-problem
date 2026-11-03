# One Small Problem: decisions record

This file is the single place to find every decision made while building the game. Most of them were made autonomously while the user was away, either during plan execution or overnight on 2026-11-02/03. The user can overturn any of them.

## Where the decisions live

| What | Where |
|---|---|
| Design and the user's own decisions (tagged `[user]`), plus Claude's calls (`[call]`) | `docs/superpowers/specs/2026-11-02-one-small-problem-design.md` |
| Each plan's design calls, marked `[call]` in the text | `docs/superpowers/plans/*.md` |
| Pre-flight amendments, tagged `(pre-flight Fn)` in the plan text | Plans 3 and 4 |
| Every execution ruling, deferred minor finding and parked item for Plans 3 and 4 | `docs/superpowers/ledgers/*.md` |
| The user's pending hands-on checklist | below, and in project memory (`hands-on-checklist`) |

## State at the end of the overnight run (2026-11-03)

- `main` is at ed62a19.
  - Plan 1 merged at a25892a, Plan 2 at e43f407, Plan 3 at 400d576 and Plan 4 at ed62a19.
  - All merges were local fast-forwards; there is no remote.
- The game is complete: title and attract bot, opening, surface, crater, base, comms-room final stand, end screen, pause and settings, sound effects, music and radio.
- Release `dist/index.html` is 66,858 B, 51% of the 131,072 B cap.
- Tests: 330 unit, 126 smoke (chromium and firefox), the 1000-seed soak and the 60-seed bot soak all pass.
- Golden checksums:
  - APOLLO-4471 `ca0c9fe6`
  - EAGLE-0001 `dd7f8ffc`
  - SOAK-0042 `5671ed28`
- If any generation table changes, re-pin the goldens in the same commit.
- WebKit/Safari was never run. Playwright's WebKit can't launch on Fedora 44 because it needs libicu74 and libjpeg-turbo8.
- The user has not yet played Plans 2–4 on real hardware.

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

## Deferred minor findings

Every "minor (deferred)" line, with its triage, is in the two ledgers. The Plan 4 final review triaged them all as "can wait" or "hands-on", apart from the ones the fix wave fixed.

## Hands-on checklist

Use this on real hardware (Radeon 890M, Chrome and Firefox). Tuning goes in the tables only.

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
- fps at the lift (248–455 draws).
- Hangar difficulty: an idle player dies in about 5 s.
- Floaters in 10 m rooms.
- Lamps snap off as you leave them.
- Reactor brightness against plasma.
- Plasma light shows through walls.
- Golf glint.
- Sliding past corners and lintels.
- The Firefox mouse wheel.

### Plan 2
- Hurt tint strength.
- Pole pose.
- Floater telegraph pulse.
- Canister lethality.
- Skitterer bite rate.
- Tape visibility.
- fps near the rim.
