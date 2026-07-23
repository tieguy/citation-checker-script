# Wiki-Hosted Benchmark Suite Implementation Plan — Phase 5

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Move all 189 existing rows on-wiki in three sequential edits, so each historical
batch boundary becomes a revision, then pin and freeze those three revisions.

**Architecture:** Cohort membership stops being a per-row tag and becomes a fact about
revision history — a row belongs to `v1` if it existed by revision X. Because revisions
are cumulative, the three pins express `v1`, `v1+v2`, and `v1+v2+v3`, which is exactly
the set of subsets that were ever used. `v3`-in-isolation is not expressible and was
confirmed out of scope.

**Tech Stack:** The Phase 4 generator (`benchmark/csv_to_suite.js`) produces the bytes;
publishing is manual.

**Scope:** Phase 5 of 7. Depends on Phase 4.

**Codebase verified:** 2026-07-23

---

## Human-gated phase

Tasks 1 and 2 are `[AGENT]`. Tasks 3–5 are `[HUMAN]` — three saved edits to
en.wikipedia under the maintainer's account, with revision IDs reported back. Task 6 is
`[AGENT]` again and needs those three IDs as input.

An agent executing this plan must **stop after Task 2** and hand the generated files to
the maintainer.

---

### Task 1: Emit the three migration batches `[AGENT]`

**Files:**
- Create: `benchmark/emit_migration_batches.js`
- Create: `tests/emit_migration_batches.test.js`

**Step 1: Write the failing test**

Create `tests/emit_migration_batches.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitIntoBatches, buildPageWikitext } from '../benchmark/emit_migration_batches.js';
import { loadCsvRows } from '../benchmark/suite_parity.js';
import { parseSuite } from '../benchmark/suite.js';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CSV = path.join(REPO, 'Benchmarking_data_Citations.csv');

test('splitIntoBatches partitions the CSV into the three historical cohorts', () => {
    const batches = splitIntoBatches(loadCsvRows(CSV));
    assert.equal(batches.v1.length, 76);
    assert.equal(batches.v2.length, 34);
    assert.equal(batches.v3.length, 79);
    assert.equal(batches.v1.length + batches.v2.length + batches.v3.length, 189);
});

test('splitIntoBatches treats an untagged row as v1, matching the pipeline default', () => {
    const rows = [{ 'Dataset version': '', _rowIndex: 2 }, { 'Dataset version': 'v2', _rowIndex: 3 }];
    const batches = splitIntoBatches(rows);
    assert.equal(batches.v1.length, 1);
    assert.equal(batches.v2.length, 1);
});

test('splitIntoBatches rejects an unrecognized cohort tag rather than dropping the row', () => {
    assert.throws(
        () => splitIntoBatches([{ 'Dataset version': 'v9', _rowIndex: 5 }]),
        /v9/,
    );
});

test('buildPageWikitext produces a page whose rows all parse and validate', () => {
    const batches = splitIntoBatches(loadCsvRows(CSV));
    const page = buildPageWikitext(batches.v1);
    const { rows } = parseSuite(page);
    assert.equal(rows.length, 76);
});

test('buildPageWikitext is cumulative-ready: the full page holds all 189 rows', () => {
    const b = splitIntoBatches(loadCsvRows(CSV));
    const page = buildPageWikitext([...b.v1, ...b.v2, ...b.v3]);
    assert.equal(parseSuite(page).rows.length, 189);
});

test('buildPageWikitext keeps the header and closes the table exactly once', () => {
    const page = buildPageWikitext(splitIntoBatches(loadCsvRows(CSV)).v1);
    assert.equal((page.match(/^\{\| class="wikitable sortable"$/gm) || []).length, 1);
    assert.equal((page.match(/^\|\}$/gm) || []).length, 1);
    assert.match(page, /== About this page ==/);
});
```

**Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern='splitIntoBatches' 'tests/**/*.test.js'`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `benchmark/emit_migration_batches.js`:

```javascript
#!/usr/bin/env node
// Emit the three migration batches as paste-ready wikitext.
//
// The page is built in three successive edits — v1's rows, then v2's, then v3's —
// so each historical batch boundary becomes a revision. `--version v1` then
// becomes `--suite-oldid <revision after edit 1>`, and cohort membership is a
// fact about page history rather than a tag stored on every row.
//
// Revisions are cumulative, so this expresses v1, v1+v2 and v1+v2+v3 — but not
// v3 alone. Confirmed not needed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvRowsToWikitext } from './csv_to_suite.js';
import { loadCsvRows } from './suite_parity.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV = path.join(MODULE_DIR, '..', 'Benchmarking_data_Citations.csv');
const HEADER_PATH = path.join(MODULE_DIR, 'wiki', 'Benchmark.wikitext');
const OUT_DIR = path.join(MODULE_DIR, 'wiki', 'migration');

