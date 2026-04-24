import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { extractClaimsForCitation } from '../benchmark/extract_dataset.js';

function mkDoc(html) {
    return new JSDOM(`<!DOCTYPE html><body>${html}</body>`).window.document;
}

test('extractClaimsForCitation: returns one entry per occurrence of [N]', () => {
    const doc = mkDoc(`
        <p>First sentence.<sup class="reference"><a href="#x">[5]</a></sup>
        Second sentence.<sup class="reference"><a href="#y">[5]</a></sup></p>
    `);
    const claims = extractClaimsForCitation(doc, 5);
    assert.equal(claims.length, 2);
    assert.equal(claims[0].occurrence, 1);
    assert.equal(claims[1].occurrence, 2);
});

test('extractClaimsForCitation: returns empty array when citation number is absent', () => {
    const doc = mkDoc(`
        <p>Only one cite.<sup class="reference"><a href="#x">[1]</a></sup></p>
    `);
    const claims = extractClaimsForCitation(doc, 99);
    assert.deepEqual(claims, []);
});

test('extractClaimsForCitation: strips Wikipedia maintenance markers from claim text', () => {
    // This is the test that proves PR #117's behavior is now applied to the
    // benchmark via the core/claim.js dedup. Without this, marker stripping
    // would only be exercised by chance on a real-world dataset extraction.
    const doc = mkDoc(`
        <p>Water freezes at 0 degrees Celsius [failed verification] at sea level.<sup class="reference"><a href="#x">[1]</a></sup></p>
    `);
    const claims = extractClaimsForCitation(doc, 1);
    assert.equal(claims.length, 1);
    assert.doesNotMatch(claims[0].text, /failed verification/i,
        'expected MAINTENANCE_MARKER_RE to strip [failed verification] from claim text');
    assert.match(claims[0].text, /Water freezes at 0/);
});

test('extractClaimsForCitation: does NOT match [10] when asked for [1]', () => {
    const doc = mkDoc(`
        <p>Ten.<sup class="reference"><a href="#x">[10]</a></sup></p>
    `);
    const claims = extractClaimsForCitation(doc, 1);
    assert.deepEqual(claims, []);
});
