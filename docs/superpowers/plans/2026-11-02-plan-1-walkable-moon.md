# One Small Problem, Plan 1: Walkable Moon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A packed single-HTML build of at most 131,072 bytes that turns the URL seed into a deterministic, gritty, palette-dithered lunar surface (craters, rocks, lander, flag, Earth in the sky). You can walk it in low gravity from the lander toward the rim of the base crater.

**Architecture:**
- Plain-JS ES modules, bundled by esbuild into one IIFE, minified by Terser and packed by jsPackCompress into a self-extracting HTML file.
- World generation (`src/gen/`) is pure and deterministic, with no GPU access, so Node tests can run it.
- Rendering (`src/gfx/`) is WebGL2:
  - textures baked on the GPU at load
  - one world material shader, with sun shadows marched through a height map
  - a sky pass
  - a low-res palette and dither post pass
- Game code (`src/game/`) joins the two.

This is plan 1 of 4. Later plans:
- **Plan 2, Fight:** weapons, aliens (design A), AI, pickups.
- **Plan 3, The base:** crater descent, base generation, themed rooms.
- **Plan 4, Show:** audio, radio, opening, title/attract, ending, end screen, settings.

**Tech Stack:**
- Node 22, esbuild 0.28.2, terser 5.51.2, jspackcompress 0.1.1, @playwright/test 1.64.1
- `node:test` for unit tests
- WebGL2 / GLSL ES 3.00

**Spec:** `docs/superpowers/specs/2026-11-02-one-small-problem-design.md`.

**Visual reference:** `spikes/look-test.html`. The user approved this look. Port its shader recipes and constants, but don't copy its JS structure.

## Global Constraints

**Output and hosting**
- The shipped artefact is one self-contained `.html` file of at most **131,072 bytes**, counted as file size on disk. The build fails if this is exceeded.
- It must run both from `https://` (a plain web host such as GitHub Pages, which sends `charset=utf-8`) and from `file://`. It makes no network requests, except that jsPackCompress's universal decoder re-fetches its own file over http(s).
- Pack with `universalDecoder: true` and `compactHtml: false`. The page must keep its `<!doctype html>`, which keeps the browser in standards mode.

**Platform**
- WebGL2 only. Use a half-float colour target via `EXT_color_buffer_float`, falling back to RGBA8.
- Plain JavaScript with no WASM. No runtime dependencies; the only dev dependencies are esbuild, terser, jspackcompress and @playwright/test.
- Every file under `src/`, `tools/` and `build.mjs` must be 7-bit ASCII. Use `\u` escapes in strings.

