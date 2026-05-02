import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeMustPassFailures } from '../benchmark/analyze_results.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ANALYZER = path.join(REPO_ROOT, 'benchmark', 'analyze_results.js');

// computeMustPassFailures: rows with extraction_status === 'source_fetch_failed'
// must resolve to "Source unavailable". Anything else is a must-pass failure.

test('computeMustPassFailures: zero failures when all source_fetch_failed rows are Source unavailable', () => {
    const results = [
        { extraction_status: 'source_fetch_failed', predicted_verdict: 'Source unavailable' },
        { extraction_status: 'source_fetch_failed', predicted_verdict: 'SOURCE UNAVAILABLE' }, // case-insensitive
        { extraction_status: 'complete', predicted_verdict: 'Supported' },
    ];
    assert.equal(computeMustPassFailures(results), 0);
});

test('computeMustPassFailures: counts each source_fetch_failed row that resolved to anything else', () => {
    const results = [
        { extraction_status: 'source_fetch_failed', predicted_verdict: 'Supported' },     // failure
        { extraction_status: 'source_fetch_failed', predicted_verdict: 'Not supported' }, // failure
        { extraction_status: 'source_fetch_failed', predicted_verdict: 'Source unavailable' },
        { extraction_status: 'complete', predicted_verdict: 'Not supported' },            // not gated
    ];
    assert.equal(computeMustPassFailures(results), 2);
});

test('computeMustPassFailures: ignores rows without extraction_status set', () => {
    // Defensive: a row missing extraction_status entirely shouldn't count as
    // a must-pass failure. Only rows that are explicitly tagged
    // source_fetch_failed are gated by the contract.
    const results = [
        { predicted_verdict: 'Supported' },
        { extraction_status: undefined, predicted_verdict: 'Not supported' },
    ];
    assert.equal(computeMustPassFailures(results), 0);
});

// End-to-end: invoke the analyzer as a subprocess and check the --strict
// exit code + analysis.json shape.

function withTempResults(results, fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-test-'));
    const resultsPath = path.join(dir, 'results.json');
    const analysisPath = path.join(dir, 'analysis.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results));
    try {
        return fn(resultsPath, analysisPath, dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

const SAMPLE_RESULT = (overrides = {}) => ({
    entry_id: 'row_1',
    provider: 'claude-sonnet-4-5',
    model: 'claude-sonnet-4-5-20250929',
    ground_truth: 'Supported',
    extraction_status: 'complete',
    runner_deterministic: false,
    predicted_verdict: 'Supported',
    confidence: 90,
    comments: '',
    latency_ms: 100,
    error: null,
    correct: 'exact',
    timestamp: '2026-05-01T00:00:00Z',
    ...overrides,
});

test('analyzer: writes mustPassFailures: 0 when no must-pass rows exist', () => {
    withTempResults(
        [SAMPLE_RESULT()],
        (results, analysis) => {
            execFileSync('node', [ANALYZER, '--results', results, '--analysis', analysis], {
                cwd: REPO_ROOT,
                stdio: 'pipe',
            });
            const out = JSON.parse(fs.readFileSync(analysis, 'utf-8'));
            assert.equal(out.providers['claude-sonnet-4-5'].mustPassFailures, 0);
        }
    );
});

test('analyzer: --strict exits 1 when a must-pass row is wrong', () => {
    withTempResults(
        [
            SAMPLE_RESULT({ entry_id: 'row_1' }),
            SAMPLE_RESULT({
                entry_id: 'row_2',
                extraction_status: 'source_fetch_failed',
                predicted_verdict: 'Supported', // wrong — should be Source unavailable
            }),
        ],
        (results, analysis) => {
            assert.throws(() => {
                execFileSync('node', [ANALYZER, '--strict', '--results', results, '--analysis', analysis], {
                    cwd: REPO_ROOT,
                    stdio: 'pipe',
                });
            }, /Command failed/);
        }
    );
});

test('analyzer: non-strict exits 0 even when must-pass fails (warning only)', () => {
    withTempResults(
        [
            SAMPLE_RESULT({
                entry_id: 'row_1',
                extraction_status: 'source_fetch_failed',
                predicted_verdict: 'Not supported', // wrong — should be Source unavailable
            }),
        ],
        (results, analysis) => {
            // execFileSync throws on non-zero exit; reaching the next line
            // proves the analyzer exited 0 despite the must-pass failure.
            execFileSync('node', [ANALYZER, '--results', results, '--analysis', analysis], {
                cwd: REPO_ROOT,
                stdio: 'pipe',
            });
            const out = JSON.parse(fs.readFileSync(analysis, 'utf-8'));
            assert.equal(out.providers['claude-sonnet-4-5'].mustPassFailures, 1);
        }
    );
});
