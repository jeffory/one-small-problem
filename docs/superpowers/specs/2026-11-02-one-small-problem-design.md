# One Small Problem: design

*Date: 2026-11-02 · Status: draft for approval*

Tags used in this document:
- **[user]**: the user decided this.
- **[call]**: Claude decided this. The user handed over all technical calls; flag any of these if they look wrong.
- **[builder]**: left to the person building it.

---

## 1. What this is and why

**One Small Problem** is a tiny, procedurally generated first-person shooter. The whole game is one web page, and that page is a single HTML file of **at most 128 KB**. It's a tech demo and an experiment, to see how far a tiny procedural game can be pushed in 2026 **[user]**.

The premise is played for laughs. Your lunar crew touches down and you step out of the lander, and aliens are everywhere. They blow up the lander behind you. You fight across the surface to an alien base hidden inside a crater, fight through the base, and reach a comms array to call home **[user]**. The alien base being hidden in a crater is a deliberate wink at "story realism" **[user]**.

The comedy is in the writing and behaviour. The look is gritty, like Quake **[user]**.

What success looks like:
- It loads from one small file.
- You get 10–15 minutes of genuinely playable shooter **[user]**.
- The opening (the lander exploding right after you step out) is the moment people show their friends **[user]**.
- It never looks bright, clean or fake **[user]**.

## 2. Goals, non-goals, anti-goals

**Goals**
- A full run, from stepping out of the lander to making the call home, takes 10–15 minutes **[user]**.
- Every new game generates a different Moon from a seed that can be shared by link **[user]**.
- Spend the room under 128 KB on richness, not on chasing the smallest possible size **[user]**. Expected total is roughly 50–80 KB **[call]**.
- It runs in current desktop Chrome/Edge, Firefox and Safari on Linux, Windows and macOS, using keyboard and mouse **[user]**.

**Approved additions (the full scope of "richer")** **[user]**
The user approved this whole list ("Love it all"). Each item is detailed in the section shown.
1. **Opening set piece:** detailed lander, real break-apart, tumbling debris, foil glitter, dust shockwave, muffled suit audio (§4.2).
2. **Themed base rooms:** hangar with a parked saucer, specimen lab (jars holding a Mars rover and a Soviet probe), glowing reactor, alien greenhouse, comms dish room (§4.3).
3. **Messier combat:** alien goo in slow low-gravity arcs, scorch marks, chain-reacting plasma canisters (§4.6).
4. **Comedic ending:** the comms array puts you on hold, and the final stand plays over alien hold music until Houston picks up (§4.3).
5. **Mission Control talks a lot:** about 150 reactive lines (§4.7).
6. **Secrets:** Alan Shepard's golf balls, hidden around each Moon (§4.8).
7. **Music:** a track per area plus the hold music (§6.8).
8. **End screen:** time, kills, golf balls, a share link, best time per seed (§4.8).
9. **Visual upgrades:** sharper and more varied textures, shadows on aliens, glow around plasma (§5).

Explicitly dropped: a custom robot speech voice **[user]**.

**There is no stretch phase.** Whatever room is left after this list is a safety margin, not more content to fill. Claude proposed this alongside the list, and the user accepted it.

**Non-goals**
- Native builds, Rubix, Vulkan and OpenGL. All of these were dropped once the target became a single web page **[user]**.
- Touch, mobile and gamepad support **[call]**.
- Multiplayer, saving mid-run, and level editors.
- A custom speech synthesizer. The user said to skip the robot voice **[user]**.

**Anti-goals (a failure even if it technically works)**
- **Bright, clean, saturated or plasticky visuals.** Smooth gradients, glossy bloom and the "mobile game" look are out **[user]**.
- Cartoony, googly-eyed aliens. They should be grotesque, and the humour comes from how they behave **[user]**, building on **[call]**.
- A seed that produces a level you can't finish.
- Exceeding 131,072 bytes.

## 3. Hard constraints