**Determinism**
- `src/gen/**` may use only:
  - `+ - * /` and bit operations
  - `Math.imul`, `Math.sqrt`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.trunc`, `Math.min`, `Math.max`, `Math.abs`
- It must never use:
  - `Math.sin/cos/tan/asin/acos/atan/atan2/pow/exp/expm1/log*/hypot/cbrt/random`
  - `**`, `Date`, or `.sort(`
- The same seed must produce byte-identical world data in every browser and in Node.

**Coordinates**
- Units are metres. y is up, and at yaw 0 you face −z.
- Height-field sample `(i, j)` (index `j*512 + i`) sits at world `x = i − 256`, `z = j − 256`.
- Camera basis: `f = (−sin yaw·cos pitch, sin pitch, −cos yaw·cos pitch)`, `r = (cos yaw, 0, −sin yaw)`, `u = r × f`.

**Seeds**
- Read the seed from the URL hash and normalise it: uppercase, only `[A-Z0-9-]`, at most 24 characters.
- With no usable hash, generate a random `WORD-NNNN` seed from the 32-word list.

**Look** (from spec §5)
- Internal resolution is 270 px high by default, with options for 180 and 360. The width follows the window's aspect ratio. Scale up with nearest-neighbour.
- Snap to the 51-colour palette with 4×4 Bayer dither.
- Textures are 256² with nearest magnification and `NEAREST_MIPMAP_LINEAR` minification.
- Sun intensity 1.55, exaggerated horizon curvature `1/1800`, vertical FOV 62°.

**Naming**
- Internal object properties may be `_`-prefixed. Terser mangles names matching `/^_/`.
- Anything read by name from outside the bundle must not be prefixed. This includes `window.ospTest` and GLSL uniform names.

## Review Focus

1. **A broken or hostile URL hash** (`#`, a malformed `%E0%A4%A`, 40 characters, emoji) must fall back to a sane seed or a random one, never crash. Tested in Task 2.
2. **Pasting a new seed link into an already-open tab** (only the hash changes) must load the new Moon, not keep the old one. Tested in Task 9.
3. **Resizing to a narrow, tall window** must rebuild the targets with the right aspect ratio, with no stretching and no GL errors. Tested in Task 9.
4. **No pointer lock** (denied, headless, or after Esc): keyboard movement must still work, and the game must not freeze. Tested in Task 9.
5. **Losing the WebGL context** (GPU reset, laptop sleep) must show a visible "reload" message, not a silent black screen. Tested in Task 9.

---

### Task 1: Project scaffold, GLSL minifier, packed build with size gate, smoke harness

**Files:**
- Create: `package.json`, `build.mjs`, `tools/glsl.mjs`, `tools/serve.mjs`, `src/shell.html`, `src/main.js` (placeholder), `playwright.config.mjs`
- Modify: `.gitignore` (add `test-results/`, `playwright-report/`)
- Test: `tests/glsl.test.mjs`, `tests/build.test.mjs`, `tests/ascii.test.mjs`, `tests/smoke.spec.mjs`

**Interfaces:**
- Produces:
  - `minifyGLSL(src: string) => string` and `glslPlugin() => esbuild.Plugin` from `tools/glsl.mjs`. The plugin makes `import s from './x.frag'` (or `.vert`) yield the minified source string.
  - `build({release = true, cap = 131072} = {}) => Promise<{path: string, bytes: number}>` from `build.mjs`:
    - Release writes `dist/index.html` (packed, `DEBUG=false`).
    - Dev writes `dist/dev.html` (an unpacked inline script, `DEBUG=true`).
    - If over the cap, it throws `Error("dist/index.html is <bytes> bytes, exceeds <cap> bytes")` after writing.
    - CLI: `node build.mjs` runs release, `node build.mjs --dev` runs dev, and either prints `<path>: <bytes> bytes (<pct>% of 131072)`.
  - `node tools/serve.mjs [port=4173]` serves `dist/`. It sends `.html` as `text/html; charset=utf-8` to mimic GitHub Pages and `.js` as `text/javascript`; anything else is a 404.
  - `src/shell.html`: the head markup, a line `<!--BODY-->`, then the body markup. The build splits on that marker.
  - `window.ospTest = {ready: boolean}`, set by `main.js`. Later tasks add fields.
  - npm scripts:
    - `build`: `node build.mjs`
    - `dev`: `node build.mjs --dev && node tools/serve.mjs 4173`
    - `test`: `node --test tests/*.test.mjs`
    - `test:seeds`: `node tests/seeds.soak.mjs`
    - `test:smoke`: `node build.mjs && playwright test`

- [ ] **Step 1: Write the failing unit tests**

`tests/glsl.test.mjs`:
```js
import test from 'node:test'; import assert from 'node:assert/strict';
import { minifyGLSL } from '../tools/glsl.mjs';
test('keeps #version and #define on their own lines', () => {
  assert.equal(minifyGLSL('#version 300 es\n#define K 2.\nprecision highp float;\n'), '#version 300 es\n#define K 2.\nprecision highp float;');
});
test('strips comments and collapses whitespace around punctuation', () => {
  assert.equal(minifyGLSL('void main( ) {\n  // hi\n  float a = 1. ; /* x */ o = vec4( a );\n}'), 'void main(){float a=1.;o=vec4(a);}');
});
test('keeps spaces between words and between +/- pairs', () => {
  assert.equal(minifyGLSL('if(a) b = x - -y; else if (c) d = e + +f;'), 'if(a)b=x- -y;else if(c)d=e+ +f;');
});
```
`tests/build.test.mjs`:
```js
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync, statSync } from 'node:fs';
import { build } from '../build.mjs';
test('release build is one self-extracting html under the cap', async () => {
  const { path, bytes } = await build({ release: true });
  assert.equal(path, 'dist/index.html'); assert.ok(bytes <= 131072); assert.equal(statSync(path).size, bytes);
  const html = readFileSync(path, 'latin1');
  assert.match(html.slice(0, 15).toLowerCase(), /^<!doctype html>/); assert.ok(html.includes('iso-8859-15'));
});
test('dev build is readable html with an inline script', async () => {
  const { path } = await build({ release: false });
  const html = readFileSync(path, 'utf8'); assert.ok(html.includes('<canvas id="c"')); assert.ok(html.includes('<script>'));
});
test('build fails loudly over the cap', async () => {
  await assert.rejects(() => build({ release: true, cap: 100 }), /exceeds 100 bytes/);
});
```
`tests/ascii.test.mjs` walks `src/`, `tools/` and `build.mjs`, and asserts every byte of every file is below 0x80, naming the file and byte offset on failure.

- [ ] **Step 2: Run them to see them fail**

Run: `npm i -D esbuild@0.28.2 terser@5.51.2 jspackcompress@0.1.1 @playwright/test@1.64.1 && npm test`
Expected: FAIL. `tools/glsl.mjs` and `build.mjs` don't exist yet.

- [ ] **Step 3: Implement `minifyGLSL` and `glslPlugin` in `tools/glsl.mjs`**

Rules:
- Strip `//` and `/* */` comments.
- Lines starting with `#` stay intact, each followed by `\n`.
- Everything else is joined, with whitespace runs collapsed.
- Whitespace is removed next to any of `{}()[];,=+-*/<>!&|?:.`, except a single space is kept between two `+` or two `-` characters.
- Trim the result.

- [ ] **Step 4: Implement `build.mjs`, `tools/serve.mjs`, `src/shell.html`, and a placeholder `src/main.js`**

`build.mjs`:
1. Run esbuild on `src/main.js`: `bundle`, `format:'iife'`, `target:'es2022'`, `define:{DEBUG: release ? 'false' : 'true'}`, `plugins:[glslPlugin()]`, `write:false`.
2. For release only, run Terser with `{toplevel:true, compress:{passes:3}, mangle:{properties:{regex:/^_/}}, format:{ascii_only:true}}`.
3. For release, call `pack({script, compressionlevel:9, compactHtml:false, universalDecoder:true, extraHead: head, extraBody: body})` from `jspackcompress` and write `result.payload`.
4. For dev, write `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${body}<script>${code}</script></body></html>`.

`src/shell.html`:
- **Head:**
  - `<title>One Small Problem</title>`
  - `<link rel="icon" href="data:,">`, which stops favicon 404s
  - the viewport meta
  - a `<style>` block: black page, no scroll, full-window canvas, `#hud` bottom-left, `#seed` bottom-right in `#7a7266`, and `#msg` as a hidden full-screen flex overlay. Use the monospace font and `#b8ae9c` text colour from the look test.
- **Body:** `<canvas id="c"></canvas><div id="hud"></div><div id="seed"></div><div id="msg"></div>`.

Placeholder `main.js`: set `#hud` text to `One Small Problem` and `window.ospTest = {ready: true}`.

- [ ] **Step 5: Run the unit tests to see them pass**

Run: `npm test`
Expected: PASS, 7 tests (the 3 GLSL, 3 build and 1 ASCII).

- [ ] **Step 6: Write the smoke spec and Playwright config**

`playwright.config.mjs`:
- `testDir: 'tests'`, `testMatch: '*.spec.mjs'`
- `webServer: {command: 'node tools/serve.mjs 4173', url: 'http://localhost:4173/index.html', reuseExistingServer: true}`
- projects:
  - `chromium`, with `launchOptions.args: ['--enable-unsafe-swiftshader']`
  - `firefox`
  - `webkit`, only when `process.env.OSP_WEBKIT` is set

`tests/smoke.spec.mjs`:
```js
import { test, expect } from '@playwright/test'; import { pathToFileURL } from 'node:url'; import { resolve } from 'node:path';
export const URLS = [['file', pathToFileURL(resolve('dist/index.html')).href], ['http', 'http://localhost:4173/index.html']];
export function watchErrors(page) { const e = []; page.on('pageerror', x => e.push(String(x))); page.on('console', m => m.type() === 'error' && e.push(m.text())); return e; }
export const ready = page => page.waitForFunction(() => window.ospTest?.ready === true, null, { timeout: 30_000 });
for (const [name, url] of URLS) test(`boots from ${name}`, async ({ page }) => {
  const errors = watchErrors(page); await page.goto(url); await ready(page); expect(errors).toEqual([]);
});
```

- [ ] **Step 7: Run the smoke tests**

Run: `npx playwright install chromium firefox && npm run test:smoke`
Expected: PASS. 4 tests: file and http, in chromium and firefox.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json build.mjs tools src tests playwright.config.mjs .gitignore
git commit -m "build: packed single-html pipeline with 128 KB size gate and smoke tests"
```

---

### Task 2: Seeded RNG and seed names

**Files:**
- Create: `src/gen/rng.js`
- Test: `tests/rng.test.mjs`

**Interfaces:**
- Produces, from `src/gen/rng.js`:
  - `xmur3(str: string) => () => number`, which returns uint32.
  - `sfc32(a: number, b: number, c: number, d: number) => () => number`, which returns a float in [0,1) as `(t >>> 0) / 4294967296`.
  - `makeRng(seed: string) => Rng`, where `Rng = {next(): number, range(a: number, b: number): number, int(n: number): number}`. It seeds sfc32 with four `xmur3(seed)()` draws. `range` returns a value in [a,b) and `int` returns `floor(next() * n)`.
  - `normalizeSeed(raw: string | null | undefined) => string | null`:
    1. Strip one leading `#`.
    2. Try `decodeURIComponent`, keeping the raw text if it throws.
    3. Uppercase, drop characters outside `[A-Z0-9-]`, and cut to 24 characters.
    4. Return `null` if nothing is left.
  - `SEED_WORDS: string[]`: `APOLLO EAGLE SATURN LUNA SELENE ORION AQUARIUS FALCON CHALLENGER SNOOPY SPIDER INTREPID ANTARES YANKEE GUMDROP ODYSSEY CASPER AMERICA COLUMBIA KITTYHAWK ENDEAVOUR CRATER REGOLITH MARE HOUSTON CAPCOM QUINDAR GEMINI MERCURY TITAN HADLEY DESCARTES` (32 words).
  - `seedName(rng: Rng) => string`: `${SEED_WORDS[rng.int(32)]}-${String(rng.int(10000)).padStart(4, '0')}`.

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test'; import assert from 'node:assert/strict';
import { makeRng, normalizeSeed, seedName, SEED_WORDS } from '../src/gen/rng.js';
test('makeRng is deterministic per seed', () => { const a = makeRng('APOLLO-4471'), b = makeRng('APOLLO-4471'); for (let i = 0; i < 5; i++) assert.equal(a.next(), b.next()); });
test('different seeds diverge', () => { assert.notEqual(makeRng('APOLLO-4471').next(), makeRng('APOLLO-4472').next()); });
test('next/int/range stay in bounds', () => { const r = makeRng('X'); for (let i = 0; i < 10000; i++) { const v = r.next(); assert.ok(v >= 0 && v < 1); const k = r.int(7); assert.ok(Number.isInteger(k) && k >= 0 && k < 7); const g = r.range(-3, 5); assert.ok(g >= -3 && g < 5); } });
test('normalizeSeed tidies and never throws (Review Focus 1)', () => {
  assert.equal(normalizeSeed('#apollo-4471'), 'APOLLO-4471');
  assert.equal(normalizeSeed('#Eagle%20Has%20Landed!!'), 'EAGLEHASLANDED');
  assert.equal(normalizeSeed('#%E0%A4%A'), 'E0A4A');
  assert.equal(normalizeSeed('#' + 'a'.repeat(40)), 'A'.repeat(24));
  assert.equal(normalizeSeed('#\u{1F680}\u{1F680}'), null);
  for (const v of ['#', '', null, undefined]) assert.equal(normalizeSeed(v), null);
});
test('seedName gives WORD-NNNN from the 32-word list', () => { assert.equal(SEED_WORDS.length, 32); const r = makeRng('names'); for (let i = 0; i < 200; i++) { const [w, n] = seedName(r).split('-'); assert.ok(SEED_WORDS.includes(w)); assert.match(n, /^\d{4}$/); } });
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/rng.test.mjs`
Expected: FAIL. The module isn't found.

- [ ] **Step 3: Implement `src/gen/rng.js`, following the interfaces above**

Use the standard xmur3 and sfc32 implementations from https://github.com/bryc/code/blob/master/jshash/PRNGs.md.

- [ ] **Step 4: Run them to see them pass**

Run: `node --test tests/rng.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/gen/rng.js tests/rng.test.mjs
git commit -m "gen: seeded sfc32 rng, seed normalisation and WORD-NNNN names"
```

---

### Task 3: Deterministic noise and the determinism lint

**Files:**
- Create: `src/gen/noise.js`
- Test: `tests/noise.test.mjs`

**Interfaces:**
- Produces, from `src/gen/noise.js` (all integer-hash based, with no trig):
  - `hash2(x: number, y: number, s: number) => number`: integer lattice hash in [0,1). Port the look test's `h2`, with the salt mixed in: `Math.imul(x|0, 374761393) + Math.imul(y|0, 668265263) + Math.imul(s|0, 1442695041)`, then the same avalanche steps.
  - `valueNoise2(x, y, s) => number` in [0,1], using smoothstep interpolation of `hash2` corners.
  - `fbm2(x, y, octaves, s) => number` in [0,1]. Each octave does `x = x*2.03 + 17.1; y = y*2.03 + 3.7` with amplitude halving, normalised by the sum of amplitudes.
  - `vn3(x, y, z, s) => number` in [0,1]: trilinear value noise (as in the look test's `vn3`), used for model displacement.

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test'; import assert from 'node:assert/strict'; import { readdirSync, readFileSync } from 'node:fs';
import { hash2, valueNoise2, fbm2, vn3 } from '../src/gen/noise.js';
test('hash2 is deterministic and in [0,1)', () => { for (let i = -50; i < 50; i++) { const v = hash2(i, i * 7, 3); assert.equal(v, hash2(i, i * 7, 3)); assert.ok(v >= 0 && v < 1); } assert.notEqual(hash2(1, 2, 3), hash2(1, 2, 4)); });
test('valueNoise2 equals the lattice hash at integer points', () => { assert.equal(valueNoise2(3, -7, 11), hash2(3, -7, 11)); });
test('valueNoise2 is continuous', () => { for (let i = 0; i < 1000; i++) { const x = i * 0.37, y = i * 0.11; assert.ok(Math.abs(valueNoise2(x, y, 5) - valueNoise2(x + 1e-4, y, 5)) < 1e-2); } });
test('fbm2 and vn3 stay in [0,1]', () => { for (let i = 0; i < 2000; i++) { const f = fbm2(i * 1.3, -i * 0.7, 5, 9), v = vn3(i * 0.31, i * 0.17, -i * 0.23, 2); assert.ok(f >= 0 && f <= 1 && v >= 0 && v <= 1); } });
test('generation code avoids engine-dependent math', () => {
  const banned = /Math\.(sin|cos|tan|asin|acos|atan2?|pow|exp|expm1|log\w*|hypot|cbrt|random)\b|\*\*|\bDate\b|\.sort\(/;
  const code = s => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');   // ignore comments (JSDoc starts with /**)
  for (const f of readdirSync('src/gen')) assert.doesNotMatch(code(readFileSync(`src/gen/${f}`, 'utf8')), banned, f);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/noise.test.mjs`
Expected: FAIL. The module isn't found.

- [ ] **Step 3: Implement `src/gen/noise.js`, following the interfaces above**

- [ ] **Step 4: Run them to see them pass**

Run: `node --test tests/noise.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/gen/noise.js tests/noise.test.mjs
git commit -m "gen: deterministic hash/value/fbm noise and determinism lint"
```

---

### Task 4: Surface layout, route and cratered height field

**Files:**
- Create: `src/gen/surface.js` (functions in this task, plus Task 5's additions)
- Test: `tests/surface.test.mjs`

**Interfaces:**
- Consumes: `makeRng` (Task 2) and `fbm2`, `valueNoise2` (Task 3).
- Produces, from `src/gen/surface.js`:
  - `N = 512`, `HALF = 256`, `MAP_MARGIN = 24`
  - `pickLayout(rng) => Layout`, where `Layout = {lander: {x, z, y}, spawn: {x, z, dx, dz}, base: {x, z, R}, rim: {x, z}}`:
    - `lander` is at `(−170 + range(−20,20), 170 + range(−20,20))`.
    - `base` is at `(150 + range(−20,20), −150 + range(−20,20))`, with `R = range(55,68)`.
    - `rim = base + unit(lander − base)·R·1.05`.
    - `spawn = lander + d·6`, where `d = unit(rim − lander)` and `(dx, dz) = d`.
    - `lander.y` is filled in by `buildHeightfield`.
  - `buildRoute(rng, L) => Array<[x, z]>`, with 9 points:
    - Point 0 is `[spawn.x, spawn.z]` and point 8 is `[rim.x, rim.z]`.
    - Points k = 1..7 sit at `lerp(spawn, rim, k/8) + perp·range(−45,45) + d·range(−10,10)`, where `perp = (−dz, dx)`.
    - Each point is clamped to ±(HALF − 40).
  - `distToPolyline(x, z, pts) => number` and `polylineLength(pts) => number`.
  - `craterProfile(r, R) => number`, the height offset at normalised radius `r = dist/R`:
    ```
    depth = .32R, rim = .075R
    r < 1:   d = depth*(r*r - 1) + rim*r*r*r*r;  if R > 9: d = max(d, -.78*depth)
    r < 1.8: q = (r - 1)*2.6; t = max(0, 1 - q*q/4); d = rim*t*t*t*t
    else 0
    ```
  - `buildHeightfield(rng, L, route) => {h: Float32Array(N*N), craters: Array<[x, z, R]>}`. It sets `L.lander.y`. Steps:
    1. **Route mask:** `m(x,z) = smoothstep(4, 16, distToPolyline(x, z, route))`.
    2. **Base noise:** `h = ((fbm2(x/110, z/110, 5, s1) − .5)·14 + (fbm2(x/22 + 40, z/22, 4, s2) − .5)·2.4 + (valueNoise2(x/5, z/5, s3) − .5)·.5) · (.35 + .65·m)`. The salts s1–s3 come from `rng.int(0x7fffffff)`.
    3. **Craters, base crater first:**
       - 4 large craters with `R = range(18,30)` and 14 medium with `R = range(7,19)`, both placed in ±230.
       - 260 small craters with `R = .8 + 6·u·u`, placed in ±250.
       - Skip a crater if it is within `R + 14` of the lander (`R + 6` when `R ≤ 2.5`), or within `base.R + .5R` of the base centre.
    4. **Stamping:** each crater stamps `craterProfile` over its 1.8R box, times a weight. The weight is `m` for normal craters and `1 − (1 − m)·.85` for the base crater, which cuts the ramp notch into its rim.
    5. **Lander pad:**
       - Set `lander.y = sampleBilinear(h, lander)`.
       - Within 7 m, blend `h` toward `lander.y` by `1 − smoothstep(4, 7, d)`.
  - `sampleBilinear(arr: Float32Array, x, z) => number`: bilinear on the 512² grid, clamped to the edges.

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test'; import assert from 'node:assert/strict';
import { makeRng } from '../src/gen/rng.js';
import { N, pickLayout, buildRoute, buildHeightfield, craterProfile, distToPolyline, polylineLength, sampleBilinear } from '../src/gen/surface.js';
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
test('craterProfile shape', () => {
  assert.ok(near(craterProfile(0, 5), -1.6)); assert.ok(near(craterProfile(0, 20), -4.992)); assert.ok(near(craterProfile(1, 20), 1.5));
  assert.equal(craterProfile(1.8, 20), 0); assert.ok(Math.abs(craterProfile(0.999, 20) - craterProfile(1.001, 20)) < 0.05);
});
test('layout: lander south-west, base crater north-east', () => { for (const s of ['A', 'B', 'C', 'D']) { const L = pickLayout(makeRng(s));
  assert.ok(L.lander.x < -140 && L.lander.z > 140 && L.base.x > 120 && L.base.z < -120 && L.base.R >= 55 && L.base.R < 68);
  assert.ok(near(Math.hypot(L.spawn.x - L.lander.x, L.spawn.z - L.lander.z), 6, 1e-6)); } });
test('route runs spawn -> rim, 450-900 m, inside the map', () => { const rng = makeRng('ROUTE'), L = pickLayout(rng), r = buildRoute(rng, L);
  assert.equal(r.length, 9); assert.deepEqual(r[0], [L.spawn.x, L.spawn.z]);
  assert.ok(near(Math.hypot(r[8][0] - L.base.x, r[8][1] - L.base.z), L.base.R * 1.05, 1e-6));
  const len = polylineLength(r); assert.ok(len > 450 && len < 900, `len ${len}`); for (const [x, z] of r) assert.ok(Math.abs(x) <= 216 && Math.abs(z) <= 216);
  assert.equal(distToPolyline(r[3][0], r[3][1], r), 0); });
test('height field: gentle along the route, flat pad, base crater first', () => {
  const rng = makeRng('APOLLO-4471'), L = pickLayout(rng), route = buildRoute(rng, L), { h, craters } = buildHeightfield(rng, L, route);
  assert.equal(h.length, N * N); assert.equal(craters[0][2], L.base.R);
  for (let k = 0; k < 8; k++) { const [ax, az] = route[k], [bx, bz] = route[k + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az));
    for (let s = 0; s < n; s++) { const t0 = s / n, t1 = (s + 1) / n;
      const d = Math.abs(sampleBilinear(h, ax + (bx - ax) * t1, az + (bz - az) * t1) - sampleBilinear(h, ax + (bx - ax) * t0, az + (bz - az) * t0));
      assert.ok(d < 0.45, `slope ${d} on segment ${k}`); } }
  for (let a = 0; a < 16; a++) { const x = L.lander.x + 3.5 * Math.cos(a), z = L.lander.z + 3.5 * Math.sin(a); assert.ok(Math.abs(sampleBilinear(h, x, z) - L.lander.y) < 0.3); }
});
test('sampleBilinear is exact on grid points', () => { const h = new Float32Array(N * N).map((_, i) => i % 97); assert.equal(sampleBilinear(h, 10 - 256, 20 - 256), h[20 * N + 10]); });
```
Tests may use trig. Only `src/gen` is linted.

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/surface.test.mjs`
Expected: FAIL. The module isn't found.

- [ ] **Step 3: Implement `pickLayout`, `buildRoute`, `distToPolyline`, `polylineLength`, `craterProfile`, `buildHeightfield` and `sampleBilinear` in `src/gen/surface.js`, following the interfaces above**

- [ ] **Step 4: Run them to see them pass**

Run: `node --test tests/surface.test.mjs && node --test tests/noise.test.mjs`
Expected: PASS. The lint also covers `surface.js`.

- [ ] **Step 5: Commit**

```bash
git add src/gen/surface.js tests/surface.test.mjs
git commit -m "gen: surface layout, carved route and cratered height field"
```

---

### Task 5: Rocks, collision/shadow heights, passability, re-roll and checksum

**Files:**
- Modify: `src/gen/surface.js` (add rocks, occluders and `generateSurface`)
- Create: `src/gen/passable.js`, `src/gen/checksum.js`, `tests/seeds.soak.mjs`
- Test: `tests/world.test.mjs`

**Interfaces:**
- Consumes: Task 4's functions.
- Produces:
  - `MAX_STEP = 0.45`, from `surface.js`.
  - `generateSurface(seed: string) => SurfaceWorld`, from `surface.js`:
    - For each attempt 0..7, it uses `rng = makeRng(attempt ? seed + '#' + attempt : seed)`, then pickLayout, buildRoute, buildHeightfield, scatterRocks, stampOccluders, and `passable`.
    - It returns the first passable attempt, or throws `Error('no passable layout for seed ' + seed)`.
    - ```
      SurfaceWorld = { seed, attempt, N: 512, half: 256, h: Float32Array, occ: Float32Array,
                       lander: {x, z, y}, spawn: {x, z, dx, dz}, base: {x, z, R}, rim: {x, z},
                       route: Array<[x, z]>, craters: Array<[x, z, R]>,
                       rocks: Array<{x, y, z, sx, sy, sz, yaw01, seed}> }
      ```
  - **Rocks:** 460 attempts.
    - Attempts 0–229 sit on crater rims: pick `craters[rng.int(min(40, craters.length))]`, then a direction by rejection-sampling `(ux, uz)` in [−1,1]² with `1e-4 < l2 ≤ 1`, normalised by `sqrt`, at distance `R·(.95 + .7·next())`.
    - The rest are uniform in ±240.
    - Reject a rock if it is outside ±(HALF − MAP_MARGIN), within 5.5 m of the lander, within 3 m of the spawn, or where `m < .6`.
    - Size: `s = .12 + 2.6·u·u·u`; `sx = s(.8 + .6r)`, `sy = s(.45 + .4r)`, `sz = s(.8 + .6r)`; `y = sampleBilinear(h, x, z) − .3·sy`; `yaw01 = next()`; `seed = next()·100`.
  - **`occ`** starts as a copy of `h` (collision and shadow heights). Then:
    - Each rock stamps `max(occ, y + sy·sqrt(q))` with `q = 1 − d²/(.85·max(sx, sz))²`.
    - The lander stamps radius 2.0 to `lander.y + 2.45` and radius 1.35 to `lander.y + 4.05`.
  - `sampleGround(world, x, z) => number`, from `surface.js`: `sampleBilinear(world.occ, x, z)`.
  - `passable(grid: Float32Array, n: number, start: [i, j], goal: [i, j], maxStep: number, margin = 0) => boolean`, from `src/gen/passable.js`. It runs a 4-neighbour breadth-first search over cells inside `margin`. An edge is passable when `|grid[a] − grid[b]| ≤ maxStep`. The world uses `margin = MAP_MARGIN` and cells `round(x + 256)`, `round(z + 256)`.
  - `checksumWorld(world) => string`, from `src/gen/checksum.js`. It is a 32-bit FNV-1a, as 8 lowercase hex characters, over the bytes of:
    - `h`, then `occ`
    - the route as a Float32Array
    - the rocks as a Float32Array of `[x, y, z, sx, sy, sz]` per rock

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test'; import assert from 'node:assert/strict';
import { generateSurface, sampleGround, distToPolyline, MAX_STEP, MAP_MARGIN } from '../src/gen/surface.js';
import { passable } from '../src/gen/passable.js'; import { checksumWorld } from '../src/gen/checksum.js';
const W = generateSurface('APOLLO-4471'), cell = p => [Math.round(p.x + 256), Math.round(p.z + 256)];
test('same seed, same world; different seed, different world', () => {
  assert.equal(checksumWorld(generateSurface('APOLLO-4471')), checksumWorld(W)); assert.match(checksumWorld(W), /^[0-9a-f]{8}$/);
  assert.notEqual(checksumWorld(generateSurface('EAGLE-0001')), checksumWorld(W)); assert.ok(Number.isInteger(W.attempt) && W.attempt >= 0 && W.attempt < 8); });
test('collision heights never dip below terrain', () => { for (let i = 0; i < W.h.length; i++) assert.ok(W.occ[i] >= W.h[i]); });
test('rocks stay off the route and inside the map', () => { assert.ok(W.rocks.length > 150);
  for (const k of W.rocks) { assert.ok(distToPolyline(k.x, k.z, W.route) > 10); assert.ok(Math.abs(k.x) <= 232 && Math.abs(k.z) <= 232 && k.sx > 0 && k.sy > 0 && k.sz > 0); } });
test('route is walkable on the collision heights', () => { assert.ok(passable(W.occ, 512, cell(W.spawn), cell(W.rim), MAX_STEP, MAP_MARGIN)); });
test('lander blocks walking into it', () => { assert.ok(sampleGround(W, W.lander.x, W.lander.z) - W.lander.y > 4); });
test('passable: a full wall blocks, a gap lets through', () => {
  const g = new Float32Array(256); for (let j = 0; j < 16; j++) g[j * 16 + 8] = 5; assert.equal(passable(g, 16, [2, 2], [14, 14], 0.45), false);
  g[3 * 16 + 8] = 0; assert.equal(passable(g, 16, [2, 2], [14, 14], 0.45), true); });
test('generation is quick', () => { const t = performance.now(); generateSurface('SPEED-0001'); assert.ok(performance.now() - t < 2000); });
```
`tests/seeds.soak.mjs` is a plain script:
- It generates `SOAK-0000` … `SOAK-0999` and, for each world, checks `passable` from spawn to rim.
- It prints a histogram of `attempt` values.
- It exits 1 on any throw or failure.

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/world.test.mjs`
Expected: FAIL. `generateSurface` and `passable` are missing.

- [ ] **Step 3: Implement `passable.js`, `checksum.js`, the rock scattering, `occ` stamping, `sampleGround` and `generateSurface`, following the interfaces above**

- [ ] **Step 4: Run them to see them pass**

Run: `npm test && npm run test:seeds`
Expected:
- All unit tests pass.
- The soak prints `1000/1000 passable`, with an attempt histogram. Most seeds should take attempt 0. If more than 5% need a re-roll, widen the route mask (16 → 20 m) and re-run.

- [ ] **Step 5: Commit**

```bash
git add src/gen tests/world.test.mjs tests/seeds.soak.mjs
git commit -m "gen: rocks, collision/shadow heights, passability re-roll and world checksum"
```

---

### Task 6: Matrix helpers and the mesh kit

**Files:**
- Create: `src/gfx/math.js`, `src/gfx/mesh.js`
- Test: `tests/mesh.test.mjs`

**Interfaces:**
- Produces, from `src/gfx/math.js` (column-major `Float32Array`):
  - `persp(fovy, aspect, near, far)`, `mul(a, b)`
  - `viewM(eye, f, r, u)`
  - `T(x, y, z)`, `Rx(a)`, `Ry(a)`, `Rz(a)`, `Sc(s)`
  - `MM(...ms)`, which chains `mul`
  - `rot3(m) => Float32Array(9)`, the 3×3 with each column normalised
  - `xf(m, p) => [x, y, z]`
  - `cameraBasis(yaw, pitch) => {f, r, u}`, following the Global Constraints formula
  - `I4`, `I3`

  Port these from the look test. `Ry(a)` maps +z to (sin a, 0, cos a).
- Produces, from `src/gfx/mesh.js` (pure JS, testable in Node):
  - `Mat = [layer, scale, emissive, flags]`
  - `createMesh() => {p: number[], m: number[], i: number[]}`
  - `vtx(M, x, y, z, mat) => number`, `quadIdx(M, a, b, c, d)`, `quad(M, A, B, C, D, mat)`
  - `box(M, x0, y0, z0, x1, y1, z1, mat)`, `beam(M, a, b, w, mat)`, `prism(M, cx, y0, cz, r, h, n, mat, rot = 0)`
  - `blob(M, c, r, seg, rings, mat, disp = null, yaw = 0)`
  - `lathe(M, a, b, prof, n, mat)`
  - `transformFrom(M, firstVertex, m4)`, which applies a mat4 to the positions from that vertex onward
  - `finishMesh(M) => {pos: Float32Array, nrm: Float32Array, mat: Float32Array, idx: Uint32Array}`, with area-weighted vertex normals

  Port the geometry exactly from the look test's `box/beam/prism/blob/lathe/upload`.

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test'; import assert from 'node:assert/strict';
import { createMesh, box, beam, prism, blob, lathe, transformFrom, finishMesh } from '../src/gfx/mesh.js';
import { T, Ry, mul, I4, xf, cameraBasis } from '../src/gfx/math.js';
const MAT = [0, 1, 0, 0], unit = d => { for (let k = 0; k < d.nrm.length; k += 3) assert.ok(Math.abs(Math.hypot(d.nrm[k], d.nrm[k + 1], d.nrm[k + 2]) - 1) < 1e-5); };
const counts = (fn) => { const M = createMesh(); fn(M); const d = finishMesh(M); unit(d); return [d.pos.length / 3, d.idx.length]; };
test('primitive vertex/index counts', () => {
  assert.deepEqual(counts(M => box(M, 0, 0, 0, 1, 1, 1, MAT)), [24, 36]);
  assert.deepEqual(counts(M => beam(M, [0, 0, 0], [0, 2, 0], .1, MAT)), [24, 36]);
  assert.deepEqual(counts(M => prism(M, 0, 0, 0, 1, 1, 6, MAT)), [38, 72]);
  assert.deepEqual(counts(M => blob(M, [0, 0, 0], [1, 1, 1], 8, 6, MAT)), [63, 288]);
  assert.deepEqual(counts(M => lathe(M, [0, 0, 0], [0, 1, 0], [[0, .5], [.5, .6], [1, .4]], 8, MAT)), [45, 144]);
  assert.deepEqual(counts(M => lathe(M, [0, 0, 0], [0, 1, 0], [[0, .5], [1, 0]], 8, MAT)), [27, 72]);
});
test('transformFrom moves only later vertices', () => { const M = createMesh(); box(M, 0, 0, 0, 1, 1, 1, MAT); box(M, 0, 0, 0, 1, 1, 1, MAT); transformFrom(M, 24, T(10, 0, 0));
  assert.equal(M.p[0], 0); assert.equal(M.p[24 * 3], 10); });
test('matrix helpers', () => { assert.deepEqual([...mul(I4, T(1, 2, 3))], [...T(1, 2, 3)]); assert.deepEqual(xf(T(1, 2, 3), [0, 0, 0]), [1, 2, 3]);
  const p = xf(Ry(Math.PI / 2), [0, 0, 1]); assert.ok(Math.abs(p[0] - 1) < 1e-6 && Math.abs(p[2]) < 1e-6);
  const { f, r, u } = cameraBasis(0, 0); assert.deepEqual([f, r, u].map(v => v.map(Math.round)), [[0, 0, -1], [1, 0, 0], [0, 1, 0]]); });
```
How the expected counts work out:
- **Box and beam:** 6 quads × 4 vertices = 24, and 36 indices.
- **Prism (n = 6):** 24 side vertices, plus 2 centres and 12 rim vertices = 38. Indices: 36 for the sides plus 36 for the caps = 72.
- **Blob (seg 8, rings 6):** 9 × 7 = 63 vertices, and 288 indices.
- **Lathe, 3 rings, n = 8:** 27 ring vertices plus 2 caps × 9 = 45. Indices: 96 for the bands plus 48 for the caps = 144.
- **Lathe cone:** 18 ring vertices plus 9 for its one cap = 27. Indices: 48 for the band plus 24 for the cap = 72. A cap is skipped wherever the radius is 0.

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/mesh.test.mjs`
Expected: FAIL. The modules aren't found.

- [ ] **Step 3: Implement `src/gfx/math.js` and `src/gfx/mesh.js`, following the interfaces above**

- [ ] **Step 4: Run them to see them pass**

Run: `node --test tests/mesh.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/gfx/math.js src/gfx/mesh.js tests/mesh.test.mjs
git commit -m "gfx: matrix helpers and box/beam/prism/blob/lathe mesh kit"
```

---

### Task 7: Low-gravity player controller

**Files:**
- Create: `src/game/player.js`
- Test: `tests/player.test.mjs`

**Interfaces:**
- Produces, from `src/game/player.js`:
  - `PLAYER = {eye: 1.7, walk: 4.5, run: 9, gSurface: 3.0, jumpV: 3.5, airControl: 2, stepUp: 0.35, substep: 0.25}`. These give an apex of about 2.04 m and about 2.33 s in the air, which fits the spec's ¼–⅓ g.
  - `createPlayer({x, z, dx, dz}, ground) => Player`, where `Player = {x, y, z, vx, vy, vz, yaw, pitch, onGround}`. `y` is the feet height, set to `ground(x, z)`, and `yaw = Math.atan2(-dx, -dz)`, so the player faces (dx, dz).
  - `stepPlayer(p, input, dt, ground: (x, z) => number, bound: number) => void`, where `input = {fwd: -1..1, strafe: -1..1, run: boolean, jump: boolean}`:
    1. **Desired velocity:** forward `(−sin yaw, −cos yaw)` and right `(cos yaw, −sin yaw)`, scaled to walk or run speed.
    2. **On the ground,** horizontal velocity snaps to the desired velocity. **In the air,** it moves toward it at a rate of `min(1, airControl·dt)`.
    3. **Jump** if `jump && onGround`: `vy = jumpV`.
    4. **Gravity:** `vy −= gSurface·dt`.
    5. **Move horizontally** in `ceil(|v|·dt / substep)` sub-steps, one axis at a time (x, then z). A move is refused, and that axis's velocity zeroed, when `ground(new) − y > stepUp`.
    6. **Clamp** `x` and `z` to ±bound.
    7. **Vertical:** `y += vy·dt`. Land when `y ≤ ground`.
    8. **Snap down slopes:** when `onGround && vy ≤ 0 && y − ground < 0.4`, put the player on the ground.

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test'; import assert from 'node:assert/strict';
import { PLAYER, createPlayer, stepPlayer } from '../src/game/player.js';
const run = (p, inp, secs, g, dt = 1 / 60, bound = 1e9) => { for (let t = 0; t < secs; t += dt) stepPlayer(p, inp, dt, g, bound); };
const idle = { fwd: 0, strafe: 0, run: false, jump: false }, east = { x: 0, z: 0, dx: 1, dz: 0 };
test('stands still on flat ground', () => { const p = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, () => 0); run(p, idle, 1, () => 0); assert.equal(p.y, 0); assert.ok(p.onGround); });
test('walks 4.5 m/s, runs 9 m/s toward -z at yaw 0', () => { const g = () => 0;
  const a = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, g); run(a, { ...idle, fwd: 1 }, 1, g); assert.ok(Math.abs(a.z + 4.5) < 0.1);
  const b = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, g); run(b, { ...idle, fwd: 1, run: true }, 1, g); assert.ok(Math.abs(b.z + 9) < 0.2); });
