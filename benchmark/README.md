# Citation Verification Benchmark Suite

Tools for comparing LLM performance on Wikipedia citation verification tasks.

## Overview

This benchmark suite allows you to:
1. Extract claim/source pairs from Wikipedia articles based on ground truth data
2. Run multiple LLMs on the same dataset for fair comparison
3. Analyze results with detailed accuracy metrics

## Prerequisites

```bash
cd benchmark
npm install
```

## Workflow

### Step 1: Extract Dataset

Convert the ground truth CSV into a complete dataset with claim text and source content:

```bash
# Dry run first to see what will be fetched
npm run extract:dry

# Extract full dataset
npm run extract

# Verbose mode to see detailed logging
node extract_dataset.js --verbose
```

This creates:
- `dataset.json` - Complete enriched dataset
- `dataset_review.csv` - CSV for manual review

### Step 2: Manual Review (Important!)

Before running benchmarks, review `dataset_review.csv`:

1. Open in a spreadsheet editor
2. Check entries where `needs_manual_review` is `true`
3. Verify claim text is correct (especially for multiple occurrences of same citation)
4. Fill in `manual_claim_override` or `manual_source_override` if needed
5. Save changes

**Why manual review?**
- The same citation [N] can appear multiple times supporting different claims
- Automated extraction may not perfectly identify claim boundaries
- Some sources may be behind paywalls or unavailable

### Step 3: Run Benchmark

Set API keys as environment variables:

```bash
export PUBLICAI_API_KEY="..."   # Required for PublicAI models
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="..."
```

Run benchmark:

```bash
# All available providers
npm run benchmark

# Specific providers only
node run_benchmark.js --providers=claude,openai

# Limited entries for testing
node run_benchmark.js --limit 10

# Resume interrupted benchmark
node run_benchmark.js --resume
```

Available providers:
- `publicai` - Free, no API key required
- `claude` - Requires ANTHROPIC_API_KEY
- `openai` - Requires OPENAI_API_KEY
- `gemini` - Requires GEMINI_API_KEY

### Step 4: Analyze Results

```bash
# Console summary
npm run analyze

# Generate markdown report
npm run report
```

## Output Files

| File | Description |
|------|-------------|
| `dataset.json` | Enriched dataset with claim/source text (uses `{metadata, rows}` shape — see "Reproducibility metadata" below) |
| `dataset_review.csv` | CSV for manual verification |
| `results.json` | Raw benchmark results (uses `{metadata, rows}` shape) |
| `analysis.json` | Calculated metrics |
| `report.md` | Human-readable report |
| `historical-runs/` | Reference data: past userscript prompts re-scored against the current dataset via the `BENCHMARK_PROMPT_OVERRIDE_FILE` mechanism. See `historical-runs/README.md`. |

## Dataset Versions

`Benchmarking_data_Citations.csv` carries a `Dataset version` column so the
ground-truth set can grow without losing the ability to reproduce earlier
analyses.

