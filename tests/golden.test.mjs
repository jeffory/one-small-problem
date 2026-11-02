import test from 'node:test'; import assert from 'node:assert/strict'; import { generateWorld } from '../src/gen/world.js'; import { checksumWorld } from '../src/gen/checksum.js';
// Re-pin these in any commit that changes a generation table or src/gen output (ruling R15).
const GOLDEN = { 'APOLLO-4471': 'ffbd27fe', 'EAGLE-0001': '240e6c50', 'SOAK-0042': '73b4a500' };
test('generation is pinned: golden checksums for three seeds', () => { for (const [s, c] of Object.entries(GOLDEN)) assert.equal(checksumWorld(generateWorld(s)), c, s); });