test('low-gravity jump: ~2.04 m apex, ~2.33 s airtime', () => { const g = () => 0, p = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, g); let top = 0, t = 0;
  stepPlayer(p, { ...idle, jump: true }, 1 / 60, g, 1e9); t += 1 / 60; while (!p.onGround && t < 5) { stepPlayer(p, idle, 1 / 60, g, 1e9); t += 1 / 60; top = Math.max(top, p.y); }
  assert.ok(Math.abs(top - PLAYER.jumpV ** 2 / (2 * PLAYER.gSurface)) < 0.06); assert.ok(Math.abs(t - 2 * PLAYER.jumpV / PLAYER.gSurface) < 0.06); });
test('walls stop you, small steps do not', () => { const p = createPlayer(east, () => 0), wall = x => (x > 1 ? 2 : 0);
  run(p, { ...idle, fwd: 1 }, 1, (x) => wall(x)); assert.ok(p.x <= 1.0001 && p.y === 0);
  const q = createPlayer(east, () => 0), step = x => (x > 1 ? 0.3 : 0); run(q, { ...idle, fwd: 1 }, 1, (x) => step(x)); assert.ok(q.x > 2 && Math.abs(q.y - 0.3) < 1e-9); });
test('stays glued walking downhill', () => { const g = x => -0.5 * x, p = createPlayer(east, g); run(p, { ...idle, fwd: 1 }, 1, g); assert.ok(p.onGround && Math.abs(p.y - g(p.x)) < 0.01); });
test('a huge frame does not tunnel through a wall', () => { const p = createPlayer(east, () => 0); stepPlayer(p, { ...idle, fwd: 1, run: true }, 1.0, x => (x > 1 ? 2 : 0), 1e9); assert.ok(p.x <= 1.0001); });
test('map bound holds', () => { const p = createPlayer({ x: 0, z: 0, dx: 0, dz: -1 }, () => 0); run(p, { ...idle, fwd: 1, run: true }, 10, () => 0, 1 / 60, 20); assert.ok(p.z >= -20); });
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/player.test.mjs`
Expected: FAIL. The module isn't found.

- [ ] **Step 3: Implement `src/game/player.js`, following the interfaces above**

- [ ] **Step 4: Run them to see them pass**

Run: `node --test tests/player.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/player.js tests/player.test.mjs
git commit -m "game: low-gravity player controller with per-axis collision"
```

---

### Task 8: WebGL2 renderer: GPU texture bake, world shader, sky, palette post pass

**Files:**
- Create:
  - `src/gfx/gl.js`, `src/gfx/palette.js`, `src/gfx/materials.js`, `src/gfx/bake.js`, `src/gfx/renderer.js`
  - shaders: `src/gfx/shaders/fsq.vert`, `bake.frag`, `world.vert`, `world.frag`, `sky.frag`, `post.frag`
- Modify: `src/main.js` (a temporary demo scene; Task 9 replaces it)
- Test: `tests/smoke.spec.mjs` (add a palette check)

**Interfaces:**
- Consumes: the `mesh.js` and `math.js` interfaces (Task 6).
- Produces:
  - **`gl.js`:**
    - `createGL(canvas) => {gl, hdrOK}`, which throws `Error('WebGL2 unavailable')` when there's no context.
    - `compileProgram(gl, vs, fs, defines = {}) => {p, u}`. It inserts `#define K V` lines after the `#version` line. `u` is a Proxy that returns uniform locations or `null`.
    - `uploadMesh(gl, data) => {vao, count}`, using attribute locations 0 = pos, 1 = nrm and 2 = mat.
    - `createHeightTexture(gl, f32, n)`, an R16F texture with LINEAR filtering and CLAMP wrapping.
  - **`palette.js`:** `PALETTE: string[]`, the look test's final 51-entry `PAL` list in the same order, and `paletteFloats() => Float32Array(153)`.
  - **`materials.js`:**
    - `LAYER = {regolith: 0, rock: 1, foil: 2, hull: 3, glass: 4, macro: 5}`, `LAYER_COUNT = 6`
    - `FLAG = {faceted: 1, regolith: 2, foil: 4, wobble: 8, pulse: 16, wet: 64, sway: 128}`
    - `MAT = {regolith: [0, .5, 0, 2], rock: [1, .7, 0, 1], foil: [2, 1.2, 0, 4], hull: [3, .8, 0, 0], glass: [4, 1, 0, 0]}`

    Later plans add layers to the end.
  - **`bake.js`:** `bakeTextures(gl) => {texA, texE}`. These are two 256² `TEXTURE_2D_ARRAY`s with `LAYER_COUNT` layers. The bake writes both through two render targets (MRT) and then generates mipmaps. Filtering: `NEAREST` magnification and `NEAREST_MIPMAP_LINEAR` minification.
  - **`renderer.js`:** `createRenderer(gl, hdrOK) => {resize(cssW, cssH, dpr, resH = 270), render(frame), capture()}`.
    - `capture()` reads back the low-res palette target and returns `{w, h, inPalette, black, colours}`, where `inPalette` and `black` are 0..1 fractions and `colours` is the number of distinct RGB values.
    - ```
      Frame = { t, cam: {x, y, z, yaw, pitch}, sky: boolean, mode: 0|1, sun: [3], earth: [3], curv,
                fog: [3], fogDensity, meshes: Array<{gpu, model: Float32Array(16), rot: Float32Array(9)}>,
                occTex: WebGLTexture|null, lights: {pos: Float32Array(64), col: Float32Array(64), count},
                spheres: Float32Array(32), exposure: 1, palMode: 0|1|2 }
      ```
