import { test, expect } from '@playwright/test'; import { pathToFileURL } from 'node:url'; import { resolve } from 'node:path';
import { generateWorld } from '../src/gen/world.js'; import { checksumWorld } from '../src/gen/checksum.js';
import { HELP_TIME } from '../src/ui/hud.js'; import { fmtTime } from '../src/ui/score.js'; import { OPEN } from '../src/game/opening.js'; import { HOLD, ENDING } from '../src/game/hold.js'; import { KO, BREAK, SHIP, FLARE, LIFT } from '../src/game/escape.js'; import { CUES } from '../src/game/script.js'; import { GOLF_TOTAL } from '../src/game/fight.js';
export const URLS = [['file', pathToFileURL(resolve('dist/index.html')).href], ['http', 'http://localhost:4173/index.html']];
// Benign Firefox parser note about the packed binary payload when the server's utf-8 header overrides the page's iso-8859-15 meta; real decoding failures are caught by the ready check.
const BENIGN = /byte stream was erroneous according to the character encoding/i;
export function watchErrors(page) { const e = []; page.on('pageerror', x => e.push(String(x))); page.on('console', m => m.type() === 'error' && !BENIGN.test(m.text()) && e.push(m.text())); return e; }
export const ready = page => page.waitForFunction(() => window.ospTest?.ready === true, null, { timeout: 30_000 });
export const start = async (page, url = URLS[1][1] + '#APOLLO-4471') => { await page.goto(url); await ready(page); await page.evaluate(() => window.ospTest.play()); };
// Slow-runner headroom: explicit waits triple on CI (software WebGL on 2 vCPUs); local timings are unchanged.
export const T = ms => process.env.CI ? ms * 3 : ms;
export const capt = page => page.evaluate(() => window.ospTest.capture());
export const state = page => page.evaluate(() => window.ospTest.state());
for (const [name, url] of URLS) test(`boots from ${name}`, async ({ page }) => {
  const errors = watchErrors(page); await page.goto(url); await ready(page); await page.waitForTimeout(1000); expect(errors).toEqual([]);
});
for (const [name, url] of URLS) test(`renders a palette-true frame from ${name}`, async ({ page }) => {
  const errors = watchErrors(page); await page.goto(url); await ready(page);
  const s = await page.evaluate(() => window.ospTest.capture());
  expect(s.inPalette).toBe(1); expect(s.colours).toBeGreaterThan(6); expect(s.black).toBeLessThan(0.9); expect(errors).toEqual([]);
});
const NODE_SUM = checksumWorld(generateWorld('APOLLO-4471'));
for (const [name, url] of URLS) {
  test(`same Moon as Node for #APOLLO-4471 (${name})`, async ({ page }) => {
    const errors = watchErrors(page); await start(page, url + '#APOLLO-4471');
    expect(await page.evaluate(() => [window.ospTest.seed, window.ospTest.checksum])).toEqual(['APOLLO-4471', NODE_SUM]);
    const s = await page.evaluate(() => window.ospTest.capture()); expect(s.inPalette).toBe(1); expect(s.colours).toBeGreaterThan(8); expect(errors).toEqual([]);
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
  await start(page); const a = await page.evaluate(() => window.ospTest.player());
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1000); await page.keyboard.up('KeyW');
  const b = await page.evaluate(() => window.ospTest.player()); expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(1);
});
test('lost GPU context shows a reload message (Review Focus 5)', async ({ page }) => {
  const errors = watchErrors(page); await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page);
  await page.evaluate(() => document.getElementById('c').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.locator('#msg')).toContainText('Graphics context lost');
  await page.waitForTimeout(500); expect(errors).toEqual([]);
});
test('falls back to RGBA8 without EXT_color_buffer_float', async ({ page }) => {
  await page.addInitScript(() => { const g = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function (n) { return n === 'EXT_color_buffer_float' ? null : g.call(this, n); }; });
  const errors = watchErrors(page); await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page);
  const [hdr, s] = await page.evaluate(() => [window.ospTest.hdr, window.ospTest.capture()]);
  expect(hdr).toBe(false); expect(s.inPalette).toBe(1); expect(s.colours).toBeGreaterThan(8); expect(errors).toEqual([]); });
test('an error inside the frame loop shows a message and stops the loop', async ({ page }) => {
  const errors = watchErrors(page); await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page);
  await page.evaluate(() => window.ospTest.fault()); await expect(page.locator('#msg')).toContainText('Something went wrong');
  const a = await page.evaluate(() => window.ospTest.frames()); await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.ospTest.frames())).toBe(a); expect(errors.some(e => /test fault/.test(e))).toBe(true); });
const fight = page => page.evaluate(() => window.ospTest.fight());
test('a surface fight: aliens shoot back and the frame stays palette-true', async ({ page }) => {
  const errors = watchErrors(page); await start(page);
  await page.evaluate(() => { const o = window.ospTest; o.grab(); o.give(); o.warp(1); });
  await expect.poll(() => fight(page).then(f => f.bolts), { timeout: 15_000 }).toBeGreaterThan(0);
  const s = await page.evaluate(() => window.ospTest.capture()); expect(s.inPalette).toBe(1); expect(s.colours).toBeGreaterThan(8); expect(errors).toEqual([]); });
test('dying sends you back to the wreck with a fresh area', async ({ page }) => {
  const errors = watchErrors(page); await start(page);
  await page.evaluate(() => { const o = window.ospTest; o.grab(); o.warp(2); o.hurt(999); });
  await expect(page.locator('#prompt')).toContainText('died'); await expect.poll(() => fight(page).then(f => f.state), { timeout: 10_000 }).toBe('play');
  const f = await fight(page); expect(f.hp).toBe(100); expect(f.atStart).toBe(true); expect(errors).toEqual([]); });
test('weapon keys work without pointer lock; the capture click never fires (Review Focus 5)', async ({ page }) => {
  await start(page); await page.evaluate(() => { window.ospTest.grab(); window.ospTest.give(); });
  await page.keyboard.press('Digit2'); await expect.poll(() => fight(page).then(f => f.cur)).toBe(1);
  await page.keyboard.press('Digit1'); await expect.poll(() => fight(page).then(f => f.cur)).toBe(0);
  await page.mouse.click(300, 300); await page.waitForTimeout(300); expect((await fight(page)).shots).toBe(0); });
test('the HUD overlays let the capture click through to the canvas (M7)', async ({ page }) => {
  await start(page); await page.evaluate(() => window.ospTest.grab()); await page.waitForTimeout(300);
  const hits = await page.evaluate(() => ['hud', 'seed', 'stat', 'prompt', 'flash', 'x', 'sub', 'way', 'clk'].map(id => { const r = document.getElementById(id).getBoundingClientRect();
    return r.width && r.height ? [id, document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.id] : null; }).filter(Boolean));
  expect(hits.length).toBeGreaterThanOrEqual(4); for (const [id, at] of hits) expect(at, id).toBe('c'); });