| Constraint | Value |
|---|---|
| Shipped artefact | One self-contained `.html` file of ≤ **131,072 bytes**, counted as file size on disk (demoscene rules), not compressed transfer size **[user]**, **[call]**. The build fails if it's exceeded. |
| Runs from | `https://` and opened straight from disk (`file://`). It makes no network requests at all **[call]**. |
| Graphics API | **WebGL2 only.** WebGPU is skipped **[call]**; see §6.1. |
| Input | Keyboard and mouse with Pointer Lock **[user]**. |
| Content | Everything is generated at load: textures, terrain, base layout, models, music, sound effects. Nothing is hand-authored except code, numbers and the radio script **[user]**. |
| Determinism | The same seed must produce the same world in every browser **[call]**; see §6.4. |

---

## 4. The game

### 4.1 Title screen and attract mode **[user]**
- The page opens on a title screen showing **ONE SMALL PROBLEM** with a single option, **New Game**.
- Behind the menu, a bot plays a freshly generated run, like an old arcade attract mode. The bot is immortal and starts a new seed when its run ends **[call]**.
- The bot **never plays the opening**, so it doesn't spoil it. It starts each run at the wreck, after the title drop **[call]**.
- The seed comes from the URL (§4.9). With no seed in the URL, New Game rolls a random one.
- Clicking New Game is also the user gesture that unlocks audio, speech and pointer lock **[call]**.

### 4.2 The opening: "never leave the helmet" **[user]**
The camera stays in first person from start to finish, and you can move around the whole time. It is not a cutscene **[user]**. The beats follow the storyboard the user approved:

1. **Touchdown.** You are inside the lander, looking out of its triangular window as it comes down. The engine cuts out. Dust flies out in clean, airless arcs and falls straight back down.
   *Radio:* "Contact light. Engine stop." / "We copy, you're down. Beautiful work."
2. **First step.** The hatch opens, you climb down the ladder, and your boot meets the dust.
   *Radio:* "Okay Houston, I'm stepping off the—"
   Then you're prompted to plant the flag ("[E] plant the flag"). It's the ceremony the aliens are about to interrupt **[call]**.
   You're alone on the surface. Any crewmate jokes come over the radio **[call]**.
3. **Company.** Aliens appear over a crater rim. One waves.
   *Radio:* "…Houston, are we expecting anyone?"
4. **Boom.** Plasma bolts streak past you into the lander. There is a white flash but no sound, because there's no air. You only hear a deep thud through your boots. The top half of the lander spins off into the sky and gold foil glitters everywhere.
5. **Flat on your back.** The blast knocks you down, the only moment you lose control (about 2 s) **[call]**. You look up at Earth while debris drifts down in slow, low-gravity arcs over several seconds.
   *Radio:* "…say again? We just lost all telemetry from the lander."
6. **Title drop.** You get up, and the title stamps onto the screen.
   *Radio:* "Houston… we have one small problem."
   The flag you planted becomes your first weapon: "[E] grab the flag".

This sequence is the showpiece, so it gets real budget **[user]**:
- a detailed lander that breaks into real pre-cut pieces
- debris tumbling under lunar gravity
- glittering foil particles
- a ring of dust thrown out by the shockwave
- muffled sound, as heard through the suit

### 4.3 Areas and pacing
Each area lasts about 3–5 minutes **[call]**.

1. **The surface.** Open, cratered ground with low-gravity jumping. You follow a carved route from the wreck to the rim of the base crater. This is the first fight, with the first scripted kill guaranteed to drop the plasma pistol **[call]**.
2. **The crater.** Cross the rim and take a switchback path down the crater wall to a hangar door in the crater floor. Fighting gets harder here, and brutes first appear around this point **[call]**.
3. **The base.** Quake-like corridors and rooms laid out on a grid, with themed rooms **[user]**:
   - a hangar with a parked saucer
   - a specimen lab, where jars hold a Mars rover and a Soviet probe
   - a glowing reactor room
   - an alien greenhouse
   - the comms dish room
   Inside the base there is "artificial gravity", close to normal **[call]**.