- **Shaders,** ported from `spikes/look-test.html` with these changes:
  - `fsq.vert` is `FSQ_VS` unchanged.
  - `bake.frag` keeps `BAKE_FS`'s hash, noise and `panel()` helpers, and only the layers renumbered as `LAYER`: look-test 0→0, 1→1, 5→2, 7→3, 8→4, 9→5.
  - `world.vert` and `world.frag` are the final versions of `WORLD_VS` and `WORLD_FS`. In the frag, replace the literal rock layer `1.` with `L_ROCK` and the macro layer `9.` with `L_MACRO`, passed as defines.
  - `sky.frag` is `SKY_FS`, with the Earth direction constant replaced by `uniform vec3 uEarth`.
  - `post.frag` is `POST_FS`, with the palette replaced by `uniform vec3 P[NP]`, where `NP = 51` is passed as a define.
  - Keep every lighting, tone and dither constant from the look test.

- [ ] **Step 1: Add the failing palette check to the smoke spec**

Append to `tests/smoke.spec.mjs`:
```js
for (const [name, url] of URLS) test(`renders a palette-true frame from ${name}`, async ({ page }) => {
  const errors = watchErrors(page); await page.goto(url); await ready(page);
  const s = await page.evaluate(() => window.ospTest.capture());
  expect(s.inPalette).toBe(1); expect(s.colours).toBeGreaterThan(6); expect(s.black).toBeLessThan(0.9); expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm run test:smoke`
