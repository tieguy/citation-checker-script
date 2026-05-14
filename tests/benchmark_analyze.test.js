import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { LABELS_PATH } from '../benchmark/analyze_results.js';

test('LABELS_PATH (exported from analyze_results.js) ends with correct workspace path', () => {
    assert.ok(
        LABELS_PATH.endsWith('workbench/compound-corpus/labels.json') ||
        LABELS_PATH.endsWith('workbench\\compound-corpus\\labels.json'),
        `LABELS_PATH must end with workbench/compound-corpus/labels.json; got ${LABELS_PATH}`
    );
});

test('LABELS_PATH resolves to an existing file in the worktree layout', () => {
    // Worktree at .worktrees/fresh-prompt-rewrite/; labels.json at workspace root.
    // Path math: from benchmark/, walk up 4 dirs to reach alex-cite-checker/, then into workbench/.
    assert.ok(
        existsSync(LABELS_PATH),
        `LABELS_PATH must point at an existing file; got ${LABELS_PATH}`
    );
});
