# Fresh prompt rewrite — Phase 6: Benchmark wiring + 20-row smoke run

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Wire the atomized pipeline into `benchmark/run_benchmark.js`. Surface per-row `atoms` + `atomResults` + `rollupMode` in `results.json`. Add an atom-count distribution to `analyze_results.js`. Run a 20-row smoke against flagship Sonnet 4.5 to sanity-check atom output before any full panel run.

**Architecture:** `benchmark/run_benchmark.js` gains `--atomized` / `--no-atomized`, `--rollup-mode {deterministic|judge}`, `--small-atomizer` flags matching the CLI surface. Internally it calls `verify()` from `core/worker.js` (the dispatcher Phase 5 added). Per-row result rows gain `atoms` (the Atom[]), `atomResults` (the AtomResult[]), `rollupMode`, and `judgeReasoning` (when applicable). Existing fields (`verdict`, `correct`, `ground_truth`, etc.) stay in shape. The 20-row smoke run is the "first real test" — the user explicitly noted that the post-smoke output will likely drive a prompt-rewrite iteration before Phases 7-8 ship.

**Tech Stack:** Same. The benchmark already imports `extractClaimText` from `../core/claim.js` and now imports `verify` from `../core/worker.js`.

**Scope:** Phase 6 of 6 (final phase in this plan; Phases 7-8 deferred).

**Codebase verified:** 2026-05-14. `benchmark/run_benchmark.js` already has manual argv parsing (lines 177-180 use `args.find(a => a.startsWith('--providers='))`). The PROVIDERS registry now lives in `core/providers.js` (extracted in Phase 1). Results JSON shape per row from the existing benchmark: `{ entry_id, provider, model, ground_truth, predicted_verdict, confidence, comments, latency_ms, error, correct, timestamp }`.

**Baseline to compare against:** The `body-classifier-bench` worktree's `benchmark/results.json` (9 providers, 176 usable rows, mean +4.4pp exact vs May 10 control). Cell 0 in the design plan reuses that artifact; the 20-row smoke is the first treatment run.

---

## Task 1: Add flag parsing to `benchmark/run_benchmark.js`

**Files:**
- Modify: `benchmark/run_benchmark.js`

**Step 1: Find current argv parsing**

Run: `grep -n "args.find\|--providers=\|--limit\|--version" benchmark/run_benchmark.js | head -10`

The current pattern is manual `args.find(a => a.startsWith('--FLAG='))` per flag. Match that style for the new flags.

**Step 2: Add new flags**

After the existing `--providers=`, `--limit=`, `--resume`, `--version`, `--concurrency` parsing, add:

```js
// New: atomized-pipeline flags. Default --atomized so the benchmark
// exercises the new pipeline by default; --no-atomized re-enables the
// single-pass path for Cell 1 (rules-only ablation).
const wantAtomized = !args.includes('--no-atomized');
const rollupModeArg = args.find(a => a.startsWith('--rollup-mode='));
const rollupMode = rollupModeArg
    ? rollupModeArg.split('=')[1]
    : 'deterministic';
if (rollupMode !== 'deterministic' && rollupMode !== 'judge') {
    console.error(`Invalid --rollup-mode: ${rollupMode}. Use 'deterministic' or 'judge'.`);
    process.exit(2);
}
// Flag name matches the CLI's --use-small-atomizer for symmetry.
const useSmallAtomizer = args.includes('--use-small-atomizer');
```

**Step 3: Pass flags into the main loop**

Find the per-row call into `callProviderAPI` (or, after Phase 5, the `verify()` call site). Replace it with:

```js
const verifyResult = await verify(
    entry.claim_text,
    sourceText,   // the citoid-augmented sourceText (already computed via augmentWithCitoidStructured in Phase 5 update)
    metadata,     // the structured citoid metadata block; null when citoid had no data
    { ...PROVIDERS[provider], apiKey: <env-var lookup>, responseFormat: PROVIDERS[provider].responseFormat },
    {
        atomized: wantAtomized,
        rollupMode,
        useSmallAtomizer,
        claimContainer: entry.claim_container,   // surrounding sentence/paragraph; threaded to atomize() as context-only
    }
);
```

