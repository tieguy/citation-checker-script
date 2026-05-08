# PANEL_HF DeepSeek slot: V3.2 → V3

**Date:** 2026-05-08
**Change:** Replace `hf-deepseek-v3-2` (`deepseek-ai/DeepSeek-V3.2`) with `hf-deepseek-v3` (`deepseek-ai/DeepSeek-V3`) as the DeepSeek member of `PANEL_HF`.
**Data:** [`2026-05-08-deepseek-v3-2-to-v3-results.json`](./2026-05-08-deepseek-v3-2-to-v3-results.json) — 561 rows total: 187 V3.2 via HF (trunk prompt), 187 V3 via HF (trunk prompt), 187 V3.2 via OpenRouter (April-19 historical prompt — included to make the route discrepancy from PR #182's stand-in reproducible).

## TL;DR

DeepSeek-V3.2 emits a long chain-of-thought reasoning trace before producing the JSON envelope and routinely runs past the 1000-token completion budget, so the JSON never closes. **99 out of 171 rows for which the API surfaced `completion_tokens` hit the 1000-token cap exactly**, leaving the response unparseable. The result is that 90 of 187 dataset rows (48%) yield no usable verdict, scored as wrong by the analyzer.

DeepSeek-V3 (the original December 2024 release) predates DeepSeek's hybrid thinking-mode architecture and produces structured JSON output deterministically. **187 of 187 rows parse cleanly.** Exact-match accuracy on the full dataset rises from 37.4% to 47.1% (+9.7pp). Median latency drops from 12.1s to 3.9s.

## Headline numbers

| Metric | `hf-deepseek-v3-2` (current) | `hf-deepseek-v3` (proposed) | Delta |
|---|---:|---:|---:|
| Parseable verdicts | 97/187 (51.9%) | 187/187 (100%) | **+48.1pp** |
| Exact-match (all 187 rows) | 70/187 (37.4%) | 88/187 (47.1%) | **+9.7pp** |
| Binary accuracy (on parseable rows) | 81/97 (83.5%) | 160/187 (85.6%) | +2.1pp |
| Mean latency | 12.3s | 4.1s | −67% |
| Rows hitting `max_tokens=1000` cap | 99/171 (58%) | 0/187 | — |

## Why V3.2 fails

V3.2 is a hybrid reasoning model. Its chat template emits an extended chain of thought before producing the JSON envelope expected by `parseResponse` in `benchmark/run_benchmark.js`. The benchmark caps `completion_tokens` at 1000 (`BENCHMARK_MAX_TOKENS`). The reasoning trace alone routinely consumes that budget before the model reaches the JSON output, so the response is truncated mid-thought.

Failure-mode breakdown of the 90 unparseable V3.2 rows:

- **50 `PARSE_ERROR`** — regex fallback in `parseResponse` matched no canonical verdict label.
- **24 non-canonical strings** (e.g., `"based on what is provided"`, `"options"`, `"based on the entire claim"`) — regex picked up prompt-echo phrases mid-reasoning, the result is treated as a non-canonical verdict by `analyze_results.js`.
- **16 `ERROR`** — request-level failure (likely upstream provider timeout under reasoning-mode latency).

`completion_tokens` distribution on V3.2 rows where the API surfaced usage data: `mean=876, median=1000, max=1000, capped=99/171`. The bimodal distribution (cleanly-parsed responses well under cap, truncated responses pinned at exactly 1000) is the truncation signature.

## Why V3 works

DeepSeek-V3 is the original release (December 2024), pre-dating the hybrid thinking-mode architecture introduced in V3.1. It produces direct JSON responses without a reasoning trace. Empirically: zero parse failures across all 187 dataset rows, mean response latency 4.1s.

Verdict distribution on V3:

| Verdict | Count | Share |
|---|---:|---:|
| Supported | 112 | 59.9% |
| Source unavailable | 53 | 28.3% |
| Partially supported | 16 | 8.6% |
| Not supported | 6 | 3.2% |

## Why this didn't surface in PR #182

PR #182 (which added `PANEL_HF`) reported `hf-deepseek-v3-2` at 50.8% / 85.6% accuracy. Those numbers came from `openrouter-deepseek-v3.2` measured on the April-19 historical prompt, used as a stand-in under a footnoted assumption that *"routing affects cost/latency but not accuracy."* That stand-in was the only V3.2 data available at the time — `hf-deepseek-v3-2` was never measured directly via the HF route in the data committed in PR #182. The first end-to-end HF run was the 2026-05-06 stress-test control included in this artifact.

The routing assumption held for the OR deployment but broke for the HF deployment. OpenRouter's `deepseek/deepseek-v3.2` resolves to a downstream provider that serves V3.2 in non-reasoning mode (clean output, no truncations) — the April-19 stand-in data shows 95/187 = 50.8% with zero parse failures and a clean verdict distribution. HF Inference Providers' `deepseek-ai/DeepSeek-V3.2` resolves to a downstream provider that serves V3.2 in reasoning mode, which is where the 1000-token cap collisions come from.

The stand-in measurement was methodologically sound for the question PR #182 was answering (panel composition + voting works) and the caveat was disclosed in the footnote. It happened to misjudge V3.2 specifically because V3.2's behavior depends on a deployment-time configuration property that the stand-in route differs on. V3 is selected for this swap partly because it removes that dependency: V3 has no thinking-mode capability at all, so the parse-clean property holds regardless of which downstream provider HF routes to.

## Caveats

1. **DeepSeek-V3 calls "Not supported" only 6/187 times (3.2%)**, well below the dataset prior. This lenient skew is consistent across the DeepSeek-V3 family on this benchmark and may understate the model's contribution to the panel on adversarial-row detection. Worth a per-row spot check on Not-supported gold labels in a follow-up. The lenient skew exists in V3.2 too (5 Source-unavailable verdicts among the 97 parseable rows) but is masked by the parse-failure rate.
2. **HF Inference Providers may reroute models** between downstream backends (DeepInfra, Together, Fireworks, etc.). All measurements above were taken on 2026-05-08 against the HF router with the dataset's 187-entry v1+v2+v3 configuration. Periodic re-runs (`npm run benchmark:hf-panel`) will catch regressions if HF reroutes V3 to a backend with different defaults.
3. **The V3.1 family was also tested** (V3.1, V3.1-Terminus). V3.1 emits visible chain-of-thought via the HF router and there is no exposed toggle to disable it (`chat_template_kwargs` is rejected by the HF router; system-message hints are not honored). V3.1-Terminus produced clean output on this benchmark but is documented by DeepSeek as a hybrid thinking-mode model — its non-reasoning behavior on the HF route is empirical, not architecturally guaranteed. V3 is selected over V3.1-Terminus because V3 is non-reasoning *by architecture* (no thinking-mode capability exists), so the parse-clean property is structural rather than configurational.

## Reproducing

```bash
cd benchmark
npm run extract                                # only if dataset.json is stale
npm run benchmark -- --providers=hf-deepseek-v3,hf-deepseek-v3-2 --resume
npm run analyze
```

`HF_TOKEN` must be set with serverless-inference permission for both `deepseek-ai/DeepSeek-V3` and `deepseek-ai/DeepSeek-V3.2` enabled in the HF account's [inference-provider settings](https://huggingface.co/settings/inference-providers).

The frozen artifact at `2026-05-08-deepseek-v3-2-to-v3-results.json` is the exact data underlying the table above.
