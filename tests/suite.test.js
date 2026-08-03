import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractRowBlocks, splitTopLevelParams, SUITE_TEMPLATE_TITLE, SUITE_TEMPLATE_KEY, wtf } from '../benchmark/suite.js';

const T = SUITE_TEMPLATE_TITLE;
const row = (params) => `{{${T}|${params}}}`;

test('extractRowBlocks finds each row call and its full extent', () => {
    const page = `intro\n${row('id=a|citation=1')}\n${row('id=b|citation=2')}\nouttro`;
    const blocks = extractRowBlocks(page);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].balanced, true);
    assert.equal(blocks[0].text, row('id=a|citation=1'));
    assert.equal(blocks[1].text, row('id=b|citation=2'));
});

test('extractRowBlocks tolerates balanced braces inside a value', () => {
    const blocks = extractRowBlocks(row('id=a|rationale=a {b} c|citation=1'));
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].balanced, true);
    assert.equal(blocks[0].text, row('id=a|rationale=a {b} c|citation=1'));
});

test('extractRowBlocks flags an unbalanced brace instead of silently ending', () => {
    const blocks = extractRowBlocks(row('id=a|rationale=see {note|citation=1'));
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].balanced, false);
});

test('extractRowBlocks matches underscore and lowercase title variants', () => {
    const page = '{{user:alaexis/AI_Source_Verification/Benchmark/Row|id=a}}';
    assert.equal(extractRowBlocks(page).length, 1);
});

test('extractRowBlocks does not match the /doc subpage transclusion', () => {
    const page = `{{${T}/doc}}`;
    assert.equal(extractRowBlocks(page).length, 0);
});

test('extractRowBlocks reports balanced:true even when an extra-closing-brace form makes wtf vanish the row', () => {
    // With `rationale=see note}` (unmatched closing brace), extractRowBlocks
    // encounters depth-zero at the `}` and returns a balanced block, but wtf
    // silently drops the entire row. This is reported separately by the validator
    // as ROW_COUNT_MISMATCH (or UNBALANCED_BRACES if caught by the raw scan).
    // This test documents the current behavior so it doesn't regress if the
    // depth-matching logic changes.
    const blocks = extractRowBlocks(row('id=a|rationale=see note}|citation=1'));
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].balanced, true);
});

test('splitTopLevelParams separates params without splitting inside a wikilink', () => {
    const block = row('id=a|rationale=see [[Foo|bar]] here|citation=1');
    const { name, params } = splitTopLevelParams(block);
    assert.equal(name, T);
    assert.deepEqual(params, ['id=a', 'rationale=see [[Foo|bar]] here', 'citation=1']);
});

test('splitTopLevelParams: an unclosed wikilink swallows all subsequent parameters (limitation)', () => {
    // With `rationale=see [[Foo|bar` (unclosed wikilink), the link counter stays
    // at 1 for the rest of the block, so no further `|` chars trigger a split.
    // This causes subsequent parameters to be merged into the malformed value.
    // This limitation is acceptable — the validator catches the stray `|` in the
    // corrupted value via STRAY_PIPE — but we document it so the behavior
    // doesn't regress unexpectedly.
    const block = row('id=a|rationale=see [[Foo|bar|citation=1');
    const { params } = splitTopLevelParams(block);
    // All three params are present, but `rationale` and the split attempt at
    // `citation` are merged: the entire `see [[Foo|bar|citation=1` is one value.
    assert.equal(params.length, 2);
    assert.equal(params[0], 'id=a');
    assert.equal(params[1], 'rationale=see [[Foo|bar|citation=1');
});

test('splitTopLevelParams still splits after a stray closing wikilink', () => {
    // A `]]` with no matching `[[` drives the link counter to -1. The split guard
    // is `link <= 0` precisely so a negative depth still permits top-level splits;
    // `link === 0` would leave the counter stuck below zero and swallow every
    // parameter after the stray `]]`. This fixture pins that choice.
    const block = row('id=a|rationale=a ]] b|citation=1');
    const { params } = splitTopLevelParams(block);
    assert.deepEqual(params, ['id=a', 'rationale=a ]] b', 'citation=1']);
});

test('splitTopLevelParams handles the multi-line pretty format', () => {
    const block = `{{${T}\n| id = a\n| truth = Supported\n}}`;
    const { params } = splitTopLevelParams(block);
    assert.deepEqual(params.map(p => p.trim()), ['id = a', 'truth = Supported']);
});

