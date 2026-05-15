# Atomized pipeline — full panel run + control comparison (2026-05-15)

Empirical evidence backing the Results section of [`docs/design-plans/2026-05-13-fresh-prompt-rewrite.md`](../../../docs/design-plans/2026-05-13-fresh-prompt-rewrite.md).

## What this measures

Isolates the **atomized verification pipeline (atomize → verify-atoms → rollup)** against the legacy single-call verifier, both running on the same substrate (`origin/main` + #203 citoid header + #217 body-usability classifier). The body-classifier is active on both sides — its 9 short-circuited rows are pipeline-attributed `Source unavailable` in both runs, so it isn't a free variable in the comparison.

| Run | Code | Verifier | Prompt | Rollup |
|---|---|---|---|---|
| `results-control-legacy-singlecall.json` | body-classifier-bench branch (≈ integration base) | `verifyClaim` (single LLM call) | legacy `generateSystemPrompt` from `core/prompts.js` | n/a |
| `results-treatment-atomized.json` | `fresh-prompt-on-217` (this branch) | `verifyClaimAtomized` (atomize + verify each atom + rollup) | new atomizer/verifier/judge prompts in `core/prompts.js` (WP:V-grounded) | `deterministic` |

Both runs:

- 189-row dataset (176 complete + 9 body_unusable → pipeline-attributed SU + 4 source_fetch_failed → error rows), post-#205 ground-truth corrections.
- 9-provider headline panel: Claude Sonnet 4.5, Gemini 2.5 Flash, OpenRouter {Mistral Small 3.2, Granite 4.1-8B, Gemma 4-26B-A4B, Qwen 3-32B}, HF {Qwen3-32B, gpt-oss-20b, DeepSeek-V3}. (`openrouter-olmo-3.1-32b` disabled — sub-100ms empty responses on the OR route.)
- Concurrency 3 per host. Deterministic rollup mode. Atomizer (Haiku) outputs cached in `/tmp/atoms-cache-haiku-2026-05-15.json` and reused across all panel members so the atomize stage is paid once per row, not once per (row, provider).

The control was run 2026-05-14 on the `body-classifier-bench` worktree (pre-merge integration base + the #217 commits being prepared for upstream review). The treatment was run 2026-05-15 on `fresh-prompt-on-217` after the rebase + cherry-picks documented in `workbench/HANDOFF.md`.

## Files

| File | Contents |
|---|---|
| `results-control-legacy-singlecall.json` | 10 providers × 185 rows, legacy single-call verifier. Identical (byte for byte) to `body-classifier-bench/benchmark/results.json`. |
| `results-treatment-atomized.json` | 9 providers × 185 rows, atomized pipeline. Snapshot of `benchmark/results.json` at the time the Results section was written. |
| `compare.md` | `ccs compare` output: per-provider exact / lenient / binary deltas + per-cell flip table over the 1554-cell intersection. |
| `recall_table.py` | Reproduces the recall + editor-FP table in the design plan's Results section. `python3 recall_table.py` from this directory. |

## How they were generated

```sh
# From benchmark/, in citation-checker-script/.worktrees/fresh-prompt-rewrite/
# Atoms cache seeded from a prior fresh-prompt-rewrite run (170/176 complete rows
# already cached; the 6 missing rows were atomized inline by the Sonnet 4.5
# phase, which goes through providerConfig.smallModel = claude-haiku-4-5).

# Phase 1: Sonnet 4.5 + Haiku atomizer (populates the cache)
PAP_URL=https://publicai-proxy.alaexis.workers.dev \
  node run_benchmark.js \
    --providers=claude-sonnet-4-5 \
    --atomized --rollup-mode=deterministic \
    --atoms-cache=/tmp/atoms-cache-haiku-2026-05-15.json \
    --concurrency=3

# Phase 2: 4 OR + Gemini, reusing the atoms cache
PAP_URL=https://publicai-proxy.alaexis.workers.dev \
  node run_benchmark.js \
    --providers=gemini-2.5-flash,openrouter-mistral-small-3.2,openrouter-granite-4.1-8b,openrouter-gemma-4-26b-a4b,openrouter-qwen-3-32b \
    --atomized --rollup-mode=deterministic \
    --atoms-cache=/tmp/atoms-cache-haiku-2026-05-15.json \
    --resume --concurrency=3

# Phase 3: 3 HF providers (HF_TOKEN sourced)
PAP_URL=https://publicai-proxy.alaexis.workers.dev \
  node run_benchmark.js \
    --providers=hf-qwen3-32b,hf-gpt-oss-20b,hf-deepseek-v3 \
    --atomized --rollup-mode=deterministic \
    --atoms-cache=/tmp/atoms-cache-haiku-2026-05-15.json \
    --resume --concurrency=3

# Comparison
node bin/ccs compare \
  benchmark/historical-runs/2026-05-15-atomized-pipeline/results-control-legacy-singlecall.json \
  benchmark/historical-runs/2026-05-15-atomized-pipeline/results-treatment-atomized.json \
  --dataset benchmark/dataset.json \
  --change-axis verifier --change-axis prompt \
  --report benchmark/historical-runs/2026-05-15-atomized-pipeline/compare.md
```

## Headline

The atomized pipeline trades exact-match for recall on problem rows:

- **Recall (catches more problems).** On every panel member, atomized catches at least as many `Not supported` / `Partially supported` rows as legacy. Median gain across the panel ≈ +7 pp; biggest gains on Mistral (+19.6) and Granite (+13.9).
- **Editor-FP roughly flat or better.** On 7 of 9 panel members, the share of `Not supported` rows the panel wrongly accepted as `Supported` / `Partially supported` is flat or lower than legacy. Mistral's editor-FP drops from 52.1% to 18.8%. The two cells where editor-FP worsens (`hf-gpt-oss-20b` +6.8 pp, `openrouter-qwen-3-32b` +2.1 pp) start from already-low baselines (4.5% and 14.6%).
- **Exact-match regresses by 1–14 pp** across the panel. This is the deliberate cost: atomized is more willing to emit `Partially supported` on compound claims with partial evidence, which is correct against `Not supported` / `Partially supported` GT but wrong against `Supported` GT.

The full per-row flip listing is in [`compare.md`](./compare.md). The recall + editor-FP table is in the design plan; reproduce it via `python3 recall_table.py`.

## What this does *not* show

- **User-facing panel coverage.** The integration base ships `claude-sonnet-4-6` and `openrouter-nemotron-nano-9b-v2`, neither of which is in this run. Adding them is one fresh treatment-side sweep (no control re-run needed) but is out of scope for this comparison.
- **Judge rollup.** Only `--rollup-mode=deterministic` was run. The judge path is wired and tested but not measured here.
- **PublicAI cell.** The legacy single-call panel didn't include the `publicai` userscript-facing route either, so there's no apples-to-apples cell to compare; PublicAI's reliability issues (memory record `project_publicai_olmo_unreliable`) make this hard to measure even alone.
- **Ground-truth audit on atomized's new flips.** Some of the recall gains are real catches; some may be over-aggressive `Partially supported` emissions that an editor would also call `Supported`. A focused audit pass on the ~100 atomized improvements vs control would tighten the editor-FP numbers further.