test('below 25 health only the number turns red, and an unchanged status line is not rewritten (M8)', async ({ page }) => {
  const errors = watchErrors(page); await start(page); await page.evaluate(() => { window.ospTest.grab(); window.ospTest.hurt(80); });
  await expect(page.locator('#stat')).toContainText('HEALTH 20');
  const s = await page.evaluate(() => new Promise(done => { const el = document.getElementById('stat'), n = el.querySelector('span'); let m = 0;
    new MutationObserver(r => { m += r.length; }).observe(el, { subtree: true, childList: true, characterData: true, attributes: true });
    setTimeout(() => done({ line: getComputedStyle(el).color, num: n && getComputedStyle(n).color, text: n?.textContent, m }), 500); }));
  expect(s).toEqual({ line: 'rgb(184, 174, 156)', num: 'rgb(184, 48, 26)', text: '20', m: 0 }); expect(errors).toEqual([]); });
test('without WebGL2 the failure screen shows only its message (carry-over)', async ({ page }) => {
  await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { return t === 'webgl2' ? null : g.call(this, t, o); }; });
  await page.goto(URLS[1][1] + '#APOLLO-4471'); await expect(page.locator('#msg')).toContainText('Could not start');
  expect(await page.evaluate(() => ['stat', 'prompt', 'flash'].map(id => document.getElementById(id).textContent).join(''))).toBe('');
  expect(await page.locator('#x').isVisible()).toBe(false); await expect(page.locator('#title')).toBeHidden(); });
const toBase = async page => { await page.evaluate(() => { const o = window.ospTest; o.grab(); o.give(); o.door(); });
  await expect(page.locator('#prompt')).toContainText('enter the hangar'); await page.evaluate(() => window.ospTest.enter());
  await expect.poll(() => page.evaluate(() => window.ospTest.area()), { timeout: 10_000 }).toBe('base'); };
// M6: the fog alone keeps black low, so the lamps are checked by the frame's mean brightness (0-255). At the lift this frame measures
// 29.0 in chromium and firefox with R16's lamps (and M4's corner pipes), and 23.6 with the old wall-clearance radii.
const BASE_MEAN = 26;
test('walking into the base renders palette-true with no errors, and lit', async ({ page }) => {
  const errors = watchErrors(page); await start(page); await toBase(page); await page.waitForTimeout(500);
  const s = await page.evaluate(() => window.ospTest.capture()); expect(s.inPalette).toBe(1); expect(s.colours).toBeGreaterThan(6); expect(s.black).toBeLessThan(.9);
  expect(s.mean).toBeGreaterThan(BASE_MEAN); expect(errors).toEqual([]); });
test('dying in the base restarts you at the lift', async ({ page }) => {
  const errors = watchErrors(page); await start(page); await toBase(page);
  await page.evaluate(() => { window.ospTest.warp(0); window.ospTest.hurt(999); }); await expect(page.locator('#prompt')).toContainText('the lift');
  await expect.poll(() => fight(page).then(f => f.state), { timeout: 10_000 }).toBe('play');
  const f = await fight(page); expect([f.area, f.atStart, f.hp]).toEqual(['base', true, 100]); expect(errors).toEqual([]); });
test('a lost GPU context in the base still shows the reload message', async ({ page }) => {
  const errors = watchErrors(page); await start(page); await toBase(page);
  // area() turns 'base' inside enter(); two more frames mean the base scene has been swapped in and drawn before the loss
  const n = await page.evaluate(() => window.ospTest.frames()); await expect.poll(() => page.evaluate(() => window.ospTest.frames())).toBeGreaterThan(n + 1);
  await page.evaluate(() => document.getElementById('c').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.locator('#msg')).toContainText('Graphics context lost'); await page.waitForTimeout(500); expect(errors).toEqual([]); });
const area = page => page.evaluate(() => window.ospTest.area());
test('the prison renders palette-true and lit, with air; you hold the pole at 70 hp behind shut bars (Plan 6)', async ({ page }) => {
  const errors = watchErrors(page); await start(page); await page.evaluate(() => window.ospTest.prison()); await expect.poll(() => area(page)).toBe('prison');
  const f = await fight(page); expect([f.cell.shut, f.hp, f.cur]).toEqual([true, KO.hp, 0]); await expect.poll(() => page.evaluate(() => window.ospTest.audio().air)).toBe(true);
  const s = await page.evaluate(() => window.ospTest.capture()); expect(s.inPalette).toBe(1); expect(s.colours).toBeGreaterThan(6); expect(s.black).toBeLessThan(.9); expect(errors).toEqual([]); });
test('the page opens on the title: ONE SMALL PROBLEM, one New Game option, a live run behind it, the hash untouched (title)', async ({ page }) => {
  const errors = watchErrors(page); await page.goto(URLS[1][1]); await ready(page);
  await expect(page.locator('#title')).toBeVisible(); await expect(page.locator('#logo')).toHaveText('ONE SMALL PROBLEM');
  expect(await page.locator('#title button').count()).toBe(1); await expect(page.locator('#new')).toHaveText('New Game'); expect(await state(page)).toBe('title');
  const n = await page.evaluate(() => window.ospTest.frames()); await expect.poll(() => page.evaluate(() => window.ospTest.frames())).toBeGreaterThan(n + 2);
  expect(await page.evaluate(() => [location.hash, window.ospTest.seed])).toEqual(['', null]); expect(errors).toEqual([]); });
test('with no seed in the URL, New Game rolls one and writes it with replaceState (seeds)', async ({ page }) => {
  await page.goto(URLS[1][1]); await ready(page); const h0 = await page.evaluate(() => history.length); await page.click('#new');
  await expect.poll(() => state(page)).not.toBe('title'); const [seed, hash, h1] = await page.evaluate(() => [window.ospTest.seed, location.hash, history.length]);
  expect(seed).toMatch(/^[A-Z]+-\d{4}$/); expect(hash).toBe('#' + seed); expect(h1).toBe(h0); await expect(page.locator('#title')).toBeHidden(); });
test('New Game plays the URL seed (seeds)', async ({ page }) => {
  await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page); await expect(page.locator('#mission')).toHaveText('Mission #APOLLO-4471'); await page.click('#new');
  await expect.poll(() => state(page)).not.toBe('title'); expect(await page.evaluate(() => [window.ospTest.seed, location.hash])).toEqual(['APOLLO-4471', '#APOLLO-4471']); });
for (const [name, url] of URLS) test(`the end screen shows time, kills, golf balls and ${name === 'file' ? 'the seed code with a copy button' : 'a share link'} (${name})`, async ({ page }) => {
  const errors = watchErrors(page); await start(page, url + '#APOLLO-4471'); await page.evaluate(() => window.ospTest.finish()); await expect(page.locator('#end')).toBeVisible();
  const s = page.locator('#stats'); await expect(s).toContainText(/TIME \d+:\d\d/); await expect(s).toContainText('KILLS 0'); await expect(s).toContainText('GOLF BALLS 0/' + GOLF_TOTAL);
  if (name === 'file') { await expect(page.locator('#code')).toHaveText('APOLLO-4471'); await expect(page.locator('#copy')).toBeVisible(); await expect(page.locator('#link')).toBeHidden(); }
  else { await expect(page.locator('#link')).toHaveAttribute('href', 'http://localhost:4173/index.html#APOLLO-4471'); await expect(page.locator('#code')).toBeHidden(); }
  expect(errors).toEqual([]); });
test('Back to title brings back the title with a fresh run behind it and clears the hash (flow)', async ({ page }) => {
  const errors = watchErrors(page); await start(page); await page.evaluate(() => window.ospTest.finish()); await page.click('#back');
  await expect(page.locator('#title')).toBeVisible(); await expect(page.locator('#end')).toBeHidden(); expect(await state(page)).toBe('title');
  expect(await page.evaluate(() => location.hash)).toBe(''); expect(errors).toEqual([]); });
