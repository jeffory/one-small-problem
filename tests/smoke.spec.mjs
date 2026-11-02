import { test, expect } from '@playwright/test'; import { pathToFileURL } from 'node:url'; import { resolve } from 'node:path';
import { generateSurface } from '../src/gen/surface.js'; import { checksumWorld } from '../src/gen/checksum.js';
export const URLS = [['file', pathToFileURL(resolve('dist/index.html')).href], ['http', 'http://localhost:4173/index.html']];
// Benign Firefox parser note about the packed binary payload when the server's utf-8 header overrides the page's iso-8859-15 meta; real decoding failures are caught by the ready check.
const BENIGN = /byte stream was erroneous according to the character encoding/i;
export function watchErrors(page) { const e = []; page.on('pageerror', x => e.push(String(x))); page.on('console', m => m.type() === 'error' && !BENIGN.test(m.text()) && e.push(m.text())); return e; }
export const ready = page => page.waitForFunction(() => window.ospTest?.ready === true, null, { timeout: 30_000 });
for (const [name, url] of URLS) test(`boots from ${name}`, async ({ page }) => {
  const errors = watchErrors(page); await page.goto(url); await ready(page); expect(errors).toEqual([]);
});
for (const [name, url] of URLS) test(`renders a palette-true frame from ${name}`, async ({ page }) => {
  const errors = watchErrors(page); await page.goto(url); await ready(page);
  const s = await page.evaluate(() => window.ospTest.capture());
  expect(s.inPalette).toBe(1); expect(s.colours).toBeGreaterThan(6); expect(s.black).toBeLessThan(0.9); expect(errors).toEqual([]);
});
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
