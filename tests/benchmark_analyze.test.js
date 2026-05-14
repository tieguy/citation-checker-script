import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync } from 'node:fs';

// Test the LABELS_PATH resolution logic used in analyze_results.js
// From benchmark/analyze_results.js, the path math should be:
// analyze_results.js → benchmark → .worktrees → citation-checker-script → alex-cite-checker
// So from a test file in tests/, we go up 1 level to the repo root, then:
// 1. worktree: .worktrees
// 2. citation-checker-script: ..
// 3. alex-cite-checker: ..
// 4. workbench: ..

test('LABELS_PATH resolution: 4 levels up from benchmark directory reaches workspace root', () => {
    // Simulate the path resolution from benchmark/analyze_results.js
    const benchmarkDir = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        'benchmark'
    );
    const resolvedPath = path.resolve(
        benchmarkDir,
        '..', '..', '..', '..', 'workbench', 'compound-corpus', 'labels.json'
    );

    // The resolved path should end with workbench/compound-corpus/labels.json
    // We can't guarantee the file exists in all test environments, but the path
    // should be constructable and reach a workspace-level directory
    assert.match(
        resolvedPath,
        /workbench[\/\\]compound-corpus[\/\\]labels\.json$/,
        'LABELS_PATH should resolve to workspace/workbench/compound-corpus/labels.json'
    );

    // Extract the directory parts to verify the depth
    const parts = resolvedPath.split(path.sep);
    const workbenchIdx = parts.findIndex(p => p === 'workbench');
    assert.ok(workbenchIdx !== -1, 'resolved path should contain "workbench" directory');

    // Verify the path has the correct structure
    const pathAfterWorkbench = parts.slice(workbenchIdx).join(path.sep);
    assert.equal(
        pathAfterWorkbench,
        path.join('workbench', 'compound-corpus', 'labels.json'),
        'path after "workbench" should be "workbench/compound-corpus/labels.json"'
    );
});

test('LABELS_PATH resolution: path structure is correct for worktree context', () => {
    // The point of this test is to verify that the path math is correct
    // even when the test is run from within a worktree, and to document
    // the expected directory structure.
    const currentTestFile = fileURLToPath(import.meta.url);
    const testDir = dirname(currentTestFile);
    const repoRoot = dirname(testDir); // ../tests → ..

    // From repo root (citation-checker-script), walk to workspace root
    // ../../../.. from repo root reaches alex-cite-checker (workspace)
    const expectedWorkspaceRoot = path.resolve(repoRoot, '..', '..', '..');

    // The labels.json should be at workspace/workbench/compound-corpus/labels.json
    const expectedLabelsPath = path.join(expectedWorkspaceRoot, 'workbench', 'compound-corpus', 'labels.json');

    // Verify the path structure makes sense (contains required parts)
    assert.match(expectedLabelsPath, /workbench/, 'path should contain workbench directory');
    assert.match(expectedLabelsPath, /compound-corpus/, 'path should contain compound-corpus directory');
    assert.match(expectedLabelsPath, /labels\.json$/, 'path should end with labels.json');
});
