import test from 'node:test'; import assert from 'node:assert/strict'; import { existsSync, readFileSync } from 'node:fs';
const SIM = ['weapons', 'bolts', 'nav', 'rigs', 'aliens', 'fight', 'models'].map(n => `src/game/${n}.js`).filter(f => existsSync(f));
test('simulation modules stay GPU-free, DOM-free and seeded', () => { assert.ok(SIM.length >= 2);
  for (const f of SIM) assert.doesNotMatch(readFileSync(f, 'utf8'), /\bdocument\.|\bwindow\.|Math\.random|performance\.now|Date\.now|\bgl\./, f); });