(This builds on Phase 5's update to `benchmark/run_benchmark.js` which replaced `augmentWithCitoid` with `augmentWithCitoidStructured` to surface the structured metadata. Both `sourceText` and `metadata` are in scope at this point.)

**Step 4: Extend the per-row results push**

Find the existing `results.push({ ... })`. Extend it:

```js
results.push({
    entry_id: entry.id,
    provider,
    model: PROVIDERS[provider].model,
    ground_truth: entry.ground_truth,
    predicted_verdict: verifyResult.verdict,
    confidence: verifyResult.confidence ?? null,
    comments: verifyResult.comments,
    latency_ms: latency,
    error: null,
    correct: verifyResult.verdict === entry.ground_truth,
    timestamp: new Date().toISOString(),
    // New atomized-pipeline fields:
    atomized: wantAtomized,
    rollupMode: verifyResult.rollupMode,
    atoms: verifyResult.atoms ?? null,
    atomResults: verifyResult.atomResults ?? null,
    judgeReasoning: verifyResult.judgeReasoning ?? null,
});
```

---

## Task 2: Smoke-test the wiring with a tiny mocked run

**Files:**
- New: `tests/benchmark_atomized.test.js`

**Step 1: Write a test that exercises the run-loop's atomized path against a fake provider**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
// run_benchmark.js gates its main() behind `if (process.argv[1] === ...)`
// so we can import it safely. The test imports the module to verify it
// loads cleanly with the atomized changes, but doesn't invoke main().

test('benchmark/run_benchmark.js imports cleanly after atomized wiring', async () => {
  // If imports break (e.g., missing exports), this throws.
  const mod = await import('../benchmark/run_benchmark.js');
  assert.ok(mod);
});
```

(A more thorough test would invoke `verify()` with a mocked transport and assert the per-row JSON shape — but verify() is already covered in Phase 5's tests, and the changes here are purely call-site plumbing. The 20-row smoke run is the load-bearing integration check.)

**Step 2: Run**

Run: `npm test -- --test-name-pattern="benchmark/run_benchmark"`
Expected: 1 test passing.

---

## Task 3: Add atom-count distribution to `benchmark/analyze_results.js`

**Files:**
- Modify: `benchmark/analyze_results.js`

**Step 1: Find the analysis loop**

Run: `grep -n "function analyze\|^const.*function\|results\.forEach\|for.*results" benchmark/analyze_results.js | head -10`

**Step 2: Add atom-count aggregation**

In the analysis loop, accumulate atom-count statistics across rows where `atoms` is non-null:

```js
// Atom-count distribution (only for rows with atomized verification)
const atomCounts = results
    .filter(r => Array.isArray(r.atoms))
    .map(r => r.atoms.length);

const atomCountSummary = atomCounts.length === 0
    ? null
    : {
        rowsWithAtoms: atomCounts.length,
        medianAtoms: median(atomCounts),
        pctSingleAtom: atomCounts.filter(n => n === 1).length / atomCounts.length,
        pctOverThree:  atomCounts.filter(n => n > 3).length / atomCounts.length,
        max: Math.max(...atomCounts),
    };

// Include in the per-provider report
if (atomCountSummary) {
    console.log('\nAtom-count distribution:');
    console.log(`  rows with atoms: ${atomCountSummary.rowsWithAtoms}`);
    console.log(`  median atoms: ${atomCountSummary.medianAtoms}`);
    console.log(`  % single-atom: ${(atomCountSummary.pctSingleAtom * 100).toFixed(1)}%`);
    console.log(`  % >3 atoms: ${(atomCountSummary.pctOverThree * 100).toFixed(1)}%`);
    console.log(`  max: ${atomCountSummary.max}`);
}
```

If `median` is not already defined, add it:

```js
function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
```

**Step 2b: Add compoundness × verdict stratification**

The compound-corpus experiment found 89% of "Partially supported" rows are compound (c≥2) and 74% of the dataset is compound overall. The atomized pipeline's core hypothesis is "atomization specifically helps compound-PS rows." Make this measurable.

If `workbench/compound-corpus/labels.json` is present, join against it to emit a compoundness × predicted-verdict × correctness cross-tab. Skip silently if absent (back-compatible — workbench/ is local-only, not bundled in CI).

```js
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Resolve the labels.json path relative to this file's location.
// analyze_results.js lives in citation-checker-script/benchmark/, and
// labels.json lives at the workspace root in workbench/compound-corpus/labels.json.
// Walk up 3 levels: benchmark/ → citation-checker-script/ → alex-cite-checker/
const LABELS_PATH = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..', '..', 'workbench', 'compound-corpus', 'labels.json'
);

