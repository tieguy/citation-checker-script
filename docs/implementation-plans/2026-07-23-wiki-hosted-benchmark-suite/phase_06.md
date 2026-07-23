# Wiki-Hosted Benchmark Suite Implementation Plan — Phase 6

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Revision pins fully replace cohort tags. No `--version` code path remains in
any of the three scripts that independently implement it, and the frozen-snapshot
analyses still pass untouched.

**Architecture:** `--version` exists in three separate implementations
(`extract_dataset.js:54-57,340-345`, `run_benchmark.js:190-193,483-487`,
`analyze_results.js:41,286-296`) that each re-derive the same filter with the same
`|| 'v1'` fallback. All three go. `dataset_version` remains *populated* on each dataset
row for backwards compatibility with `results.json` and `historical-runs/` consumers,
but it is now **derived** by set-membership against the committed migration snapshots
rather than read from the row.

**Tech Stack:** No new dependencies.

**Scope:** Phase 6 of 7. Depends on Phase 5.

**Codebase verified:** 2026-07-23

---

### Task 1: Derive cohort membership from the migration snapshots

Before removing the filters, replace the thing they filtered on.

**Files:**
- Create: `benchmark/cohorts.js`
- Create: `tests/cohorts.test.js`

**Step 1: Write the failing test**

Create `tests/cohorts.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCohortIndex, cohortOf, COHORT_PINS } from '../benchmark/cohorts.js';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cohorts-'));

function writeSnapshot(dir, oldid, ids) {
    fs.writeFileSync(path.join(dir, `${oldid}.wikitext`), '');
    fs.writeFileSync(path.join(dir, `${oldid}.json`), JSON.stringify({
        metadata: { suite_oldid: oldid },
        rows: ids.map(id => ({ id })),
    }));
}

test('COHORT_PINS lists the cumulative migration pins in order', () => {
    assert.deepEqual(COHORT_PINS, [
        { pin: 'v1', cohort: 'v1' },
        { pin: 'v1+v2', cohort: 'v2' },
        { pin: 'all', cohort: 'v3' },
    ]);
});

test('cohortOf assigns each row to the FIRST revision that contained it', () => {
    const dir = tmpDir();
    try {
        writeSnapshot(dir, 100, ['a', 'b']);
        writeSnapshot(dir, 200, ['a', 'b', 'c']);
        writeSnapshot(dir, 300, ['a', 'b', 'c', 'd']);
        const index = buildCohortIndex({ v1: 100, 'v1+v2': 200, all: 300 }, dir);

        assert.equal(cohortOf('a', index), 'v1');
        assert.equal(cohortOf('b', index), 'v1');
        assert.equal(cohortOf('c', index), 'v2');
        assert.equal(cohortOf('d', index), 'v3');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('cohortOf returns null for a row added after migration', () => {
    // Rows contributed by editors after the migration belong to no historical
    // cohort. That is correct, not an error — the concept only ever described
    // the three import batches.
    const dir = tmpDir();
    try {
        writeSnapshot(dir, 100, ['a']);
        writeSnapshot(dir, 200, ['a']);
        writeSnapshot(dir, 300, ['a']);
        const index = buildCohortIndex({ v1: 100, 'v1+v2': 200, all: 300 }, dir);
        assert.equal(cohortOf('brand-new', index), null);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('buildCohortIndex returns an empty index when snapshots are absent', () => {
    const dir = tmpDir();
    try {
        assert.deepEqual(buildCohortIndex({}, dir), new Map());
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
```

**Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern='cohortOf|COHORT_PINS' 'tests/**/*.test.js'`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `benchmark/cohorts.js`:

```javascript
// Derive historical cohort membership from revision history.
//
// A row belongs to v1 if it existed by the first migration revision, to v2 if it
// first appeared in the second, and so on. This replaces the per-row
// `Dataset version` tag: the fact was always a property of when a row was
// imported, and revision history records that directly.
//
// `dataset_version` is still written onto dataset.json rows so existing
// consumers of results.json and historical-runs/ keep working; it is simply
// computed here instead of copied from the CSV.

import fs from 'node:fs';
import path from 'node:path';
import { SUITE_SNAPSHOT_DIR, loadPins, snapshotPaths } from './suite_fetch.js';

