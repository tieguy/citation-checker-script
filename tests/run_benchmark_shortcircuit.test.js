import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    shouldRunnerShortCircuit,
    buildDeterministicResultRow,
    buildLlmResultRow,
} from '../benchmark/run_benchmark.js';

// shouldRunnerShortCircuit decides how the runner handles each dataset entry.
// Three modes: 'skip' (excluded), 'deterministic' (synthetic verdict, no LLM),
// 'llm' (sent to providers normally).

test('shouldRunnerShortCircuit: needs_manual_review wins over everything', () => {
    const entry = {
        needs_manual_review: true,
        extraction_status: 'source_fetch_failed',
    };
    assert.deepEqual(shouldRunnerShortCircuit(entry), { mode: 'skip' });
});

test('shouldRunnerShortCircuit: source_fetch_failed → deterministic', () => {
    const entry = {
        needs_manual_review: false,
        extraction_status: 'source_fetch_failed',
    };
    const decision = shouldRunnerShortCircuit(entry);
    assert.equal(decision.mode, 'deterministic');
    assert.match(decision.reason, /source fetch failed/);
});

test('shouldRunnerShortCircuit: complete extraction → llm', () => {
    const entry = {
        needs_manual_review: false,
        extraction_status: 'complete',
    };
    assert.deepEqual(shouldRunnerShortCircuit(entry), { mode: 'llm' });
});

test('shouldRunnerShortCircuit: missing extraction_status falls through to llm', () => {
    // Defensive: if a row lacks extraction_status, route to LLM rather than
    // short-circuit. The runner should never refuse to evaluate an entry
    // unless it has explicit evidence (manual review or extraction failure).
    const entry = { needs_manual_review: false };
    assert.deepEqual(shouldRunnerShortCircuit(entry), { mode: 'llm' });
});

test('shouldRunnerShortCircuit: unrecognized extraction_status → llm', () => {
    const entry = {
        needs_manual_review: false,
        extraction_status: 'something-new',
    };
    assert.deepEqual(shouldRunnerShortCircuit(entry), { mode: 'llm' });
});

// Result-row factories: produce the rows that get written to results.json.
// Two flavors — deterministic (no LLM call) and LLM (real provider response) —
// share a contract: every row has entry_id, provider, ground_truth,
// extraction_status, runner_deterministic, predicted_verdict, and correct.

test('buildDeterministicResultRow: emits SOURCE UNAVAILABLE without an LLM call', () => {
    const entry = {
        id: 'row_42',
        ground_truth: 'Supported',
        extraction_status: 'source_fetch_failed',
    };
    const decision = {
        mode: 'deterministic',
        reason: 'deterministic: source fetch failed at extraction time',
    };
    const row = buildDeterministicResultRow({ entry, provider: 'claude-sonnet-4-5', decision });
    assert.equal(row.entry_id, 'row_42');
    assert.equal(row.provider, 'claude-sonnet-4-5');
    assert.equal(row.model, null);
    assert.equal(row.predicted_verdict, 'SOURCE UNAVAILABLE');
    assert.equal(row.runner_deterministic, true);
    assert.equal(row.extraction_status, 'source_fetch_failed');
    assert.equal(row.ground_truth, 'Supported');
    assert.equal(row.latency_ms, 0);
    assert.equal(row.error, null);
    assert.match(row.comments, /source fetch failed/);
});

test('buildLlmResultRow: carries the provider response forward', () => {
    const entry = {
        id: 'row_7',
        ground_truth: 'Supported',
        extraction_status: 'complete',
    };
    const providerResult = {
        verdict: 'SUPPORTED',
        confidence: 92,
        comments: 'Source mentions the founding year directly.',
        latency: 1340,
        error: null,
    };
    const row = buildLlmResultRow({
        entry,
        provider: 'claude-sonnet-4-5',
        model: 'claude-sonnet-4-5-20250929',
        providerResult,
    });
    assert.equal(row.entry_id, 'row_7');
    assert.equal(row.provider, 'claude-sonnet-4-5');
    assert.equal(row.model, 'claude-sonnet-4-5-20250929');
    assert.equal(row.predicted_verdict, 'SUPPORTED');
    assert.equal(row.runner_deterministic, false);
    assert.equal(row.extraction_status, 'complete');
    assert.equal(row.confidence, 92);
    assert.equal(row.latency_ms, 1340);
});

test('result rows from both factories share the same key set', () => {
    const entry = { id: 'row_1', ground_truth: 'Supported', extraction_status: 'complete' };
    const det = buildDeterministicResultRow({
        entry,
        provider: 'claude-sonnet-4-5',
        decision: { mode: 'deterministic', reason: 'test' },
    });
    const llm = buildLlmResultRow({
        entry,
        provider: 'claude-sonnet-4-5',
        model: 'm',
        providerResult: { verdict: 'SUPPORTED', confidence: 90, comments: 'c', latency: 100, error: null },
    });
    assert.deepEqual(Object.keys(det).sort(), Object.keys(llm).sort());
});
