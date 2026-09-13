# Compare Results — Phase 1: Core comparison module

> **For Claude:** REQUIRED SUB-SKILL: Use `ed3d-plan-and-execute:executing-an-implementation-plan` to implement this plan task-by-task.

**Goal:** Create `benchmark/compare_results.js` that turns two `results.json` files plus a `dataset.json` into a structured `ComparisonResult` (per-cell direction classification, per-provider aggregates, flip list, coverage metadata). Includes a `filterComparison` helper for post-hoc subset slicing. End state: tested module, no I/O at the module surface, ready to be consumed by Phase 2 (renderers) and Phase 3 (CLI).

**Architecture:** Pure ESM module. No external dependencies — `node:test` + `node:assert/strict` for tests, manual fixture objects (no fs in tests). All logic operates on already-parsed JSON; loading happens at the CLI boundary in Phase 3. Mirrors the indexing pattern from `workbench/citoid-validation/compare.mjs` but trims out the HTML rendering (that goes to Phase 2) and the citoid-specific coverage table (that's a renderer-side hook for the citoid experiment, not core compare logic).

**Tech Stack:** Node.js built-in test runner. ESM imports with `.js` extensions. No transpilation.

**Branch context:** Feature branch from `integration-base` (which has #192 + #193 + #182 merged) or equivalently from `alex-o-748/main` once those three PRs have shipped. The compare module doesn't import any of their code — it only consumes `results.json` files that may contain panel/vote rows from #182's `compute_ensemble.js`.

**Scope:** Phase 1 of 4.

**Codebase verified:** 2026-05-06.

**Codebase verification findings:**
- ✓ `benchmark/io.js` exports `loadRows`, `loadMetadata`, `writeWithMetadata`, `todayIso` (lines 1–37). The compare module won't use these directly (kept pure); the CLI in Phase 3 will.
- ✓ `benchmark/analyze_results.js` exists as the single-result analyzer; the new module is its two-result sibling.
- ✓ `benchmark/compute_ensemble.js` is present in the integration-base branch state (came with PR #182). It synthesizes vote-N rows into a results file. The compare module doesn't import it but accepts `openrouter-vote-N` and `hf-vote-N` provider names in input rows.
- ✓ No existing `benchmark/compare_results.js`, `benchmark/render_compare.js`, or `cli/compare.js` — fresh ground.
- ✓ Test conventions (per `tests/providers.test.js`, `tests/benchmark_io.test.js`): `node:test` + `node:assert/strict`, flat `test()` calls, manual mock helpers, ESM imports with `.js` extensions. No nested `describe` blocks. Cleanup via `try/finally`.
- ✓ Source material at `workbench/citoid-validation/compare.mjs` (522 lines) and `workbench/citoid-validation/compare.test.mjs` (315 lines) — port the verdict-normalization helpers and the deterministic test fixture; the rest of citoid's compare.mjs is HTML rendering (Phase 2) and the citoid coverage table (out of scope; renderer-side hook in a follow-up).

---

## Task 1: Verdict normalization helpers

**Files:**
- Create: `benchmark/compare_results.js`
- Create: `tests/compare_results.test.js`

**Step 1: Write the failing test**

Create `tests/compare_results.test.js` with:

```js
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='normalizeVerdict|verdictsEqual'`
Expected: All three tests fail with `Cannot find package '../benchmark/compare_results.js'` or import errors.

**Step 3: Write minimal implementation**

Create `benchmark/compare_results.js` with:

```js
/**
 * Normalize a verdict string to its canonical short form.
 * Returns one of: 'support' | 'partial' | 'not' | 'unavailable' | <other-lowercased>.
 * Handles null/undefined and case/whitespace variations.
 */
export function normalizeVerdict(v) {
    const s = String(v ?? '').toLowerCase().trim();
    if (s.includes('partial')) return 'partial';
    if (s.includes('not support') || s.includes('not-support') || s.includes('not_support')) return 'not';
    if (s.includes('support')) return 'support';
    if (s.includes('unavailable')) return 'unavailable';
    return s;
}

export function verdictsEqualExact(a, b) {
    return normalizeVerdict(a) === normalizeVerdict(b);
}

function isSupportClass(v) {
    const n = normalizeVerdict(v);
    return n === 'support' || n === 'partial';
}

export function verdictsEqualBinary(a, b) {
    return isSupportClass(a) === isSupportClass(b);
}

/**
 * Lenient match: exact, plus Supported ↔ Partially supported as mutual near-misses.
 * Useful when the GT distinction between Supported and Partially supported is itself
 * fuzzy and a control→treatment shift between them shouldn't count as an error.
 */
export function verdictsEqualLenient(a, b) {
    const na = normalizeVerdict(a);
    const nb = normalizeVerdict(b);
    if (na === nb) return true;
    if ((na === 'support' && nb === 'partial') || (na === 'partial' && nb === 'support')) return true;
    return false;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='normalizeVerdict|verdictsEqual'`
Expected: All three tests pass.

**Step 5: Commit**

```bash
git add benchmark/compare_results.js tests/compare_results.test.js
git commit -m "benchmark: add verdict normalization + exact/binary/lenient equality helpers"
```

---

## Task 2: Cell indexing by (entry_id, provider) with error filtering

**Files:**
- Modify: `benchmark/compare_results.js` (add `indexCellsByPair` export)
- Modify: `tests/compare_results.test.js` (add tests)

**Step 1: Write the failing test**

Append to `tests/compare_results.test.js`:

```js
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='indexCellsByPair'`
Expected: Both tests fail with `indexCellsByPair is not a function`.

**Step 3: Write minimal implementation**

Append to `benchmark/compare_results.js`:

```js
/**
 * Index result rows by `${entry_id}:${provider}` key.
 * Drops rows where `error` is truthy or `predicted_verdict === 'ERROR'`
 * (treating either signal as "no successful prediction").
 *
 * @param {Array<Object>} rows
 * @returns {Map<string, Object>}
 */
export function indexCellsByPair(rows) {
    const out = new Map();
    for (const row of rows) {
        if (row.error) continue;
        if (row.predicted_verdict === 'ERROR') continue;
        const key = `${row.entry_id}:${row.provider}`;
        out.set(key, row);
    }
    return out;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='indexCellsByPair'`
Expected: Both tests pass.

**Step 5: Commit**

```bash
git add benchmark/compare_results.js tests/compare_results.test.js
git commit -m "benchmark: index result cells by (entry_id, provider), filter errored"
```

---

## Task 3: 5-way direction classifier

**Files:**
- Modify: `benchmark/compare_results.js` (add `classifyDirection` export)
- Modify: `tests/compare_results.test.js` (add tests)

**Step 1: Write the failing test**

Append to `tests/compare_results.test.js`:

```js
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='classifyDirection'`
Expected: All five tests fail with `classifyDirection is not a function`.

**Step 3: Write minimal implementation**

Append to `benchmark/compare_results.js`:

```js
/**
 * Classify a single (control, treatment, ground_truth) cell into one of:
 *   'improvement'         — control wrong, treatment correct
 *   'regression'          — control correct, treatment wrong
 *   'unchanged-correct'   — both correct
 *   'unchanged-wrong-same'— both wrong with the same (normalized) verdict
 *   'lateral'             — both wrong with different verdicts
 *
 * @param {{ controlVerdict: string, treatmentVerdict: string, groundTruth: string }} cell
 * @returns {'improvement'|'regression'|'unchanged-correct'|'unchanged-wrong-same'|'lateral'}
 */
export function classifyDirection({ controlVerdict, treatmentVerdict, groundTruth }) {
    const cCorrect = verdictsEqualExact(controlVerdict, groundTruth);
    const tCorrect = verdictsEqualExact(treatmentVerdict, groundTruth);
    if (!cCorrect && tCorrect) return 'improvement';
    if (cCorrect && !tCorrect) return 'regression';
    if (cCorrect && tCorrect) return 'unchanged-correct';
    if (normalizeVerdict(controlVerdict) === normalizeVerdict(treatmentVerdict)) {
        return 'unchanged-wrong-same';
    }
    return 'lateral';
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='classifyDirection'`
Expected: All five tests pass.

**Step 5: Commit**

```bash
git add benchmark/compare_results.js tests/compare_results.test.js
git commit -m "benchmark: 5-way direction classifier for control/treatment cells"
```

---

## Task 4: Per-provider aggregation

**Files:**
- Modify: `benchmark/compare_results.js` (add `computeProviderStats` export)
- Modify: `tests/compare_results.test.js` (add test)

**Step 1: Write the failing test**

Append to `tests/compare_results.test.js`:

```js
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
    // Binary: row 1, 2, 3, 4, 6 control correct (5); treatment 1, 2, 3, 6 correct (4).
    assert.equal(stats.binary.control, 5);
    assert.equal(stats.binary.treatment, 4);
    // Flip counts.
    assert.equal(stats.flips.improvement, 1);
    assert.equal(stats.flips.regression, 2);
    assert.equal(stats.flips.lateral, 1);
    assert.equal(stats.flips['unchanged-correct'], 2);
    assert.equal(stats.flips['unchanged-wrong-same'], 0);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='computeProviderStats'`
Expected: Fails with `computeProviderStats is not a function`.

**Step 3: Write minimal implementation**

Append to `benchmark/compare_results.js`:

```js
function pct(num, denom) {
    return denom > 0 ? (num / denom) * 100 : 0;
}

/**
 * Aggregate stats for a list of cells belonging to one provider.
 * Returns exact + lenient + binary accuracy for control and treatment, deltas,
 * and flip counts. Lenient treats Partially supported ↔ Supported as a near-miss.
 *
 * @param {Array<{direction: string, controlVerdict: string, treatmentVerdict: string, groundTruth: string}>} cells
 */
export function computeProviderStats(cells) {
    const n = cells.length;
    let cExact = 0, tExact = 0, cLenient = 0, tLenient = 0, cBinary = 0, tBinary = 0;
    const flips = {
        improvement: 0,
        regression: 0,
        lateral: 0,
        'unchanged-correct': 0,
        'unchanged-wrong-same': 0,
    };
    for (const cell of cells) {
        if (verdictsEqualExact(cell.controlVerdict, cell.groundTruth)) cExact++;
        if (verdictsEqualExact(cell.treatmentVerdict, cell.groundTruth)) tExact++;
        if (verdictsEqualLenient(cell.controlVerdict, cell.groundTruth)) cLenient++;
        if (verdictsEqualLenient(cell.treatmentVerdict, cell.groundTruth)) tLenient++;
        if (verdictsEqualBinary(cell.controlVerdict, cell.groundTruth)) cBinary++;
        if (verdictsEqualBinary(cell.treatmentVerdict, cell.groundTruth)) tBinary++;
        flips[cell.direction]++;
    }
    return {
        n,
        exact: {
            control: cExact,
            treatment: tExact,
            controlPct: pct(cExact, n),
            treatmentPct: pct(tExact, n),
            delta: pct(tExact, n) - pct(cExact, n),
        },
        lenient: {
            control: cLenient,
            treatment: tLenient,
            controlPct: pct(cLenient, n),
            treatmentPct: pct(tLenient, n),
            delta: pct(tLenient, n) - pct(cLenient, n),
        },
        binary: {
            control: cBinary,
            treatment: tBinary,
            controlPct: pct(cBinary, n),
            treatmentPct: pct(tBinary, n),
            delta: pct(tBinary, n) - pct(cBinary, n),
        },
        flips,
    };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='computeProviderStats'`
Expected: Passes.

**Step 5: Commit**

```bash
git add benchmark/compare_results.js tests/compare_results.test.js
git commit -m "benchmark: per-provider aggregation of accuracy and flip counts"
```

---

## Task 5: Top-level compareResults() function

**Files:**
- Modify: `benchmark/compare_results.js` (add `compareResults` export)
- Modify: `tests/compare_results.test.js` (add integration test)

**Step 1: Write the failing test**

Append to `tests/compare_results.test.js`. The fixture mirrors `workbench/citoid-validation/compare.test.mjs` (5 entries × 2 providers + 1 vote-3 row to validate panel-row handling):

```js
import { compareResults } from '../benchmark/compare_results.js';

const FIXTURE_DATASET = [
    { id: 'row_1', ground_truth: 'Supported', claim_text: 'C1', source_url: 'http://x/1', extraction_status: 'complete', needs_manual_review: false, dataset_version: 'v1' },
    { id: 'row_2', ground_truth: 'Partially supported', claim_text: 'C2', source_url: 'http://x/2', extraction_status: 'complete', needs_manual_review: false, dataset_version: 'v1' },
    { id: 'row_3', ground_truth: 'Not supported', claim_text: 'C3', source_url: 'http://x/3', extraction_status: 'complete', needs_manual_review: false, dataset_version: 'v2' },
    { id: 'row_4', ground_truth: 'Supported', claim_text: 'C4', source_url: 'http://x/4', extraction_status: 'complete', needs_manual_review: false, dataset_version: 'v2' },
    { id: 'row_5', ground_truth: 'Not supported', claim_text: 'C5', source_url: 'http://x/5', extraction_status: 'complete', needs_manual_review: false, dataset_version: 'v2' },
    { id: 'row_skip', ground_truth: 'Supported', claim_text: 'skip', source_url: 'http://x/s', extraction_status: 'complete', needs_manual_review: true, dataset_version: 'v1' },
];

const FIXTURE_CONTROL = {
    metadata: { run_at: '2026-05-01T10:00:00Z' },
    rows: [
        // mistral cells
        { entry_id: 'row_1', provider: 'mistral', predicted_verdict: 'Supported', error: null },
        { entry_id: 'row_2', provider: 'mistral', predicted_verdict: 'Supported', error: null },
        { entry_id: 'row_3', provider: 'mistral', predicted_verdict: 'Not supported', error: null },
        { entry_id: 'row_4', provider: 'mistral', predicted_verdict: 'Supported', error: null },
        { entry_id: 'row_5', provider: 'mistral', predicted_verdict: 'Supported', error: null },
        // granite cells
        { entry_id: 'row_1', provider: 'granite', predicted_verdict: 'Not supported', error: null },
        { entry_id: 'row_2', provider: 'granite', predicted_verdict: 'Not supported', error: null },
        { entry_id: 'row_3', provider: 'granite', predicted_verdict: 'Not supported', error: null },
        { entry_id: 'row_4', provider: 'granite', predicted_verdict: 'Partially supported', error: null },
        { entry_id: 'row_5', provider: 'granite', predicted_verdict: 'Partially supported', error: null },
        // a vote-3 panel cell (validates that synthesized panel rows compare like any other provider)
        { entry_id: 'row_1', provider: 'openrouter-vote-3', predicted_verdict: 'Supported', error: null },
        // an errored cell that must be filtered
        { entry_id: 'row_skip', provider: 'mistral', predicted_verdict: 'ERROR', error: 'rate limit' },
    ],
};

const FIXTURE_TREATMENT = {
    metadata: { run_at: '2026-05-02T10:00:00Z' },
    rows: [
        // mistral cells
        { entry_id: 'row_1', provider: 'mistral', predicted_verdict: 'Supported', error: null },           // unchanged-correct (GT Supported)
        { entry_id: 'row_2', provider: 'mistral', predicted_verdict: 'Partially supported', error: null }, // improvement (was Supported, now Partially supported, GT Partially supported)
        { entry_id: 'row_3', provider: 'mistral', predicted_verdict: 'Not supported', error: null },       // unchanged-correct (GT Not supported)
        { entry_id: 'row_4', provider: 'mistral', predicted_verdict: 'Supported', error: null },           // unchanged-correct (GT Supported)
        { entry_id: 'row_5', provider: 'mistral', predicted_verdict: 'Not supported', error: null },       // improvement (was Supported, now Not supported, GT Not supported)
        // granite cells
        { entry_id: 'row_1', provider: 'granite', predicted_verdict: 'Supported', error: null },           // improvement (was Not supported, GT Supported)
        { entry_id: 'row_2', provider: 'granite', predicted_verdict: 'Partially supported', error: null }, // improvement (was Not supported, GT Partially supported)
        { entry_id: 'row_3', provider: 'granite', predicted_verdict: 'Supported', error: null },           // regression (was Not supported, GT Not supported)
        { entry_id: 'row_4', provider: 'granite', predicted_verdict: 'Partially supported', error: null }, // unchanged-wrong-same (both Partially, GT Supported)
        { entry_id: 'row_5', provider: 'granite', predicted_verdict: 'Supported', error: null },           // lateral (control Partially, treatment Supported, GT Not supported)
        // panel cell
        { entry_id: 'row_1', provider: 'openrouter-vote-3', predicted_verdict: 'Supported', error: null }, // unchanged-correct
    ],
};

test('compareResults builds intersection cells, classifies, aggregates per provider', () => {
    const result = compareResults({
        control: FIXTURE_CONTROL,
        treatment: FIXTURE_TREATMENT,
        dataset: FIXTURE_DATASET,
        options: { changeAxes: ['prompt'], groundTruthVersion: 'fixture-v1' },
    });

    // Coverage: 5 valid dataset rows × 2 providers + 1 vote-3 row = 11 cells.
    // row_skip (needs_manual_review) drops out; errored cell drops out.
    assert.equal(result.coverage.datasetTotal, 6);
    assert.equal(result.coverage.datasetValid, 5);
    assert.equal(result.coverage.comparedCells, 11);

    // Metadata is recorded.
    assert.deepEqual(result.metadata.changeAxes, ['prompt']);
    assert.equal(result.metadata.groundTruthVersion, 'fixture-v1');
    assert.equal(result.metadata.controlRunAt, '2026-05-01T10:00:00Z');
    assert.equal(result.metadata.treatmentRunAt, '2026-05-02T10:00:00Z');

    // Per-provider aggregation: mistral has 5 cells, granite has 5, vote-3 has 1.
    assert.equal(result.perProvider.get('mistral').n, 5);
    assert.equal(result.perProvider.get('granite').n, 5);
    assert.equal(result.perProvider.get('openrouter-vote-3').n, 1);

    // mistral row_5: control Supported, treatment Not supported, GT Not supported → improvement
    const mistralRow5 = result.cells.find(c => c.entryId === 'row_5' && c.provider === 'mistral');
    assert.equal(mistralRow5.direction, 'improvement');

    // granite row_5: control Partially, treatment Supported, GT Not supported → both wrong, different → lateral
    const graniteRow5 = result.cells.find(c => c.entryId === 'row_5' && c.provider === 'granite');
    assert.equal(graniteRow5.direction, 'lateral');

    // Flips array contains only improvement/regression/lateral entries.
    for (const flip of result.flips) {
        assert.ok(['improvement', 'regression', 'lateral'].includes(flip.direction));
    }
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='compareResults builds'`
Expected: Fails with `compareResults is not a function`.

**Step 3: Write minimal implementation**

Append to `benchmark/compare_results.js`:

```js
/**
 * Compare two result sets. Returns a ComparisonResult with per-cell direction
 * classification, per-provider aggregates, a flips list, and coverage metadata.
 *
 * Cells are computed on the intersection of (entry_id, provider) keys present
 * in both runs — entries dropped by either side fall out. Dataset rows that
 * are not `extraction_status === 'complete' && !needs_manual_review` also drop
 * out (matching the runner's filter).
 *
 * @param {Object} args
 * @param {{rows: Array, metadata?: Object} | Array} args.control
 * @param {{rows: Array, metadata?: Object} | Array} args.treatment
 * @param {Array} args.dataset
 * @param {Object} [args.options]
 * @param {string[]} [args.options.changeAxes] — what differs between control and treatment
 * @param {string} [args.options.groundTruthVersion] — GT label, recorded in metadata
 */
export function compareResults({ control, treatment, dataset, options = {} }) {
    const datasetById = new Map(dataset.map(row => [row.id, row]));
    const validIds = new Set(
        dataset
            .filter(r => r.extraction_status === 'complete' && !r.needs_manual_review)
            .map(r => r.id)
    );

    const controlRows = Array.isArray(control) ? control : control.rows ?? [];
    const treatmentRows = Array.isArray(treatment) ? treatment : treatment.rows ?? [];

    const controlByPair = indexCellsByPair(controlRows);
    const treatmentByPair = indexCellsByPair(treatmentRows);

    const intersectionKeys = [...controlByPair.keys()].filter(k => treatmentByPair.has(k));
    const cells = [];
    for (const key of intersectionKeys) {
        const [entryId, provider] = key.split(':');
        if (!validIds.has(entryId)) continue;
        const datasetEntry = datasetById.get(entryId);
        if (!datasetEntry) continue;

        const controlRow = controlByPair.get(key);
        const treatmentRow = treatmentByPair.get(key);
        const direction = classifyDirection({
            controlVerdict: controlRow.predicted_verdict,
            treatmentVerdict: treatmentRow.predicted_verdict,
            groundTruth: datasetEntry.ground_truth,
        });

        cells.push({
            entryId,
            provider,
            controlVerdict: controlRow.predicted_verdict,
            treatmentVerdict: treatmentRow.predicted_verdict,
            groundTruth: datasetEntry.ground_truth,
            direction,
            claimText: datasetEntry.claim_text,
            sourceUrl: datasetEntry.source_url,
            datasetEntry,
        });
    }

    const cellsByProvider = new Map();
    for (const cell of cells) {
        if (!cellsByProvider.has(cell.provider)) cellsByProvider.set(cell.provider, []);
        cellsByProvider.get(cell.provider).push(cell);
    }
    const perProvider = new Map();
    for (const [provider, providerCells] of cellsByProvider) {
        perProvider.set(provider, computeProviderStats(providerCells));
    }

    const flips = cells.filter(c =>
        c.direction === 'improvement' || c.direction === 'regression' || c.direction === 'lateral'
    );

    const controlMeta = Array.isArray(control) ? {} : (control.metadata ?? {});
    const treatmentMeta = Array.isArray(treatment) ? {} : (treatment.metadata ?? {});

    return {
        metadata: {
            controlRunAt: controlMeta.run_at ?? null,
            treatmentRunAt: treatmentMeta.run_at ?? null,
            changeAxes: options.changeAxes ?? [],
            groundTruthVersion: options.groundTruthVersion ?? null,
            generatedAt: new Date().toISOString(),
        },
        coverage: {
            datasetTotal: dataset.length,
            datasetValid: validIds.size,
            controlOnlyCells: [...controlByPair.keys()].filter(k => !treatmentByPair.has(k)).length,
            treatmentOnlyCells: [...treatmentByPair.keys()].filter(k => !controlByPair.has(k)).length,
            intersectionCells: intersectionKeys.length,
            comparedCells: cells.length,
        },
        cells,
        perProvider,
        flips,
    };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='compareResults builds'`
Expected: Passes.

**Step 5: Commit**

```bash
git add benchmark/compare_results.js tests/compare_results.test.js
git commit -m "benchmark: top-level compareResults() ties indexing, classification, aggregation"
```

---

## Task 6: Post-hoc filterComparison helper

**Files:**
- Modify: `benchmark/compare_results.js` (add `filterComparison` export)
- Modify: `tests/compare_results.test.js` (add tests)

**Step 1: Write the failing test**

Append to `tests/compare_results.test.js`:

```js
import { filterComparison } from '../benchmark/compare_results.js';

test('filterComparison restricts cells to a predicate match and re-aggregates', () => {
    const result = compareResults({
        control: FIXTURE_CONTROL,
        treatment: FIXTURE_TREATMENT,
        dataset: FIXTURE_DATASET,
    });

    // Filter to v2 rows only.
    const v2Only = filterComparison(result, ({ datasetEntry }) =>
        datasetEntry.dataset_version === 'v2');

    // 3 v2 rows × 2 providers = 6 cells (no vote-3 cell on v2 rows in fixture).
    assert.equal(v2Only.coverage.comparedCells, 6);
    assert.equal(v2Only.metadata.filtered, true);

    // Per-provider should re-aggregate over only the v2 cells.
    assert.equal(v2Only.perProvider.get('mistral').n, 3);
    assert.equal(v2Only.perProvider.get('granite').n, 3);
    // vote-3 had no v2 cells; provider drops out entirely.
    assert.equal(v2Only.perProvider.has('openrouter-vote-3'), false);
});

test('filterComparison by provider name restricts to single-provider view', () => {
    const result = compareResults({
        control: FIXTURE_CONTROL,
        treatment: FIXTURE_TREATMENT,
        dataset: FIXTURE_DATASET,
    });
    const mistralOnly = filterComparison(result, ({ provider }) => provider === 'mistral');
    assert.equal(mistralOnly.perProvider.size, 1);
    assert.equal(mistralOnly.perProvider.get('mistral').n, 5);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='filterComparison'`
Expected: Both fail with `filterComparison is not a function`.

**Step 3: Write minimal implementation**

Append to `benchmark/compare_results.js`:

```js
/**
 * Filter a ComparisonResult post-hoc, returning a new result restricted to
 * cells matching the predicate. Per-provider stats are re-aggregated over
 * the filtered cell set; providers with zero matching cells drop out.
 *
 * The original result is not mutated.
 *
 * @param {ReturnType<typeof compareResults>} result
 * @param {(cell: { entryId: string, provider: string, datasetEntry: Object, direction: string, controlVerdict: string, treatmentVerdict: string, groundTruth: string }) => boolean} predicate
 */
export function filterComparison(result, predicate) {
    const cells = result.cells.filter(predicate);
    const cellsByProvider = new Map();
    for (const cell of cells) {
        if (!cellsByProvider.has(cell.provider)) cellsByProvider.set(cell.provider, []);
        cellsByProvider.get(cell.provider).push(cell);
    }
    const perProvider = new Map();
    for (const [provider, providerCells] of cellsByProvider) {
        perProvider.set(provider, computeProviderStats(providerCells));
    }
    const flips = cells.filter(c =>
        c.direction === 'improvement' || c.direction === 'regression' || c.direction === 'lateral'
    );
    return {
        metadata: { ...result.metadata, filtered: true },
        coverage: { ...result.coverage, comparedCells: cells.length },
        cells,
        perProvider,
        flips,
    };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='filterComparison'`
Expected: Both pass.

**Step 5: Commit**

```bash
git add benchmark/compare_results.js tests/compare_results.test.js
git commit -m "benchmark: filterComparison() for post-hoc cell-set slicing"
```

---

## Task 7: Run full test suite to verify nothing else broke

**Step 1: Run all tests**

Run: `npm test`
Expected: All existing tests still pass (174 tests on integration-base baseline) plus the new compare_results tests (~12 new tests).

If any pre-existing test fails, investigate before proceeding to Phase 2 — do not commit forward.

**Step 2: Verify the module's public surface**

Run: `node --input-type=module -e "import * as M from './benchmark/compare_results.js'; console.log(Object.keys(M).sort());"`
Expected output (or similar set):
```
[
  'classifyDirection',
  'compareResults',
  'computeProviderStats',
  'filterComparison',
  'indexCellsByPair',
  'normalizeVerdict',
  'verdictsEqualBinary',
  'verdictsEqualExact',
  'verdictsEqualLenient'
]
```

No commit for this task — it's a verification step.