Expected: FAIL. `window.ospTest.capture is not a function`.

- [ ] **Step 3: Implement `gl.js`, `palette.js`, `materials.js`, `bake.js`, the six shaders and `renderer.js`, following the interfaces above**

The renderer's per-frame pipeline matches the look test:
1. Bind the half-float target (RGBA8 when `!hdrOK`) at low resolution.
2. Draw the sky with depth off.
3. Draw the world meshes with `depthFunc(LEQUAL)`.
4. Run the post pass into the RGBA8 low-res target (texture unit 3).
5. `blitFramebuffer` to the canvas with `NEAREST`.

`resize` makes the canvas `round(css × min(2, dpr))` and the low-res target `round(resH × canvasW / canvasH) × resH`.

- [ ] **Step 4: Replace `src/main.js` with a temporary demo**

The demo:
- Creates the GL context and renderer, and bakes the textures.
- Draws a 64 × 64 regolith grid at 1 m spacing (heights `valueNoise2(x/6, z/6, 1) · 1.5`), a rock `blob` and a hull `box`, under `sun = norm([−.43, .17, −.9])`.
- Uses a camera at `(0, 2.5, 20)`, yaw 0, pitch −0.15, with `palMode: 1` and `sky: true`.
- Sets `window.ospTest = {ready: true, capture: () => renderer.capture()}` after the first rendered frame.