let labelsById = null;
if (existsSync(LABELS_PATH)) {
    try {
        const parsed = JSON.parse(readFileSync(LABELS_PATH, 'utf8'));
        const rows = parsed.rows ?? parsed;   // tolerate {metadata, rows} or bare array
        labelsById = Object.fromEntries(rows.map(r => [r.entry_id, r]));
    } catch (e) {
        // Malformed labels.json — skip silently rather than crash the analyzer.
        console.warn(`compound-corpus labels.json present but unreadable: ${e.message}`);
    }
}

if (labelsById) {
    // Cross-tab: compoundness bucket (c=1 / c=2 / c=3+) × verdict bucket × correctness
    const buckets = { 1: [], 2: [], '3+': [] };
    for (const r of results) {
        const label = labelsById[r.entry_id];
        if (!label) continue;                  // row not labeled — skip
        const key = label.compoundness >= 3 ? '3+' : String(label.compoundness);
        if (!buckets[key]) continue;
        buckets[key].push(r);
    }

    console.log('\nCompoundness × verdict cross-tab (corpus labels):');
    for (const key of ['1', '2', '3+']) {
        const rs = buckets[key];
        if (rs.length === 0) continue;
        const correct = rs.filter(r => r.correct).length;
        const pct = (correct / rs.length * 100).toFixed(1);
        // Per-verdict breakdown
        const byVerdict = {};
        for (const r of rs) {
            const v = r.predicted_verdict ?? 'UNKNOWN';
            byVerdict[v] = (byVerdict[v] || 0) + 1;
        }
        const verdictStr = Object.entries(byVerdict)
            .map(([v, n]) => `${v}: ${n}`)
            .join(', ');
        console.log(`  c=${key}: ${rs.length} rows, ${correct} correct (${pct}%) — ${verdictStr}`);
    }
}
```

This makes "does atomization specifically improve compound rows?" answerable from any `results.json` without rerunning anything.

**Step 3: Run analyze on the existing baseline results.json**

The current `benchmark/results.json` is from before Phase 6 wiring — it has no `atoms` field. The atom-count block should print nothing (or "0 rows with atoms"). Run analyze to confirm it doesn't crash:

```bash
cd benchmark
node analyze_results.js
```

Expected: standard analysis output; the new atom-count block prints nothing (or a "no atomized rows" line) without crashing.

---

## Task 4: Add npm scripts for atomized cells

**Files:**
- Modify: `benchmark/package.json`

**Step 1: Add scripts**

Find the existing `scripts` block in `benchmark/package.json`. Add:

```json
{
  "scripts": {
    // ... existing scripts ...
    "benchmark:atomized":      "node run_benchmark.js --atomized --rollup-mode=deterministic",
    "benchmark:atomized-judge": "node run_benchmark.js --atomized --rollup-mode=judge",
    "benchmark:smoke20":       "node run_benchmark.js --atomized --rollup-mode=deterministic --providers=claude-sonnet-4-5 --limit=20"
  }
}
```

**Step 2: Verify**

Run: `cd benchmark && npm run | grep benchmark`
Expected: the three new scripts listed alongside the existing ones.

---

## Task 5: 20-row smoke run

This is operational, not a test commit. **The user runs this**, not the implementation agent. The implementation should land the wiring (Tasks 1-4 + Task 6 commit) and stop; the smoke run is the validation gate.

**Step 1: Set environment**

```bash
export ANTHROPIC_API_KEY="..."  # or load from workbench/.env
```

**Step 2: Run the smoke**

```bash
cd benchmark
npm run benchmark:smoke20
```

Expected (per the design plan's "Done when"):
- Exits without errors
- Atom output on those 20 rows is plausibly correct: median atom count 1-4; provenance atoms emitted only for claims with explicit attribution
- A `results.json` is produced with the new `atoms`, `atomResults`, `rollupMode` fields populated

**Step 3: Eyeball the atoms**

```bash
node -e "
  const r = require('./results.json');
  for (const row of r.results.slice(0, 20)) {
    console.log(row.entry_id, '→', row.predicted_verdict, '(GT:', row.ground_truth + ')');
    if (Array.isArray(row.atoms)) {
      for (const a of row.atoms) console.log('  -', a.kind, a.assertion);
    }
  }
"
```

Expected output: every row's `atoms` array is non-empty. Compound claims produce multiple atoms (mix of content + provenance). Simple claims produce a single content atom.

**Step 4: Compare to control**

```bash
cd benchmark
npx ccs compare \
    ../.worktrees/body-classifier-bench/benchmark/results.json \
    ./results.json \
    --dataset ./dataset.json