test('the best time per seed is remembered (end screen)', async ({ page }) => {
  await start(page); await page.evaluate(() => window.ospTest.finish()); await expect(page.locator('#stats')).toContainText('NEW BEST'); await page.click('#back');
  await page.evaluate(() => { history.replaceState(null, '', '#APOLLO-4471'); const o = window.ospTest; o.play(); o.ff(2); o.finish(); });
  await expect(page.locator('#stats')).toContainText(/BEST \d+:\d\d/); });
// pre-flight F1: headless Chromium and Firefox both grant the lock on the #new click, and while locked a click on #back lands on the canvas.
// New Game plays the opening first (Task 8); the run can only finish from play, so the test plays through it, still holding the click's lock.
test('the end screen releases the pointer lock, so Back to title works after a New Game click (flow)', async ({ page }) => {
  await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page); await page.click('#new'); await expect.poll(() => state(page)).toBe('opening');
  await throughOpening(page); await page.evaluate(() => window.ospTest.finish()); await expect(page.locator('#end')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true); await page.click('#back');
  await expect(page.locator('#title')).toBeVisible(); expect(await state(page)).toBe('title'); });
// R2: the help line shows as each run starts and hides after HELP_TIME s of the run's play time; a death restart doesn't bring it back
test('the help line shows at the start of a run, hides after HELP_TIME s of play, stays hidden through a death, and returns with the next run (R2)', async ({ page }) => {
  const errors = watchErrors(page); await start(page); const help = page.locator('#hud > div').first(); await expect(help).toContainText('Esc pause');
  await page.evaluate(t => window.ospTest.ff(t), HELP_TIME - 2); await expect(help).toContainText('Esc pause');
  await page.evaluate(() => window.ospTest.ff(2.5)); await expect(help).toHaveText('');
  await page.evaluate(() => { window.ospTest.hurt(999); window.ospTest.ff(4); }); expect((await fight(page)).state).toBe('play'); await expect(help).toHaveText('');
  await page.evaluate(() => { window.ospTest.finish(); window.ospTest.play(); }); await expect(help).toContainText('Esc pause'); expect(errors).toEqual([]); });
export const paused = page => page.evaluate(() => window.ospTest.paused());
test('Esc pauses and releases the mouse; nothing moves while paused; Esc again resumes (pause)', async ({ page }) => {
  // R5: Esc only once the click's lock is held (under load the raw request is refused late and the plain fallback locks later
  // still), and the release is polled, since browsers let go of the lock asynchronously
  const errors = watchErrors(page); await start(page); await page.mouse.click(300, 300);
  await expect.poll(() => page.evaluate(() => document.pointerLockElement !== null), { timeout: 15_000 }).toBe(true);
  await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(true); await expect(page.locator('#pause')).toBeVisible();
  await expect(page.locator('#controls')).toContainText('WASD move'); // R3: the controls stay reachable after the help line hides
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBe(null);
  const t = await page.evaluate(() => window.ospTest.fight().time); await page.waitForTimeout(400); expect(await page.evaluate(() => window.ospTest.fight().time)).toBe(t);
  await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(false); await expect(page.locator('#pause')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.ospTest.fight().time)).toBeGreaterThan(t); expect(errors).toEqual([]); });
test('settings apply at once and survive a reload (settings)', async ({ page }) => {
  test.slow(); // each palette/resolution change rebuilds GPU state, seconds on a software-GL runner
  const errors = watchErrors(page); await start(page); await page.keyboard.press('Escape'); await expect(page.locator('#pause')).toBeVisible();
  await page.selectOption('#res', '0'); await expect.poll(async () => (await capt(page)).h, { timeout: T(15_000) }).toBe(180);
  await page.uncheck('#pal'); await expect.poll(async () => (await capt(page)).colours, { timeout: T(15_000) }).toBeGreaterThan(51);
  await page.check('#pal'); await page.check('#inv'); await page.fill('#vol', '0.3'); await page.reload(); await ready(page);
  expect((await page.evaluate(() => window.ospTest.capture())).h).toBe(180);
  expect(await page.evaluate(() => window.ospTest.settings())).toEqual({ res: 0, pal: true, vol: .3, sens: 1, invert: true }); expect(errors).toEqual([]); });
test('a localStorage that throws leaves the settings and the end screen working (Review Focus 4)', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }));
  const errors = watchErrors(page); await start(page); await page.keyboard.press('Escape'); await page.selectOption('#res', '2');
  await expect.poll(async () => (await capt(page)).h, { timeout: T(15_000) }).toBe(360); await page.keyboard.press('Escape'); await page.evaluate(() => window.ospTest.finish());
  await expect(page.locator('#stats')).toContainText('KILLS 0'); await expect(page.locator('#stats')).not.toContainText('BEST'); expect(errors).toEqual([]); });
// R3: a storage whose methods throw (the object is there, every call fails) is survived the same way
test('a Storage whose getItem and setItem throw leaves settings in memory and the end screen working (R3)', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('denied'); }; Storage.prototype.setItem = () => { throw new Error('full'); }; });
  const errors = watchErrors(page); await start(page); await page.keyboard.press('Escape'); await page.selectOption('#res', '0');
  await expect.poll(async () => (await capt(page)).h, { timeout: T(15_000) }).toBe(180); expect((await page.evaluate(() => window.ospTest.settings())).res).toBe(0);
  await page.keyboard.press('Escape'); await page.evaluate(() => window.ospTest.finish());
  await expect(page.locator('#end')).toBeVisible(); await expect(page.locator('#stats')).toContainText('KILLS 0'); expect(errors).toEqual([]); });
// R3: New Game and Back run inside the fatal path
test('an exception in a menu click shows the fatal message and stops the loop (R3)', async ({ page }) => {
  await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page);
  await page.evaluate(() => { WebGL2RenderingContext.prototype.createBuffer = () => { throw new Error('boom'); }; });
  await page.evaluate(() => document.getElementById('new').click());
  await expect(page.locator('#msg')).toContainText('Something went wrong'); const a = await page.evaluate(() => window.ospTest.frames()); await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.ospTest.frames())).toBe(a); });
// Review fix: no pause menu over the fatal message
test('Esc after an error in the frame loop does not bring up the pause menu', async ({ page }) => {
  await start(page); await page.evaluate(() => window.ospTest.fault()); await expect(page.locator('#msg')).toContainText('Something went wrong');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); await expect(page.locator('#pause')).toBeHidden(); await expect(page.locator('#msg')).toBeVisible(); });
test('Esc after a lost GPU context does not bring up the pause menu', async ({ page }) => {
  await start(page); await page.evaluate(() => document.getElementById('c').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.locator('#msg')).toContainText('Graphics context lost');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); await expect(page.locator('#pause')).toBeHidden(); await expect(page.locator('#msg')).toBeVisible(); });