test('splitTopLevelParams handles blocks ending with a single-} when braces are unmatched', () => {
    // When extractRowBlocks encounters an unmatched `}` in a value, it stops at
    // depth-zero with one `}` remaining. Verify splitTopLevelParams correctly
    // strips that single trailing brace without destroying unrelated parameter data.
    const block = '{{' + T + '|id=a|rationale=see note}|citation=1}';
    const { name, params } = splitTopLevelParams(block);
    assert.equal(name, T);
    // The unmatched `}` drives the depth-counter negative, so the subsequent `|`
    // does not split; citation=1 is merged into the rationale value. Verify we
    // get exactly what the depth-tracking logic produces (not something worse).
    assert.equal(params.length, 2);
    assert.equal(params[0], 'id=a');
    assert.equal(params[1], 'rationale=see note}|citation=1');
});

test('splitTopLevelParams preserves nested-template closing braces in the last parameter', () => {
    // Regression: a greedy trailing-brace strip corrupted `citation={{tl|x}}}}` by
    // stripping all four closing braces. This test verifies the fix preserves the
    // nested template's closing `}}` while still stripping the outer template's `}}`.
    const block = row('id=a|citation={{tl|x}}');
    const { name, params } = splitTopLevelParams(block);
    assert.equal(name, T);
    assert.equal(params.length, 2);
    assert.equal(params[0], 'id=a');
    assert.equal(params[1], 'citation={{tl|x}}');
});

// These tests document measured wtf_wikipedia 10.4.2 behavior rather than our own
// code. They exist so a dependency bump that changes any of it fails here, loudly,
// instead of silently changing which rows survive ingestion. If one of these breaks
// after an upgrade, re-derive the validator rules — do not just update the expectation.

const parseOne = (wikitext) => {
    const found = wtf(wikitext).templates().map(t => t.json())
        .filter(j => j.template === SUITE_TEMPLATE_KEY);
    return found.length === 1 ? found[0] : found;
};

test('wtf quirk: template name comes back lowercased with spaces preserved', () => {
    const j = parseOne(row('id=a'));
    assert.equal(j.template, 'user:alaexis/ai source verification/benchmark/row');
});

test('wtf quirk: an UNBALANCED brace makes the whole row vanish', () => {
    assert.deepEqual(parseOne(row('id=a|rationale=see {note|citation=1')), []);
    assert.deepEqual(parseOne(row('id=a|rationale=see note}|citation=1')), []);
});

test('wtf quirk: BALANCED braces survive — the ban is conservative, not literal', () => {
    // The design doc states any { or } nulls the row. Measured: only unbalanced
    // ones do. The validator still rejects both, because distinguishing them on
    // wiki is a trap for editors; this test records why the rule is stricter than
    // the underlying failure.
    assert.equal(parseOne(row('id=a|rationale=a {b} c|citation=1')).rationale, 'a {b} c');
});

test('wtf quirk: a bare pipe truncates the value and invents a `list` param', () => {
    const j = parseOne(row('id=a|rationale=a | b|citation=1'));
    assert.equal(j.rationale, 'a');
    assert.deepEqual(j.list, ['b']);
});

test('wtf quirk: {{!}} and <nowiki> do NOT escape a pipe here', () => {
    for (const escaped of ['a {{!}} b', 'a <nowiki>|</nowiki> b']) {
        const j = parseOne(row(`id=a|rationale=${escaped}|citation=1`));
        assert.equal(j.rationale, 'a', `expected truncation for: ${escaped}`);
    }
});

test('wtf quirk: &#124; survives as an encoded pipe', () => {
    assert.equal(parseOne(row('id=a|rationale=a &#124; b|citation=1')).rationale, 'a &#124; b');
});

test('wtf quirk: an empty value makes the param vanish entirely', () => {
    const j = parseOne(row('id=a|rationale=|citation=1'));
    assert.equal('rationale' in j, false);
});

test('wtf quirk: a duplicated param silently keeps the last value', () => {
    const j = parseOne(row('id=a|truth=Supported|truth=Not supported|citation=1'));
    assert.equal(j.truth, 'Not supported');
});

test('wtf quirk: a magic word expands at parse time, breaking reproducibility', () => {
    assert.match(parseOne(row('id=a|rationale={{CURRENTYEAR}}|citation=1')).rationale, /^\d{4}$/);
});

test('wtf safe: equals signs, URLs, non-ASCII and quotes pass through intact', () => {
    assert.equal(parseOne(row('id=a|rationale=a=b')).rationale, 'a=b');
    assert.equal(
        parseOne(row('id=a|source-url=https://e.com/p?a=1&b=2#frag'))['source-url'],
        'https://e.com/p?a=1&b=2#frag',
    );
    assert.equal(parseOne(row('id=a|article=Café Müller — naïve')).article, 'Café Müller — naïve');
    assert.equal(parseOne(row('id=a|rationale=He said "hi"')).rationale, 'He said "hi"');
});

test('wtf lossy-but-accepted: a wikilink is flattened to its label', () => {
    assert.equal(parseOne(row('id=a|rationale=see [[Foo|bar]]')).rationale, 'see bar');
});

