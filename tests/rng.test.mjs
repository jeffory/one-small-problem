import test from 'node:test'; import assert from 'node:assert/strict';
import { makeRng, normalizeSeed, seedName, SEED_WORDS } from '../src/gen/rng.js';
test('makeRng is deterministic per seed', () => { const a = makeRng('APOLLO-4471'), b = makeRng('APOLLO-4471'); for (let i = 0; i < 5; i++) assert.equal(a.next(), b.next()); });
test('different seeds diverge', () => { assert.notEqual(makeRng('APOLLO-4471').next(), makeRng('APOLLO-4472').next()); });
test('next/int/range stay in bounds', () => { const r = makeRng('X'); for (let i = 0; i < 10000; i++) { const v = r.next(); assert.ok(v >= 0 && v < 1); const k = r.int(7); assert.ok(Number.isInteger(k) && k >= 0 && k < 7); const g = r.range(-3, 5); assert.ok(g >= -3 && g < 5); } });
test('normalizeSeed tidies and never throws (Review Focus 1)', () => {
  assert.equal(normalizeSeed('#apollo-4471'), 'APOLLO-4471');
  assert.equal(normalizeSeed('#Eagle%20Has%20Landed!!'), 'EAGLEHASLANDED');
  assert.equal(normalizeSeed('#%E0%A4%A'), 'E0A4A');
  assert.equal(normalizeSeed('#' + 'a'.repeat(40)), 'A'.repeat(24));
  assert.equal(normalizeSeed('#\u{1F680}\u{1F680}'), null);
  for (const v of ['#', '', null, undefined]) assert.equal(normalizeSeed(v), null);
});
test('seedName gives WORD-NNNN from the 32-word list', () => { assert.equal(SEED_WORDS.length, 32); const r = makeRng('names'); for (let i = 0; i < 200; i++) { const [w, n] = seedName(r).split('-'); assert.ok(SEED_WORDS.includes(w)); assert.match(n, /^\d{4}$/); } });