test('the attract bot plays behind the title, starts a fresh Moon when its run ends, and never touches the hash (Review Focus 5)', async ({ page }) => {
  const errors = watchErrors(page); await page.goto(URLS[1][1]); await ready(page); const a = await page.evaluate(() => window.ospTest.player());
  await expect.poll(async () => { const b = await page.evaluate(() => window.ospTest.player()); return Math.hypot(b.x - a.x, b.z - a.z); }, { timeout: 10_000 }).toBeGreaterThan(1);
  const s0 = (await page.evaluate(() => window.ospTest.attract())).seed; await page.evaluate(() => window.ospTest.ff(700));
  expect((await page.evaluate(() => window.ospTest.attract())).seed).not.toBe(s0); expect(await page.evaluate(() => location.hash)).toBe('');
  expect(await state(page)).toBe('title'); expect(await page.evaluate(() => window.ospTest.opening())).toBe(null); expect(errors).toEqual([]); }); // spec 4.1: never the opening
// R6: a pointer lock that arrives when the game doesn't want one (a request still in flight when it paused, finished or quit) is
// released at once, so the menus' buttons take clicks (pre-flight F1). countLocks counts the locks that arrive, from a listener
// added before the page's own (which lets go at once); askLockOn makes a click on element id ask for the lock, as a late request would.
const countLocks = page => page.addInitScript(() => { window.LOCKS = 0; document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) window.LOCKS++; }); });
const askLockOn = (page, id) => page.evaluate(i => document.getElementById(i).addEventListener('click', () => document.getElementById('c').requestPointerLock()?.catch?.(() => {}), { once: true }), id);
test('a pointer lock that arrives on the end screen is released at once, so Back to title takes the click (R6)', async ({ page }) => {
  await countLocks(page); const errors = watchErrors(page); await start(page); await page.evaluate(() => window.ospTest.finish()); await expect(page.locator('#end')).toBeVisible();
  await askLockOn(page, 'stats'); await page.click('#stats');
  await expect.poll(() => page.evaluate(() => window.LOCKS)).toBe(1); await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBe(null);
  await page.click('#back'); await expect(page.locator('#title')).toBeVisible(); expect(await state(page)).toBe('title'); expect(errors).toEqual([]); });
test('under the pause menu a raw lock refused late never falls back, and a lock that arrives is released, so Resume takes the click (R6)', async ({ page }) => {
  test.slow(); // several late lock round-trips; on a 2 vCPU runner Chromium takes seconds per click
  // the raw request (unadjustedMovement) stays pending until the test refuses it, as headless Chromium does late under load
  await page.addInitScript(() => { const rq = Element.prototype.requestPointerLock;
    Element.prototype.requestPointerLock = function (o) { return o?.unadjustedMovement ? new Promise((_, no) => { window.refuseRaw = () => no(new DOMException('raw', 'NotSupportedError')); }) : rq.call(this, o); }; });
  await countLocks(page); const errors = watchErrors(page); await start(page); await page.mouse.click(300, 300);
  await expect.poll(() => page.evaluate(() => typeof window.refuseRaw)).toBe('function');
  await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(true);
  await page.evaluate(() => window.refuseRaw()); await page.waitForTimeout(1000);
  expect(await page.evaluate(() => [window.LOCKS, document.pointerLockElement])).toEqual([0, null]);
  await askLockOn(page, 'controls'); await page.click('#controls');
  await expect.poll(() => page.evaluate(() => window.LOCKS)).toBe(1); await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBe(null);
  await page.click('#resume'); await expect.poll(() => paused(page)).toBe(false); expect(errors).toEqual([]); });
export const toComms = async page => { await page.evaluate(() => { const o = window.ospTest; o.grab(); o.give(); o.comms(); });
  await expect.poll(() => page.evaluate(() => window.ospTest.area()), { timeout: 10_000 }).toBe('comms'); await expect(page.locator('#prompt')).toContainText('call Houston'); };
export const onHold = async page => { await page.keyboard.press('KeyE'); await expect.poll(() => fight(page).then(f => f.hold)).not.toBe(null); };
const clock = page => page.evaluate(() => window.ospTest.clock());
test('dying during the final stand restarts you at the comms door, off hold (final stand)', async ({ page }) => {
  const errors = watchErrors(page); await start(page); await toComms(page); await onHold(page); await page.evaluate(() => window.ospTest.hurt(999));
  await expect(page.locator('#prompt')).toContainText('the comms room door'); await expect.poll(() => fight(page).then(f => f.state), { timeout: 10_000 }).toBe('play');
  const f = await fight(page); expect([f.area, f.atStart, f.hold]).toEqual(['comms', true, null]); expect(errors).toEqual([]); });
test('pausing on hold or in Houston\'s call stops the hold timer and the knock-out clock until you resume (Review Focus 3)', async ({ page }) => {
  await start(page); await toComms(page); await onHold(page); await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(true);
  const h = (await clock(page)).hold; await page.waitForTimeout(600); expect((await clock(page)).hold).toBe(h); await page.keyboard.press('Escape');
  await page.evaluate(() => { window.ospTest.god(true); window.ospTest.ff(91); }); await expect.poll(() => fight(page).then(f => f.ko)).toBe('call');
  await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(true); const e = (await clock(page)).ko; await page.waitForTimeout(600);
  expect((await clock(page)).ko).toBe(e); await expect(page.locator('#end')).toBeHidden(); await page.keyboard.press('Escape');
  await expect.poll(() => area(page), { timeout: T(40_000) }).toBe('prison'); await expect(page.locator('#end')).toBeHidden(); }); // Plan 6: the call resumes into the knock-out
test('a new run starts at the settled wreck (opening)', async ({ page }) => { const errors = watchErrors(page); await start(page);
  expect(await page.evaluate(() => [window.ospTest.state(), window.ospTest.opening()])).toEqual(['play', null]); // ospTest.play() skips the opening
  expect(await page.evaluate(() => window.ospTest.wreck())).toEqual({ n: 11, still: 11 }); const s = await page.evaluate(() => window.ospTest.capture());
  expect(s.inPalette).toBe(1); expect(s.colours).toBeGreaterThan(8); expect(errors).toEqual([]); });
const ff = (page, s, i = {}) => page.evaluate(([s, i]) => window.ospTest.ff(s, i), [s, i]);
// Carry-over (R11): the aliens come at least OPEN.talk + OPEN.company after the first step, so a prompt plant still waits OPEN.talk for them.
export const throughOpening = async page => { await ff(page, OPEN.descent + OPEN.hatch + 1); await expect(page.locator('#prompt')).toHaveText('[W] climb out');
  await ff(page, 6, { fwd: 1 }); await expect(page.locator('#prompt')).toHaveText('[E] plant the flag'); await ff(page, .1, { use: true });
  await ff(page, OPEN.talk + OPEN.company + OPEN.fire + OPEN.flight + OPEN.title + 1); await expect.poll(() => state(page)).toBe('play'); };
test('New Game plays the opening to the title drop, then the surface fight (opening)', async ({ page }) => {
  const errors = watchErrors(page); await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page); await page.click('#new'); await expect.poll(() => state(page)).toBe('opening');
  const s = await page.evaluate(() => window.ospTest.capture()); expect(s.inPalette).toBe(1); await throughOpening(page);
  await expect(page.locator('#stamp')).toBeVisible(); await expect(page.locator('#stamp')).toHaveText('ONE SMALL PROBLEM');
  const f = await fight(page); expect([f.state, f.hp, f.area]).toEqual(['play', 100, 'surface']); expect(errors).toEqual([]);
  // carry-over (Task 6): the blast swapped the scene's shadow map, and the frame draws the new one, not the deleted intact one
  expect(await page.evaluate(() => [window.ospTest.occ(), window.ospTest.opening(), window.ospTest.clock().opening])).toEqual([true, null, null]); });
