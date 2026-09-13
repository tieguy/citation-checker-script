# Compare Results — Phase 3: CLI subcommand integration

> **For Claude:** REQUIRED SUB-SKILL: Use `ed3d-plan-and-execute:executing-an-implementation-plan` to implement this plan task-by-task.

**Goal:** Wire `ccs compare <control.json> <treatment.json> --dataset <dataset.json>` into the existing `bin/ccs` CLI. End state: `npx ccs compare ...` runs the comparison, applies any subset filter, renders the chosen output format, and writes the report to disk (or to stdout if no `--report` is given). Always exits 0 on successful execution; non-zero only for genuine errors (file missing, parse failure, no overlapping cells, bad arguments).

**Architecture:** Refactor `cli/verify.js`'s `parseCliArgs` from a single-subcommand parser into a dispatcher that delegates to `parseVerifyArgs` (extracted from existing code) or `parseCompareArgs` (new in `cli/compare.js`). The dispatcher in `main()` picks `runVerify` or `runCompare` based on the parsed subcommand. No changes to `bin/ccs` itself — it still imports `main` from `cli/verify.js`.

**Tech Stack:** `node:util`'s `parseArgs` (already used by verify), `node:fs`, ESM imports.

**Branch context:** Continues on the same feature branch as Phases 1–2. Phases 1 and 2 must be complete with all tests passing before starting.

**Scope:** Phase 3 of 4.

**Codebase verified:** 2026-05-06.

**Codebase verification findings:**
- ✓ `cli/verify.js` exists (368 lines) with `parseCliArgs`, `UsageError`, `HELP_TEXT`, `runVerify`, `main`. Currently hardcodes `subcommand !== 'verify'` at line 43.
- ✓ `bin/ccs` (11 lines) imports `main` from `../cli/verify.js`. No changes needed.
- ✓ `tests/cli.test.js` exists. Existing tests must continue to pass after the parser refactor — the implementation plan's first task must preserve `parseCliArgs(argv)` behavior for `verify` invocations exactly.
- ✓ `package.json`'s `bin: { "ccs": "./bin/ccs" }` is configured correctly. No changes needed.
- ✓ `benchmark/compare_results.js` and `benchmark/render_compare.js` exist after Phases 1–2.
- ✓ No existing `cli/compare.js`.

---

## Task 1: Refactor `cli/verify.js` into a thin dispatcher

The existing `parseCliArgs` is hardcoded to verify. Split it into:
- `parseCliArgs(argv)` — the dispatcher: looks at `argv[2]` (the subcommand), returns `{help: true}` for top-level help, delegates to `parseVerifyArgs` or (later in Task 4) `parseCompareArgs`
- `parseVerifyArgs(args)` — verify-specific, takes argv slice from after the subcommand
- Rename `HELP_TEXT` → `VERIFY_HELP_TEXT` (existing constant)
- Add `TOP_LEVEL_HELP_TEXT` for `ccs --help` (lists subcommands)

**Files:**
- Modify: `cli/verify.js`

**Step 1: Make the refactor without behavioral change**

Replace `cli/verify.js`'s `parseCliArgs` with the dispatcher form, and extract `parseVerifyArgs`:

```js
export function parseCliArgs(argv) {
    const raw = argv.slice(2);

    if (raw.length === 0) return { help: true, scope: 'top' };
    if (raw[0] === '-h' || raw[0] === '--help') return { help: true, scope: 'top' };

    const subcommand = raw[0];
    const subArgs = raw.slice(1);

    if (subcommand === 'verify') {
        const opts = parseVerifyArgs(subArgs);
        return { ...opts, subcommand: 'verify' };
    }
    // 'compare' will be added in Task 4 once cli/compare.js is in place.

    throw new UsageError(`unknown subcommand: ${subcommand}`);
}

function parseVerifyArgs(args) {
    if (args.includes('-h') || args.includes('--help')) {
        return { help: true, scope: 'verify' };
    }

    const { values, positionals } = parseArgs({
        args,
        options: {
            provider: { type: 'string', default: 'publicai' },
            'no-log': { type: 'boolean', default: false },
            help:     { type: 'boolean', short: 'h', default: false },
        },
        allowPositionals: true,
        strict: true,
    });

    const url = positionals[0];
    const citationStr = positionals[1];
    if (!url || !citationStr) {
        throw new UsageError('usage: ccs verify <wikipedia-url> <citation-number> [--provider <name>] [--no-log]');
    }

    const citationNumber = Number(citationStr);
    if (!Number.isInteger(citationNumber) || citationNumber < 1) {
        throw new UsageError(`citation number must be a positive integer (got: ${citationStr})`);
    }

    const provider = values.provider;
    if (!KNOWN_PROVIDERS.includes(provider)) {
        throw new UsageError(`unknown provider: ${provider} (choose from: ${KNOWN_PROVIDERS.join(', ')})`);
    }

    return {
        help: false,
        url,
        citationNumber,
        provider,
        noLog: values['no-log'],
    };
}
```