export const BATCH_ORDER = Object.freeze(['v1', 'v2', 'v3']);

export function splitIntoBatches(csvRows) {
    const batches = { v1: [], v2: [], v3: [] };

    for (const row of csvRows) {
        // Untagged rows default to v1, matching the `|| 'v1'` fallback that
        // extract_dataset.js, run_benchmark.js and analyze_results.js all use.
        const version = (row['Dataset version'] || 'v1').trim();
        if (!(version in batches)) {
            throw new Error(
                `CSV line ${row._rowIndex}: unrecognized dataset version "${version}" `
                + `(expected one of ${BATCH_ORDER.join(', ')})`);
        }
        batches[version].push(row);
    }

    return batches;
}

/**
 * Wrap rendered rows in the suite page's header and table, reusing the committed
 * header verbatim so the page's prose has exactly one source of truth.
 */
export function buildPageWikitext(csvRows, headerPath = HEADER_PATH) {
    const template = fs.readFileSync(headerPath, 'utf-8');
    const closeIndex = template.lastIndexOf('\n|}');

    if (closeIndex === -1) {
        throw new Error(`${headerPath} does not end its wikitable with "|}"`);
    }

    return template.slice(0, closeIndex)
        + '\n' + csvRowsToWikitext(csvRows)
        + template.slice(closeIndex);
}

