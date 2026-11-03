import test from 'node:test'; import assert from 'node:assert/strict'; import { fmtTime, shareLink, recordBest } from '../src/ui/score.js';
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
test('times read m:ss', () => { assert.deepEqual([0, 9.99, 61.9, 754, 3600].map(fmtTime), ['0:00', '0:09', '1:01', '12:34', '60:00']); });
test('the share link is the page address without its hash plus #SEED; from file:// there is none', () => {
  assert.equal(shareLink('https://x.io/g/index.html?a=1#OLD', 'APOLLO-4471'), 'https://x.io/g/index.html?a=1#APOLLO-4471');
  assert.equal(shareLink('http://localhost:4173/index.html', 'EAGLE-0001'), 'http://localhost:4173/index.html#EAGLE-0001');
  assert.equal(shareLink('file:///home/k/index.html#APOLLO-4471', 'APOLLO-4471'), null); });
test('the best time per seed is kept under osp.best2.SEED, and only a lower time replaces it', () => { const s = mem();
  assert.deepEqual(recordBest(s, 'A-1', 100), { best: 100, isNew: true }); assert.deepEqual(recordBest(s, 'A-1', 120), { best: 100, isNew: false });
  assert.deepEqual(recordBest(s, 'A-1', 90), { best: 90, isNew: true }); assert.deepEqual(recordBest(s, 'B-2', 300), { best: 300, isNew: true }); assert.equal(s.m.get('osp.best2.A-1'), '90');
  s.setItem('osp.best.C-3', '10'); assert.deepEqual(recordBest(s, 'C-3', 600), { best: 600, isNew: true }, 'a one-level best (Plans 1-5) never beats a two-level run'); });
test('a garbage value, a store that throws or no store at all never throws (Review Focus 4)', () => { const s = mem(); s.setItem('osp.best2.A-1', 'abc');
  assert.deepEqual(recordBest(s, 'A-1', 50), { best: 50, isNew: true }); const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('y'); } };
  assert.deepEqual(recordBest(bad, 'A-1', 50), { best: null, isNew: false }); assert.deepEqual(recordBest(null, 'A-1', 50), { best: null, isNew: false }); });