Rename the existing `HELP_TEXT` constant to `VERIFY_HELP_TEXT` (do a global find-and-replace **within `cli/verify.js`**). Note that `tests/cli.test.js` imports `HELP_TEXT` by name and references it in six tests — Step 2 below updates those.

Add a new `TOP_LEVEL_HELP_TEXT`:

```js
export const TOP_LEVEL_HELP_TEXT = `usage: ccs <subcommand> [...]

Subcommands:
  verify    Verify a Wikipedia citation by fetching its source and asking
            an LLM whether the cited claim is supported.
  compare   Compare two benchmark results.json files and produce a
            per-provider accuracy + flip report (Markdown, HTML, or JSON).

Run \`ccs <subcommand> --help\` for subcommand-specific options.
`;
```

Update `main()` to dispatch help correctly:

```js
export async function main(argv, { stdout = process.stdout, stderr = process.stderr, env = process.env } = {}) {
    let opts;
    try {
        opts = parseCliArgs(argv);
    } catch (err) {
        if (err instanceof UsageError) {
            stderr.write(`ccs: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    if (opts.help) {
        if (opts.scope === 'verify') {
            stdout.write(VERIFY_HELP_TEXT);
        } else {
            stdout.write(TOP_LEVEL_HELP_TEXT);
        }
        return 0;
    }

    if (opts.subcommand === 'verify') {
        return await runVerify(opts, { stdout, stderr, env });
    }

    // Unreachable — parseCliArgs would have thrown.
    throw new Error(`unhandled subcommand: ${opts.subcommand}`);
}
```

**Step 2: Update `tests/cli.test.js` to match the renamed export and the new top-level help**

The existing test file imports `HELP_TEXT` and asserts `main(['node','bin/ccs','--help'])` prints the verify-flavored help (asserting `/Exit codes:/` is present). After this refactor:
- `HELP_TEXT` no longer exists — it's `VERIFY_HELP_TEXT`.
- `main(['node','bin/ccs','--help'])` now prints `TOP_LEVEL_HELP_TEXT` (no `Exit codes:` block — that's verify-scoped).
- `main(['node','bin/ccs','verify','--help'])` is the invocation that prints the verify help.

Apply these edits to `tests/cli.test.js`:

1. **Import line (line ~4):** change `import { HELP_TEXT, ... } from '../cli/verify.js';` to `import { VERIFY_HELP_TEXT, TOP_LEVEL_HELP_TEXT, ... } from '../cli/verify.js';`.

2. **Rename references** inside the six `HELP_TEXT: ...` tests (the ones asserting the help string contains specific phrases like provider names, `--no-log`, `Exit codes:`, etc.): change every `HELP_TEXT` identifier in the test bodies to `VERIFY_HELP_TEXT`. The test names themselves can stay or be renamed to `VERIFY_HELP_TEXT: ...` — engineer's call; the assertions are what matter.

3. **`main() with --help` test:** change the invocation from `main(['node','bin/ccs','--help'], ...)` to `main(['node','bin/ccs','verify','--help'], ...)` so it still exercises the verify-help path. The existing `assert.match(stdout.value(), /Exit codes:/)` assertion will then pass against `VERIFY_HELP_TEXT` as before.

4. **Add a new test** for the top-level help path:

```js
test('main() with no args writes top-level help mentioning subcommands', async () => {
    const stdout = makeStream();
    const stderr = makeStream();
    const code = await main(['node', 'bin/ccs'], { stdout, stderr });
    assert.equal(code, 0);
    assert.match(stdout.value(), /Subcommands:/);
    assert.match(stdout.value(), /verify/);
    assert.match(stdout.value(), /compare/);
});

test('main() with --help (no subcommand) writes top-level help', async () => {
    const stdout = makeStream();
    const stderr = makeStream();
    const code = await main(['node', 'bin/ccs', '--help'], { stdout, stderr });
    assert.equal(code, 0);
    assert.match(stdout.value(), /Subcommands:/);
});
```

(Use whatever `makeStream()` / stdout-capturing helper the existing tests use — match the pattern of the existing `main()` tests in the same file.)

**Step 3: Run existing + updated CLI tests to verify the refactor preserved behavior**

Run: `npm test -- --test-name-pattern='cli'`
Expected: All updated `tests/cli.test.js` tests pass — six existing `VERIFY_HELP_TEXT` tests, the rerouted `main() --help` test now using `verify --help`, and the two new top-level-help tests.

If any test fails, the refactor changed behavior beyond the rename. Fix before continuing.

**Step 4: Commit**

```bash
git add cli/verify.js tests/cli.test.js
git commit -m "cli: split parseCliArgs into a dispatcher + verify-specific parser"
```

---

## Task 2: Create `cli/compare.js` skeleton — `parseCompareArgs` + help

**Files:**
- Create: `cli/compare.js`
- Create: `tests/compare_cli.test.js`

**Step 1: Write the failing test**

Create `tests/compare_cli.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCompareArgs, COMPARE_HELP_TEXT } from '../cli/compare.js';
import { UsageError } from '../cli/verify.js';

test('parseCompareArgs: --help short-circuits with scope=compare', () => {
    const opts = parseCompareArgs(['--help']);
    assert.equal(opts.help, true);
    assert.equal(opts.scope, 'compare');
});

test('parseCompareArgs: requires control + treatment positionals and --dataset', () => {
    assert.throws(() => parseCompareArgs([]), UsageError);
    assert.throws(() => parseCompareArgs(['c.json']), UsageError);
    assert.throws(() => parseCompareArgs(['c.json', 't.json']), UsageError); // missing --dataset
});

test('parseCompareArgs: returns full opts on a complete invocation', () => {
    const opts = parseCompareArgs([
        'control.json',
        'treatment.json',
        '--dataset', 'dataset.json',
        '--report', 'report.html',
        '--filter', 'version=v2',
        '--noise-floor', '7',
        '--change-axis', 'prompt',
        '--change-axis', 'source_text',
        '--gt-version', 'post-audit-2026-04-30',
    ]);
    assert.equal(opts.help, false);
    assert.equal(opts.controlPath, 'control.json');
    assert.equal(opts.treatmentPath, 'treatment.json');
    assert.equal(opts.datasetPath, 'dataset.json');
    assert.equal(opts.reportPath, 'report.html');
    assert.equal(opts.filter, 'version=v2');
    assert.equal(opts.noiseFloor, 7);
    assert.deepEqual(opts.changeAxes, ['prompt', 'source_text']);
    assert.equal(opts.groundTruthVersion, 'post-audit-2026-04-30');
});

test('parseCompareArgs: defaults reportPath to null and noiseFloor to 5', () => {
    const opts = parseCompareArgs(['c.json', 't.json', '--dataset', 'd.json']);
    assert.equal(opts.reportPath, null);
    assert.equal(opts.noiseFloor, 5);
    assert.deepEqual(opts.changeAxes, []);
});

test('COMPARE_HELP_TEXT mentions key flags', () => {
    assert.match(COMPARE_HELP_TEXT, /--dataset/);
    assert.match(COMPARE_HELP_TEXT, /--report/);
    assert.match(COMPARE_HELP_TEXT, /--filter/);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='parseCompareArgs|COMPARE_HELP_TEXT'`
Expected: All five tests fail with import errors (`cli/compare.js` doesn't exist).

**Step 3: Write minimal implementation**

Create `cli/compare.js`:

```js
import { parseArgs } from 'node:util';
import { UsageError } from './verify.js';

export const COMPARE_HELP_TEXT = `usage: ccs compare <control.json> <treatment.json> --dataset <dataset.json> [options]

Compare two benchmark results.json files and produce a per-provider accuracy
+ flip report. Always exits 0 on success — inspect the report for regressions
rather than relying on exit codes.

Arguments:
  <control.json>     Baseline results.json (treated as the "before" run).
  <treatment.json>   Comparison results.json (treated as the "after" run).

Required:
  --dataset <path>   Path to the dataset.json that produced both runs.
                     Used for ground_truth, claim_text, and source_url.

Options:
  --report <path>    Write the report to this path. Format is chosen by
                     extension: .html, .md / .markdown, or .json. If omitted,
                     JSON is written to stdout.
  --filter <expr>    Post-hoc subset filter. Supported expressions:
                       version=<v1|v2|v3|...>   filter by dataset_version
                       provider=<name>          filter to a single provider
                       direction=<imp|reg|...>  filter by direction class
  --noise-floor <pp> Annotate per-provider rows whose |Δ| is below this
                     threshold (in percentage points). Default: 5.
  --change-axis <a>  What differs between control and treatment (e.g.,
                     "prompt", "source_text"). Repeat for multiple axes.
                     Recorded in report metadata.
  --gt-version <s>   Ground-truth version label (e.g.,
                     "post-audit-2026-04-30"). Recorded in report metadata.
  --help, -h         Show this help and exit.

Examples:
  ccs compare control.json treatment.json --dataset dataset.json
  ccs compare control.json treatment.json --dataset dataset.json --report report.html
  ccs compare control.json treatment.json --dataset dataset.json --report out.md --filter version=v2
`;

export function parseCompareArgs(args) {
    if (args.includes('-h') || args.includes('--help')) {
        return { help: true, scope: 'compare' };
    }

    const { values, positionals } = parseArgs({
        args,
        options: {
            dataset:        { type: 'string' },
            report:         { type: 'string' },
            filter:         { type: 'string' },
            'noise-floor':  { type: 'string', default: '5' },
            'change-axis':  { type: 'string', multiple: true },
            'gt-version':   { type: 'string' },
            help:           { type: 'boolean', short: 'h', default: false },
        },
        allowPositionals: true,
        strict: true,
    });

    const [controlPath, treatmentPath] = positionals;
    if (!controlPath || !treatmentPath) {
        throw new UsageError('usage: ccs compare <control.json> <treatment.json> --dataset <dataset.json>');
    }
    if (!values.dataset) {
        throw new UsageError('--dataset <path-to-dataset.json> is required');
    }
    const noiseFloor = parseFloat(values['noise-floor']);
    if (!Number.isFinite(noiseFloor) || noiseFloor < 0) {
        throw new UsageError(`--noise-floor must be a non-negative number (got: ${values['noise-floor']})`);
    }

    return {
        help: false,
        controlPath,
        treatmentPath,
        datasetPath: values.dataset,
        reportPath: values.report ?? null,
        filter: values.filter ?? null,
        noiseFloor,
        changeAxes: values['change-axis'] ?? [],
        groundTruthVersion: values['gt-version'] ?? null,
    };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='parseCompareArgs|COMPARE_HELP_TEXT'`
Expected: All five tests pass.

**Step 5: Commit**

```bash
git add cli/compare.js tests/compare_cli.test.js
git commit -m "cli: add compare-subcommand argument parser and help text"
```

---

## Task 3: Implement `runCompare`

**Files:**
- Modify: `cli/compare.js`
- Modify: `tests/compare_cli.test.js`

**Step 1: Write the failing test**

Append to `tests/compare_cli.test.js`:

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCompare } from '../cli/compare.js';

function tmp(suffix = '.json') {
    return path.join(os.tmpdir(), `ccs-compare-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`);
}

const FIX_DATASET = [
    { id: 'r1', ground_truth: 'Supported', claim_text: 'c1', source_url: 'http://x/1', extraction_status: 'complete', needs_manual_review: false, dataset_version: 'v1' },
    { id: 'r2', ground_truth: 'Not supported', claim_text: 'c2', source_url: 'http://x/2', extraction_status: 'complete', needs_manual_review: false, dataset_version: 'v2' },
];
const FIX_CONTROL = { rows: [
    { entry_id: 'r1', provider: 'mistral', predicted_verdict: 'Not supported', error: null },
    { entry_id: 'r2', provider: 'mistral', predicted_verdict: 'Supported', error: null },
] };
const FIX_TREATMENT = { rows: [
    { entry_id: 'r1', provider: 'mistral', predicted_verdict: 'Supported', error: null },
    { entry_id: 'r2', provider: 'mistral', predicted_verdict: 'Not supported', error: null },
] };

function setup() {
    const c = tmp(), t = tmp(), d = tmp();
    fs.writeFileSync(c, JSON.stringify(FIX_CONTROL));
    fs.writeFileSync(t, JSON.stringify(FIX_TREATMENT));
    fs.writeFileSync(d, JSON.stringify(FIX_DATASET));
    return { c, t, d };
}

test('runCompare writes JSON to stdout when no --report given', async () => {
    const { c, t, d } = setup();
    const out = [];
    const stdout = { write: (s) => out.push(s) };
    const stderr = { write: () => {} };
    try {
        const code = await runCompare(
            { controlPath: c, treatmentPath: t, datasetPath: d, reportPath: null, filter: null, noiseFloor: 5, changeAxes: [], groundTruthVersion: null },
            { stdout, stderr },
        );
        assert.equal(code, 0);
        const json = JSON.parse(out.join(''));
        assert.equal(json.coverage.comparedCells, 2);
    } finally {
        for (const f of [c, t, d]) fs.unlinkSync(f);
    }
});

test('runCompare writes HTML to disk when --report ends in .html', async () => {
    const { c, t, d } = setup();
    const reportPath = tmp('.html');
    const stdout = { write: () => {} };
    const stderr = { write: () => {} };
    try {
        const code = await runCompare(
            { controlPath: c, treatmentPath: t, datasetPath: d, reportPath, filter: null, noiseFloor: 5, changeAxes: [], groundTruthVersion: null },
            { stdout, stderr },
        );
        assert.equal(code, 0);
        const contents = fs.readFileSync(reportPath, 'utf8');
        assert.match(contents, /<!DOCTYPE html>/);
        assert.match(contents, /Headline accuracy/);
    } finally {
        for (const f of [c, t, d, reportPath]) try { fs.unlinkSync(f); } catch {}
    }
});

test('runCompare returns 2 when control file is missing', async () => {
    const { t, d } = setup();
    const stderr = [];
    const code = await runCompare(
        { controlPath: '/nonexistent.json', treatmentPath: t, datasetPath: d, reportPath: null, filter: null, noiseFloor: 5, changeAxes: [], groundTruthVersion: null },
        { stdout: { write: () => {} }, stderr: { write: (s) => stderr.push(s) } },
    );
    assert.equal(code, 2);
    assert.match(stderr.join(''), /ccs compare: /);
    for (const f of [t, d]) fs.unlinkSync(f);
});

test('runCompare returns 2 on no-overlap intersection', async () => {
    const c = tmp(), t = tmp(), d = tmp();
    fs.writeFileSync(c, JSON.stringify({ rows: [{ entry_id: 'r1', provider: 'mistral', predicted_verdict: 'Supported', error: null }] }));
    fs.writeFileSync(t, JSON.stringify({ rows: [{ entry_id: 'r2', provider: 'granite', predicted_verdict: 'Supported', error: null }] }));
    fs.writeFileSync(d, JSON.stringify(FIX_DATASET));
    const stderr = [];
    try {
        const code = await runCompare(
            { controlPath: c, treatmentPath: t, datasetPath: d, reportPath: null, filter: null, noiseFloor: 5, changeAxes: [], groundTruthVersion: null },
            { stdout: { write: () => {} }, stderr: { write: (s) => stderr.push(s) } },
        );
        assert.equal(code, 2);
        assert.match(stderr.join(''), /no cells in intersection/);
    } finally {
        for (const f of [c, t, d]) fs.unlinkSync(f);
    }
});

test('runCompare with --filter version=v2 narrows to v2 rows', async () => {
    const { c, t, d } = setup();
    const reportPath = tmp('.json');
    const stdout = { write: () => {} };
    const stderr = { write: () => {} };
    try {
        const code = await runCompare(
            { controlPath: c, treatmentPath: t, datasetPath: d, reportPath, filter: 'version=v2', noiseFloor: 5, changeAxes: [], groundTruthVersion: null },
            { stdout, stderr },
        );
        assert.equal(code, 0);
        const json = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        // FIX_DATASET has one v2 row → filter to 1 cell.
        assert.equal(json.coverage.comparedCells, 1);
        assert.equal(json.metadata.filtered, true);
    } finally {
        for (const f of [c, t, d, reportPath]) try { fs.unlinkSync(f); } catch {}
    }
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='runCompare'`
Expected: All five tests fail with `runCompare is not a function`.

**Step 3: Write minimal implementation**

Append to `cli/compare.js`:

```js
import fs from 'node:fs';
import { compareResults, filterComparison } from '../benchmark/compare_results.js';
import { renderJson, renderMarkdown, renderHtml } from '../benchmark/render_compare.js';

function parseFilterExpression(expr) {
    const eq = expr.indexOf('=');
    if (eq === -1) {
        throw new UsageError(`bad --filter syntax (expected key=value): ${expr}`);
    }
    const key = expr.slice(0, eq);
    const value = expr.slice(eq + 1);
    if (key === 'version') {
        return ({ datasetEntry }) => datasetEntry.dataset_version === value;
    }
    if (key === 'provider') {
        return ({ provider }) => provider === value;
    }
    if (key === 'direction') {
        return ({ direction }) => direction === value;
    }
    throw new UsageError(`unknown --filter key: ${key} (supported: version, provider, direction)`);
}

function chooseRenderer(reportPath) {
    const lower = reportPath.toLowerCase();
    if (lower.endsWith('.html'))     return { fn: renderHtml,     mode: 'html' };
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
        return { fn: renderMarkdown, mode: 'markdown' };
    }
    if (lower.endsWith('.json'))     return { fn: renderJson,     mode: 'json' };
    return null;
}

export async function runCompare(opts, { stdout = process.stdout, stderr = process.stderr } = {}) {
    let control, treatment, dataset;
    try {
        control = JSON.parse(fs.readFileSync(opts.controlPath, 'utf8'));
    } catch (err) {
        stderr.write(`ccs compare: failed to read control (${opts.controlPath}): ${err.message}\n`);
        return 2;
    }
    try {
        treatment = JSON.parse(fs.readFileSync(opts.treatmentPath, 'utf8'));
    } catch (err) {
        stderr.write(`ccs compare: failed to read treatment (${opts.treatmentPath}): ${err.message}\n`);
        return 2;
    }
    try {
        const datasetRaw = JSON.parse(fs.readFileSync(opts.datasetPath, 'utf8'));
        dataset = Array.isArray(datasetRaw) ? datasetRaw : (datasetRaw.rows ?? []);
    } catch (err) {
        stderr.write(`ccs compare: failed to read dataset (${opts.datasetPath}): ${err.message}\n`);
        return 2;
    }

    let result = compareResults({
        control, treatment, dataset,
        options: {
            changeAxes: opts.changeAxes,
            groundTruthVersion: opts.groundTruthVersion,
        },
    });

    if (opts.filter) {
        let predicate;
        try {
            predicate = parseFilterExpression(opts.filter);
        } catch (err) {
            stderr.write(`ccs compare: ${err.message}\n`);
            return 2;
        }
        result = filterComparison(result, predicate);
    }

    if (result.coverage.comparedCells === 0) {
        stderr.write(`ccs compare: no cells in intersection — control and treatment share no successful (entry_id, provider) pairs (or all pairs were filtered out).\n`);
        return 2;
    }

    if (!opts.reportPath) {
        stdout.write(renderJson(result, { indent: 2 }));
        stdout.write('\n');
        return 0;
    }

    const renderer = chooseRenderer(opts.reportPath);
    if (!renderer) {
        stderr.write(`ccs compare: unrecognized report extension (use .html, .md, or .json): ${opts.reportPath}\n`);
        return 2;
    }
    const rendered = renderer.fn(result, { noiseFloor: opts.noiseFloor });
    fs.writeFileSync(opts.reportPath, rendered, 'utf8');
    stdout.write(`Report written to ${opts.reportPath} (${result.coverage.comparedCells} cells compared)\n`);
    return 0;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='runCompare'`
Expected: All five tests pass.

**Step 5: Commit**

```bash
git add cli/compare.js tests/compare_cli.test.js
git commit -m "cli: implement runCompare — load files, compare, filter, render, write"
```

---

## Task 4: Wire `compare` into `cli/verify.js`'s dispatcher

**Files:**
- Modify: `cli/verify.js`

**Step 1: Add the dispatch branches**

In `cli/verify.js`:

1. At the top, add the import:

```js
import { parseCompareArgs, COMPARE_HELP_TEXT, runCompare } from './compare.js';
```

2. In `parseCliArgs`, add the `compare` branch right after the `verify` branch:

```js
    if (subcommand === 'compare') {
        const opts = parseCompareArgs(subArgs);
        return { ...opts, subcommand: 'compare' };
    }
```

3. In `main()`, before the unreachable `throw`, add:

```js
    if (opts.subcommand === 'compare') {
        return await runCompare(opts, { stdout, stderr });
    }
```

4. In the `if (opts.help)` block, add the compare scope:

```js
    if (opts.help) {
        if (opts.scope === 'verify') {
            stdout.write(VERIFY_HELP_TEXT);
        } else if (opts.scope === 'compare') {
            stdout.write(COMPARE_HELP_TEXT);
        } else {
            stdout.write(TOP_LEVEL_HELP_TEXT);
        }
        return 0;
    }
```

5. (Note: `parseCompareArgs` already returns `{ help: true, scope: 'compare' }` from Task 2, so no parser changes are needed here — the dispatcher just needs to honor the `scope` field.)

**Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass — both the new compare-CLI tests and the existing verify-CLI tests.

**Step 3: Manual end-to-end check**

Run with no args:
```bash
node bin/ccs
```
Expected: Top-level help printed.

Run with compare help:
```bash
node bin/ccs compare --help
```
Expected: COMPARE_HELP_TEXT printed.

Run an end-to-end compare against fresh fixtures:
```bash
mkdir -p /tmp/ccs-compare-smoke && cd /tmp/ccs-compare-smoke
cat > dataset.json <<'EOF'
[{"id":"r1","ground_truth":"Supported","claim_text":"c1","source_url":"http://x/1","extraction_status":"complete","needs_manual_review":false}]
EOF
cat > control.json <<'EOF'
{"rows":[{"entry_id":"r1","provider":"mistral","predicted_verdict":"Not supported","error":null}]}
EOF
cat > treatment.json <<'EOF'
{"rows":[{"entry_id":"r1","provider":"mistral","predicted_verdict":"Supported","error":null}]}
EOF
node /path/to/citation-checker-script/bin/ccs compare control.json treatment.json --dataset dataset.json --report out.html
```
Expected: `Report written to out.html (1 cells compared)`. `out.html` contains the headline-accuracy table and a flip table with the row `r1 / mistral / improvement`.

**Step 4: Commit**

```bash
git add cli/verify.js cli/compare.js tests/compare_cli.test.js
git commit -m "cli: dispatch compare subcommand from main entry point"
```

---

## Task 5: Add npm script convenience entry

**Files:**
- Modify: `benchmark/package.json` (NOT the top-level `package.json` — comparison is benchmark-adjacent infrastructure)

**Step 1: Add the script**

Open `benchmark/package.json`. Find the `scripts` object — it currently looks like:

```json
{
  "type": "module",
  "scripts": {
    "extract": "node extract_dataset.js",
    "extract:dry": "node extract_dataset.js --dry-run",
    "extract:v1": "node extract_dataset.js --version v1",
    ...
    "report": "node generate_comparison.js"
  },
  "dependencies": { "jsdom": "..." }
}
```

Add the `compare` script as a new entry within the `scripts` object (anywhere — alphabetical or alongside `analyze`/`report` both work):

```json
"compare": "node ../bin/ccs compare"
```

So contributors can run `npm run compare -- control.json treatment.json --dataset dataset.json` from `benchmark/`.

**Step 2: Verify**

Run from `benchmark/`:
```bash
npm run compare -- --help
```
Expected: `COMPARE_HELP_TEXT` printed.

**Step 3: Commit**

```bash
git add benchmark/package.json
git commit -m "benchmark: add npm run compare convenience script"
```

---

## Task 6: Run full test suite

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass — Phase 1 (~12 new), Phase 2 (~6 new), Phase 3 (~10 new) on top of the 174-test integration-base baseline = ~202 tests passing.

If any pre-existing test fails, investigate before proceeding to Phase 4.

No commit for this task.
