# Prompt refactor + Citoid metadata augmentation

> **Status (2026-05-05):** In progress. Code is on branch `prompt-refactor-citoid`; userscript-side integration deferred pending Sonnet regression investigation (see "Open issues" below).

## Summary

Two coupled changes that together deliver +9pp exact-match accuracy on DeepSeek and +9pp / +5pp binary on Gemini, against a small (−4pp) regression on Sonnet that is documented as a known follow-up.

1. **Prompt refactor (`core/prompts.js`).** Replaces the existing system prompt with a content-required, two-step framing. The `confidence` field is removed from the response JSON; verdicts are determined by what the source body says, not by a confidence-to-verdict mapping. The new prompt also documents an optional bibliographic metadata block at the top of source text (provenance, not evidence) so that augmented and unaugmented sources both work.

2. **Citoid metadata augmentation (`core/citoid.js`).** A new module that fetches Wikimedia Citoid metadata for each source URL and prepends a five-field JSON header (publication, published, author, title, url) to the source text before the LLM call. Failures are silent — the source text passes through unchanged when Citoid returns nothing useful, so augmentation is purely additive.

Both changes are wired into `benchmark/run_benchmark.js` (default ON; opt out with `CITOID_AUGMENT=0`). Userscript-side wiring (`main.js`) is deliberately deferred to a follow-up commit.

## Before / after

Comparison set: the historical baseline (`benchmark/historical-runs/2026-04-19-results.json`, generated under the current `main.js` prompt with no augmentation) vs. this branch's prompt + augmentation, run end-to-end on the same 187-row v1+v2+v3 dataset.

### Exact-match accuracy

| Provider | n | Before | After | Δ exact |
|---|---:|---:|---:|---:|
| DeepSeek V3.2 | 187 | 50.8% | 59.9% | **+9.1pp** |
| Claude Sonnet 4.5 | 187 | 51.3% | 47.1% | **−4.3pp** ⚠️ |
| Gemini 2.5 Flash | 158 | 63.3% | 70.3% | **+7.0pp** |

### Binary (support / no-support) accuracy

| Provider | n | Before | After | Δ binary |
|---|---:|---:|---:|---:|
| DeepSeek V3.2 | 187 | 85.6% | 81.8% | −3.7pp |
| Claude Sonnet 4.5 | 187 | 82.9% | 79.1% | −3.7pp |
| Gemini 2.5 Flash | 158 | 79.7% | 84.8% | **+5.1pp** |

### Notes on the comparison

- **Apples-to-apples.** Each provider's `n` is the intersection of entries with valid (non-error) verdicts in both the historical baseline and this branch's run. Sonnet and DeepSeek had zero errors. Gemini hit transient HTTP 503s ("model experiencing high demand") at run time, reducing its `n`; the post-intersection number is reported.
- **What "after" includes.** Both the prompt change and the Citoid augmentation, applied together. Decomposition runs (prompt only / augmentation only) were performed during the design-validation phase and inform the design choices; raw deltas for those isolated configurations are in the workbench analysis at `workbench/citoid-validation/full-matrix.mjs` (out of repo).

## Open issues

### Sonnet regression (−4.3pp exact, −3.7pp binary)

Sonnet is the one provider that regresses on the macro view in this branch. Investigation findings (see `workbench/citoid-validation/investigate-sonnet-regression.mjs`):

- 26 regressions vs 18 improvements (net −8 of the 187 rows).
- 25 of 26 regressions are "tightening" — Sonnet moves *down* the verdict ladder (e.g., `Supported` → `Partially Supported`).
- Dominant verdict shift: `support → partial`, 31 cases.
- Inspecting 8 sample regression rows: ~5 of 8 are pure over-cautiousness (the `before` and `after` comments cite the *same* body evidence, just downgraded); the remaining ~3 are arguably *more correct* under a stricter literal-match standard but cost benchmark points because the GTs were calibrated for a more generous reading.

