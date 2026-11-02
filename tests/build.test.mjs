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