function main() {
    const csvPath = process.argv[2] ?? DEFAULT_CSV;
    const batches = splitIntoBatches(loadCsvRows(csvPath));

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const cumulative = [];

    for (const version of BATCH_ORDER) {
        cumulative.push(...batches[version]);
        const label = BATCH_ORDER.slice(0, BATCH_ORDER.indexOf(version) + 1).join('+');
        const outPath = path.join(OUT_DIR, `edit-${BATCH_ORDER.indexOf(version) + 1}-${label}.wikitext`);
        fs.writeFileSync(outPath, buildPageWikitext(cumulative), 'utf-8');
        console.log(`edit ${BATCH_ORDER.indexOf(version) + 1} (${label}): `
            + `${batches[version].length} new, ${cumulative.length} total -> ${outPath}`);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
```

**Step 4: Generate the batches**

Run: `node benchmark/emit_migration_batches.js`

Expected:
```
edit 1 (v1): 76 new, 76 total -> .../benchmark/wiki/migration/edit-1-v1.wikitext
edit 2 (v1+v2): 34 new, 110 total -> .../benchmark/wiki/migration/edit-2-v1+v2.wikitext
edit 3 (v1+v2+v3): 79 new, 189 total -> .../benchmark/wiki/migration/edit-3-v1+v2+v3.wikitext
```

**Step 5: Run to verify tests pass**

Run: `node --test --test-name-pattern='splitIntoBatches|buildPageWikitext' 'tests/**/*.test.js'`
Expected: PASS, 6 tests.

**Step 6: Commit**

```bash
git add benchmark/emit_migration_batches.js tests/emit_migration_batches.test.js
git add benchmark/wiki/migration/edit-1-v1.wikitext
git add benchmark/wiki/migration/edit-2-v1+v2.wikitext
git add "benchmark/wiki/migration/edit-3-v1+v2+v3.wikitext"
git commit -m "benchmark: emit the three migration batches as paste-ready wikitext"
```

Committing the generated wikitext is deliberate: it is the exact text published on-wiki,
and having it in-tree makes the migration reviewable in a PR and re-runnable.

---

### Task 2: Pre-flight validation of every batch `[AGENT]`

Catch problems before anything reaches the wiki, where fixing them costs a revision.

**Files:** none modified.

**Step 1: Validate each generated file parses to the expected row count**

Run:
```bash
node -e "
const fs=require('fs');
import('./benchmark/suite.js').then(({parseSuite})=>{
  const cases=[['benchmark/wiki/migration/edit-1-v1.wikitext',76],
               ['benchmark/wiki/migration/edit-2-v1+v2.wikitext',110],
               ['benchmark/wiki/migration/edit-3-v1+v2+v3.wikitext',189]];
  for(const [f,expected] of cases){
    const {rows}=parseSuite(fs.readFileSync(f,'utf8'));
    console.log(f, rows.length, rows.length===expected?'OK':'MISMATCH expected '+expected);
    if(rows.length!==expected) process.exitCode=1;
  }
});"
```

Expected: three `OK` lines, exit 0. A `MISMATCH` or a thrown
`SuiteValidationError` must be fixed in the CSV or the generator before publishing.

**Step 2: Confirm each batch is a strict prefix-extension of the previous**

The cumulative property is what makes revision pinning work as a cohort filter.

Run:
```bash
node -e "
const fs=require('fs');
import('./benchmark/suite.js').then(({parseSuite})=>{
  const ids=f=>parseSuite(fs.readFileSync(f,'utf8')).rows.map(r=>r.id);
  const a=ids('benchmark/wiki/migration/edit-1-v1.wikitext');
  const b=ids('benchmark/wiki/migration/edit-2-v1+v2.wikitext');
  const c=ids('benchmark/wiki/migration/edit-3-v1+v2+v3.wikitext');
  const prefix=(s,l)=>s.every((v,i)=>l[i]===v);
  console.log('v1 is a prefix of v1+v2:', prefix(a,b));
  console.log('v1+v2 is a prefix of all:', prefix(b,c));
  console.log('all ids unique:', new Set(c).size===c.length);
  if(!prefix(a,b)||!prefix(b,c)||new Set(c).size!==c.length) process.exitCode=1;
});"
```

Expected: three `true` lines, exit 0.

**Step 3: Record the expected row sets for Task 6**

Run:
```bash
cd benchmark && node extract_dataset.js --version v1 --dry-run 2>&1 | tail -5
```
Expected: reports 76 rows. Record the count; Task 6 compares against it.

---

### Task 3: Publish edit 1 — the v1 rows `[HUMAN]`

**Step 1:** Open `https://en.wikipedia.org/w/index.php?title=User:Alaexis/AI_Source_Verification/Benchmark&action=edit`

**Step 2:** Select all existing content and replace it with the entire contents of
`benchmark/wiki/migration/edit-1-v1.wikitext`. This removes the Phase 1 sample rows,
which is intended.

**Step 3:** Save with summary:
`Import benchmark suite: 76 original (v1) rows`

**Step 4:** Confirm the page is **not** listed at
`https://en.wikipedia.org/wiki/Category:AI_Source_Verification_benchmark_rows_with_errors`.
If it is, a row is missing a required parameter — stop, report which, and fix the
generator rather than hand-editing the page.

**Step 5:** Record the revision ID: open the page's history, click the top entry, and
take the `oldid=` value from the URL. Call it `REV_V1`.

---

### Task 4: Publish edit 2 — add the v2 rows `[HUMAN]`

**Step 1:** Open the same edit URL.

**Step 2:** Replace all content with `benchmark/wiki/migration/edit-2-v1+v2.wikitext`.

**Step 3:** Save with summary:
`Import benchmark suite: add 34 rows from the second labelling batch (110 total)`

**Step 4:** Confirm the page is still absent from the error tracking category.

**Step 5:** Record the revision ID as `REV_V1V2`.

---

### Task 5: Publish edit 3 — add the v3 rows `[HUMAN]`

**Step 1:** Open the same edit URL.

**Step 2:** Replace all content with `benchmark/wiki/migration/edit-3-v1+v2+v3.wikitext`.

**Step 3:** Save with summary:
`Import benchmark suite: add 79 externally-imported rows (189 total)`

**Step 4:** Confirm the page is still absent from the error tracking category, and that
the rendered table shows 189 rows.

**Step 5:** Record the revision ID as `REV_ALL`.

**Step 6:** Report all three IDs (`REV_V1`, `REV_V1V2`, `REV_ALL`) back for Task 6.

---

### Task 6: Pin, freeze and verify the three revisions `[AGENT]`

**Files:**
- Modify: `benchmark/suite-pins.json`
- Create: `benchmark/suites/<REV_V1>.wikitext`, `<REV_V1>.json` (and the same for the other two)

**Step 1: Write the pins**

Replace the contents of `benchmark/suite-pins.json`, substituting the three real IDs:

```json
{
  "_comment": "Named pins for benchmark suite revisions. A pin is an immutable revision id of the suite page; advancing one is a deliberate act with a reviewable diff. The three migration pins replace the old --version v1/v2/v3 filters: revisions are cumulative, so v1 and v1+v2 are expressible but v3-in-isolation is not.",
  "pins": {
    "v1": REV_V1,
    "v1+v2": REV_V1V2,
    "all": REV_ALL,
    "latest": REV_ALL
  }
}
```

`latest` starts equal to `all` and is the pin that moves as contributors add rows;
`v1`, `v1+v2` and `all` are historical and must never be changed.

**Step 2: Fetch and freeze all three revisions**

Run:
```bash
node -e "
import('./benchmark/suite_fetch.js').then(async m => {
  for (const pin of ['v1','v1+v2','all']) {
    const r = await m.loadSuite(pin);
    console.log(pin, '-> oldid', r.oldid, 'rows', r.rows.length, r.fromSnapshot ? '(snapshot)' : '(fetched)');
  }
});"
```

Expected:
```
v1 -> oldid <REV_V1> rows 76 (fetched)
v1+v2 -> oldid <REV_V1V2> rows 110 (fetched)
all -> oldid <REV_ALL> rows 189 (fetched)
```

Any `SuiteValidationError` here means a published row is malformed — fix on-wiki, take a
new revision id, and update the pin.

**Step 3: Verify offline reproduction**

Run the same command again:
Expected: identical row counts, each marked `(snapshot)`, with no network access.

**Step 4: Verify the pins reproduce the historical cohorts**

This is the phase's headline check.

Run:
```bash
node -e "
Promise.all([import('./benchmark/suite_fetch.js'), import('./benchmark/suite_parity.js'),
             import('./benchmark/generate_row_aliases.js')]).then(async ([f, p, a]) => {
  const csv = p.loadCsvRows('./Benchmarking_data_Citations.csv');
  const aliases = a.buildAliasMap(csv);
  const expected = (versions) => new Set(csv
    .filter(r => versions.includes((r['Dataset version'] || 'v1').trim()))
    .map(r => aliases['row_' + r._rowIndex]));

  for (const [pin, versions] of [['v1', ['v1']], ['v1+v2', ['v1','v2']], ['all', ['v1','v2','v3']]]) {
    const got = new Set((await f.loadSuite(pin)).rows.map(r => r.id));
    const want = expected(versions);
    const missing = [...want].filter(id => !got.has(id));
    const extra = [...got].filter(id => !want.has(id));
    console.log(pin, 'size', got.size, 'expected', want.size,
                'missing', missing.length, 'extra', extra.length,
                (missing.length === 0 && extra.length === 0) ? 'MATCH' : 'DIFFER');
    if (missing.length || extra.length) process.exitCode = 1;
  }
});"
```

Expected:
```
v1 size 76 expected 76 missing 0 extra 0 MATCH
v1+v2 size 110 expected 110 missing 0 extra 0 MATCH
all size 189 expected 189 missing 0 extra 0 MATCH
```

**Step 5: Regenerate `dataset.json` from the full pin and compare**

Run: `cd benchmark && node extract_dataset.js --suite-oldid all --dry-run`
Expected: reports 189 rows loaded from the suite revision, no validation errors.

Do **not** commit a regenerated `dataset.json` in this phase — regenerating it re-fetches
every source and would mix live-source drift into a migration commit. Phase 6 handles the
dataset regeneration as its own reviewable step.

**Step 6: Commit**

```bash
git add benchmark/suite-pins.json
git add benchmark/suites/<REV_V1>.wikitext benchmark/suites/<REV_V1>.json
git add "benchmark/suites/<REV_V1V2>.wikitext" "benchmark/suites/<REV_V1V2>.json"
git add benchmark/suites/<REV_ALL>.wikitext benchmark/suites/<REV_ALL>.json
git commit -m "benchmark: pin and freeze the three migration suite revisions"
```

Substitute the real revision IDs. Enumerate each file; do not `git add benchmark/suites/`.

---

## Phase 5 done when

- [ ] The suite page holds all 189 rows and is absent from the error tracking category.
- [ ] `benchmark/suite-pins.json` names `v1`, `v1+v2`, `all` and `latest`.
- [ ] All three revisions are frozen under `benchmark/suites/` and reproduce offline.
- [ ] `--suite-oldid v1` yields exactly the row set that `--version v1` yields (76),
      `v1+v2` yields the `v1,v2` set (110), and `all` yields 189 — verified by the
      set-difference check in Task 6 Step 4, reporting zero missing and zero extra.