4. **The comms room: final stand.** This is the largest room, with cover and 3–4 spawn doors **[call]**. Using the array **puts you on hold** **[user]**. Alien hold music plays while waves attack, for about 90 s **[call]**. Then Houston picks up: *"Houston, go ahead."* / *"Houston… we have one small problem."* **[user]** That is the end of the game.

### 4.4 The player **[call]**
- **Controls:**
  - WASD to move, mouse to look, Space to jump, Shift to run
  - E to use or grab
  - 1/2/3 or the mouse wheel to switch weapon, mouse button to fire
  - Esc to pause, which also releases the mouse
- **Gravity:** about ¼–⅓ of Earth's on the surface, tuned so jumps feel lunar but aiming still works. Real lunar gravity (⅙) leaves you in the air about 4 s, which was judged too floaty. Inside the base, gravity is near normal.
- **Health:** 100, restored by **duct tape** pickups (a nod to the Apollo 17 rover repair). They sit in side rooms and before big fights.
- **Death:** restart at the start of the current area, with the same seed and a fresh copy of that area. Dying on the surface puts you back at the wreck; the opening is never replayed.
- **Settings:** the title screen keeps its single option. Resolution, palette on/off, volume, mouse sensitivity and invert-Y live in the **Esc pause menu**, and are remembered in `localStorage` where it's available.
- **HUD:** minimal and Quake-like: health, plasma cells, and the current weapon. There's also a radio indicator and subtitles at the bottom.

### 4.5 Weapons
Weapons only come from aliens **[user]**. All weapons are rounded and cylindrical (built from lathed parts), not boxy **[user]**.

| Weapon | Source | Feel **[call]** |
|---|---|---|
| Flag pole | The flag you planted | Melee, infinite, slow, knocks enemies back. You fall back to it when out of cells. |
| Plasma pistol | Skitterers **[user]**, guaranteed from the first scripted kill **[call]** | Fast single bolts, 1 cell per shot. |
| Plasma scattergun | Brutes **[user]** | A spread of 5 bolts, 4 cells per shot, short range. |

Floaters drop plasma cells (ammo) **[call]**. In the look test, the pistol is a ribbed barrel with glowing coil rings, a fleshy bulb at the back, an organic grip and a veiny feed tube **[user]**.

### 4.6 Aliens: design "A · Crawlers" **[user]**
The user chose these three types from the look test. Each has its own silhouette. Shots must **leave the alien's own weapon point** **[user]**.

| Type | Look | Fires from | Behaviour **[call]** |
|---|---|---|---|
| **Skitterer** | A six-legged tick or spider, about 0.7 m tall. Fleshy abdomen, chitin head, mandibles, a cluster of four glowing eyes. Scuttles with a tripod gait. | Between its mandibles: small, fast teal bolts. | Comes in groups and spreads out. Chases you and lunges when within about 3 m. Weak. |
| **Floater** | A jellyfish gas sac with seven swaying tentacles, a glowing ring underneath and one glossy eye with a glowing iris underneath. | Its underside eye: slow, large, yellow-green orbs you can dodge. | Hovers and holds its height. Keeps 10–20 m away, circles you, telegraphs, then fires. |
| **Brute** | A hunched, armoured crab-gorilla about 2.4 m tall. Chitin carapace and shoulder plates over flesh. One giant swinging claw; the other arm is an organic plasma cannon. | Its arm-cannon muzzle: the scattergun-style spread. | Slow and tanky. Telegraphs its aim for about 0.8 s, fires a 5-bolt fan at ±20°, then recovers for a long time. |

- **Comedy comes from behaviour** **[call]**:
  - one waves right before shooting
  - they trip over each other
  - skitterers bump into each other
  - brutes overcommit and stagger
- **Combat mess** **[user]**: alien goo splatters in slow low-gravity arcs, there are scorch marks, and explosive plasma canisters chain-react.
- **Reference implementation:** `spikes/look-test.html` (design A, line-up scene 3) holds the shapes, materials, part-based animation and muzzle points. Treat it as the visual reference, not as code to keep.

