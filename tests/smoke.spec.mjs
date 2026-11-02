import { test, expect } from '@playwright/test'; import { pathToFileURL } from 'node:url'; import { resolve } from 'node:path';
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
