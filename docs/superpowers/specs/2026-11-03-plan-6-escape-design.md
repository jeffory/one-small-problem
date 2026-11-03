# Plan 6 (the escape): design

*Date: 2026-11-03 · Status: concept approved in chat; details are Claude's calls for the overnight run*

This addendum to `2026-11-02-one-small-problem-design.md` (the spec) adds a second level. It builds on Plan 5 (`2026-11-03-plan-5-polish-design.md`), which lands first. Tags:
- **[user]**: the user proposed or approved it in chat on 2026-11-03.
- **[call]**: Claude's call. The user asked for an overnight run ("make your own choices, we can always change it later"), so every story beat, number and name here can be overturned.

The spec's hard constraints (§3) bind as before: one HTML file of at most 131,072 bytes, WebGL2, no network, determinism in `src/gen`, and a pure simulation in `src/game`.

The architecture survey behind this design is `.superpowers/escape-brief.md`. It is git-ignored scratch, so the plan must restate whatever it relies on.

## 1. What changes and why

The game becomes **two levels** **[user]**:
1. **Level 1** is today's game. It now ends with the knock-out instead of the end screen.
2. **Level 2** is the escape: a prison break, the climb back out of the crater, and a dash to the rescue vehicle. Then the end screen.

A full run grows from 10–15 minutes to about **20–30 minutes** **[user]**, which overrides the spec's §1–2 target. Level 2 should take about 10 minutes for a first-time player **[call]**.

Room: the build is at 67 KB of 128 KB. Level 2 is estimated at 12–20 KB packed, so it must land under about 95 KB **[call]**.

## 2. The story beats

1. **Houston picks up**, exactly as today: *"Houston, go ahead."* / *"Houston… we have one small problem."* (spec §4.3, **[user]**).
2. **Houston replies, and is cut off mid-sentence** **[user]**:
   - **Houston:** *"Copy. We heard. Rescue vehicle is go, touchdown at your lander in twenty min—"*
   - The dash is part of the line, as in the opening's *"I'm stepping off the—"*. When that line's talk ends, a heavy **thud** plays, the radio dies (no closing Quindar tone) and the screen cuts to black **[call]**.
3. **Black.** The title stamp, in the opening's style, reads **ANOTHER SMALL PROBLEM** **[call]**.
4. **The wake-up.** The view opens on the floor of a cell, with the Plan 5 vignette closed in and the look locked. You get up, as in the opening's knock-down. The radio crackles back:
   - **Houston:** *"…come in. Come in. You were out for two hours."*
   - **You:** *"They took my guns."*
   - **Houston:** *"Did they take the flag? …They left the flag. They think it's a religious item."*
5. **The prison break** (§4).
6. **The lift** at the end of the prison comes up through the hangar door in the crater floor, where level 1 went in **[call]**.
7. **The climb** back up the switchback to the rim (§5).
8. **The dash.** From the rim, the rescue vehicle comes down by your wrecked lander. You have to reach it before it leaves (§6).
9. **Boarding and lift-off.** From inside the cabin you watch the ground fall away while the aliens below wave you off. Then the sting **[call]**:
   - A clicking sound in the cabin.
   - **You:** *"Houston… we have one more small problem."*
   - The cut to the end screen (§8).

## 3. Areas, checkpoints and the knock-out

**New areas** **[call]**, appended so area numbers keep only increasing:

| Area | Name | Level | Start (death restarts here) |
|---|---|---|---|
| 4 | prison | `prison` | in the cell, bars already open (§4.1) |
| 5 | climb | `surface` | outside the hangar door, facing the switchback |
| 6 | dash | `surface` | at the crater rim, facing the wreck |

**Transitions:**
- 4 → 5: E at the prison's exit lift.
- 5 → 6: walk out over the rim, the reverse of today's 0 → 1.
- 6 → the end: E at the rescue vehicle's ladder.

Area text on entry (spec §4.3 style): `THE CELLS`, `THE CLIMB`, `THE DASH` **[call]**.

