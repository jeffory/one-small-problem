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