- [ ] **Step 5: Run the smoke tests and look at a frame**

Run: `npm test && npm run test:smoke`
Expected: all PASS.

Then run `npm run dev`, open `http://localhost:4173/dev.html`, and compare against the look test. Expect the same grain, dither and hard shadow look.

- [ ] **Step 6: Commit**

```bash
git add src tests/smoke.spec.mjs
git commit -m "gfx: webgl2 renderer with gpu texture bake, sun-marched shadows, sky and palette post"
```

---

### Task 9: The walkable seeded Moon

**Files:**
- Create: `src/game/props.js`, `src/game/surfaceScene.js`, `src/game/input.js`, `src/ui/hud.js`
- Modify: `src/main.js` (replace the demo)
- Test: `tests/smoke.spec.mjs` (add the world, seed and robustness checks)

**Interfaces:**
- Consumes:
  - `generateSurface`, `sampleGround`, `checksumWorld` (Task 5)
  - `normalizeSeed`, `seedName`, `makeRng` (Task 2)
  - the mesh kit and math (Task 6)
  - `createPlayer`, `stepPlayer`, `PLAYER` (Task 7)
  - `createGL`, `uploadMesh`, `createHeightTexture`, `bakeTextures`, `createRenderer`, `MAT` (Task 8)
  - `vn3` (Task 3)
