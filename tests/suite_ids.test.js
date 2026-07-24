import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRowId, parseArticleUrl } from '../benchmark/suite.js';

const identity = { wiki: 'enwiki', oldid: 1331476438, citation: 1, instance: 1 };

test('computeRowId returns the ctb- prefixed 6-hex-char form', () => {
    assert.match(computeRowId(identity), /^ctb-[0-9a-f]{6}$/);
});

test('computeRowId is deterministic across calls', () => {
    assert.equal(computeRowId(identity), computeRowId({ ...identity }));
});

test('computeRowId ignores string-vs-number typing of the identity fields', () => {
    assert.equal(
        computeRowId(identity),
        computeRowId({ wiki: 'enwiki', oldid: '1331476438', citation: '1', instance: '1' }),
    );
});

test('computeRowId changes when any identity field changes', () => {
    const base = computeRowId(identity);
    assert.notEqual(base, computeRowId({ ...identity, citation: 2 }));
    assert.notEqual(base, computeRowId({ ...identity, instance: 2 }));
    assert.notEqual(base, computeRowId({ ...identity, oldid: 1331476439 }));
    assert.notEqual(base, computeRowId({ ...identity, wiki: 'frwiki' }));
});

test('computeRowId ignores ground truth, rationale and overrides', () => {
    // Correcting a label must never renumber a row — that is the whole point of
    // hashing identity only.
    const base = computeRowId(identity);
    assert.equal(base, computeRowId({ ...identity, truth: 'Not supported' }));
    assert.equal(base, computeRowId({ ...identity, rationale: 'changed my mind' }));
    assert.equal(base, computeRowId({ ...identity, claimText: 'x', sourceUrl: 'y' }));
});

test('computeRowId does not collide on adjacent field values', () => {
    // Guard against a naive concatenation where ('1','11') and ('11','1') hash
    // the same. The separator makes the encoding unambiguous.
    assert.notEqual(
        computeRowId({ ...identity, citation: 1, instance: 11 }),
        computeRowId({ ...identity, citation: 11, instance: 1 }),
    );
});

test('parseArticleUrl recovers title, oldid and wiki from a CSV Article URL', () => {
    const parsed = parseArticleUrl(
        'https://en.wikipedia.org/w/index.php?title=Immigration_to_the_United_States&oldid=1331476438');
    assert.equal(parsed.article, 'Immigration to the United States');
    assert.equal(parsed.oldid, 1331476438);
    assert.equal(parsed.wiki, 'enwiki');
});

test('parseArticleUrl decodes percent-encoded titles', () => {
    assert.equal(
        parseArticleUrl('https://en.wikipedia.org/w/index.php?title=Caf%C3%A9_M%C3%BCller&oldid=1').article,
        'Café Müller',
    );
});

test('parseArticleUrl throws on a URL with no oldid rather than guessing', () => {
    assert.throws(
        () => parseArticleUrl('https://en.wikipedia.org/wiki/Immigration_to_the_United_States'),
        /oldid/,
    );
});

import { parseSuite } from '../benchmark/suite.js';

const rowText = (params) => `{{User:Alaexis/AI Source Verification/Benchmark/Row\n`
    + Object.entries(params).map(([k, v]) => `| ${k} = ${v}`).join('\n') + '\n}}';

const identityParams = {
    wiki: 'enwiki', article: 'Example', oldid: '1331476438',
    citation: '1', instance: '1', truth: 'Supported',
};

test('parseSuite computes a missing id rather than rejecting the row', () => {
    // A userscript contribution cannot carry a hash. Rejecting it would let one
    // contributed row block ingestion for the whole dataset.
    const { rows, warnings } = parseSuite(rowText(identityParams));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, computeRowId({
        wiki: 'enwiki', oldid: '1331476438', citation: '1', instance: '1' }));
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].code, 'ID_COMPUTED');
});

test('parseSuite warns on id drift without overriding the written id', () => {
    const { rows, warnings } = parseSuite(rowText({ ...identityParams, id: 'ctb-000000' }));
    assert.equal(rows[0].id, 'ctb-000000', 'the written id must survive');
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].code, 'ID_DRIFT');
});

test('parseSuite emits no warning when the written id matches the hash', () => {
    const id = computeRowId({ wiki: 'enwiki', oldid: '1331476438', citation: '1', instance: '1' });
    const { rows, warnings } = parseSuite(rowText({ ...identityParams, id }));
    assert.equal(rows[0].id, id);
    assert.deepEqual(warnings, []);
});

test('parseSuite still rejects a malformed id outright', () => {
    assert.throws(() => parseSuite(rowText({ ...identityParams, id: 'row_77' })), /BAD_ID_FORMAT/);
});

test('parseSuite still errors when identity is too incomplete to compute an id', () => {
    const { oldid, ...noOldid } = identityParams;
    assert.throws(() => parseSuite(rowText(noOldid)), /MISSING_PARAM/);
});

// Task 6 tests

import { csvRowsToWikitext } from '../benchmark/csv_to_suite.js';

const mkCsvRow = (citation, oldid = 1331476438) => ({
    'Citation number': String(citation),
    'Citation instance': '1',
    'Article': `https://en.wikipedia.org/w/index.php?title=Example&oldid=${oldid}`,
    'Ground truth': 'Supported',
    'WMF claim text': '', 'WMF source URL': '', 'WMF provenance': '',
});

test('inserting a row mid-table does not renumber any existing row', () => {
    // The May 2026 incident: a CSV insert shifted every row_<line> id after it,
    // while results.json kept the old ids and silently pointed at the wrong
    // content for two weeks.
    const before = parseSuite(csvRowsToWikitext([mkCsvRow(1), mkCsvRow(2), mkCsvRow(3)])).rows;
    const after = parseSuite(csvRowsToWikitext(
        [mkCsvRow(1), mkCsvRow(99), mkCsvRow(2), mkCsvRow(3)])).rows;

    const idFor = (rows, citation) => rows.find(r => r.citation === citation).id;
    for (const citation of [1, 2, 3]) {
        assert.equal(idFor(after, citation), idFor(before, citation),
            `row citation=${citation} was renumbered by an unrelated insertion`);
    }
});

test('reordering rows does not change any id', () => {
    const ordered = parseSuite(csvRowsToWikitext([mkCsvRow(1), mkCsvRow(2)])).rows;
    const reversed = parseSuite(csvRowsToWikitext([mkCsvRow(2), mkCsvRow(1)])).rows;
    assert.equal(
        ordered.find(r => r.citation === 1).id,
        reversed.find(r => r.citation === 1).id,
    );
});

test('correcting a ground-truth label does not change the row id', () => {
    const original = parseSuite(csvRowsToWikitext([mkCsvRow(1)])).rows[0];
    const corrected = parseSuite(csvRowsToWikitext(
        [{ ...mkCsvRow(1), 'Ground truth': 'Not supported' }])).rows[0];
    assert.equal(corrected.id, original.id);
    assert.equal(corrected.truth, 'Not supported');
});

test('correcting the article revision DOES change the id, as identity drift', () => {
    // oldid is an identity field, so re-pinning a row to a new article revision
    // is a new row. This is why ingestion warns on an id/hash mismatch rather
    // than silently overwriting the written id.
    const original = parseSuite(csvRowsToWikitext([mkCsvRow(1, 1331476438)])).rows[0];
    const repinned = parseSuite(csvRowsToWikitext([mkCsvRow(1, 1331476439)])).rows[0];
    assert.notEqual(repinned.id, original.id);
});