```

Expected: `ccs compare` runs cleanly (output may be small since only 20 rows). Per-provider delta is for `claude-sonnet-4-5` only.

---

## Task 6: Commit

**Step 1: Stage**

```bash
git add benchmark/run_benchmark.js benchmark/analyze_results.js benchmark/package.json \
        tests/benchmark_atomized.test.js
```

If `benchmark/results.json` was overwritten by the smoke run, **DO NOT commit it** — that's an operational artifact, not source. Run `git status --short` and confirm.

**Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
benchmark: wire atomized pipeline through run_benchmark + analyze_results

- run_benchmark.js: --atomized (default) / --no-atomized, --rollup-mode
  {deterministic|judge}, --small-atomizer flags. Calls verify() from
  core/worker.js per row. Per-row results.json rows gain atoms,
  atomResults, rollupMode, judgeReasoning fields (in addition to the
  existing verdict, correct, ground_truth, etc.).
- analyze_results.js: atom-count distribution block — rows with atoms,
  median, % single-atom, % >3 atoms, max. Skips silently when no rows
  have atoms (back-compatible with pre-atomized results.json).
- benchmark/package.json: new scripts benchmark:atomized,
  benchmark:atomized-judge, benchmark:smoke20.
- tests/benchmark_atomized.test.js: smoke test asserting
  benchmark/run_benchmark.js imports cleanly after the changes.

End-to-end smoke (20-row Sonnet 4.5 run) is the operational gate, not
asserted in tests — that's the next iteration's input. After smoke,
expect to revisit prompt text and atom-count distribution before
running the full panel (Phases 7-8 in the design).

Tests: 266+/266+ passing. main.js in sync.
EOF
)"
```

**Step 3: Verify**

Run: `git log -1 --stat`
Expected: 4 files changed.

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: pass = tests; fail = 0.

Run: `npm run build -- --check`
Expected: in sync (no core/ changes in this phase).

---

**Phase 6 done when:**
- `npm test` passes (266+ tests, 0 failures)
- `npm run build -- --check` exits 0
- `benchmark/run_benchmark.js` accepts `--atomized` / `--no-atomized`, `--rollup-mode`, `--small-atomizer` flags
- `npm run benchmark:smoke20` completes without errors (manual operational check by user) and produces `results.json` with populated `atoms`, `atomResults`, `rollupMode` fields on every row
- `node analyze_results.js` over the smoke `results.json` prints an atom-count distribution
- `npx ccs compare` between `body-classifier-bench/benchmark/results.json` and the smoke `results.json` renders cleanly (per-provider delta on Sonnet for the 20 rows)
- The smoke output is reviewed (atom shape is sane, no obvious format errors) — the user judges whether to proceed to Phases 7-8 in a follow-up plan or iterate on prompts first

---

## Notes for the user, post-smoke

The design plan says: *"After smoke, expect to revisit prompt text and atom-count distribution before running the full panel (Phases 7-8 in the design)."* You explicitly noted this when choosing scope: *"after the first test we'll have to rework everything anyway."*

Things worth eyeballing on the smoke output:
1. **Atom count distribution.** If median is 1 across all 20 rows, the atomizer is collapsing things — prompt may need tightening. If median is >4, it's over-splitting (e.g., decomposing a single fact into multiple atoms).
2. **Provenance atoms.** They should appear only when the claim cites a publication/author. If they appear on rows where the claim doesn't mention provenance, the atomizer prompt needs sharpening.
3. **Small-model Granite-4.1-8B fit.** The smoke is Sonnet only; for a Granite check, run `--providers=openrouter-granite-4.1-8b` with `--limit=20`. Compare atom output between Sonnet and Granite — Granite should produce roughly the same atoms; if not, the prompt's structural cues need more reinforcement.
4. **Compare-result deltas.** Even with 20 rows, `ccs compare` will surface flip directions. Are flips going SUPPORTED→PARTIALLY SUPPORTED (good — atomization catching mixed claims) or PARTIALLY SUPPORTED→NOT SUPPORTED (bad — atomizer over-decomposing into atoms that all fail)?

Phases 7-8 of the design (agent eval infrastructure + full panel + comparison report + ship-bar decision) are deferred to a follow-up implementation plan. File a new design-plan amendment or a new short plan when ready.