### 4.7 Mission Control radio **[user]**
- **About 150 short lines** of Mission Control chatter that react to what you do: the opening beats, low health, big kills, finding secrets, dawdling, each area transition, and being on hold **[user]**, **[call]**.
- **Voice:** the browser's own speech synthesis (`speechSynthesis`), always with **subtitles** **[user]**. No custom voice synthesizer **[user]**.
- **Radio feel:** Quindar tones play before and after each line (250 ms sines, 2525 Hz before the line and 2475 Hz after), plus a short burst of static and a quiet noise bed under the line. Music ducks while someone is talking **[call]**.
- **Constraints the research found**, which the builder must handle:
  - Speech can't be routed through Web Audio, so the radio filter can't touch the voice itself.
  - Chrome on Linux only offers Google's online voices, which can take more than 4 s to appear. Firefox on Linux uses robotic espeak voices. Some setups have no voice at all.
  - So: wait for `voiceschanged` with a timeout, keep lines short, and use a timer as a fallback for `onend`, which Chrome's online voices sometimes never fire.
  - Subtitles alone must carry the jokes.

### 4.8 Secrets, end screen, replay **[user]**
- **Secrets:** Alan Shepard's golf balls from Apollo 14, hidden around each Moon. They feed into radio lines and the end screen.
- **End screen:** time, kills, golf balls found, and a **share link** for the seed. The best time per seed is remembered in `localStorage`, wrapped in try/catch so the game still works without it **[call]**.

### 4.9 Seeds **[user]**
- A new Moon every game, and the seed lives in the URL hash. It looks like a mission name, e.g. `#APOLLO-4471` **[call]**, built from about 32 Apollo-flavoured words and a 4-digit number.
- Any text works as a seed, because the string is hashed **[call]**.
- Sharing the link reproduces the same Moon.
- **Hosting:** a plain web host, such as GitHub Pages or the user's own site **[user]**.
  - The share link is the page's own address without the hash, plus `#SEED`.
  - When the game is opened from disk (`file://`), the end screen shows the seed code with a copy button instead of a link.
  - Embedded hosts like itch.io are not supported **[call]**.

---

## 5. Look (style bible)
The user approved this look from the look test (`spikes/look-test.html`), specifically the moon surface, the lander, the flag, aliens design A and the rounded gun **[user]**. The values below are the starting point **[call]**.