test('pausing mid-opening stops its clock until you resume (Review Focus 3)', async ({ page }) => {
  await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page); await page.click('#new'); await expect.poll(() => state(page)).toBe('opening'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(true); const a = (await clock(page)).opening; await page.waitForTimeout(600);
  expect((await clock(page)).opening).toBe(a); await page.keyboard.press('Escape'); await expect.poll(() => clock(page).then(c => c.opening)).toBeGreaterThan(a); });
// Carry-over (Task 3): the director moves you, the wreck and the particles only as its clock runs, so pausing in the knock-down,
// with you and the pieces in the air, freezes all of it.
test('pausing in the knock-down freezes the opening: its clock, you and the wreck (Review Focus 3)', async ({ page }) => {
  const errors = watchErrors(page); await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page); await page.click('#new'); await expect.poll(() => state(page)).toBe('opening');
  await ff(page, OPEN.descent + OPEN.hatch + 1); await ff(page, 6, { fwd: 1 }); await ff(page, .1, { use: true });
  await page.evaluate(() => { const o = window.ospTest; for (let i = 0; i < 300 && o.opening().phase !== 'down'; i++) o.ff(.1); });
  await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(true);
  const snap = () => page.evaluate(() => { const o = window.ospTest; return [o.opening(), o.player(), o.wreck()]; }), a = await snap();
  expect(['down', 'up']).toContain(a[0].phase); expect(a[2].still).toBeLessThan(11); await page.waitForTimeout(600); expect(await snap()).toEqual(a);
  await page.keyboard.press('Escape'); await expect.poll(() => clock(page).then(c => c.opening)).toBeGreaterThan(a[0].t); expect(errors).toEqual([]); });
test('with no audio and no speech at all the game still plays: title, New Game, the opening, a fight, no errors (Review Focus 2)', async ({ page }) => {
  await page.addInitScript(() => { for (const k of ['AudioContext', 'webkitAudioContext', 'OfflineAudioContext', 'speechSynthesis', 'SpeechSynthesisUtterance']) try { delete window[k]; Object.defineProperty(window, k, { value: undefined, configurable: true }); } catch {} });
  const errors = watchErrors(page); await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page); await page.click('#new'); await expect.poll(() => state(page)).toBe('opening');
  await page.evaluate(() => window.ospTest.ff(12)); expect((await page.evaluate(() => window.ospTest.audio())).ctx).toBe(null);
  await page.evaluate(() => { const o = window.ospTest; o.play(); o.grab(); o.give(); o.warp(1); }); await expect.poll(() => fight(page).then(f => f.bolts), { timeout: 15_000 }).toBeGreaterThan(0);
  expect(errors).toEqual([]); });
test('the air filter muffles the surface and opens in the base (audio)', async ({ page }) => {
  await start(page); const a = await page.evaluate(() => window.ospTest.audio()); expect(a.ctx).not.toBe(null); expect(a.air).toBe(false);
  await toBase(page); await expect.poll(() => page.evaluate(() => window.ospTest.audio().air)).toBe(true); });
test('the six songs pre-render non-silent where OfflineAudioContext exists (music)', async ({ page }) => {
  await page.goto(URLS[1][1]); await ready(page); test.skip(!(await page.evaluate(() => typeof OfflineAudioContext === 'function')), 'no OfflineAudioContext');
  await expect.poll(() => page.evaluate(() => Object.keys(window.ospTest.audio().songs ?? {}).length), { timeout: 20_000 }).toBe(6);
  const s = await page.evaluate(() => window.ospTest.audio().songs); for (const k of ['surface', 'crater', 'base', 'hold', 'prison', 'escape']) expect(s[k]).toBeGreaterThan(.01); });
test('the music follows the run: surface, crater over the rim, base through the door, hold on the array (music)', async ({ page }) => {
  const song = () => page.evaluate(() => window.ospTest.audio().song); await start(page); expect(await song()).toBe('surface');
  await page.evaluate(() => window.ospTest.door()); await expect.poll(song).toBe('crater'); await page.evaluate(() => window.ospTest.enter()); await expect.poll(song).toBe('base');
  await toComms(page); await onHold(page); await expect.poll(song).toBe('hold'); });
test('the prison song plays in the cells, the escape song on the climb (music)', async ({ page }) => {
  const song = () => page.evaluate(() => window.ospTest.audio().song); await start(page); await page.evaluate(() => window.ospTest.prison()); await expect.poll(song).toBe('prison');
  await page.evaluate(() => window.ospTest.lift()); await expect.poll(song).toBe('escape'); });
// The jump across the loop seam must not be a click: at most 2x the 99th percentile of |sample-to-sample delta| inside the song (a robust
// "typical loud step": the percentile ignores a few drum transients, and a click is a step far above what the music itself does).
test('every song loops without a click: the seam jump is no larger than twice the 99th-percentile step inside it (music)', async ({ page }) => {
  await page.goto(URLS[1][1]); await ready(page); test.skip(!(await page.evaluate(() => typeof OfflineAudioContext === 'function')), 'no OfflineAudioContext');
  await expect.poll(() => page.evaluate(() => Object.keys(window.ospTest.audio().songs ?? {}).length), { timeout: 20_000 }).toBe(6);
  const r = await page.evaluate(() => Object.fromEntries(['surface', 'crater', 'base', 'hold', 'prison', 'escape'].map(k => { const d = window.ospTest.songBuffer(k).getChannelData(0), a = new Float32Array(d.length - 1);
    for (let i = 1; i < d.length; i++) a[i - 1] = Math.abs(d[i] - d[i - 1]); a.sort(); return [k, [Math.abs(d[d.length - 1] - d[0]), a[Math.floor(a.length * .99)]]]; })));
  for (const [k, [jump, p99]] of Object.entries(r)) expect(jump, k).toBeLessThanOrEqual(2 * p99 + 1e-6); });
// pre-flight F4: headless Firefox can expose espeak voices (14,805 on the dev machine), so this pins the unvoiced path
export const noVoices = page => page.addInitScript(() => { try { speechSynthesis.getVoices = () => []; } catch {} });
test('the radio subtitles the opening with a speaker label and a keyed dot (radio)', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page); await page.click('#new'); await expect.poll(() => state(page)).toBe('opening');
  await ff(page, OPEN.descent + .5); await expect(page.locator('#sub')).toHaveText('YOU: Contact light. Engine stop.'); await expect(page.locator('#sub')).toHaveClass(/\bon\b/);
  await ff(page, 3); await expect(page.locator('#sub')).toHaveText("HOUSTON: We copy, you're down. Beautiful work."); expect(errors).toEqual([]); });
// carry-over (Task 4): the attract run behind the title has no radio, so a minute of the bot's play (the flag, kills, pickups)
// never puts a line or a subtitle up
test('the attract run behind the title stays silent: no radio, no subtitles (radio)', async ({ page }) => {
  const errors = watchErrors(page); await page.goto(URLS[1][1]); await ready(page); await page.evaluate(() => window.ospTest.ff(60));
  expect(await page.evaluate(() => [window.ospTest.state(), window.ospTest.radio(), document.getElementById('sub').textContent])).toEqual(['title', null, '']);
  expect(errors).toEqual([]); });
