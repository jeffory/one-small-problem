import { test, expect } from '@playwright/test'; import { pathToFileURL } from 'node:url'; import { resolve } from 'node:path';
export const URLS = [['file', pathToFileURL(resolve('dist/index.html')).href], ['http', 'http://localhost:4173/index.html']];
export function watchErrors(page) { const e = []; page.on('pageerror', x => e.push(String(x))); page.on('console', m => m.type() === 'error' && e.push(m.text())); return e; }
export const ready = page => page.waitForFunction(() => window.ospTest?.ready === true, null, { timeout: 30_000 });
for (const [name, url] of URLS) test(`boots from ${name}`, async ({ page }) => {
  const errors = watchErrors(page); await page.goto(url); await ready(page); expect(errors).toEqual([]);
});
