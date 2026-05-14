import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyAtoms } from '../core/verify-atoms.js';

test('verifyAtoms() is exported and throws not-implemented (filled in Phase 3)', async () => {
  await assert.rejects(
    () => verifyAtoms([], '', null, {}),
    /not implemented/
  );
});