- `v1` — the original 76 rows used for the published benchmark.
- `v2` — 34 negative-class additions (mostly "Not supported" / "Partially
  supported") that broaden topic coverage.
- `v3` — 79 rows imported from the WMF source-verification annotation
  dataset (per-row provenance: `human-annotation:source-verification-2026-04-25`).
  These rows were re-audited under the strict-rubric WP:V/WP:CITE methodology
  on 2026-04-30; the post-audit verdict distribution is in `analysis_v3.json`.

The `dataset_version` field is propagated into each `dataset.json` entry and
each script accepts a `--version v1|v2|v3|all` filter (default: `all`).

### Override columns for externally-imported rows

`Benchmarking_data_Citations.csv` carries three additional columns used only
when a row's claim/source data was imported from outside the Wikipedia
extraction pipeline (currently: v3 / WMF rows):

| Column | Purpose |
|--------|---------|
| `WMF claim text` | Replaces `extractClaimText()` output for this row |
| `WMF source URL` | Replaces the URL discovered in the article's cite_note |
| `WMF provenance` | Populates the `provenance` field on the dataset entry |

When a row has both `WMF claim text` and `WMF source URL` filled,
`extract_dataset.js` skips the article fetch for that row entirely — the row's
claim and source identity comes from the CSV, and only the source content is
fetched fresh. v1 and v2 rows leave these columns blank and behave exactly
as before.

### Reproducing the original v1 analysis

Frozen snapshots of the published v1 pipeline are committed alongside the
mutable working files:

| Snapshot | Description |
|----------|-------------|
| `dataset_v1.json` | v1 enriched dataset at extraction time |
| `results_v1.json` | v1 raw LLM results |
| `analysis_v1.json` | v1 calculated metrics |
| `results_comparison_v1.csv` | v1 per-row comparison |
| `dataset_v3.json` | v3 dataset slice at strict-rubric audit completion (2026-04-30) |
| `results_v3.json` | v3 LLM results against the post-audit ground truth |
| `analysis_v3.json` | v3 calculated metrics |

Re-derive the v1 or v3 metrics from the snapshots without touching the current
files:

```bash
npm run analyze:v1-snapshot   # writes analysis_v1_recomputed.json
npm run analyze:v3-snapshot   # writes analysis_v3_recomputed.json
```

Re-run the full v1 pipeline (network + API keys required; LLM calls are
non-deterministic so numbers may drift slightly):

```bash
npm run extract:v1     # writes dataset.json filtered to v1 rows
npm run benchmark:v1   # writes results.json for v1 entries only
npm run analyze:v1     # writes analysis.json over v1 results
```

The same flags apply for v3 (`extract:v3`, `benchmark:v3`, `analyze:v3`).

Working with the expanded v1 + v2 + v3 set is the default — just run `npm run
extract`, `npm run benchmark`, and `npm run analyze` with no flags.

## Reproducibility metadata

`dataset.json` and `results.json` (plus any new frozen `*_vN.json` snapshots
written from now on) carry a `metadata` block alongside their row data so each
artifact attributes itself to a date. The shape is:

```jsonc
{
  "metadata": {
    // results.json fields
    "run_at": "2026-05-02T15:30:00Z",       // ISO timestamp of run start
    "prompt_date": "2026-05-02",            // YYYY-MM-DD; the date the prompt
                                            //   was effective (assumes
                                            //   core/prompts.js was at HEAD)
    "prompt_source": "core/prompts.js",     // path to the prompt used; equals
                                            //   the value of
                                            //   BENCHMARK_PROMPT_OVERRIDE_FILE
                                            //   when overriding for replay
    "dataset_extracted_at": "2026-04-30",   // copied from dataset.json's own
                                            //   metadata at run time
    "dataset_version_filter": "v1",         // value of --version flag

    // dataset.json fields
    "extracted_at": "2026-04-30",           // YYYY-MM-DD of extraction
    "version_filter": "all"                 // value of --version flag
  },
  "rows": [ /* same row shape as before */ ]
}
```

This is a **deliberate MVP** — date-based, not git-SHA-based. Reproducibility
is best-effort: to know what the prompt was on `2026-05-02`, run `git log --
core/prompts.js`. If you ran with uncommitted local edits, `prompt_date`
records when the run happened, not what was in the prompt at that moment;
that's on you to remember.

**Not captured** (deliberately, for now): the proxy version that produced
`source_text`, individual git SHAs of touched files, model API
sub-versions, OS environment. Add these only when a real reproducibility
question makes them load-bearing.

### Backward compatibility

Frozen historical snapshots (`dataset_v1.json`, `results_v1.json`,
`analysis_v1.json`) are kept in their legacy bare-array shape. All readers
(`run_benchmark.js`, `analyze_results.js`, `generate_comparison.js`) accept
both shapes via `benchmark/io.js`'s `loadRows()` helper, so older snapshots
keep working without migration.

### Historical-prompt replay

The benchmark can score a past version of the userscript prompt against
the current dataset, to answer questions like *"how would today's models
have done with the prompt we shipped on date X?"* — useful for measuring
the impact of past prompt changes, or for sanity-checking whether a
proposed prompt edit actually moves verdict accuracy.

Recover the historical prompt from git and run the benchmark with two
env vars:

```bash
# 1. Recover the prompt at a historical SHA
git show 16f365a:main.js | \
  awk '/generateSystemPrompt/,/^[[:space:]]*}[[:space:]]*$/' | \
  awk '/return `/,/`;/' | sed '1s/^[^`]*`//; $s/`;.*$//' \
  > /tmp/january-prompt.txt

# 2. Run the benchmark with the override + historical date for metadata
BENCHMARK_PROMPT_OVERRIDE_FILE=/tmp/january-prompt.txt \
BENCHMARK_PROMPT_DATE=2026-01-20 \
  node run_benchmark.js --providers=claude-sonnet-4-5,gemini-2.5-flash --version all
```

Each result row's `metadata.prompt_date` and `metadata.prompt_source` will
record the historical date and the override path so the run is attributable.

`benchmark/historical-runs/` contains a worked example: the
2026-01-20 and 2026-04-19 userscript prompts run against the v1+v2+v3
dataset (5 models, zero errors), plus a side-by-side comparison report.
See `benchmark/historical-runs/README.md`.

### Where the prompt lives

`core/prompts.js` is the **single source of truth** for both the system
prompt and the user prompt — used by the userscript (`main.js`), the CLI
(`bin/ccs` / `cli/verify.js`), and the benchmark (via direct ESM import).
`tests/benchmark_prompt_unification.test.js` guards against re-divergence.

The benchmark calls `core.generateUserPrompt(claim, sourceText)` directly —
the same function the userscript and CLI use. In those other paths,
callers pass a `sourceInfo` string that sometimes carries
`Source URL: <url>\n\nSource Content:\n<text>` metadata, which the
function strips via its `Source Content:` regex. The benchmark already
has clean `source_text` and just passes that, falling through to core's
pass-through branch with byte-identical output. Either way the model
receives `Claim: "<claim>"\n\nSource text:\n<text>` — never the URL.

## Metrics Explained

- **Exact Accuracy**: Predicted verdict exactly matches ground truth
- **Lenient Accuracy**: Includes cases where "Supported" ↔ "Partially supported"
- **Binary Accuracy**: Correct on support vs. no support (ignoring partial)
- **Confidence Calibration**: Higher confidence on correct predictions = better calibrated

## Handling Multiple Occurrences

When the same citation appears multiple times (e.g., `[5]` used 3 times):

1. Each occurrence is tracked separately with an `occurrence` field
2. The extractor attempts to identify the specific claim for each occurrence
3. Manual review is recommended for accuracy

Example in dataset.json:
```json
{
  "citation_number": 5,
  "occurrence": 1,
  "claim_text": "First claim citing [5]..."
},
{
  "citation_number": 5,
  "occurrence": 2,
  "claim_text": "Second claim citing [5]..."
}
```

## Adding New LLM Providers

Edit `run_benchmark.js` and add to the `PROVIDERS` object:

```javascript
newprovider: {
    name: 'New Provider',
    model: 'model-name',
    endpoint: 'https://api.example.com/v1/chat',
    requiresKey: true,
    keyEnv: 'NEW_PROVIDER_API_KEY'
}
```

Then implement a `callNewProvider()` function following the pattern of existing providers.