- Produces:
  - **`props.js`:**
    - `buildLander(M, x, y, z, yaw, groundAt)`: the look test's lander geometry, built at the origin facing +z and placed with `transformFrom(M, first, MM(T(x, y, z), Ry(yaw)))`. Footpads reach `groundAt(worldFootX, worldFootZ) − y`, using foot positions rotated by `yaw`.
    - `buildFlag(M, x, z, groundAt)`: the look test's pole and cloth.
  - **`surfaceScene.js`:** `buildSurfaceScene(gl, world) => {meshes, occTex, sun, earth, curv: 1/1800}`.
    - The terrain is the full 512² grid from `world.h` with `MAT.regolith`.
    - Rocks are `blob`s:
      - seg/rings 12/8 when `s > .8`, otherwise 8/6
      - displacement `1 + .35(vn3(a·1.7 + seed, …) − .5) + .12(vn3(a·4 + seed, …) − .5)`
      - yaw `yaw01 · 2π`
      - `MAT.rock`
    - The lander uses yaw `atan2(dx, dz)`, so its front faces the route.
    - The flag sits at the lander plus the rotated local offset `(−4.5, 3)`.
    - `occTex = createHeightTexture(gl, world.occ, 512)`, `sun = norm([−.43, .17, −.9])`, `earth = norm([.8·dx, .42, .8·dz])`. All mesh models are `I4` with rotation `I3`.
  - **`input.js`:** `createInput(canvas, player) => {read(): {fwd, strafe, run, jump}, locked(): boolean}`.
    - Clicking the canvas requests pointer lock `{unadjustedMovement: true}`, and on rejection requests it plain.
    - While locked, `mousemove` sets `player.yaw −= dx · .0022` and `player.pitch = clamp(pitch − dy · .0022, −1.5, 1.5)`.
    - Keys: W A S D and the arrows, Shift to run, Space to jump. Space's default action is prevented.
    - Keys work without pointer lock.
  - **`hud.js`:** `createHud() => {help(text), seed(text), debug(text), fatal(text)}`, writing to `#hud`, `#seed` and `#msg`. `fatal` shows `#msg` as flex.
  - **`main.js` flow:**
    1. `seed = normalizeSeed(location.hash) ?? seedName(makeRng(String(crypto.getRandomValues(new Uint32Array(1))[0])))`.
    2. `try { history.replaceState(null, '', '#' + seed) } catch {}`.
    3. Generate the world, build the scene, create the player at `world.spawn` and the input.
    4. Each frame:
       - Clamp `dt ≤ 0.05`.
       - Call `stepPlayer(p, input.read(), dt, (x, z) => sampleGround(world, x, z), 256 − 24)`.
       - Set the camera to the feet + `PLAYER.eye`.
       - Render with `palMode: 1`.
    5. The HUD:
       - help reads `Click to look around · WASD move · Shift run · Space jump` and is hidden after the first lock
       - seed reads `#` + seed
       - debug shows fps in DEBUG builds
    6. `hashchange` calls `location.reload()`.
    7. `webglcontextlost` calls `preventDefault()`, stops the loop, and calls `hud.fatal('Graphics context lost. Reload the page to continue.')`.
    8. `resize` calls `renderer.resize(...)`.
    9. DEBUG builds only: P cycles `palMode` and R cycles the resolution height through 180/270/360.
    10. After the first frame, set `window.ospTest = {ready: true, seed, checksum: checksumWorld(world), capture: () => renderer.capture(), player: () => ({x: p.x, y: p.y, z: p.z})}`.