// Ordered oldest-first. Each entry names the pin whose revision FIRST contained
// the rows of that cohort. Cumulative, so membership is "first pin containing it".
export const COHORT_PINS = Object.freeze([
    { pin: 'v1', cohort: 'v1' },
    { pin: 'v1+v2', cohort: 'v2' },
    { pin: 'all', cohort: 'v3' },
]);

/**
 * @returns {Map<string, string>} row id -> cohort tag
 */
export function buildCohortIndex(pins = loadPins(), dir = SUITE_SNAPSHOT_DIR) {
    const index = new Map();

    for (const { pin, cohort } of COHORT_PINS) {
        const oldid = pins[pin];
        if (oldid === undefined) continue;

        const { jsonPath } = snapshotPaths(dir, oldid);
        if (!fs.existsSync(jsonPath)) continue;

        const stored = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        for (const row of stored.rows) {
            // First pin wins: a row present in v1 is v1, even though it is also
            // present in every later revision.
            if (!index.has(row.id)) index.set(row.id, cohort);
        }
    }

    return index;
}

/**
 * Cohort of a row, or null if it was added after the migration and therefore
 * belongs to no historical import batch.
 */
export function cohortOf(rowId, index) {
    return index.get(rowId) ?? null;
}
```

**Step 4: Run to verify it passes**

Run: `node --test --test-name-pattern='cohortOf|COHORT_PINS|buildCohortIndex' 'tests/**/*.test.js'`
Expected: PASS, 4 tests.

**Step 5: Commit**

```bash
git add benchmark/cohorts.js tests/cohorts.test.js
git commit -m "benchmark: derive cohort membership from migration revision snapshots"
```

---

### Task 2: Remove `--version` from `extract_dataset.js`

**Files:**
- Modify: `benchmark/extract_dataset.js`

**Step 1: Delete the flag**

Remove the `versionIndex` / `VERSION_FILTER` declaration added around lines 54-57
(three lines including the comment).

**Step 2: Delete the filter block**

Remove the entire `if (VERSION_FILTER !== 'all' && SUITE_REF === null) { ... }` block
(originally lines 340-345), **and** the `--version cannot be combined with
--suite-oldid` guard that Phase 4 Task 5 added immediately before it. Both are dead once
the flag is gone.

**Step 3: Require a suite source**

The CSV row source is retired. Replace the `if (SUITE_REF !== null) { ... } else { ... }`
block from Phase 4 Task 5 Step 3 with:

```javascript
    const suite = await loadSuite(SUITE_REF ?? 'latest', { offline: OFFLINE });
    const rows = suite.rows.map(toDatasetRow);
    console.log(`Loaded ${rows.length} rows from suite revision ${suite.oldid}`
        + `${suite.fromSnapshot ? ' (snapshot)' : ' (fetched)'}`);
    SUITE_METADATA = { suite_page: suite.metadata.suite_page, suite_oldid: suite.oldid };
```

Remove the now-unused `INPUT_CSV` constant (line 43), the `parseCSV` function
(lines 72-92) and `parseCSVLine` (lines 97 onwards). `benchmark/suite_parity.js` carries
its own copy of the CSV parsing for the deprecation-release comparison in Task 5.

Remove the `rowId()` helper's legacy fallback — every row now has `_id`:

```javascript
function rowId(row) {
    return row._id;
}
```

Leave `compareRowIds` in place; it still handles legacy ids appearing via `--rows`.

**Step 4: Populate `dataset_version` from the cohort index**

Add the import:

```javascript
import { buildCohortIndex, cohortOf } from './cohorts.js';
```

Build the index once, near where the suite is loaded:

```javascript
    const cohortIndex = buildCohortIndex();
```

At lines 441 and 498, replace both occurrences of:

```javascript
                        dataset_version: row['Dataset version'] || 'v1',
```

with:

```javascript
                        dataset_version: cohortOf(rowId(row), cohortIndex),
```

Rows added after migration get `null`, which is correct — they belong to no historical
import batch.

**Step 5: Remove the surviving `VERSION_FILTER` read in the metadata block**

Deleting the declaration is not enough. `VERSION_FILTER` is read a **second** time,
outside any filter block, at lines 517-520:

```javascript
    const datasetMetadata = {
        extracted_at: todayIso(),
        version_filter: VERSION_FILTER,
        ...(SUITE_METADATA ?? {}),
    };
