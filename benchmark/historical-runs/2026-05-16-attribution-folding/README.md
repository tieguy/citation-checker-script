# Attribution-folding atomized pipeline — full panel run + control comparison (2026-05-16)

Empirical evidence backing the second-measurement Results section of [`docs/design-plans/2026-05-13-fresh-prompt-rewrite.md`](../../../docs/design-plans/2026-05-13-fresh-prompt-rewrite.md).

## What this measures

Isolates the **simplified atomized verification pipeline** (no content/provenance atom split, verifier sees metadata + body together, in-text attribution folded into content atoms) against the prior atomized pipeline (which used a content/provenance kind tag, gated provenance verification on citoid metadata coverage, and split in-text attribution into multiple atoms).

| Run | Code | Atomizer | Verifier | Atomizer prompt | Rollup |
|---|---|---|---|---|---|
| `results-control-atomized-original.json` | prior treatment-side from `2026-05-15-atomized-pipeline/` | `claude-haiku-4-5` | kind-gated (Rule 3 active; provenance atoms only see metadata) | original (decomposes in-text attribution into separate author/year/publication atoms) | `deterministic` |
| `results-treatment-attribution-folding.json` | this branch | `hf-deepseek-v3` (`deepseek-ai/DeepSeek-V3`) | uniform (no kind branch; metadata + body shown together for every atom) | new (in-text attribution folded into content atom; multi-fact content claims still decompose; shared-predicate lists stay one atom) | `deterministic` |

Both runs:

- 189-row dataset (176 complete + 9 body_unusable → pipeline-attributed SU + 4 source_fetch_failed → error rows).
- Same dataset and same body-classifier short-circuit on the 9 body_unusable rows.
- Atomizer (Haiku in control; DeepSeek-V3 in treatment) outputs cached and reused across all panel members, so atomization is paid once per row, not once per (row, provider).
- 7-provider headline panel in control (HF: Qwen3-32B, gpt-oss-20b, DeepSeek-V3; OpenRouter: Mistral Small 3.2, Granite 4.1-8B, Gemma 4-26B-A4B, Qwen 3-32B). Treatment uses the same panel minus `hf-gpt-oss-20b`, which is omitted because its upstream response format changed (the answer now lives in `message.reasoning` rather than `message.content`, requiring a separate client fix — out of scope for this comparison).

## Files

| File | Contents |
|---|---|
| `results-control-atomized-original.json` | 9 providers × 185 rows, original atomized pipeline (Haiku atomizer, kind-gated verifier). Byte-identical to the prior `2026-05-15-atomized-pipeline/results-treatment-atomized.json`. |
| `results-treatment-attribution-folding.json` | 6 providers × 185 rows, simplified pipeline (DeepSeek-V3 atomizer, uniform verifier). Snapshot of `benchmark/results.json` at the time the Results section was written. |
| `compare.md` | `ccs compare` output: per-provider exact / lenient / binary deltas + per-cell flip table over the 1055-cell intersection. |

## How they were generated

```sh
# Phase 1: atomize via DeepSeek-V3 only — populates the cache that the
# rest of the panel reuses. (DeepSeek-V3 is the largest of the HF panel
# members; the atom-count distribution it produces matches Haiku at the
# same atomizer prompt — 2.60 atoms/row vs 2.66 — without requiring an
# Anthropic credit for the atomization step.)
PAP_URL=https://publicai-proxy.alaexis.workers.dev \
  node benchmark/run_benchmark.js \
    --providers=hf-deepseek-v3 \
    --atomized --rollup-mode=deterministic \
    --concurrency=3
cp benchmark/results.json /tmp/atoms-cache-hf-deepseek-2026-05-15.json

# Phase 2: rest of the panel reuses the atoms cache (one atomization per
# row, not one per (row, provider)).
PAP_URL=https://publicai-proxy.alaexis.workers.dev \
  node benchmark/run_benchmark.js \
    --providers=hf-qwen3-32b,openrouter-mistral-small-3.2,openrouter-granite-4.1-8b,openrouter-gemma-4-26b-a4b,openrouter-qwen-3-32b \
    --atomized --rollup-mode=deterministic \
    --atoms-cache=/tmp/atoms-cache-hf-deepseek-2026-05-15.json \
    --resume --concurrency=3

# Comparison:
node bin/ccs compare \
  benchmark/historical-runs/2026-05-16-attribution-folding/results-control-atomized-original.json \
  benchmark/historical-runs/2026-05-16-attribution-folding/results-treatment-attribution-folding.json \
  --dataset benchmark/dataset.json \
  --change-axis prompt --change-axis atomizer \
  --report benchmark/historical-runs/2026-05-16-attribution-folding/compare.md
```

## Headline

Simplified pipeline holds the binary metric within noise on every shared provider and gains exact-match accuracy on five of six:

- **Binary accuracy (Class A = {Supported, Partially supported} vs Class B = {Not supported, Source unavailable}):** every provider within ±5pp of control. Worst: gemma-4-26b-a4b at −2.8pp; best: hf-deepseek-v3 at +2.8pp.
- **Exact-match accuracy:** five of six providers outside noise floor in the positive direction. Headline: hf-deepseek-v3 +6.8pp; hf-qwen3-32b +5.7pp; openrouter-granite-4.1-8b +5.1pp; openrouter-qwen-3-32b +5.1pp; openrouter-mistral-small-3.2 +2.8pp; openrouter-gemma-4-26b-a4b +0.6pp.
- **Per-cell flips:** 115 improvements (control wrong → treatment right) vs 69 regressions over 1055 compared cells. Net +46 cells in the right direction.

The full per-row flip listing is in [`compare.md`](./compare.md).

## What this does *not* show

- **gpt-oss-20b cell.** Upstream model now emits answer content in `message.reasoning` with empty `message.content`, breaking the OpenAI-compatible chat-completion parser. Needs a client fix that either reads `reasoning` as a fallback or disables reasoning output via a request parameter. Out of scope for this prompt-and-atomizer-pipeline change.
- **Claude Sonnet 4.5 / Gemini 2.5 Flash cells.** Treatment-side panel did not include these providers (HF + OpenRouter only). Control includes them but they are excluded from the intersection.
- **Judge rollup.** Only `--rollup-mode=deterministic` was run on both sides. The judge path is wired and tested but not measured here.
- **Source-truncation cases.** Where the scraper returned the first 12k chars and the supporting content is past that cutoff (e.g., the MPI statistics pages used in row_3 and row_5), the verifier cannot recover. A query-aware fetch (PR #114 + PAP #8) or sectioned-reading mode is the upstream fix.