- [ ] **Step 1: Add the failing world and robustness checks to the smoke spec**

```js
import { generateSurface } from '../src/gen/surface.js'; import { checksumWorld } from '../src/gen/checksum.js';
const NODE_SUM = checksumWorld(generateSurface('APOLLO-4471'));
for (const [name, url] of URLS) {
  test(`same Moon as Node for #APOLLO-4471 (${name})`, async ({ page }) => {
    const errors = watchErrors(page); await page.goto(url + '#APOLLO-4471'); await ready(page);
    expect(await page.evaluate(() => [window.ospTest.seed, window.ospTest.checksum])).toEqual(['APOLLO-4471', NODE_SUM]);
    const s = await page.evaluate(() => window.ospTest.capture()); expect(s.inPalette).toBe(1); expect(s.colours).toBeGreaterThan(8); expect(errors).toEqual([]);
  });
  test(`no hash -> random WORD-NNNN written to the hash (${name})`, async ({ page }) => {
    await page.goto(url); await ready(page); const [seed, hash] = await page.evaluate(() => [window.ospTest.seed, location.hash]);
    expect(seed).toMatch(/^[A-Z]+-\d{4}$/); expect(hash).toBe('#' + seed);
  });
}
test('pasting a new seed link loads the new Moon (Review Focus 2)', async ({ page }) => {
  await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page);
  await page.evaluate(() => { location.hash = '#EAGLE-0001'; });
  // the page reloads; poll across the navigation instead of waiting inside a context that gets destroyed
  await expect.poll(() => page.evaluate(() => window.ospTest?.ready && window.ospTest.seed).catch(() => null), { timeout: 30_000 }).toBe('EAGLE-0001');
});
test('narrow tall window keeps aspect and palette (Review Focus 3)', async ({ page }) => {
  const errors = watchErrors(page); await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page);
  await page.setViewportSize({ width: 400, height: 900 }); await page.waitForTimeout(300);
  const s = await page.evaluate(() => window.ospTest.capture()); expect([s.w, s.h]).toEqual([120, 270]); expect(s.inPalette).toBe(1); expect(errors).toEqual([]);
});
test('keyboard moves you without pointer lock (Review Focus 4)', async ({ page }) => {
  await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page); const a = await page.evaluate(() => window.ospTest.player());
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1000); await page.keyboard.up('KeyW');
  const b = await page.evaluate(() => window.ospTest.player()); expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(1);
});
test('lost GPU context shows a reload message (Review Focus 5)', async ({ page }) => {
  await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page);
  await page.evaluate(() => document.getElementById('c').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.locator('#msg')).toContainText('Graphics context lost');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm run test:smoke`
Expected: FAIL. The temporary demo has no `seed`, `checksum` or `player`.

- [ ] **Step 3: Implement `props.js`, `surfaceScene.js`, `input.js` and `hud.js`, and replace `main.js`, following the interfaces above**

- [ ] **Step 4: Run all tests**

Run: `npm test && npm run test:seeds && npm run test:smoke`
Expected:
- all PASS
- the build prints a size well under 131,072 bytes (expect about 15–30 KB at this stage)
- the smoke checksums match Node in both chromium and firefox

- [ ] **Step 5: Manual look and performance check, on real hardware (user)**

1. Run `npm run build`.
2. Open `dist/index.html` directly from disk in Chrome and in Firefox on the user's machine (Radeon 890M).
3. Then open `npm run dev`'s `dev.html` to read the fps counter.

Expected:
- **Look:** the surface reads like the approved look test, with grit, hard black shadows, the gold-foil lander, the flag, and Earth ahead and up from the spawn.
- **Movement:** walking and low-gravity jumping feel right.
- **Speed:** the dev build holds 60 fps or better at 480 × 270.

Record the fps and anything off in the commit message.

- [ ] **Step 6: Commit**

```bash
git add src tests/smoke.spec.mjs
git commit -m "game: walkable seeded moon with lander, flag, rocks and robust boot"
```
