import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvRowToWikitext, escapeParamValue, csvRowsToWikitext } from '../benchmark/csv_to_suite.js';
import { parseSuite } from '../benchmark/suite.js';

const csvRow = (over = {}) => ({
    'Citation number': '1',
    'Citation instance': '1',
    'Article': 'https://en.wikipedia.org/w/index.php?title=Immigration_to_the_United_States&oldid=1331476438',
    'Ground truth': 'Supported',
    'Dataset version': 'v1',
    'WMF claim text': '',
    'WMF source URL': '',
    'WMF provenance': '',
    ...over,
});

test('escapeParamValue encodes a pipe as the only escape that survives parsing', () => {
    assert.equal(escapeParamValue('a | b'), 'a &#124; b');
});

test('escapeParamValue strips braces, which delete the row outright', () => {
    assert.equal(escapeParamValue('a {b} c'), 'a b c');
    assert.equal(escapeParamValue('see {note'), 'see note');
});

test('escapeParamValue collapses newlines, which break the param format', () => {
    assert.equal(escapeParamValue('line one\nline two'), 'line one line two');
});

test('escapeParamValue leaves equals signs and URLs alone', () => {
    assert.equal(escapeParamValue('https://e.com/p?a=1&b=2#frag'), 'https://e.com/p?a=1&b=2#frag');
});

test('csvRowToWikitext round-trips through the parser to equivalent values', () => {
    const wikitext = csvRowToWikitext(csvRow());
    const { rows } = parseSuite(wikitext);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].article, 'Immigration to the United States');
    assert.equal(rows[0].oldid, 1331476438);
    assert.equal(rows[0].citation, 1);
    assert.equal(rows[0].instance, 1);
    assert.equal(rows[0].truth, 'Supported');
    assert.equal(rows[0].wiki, 'enwiki');
});

test('csvRowToWikitext emits the WMF override trio when present', () => {
    const wikitext = csvRowToWikitext(csvRow({
        'WMF claim text': 'She guest-starred in several episodes.',
        'WMF source URL': 'https://www.nbc.com/some-article',
        'WMF provenance': 'human-annotation:source-verification-2026-04-25',
    }));
    const { rows } = parseSuite(wikitext);
    assert.equal(rows[0].claimText, 'She guest-starred in several episodes.');
    assert.equal(rows[0].sourceUrl, 'https://www.nbc.com/some-article');
});

test('csvRowToWikitext omits blank optional params rather than emitting empty values', () => {
    // An empty value is indistinguishable from a missing one to the parser, and
    // the validator rejects it outright.
    const wikitext = csvRowToWikitext(csvRow());
    assert.doesNotMatch(wikitext, /claim-text\s*=\s*$/m);
    assert.doesNotMatch(wikitext, /provenance/);
});

test('csvRowToWikitext never emits a Dataset version param', () => {
    // Cohort membership comes from revision history, not from a per-row tag.
    assert.doesNotMatch(csvRowToWikitext(csvRow()), /version/i);
});

test('csvRowsToWikitext produces one parseable block per input row', () => {
    const wikitext = csvRowsToWikitext([
        csvRow(),
        csvRow({ 'Citation number': '2', 'Ground truth': 'Partially supported' }),
    ]);
    const { rows } = parseSuite(wikitext);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].truth, 'Partially supported');
    assert.notEqual(rows[0].id, rows[1].id);
});
