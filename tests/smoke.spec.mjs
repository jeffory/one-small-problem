import { test, expect } from '@playwright/test'; import { pathToFileURL } from 'node:url'; import { resolve } from 'node:path';
import { generateWorld } from '../src/gen/world.js'; import { checksumWorld } from '../src/gen/checksum.js';
import { HELP_TIME } from '../src/ui/hud.js';
export const URLS = [['file', pathToFileURL(resolve('dist/index.html')).href], ['http', 'http://localhost:4173/index.html']];
// Benign Firefox parser note about the packed binary payload when the server's utf-8 header overrides the page's iso-8859-15 meta; real decoding failures are caught by the ready check.
const BENIGN = /byte stream was erroneous according to the character encoding/i;
export function watchErrors(page) { const e = []; page.on('pageerror', x => e.push(String(x))); page.on('console', m => m.type() === 'error' && !BENIGN.test(m.text()) && e.push(m.text())); return e; }
export const ready = page => page.waitForFunction(() => window.ospTest?.ready === true, null, { timeout: 30_000 });
export const start = async (page, url = URLS[1][1] + '#APOLLO-4471') => { await page.goto(url); await ready(page); await page.evaluate(() => window.ospTest.play()); };
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
  const hits = await page.evaluate(() => ['hud', 'seed', 'stat', 'prompt', 'flash', 'x'].map(id => { const r = document.getElementById(id).getBoundingClientRect();
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
  const s = page.locator('#stats'); await expect(s).toContainText(/TIME \d+:\d\d/); await expect(s).toContainText('KILLS 0'); await expect(s).toContainText('GOLF BALLS 0/5');
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
// pre-flight F1: headless Chromium and Firefox both grant the lock on the #new click, and while locked a click on #back lands on the canvas
test('the end screen releases the pointer lock, so Back to title works after a New Game click (flow)', async ({ page }) => {
  await page.goto(URLS[1][1] + '#APOLLO-4471'); await ready(page); await page.click('#new'); await expect.poll(() => state(page)).not.toBe('title');
  await page.evaluate(() => window.ospTest.finish()); await expect(page.locator('#end')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true); await page.click('#back');
  await expect(page.locator('#title')).toBeVisible(); expect(await state(page)).toBe('title'); });
// R2: the help line shows as each run starts and hides after HELP_TIME s of the run's play time; a death restart doesn't bring it back
test('the help line shows at the start of a run, hides after HELP_TIME s of play, stays hidden through a death, and returns with the next run (R2)', async ({ page }) => {
  const errors = watchErrors(page); await start(page); const help = page.locator('#hud > div').first(); await expect(help).toContainText('Esc pause');
  await page.evaluate(t => window.ospTest.ff(t), HELP_TIME - 2); await expect(help).toContainText('Esc pause');
  await page.evaluate(() => window.ospTest.ff(2.5)); await expect(help).toHaveText('');
  await page.evaluate(() => { window.ospTest.hurt(999); window.ospTest.ff(4); }); expect((await fight(page)).state).toBe('play'); await expect(help).toHaveText('');
  await page.evaluate(() => { window.ospTest.finish(); window.ospTest.play(); }); await expect(help).toContainText('Esc pause'); expect(errors).toEqual([]); });
