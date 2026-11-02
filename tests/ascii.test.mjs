import test from 'node:test'; import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs'; import { join } from 'node:path';
function* walk(p) {
  if (statSync(p).isDirectory()) { for (const f of readdirSync(p)) yield* walk(join(p, f)); } else yield p;
}
test('src, tools and build.mjs are 7-bit ASCII', () => {
  for (const root of ['src', 'tools', 'build.mjs']) for (const file of walk(root)) {
    const buf = readFileSync(file);
    for (let i = 0; i < buf.length; i++) assert.ok(buf[i] < 0x80, `${file}: non-ASCII byte at offset ${i}`);
  }
});
