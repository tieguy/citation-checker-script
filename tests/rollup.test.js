import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollup } from '../core/rollup.js';

test('rollup() is exported and throws not-implemented (filled in Phase 4)', async () => {
  await assert.rejects(
    () => rollup([], [], 'deterministic'),
    /not implemented/
  );
});