test('pausing mid-line takes the subtitle down, and the story line plays again from its start on resume (Review Focus 3)', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page); await page.click('#new'); await expect.poll(() => state(page)).toBe('opening');
  await ff(page, OPEN.descent + .5); await expect(page.locator('#sub')).toHaveText('YOU: Contact light. Engine stop.');
  await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(true); await expect(page.locator('#sub')).toHaveText('');
  expect(await page.evaluate(() => window.ospTest.radio())).toEqual({ line: null, queued: ['touchdown', 'touchdown'], dawdle: 0 });
  await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(false); await expect(page.locator('#sub')).toHaveText('YOU: Contact light. Engine stop.');
  await expect(page.locator('#sub')).toHaveClass(/\bon\b/); expect(errors).toEqual([]); });
// R16: the dawdle clock runs in play (here a few seconds with no progress), but not on hold or in Houston's call
test('the dawdle clock stops on hold and after Houston picks up (R16)', async ({ page }) => {
  const errors = watchErrors(page), dawdle = () => page.evaluate(() => window.ospTest.radio().dawdle); await start(page); await page.evaluate(() => window.ospTest.ff(3));
  expect(await dawdle()).toBeGreaterThan(2.5); await toComms(page); await onHold(page); await page.evaluate(() => { window.ospTest.god(true); window.ospTest.ff(60); });
  expect(await dawdle()).toBe(0); await page.evaluate(() => window.ospTest.ff(31)); await expect.poll(() => fight(page).then(f => f.ko)).toBe('call'); expect(await dawdle()).toBe(0);
  expect(errors).toEqual([]); });
// The whole game twice: the first on the URL's seed; the second after Back to title cleared it, so New Game rolls a Moon nobody
// chose. Each #new click locks the mouse, and #back takes the click only because finish() lets it go (pre-flight F1). Plan 6: Houston's
// call knocks you out into the prison; the hooks skip from the cell to the dash, and the end screen comes after boarding's lift-off.
test('two whole games in a row: title, opening, play, the final stand, Houston, the knock-out, the escape, the lift-off, the end screen, back to the title (show)', async ({ page }) => {
  test.setTimeout(T(240_000)); await noVoices(page); // pre-flight F5: two games with real-time endings outrun the default 30 s; F4: pin the unvoiced path
  const errors = watchErrors(page); await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page);
  for (let g = 0; g < 2; g++) { await page.click('#new'); await expect.poll(() => state(page)).toBe('opening'); await throughOpening(page);
    await toComms(page); await onHold(page); await page.evaluate(() => { window.ospTest.god(true); window.ospTest.ff(91); });
    await expect.poll(() => area(page), { timeout: T(40_000) }).toBe('prison'); await page.evaluate(s => window.ospTest.ff(s), KO.out + KO.down + KO.getUp + 1); await toLiftoff(page);
    await expect(page.locator('#end')).toBeVisible({ timeout: T(40_000) }); await expect(page.locator('#stats')).toContainText('GOLF BALLS');
    await page.click('#back'); await expect(page.locator('#title')).toBeVisible(); expect(await state(page)).toBe('title'); }
  expect(await page.evaluate(() => location.hash)).toBe(''); expect(errors).toEqual([]); });
// R18 moved: on hold to just before Houston (cueing the switchboard intro `holds` times), then through the call to the knock-out.
const throughCall = (page, holds = 0) => page.evaluate(([n, H]) => { const o = window.ospTest, sub = () => document.getElementById('sub').textContent, s = []; o.god(true);
  for (let i = 0; i < 3000 && o.clock().hold < H - .1; i++) o.ff(1 / 30);
  for (let i = 0; i < n; i++) o.cue('hold');
  for (let i = 0; i < 3000 && o.fight().ko !== 'out' && o.state() === 'play'; i++) { const r = o.radio(), a = o.audio(); s.push({ t: o.clock().ko, line: r.line, sub: sub(), downs: a.downs, plays: a.plays }); o.ff(1 / 30); }
  return { s, state: o.state(), sub: sub(), downs: o.audio().downs, plays: o.audio().plays, ko: o.fight().ko }; }, [holds, HOLD.time]);
test('R18 moved: the knock-out comes as the rescue line\'s talk ends, with no closing tone', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await toComms(page); await onHold(page); const r = await throughCall(page), last = r.s.at(-1);
  expect(r.s.some(x => x.sub.includes('one small problem'))).toBe(true); expect(last.line).toContain('twenty min'); expect(last.t).toBeLessThan(KO.call);
  expect(r.downs).toBe(r.s.find(x => x.line?.includes('twenty min')).downs); /* pre-flight F6: the sample at the rescue line itself */ expect([r.state, r.sub, r.ko]).toEqual(['play', '', 'out']);
  expect(r.plays - last.plays).toBe(1); /* pre-flight F13: the knock-out's frame plays the thud alone, not the level change's door */ expect(await area(page)).toBe('prison'); expect(errors).toEqual([]); });
test('R18 moved: at KO.call the knock-out comes whatever is on the air', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await toComms(page); await onHold(page); const r = await throughCall(page, 3), last = r.s.at(-1);
  expect(Math.abs(last.t - KO.call)).toBeLessThanOrEqual(2 / 30); expect(last.line).not.toBe(null); expect(r.s.some(x => x.sub.includes('twenty min'))).toBe(false);
  expect([r.state, r.sub, r.ko]).toEqual(['play', '', 'out']); expect(await area(page)).toBe('prison'); expect(errors).toEqual([]); });
// Pre-flight F11: pause right after the call and drive time with ff, resuming only for the frames a check needs, so a slow runner cannot drift past a phase.
const pausePress = async (page, on) => { await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(on); };
// R9 moved (replaces "the comms array ... then the end screen"): the run clock stops at Houston (the call outlasts 5 s) and stays
// stopped through the knock-out; the end screen's time is now boarding's (the lift-off tests below)
test('R9 moved: the knock-out: black, ANOTHER SMALL PROBLEM, the wake in the cell, THE CELLS; the clock froze through it', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await toComms(page); await onHold(page); await expect(page.locator('#prompt')).toContainText('ON HOLD');
  await throughCall(page); await pausePress(page, true); const f0 = await fight(page);
  await page.evaluate(s => window.ospTest.ff(s), KO.stamp + .1); await pausePress(page, false); await expect(page.locator('#stamp')).toHaveText(KO.text); await expect(page.locator('#stamp')).toBeVisible();
  await twoFrames(page); expect((await page.evaluate(() => window.ospTest.capture())).mean).toBeLessThan(5); // pre-flight F3: the dither lifts pure black (black .81, mean 2.2 of 37), so test the mean
  await pausePress(page, true); await page.evaluate(s => window.ospTest.ff(s), KO.out - KO.stamp + .1); expect((await fight(page)).ko).toBe('down');
  // to the step you stand (a fixed ff would overshoot by the frames the checks above ran live, and the run clock restarts as you stand)
  await page.evaluate(() => { const o = window.ospTest; for (let i = 0; i < 300 && o.fight().ko; i++) o.ff(1 / 30); }); const f = await fight(page); expect([f.ko, f.area]).toEqual([null, 'prison']);
  expect(f.run).toBe(f0.run); expect(f.time - f.run).toBeGreaterThan(KO.out + KO.down + KO.getUp + 5); await pausePress(page, false); await expect(page.locator('#flash')).toContainText('THE CELLS'); expect(errors).toEqual([]); });
