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
| `dataset.json` | Enriched dataset with claim/source text |
| `dataset_review.csv` | CSV for manual verification |
| `results.json` | Raw benchmark results |
| `analysis.json` | Calculated metrics |
| `report.md` | Human-readable report |

## Dataset Versions

`Benchmarking_data_Citations.csv` carries a `Dataset version` column so the
ground-truth set can grow without losing the ability to reproduce earlier
analyses.

- `v1` — the original 76 rows used for the published benchmark.
- `v2` — 34 negative-class additions (mostly "Not supported" / "Partially
  supported") that broaden topic coverage.

The `dataset_version` field is propagated into each `dataset.json` entry and
each script accepts a `--version v1|v2|all` filter (default: `all`).

### Reproducing the original v1 analysis

Frozen snapshots of the published v1 pipeline are committed alongside the
mutable working files:

| Snapshot | Description |
|----------|-------------|
| `dataset_v1.json` | v1 enriched dataset at extraction time |
| `results_v1.json` | v1 raw LLM results |
| `analysis_v1.json` | v1 calculated metrics |
| `results_comparison_v1.csv` | v1 per-row comparison |

Re-derive the v1 metrics from the snapshots without touching the current
files:

```bash
npm run analyze:v1-snapshot
# writes analysis_v1_recomputed.json — should match analysis_v1.json
```

Re-run the full v1 pipeline (network + API keys required; LLM calls are
non-deterministic so numbers may drift slightly):

```bash
npm run extract:v1     # writes dataset.json filtered to v1 rows
npm run benchmark:v1   # writes results.json for v1 entries only
npm run analyze:v1     # writes analysis.json over v1 results
```

Working with the expanded v1 + v2 set is the default — just run `npm run
extract`, `npm run benchmark`, and `npm run analyze` with no flags.

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
