import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeVerdict,
    verdictsEqualExact,
    verdictsEqualBinary,
    verdictsEqualLenient,
} from '../benchmark/compare_results.js';

test('normalizeVerdict canonicalizes the four verdict classes', () => {
    assert.equal(normalizeVerdict('Supported'), 'support');
    assert.equal(normalizeVerdict('Partially supported'), 'partial');
    assert.equal(normalizeVerdict('Not supported'), 'not');
    assert.equal(normalizeVerdict('Source unavailable'), 'unavailable');
    assert.equal(normalizeVerdict(' SUPPORTED '), 'support');
    assert.equal(normalizeVerdict(null), '');
    assert.equal(normalizeVerdict(undefined), '');
    assert.equal(normalizeVerdict('something else'), 'something else');
});

test('verdictsEqualExact treats normalized verdicts as equivalent', () => {
    assert.equal(verdictsEqualExact('Supported', 'supported'), true);
    assert.equal(verdictsEqualExact('Supported', 'Partially supported'), false);
    assert.equal(verdictsEqualExact('Not supported', 'NOT_SUPPORTED'), true);
});

test('verdictsEqualBinary treats Supported and Partially supported as the same class', () => {
    assert.equal(verdictsEqualBinary('Supported', 'Partially supported'), true);
    assert.equal(verdictsEqualBinary('Supported', 'Not supported'), false);
    assert.equal(verdictsEqualBinary('Source unavailable', 'Not supported'), true);
    assert.equal(verdictsEqualBinary('Partially supported', 'Source unavailable'), false);
});

test('verdictsEqualLenient: Supported↔Partially supported is a near-miss; everything else like exact', () => {
    // Exact matches are also lenient.
    assert.equal(verdictsEqualLenient('Supported', 'Supported'), true);
    assert.equal(verdictsEqualLenient('Not supported', 'Not supported'), true);
    // Supported ↔ Partially supported is mutually lenient.
    assert.equal(verdictsEqualLenient('Supported', 'Partially supported'), true);
    assert.equal(verdictsEqualLenient('Partially supported', 'Supported'), true);
    // No other pair is lenient.
    assert.equal(verdictsEqualLenient('Supported', 'Not supported'), false);
    assert.equal(verdictsEqualLenient('Partially supported', 'Not supported'), false);
    assert.equal(verdictsEqualLenient('Source unavailable', 'Not supported'), false);
});

import { indexCellsByPair } from '../benchmark/compare_results.js';

test('indexCellsByPair builds entry_id:provider Map from rows', () => {
    const rows = [
        { entry_id: 'row_1', provider: 'claude', predicted_verdict: 'Supported', error: null },
        { entry_id: 'row_1', provider: 'gemini', predicted_verdict: 'Not supported', error: null },
        { entry_id: 'row_2', provider: 'claude', predicted_verdict: 'Partially supported', error: null },
    ];
    const idx = indexCellsByPair(rows);
    assert.equal(idx.size, 3);
    assert.equal(idx.get('row_1:claude').predicted_verdict, 'Supported');
    assert.equal(idx.get('row_2:claude').predicted_verdict, 'Partially supported');
});

test('indexCellsByPair drops rows with error or predicted_verdict ERROR', () => {
    const rows = [
        { entry_id: 'row_1', provider: 'claude', predicted_verdict: 'Supported', error: null },
        { entry_id: 'row_1', provider: 'gemini', predicted_verdict: 'ERROR', error: 'rate limit' },
        { entry_id: 'row_2', provider: 'claude', predicted_verdict: 'ERROR', error: null },
        { entry_id: 'row_2', provider: 'gemini', predicted_verdict: 'Supported', error: 'timeout' },
    ];
    const idx = indexCellsByPair(rows);
    assert.equal(idx.size, 1);
    assert.equal(idx.has('row_1:claude'), true);
    assert.equal(idx.has('row_1:gemini'), false);
    assert.equal(idx.has('row_2:claude'), false);
    assert.equal(idx.has('row_2:gemini'), false);
});

import { classifyDirection } from '../benchmark/compare_results.js';

test('classifyDirection: improvement when control wrong, treatment correct', () => {
    assert.equal(
        classifyDirection({
            controlVerdict: 'Not supported',
            treatmentVerdict: 'Supported',
            groundTruth: 'Supported',
        }),
        'improvement',
    );
});

test('classifyDirection: regression when control correct, treatment wrong', () => {
    assert.equal(
        classifyDirection({
            controlVerdict: 'Supported',
            treatmentVerdict: 'Not supported',
            groundTruth: 'Supported',
        }),
        'regression',
    );
});

test('classifyDirection: unchanged-correct when both match GT', () => {
    assert.equal(
        classifyDirection({
            controlVerdict: 'Supported',
            treatmentVerdict: 'Supported',
            groundTruth: 'Supported',
        }),
        'unchanged-correct',
    );
});

test('classifyDirection: unchanged-wrong-same when both wrong with same verdict', () => {
    assert.equal(
        classifyDirection({
            controlVerdict: 'Not supported',
            treatmentVerdict: 'Not supported',
            groundTruth: 'Supported',
        }),
        'unchanged-wrong-same',
    );
});

test('classifyDirection: lateral when both wrong but with different verdicts', () => {
    assert.equal(
        classifyDirection({
            controlVerdict: 'Not supported',
            treatmentVerdict: 'Source unavailable',
            groundTruth: 'Supported',
        }),
        'lateral',
    );
});