```

Leaving it would throw `ReferenceError: VERSION_FILTER is not defined` on every run.
Replace the whole block with:

```javascript
    const datasetMetadata = {
        extracted_at: todayIso(),
        ...(SUITE_METADATA ?? {}),
    };
```

This drops `version_filter` from `dataset.json`'s metadata and replaces it with
`suite_page` + `suite_oldid`, which record the same provenance more precisely. That is a
metadata schema change: note it in the commit message.

**Step 6: Update the usage comment**

At lines 15-17, the usage string documents `--version` and the `row_<csv_line>` scheme.
Replace it with:

```javascript
 * Usage: node extract_dataset.js [--dry-run] [--limit N] [--suite-oldid REV|PIN] [--offline] [--rows ctb-a1b2c3,...]
 *
 * Rows come from the on-wiki benchmark suite at a pinned revision. --suite-oldid
 * accepts a numeric revision id or a name from suite-pins.json; it defaults to
 * the `latest` pin. --rows accepts content-hash ids and, via
 * row-id-aliases.json, the legacy row_<csv_line> ids stored in older artifacts.
```

**Step 7: Verify**

Run: `command grep -n 'VERSION_FILTER\|--version\|parseCSV\|INPUT_CSV' benchmark/extract_dataset.js`
Expected: no output. (Use `command grep` — the shell wrapper skips untracked files.)

Run: `cd benchmark && node extract_dataset.js --suite-oldid all --dry-run`
Expected: loads 189 rows from the snapshot, no network, no errors. A `ReferenceError`
here means a `VERSION_FILTER` read survived — the grep above should have caught it.

Run: `npm test`
Expected: green.

**Step 8: Commit**

```bash
git add benchmark/extract_dataset.js
git commit -m "benchmark: retire --version from extraction in favour of revision pins

Drops version_filter from dataset.json metadata, replaced by suite_page and
suite_oldid."
```

---

### Task 3: Remove `--version` from `run_benchmark.js` and `analyze_results.js`

**Files:**
- Modify: `benchmark/run_benchmark.js` (lines 190-193, 483-487)
- Modify: `benchmark/analyze_results.js` (line 41, lines 286-296)

**Step 1: `run_benchmark.js`**

Delete the `versionIndex` / `VERSION_FILTER` declaration at lines 190-193, and the
filter block at lines 483-487:

```javascript
    if (VERSION_FILTER !== 'all') {
        const before = entries.length;
        entries = entries.filter(e => (e.dataset_version || 'v1') === VERSION_FILTER);
        console.log(`Filtered to dataset version "${VERSION_FILTER}": ${entries.length}/${before} entries`);
    }
```

Then remove the **second, surviving read** at line 543, inside the run metadata block:

```javascript
        dataset_extracted_at: datasetMetadata.extracted_at || null,
        dataset_version_filter: VERSION_FILTER
```

becomes:

```javascript
        dataset_extracted_at: datasetMetadata.extracted_at || null,
        dataset_suite_oldid: datasetMetadata.suite_oldid ?? null,
