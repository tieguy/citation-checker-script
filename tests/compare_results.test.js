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
