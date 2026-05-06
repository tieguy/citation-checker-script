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

import { computeProviderStats } from '../benchmark/compare_results.js';

test('computeProviderStats aggregates exact + lenient + binary accuracy and flip counts', () => {
    const cells = [
        // 2 unchanged-correct, 1 improvement, 1 regression, 1 lateral, plus
        // a 6th cell exercising lenient: control Supported, treatment Partially supported, GT Supported.
        // Exact: control correct, treatment wrong (Partial != Support exactly).
        // Lenient: both correct (Partial↔Support is lenient).
        // Binary: both correct.
        // Direction: regression (control correct exact, treatment wrong exact).
        { direction: 'unchanged-correct', controlVerdict: 'Supported', treatmentVerdict: 'Supported', groundTruth: 'Supported' },
        { direction: 'unchanged-correct', controlVerdict: 'Not supported', treatmentVerdict: 'Not supported', groundTruth: 'Not supported' },
        { direction: 'improvement', controlVerdict: 'Not supported', treatmentVerdict: 'Supported', groundTruth: 'Supported' },
        { direction: 'regression', controlVerdict: 'Supported', treatmentVerdict: 'Not supported', groundTruth: 'Supported' },
        { direction: 'lateral', controlVerdict: 'Not supported', treatmentVerdict: 'Source unavailable', groundTruth: 'Supported' },
        { direction: 'regression', controlVerdict: 'Supported', treatmentVerdict: 'Partially supported', groundTruth: 'Supported' },
    ];
    const stats = computeProviderStats(cells);
    assert.equal(stats.n, 6);
    // Exact: control rows 1, 2, 4, 6 = 4; treatment rows 1, 2, 3 = 3.
    assert.equal(stats.exact.control, 4);
    assert.equal(stats.exact.treatment, 3);
    // Lenient: control rows 1, 2, 4, 6 = 4; treatment rows 1, 2, 3, 6 = 4 (row 6 is Partial vs Support GT, lenient counts it).
    assert.equal(stats.lenient.control, 4);
    assert.equal(stats.lenient.treatment, 4);
    assert.equal(stats.lenient.delta, 0);
    // Binary: row 1, 2, 4, 6 control correct (4); treatment 1, 2, 3, 6 correct (4).
    assert.equal(stats.binary.control, 4);
    assert.equal(stats.binary.treatment, 4);
    // Flip counts.
    assert.equal(stats.flips.improvement, 1);
    assert.equal(stats.flips.regression, 2);
    assert.equal(stats.flips.lateral, 1);
    assert.equal(stats.flips['unchanged-correct'], 2);
    assert.equal(stats.flips['unchanged-wrong-same'], 0);
});