**The knock-out lives in the pure simulation**, not only in `main.js` **[call]**. Today the Houston → end-screen step happens only in the shell. It must become a sim transition, so the bot soak and the replay test can play through both levels. `main.js` only reacts to events, such as fading, showing the stamp and swapping the scene.

**"Houston picked up" is split.** Today `F.won` means five things at once. They separate as follows:
- **From Houston until you wake** (the knock-out sequence), and only then:
  - you can't be hurt
  - kills don't count
  - the radio carries only the Houston and knock-out lines
- **At boarding** (the true end):
  - the end-screen clock freezes, as R9 does today at Houston
  - the attract bot and the soak bot count the run as done
  - you can't be hurt again
- Every test that pins today's behaviour (R8, R9, R18/R26, and the Houston-ending smoke tests) moves to these new points. The rule each one guards stays.

**On waking:**
- The plasma weapons and all cells are gone. The flag pole stays, held **[call]**.
- Health is 70: you took a knock **[call]**.
- Kills, golf balls and time carry over.
- The cell is the area 4 checkpoint, holding this stripped kit.

## 4. The prison (area 4)

**A config pass on the base generator, not a copy of it** **[call]**. `generateBase` gains a config: the start room's theme, the end block's theme, the theme order and fractions along the path, room sizes, path length and the alien budget. Everything theme-specific in `planBase` (the hangar, reactor and greenhouse lookups) moves behind that config. The base's own config reproduces today's output exactly, so its golden part doesn't move. The prison uses its own seed stream (`seed + '/prison'`) and a smaller layout **[call]**:
- critical path of 6–8 rooms (the base has 8–12)
- 2–3 side rooms
- 1 loop

### 4.1 The cell and the break-out (the one new mechanic)

**Start room `cell`** **[call]**: a 5 × 5 room with a low ceiling. Its one doorway is closed by **energy bars**: a row of glowing teal bars filling the doorway.
- They are dynamic: while closed, the doorway tiles block movement, line of sight and the nav field. When they open, the tiles turn back to floor and the bars aren't drawn.
- There are no other doors anywhere in the game, so this stays a single-purpose mechanism, not a door system.

**Breaking out** **[call]**:
- Facing the bars within reach, the prompt reads `[E] bang on the bars`.
- **The Switchboard** (the alien voice from the hold), over the PA: *"PRISONER. QUIET."*
- After about 3 s, a guard (one skitterer) comes down the corridor, the bars drop, and it comes in to check on you. Kill it with the flag pole.
- The guard is the prison's `first` encounter, so it always drops a **pistol** (weapons still come only from aliens, spec §4.5). It also always drops **tape**.
- **If you idle** for 20 s without banging, Houston prompts: *"Try banging on the door. Works in every movie."*
- **After a death** in area 4, it depends on whether the guard is dead **[call]** (from the builder check):
  - **Guard dead:** you restart in the cell with the bars open and no guard. The guard's pistol and its cells are in your kit, whether or not you'd picked them up. This works like Plan 3's R12, which adds the flag to the checkpoint when you grab it.
  - **Guard alive:** dying before you kill it replays the whole beat: the bars are closed and the guard comes again.
  - Either way, a death in the prison never leaves you with only the flag pole for the warden.

### 4.2 The rooms

**Themes along the critical path** **[call]**: cell → cell block → guard room → interrogation → evidence locker → lift hall. Plain rooms fill the gaps.
- **cell block:** a long room whose walls are lined with barred alcoves (decoration only; the same bars, always closed). One alcove holds **a cow**. *"Is that a cow?" / "That would explain a lot of reports from Nebraska."*
- **guard room:** crates and a brute warden.
- **interrogation:** a reclined chair under a probe arm. A gag prop; nobody's in it.
- **evidence locker:** shelves of confiscated junk, plus cells and tape. A golf ball sits here ("Evidence item one: a golf ball.").
- **lift hall:** the 2×2 end block, a 20 × 20 hall with the **exit lift** at its centre and crates for cover. The prompt is `[E] take the lift`. No spawn doors and no wave: the climax is saved for the rescue (§6).
- **Side rooms** are empty cells. They are where the tape sits.

