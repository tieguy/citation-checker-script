import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResponse, normalizeVerdict } from '../benchmark/run_benchmark.js';

// normalizeVerdict — accept canonical inputs, reject anything else.

test('normalizeVerdict canonicalizes known labels regardless of case', () => {
    assert.equal(normalizeVerdict('SUPPORTED'), 'Supported');
    assert.equal(normalizeVerdict('supported'), 'Supported');
    assert.equal(normalizeVerdict('Not supported'), 'Not supported');
    assert.equal(normalizeVerdict('NOT_SUPPORTED'), 'Not supported');
    assert.equal(normalizeVerdict('partially supported'), 'Partially supported');
    assert.equal(normalizeVerdict('SOURCE UNAVAILABLE'), 'Source unavailable');
});

test('normalizeVerdict returns PARSE_ERROR for non-canonical strings', () => {
    // These are the prompt-text fragments observed leaking from truncated
    // DeepSeek-V3.2-Exp completions on 2026-05-07: the fallback regex was
    // picking up "verdict <something>" mid-reasoning and emitting the raw
    // capture as the verdict. The bug surface is normalizeVerdict letting
    // unrecognized strings pass through.
    assert.equal(normalizeVerdict('options'), 'PARSE_ERROR');
    assert.equal(normalizeVerdict('based on what the article body says'), 'PARSE_ERROR');
    assert.equal(normalizeVerdict(''), 'PARSE_ERROR');
});

// parseResponse — end-to-end: malformed input must not produce a
// non-canonical verdict, even if the regex fallback captures something.

test('parseResponse returns PARSE_ERROR when regex fallback captures a non-canonical phrase', () => {
    // Truncated reasoning that echoes the prompt's "Choose ONE verdict
    // based on what the article body says" phrasing, with no closing JSON.
    const truncated = 'Let me think. The verdict based on what the article body says is';
    const out = parseResponse(truncated);
    assert.equal(out.verdict, 'PARSE_ERROR');
});

test('parseResponse parses a clean JSON response', () => {
    const raw = JSON.stringify({ verdict: 'SUPPORTED', confidence: 0.9, comments: 'ok' });
    const out = parseResponse(raw);
    assert.equal(out.verdict, 'Supported');
});

test('parseResponse falls back successfully when raw text contains a recognizable verdict label', () => {
    const raw = 'verdict: SUPPORTED, the body says...';
    const out = parseResponse(raw);
    assert.equal(out.verdict, 'Supported');
});