test('pausing in the black or the wake freezes the knock-out (Review Focus 1)', async ({ page }) => {
  await noVoices(page); await start(page); await toComms(page); await onHold(page); await throughCall(page); await pausePress(page, true); // pre-flight F11: paused first, then ff lands each phase exactly
  for (const s of [KO.stamp, KO.out - KO.stamp + .5]) { await page.evaluate(x => window.ospTest.ff(x), s);
    const c = (await clock(page)).ko; expect(c).not.toBe(null); await page.waitForTimeout(600); expect((await clock(page)).ko).toBe(c); }
  expect((await fight(page)).area).toBe('prison'); await pausePress(page, false); });
// R23: the music stays ducked between the lines of a sequence: in the gaps of the switchboard's three-line intro (after its first or
// second line, the rest still waiting) the duck holds. Between lines with no story line waiting (nothing, or a reaction alone) it is
// off: the duck is set as a line goes off, and a story line can only leave the queue by keying up. One evaluate of 1/30 s steps,
// 40 s on hold, so no frame falls between samples.
test('the music stays ducked in the gaps between the switchboard intro\'s lines, and not for a reaction alone (R23)', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await toComms(page); await onHold(page);
  const s = await page.evaluate(() => { const o = window.ospTest, s = []; o.god(true);
    for (let i = 0; i < 30 * 40; i++) { o.ff(1 / 30); const r = o.radio(); s.push({ line: r.line, q: r.queued, duck: o.audio().duck }); } return s; });
  const story = k => !!(CUES[k].seq || CUES[k].crit), gaps = s.filter(x => !x.line && [1, 2].includes(x.q.filter(k => k === 'hold').length));
  expect(gaps.length).toBeGreaterThan(20); for (const g of gaps) expect(g.duck, JSON.stringify(g)).toBe(true); // two gaps of RADIO.gap s
  const free = s.filter(x => !x.line && !x.q.some(story)); expect(free.length).toBeGreaterThan(0); for (const g of free) expect(g.duck, JSON.stringify(g)).toBe(false);
  expect(errors).toEqual([]); });
// R20: a fatal error or a lost GPU context lets go of everything: the music stops (the AudioContext no longer running), the voice
// is cancelled and the mouse is released, under the message. Both start mid-opening, the New Game click's lock held and the music on.
for (const [how, text, act] of [['an error in the frame loop', 'Something went wrong', () => window.ospTest.fault()],
  ['a lost GPU context', 'Graphics context lost', () => document.getElementById('c').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()]])
  test(`${how} stops the sound and releases the mouse (R20)`, async ({ page }) => {
    await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page); await page.click('#new'); await expect.poll(() => state(page)).toBe('opening');
    await expect.poll(() => page.evaluate(() => document.pointerLockElement !== null), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => window.ospTest.audio().ctx), { timeout: 15_000 }).toBe('running');
    await page.evaluate(act); await expect(page.locator('#msg')).toContainText(text); await expect(page.locator('#msg')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.ospTest.audio().ctx)).not.toBe('running');
    await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBe(null); });
// R19, R24: the pause menu's checkboxes and sliders take the palette's dim #7a7266, not the browser's saturated accent; the play
// overlays under it (the prompt and the flashes) hide while it is up and come back on resume; no setting's label wraps.
test('the pause menu: palette-coloured controls, no prompt or flash showing through, every label on one line (R19, R24)', async ({ page }) => {
  const errors = watchErrors(page); await start(page);
  // The real area flash (shown a frame after the door) fades after 2 s, which a slow software-GL runner can outlast before the
  // checks below. So it is waited for with a frame-rate poll, and the moment it appears a held copy keeps #flash non-empty.
  await page.evaluate(() => { window.ospTest.grab(); window.ospTest.door(); });
  await page.waitForFunction(() => { const f = document.getElementById('flash'); if (!f.childNodes.length) return false;
    const held = document.createElement('div'); held.textContent = 'THE CRATER'; f.append(held); return true; }, null, { polling: 'raf' });
  await expect(page.locator('#prompt')).toHaveText('[E] enter the hangar'); await expect(page.locator('#flash')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#pause')).toBeVisible();
  await expect(page.locator('#prompt')).toBeHidden(); await expect(page.locator('#flash')).toBeHidden();
  const ui = await page.evaluate(() => ({ accent: [...document.querySelectorAll('#pause input')].map(e => getComputedStyle(e).accentColor),
    lines: [...document.querySelectorAll('#pause label')].map(l => { const r = document.createRange(); r.selectNodeContents(l.firstChild); return [l.firstChild.data, r.getClientRects().length]; }) }));
  expect(ui.accent).toEqual(Array(4).fill('rgb(122, 114, 102)')); for (const [label, n] of ui.lines) expect(n, label).toBe(1);
  await page.keyboard.press('Escape'); await expect(page.locator('#pause')).toBeHidden(); await expect(page.locator('#prompt')).toBeVisible(); expect(errors).toEqual([]); });
test('a hit reddens the edges of the frame and leaves its centre (Plan 5)', async ({ page }) => {
  const errors = watchErrors(page), frames = () => page.evaluate(() => window.ospTest.frames()), cap = () => page.evaluate(() => window.ospTest.capture());
  await start(page); await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(true);
  let f = await frames(); await expect.poll(frames).toBeGreaterThan(f + 1); const a = await cap();
  await page.evaluate(() => window.ospTest.hurt(15)); f = await frames(); await expect.poll(frames).toBeGreaterThan(f + 1); const b = await cap();
  expect(b.edge - a.edge).toBeGreaterThan(.02); expect(Math.abs(b.mid - a.mid)).toBeLessThan(.01); expect(errors).toEqual([]); });

test('the wayfinding arrow shows on the surface in whole metres, and hides while paused and in the base (Plan 5)', async ({ page }) => {
  const errors = watchErrors(page), way = page.locator('#way'); await start(page);
  await expect(way).toBeVisible(); await expect(page.locator('#wd')).toHaveText(/^\d+ m$/);
  await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(true); await expect(way).toBeHidden();
  await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(false); await expect(way).toBeVisible();
  await page.evaluate(() => window.ospTest.enter()); await expect.poll(() => page.evaluate(() => window.ospTest.area())).toBe('base'); await expect(way).toBeHidden();
  expect(errors).toEqual([]); });
test('the bars open: the prompt, a bang, the Switchboard, a guard, the bars drop (Plan 6)', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await page.evaluate(() => window.ospTest.prison()); await expect.poll(() => area(page)).toBe('prison');
  await page.evaluate(() => window.ospTest.bang(false)); await expect(page.locator('#prompt')).toHaveText('[E] bang on the bars'); await page.evaluate(() => window.ospTest.bang());
  await expect.poll(() => page.evaluate(() => window.ospTest.radio().line)).toContain('PRISONER. QUIET.'); await page.evaluate(s => window.ospTest.ff(s), BREAK.open + .2);
  const f = await fight(page); expect([f.cell.shut, f.cell.bang > BREAK.open]).toEqual([false, true]); expect(errors).toEqual([]); });