test('wtf safe: rows transcluded inside a wikitable still parse', () => {
    const page = `{|class="wikitable"\n|-\n|${row('id=a|citation=1')}\n|}`;
    assert.equal(parseOne(page).id, 'a');
});

test('wtf quirk: silent whitespace normalization before punctuation', () => {
    // The parser strips space before certain punctuation irregularly: only the
    // FIRST occurrence of ` ,`, only TRAILING ` .`, semicolons untouched. This
    // quirk breaks byte-comparison parity and affects four CSV rows. Phase 4's
    // escapeParamValue pre-normalizes these sequences so they never reach the
    // parser and the round trip is exact.
    assert.equal(parseOne(row('id=a|rationale=a , b|citation=1')).rationale, 'a, b');
    assert.equal(parseOne(row('id=a|rationale=a , b , c|citation=1')).rationale, 'a, b , c');
    assert.equal(parseOne(row('id=a|rationale=hello .|citation=1')).rationale, 'hello.');
    assert.equal(parseOne(row('id=a|rationale=a ; b|citation=1')).rationale, 'a ; b');
});

// Task 4: The validator
import { parseSuite, SuiteValidationError } from '../benchmark/suite.js';

const good = (over = {}) => {
    const base = {
        id: 'ctb-a1b2c3', wiki: 'enwiki', article: 'Immigration to the United States',
        oldid: '1331476438', citation: '1', instance: '1', truth: 'Supported',
    };
    const merged = { ...base, ...over };
    return `{{${T}\n${Object.entries(merged)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `| ${k} = ${v}`).join('\n')}\n}}`;
};
const codesOf = (page) => {
    try { parseSuite(page); return []; }
    catch (e) {
        assert.ok(e instanceof SuiteValidationError, `expected SuiteValidationError, got ${e}`);
        return e.errors.map(x => x.code);
    }
};

test('parseSuite accepts a well-formed row', () => {
    const { rows } = parseSuite(good());
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'ctb-a1b2c3');
    assert.equal(rows[0].truth, 'Supported');
    assert.equal(rows[0].oldid, 1331476438);
    assert.equal(rows[0].citation, 1);
});

test('parseSuite reports a missing required param, naming row and param', () => {
    let err;
    try { parseSuite(good({ truth: undefined })); } catch (e) { err = e; }
    assert.ok(err instanceof SuiteValidationError);
    assert.equal(err.errors.length, 1);
    assert.equal(err.errors[0].code, 'MISSING_PARAM');
    assert.equal(err.errors[0].param, 'truth');
    assert.equal(err.errors[0].row, 1);
    assert.equal(err.errors[0].id, 'ctb-a1b2c3');
    assert.match(err.message, /truth/);
});

test('parseSuite rejects an unbalanced brace rather than losing the row silently', () => {
    assert.deepEqual(codesOf(`{{${T}|id=ctb-a1b2c3|rationale=see {note|citation=1}}`), ['UNBALANCED_BRACES']);
});

test('parseSuite rejects braces in a value even when balanced', () => {
    assert.ok(codesOf(good({ rationale: 'a {b} c' })).includes('FORBIDDEN_CHAR'));
});

test('parseSuite rejects a stray pipe in a value', () => {
    assert.ok(codesOf(good({ rationale: 'a | b' })).includes('STRAY_PIPE'));
});

test('parseSuite rejects a nested template, including the {{!}} escape', () => {
    assert.ok(codesOf(good({ rationale: 'a {{!}} b' })).includes('NESTED_TEMPLATE'));
    assert.ok(codesOf(good({ rationale: '{{CURRENTYEAR}}' })).includes('NESTED_TEMPLATE'));
});

test('parseSuite rejects an empty value that wtf would have hidden', () => {
    assert.ok(codesOf(good({ rationale: '' })).includes('EMPTY_PARAM'));
});

test('parseSuite rejects a duplicated param that wtf would have collapsed', () => {
    const page = `{{${T}|id=ctb-a1b2c3|wiki=enwiki|article=A|oldid=1|citation=1|instance=1`
        + `|truth=Supported|truth=Not supported}}`;
    assert.ok(codesOf(page).includes('DUPLICATE_PARAM'));
});

test('parseSuite rejects unknown and reserved param names', () => {
    assert.ok(codesOf(good({ 'noSuchParam': 'x' })).includes('UNKNOWN_PARAM'));
    assert.ok(codesOf(good({ 'template': 'x' })).includes('RESERVED_PARAM'));
});

test('parseSuite rejects a malformed id and a non-numeric oldid', () => {
    assert.ok(codesOf(good({ id: 'row_77' })).includes('BAD_ID_FORMAT'));
    assert.ok(codesOf(good({ oldid: 'latest' })).includes('NON_NUMERIC'));
});

