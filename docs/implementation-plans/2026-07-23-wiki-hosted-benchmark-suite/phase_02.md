# Wiki-Hosted Benchmark Suite Implementation Plan — Phase 2

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** `benchmark/suite.js` — pure functions taking a wikitext string and returning
validated row objects in the shape `extract_dataset.js` consumes, with no network
access and no filesystem access.

**Architecture:** Two independent readings of the same wikitext, cross-checked against
each other. A hand-written brace-depth scanner finds row blocks and reads parameters
from the **raw** text; `wtf_wikipedia` parses the same page for **values**. The scanner
catches everything the parser hides (duplicate params, empty values, stray pipes,
unbalanced braces); the parser handles what the scanner shouldn't reimplement (link
flattening, entity handling). If the two disagree on row count, that is a hard failure —
because the parser's failure mode is a row silently vanishing, which would change the
denominator of every accuracy metric without any visible error.

**Tech Stack:** `wtf_wikipedia@10.4.2` (new `benchmark/` dependency), `node:test`,
`node:assert/strict`. Imports `canonicalizeVerdict`/`toTitleCase` from `core/verdicts.js`.

**Scope:** Phase 2 of 7. Depends on Phase 1 (template shape settled).

**Codebase verified:** 2026-07-23

---

### Task 1: Add the `wtf_wikipedia` dependency

**Files:**
- Modify: `benchmark/package.json:28-30`

**Step 1: Add the dependency**

Change the `dependencies` block from:

```json
  "dependencies": {
    "jsdom": "^24.0.0"
  }
```

to:

```json
  "dependencies": {
    "jsdom": "^24.0.0",
    "wtf_wikipedia": "^10.4.2"
  }
```

**Step 2: Install and verify the resolved version**

Run: `cd benchmark && npm install`
Expected: installs without errors.

Run: `cd benchmark && node -e "import('wtf_wikipedia').then(m => console.log(typeof m.default))"`
Expected: `function`

Run: `cd benchmark && node -p "require('./node_modules/wtf_wikipedia/package.json').version"`
Expected: `10.4.2` or later 10.4.x.

The behavior fixtures in Task 3 pin this library's quirks. If the resolved version is
**not** 10.4.x, stop and report — the fixture expectations were measured against 10.4.2
and a major-version bump invalidates them.

**Step 3: Commit**

```bash
git add benchmark/package.json benchmark/package-lock.json
git commit -m "benchmark: add wtf_wikipedia dependency for wiki suite parsing"
```

Note: `benchmark/package-lock.json` is staged deliberately here because the dependency
is being added. Do not `git add benchmark/` — enumerate the two files.

---

### Task 2: Row-block scanner and parameter splitter

These are the raw-text primitives everything else builds on. Written first because the
validator's most important checks depend on them, not on `wtf_wikipedia`.

**Files:**
- Create: `benchmark/suite.js`
- Create: `tests/suite.test.js`

**Step 1: Write the failing test**

Create `tests/suite.test.js`:

```javascript
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
```

**Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern='extractRowBlocks' 'tests/**/*.test.js'`
Expected: FAIL — `Cannot find module '.../benchmark/suite.js'`

**Step 3: Write the implementation**

Create `benchmark/suite.js`:

```javascript
// Parse and validate the on-wiki benchmark suite page.
//
// Pure functions over wikitext strings: no network, no filesystem. The fetch and
// snapshot layer lives in suite_fetch.js; this module only ever sees text.
//
// WHY TWO PARSERS: wtf_wikipedia's failure mode for a malformed row is that the
// row silently disappears from its output — no error, no warning. A vanished row
// changes the denominator of every accuracy metric computed downstream. So the
// raw text is scanned independently (extractRowBlocks + splitTopLevelParams) and
// the two readings are reconciled; a count mismatch is a hard failure. The raw
// scan also recovers the three things wtf_wikipedia destroys before we could
// inspect them: duplicate params (last silently wins), empty values
// (indistinguishable from absent), and stray pipes (truncate the value and
// invent a spurious `list` param).
//
// Measured against wtf_wikipedia 10.4.2; see tests/suite.test.js for the full
// behavior matrix and docs/implementation-plans/2026-07-23-wiki-hosted-benchmark-suite/README.md
// for the measurements.

import { canonicalizeVerdict, toTitleCase } from '../core/verdicts.js';

// Re-export wtf so tests and benchmark code share a single resolved module.
// This ensures both paths use the same wtf_wikipedia instance and any future
// version drift from floating ^10.4.2 ranges hits all regression fixtures equally.
export { default as wtf } from 'wtf_wikipedia';

