# Plan 5 (polish): design

*Date: 2026-11-03 · Status: approved in chat; written up for the overnight run*

This addendum to `2026-11-02-one-small-problem-design.md` (the spec) covers six small changes the user asked for after their first play-test. Tags follow the spec:
- **[user]**: the user asked for it or approved it in chat on 2026-11-03.
- **[call]**: Claude's call. The user asked for an overnight run ("make your own choices, we can always change it later"), so every number here is a starting value to be tuned by hand.

The spec still binds everything not changed here: the 131,072-byte cap, WebGL2 only, no network, determinism in `src/gen`, and a pure simulation in `src/game`.

## 1. Health drops **[user]**

Health is duct tape (`PICKUP.tape`, +25 hp, taken only when you're hurt). Today it is placed by the generators only. Aliens never drop it.

- **The first alien the player kills in a run always drops tape** **[user]**. This is the player's first kill of the run (`F.kills` going from 0 to 1, whichever area it happens in). It drops on top of whatever that alien already drops, such as the first encounter's pistol. The two pickups sit apart so both read.
- After that, kills drop tape by chance **[call]**:
  - brutes: always, alongside their scattergun
  - floaters: 20%, alongside their cells
  - skitterers: 10%
- Drop chances come from the sim's own seeded rng (`F.rng`), like the pistol drop. Generation is untouched, so the golden checksums stay.
- Tape you can't use stays on the ground, as now (ruling R11 of Plan 2).
- Kills that don't score (an alien's bolt finishing another alien, R25, or kills after Houston picks up, R9) don't count as the "first kill". They still roll the chance drops.

## 2. Tape you can see **[user]**

The user didn't notice tape at all. It is a small grey roll on grey ground.
- Make the roll about 1.6× bigger **[call]**.
- Make its silver side brighter, so it isn't lost in regolith **[call]**.
- Give it the golf balls' glint: a short sparkle on its own beat, so it catches the eye from a distance **[call]**.
- It must still look like a roll of tape, not a power-up. Keep the gritty look: no floating, no spinning, no halo.

## 3. Red hurt vignette **[user]**

Today a hit tints the whole frame toward dark red (`post.frag`, `uK.x`, at most 0.18).
- Replace it with an **edge vignette**: red that grows in from the screen edges, clear in the middle **[user]**.
- **On a hit:** it flares in proportion to the hit (the existing `F.hurtT`), then fades over about half a second **[call]**.
- **Low health:** below the radio's low-health threshold, a faint red rim stays, with a slow pulse (about 1 Hz) **[call]**.
- **Dead:** a heavy vignette that leaves only the middle of the screen **[call]**.
- The colour stays the existing dark blood red `(.45, .04, .02)`. It is applied after tone mapping and before the palette, like the tint it replaces, so the dithered palette still holds.

## 4. A voice per speaker **[user]**

There are three speakers: Houston (H), You (Y) and the hold Switchboard (S). Today all three use one browser voice, told apart only by pitch and rate (`VOICE` in `script.js`).
- Each speaker gets its own voice where the browser has more than one **[user]**:
  - From the voices on offer, keep the English ones, local voices first, in a stable order (sorted by name, so the same machine always gives the same cast).
  - Houston gets the first; You get the first voice that isn't Houston's; the Switchboard gets a third if there is one, otherwise Houston's.
  - Prefer a voice whose `lang` is `en-US` for Houston, and a different accent for You where one exists, so they differ in more than timbre **[call]**.
- The per-speaker pitch and rate in `VOICE` stay, and are the fallback when only one voice exists **[call]**.
- Choose again on every `voiceschanged`, as now. A line in flight keeps its voice.
- Every failure path stays as it is: no voices means subtitles only, and a voice that errors leaves the line to its subtitle (R15).

## 5. Wayfinding arrow **[user]**

From the wreck to the crater door is about 500 m. Today only the radio and the encounters along the route guide you.
- **The arrow:** a small arrow at the top centre of the screen points to the next objective, with the distance in whole metres under it **[user]**. It is drawn as HUD text (a rotated chevron), in the HUD's colours and font, not a 3D object.
- **Targets:**
  - On the surface (area 0): where the switchback leaves the crater rim (`crater.top`).
  - In the crater (area 1): the hangar door's use point (`crater.use`) **[call]**.
  - Plan 6 adds its own outdoor targets.
- **When it shows:** only during play, outdoors. It is hidden:
  - in the opening, while paused, when dead, and indoors (the base and comms room)
  - within 12 m of the target, so the last stretch is yours **[call]**.
- **How it turns:** the arrow's angle is the target's bearing relative to where you're facing, and it updates every frame. It is never a full minimap.

## 6. A flag pole that hits spiders **[user]**

Today the swing hits whatever lies inside a cone from your eye: `cosArc` 0.8 (about 37° each side), reaching 2.2 m past the target's radius. A skitterer is short. Within about 1.5 m it sits more than 37° below eye level, so a level swing misses it, which is exactly when it is biting you.
- **Judge the swing side to side:** a target is hit when its horizontal bearing lies within the arc and its body overlaps the swing's height band. The band runs from the player's feet (minus 0.3 m) to 0.5 m above the eye **[call]**.
- **Widen and lengthen it:** arc `cosArc` 0.8 → 0.65 (about 49° each side), and reach 2.2 → 2.6 m **[call]**.
- Damage, cooldown and knock-back stay as they are.
- This is a fix as much as a buff, so no other weapon changes.

## 7. Verification

- Unit tests pin each rule:
  - the first scoring kill drops tape
  - each kind's drop chance, over a seeded sample
  - a skitterer at the player's feet 1.2 m ahead, and one 40° to the side, is hit by a level swing
  - one behind the player is not hit
  - voice assignment against fake voice lists of 0, 1, 2 and 3 voices
  - the arrow's bearing and visibility rules
  - the vignette uniforms per state
- Smoke tests:
  - the arrow shows on the surface and hides in the base
  - a hurt frame's edges are redder than its centre
- The bot soak, seed soak and size cap still pass. The golden checksums must not move, because generation is untouched.
- **Hands-on**, added to the checklist:
  - vignette strength
  - whether the arrow is helpful without being a crutch
  - which voices each browser picks
  - tape visibility
  - whether the flag pole now feels fair against spiders
