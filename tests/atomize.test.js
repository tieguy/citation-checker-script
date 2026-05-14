import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atomize } from '../core/atomize.js';

test('atomize() is exported and throws not-implemented (filled in Phase 3)', async () => {
  await assert.rejects(
    () => atomize('a claim', {}),
    /not implemented/
  );
});