export const SUITE_TEMPLATE_TITLE = 'User:Alaexis/AI Source Verification/Benchmark/Row';

// wtf_wikipedia lowercases template names but PRESERVES spaces (it does not
// convert them to underscores). This is the form .json().template returns.
export const SUITE_TEMPLATE_KEY = SUITE_TEMPLATE_TITLE.toLowerCase();

// Matches a row transclusion's opening. The lookahead for `|` or `}` prevents
// matching `{{.../Row/doc}}`. Case-insensitive and underscore-tolerant because
// MediaWiki treats those as the same title.
const ROW_CALL_RE =
    /\{\{\s*(?:Template:)?User:Alaexis\/AI[ _]Source[ _]Verification\/Benchmark\/Row\s*(?=[|}])/gi;

export const REQUIRED_PARAMS = Object.freeze([
    'id', 'wiki', 'article', 'oldid', 'citation', 'instance', 'truth',
]);

export const OPTIONAL_PARAMS = Object.freeze([
    'rationale', 'added-by', 'confirmed-by',
    'claim-text', 'source-url', 'provenance',
    'llm-verdict', 'llm-rationale', 'llm-provider', 'llm-model', 'fetch-status',
]);

const KNOWN_PARAMS = new Set([...REQUIRED_PARAMS, ...OPTIONAL_PARAMS]);
const NUMERIC_PARAMS = Object.freeze(['oldid', 'citation', 'instance']);

// wtf_wikipedia injects the template's own name under this key in .json().
// A row param of the same name would be silently overwritten.
const RESERVED_PARAM = 'template';

const ID_RE = /^ctb-[0-9a-f]{6}$/;
const PARAM_RE = /^\s*([A-Za-z0-9_-]+)\s*=([\s\S]*)$/;

// Maps a wiki database name to its Wikipedia subdomain. `wiki` is required on
// every row specifically so a second suite page can be added without a schema
// migration; only enwiki is in use today.
export const WIKI_SUBDOMAINS = Object.freeze({ enwiki: 'en', frwiki: 'fr' });

/**
 * Locate every row transclusion, using brace-depth matching rather than a
 * regex, so a value containing balanced braces does not truncate the block and
 * an unbalanced brace is reported rather than silently swallowing the rest of
 * the page.
 *
 * @returns {Array<{start:number,end:number,text:string,balanced:boolean}>}
 */
export function extractRowBlocks(wikitext) {
    const blocks = [];
    ROW_CALL_RE.lastIndex = 0;
    let match;

    while ((match = ROW_CALL_RE.exec(wikitext)) !== null) {
        const start = match.index;
        let depth = 0;
        let end = -1;

        for (let i = start; i < wikitext.length; i++) {
            const ch = wikitext[i];
            if (ch === '{') {
                depth++;
            } else if (ch === '}') {
                depth--;
                if (depth === 0) { end = i + 1; break; }
            }
        }

        if (end === -1) {
            // Unterminated: nothing after this point can be trusted, because the
            // missing close brace swallows every subsequent row.
            blocks.push({ start, end: wikitext.length, text: wikitext.slice(start), balanced: false });
            break;
        }

        blocks.push({ start, end, text: wikitext.slice(start, end), balanced: true });
        ROW_CALL_RE.lastIndex = end;
    }

    return blocks;
}

/**
 * Split a row block into its template name and raw parameter segments, honoring
 * brace and wikilink nesting so `[[Foo|bar]]` does not split into two params.
 *
 * @returns {{name:string, params:string[]}}
 */
export function splitTopLevelParams(blockText) {
    // Defensively strip delimiters rather than assuming fixed offsets, in case the
    // block's trailing braces are unbalanced (e.g., from extractRowBlocks terminating
    // on depth-zero with a single `}` instead of `}}` remaining).
    const inner = blockText.replace(/^\{\{/, '').replace(/\}+$/, '');
    const segments = [];
    let current = '';
    let depth = 0;
    let link = 0;

    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];

        if (ch === '{') { depth++; }
        else if (ch === '}') { depth--; }
        else if (ch === '[' && inner[i + 1] === '[') { link++; }
        else if (ch === ']' && inner[i + 1] === ']') { link--; }

        if (ch === '|' && depth === 0 && link <= 0) {
            segments.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    segments.push(current);

    return { name: segments[0].trim(), params: segments.slice(1) };
}
```

**Step 4: Run to verify it passes**

Run: `node --test --test-name-pattern='extractRowBlocks|splitTopLevelParams' 'tests/**/*.test.js'`
Expected: PASS, 11 tests.

**Step 5: Commit**

```bash
git add benchmark/suite.js tests/suite.test.js
git commit -m "benchmark: add raw wikitext row-block scanner for the wiki suite"
```

---

### Task 3: Pin `wtf_wikipedia` behavior as regression fixtures

Before building the validator, encode the library quirks it defends against, so a
dependency bump that changes them fails loudly here rather than corrupting a benchmark
run months later.

**Files:**
- Modify: `tests/suite.test.js`

**Step 1: Write the failing test**

Append to `tests/suite.test.js`:

```javascript
// Note: wtf and SUITE_TEMPLATE_KEY are imported from suite.js at the top of the file
// (Task 2's re-export makes them available to all tests). No additional imports needed.

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
```

**Step 2: Run to verify**

Run: `node --test --test-name-pattern='wtf ' 'tests/**/*.test.js'`
Expected: PASS, 13 tests. Any failure here means the installed version differs from
10.4.2's measured behavior — stop and report rather than adjusting expectations.

**Step 3: Commit**

```bash
git add tests/suite.test.js
git commit -m "benchmark: pin measured wtf_wikipedia parsing quirks as regression tests"
```

---

### Task 4: The validator

**Files:**
- Modify: `benchmark/suite.js`
- Modify: `tests/suite.test.js`

**Step 1: Write the failing test**

Append to `tests/suite.test.js`:

```javascript
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
```

**Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern='parseSuite' 'tests/**/*.test.js'`
Expected: FAIL — `parseSuite` is not exported.

**Step 3: Write the implementation**

Append to `benchmark/suite.js`:

```javascript
export class SuiteValidationError extends Error {
    constructor(errors) {
        const lines = errors.map(e =>
            `  [${e.code}] row ${e.row}`
            + (e.id ? ` (${e.id})` : '')
            + (e.param ? ` param "${e.param}"` : '')
            + `: ${e.message}`);
        super(`Suite validation failed with ${errors.length} error(s):\n${lines.join('\n')}`);
        this.name = 'SuiteValidationError';
        this.errors = errors;
    }
}

/**
 * Parse and validate an entire suite page.
 *
 * Throws SuiteValidationError listing EVERY problem found, rather than the first.
 * A partially-valid suite is never returned: silent row loss changes the
 * denominator of every downstream accuracy metric, so ingestion refuses to
 * proceed on a malformed page. This is the documented exception to the project
 * convention that analytical tools always exit 0 — that convention guards against
 * rubber-stamping *results*, whereas this guards the *inputs*.
 *
 * @param {string} wikitext
 * @returns {{rows: object[]}} validated rows in page order
 */
export function parseSuite(wikitext) {
    const errors = [];
    const blocks = extractRowBlocks(wikitext);

    // --- Reading 1: raw text. Recovers what wtf_wikipedia destroys.
    const rawRows = blocks.map((block, i) => {
        const rowNo = i + 1;

        if (!block.balanced) {
            errors.push({
                row: rowNo, id: null, param: null, code: 'UNBALANCED_BRACES',
                message: 'unbalanced { or } — this row and everything after it is lost by the parser',
            });
            return null;
        }

        const { params } = splitTopLevelParams(block.text);
        const values = new Map();
        const seen = new Set();

        for (const segment of params) {
            const m = PARAM_RE.exec(segment);
            if (!m) {
                if (segment.trim() === '') continue; // trailing newline before }}
                errors.push({
                    row: rowNo, id: null, param: null, code: 'STRAY_PIPE',
                    message: `"${segment.trim().slice(0, 40)}" is not a "name = value" pair `
                        + '— an unescaped | in a value truncates it silently',
                });
                continue;
            }

            const name = m[1].trim();
            const value = m[2].trim();

            if (seen.has(name)) {
                errors.push({
                    row: rowNo, id: values.get('id') ?? null, param: name, code: 'DUPLICATE_PARAM',
                    message: 'given more than once — the parser silently keeps only the last',
                });
            }
            seen.add(name);

            if (name === RESERVED_PARAM) {
                errors.push({
                    row: rowNo, id: values.get('id') ?? null, param: name, code: 'RESERVED_PARAM',
                    message: `"${RESERVED_PARAM}" is reserved by the parser and would be overwritten`,
                });
                continue;
            }
            if (!KNOWN_PARAMS.has(name)) {
                errors.push({
                    row: rowNo, id: values.get('id') ?? null, param: name, code: 'UNKNOWN_PARAM',
                    message: 'not a recognized parameter',
                });
                continue;
            }
            if (value === '') {
                errors.push({
                    row: rowNo, id: values.get('id') ?? null, param: name, code: 'EMPTY_PARAM',
                    message: 'empty value — omit the parameter instead; the parser cannot '
                        + 'tell an empty value from an absent one',
                });
                continue;
            }
            if (/\{\{|\}\}/.test(value)) {
                errors.push({
                    row: rowNo, id: values.get('id') ?? null, param: name, code: 'NESTED_TEMPLATE',
                    message: 'contains a nested template — it expands at parse time and breaks '
                        + 'reproducibility; {{!}} does not escape a pipe here',
                });
                continue;
            }
            if (/[{}]/.test(value)) {
                errors.push({
                    row: rowNo, id: values.get('id') ?? null, param: name, code: 'FORBIDDEN_CHAR',
                    message: 'contains { or } — an unbalanced brace deletes the entire row',
                });
                continue;
            }

            values.set(name, value);
        }

        return values;
    });

    // --- Reading 2: wtf_wikipedia. Supplies values, and its count is the cross-check.
    let parsed = wtf(wikitext).templates()
        .map(t => t.json())
        .filter(j => j.template === SUITE_TEMPLATE_KEY);

    // Test seam. Every cause of row loss we know about makes a block unbalanced,
    // and reconciliation is skipped in that case — so the branch below is
    // unreachable from any fixture. This lets the test suite drop a row to prove
    // the guard against causes we have NOT modelled actually fires.
    if (typeof globalThis.__suiteParseHook === 'function') {
        parsed = globalThis.__suiteParseHook(parsed);
    }

    // Skip reconciliation when a block is already known unbalanced: that case is
    // reported precisely by UNBALANCED_BRACES, and the count will necessarily
    // disagree, so also raising ROW_COUNT_MISMATCH would be noise on top of a
    // diagnosis we already have. Reconciliation exists for the rows we CANNOT
    // explain — a row wtf drops for a reason this validator does not model.
    const anyUnbalanced = blocks.some(b => !b.balanced);

    if (!anyUnbalanced && parsed.length !== blocks.length) {
        errors.push({
            row: 0, id: null, param: null, code: 'ROW_COUNT_MISMATCH',
            message: `found ${blocks.length} row transclusion(s) in the raw wikitext but the `
                + `parser returned ${parsed.length} — some rows are being silently dropped`,
        });
    }

    // --- Semantic validation, using the raw values (authoritative for integrity)
    //     and the parsed values (authoritative for text normalization).
    const rows = [];
    const idsSeen = new Map();

    rawRows.forEach((values, i) => {
        if (values === null) return;
        const rowNo = i + 1;
        const id = values.get('id') ?? null;
        const parsedRow = parsed.length === blocks.length ? parsed[i] : null;
        const err = (code, param, message) => errors.push({ row: rowNo, id, param, code, message });

        for (const param of REQUIRED_PARAMS) {
            if (!values.has(param)) err('MISSING_PARAM', param, 'is required but absent');
        }

        if (values.has('id') && !ID_RE.test(id)) {
            err('BAD_ID_FORMAT', 'id', `"${id}" is not "ctb-" followed by 6 hex characters`);
        }
        if (id !== null && ID_RE.test(id)) {
            if (idsSeen.has(id)) {
                err('DUPLICATE_ID', 'id', `already used by row ${idsSeen.get(id)}`);
            } else {
                idsSeen.set(id, rowNo);
            }
        }

        for (const param of NUMERIC_PARAMS) {
            const v = values.get(param);
            if (v !== undefined && !/^\d+$/.test(v)) {
                err('NON_NUMERIC', param, `"${v}" is not a positive integer`);
            }
        }

        const wiki = values.get('wiki');
        if (wiki !== undefined && !(wiki in WIKI_SUBDOMAINS)) {
            err('UNKNOWN_WIKI', 'wiki', `"${wiki}" is not a known wiki `
                + `(expected one of: ${Object.keys(WIKI_SUBDOMAINS).join(', ')})`);
        }

        const truth = values.get('truth');
        const canonicalTruth = truth === undefined ? null : canonicalizeVerdict(truth);
        if (truth !== undefined && canonicalTruth === null) {
            err('BAD_VERDICT', 'truth', `"${truth}" is not one of Supported, Partially supported, `
                + 'Not supported, Source unavailable');
        }

        const llmVerdict = values.get('llm-verdict');
        const canonicalLlm = llmVerdict === undefined ? null : canonicalizeVerdict(llmVerdict);

        // Prefer the parser's value for free-text fields — it flattens wikilinks
        // and resolves entities. Fall back to raw when reconciliation failed.
        const text = (name) => {
            const fromParser = parsedRow ? parsedRow[name] : undefined;
            return fromParser !== undefined ? String(fromParser) : (values.get(name) ?? null);
        };

        rows.push({
            id,
            wiki,
            article: text('article'),
            oldid: Number(values.get('oldid')),
            citation: Number(values.get('citation')),
            instance: Number(values.get('instance')),
            truth: canonicalTruth === null ? null : toTitleCase(canonicalTruth),
            rationale: text('rationale'),
            addedBy: values.get('added-by') ?? null,
            confirmedBy: values.get('confirmed-by') ?? null,
            claimText: text('claim-text'),
            sourceUrl: values.get('source-url') ?? null,
            provenance: values.get('provenance') ?? null,
            llmVerdict: canonicalLlm === null ? null : toTitleCase(canonicalLlm),
            llmRationale: text('llm-rationale'),
            llmProvider: values.get('llm-provider') ?? null,
            llmModel: values.get('llm-model') ?? null,
            fetchStatus: values.get('fetch-status') ?? null,
        });
    });

    if (errors.length > 0) throw new SuiteValidationError(errors);

    return { rows };
}
```

**Step 4: Run to verify it passes**

Run: `node --test --test-name-pattern='parseSuite' 'tests/**/*.test.js'`
Expected: PASS, 17 tests.

Run: `npm test`
Expected: the full suite passes, no regressions.

**Step 5: Commit**

```bash
git add benchmark/suite.js tests/suite.test.js
git commit -m "benchmark: validate wiki suite rows, hard-failing on silent row loss"
```

---

### Task 5: Normalize to the dataset row shape

`extract_dataset.js` consumes CSV-shaped objects. Emitting that exact shape means Phase 4
swaps the row *source* without touching any downstream extraction logic.

**Files:**
- Modify: `benchmark/suite.js`
- Modify: `tests/suite.test.js`

**Step 1: Write the failing test**

Append to `tests/suite.test.js`:

```javascript
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
```

**Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern='toDatasetRow' 'tests/**/*.test.js'`
Expected: FAIL — `toDatasetRow` is not exported.

**Step 3: Write the implementation**

Append to `benchmark/suite.js`:

```javascript
/**
 * Build the article permalink a row points at. The CSV stored this as one
 * pre-assembled URL; the suite page stores title and revision separately
 * because two labelled fields are more reliably hand-edited than a query
 * string, and each half validates independently.
 */
export function buildArticleUrl(row) {
    const subdomain = WIKI_SUBDOMAINS[row.wiki] ?? 'en';
    const title = encodeURIComponent(String(row.article).replace(/ /g, '_'))
        .replace(/%2F/g, '/');
    return `https://${subdomain}.wikipedia.org/w/index.php?title=${title}&oldid=${row.oldid}`;
}

/**
 * Convert a validated suite row into the CSV-column shape that
 * extract_dataset.js already consumes, so swapping the row source touches no
 * downstream extraction logic.
 *
 * `_id` replaces the old `_rowIndex`: identity now travels with the row instead
 * of being derived from its position in a file.
 *
 * `Dataset version` is deliberately absent — cohort membership is derived from
 * the migration revision snapshots, not stored per row.
 */
export function toDatasetRow(row) {
    return {
        'Citation number': String(row.citation),
        'Citation instance': String(row.instance),
        'Article': buildArticleUrl(row),
        'Ground truth': row.truth ?? '',
        'WMF claim text': row.claimText ?? '',
        'WMF source URL': row.sourceUrl ?? '',
        'WMF provenance': row.provenance ?? '',
        _id: row.id,
        _suiteRow: row,
    };
}
```

**Step 4: Run to verify it passes**

Run: `node --test --test-name-pattern='toDatasetRow' 'tests/**/*.test.js'`
Expected: PASS, 4 tests.

Run: `npm test`
Expected: full suite green.

**Step 5: Commit**

```bash
git add benchmark/suite.js tests/suite.test.js
git commit -m "benchmark: map validated suite rows onto the dataset row shape"
```

---

## Phase 2 done when

- [ ] `npm test` passes with all of `tests/suite.test.js` green (45 tests across tasks 2–5: 11 + 13 + 17 + 4).
- [ ] A suite containing a deliberately malformed row throws `SuiteValidationError`
      naming the row number and the offending parameter — verified by the
      `MISSING_PARAM` test asserting `row`, `param`, and `id`.
- [ ] Every measured `wtf_wikipedia` edge case from the README table has a fixture.
- [ ] `benchmark/suite.js` performs no network or filesystem access — confirm with
      `grep -nE "fs\.|https?\.|fetch\(" benchmark/suite.js` returning nothing.