**Look** **[call]:**
- The base's fog and banded point lights, with cold teal lamps in the cell rooms.
- The amber of the base's working rooms.
- The red flicker lamps only in the lift hall.
- Gravity is the base's.

**Fight:**
- The same aliens as the base. The alien budget runs low to high along the path (p from 0.4 to 0.9) at the base's scale (0.5, H2), so the early rooms suit a player with only a flag pole and a fresh pistol **[call]**.
- The base's rules for brutes and floaters apply.

## 5. The climb (area 5)

**Reversed route** **[call]**. You come up in the crater floor outside the hangar door and climb the switchback to the rim. The terrain doesn't change.
- A fresh **encounter plan for areas 5 and 6** is generated along the existing route, run backwards, on its own seed streams (`/escape/...`).
- This needs `planFight`'s closures refactored into a route-generic planner, without changing the draw order of the existing level 1 plan. Its golden part must not move.
- Difficulty: the crater encounters are like level 1's crater **[call]**.
- The Plan 5 arrow points to the rim.

## 6. The dash and the rescue (area 6)

**The landing.** On entering area 6 (at the rim), the rescue vehicle comes down near the wreck. It reuses the opening's descent motion and dust, and a landing light. **[call]**
- The vehicle is the same lander model, intact. *"It's the same model as yours. Try not to let them blow this one up."*
- It lands on a flat, standable spot 20–30 m from the wreck, chosen by generation from its own seed stream (`/escape/site`).
- It is always drawn, whatever the 80 m cull, so it shows as soon as it rises over the horizon.
- **It can't be seen from the rim** (builder check). The surface bends the horizon (`curv` 1/1800 in `surfaceScene.js`, also in `world.vert` and `sprite.vert`). On 5 seeds, the wreck lies 379–422 m from the rim and 80–99 m below the bent horizon, so the landing happens out of sight. So **[call]**:
  - **The flare:** at touchdown the vehicle fires **a red signal flare**. It climbs to about 150 m above the site, then drifts down over about 40 s. It is one small red-orange sprite with a thin grey smoke trail: a real flare, not a glow or a bloom.
  - **The radio:** *"Pilot's down. He's put up a flare. Follow the flare."*
  - **The rest of the way:** the Plan 5 arrow and the radio carry it after the flare.
  - **The smoke test** checks that the flare is above the horizon from the rim, not the ship.
- It has a collision cylinder in area 6 only. It is not stamped into the terrain's occluders, so level 1 doesn't change.

**The clock** **[user]**: "reach the rescue vehicle before it leaves". **[call]**
- A countdown starts when area 6 starts. It shows under the Plan 5 arrow as `SHIP LEAVES m:ss` and turns red under 30 s.
- Its length is tuned from the bot soak: the worst bot run must finish with at least 30% of the time spare. The starting value is 240 s.
- The radio counts it down in jokes (*"Pilot says three minutes." … "Pilot says he's serious this time."*).
- **If it runs out**, the vehicle lifts off without you and area 6 restarts at the rim, like a death. *"They'll come round again. Be at the ship this time."*

**The rush** **[call]**:
- The dash's encounter plan runs from p 0.6 to 1.0, so the dash is harder than level 1's surface.
- When you get within 60 m of the vehicle, a last wave of aliens comes over the ridges toward it. It reuses the hold's wave planner, generalised to take spawn points (a ring 30–40 m round the vehicle), with its own alien id band.
- Boarding needs no stand: reach the ladder and press E. The prompt reads `[E] board`.