```

`datasetMetadata` is already in scope there and now carries `suite_oldid`, so the run
records which pinned revision produced its dataset — strictly more useful than the filter
string it replaces.

Update the file's usage comment to drop `--version`.

**Step 2: `analyze_results.js`**

Delete the `VERSION_FILTER` declaration at line 41 and the filter block at lines 286-296.

Then remove the **second, surviving read** at line 314:

```javascript
        overview: {
            datasetVersion: VERSION_FILTER,
```

becomes:

```javascript
        overview: {
            datasetSuiteOldid: loadMetadata(DATASET_PATH).suite_oldid ?? null,
```

`loadMetadata` is already imported from `./io.js` in this file. If `DATASET_PATH` does
not exist — the snapshot scripts pass explicit `--dataset` paths, so it normally does —
guard it:

```javascript
            datasetSuiteOldid: fs.existsSync(DATASET_PATH)
                ? (loadMetadata(DATASET_PATH).suite_oldid ?? null)
                : null,
```

**Important:** do not remove anything else from that block's surroundings. The
`--results` / `--dataset` / `--analysis` path arguments must survive untouched — they are
what `analyze:v1-snapshot` and `analyze:v3-snapshot` depend on, and those scripts read
frozen files directly and never consulted the version filter.

**Step 3: Verify no version filter remains anywhere**

All three scripts read `VERSION_FILTER` a second time outside their filter blocks
(`extract_dataset.js:519`, `run_benchmark.js:543`, `analyze_results.js:314`). Deleting
only the declarations leaves a `ReferenceError` on every run, so verify by **executing**,
not just grepping.

Run: `command grep -rn 'VERSION_FILTER' benchmark/`
Expected: no output. (`command grep` — the shell wrapper skips untracked files.)

Run: `command grep -rn "'--version'" benchmark/`
Expected: no output.

Run: `cd benchmark && node run_benchmark.js --help 2>&1 | head -3`
Expected: usage text, no `ReferenceError`.

Run: `cd benchmark && npm run analyze`
Expected: completes, no `ReferenceError`.

**Step 4: Verify the frozen-snapshot analyses still pass untouched**

This is the phase's key regression check.

Run: `cd benchmark && npm run analyze:v1-snapshot`
Expected: completes and writes `analysis_v1_recomputed.json`, with the same metrics as
before this phase.

Run: `cd benchmark && npm run analyze:v3-snapshot`
Expected: completes and writes `analysis_v3_recomputed.json`.

Compare each against its committed counterpart. These files have top-level keys
`generated`, `overview` and `providers` — there is no `metrics` key, and `generated` is a
fresh timestamp on every run, so both must be handled or the check reports a false alarm
every time.

`overview.datasetVersion` is also expected to change: Step 2 replaced it with
`datasetSuiteOldid`. Compare `providers` (the actual metrics) exactly, and diff
`overview` with the two known-changed keys excluded:

```bash
cd benchmark
node -e "
const fs=require('fs');
for (const v of ['v1','v3']) {
  const a=JSON.parse(fs.readFileSync(\`analysis_\${v}.json\`));
  const b=JSON.parse(fs.readFileSync(\`analysis_\${v}_recomputed.json\`));
  const strip=o=>{const {datasetVersion,datasetSuiteOldid,...rest}=o.overview; return rest;};
  const providersMatch=JSON.stringify(a.providers)===JSON.stringify(b.providers);
  const overviewMatch=JSON.stringify(strip(a))===JSON.stringify(strip(b));
  console.log(v, 'providers identical:', providersMatch, '| overview identical:', overviewMatch);
  if(!providersMatch||!overviewMatch) process.exitCode=1;
}"
```

Expected: `providers identical: true | overview identical: true` for both. Anything else
means this phase changed a metric — inspect the diff before proceeding. The snapshot
analyses are meant to be completely insulated from this change.

**Step 5: Commit**

```bash
git add benchmark/run_benchmark.js benchmark/analyze_results.js
git commit -m "benchmark: retire --version from benchmarking and analysis"
```

---

### Task 4: Delete the vN npm scripts

**Files:**
- Modify: `benchmark/package.json:9-10,13-14,21,23`

**Step 1: Remove six scripts**

Delete these lines from the `scripts` block:

```json
    "extract:v1": "node extract_dataset.js --version v1",
    "extract:v3": "node extract_dataset.js --version v3",
    "benchmark:v1": "node run_benchmark.js --version v1",
    "benchmark:v3": "node run_benchmark.js --version v3",
    "analyze:v1": "node analyze_results.js --version v1",
    "analyze:v3": "node analyze_results.js --version v3",
```

**Step 2: Keep the two snapshot scripts exactly as they are**

```json
    "analyze:v1-snapshot": "node analyze_results.js --results results_v1.json --dataset dataset_v1.json --analysis analysis_v1_recomputed.json",
    "analyze:v3-snapshot": "node analyze_results.js --results results_v3.json --dataset dataset_v3.json --analysis analysis_v3_recomputed.json",
```

These read frozen files directly and never used the version filter.

**Step 3: Add pin-based replacements**

Add alongside `extract`:

```json
    "extract:v1-pin": "node extract_dataset.js --suite-oldid v1",
    "extract:all-pin": "node extract_dataset.js --suite-oldid all",
```

There are deliberately **no** `benchmark:*-pin` or `analyze:*-pin` equivalents. Cohort
selection now happens once, at extraction, by choosing which revision to pin;
benchmarking and analysis operate on whatever dataset extraction produced. Reintroducing
a filter downstream would recreate the three-independent-implementations problem this
phase removes.

**Step 4: Verify**

Run: `cd benchmark && npm run extract:v1-pin -- --dry-run`
Expected: loads 76 rows from the v1 pin snapshot.

Run: `cd benchmark && npm run analyze:v1-snapshot`
Expected: still succeeds.

**Step 5: Commit**

```bash
git add benchmark/package.json
git commit -m "benchmark: replace vN npm scripts with revision-pin equivalents"
```

---

### Task 5: Regenerate the CSV from the pinned suite for one deprecation release

The CSV stops being the source of truth but ships one more time, regenerated from the
wiki, so any external consumer has a release to migrate off.

**Files:**
- Create: `benchmark/suite_to_csv.js`
- Modify: `Benchmarking_data_Citations.csv`
- Create: `tests/suite_to_csv.test.js`

**Step 1: Write the failing test**

Create `tests/suite_to_csv.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowsToCsv, csvEscape } from '../benchmark/suite_to_csv.js';
import { parseSuite } from '../benchmark/suite.js';
import { csvRowsToWikitext } from '../benchmark/csv_to_suite.js';

const csvRow = (over = {}) => ({
    'Citation number': '1', 'Citation instance': '1',
    'Article': 'https://en.wikipedia.org/w/index.php?title=Example&oldid=1331476438',
    'Ground truth': 'Supported',
    'WMF claim text': '', 'WMF source URL': '', 'WMF provenance': '', ...over,
});

test('csvEscape quotes a value containing a comma', () => {
    assert.equal(csvEscape('a,b'), '"a,b"');
});

test('csvEscape doubles an embedded quote', () => {
    assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
});

test('csvEscape leaves a plain value unquoted', () => {
    assert.equal(csvEscape('Supported'), 'Supported');
});

test('rowsToCsv emits the historical 8-column header', () => {
    const { rows } = parseSuite(csvRowsToWikitext([csvRow()]));
    const header = rowsToCsv(rows, new Map()).split('\n')[0];
    assert.equal(header,
        'Citation number,Citation instance,Article,Ground truth,Dataset version,'
        + 'WMF claim text,WMF source URL,WMF provenance');
});

test('rowsToCsv round-trips a row back to its original CSV values', () => {
    const original = csvRow({ 'WMF claim text': 'A claim, with a comma' });
    const { rows } = parseSuite(csvRowsToWikitext([original]));
    const line = rowsToCsv(rows, new Map([[rows[0].id, 'v3']])).split('\n')[1];

    assert.match(line, /^1,1,https:\/\/en\.wikipedia\.org\/w\/index\.php\?title=Example&oldid=1331476438,Supported,v3,/);
    assert.match(line, /"A claim, with a comma"/);
});

test('rowsToCsv leaves Dataset version blank for a post-migration row', () => {
    const { rows } = parseSuite(csvRowsToWikitext([csvRow()]));
    const line = rowsToCsv(rows, new Map()).split('\n')[1];
    assert.match(line, /,Supported,,/);
});
```

**Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern='csvEscape|rowsToCsv' 'tests/**/*.test.js'`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `benchmark/suite_to_csv.js`:

```javascript
#!/usr/bin/env node
// Regenerate Benchmarking_data_Citations.csv from the pinned suite.
//
// The CSV is no longer the source of truth. It ships one more time, regenerated
// from the wiki, so any external consumer has a release to migrate off before it
// is removed. `Dataset version` is reconstructed from the migration snapshots
// rather than stored, and is blank for rows added after the migration.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArticleUrl } from './suite.js';
import { loadSuite } from './suite_fetch.js';
import { buildCohortIndex } from './cohorts.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_CSV = path.join(MODULE_DIR, '..', 'Benchmarking_data_Citations.csv');

export const CSV_HEADERS = Object.freeze([
    'Citation number', 'Citation instance', 'Article', 'Ground truth',
    'Dataset version', 'WMF claim text', 'WMF source URL', 'WMF provenance',
]);

export function csvEscape(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function rowsToCsv(rows, cohortIndex) {
    const lines = [CSV_HEADERS.join(',')];

    for (const row of rows) {
        lines.push([
            row.citation,
            row.instance,
            buildArticleUrl(row),
            row.truth ?? '',
            cohortIndex.get(row.id) ?? '',
            row.claimText ?? '',
            row.sourceUrl ?? '',
            row.provenance ?? '',
        ].map(csvEscape).join(','));
    }

    return lines.join('\n') + '\n';
}

async function main() {
    const ref = process.argv[2] ?? 'all';
    const suite = await loadSuite(ref);
    const csv = rowsToCsv(suite.rows, buildCohortIndex());

    fs.writeFileSync(OUT_CSV, csv, 'utf-8');
    console.log(`Wrote ${suite.rows.length} rows from suite revision ${suite.oldid} to ${OUT_CSV}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => { console.error(err.message); process.exit(1); });
}
```

**Step 4: Run to verify tests pass**

Run: `node --test --test-name-pattern='csvEscape|rowsToCsv' 'tests/**/*.test.js'`
Expected: PASS, 6 tests.

**Step 5: Regenerate the CSV and inspect the diff**

Run: `node benchmark/suite_to_csv.js all`
Expected: `Wrote 189 rows from suite revision <REV_ALL> to .../Benchmarking_data_Citations.csv`

Run: `git diff --stat Benchmarking_data_Citations.csv`

**Inspect the diff carefully before committing.** Expected differences are limited to:
quoting normalization, and values where `escapeParamValue` transformed a pipe to
`&#124;` during migration. Any change to a `Ground truth` value, a citation number, or
an article URL is a **defect** — stop and investigate rather than committing.

Run:
```bash
git diff Benchmarking_data_Citations.csv | grep -E '^[-+]' | grep -vE '^(\+\+\+|---)' | wc -l
```
Record the number of changed lines and report it.

**Step 6: Add the deprecation notice and script**

Add to `benchmark/package.json` scripts:

```json
    "csv:regenerate": "node suite_to_csv.js all",
```

Create `docs/deprecations/csv-source-of-truth.md`:

```markdown
# Deprecated: `Benchmarking_data_Citations.csv` as the dataset source of truth

**Deprecated:** 2026-07-23. **Removal:** the release after next.

The benchmark dataset's source of truth is now the on-wiki suite page,
`User:Alaexis/AI Source Verification/Benchmark`, pinned to a revision. The CSV is
regenerated from that page (`npm run csv:regenerate` in `benchmark/`) and ships
unchanged in shape for one release so external consumers can migrate.

## What replaces it

| Was | Now |
| --- | --- |
| Edit the CSV, open a PR | Edit the wiki page; no GitHub account needed |
| `--version v1` | `--suite-oldid v1` (a pinned revision) |
| `--version v1,v2` | `--suite-oldid v1+v2` |
| `row_<csv_line>` ids | `ctb-<hash>` content-hash ids |
| `Dataset version` column | Derived from revision history; see `benchmark/cohorts.js` |

Legacy `row_<csv_line>` ids remain resolvable through
`benchmark/row-id-aliases.json`, so `results.json` and `historical-runs/`
artifacts stay readable without being rewritten.
```

**Step 7: Commit**

```bash
git add Benchmarking_data_Citations.csv benchmark/suite_to_csv.js tests/suite_to_csv.test.js
git add benchmark/package.json docs/deprecations/csv-source-of-truth.md
git commit -m "benchmark: regenerate CSV from the pinned suite for one deprecation release"
```

---

### Task 6: Update the project documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `benchmark/README.md`

**Step 1: Replace the row_id fragility section in `CLAUDE.md`**

The section titled "Benchmark row_id fragility (read before reordering the CSV)"
documents a hazard that no longer exists. Replace it with:

```markdown
### Benchmark row ids are content hashes (resolved 2026-07-23)

Row ids are `ctb-` plus 6 hex characters, hashed over the identity fields
(`wiki`, `oldid`, `citation`, `instance`) in `benchmark/suite.js`. Inserting,
removing or reordering rows does not renumber anything, and correcting a
ground-truth label leaves the id untouched. This retires the `row_<csv_line>`
scheme, where a mid-file insert shifted every later id while `results.json` kept
the old ones — a misalignment that went undetected for two weeks in May 2026.

Legacy ids in `results.json` and `historical-runs/` resolve through
`benchmark/row-id-aliases.json`; `--rows` accepts either form.

Changing a row's `oldid` **does** change its id, because the revision is part of
row identity. Ingestion warns on a written-id/computed-hash mismatch rather than
overwriting, so re-pinning a row surfaces as identity drift instead of silently
detaching it from its history.
```

**Step 2: Update the benchmark commands block in `CLAUDE.md`**

Replace the `extract:v1` / `benchmark:v1` / `analyze:v1` / `extract:v3` / `benchmark:v3` /
`analyze:v3` lines with:

```sh
npm run extract              # Extract from the `latest` suite pin
npm run extract:v1-pin       # Extract the v1 cohort (suite revision pinned at migration edit 1)
npm run extract:all-pin      # Extract all 189 migrated rows
npm run csv:regenerate       # Regenerate the deprecated CSV from the pinned suite
npm run analyze:v1-snapshot  # Unchanged — re-derives analysis from frozen v1 files
npm run analyze:v3-snapshot  # Unchanged — re-derives analysis from frozen v3 files
```

**Step 3: Update `benchmark/README.md`**

Two things in this file go stale. Locate and update:

1. Any description of `Benchmarking_data_Citations.csv` as the dataset's source of
   truth — replace with the suite page, linking `docs/deprecations/csv-source-of-truth.md`.
2. The "Reproducibility metadata" section, which documents the `{metadata, rows}`
   envelope. Add the two new fields:

```markdown
| `suite_page` | Title of the on-wiki page the rows came from. |
| `suite_oldid` | Revision of that page the run was pinned to. Replaces `version_filter`. |
```

If the file does not in fact mention either, make no change and drop it from the commit
below rather than inventing an edit.

**Step 4: Refresh the "Last verified" date**

Set the `Last verified:` line at the top of `CLAUDE.md` (the repo-level one, in this
worktree) to the current date.

**Note on the workspace-level `CLAUDE.md`.** The workspace file one directory up —
`alex-cite-checker/CLAUDE.md` — carries a section "Upstream dataset versioning
architecture (#140 + #155)" that this phase makes obsolete. **That file is outside this
git repository** and cannot be committed here. Flag it for the maintainer to update
separately, with suggested text:

```markdown
> **Superseded 2026-07-23** by the wiki-hosted benchmark suite. The CSV is
> regenerated from the on-wiki page for one deprecation release; `--version` is
> gone, replaced by `--suite-oldid` revision pins. See
> `citation-checker-script/docs/design-plans/2026-07-23-wiki-hosted-benchmark-suite.md`.
> The section below describes the historical arrangement.
```

**Step 5: Commit**

```bash
git add CLAUDE.md benchmark/README.md
git commit -m "docs: describe revision-pinned benchmark suite and content-hash row ids"
```

---

## Phase 6 done when

- [ ] `command grep -rn 'VERSION_FILTER' benchmark/` returns nothing.
- [ ] `command grep -rn "'--version'" benchmark/` returns nothing.
- [ ] All three scripts **run** without a `ReferenceError` — the second, non-obvious
      `VERSION_FILTER` read in each metadata block is gone (`extract_dataset.js:519`,
      `run_benchmark.js:543`, `analyze_results.js:314`).
- [ ] The metadata schema change is recorded: `version_filter` →
      `suite_page` + `suite_oldid`, `dataset_version_filter` → `dataset_suite_oldid`,
      `overview.datasetVersion` → `overview.datasetSuiteOldid`.
- [ ] The six `*:v1` / `*:v3` npm scripts are gone; `analyze:v1-snapshot` and
      `analyze:v3-snapshot` are byte-identical to their pre-phase definitions and
      still pass, producing metrics identical to the committed `analysis_v*.json`.
- [ ] `npm test` passes from the repo root.
- [ ] The regenerated CSV's diff contains no change to any ground truth, citation
      number, or article URL — verified by inspection, with the changed-line count
      reported.
- [ ] `CLAUDE.md` no longer instructs readers to guard against CSV reorder drift.
