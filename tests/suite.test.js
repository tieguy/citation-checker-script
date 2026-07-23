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