- **Low internal resolution, chunky pixels:** 480×270 by default (the height is fixed and the width follows the window's aspect ratio). The image is scaled up with nearest-neighbour filtering. Options for 180, 360 and native height.
- **Fixed muddy palette with ordered dithering:** the final image is snapped to about 51 colours with 4×4 Bayer dithering. The palette covers warm greys, rust, bronze/olive, bruise-purple, teal/green glow, plasma cyan, sickly yellow-green, reds, Earth blues and golds. Starting values are in the look test's `PAL` string. A setting can turn it off.
- **Textures:** 256² per layer, nearest-filtered when close, mipmapped, with visible texels.
- **Surface lighting:**
  - A low sun, so every rock and rim casts pitch-black, hard-edged shadows.
  - A Lommel–Seeliger/Lambert mix for the flat lunar look.
  - A faint blue Earthshine fill, no fog, and low exposure, so plasma is the brightest thing on screen.
  - The horizon curvature is exaggerated to hide the edge of the map.
  - Earth is drawn about 3–5× its true size.
- **Base lighting:**
  - Pools of amber and sickly-teal light with dark gaps between them.
  - Light is banded into about 14 steps, Quake-style.
  - Murky green-brown fog.
  - Rusty, oily bronze, gunmetal and purple panels with grime in the seams.
  - The occasional dim glow strip on a wall, kept rare.
- **Glow:** additive plasma billboards with short trails, and bolts light the surfaces around them. No bloom haze.
- **Aliens:** grimy, fleshy and chitinous, with wet specular highlights on their shells and eyes. Their silhouettes read clearly.
- **Avoid:** affine texture warping and vertex snapping (those are PS1 traits, and they warp big floors), smooth gradients, bloom haze, and saturated UI.

---

## 6. Technical design

### 6.1 Platform and language **[call]**
- **Plain JavaScript, no WASM.** In every comparison the research found, WASM plus its JS glue came out bigger than equivalent JS (iq's 2026 port of Elevated; GLQuake C→WASM vs. the WebQuake JS port).
- **WebGL2 only.**
  - WebGL2 reaches about 98% of browsers.
  - WebGPU still fails on most Linux setups. On the user's own machine (AMD/Wayland, Chrome 156), `requestAdapter()` returns null, and stable Firefox on Linux doesn't ship WebGPU at all.
  - Maintaining two backends would mean writing every shader twice.
  - Nothing in this look needs compute shaders.
- **A float colour buffer** via `EXT_color_buffer_float` (99.95% of browsers), falling back to RGBA8.

### 6.2 Rendering pipeline **[call]**
The look test implements this whole pipeline.

1. Render the scene into a low-resolution half-float colour buffer with depth.
2. On the surface, draw the sky first: stars, the Earth disc with phase lighting, and the sun.
3. Draw the world meshes with one shared material shader:
   - Textures come from a texture array, mapped by projecting along each face's main axis, so no UVs are needed.
   - Fine surface detail (bumps) comes from the texture's height channel.
   - Sun shadows are found by marching through a height map that includes rocks and the lander, plus up to 8 sphere occluders for aliens.
   - Up to 16 point lights per pixel.
4. Draw plasma as additive billboards.
5. Clear depth and draw the first-person gun.
6. Run a post pass that tone-maps, dithers, snaps to the palette, then copies to the screen with nearest-neighbour scaling.

The base will have more than 16 lights, so each frame picks the nearest or most relevant 16 **[builder]**.

### 6.3 Procedural textures **[call]**
- **How they're made:** one fragment shader holds every material recipe, and runs once at load into two texture arrays:
  - albedo plus height
  - emissive
- **Building blocks:** tiling value noise, fBm and Worley noise. Each texture is a recipe made from these, with no stored images.
- **Mipmaps:** generated with `generateMipmap`.
- **Materials in the look test:** regolith, rock, alien wall panels, floor grate, pipes, gold foil, alien flesh, lander hull, dark glass, macro variation, eye glow, teal lamp, amber lamp, red lamp, reactor, chitin and grey skin. The game adds whatever the themed rooms need **[builder]**.

### 6.4 World generation **[call]**
- **Seeding:** the seed string is hashed with `xmur3` and fed into `sfc32`.
- **Determinism rule:** generation code may only use `Math.imul`, bit operations, `+ − × ÷`, `Math.sqrt` and `Math.floor`. Never `Math.sin/cos/pow/exp` or comparator-based sorts.
  - The ECMAScript spec only approximates `sin` and its relatives, and results have been seen to differ between engines and even between V8 versions.
  - Rendering and animation may use trig freely.
  - The look test breaks this rule (rock placement uses trig). The real game must not.
- **Generation runs without the GPU.** World generation is a pure-JS module with no WebGL dependency, so Node can run it for tests (§6.10).
- **Surface:**
  - A height map of about 512² at 1 m per sample, sized to the route.
  - Craters are stamped from a profile: bowl, raised rim, flat floor on big craters. Their sizes follow a power law, with many small craters.
  - Rocks cluster on crater rims.
  - **The route is carved first:** a jittered waypoint path from the lander to the base crater's rim. Craters and noise are flattened near it, and a ramp is cut through the rim.
  - A grid search checks the path is passable. If a seed fails, it re-rolls with seed+1. The waypoints become the critical path for encounters and the bot.
- **Crater:** the large base crater gets a carved switchback path down its wall to the hangar door.
- **Base:**
  - Build a graph first: a critical path of 8–12 rooms from the entrance lift to the comms room, plus 3–5 side rooms and 1–2 loops, on a coarse grid.
  - Turn it into a tile grid, with a floor and ceiling height per tile.
  - It's connected by construction, and a flood fill confirms it, with seed+1 on failure.
  - Room themes are assigned along the path.
- **Pacing:**
  - The enemy budget grows with progress p. A skitterer costs 1, a floater 2 and a brute 4. Brutes appear only after p ≈ 0.3.
  - Health and cells go in side rooms and before brute rooms.

### 6.5 Models and animation **[call]**
- **Primitive kit** (all in the look test):
  - `box`
  - `beam` (a square beam between two points)
  - `prism`
  - `blob` (an ellipsoid with noise displacement)
  - `lathe` (a profile spun around an axis), used for rounded parts like guns, limbs, tentacles and lander details
- **Parts:** aliens and props are lists of parts. Each part is a mesh plus a function of time that returns its local transform: leg gaits, claw swings, cannon aim, hover tilt. Small vertex-shader effects handle flesh pulsing and tentacle sway.
- **Muzzle points:** each type defines a point on one of its parts, and shots spawn there **[user]**.
- **The exploding lander:** built as separate pieces so it can break apart physically **[builder]** (pieces, impulses and spin).

### 6.6 Collision and movement **[call]**
- One `solid(x,y,z)` query:
  - on the surface: below the bilinear height
  - in the base: a tile lookup
- Q1K3-style movement, resolved one axis at a time. Moves are cut into sub-steps, and a hit cancels that axis's velocity, which gives free wall sliding. Includes a step-up.
- Entities use axis-aligned boxes or spheres.

### 6.7 AI, pathfinding, bot **[call]**
- **Behaviour:** each type runs a small data-driven state table (chase, lunge, hover, telegraph, fire, recover).
- **Line of sight:** a stepped ray through the collision grid.
- **Pathfinding:** one breadth-first-search distance field from the player's tile, refreshed about every 0.25 s, serves every enemy. No A*.
- **Attract-mode bot:** drives the normal player controller with virtual keys.
  - It follows the surface waypoints, and in the base it follows a distance field from the comms room.
  - It aims at the nearest visible alien with a little noise, fires when the aim error is under about 3°, and strafes.

### 6.8 Audio **[call]**
- **Sound effects:** ZzFX (MIT, about 1 KB): plasma shots, impacts, explosions, footsteps, alien chirps, radio static and beeps.
- **Music:** a SoundBox/Sonant-X-style tracker player with short loops for the surface, the crater, the base, and the on-hold track.
  - Everything is pre-rendered at load with `OfflineAudioContext`. This works before any click, and the `AudioContext` is resumed on New Game.
  - The research found that phoboslab thought ZzFX's built-in music sounds "too NES-like", which is why a richer player is used for music.
  - Whether to seed the music from the level seed **[builder]**. No precedent was found for it.
- **Air versus vacuum:** on the surface, every sound effect plays low-passed and thuddy, as heard through the suit, because there's no air. Inside the pressurised base, sounds play normally. Crossing the airlock is the switch.
- **Single-file gotcha:** if an AudioWorklet is used, load it from a `data:` URL, not a `blob:` URL. Chrome rejects `blob:` worklets when the page is opened from disk.

### 6.9 Build and packing **[call]**
```
esbuild (bundle) → Terser (--mangle-props regex=/^_/) → GLSL minifier → jsPackCompress (DecompressionStream 'deflate-raw') → size check (fail > 131072)
```
- **Why `deflate-raw`:** it is the only DecompressionStream format all three browsers support. Brotli would save about 14% but Chrome lacks it.
- **Why not PNG-bootstrap packers:** they break when the page is opened from disk in Chrome.
- **Roadroller:** a further optional pass that saves about 25%, but it costs a load delay of several seconds. Use it only if the build goes over budget.
- **GLSL minification:** laurentlb's Shader Minifier needs .NET or mono. A simple in-house whitespace and identifier minifier is acceptable instead **[builder]**.
- **Size check:** a small Node script that works on all three OSes.

### 6.10 Verification **[call]**
- **Size gate:** the build fails over 131,072 bytes.
- **Determinism:** generate the world for N seeds in Node and record a checksum per seed. The page shows the checksum in debug builds so it can be compared across Chromium, Firefox and WebKit.
- **Solvability:** a test over at least 1,000 seeds checks that a passable route exists from the lander to the comms room and that the critical path holds the required encounters and pickups.
- **Smoke test:** Playwright opens the built file over `file://` and `http://` in Chromium, Firefox and WebKit, and checks for no console errors, that the title screen appears and that New Game starts.
- **Performance target:** 60 fps at 480×270 internal on an integrated GPU, using the user's Radeon 890M as the reference. Measure on real hardware; headless browsers use software rendering.

---

## 7. Size budget **[call]**
These are compressed-size estimates. The look test (about 50 KB of raw, unminified code, about 19 KB gzipped) already covers much of the rendering, textures and models.

| Area | Estimate |
|---|---|
| Engine core, renderer, post pass | 8–12 KB |
| Texture recipes | 3–5 KB |
| World generation (surface, crater, base, themes) | 5–8 KB |
| Models, animation, opening set piece | 8–12 KB |
| Gameplay, AI, bot, weapons, pickups | 7–10 KB |
| Audio: player, songs, sound effects | 6–9 KB |
| Radio script (about 150 lines) | 3–4 KB |
| UI: title, HUD, subtitles, end screen | 2–3 KB |
| **Total** | **about 42–63 KB; plan for 50–80 KB** |

Anything over 100 KB is a warning sign, and over 131,072 bytes fails the build.

## 8. Decisions at a glance

**[user]**
- the premise and the comedy-through-writing approach
- 128 KB, a single web page, desktop with keyboard and mouse
- the Quake/PS2 look, gritty and not bright
- the name and the title screen with attract mode
- the never-leave-the-helmet opening
- 10–15 minutes, new seed each game, shareable seed
- Mission Control radio with browser speech and subtitles, no robot voice
- spending the spare room on richness: exactly the approved additions in §2, with the remainder kept as margin
- alien design A with shots from muzzle points
- the rounded gun
- weapons only from aliens

**[call]**
- JS over WASM, WebGL2 over WebGPU
- the rendering approach, palette and dithering
- generation algorithms, the determinism rule, xmur3 + sfc32
- gravity values, health as duct tape, ammo as cells, the death and checkpoint rule
- the weapon stats, the floater ammo drop and the first scripted kill
- AI approach, bot approach
- the audio libraries, Quindar tones and static
- the packing pipeline, the test plan and the size budget

## 9. Left to the builder
- Code layout and module boundaries, as long as generation stays independent of the GPU.
- How to cull lights in the base.
- Exact tuning: speeds, damage, timings, spawn counts, palette values, exposure.
- The physics of the lander break-up.
- Whether music is seeded from the level seed.
- The choice of GLSL minifier.
- The exact radio script. Short, dry NASA humour, about 150 lines, matching the beats above.
- HUD layout within the "minimal, Quake-like" brief.

## 10. Risks
- **Speech on Linux** is unreliable, so subtitles must carry the jokes alone.
- **Performance of per-pixel shadow marching** plus 16 lights on weak GPUs. Fall back to lower resolution, fewer march steps or fewer lights.
- **Cross-browser determinism:** follow the generation rule strictly and check it with checksums.
- **Comedy timing** depends on the writing; budget time for iterating on the script.

## References
- Q1K3 making-of (js13k 2021; collision, entity state tables, Sonant-X): https://phoboslab.org/log/2021/09/q1k3-making-of
- .kkrieger (procedural 96 KB FPS): https://en.wikipedia.org/wiki/.kkrieger
- farbrausch texture-generator source: https://github.com/farbrausch/fr_public
- jsPackCompress: https://github.com/flashkot/jsPackCompress
- Roadroller: https://github.com/lifthrasiir/roadroller
- ZzFX: https://github.com/KilledByAPixel/ZzFX
- SoundBox: https://gitlab.com/mbitsnbites/soundbox
- WebGPU implementation status: https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
- Speech can't be routed to Web Audio: https://github.com/WebAudio/web-speech-api/issues/69
- PRNGs (xmur3, sfc32): https://github.com/bryc/code/blob/master/jshash/PRNGs.md
- Quindar tones: https://en.wikipedia.org/wiki/Quindar_tones
- Look test (visual reference, throwaway): `spikes/look-test.html`