**Boarding** ends the run (§3's freeze points). Then the lift-off.

## 7. Lift-off **[call]**

The spec's "never leave the helmet" (§4.2) holds:
- The lift-off is seen from inside the cabin, as the opening is.
- The ascent stage (cabin, hatch, dish) rises off the descent stage with engine glow.
- The aliens round the site turn and wave, using the existing wave pose.
- The ground falls away. After about 6 s, the stowaway sting from §2 step 9 plays, then a fade to the end screen.

## 8. Score and end screen **[call]**

- **Time** runs from the first step to boarding. The knock-out and the wake-up don't count, as the opening doesn't today.
- **Golf balls:** two more, so `GOLF_TOTAL` goes 5 → 7. One is in the evidence locker. One is on the dash, off the route like the surface ones. Each gets a radio line.
- **Best times** use a new storage key (`osp.best2.<seed>`), so a one-level best never beats a two-level run.
- **The share link and seed** work as today. The same seed always builds the same prison and the same escape plan.

## 9. Radio and music **[call]**

- **About 50 new lines** for the beats above, plus: idle prompts in the cell, the guard, the flag-pole joke, the cow, the interrogation chair, the evidence golf ball, the lift, the climb, the landing, the countdown, the rush, the boarding and the sting.
- **The Switchboard** is the prison PA.
- **A new speaker, the Pilot** (`P`), talks during the dash. Plan 5's voice assignment extends to four speakers; the pilot falls back to the Switchboard's voice and then to pitch and rate.
- **Two new songs:**
  - `prison` for area 4: slow and tense.
  - `escape` for areas 5–6: driving.
- Silence through the knock-out. The Plan 5 song rules (normalised, limiter, seamless loops) apply.

## 10. The bot

- **The attract bot** still plays level 1 only, and is done at the comms room as today.
- **The soak bot** plays the whole game: wreck → … → comms → hold → knock-out → wake → bang on the bars → prison → lift → climb → dash → board.
- The soak must pass on 60 seeds within a raised limit (1500 s of sim time) **[call]**. It is the proof that level 2 can be finished, and it tunes the ship clock (§6).

## 11. Verification

- **Unit tests:**
  - the prison generator against its config: themes in order, the cell's barred doorway, the lift hall, everything reachable once the bars open
  - the bars' open and closed states (movement, line of sight, the nav field)
  - the break-out beat, and its once-only rule after a death
  - the knock-out flag split, with each moved rule (R8, R9, R18/R26) re-pinned at its new point
  - the ship clock, both the time-out restart and boarding
  - the wave ring
  - the area tables
  - the golf total
- **The replay test** covers a run through the knock-out into the prison.
- **The seed soak** covers the prison maps (1000 seeds) and the escape plans.
- **The bot soak** covers both levels (§10).
- **Smoke tests:**
  - the knock-out to the stamp and the wake
  - the prison renders
  - the bars open
  - the lift to the climb
  - the flare visible above the horizon from the rim
  - boarding to the end screen
  - with `ospTest` hooks to jump to level 2.
- **Goldens:** the prison and escape plan are appended to the checksum. The goldens are re-pinned once, in the commit that appends them. The level 1 parts must hash the same as before; a test checks this by comparing a checksum that leaves out the appended parts.
- **Size:** at most about 95 KB.
- **Hands-on**, added to the checklist:
  - Does the knock-out land?
  - Is the wake-up readable?
  - Does the bang-on-the-bars beat work?
  - Prison difficulty with only a flag pole.
  - Does the reversed climb feel fresh enough?
  - The ship clock's length.
  - Does the flare read from the rim?
  - Does the prison feel fair after a death?
  - The lift-off from the cabin.
  - The stowaway sting.
  - Total run time.

## 12. Left to the plan

How to split the work into tasks. The exact model shapes for the bars, cow, chair, probe arm, shelves and exit lift. The new songs' notes. The exact wording of the lines beyond the beats quoted here. The bot's stage logic for level 2.

Keep it lean: reuse before adding. Every new system named here (the bars, the ship clock, the wave ring, the knock-out director) should be as small as its job.