A "v2" prompt iteration that added an explicit anti-PS rule + alternative few-shot examples did not close the gap and broke Gemini's lift; that iteration was dropped.

**Status of the userscript ship:** the userscript-side integration of Citoid is deferred until the Sonnet regression is either resolved (e.g., by a v3 prompt iteration that targets the over-cautiousness pattern more carefully) or accepted as a tradeoff worth shipping (DeepSeek and Gemini gains, Sonnet small loss).

### What's not in this branch yet

- **Userscript integration (`main.js`).** The `core/citoid.js` module is browser-safe (uses standard `fetch`), but the call site in `verifyClaim` is not wired up. To be added once the Sonnet question is resolved.
- **Userscript build sync.** `main.js` injects core modules between `<core-injected>` markers via the build script. The script handles `claim.js` / `parsing.js` / `prompts.js` / `providers.js` / `urls.js` / `worker.js` today; adding `citoid.js` to that list (or its own marker block) is part of the userscript-integration commit.
- **Proxy considerations.** Userscript will fetch Citoid directly from `en.wikipedia.org/api/rest_v1/...`. If browser CORS is restrictive in production, the call may need to be mediated through `publicai-proxy`. Worth verifying before the userscript-integration commit.

## Alternatives considered

### Confidence-coupled verdicts, kept

The previous prompt mapped a numeric `confidence` (0–100) directly to verdict rungs (≥80 = SUPPORTED, etc.). This made the metadata header act as a confidence prior that translated mechanically into verdict shifts — helpful on date-bearing claims but harmful elsewhere. Removing the confidence field decouples the verdict from a confidence-to-rung mapping; verdicts are decided by what the body says.

### Augmentation conditional on a date-detector

We considered gating Citoid augmentation on the *claim* containing a date pattern (regex match for `Month YYYY` or similar). Subset analysis showed that the date-claim subset was where the lift concentrated. A claim-side filter would skip ~80% of Citoid traffic and avoid the non-date regression risk. We chose unconditional augmentation for v1 because under the new prompt the non-date regression is largely neutralized — making the filter complexity unnecessary. Worth revisiting if the production traffic cost of unconditional fetching becomes a concern.

### Pre-augment dataset.json offline

We considered adding a one-shot Citoid pass to `extract_dataset.js` and shipping a pre-augmented `dataset.json`. This would make benchmark runs faster and network-independent. We chose runtime augmentation in `run_benchmark.js` instead — it matches the userscript's runtime behavior, keeps `dataset.json` clean of derived data, and exercises the same `core/citoid.js` code path that production will use.

## Files changed

- **`core/prompts.js`** — replaced. Two-step source-check / claim-verification framing; `confidence` field removed from response JSON; explicit metadata-as-provenance guidance.
- **`core/citoid.js`** — new module. Pure ESM; uses standard `fetch`; browser-safe.
- **`benchmark/run_benchmark.js`** — imports `augmentWithCitoid`, calls it before `generateUserPrompt`. Default ON; `CITOID_AUGMENT=0` disables.

## Replay command

```sh
. <(grep '^OPENROUTER_API_KEY=\|^ANTHROPIC_API_KEY=\|^GEMINI_API_KEY=' /path/to/.env)
export OPENROUTER_API_KEY ANTHROPIC_API_KEY GEMINI_API_KEY
cd benchmark
node run_benchmark.js \
  --providers=openrouter-mistral-small-3.2,openrouter-olmo-3.1-32b,openrouter-deepseek-v3.2,claude-sonnet-4-5,gemini-2.5-flash \
  --version all
```

To compare against the historical baseline without augmentation:

```sh
CITOID_AUGMENT=0 BENCHMARK_PROMPT_OVERRIDE_FILE=benchmark/historical-runs/2026-04-19-prompt.txt \
  node run_benchmark.js --providers=... --version all
```
