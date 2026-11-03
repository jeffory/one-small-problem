import test from 'node:test'; import assert from 'node:assert/strict'; import { existsSync, readFileSync, readdirSync } from 'node:fs';
const SIM = [...['weapons', 'bolts', 'nav', 'rigs', 'aliens', 'fight', 'models', 'areas', 'baseMesh', 'bot', 'hold', 'lander', 'opening', 'script', 'radio', 'escape', 'liftoff'].map(n => `src/game/${n}.js`), 'src/ui/score.js', 'src/ui/settings.js'].filter(f => existsSync(f));
test('simulation modules stay GPU-free, DOM-free and seeded', () => { assert.ok(SIM.length >= 2);
  for (const f of SIM) assert.doesNotMatch(readFileSync(f, 'utf8'), /\bdocument\.|\bwindow\.|Math\.random|performance\.now|Date\.now|\bgl\./, f); });
test('src/gen has no import cycles', () => {
  const deps = {}; for (const f of readdirSync('src/gen')) deps[f] = [...readFileSync(`src/gen/${f}`, 'utf8').matchAll(/from '\.\/(\w+\.js)'/g)].map(m => m[1]);
  const st = {}, visit = f => { assert.notEqual(st[f], 1, `import cycle through ${f}`); if (st[f]) return; st[f] = 1; deps[f].forEach(visit); st[f] = 2; };
  Object.keys(deps).forEach(visit); assert.ok(deps['world.js'].includes('encounters.js')); assert.ok(!deps['surface.js'].includes('encounters.js')); });