test('parseSuite rejects an unrecognized verdict but accepts case variants', () => {
    assert.ok(codesOf(good({ truth: 'Probably fine' })).includes('BAD_VERDICT'));
    assert.equal(parseSuite(good({ truth: 'partially supported' })).rows[0].truth, 'Partially supported');
    assert.equal(parseSuite(good({ truth: 'NOT SUPPORTED' })).rows[0].truth, 'Not supported');
});

test('parseSuite rejects an unknown wiki', () => {
    assert.ok(codesOf(good({ wiki: 'dewiki' })).includes('UNKNOWN_WIKI'));
});

test('parseSuite rejects two rows sharing an id', () => {
    assert.ok(codesOf(`${good()}\n${good({ citation: '2' })}`).includes('DUPLICATE_ID'));
});

test('parseSuite reports every error in one pass, not just the first', () => {
    const codes = codesOf(good({ truth: 'Nope', oldid: 'x', id: 'bad' }));
    assert.ok(codes.includes('BAD_VERDICT'));
    assert.ok(codes.includes('NON_NUMERIC'));
    assert.ok(codes.includes('BAD_ID_FORMAT'));
});

test('parseSuite ignores prose and other templates around the rows', () => {
    const page = `== Header ==\nSome prose.\n{{Documentation}}\n${good()}\n[[Category:X]]`;
    assert.equal(parseSuite(page).rows.length, 1);
});

test('parseSuite hard-fails when the parser and the raw scan disagree on row count', () => {
    // Guard against the whole class of silent-row-loss bugs, not just the causes
    // enumerated above: if wtf ever drops a row for a reason we do not model, the
    // reconciliation catches it.
    //
    // Every KNOWN cause of row loss makes a block unbalanced, and the reconciliation
    // is deliberately skipped in that case (UNBALANCED_BRACES already names the row
    // precisely). So this exercises the branch directly with a stubbed parser rather
    // than through a fixture — a fixture that triggers it would, by definition, be a
    // cause we already model.
    const page = `${good()}\n${good({ id: 'ctb-b2c3d4', citation: '2' })}`;

    const original = globalThis.__suiteParseHook;
    globalThis.__suiteParseHook = (templates) => templates.slice(0, 1); // drop a row
    try {
        const codes = codesOf(page);
        assert.ok(codes.includes('ROW_COUNT_MISMATCH'),
            `expected ROW_COUNT_MISMATCH, got ${codes.join(', ')}`);
    } finally {
        globalThis.__suiteParseHook = original;
    }
});

test('parseSuite accepts a page where the parser and raw scan agree', () => {
    const page = `${good()}\n${good({ id: 'ctb-b2c3d4', citation: '2' })}`;
    assert.equal(parseSuite(page).rows.length, 2);
});

// Task 5: Normalize to the dataset row shape
import { toDatasetRow } from '../benchmark/suite.js';

test('toDatasetRow produces the CSV column shape extract_dataset.js consumes', () => {
    const { rows } = parseSuite(good());
    const csvRow = toDatasetRow(rows[0]);
    assert.equal(csvRow['Citation number'], '1');
    assert.equal(csvRow['Citation instance'], '1');
    assert.equal(csvRow['Article'],
        'https://en.wikipedia.org/w/index.php?title=Immigration_to_the_United_States&oldid=1331476438');
    assert.equal(csvRow['Ground truth'], 'Supported');
    assert.equal(csvRow['WMF claim text'], '');
    assert.equal(csvRow['WMF source URL'], '');
    assert.equal(csvRow._id, 'ctb-a1b2c3');
});

test('toDatasetRow carries the WMF override trio through', () => {
    const { rows } = parseSuite(good({
        'claim-text': 'She guest-starred in several episodes.',
        'source-url': 'https://www.nbc.com/some-article',
        'provenance': 'human-annotation:source-verification-2026-04-25',
    }));
    const csvRow = toDatasetRow(rows[0]);
    assert.equal(csvRow['WMF claim text'], 'She guest-starred in several episodes.');
    assert.equal(csvRow['WMF source URL'], 'https://www.nbc.com/some-article');
    assert.equal(csvRow['WMF provenance'], 'human-annotation:source-verification-2026-04-25');
});

test('toDatasetRow builds a French Wikipedia URL for frwiki', () => {
    const { rows } = parseSuite(good({ wiki: 'frwiki', article: 'Paris' }));
    assert.match(toDatasetRow(rows[0])['Article'], /^https:\/\/fr\.wikipedia\.org\//);
});

test('toDatasetRow underscore-encodes spaces but leaves other characters alone', () => {
    const { rows } = parseSuite(good({ article: 'Café Müller' }));
    assert.match(toDatasetRow(rows[0])['Article'], /title=Caf%C3%A9_M%C3%BCller&/);
});
