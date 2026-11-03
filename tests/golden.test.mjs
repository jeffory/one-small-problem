import test from 'node:test'; import assert from 'node:assert/strict'; import { generateWorld } from '../src/gen/world.js'; import { checksumWorld } from '../src/gen/checksum.js';
// Re-pinned in Plan 6 Task 6, which appended the prison and the escape plan; re-pin in any later commit that changes generation (R15).
const GOLDEN = { 'APOLLO-4471': '056f5ff0', 'EAGLE-0001': '02f376fb', 'SOAK-0042': 'd5ee2960' };
const LEVEL_ONE = { 'APOLLO-4471': '60273c6a', 'EAGLE-0001': '39762eb2', 'SOAK-0042': 'ee4eda57' }; // before Plan 6 (H4)
test('generation is pinned: golden checksums for three seeds', () => { for (const [s, c] of Object.entries(GOLDEN)) assert.equal(checksumWorld(generateWorld(s)), c, s); });
test('the level 1 parts hash as before Plan 6 (Plan 6)', () => { for (const [s, c] of Object.entries(LEVEL_ONE)) assert.equal(checksumWorld(generateWorld(s), true), c, s); });