test('the lift to the climb: up outside the hangar door, the surface palette-true, the arrow showing (Plan 6)', async ({ page }) => {
  const errors = watchErrors(page); await start(page); await page.evaluate(() => window.ospTest.lift()); await expect.poll(() => area(page)).toBe('climb');
  await expect(page.locator('#way')).toBeVisible(); expect(await page.evaluate(() => window.ospTest.audio().air)).toBe(false);
  const s = await page.evaluate(() => window.ospTest.capture()); expect(s.inPalette).toBe(1); expect(s.colours).toBeGreaterThan(8); expect(errors).toEqual([]); });
const twoFrames = async page => { const f = await page.evaluate(() => window.ospTest.frames()); await expect.poll(() => page.evaluate(() => window.ospTest.frames())).toBeGreaterThan(f + 1); };
test('from the rim the ship lands out of sight, but its red flare climbs above the horizon (Plan 6, spec 6)', async ({ page }) => {
  const errors = watchErrors(page), cap = () => page.evaluate(() => window.ospTest.capture()); await start(page);
  await page.evaluate(() => { const o = window.ospTest; o.god(true); o.dash(); o.calm(); }); await expect.poll(() => area(page)).toBe('dash');
  const away = await page.evaluate(() => { const o = window.ospTest, s = o.ship().site, p = o.player(); o.turn(Math.atan2(p.x - s.x, p.z - s.z), .05); return Math.hypot(p.x - s.x, p.z - s.z); });
  expect(away).toBeGreaterThan(300); // pre-flight F1: at the rim, not the wreck (spec 11)
  await twoFrames(page); const a = await cap(); await page.evaluate(s => window.ospTest.ff(s), SHIP.descent + FLARE.rise + 1); await twoFrames(page); const b = await cap();
  expect(b.hot).toBeGreaterThan(a.hot); expect(b.inPalette).toBe(1); expect(errors).toEqual([]); });
test('the dash shows SHIP LEAVES m:ss under the arrow, red under SHIP.warn s (Plan 6)', async ({ page }) => {
  const errors = watchErrors(page), clk = page.locator('#clk'); await start(page); await page.evaluate(() => { const o = window.ospTest; o.god(true); o.dash(); o.calm(); });
  const m = Math.ceil(SHIP.clock / 60); await expect(clk).toHaveText(new RegExp('^SHIP LEAVES [' + (m - 1) + m + ']:\\d\\d$')); // pre-flight F8: read from SHIP.clock, so T12's retune can't break it
  await expect(clk).not.toHaveClass(/low/); await page.evaluate(s => window.ospTest.ff(s), SHIP.clock - SHIP.warn + 1);
  await expect(clk).toHaveClass(/low/); await expect(clk).toHaveText(/^SHIP LEAVES 0:\d\d$/); expect(errors).toEqual([]); });
const toLiftoff = async page => { await page.evaluate(() => { const o = window.ospTest; o.god(true); o.dash(); o.calm(); }); await expect.poll(() => area(page)).toBe('dash');
  // pre-flight F1: you start at the rim, far from the site, so touchdown does not trigger the rush and the sting keys at LIFT.sting + the board line only
  expect(await page.evaluate(() => { const o = window.ospTest, s = o.ship().site, p = o.player(); return Math.hypot(p.x - s.x, p.z - s.z); })).toBeGreaterThan(300);
  await page.evaluate(s => window.ospTest.ff(s), SHIP.descent + .5); await page.evaluate(() => window.ospTest.board()); await expect.poll(() => state(page)).toBe('liftoff'); };
// R18 moved: the end gate runs from the sting. 1/30 s steps through the lift-off, cueing the switchboard intro `holds` times at the sting.
const throughLift = (page, holds = 0) => page.evaluate(([n, sting]) => { const o = window.ospTest, sub = () => document.getElementById('sub').textContent, s = []; let cued = false;
  for (let i = 0; i < 3000 && o.state() === 'liftoff'; i++) { const c = o.clock().liftoff;
    if (c >= sting) { if (!cued) { cued = true; for (let k = 0; k < n; k++) o.cue('hold'); } const r = o.radio(); s.push({ t: c - sting, idle: !r.line && !r.queued.length, line: r.line, sub: sub() }); }
    o.ff(1 / 30); }
  return { s, T: s.at(-1).t + 1 / 30, state: o.state(), sub: sub() }; }, [holds, LIFT.sting]);
test('R9 moved: boarding, the lift-off, then the end screen with the time at boarding (Plan 6)', async ({ page }) => {
  test.slow(); await noVoices(page); const errors = watchErrors(page); await start(page); await toLiftoff(page); const f = await fight(page); expect(f.won).toBe(true);
  await expect(page.locator('#end')).toBeVisible({ timeout: T(30_000) }); await expect(page.locator('#stats')).toContainText('TIME ' + fmtTime(f.wonAt)); expect(errors).toEqual([]); });
test('R18 moved: the end screen comes ENDING.min s after the sting once the radio is idle, then the fade', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await toLiftoff(page); const r = await throughLift(page), idle = r.s.find(x => x.idle)?.t ?? r.T;
  expect(r.s.some(x => x.sub.includes('one more small problem'))).toBe(true); expect(r.T).toBeGreaterThanOrEqual(ENDING.min + LIFT.fade - 1e-6);
  expect(r.T).toBeLessThanOrEqual(Math.max(ENDING.min, idle) + LIFT.fade + 2 / 30 + 1e-6); expect([r.state, r.sub]).toEqual(['end', '']); expect(errors).toEqual([]); });
test('R18 moved: at ENDING.max after the sting the fade starts whatever is on the air', async ({ page }) => {
  await noVoices(page); const errors = watchErrors(page); await start(page); await toLiftoff(page); const r = await throughLift(page, 3), last = r.s.at(-1);
  expect(Math.abs(r.T - ENDING.max - LIFT.fade)).toBeLessThanOrEqual(2 / 30); expect(last.line).not.toBe(null); expect([r.state, r.sub]).toEqual(['end', '']); expect(errors).toEqual([]); });
// Review fix (Task 9): like the hold's and the knock-out's, the lift-off's clock and its fade stop while paused. The fade is entered and
// paused in one evaluate (a synthetic Esc), so no frame can finish it first.
test('pausing in the lift-off stops its clock and the fade to the end screen until you resume (pause, Plan 6)', async ({ page }) => {
  test.slow();
  await noVoices(page); const errors = watchErrors(page); await start(page); await toLiftoff(page); await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(true);
  const l = (await clock(page)).liftoff; await page.waitForTimeout(600); expect((await clock(page)).liftoff).toBe(l); await page.keyboard.press('Escape'); await expect.poll(() => paused(page)).toBe(false);
  const f = await page.evaluate(() => { const o = window.ospTest; for (let i = 0; i < 3000 && o.clock().fade === null && o.state() === 'liftoff'; i++) o.ff(1 / 30);
    o.ff(1 / 30); dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); return { fade: o.clock().fade, paused: o.paused(), state: o.state() }; });
  expect([f.paused, f.state]).toEqual([true, 'liftoff']); expect(f.fade).toBeGreaterThan(0); await page.waitForTimeout(600);
  expect((await clock(page)).fade).toBe(f.fade); await expect(page.locator('#end')).toBeHidden(); await page.keyboard.press('Escape');
  await expect(page.locator('#end')).toBeVisible({ timeout: T(10_000) }); expect(errors).toEqual([]); });
