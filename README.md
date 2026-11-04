# One Small Problem

A tiny procedurally generated first-person shooter set on the Moon. The whole game is one HTML file with a hard cap of 128 KB (131,072 bytes). It currently builds to about 77 KB.

**Play it at https://jeffory.github.io/one-small-problem/**

You step out of the lander, plant the flag, and aliens blow up your ride home. Fight across the surface to an alien base hidden in a crater, fight through the base, and reach the comms array to call Houston. Houston puts you on hold. When Houston finally picks up and promises a rescue ship, an alien knocks you out. You wake in a prison cell, break out, climb back to the surface and race to the ship before it leaves.

Every new game generates a different Moon from a seed, and the seed in the URL lets anyone replay the same one.

## Playing

Play the hosted copy at https://jeffory.github.io/one-small-problem/. It is the latest `main` that passed CI.

Or build it yourself, then open `dist/index.html` in a browser. It works straight from disk or from any static web host.

```sh
npm install
npm run build
```

The title screen runs a demo bot. Choose **New Game** to start. A full run, both levels, takes about 20–30 minutes.

| Control | Action |
|---|---|
| Click | Capture the mouse to look |
| W A S D | Move |
| Shift | Run |
| Space | Jump |
| E | Use (plant the flag, open doors, call home) |
| 1–3, mouse wheel | Switch weapon |
| Left mouse | Fire |
| Esc | Pause and settings |

You start with only the flag pole. Every other weapon comes from the aliens you kill, and they drop most of your ammo and some repair tape too (the first alien you kill always drops tape); a few cell packs and repair tapes lie around. Five of Alan Shepard's golf balls are hidden on each Moon.

The pause menu has resolution, palette, volume, mouse sensitivity and invert Y. Settings are saved in the browser.

### Seeds

The seed is the part of the URL after `#`, for example `dist/index.html#APOLLO-4471`. The same seed always builds the same Moon. Seeds use letters, digits and hyphens, up to 24 characters, and case doesn't matter. Other ASCII characters are dropped, and text with any non-ASCII character is hashed into an `X-` seed. With no seed in the URL, a new game picks a random one. The end screen shows a share link and the best time for that seed.

### Browsers

Desktop Chrome, Edge and Firefox with keyboard and mouse, on WebGL2. Safari should work but hasn't been tested. There is no touch or gamepad support.

## Development

Requires Node.js 22 (developed on 22.16).

| Command | What it does |
|---|---|
| `npm run build` | Release build to `dist/index.html`. Fails if the file is over 131,072 bytes. |
| `npm run dev` | Unminified build to `dist/dev.html` with a debug line (fps, area, awake aliens), served at http://localhost:4173/dev.html |
| `npm test` | Unit tests (Node's built-in test runner) |
| `npm run test:seeds` | Generates 1000 seeds and checks every level is sound and finishable |
| `npm run test:bot` | An immortal bot plays 60 seeds through both levels, from the wreck to boarding the rescue ship |
| `npm run test:smoke` | Release build, then Playwright smoke tests in Chromium and Firefox. Run `npx playwright install chromium firefox` once first. |

The dev build also has debug keys: **G** god mode, **B** jump to the base, **N** warp to the next encounter, **P** cycle the palette (dithered, flat, off) and **R** cycle the resolution.

### Continuous integration

`.github/workflows/ci.yml` runs on every push to `main`, on pull requests, and on demand from the Actions tab. Three jobs run in parallel, then a fourth deploys:

- **Unit tests and build:** `npm test`, then the release build, with its size in the job summary. The playable `index.html` is attached to the run as an artifact.
- **Seed and bot soaks:** `npm run test:seeds` and `npm run test:bot`.
- **Browser smoke tests:** Playwright in Chromium and Firefox. On failure, `test-results/` is attached.
- **Deploy to GitHub Pages:** on `main` only, once all three pass, the build job's `index.html` is published to https://jeffory.github.io/one-small-problem/.

A newer push to the same branch cancels a run still in progress.

### How it fits

The game is plain JavaScript and WebGL2, with no runtime dependencies. Everything is generated at load time: terrain, the crater, the base, textures (baked in shaders), models, sound effects, music and the level layouts. The radio voices use the browser's built-in speech synthesis, with a different system voice per speaker where the browser has more than one, and subtitles always on.

The release build bundles with esbuild, minifies with terser, then packs the script with jspackcompress into a single self-decompressing HTML page.

### Layout

| Path | Contents |
|---|---|
| `src/gen/` | Deterministic world generation: the surface, crater, base layout and encounter plans |
| `src/game/` | The game simulation (player, aliens, weapons, fight, opening, radio, the demo bot), plus scene and mesh building |
| `src/gfx/` | WebGL2 renderer, shaders and texture baking |
| `src/audio/` | ZzFX sound effects, the music tracker and speech |
| `src/ui/` | HUD, menus, settings and the end screen |
| `src/main.js`, `src/shell.html` | The state machine (title, opening, play, lift-off, end) and the page shell |
| `tests/` | Unit tests, soaks and Playwright smoke tests |
| `docs/superpowers/` | The design specs, the six implementation plans and the decisions record |
| `spikes/` | The original look test |

### Rules that keep seeds stable

The same seed has to build the same Moon on every browser and machine, so a few rules hold:

- Code in `src/gen/` uses only `+ - * /`, bit operations and `Math.imul/sqrt/floor/ceil/round/trunc/min/max/abs`. It never uses trig, `pow`, `hypot`, `**`, `Math.random`, `Date` or `.sort(`. A test enforces this.
- Randomness comes from seeded generators (sfc32 seeded by xmur3), never `Math.random`.
- The simulation in `src/game/` stays pure: no DOM, no WebGL and no wall-clock time. That keeps replays deterministic.
- `tests/golden.test.mjs` pins checksums for three seeds. If you change generation on purpose, re-pin them in the same commit.

## Design docs

- `docs/superpowers/specs/2026-11-02-one-small-problem-design.md`: the design, and which calls were whose
- `docs/superpowers/specs/2026-11-03-plan-5-polish-design.md` and `2026-11-03-plan-6-escape-design.md`: the design addenda for the polish pass and the second level
- `docs/superpowers/plans/`: the six implementation plans (walkable Moon, fight, the base, show, polish, the escape)
- `docs/superpowers/decisions.md`: every decision made while building it, plus tuning after play-testing
