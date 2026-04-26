# Benchmark smoke set

`benchmark/smoke-set.json` is a curated subset of `benchmark/dataset.json` used by CI to exercise the full verifier pipeline quickly. It anchors two tiers of the CI structure (see `docs/design-plans/2026-04-26-ci.md` for the full design):

- **Tier 1: non-llm-infrastructure-sample** — runs the smoke set in `--dry-run` mode (no LLM calls). Catches structural breakage in dataset loading, claim extraction, source fetching, and runner I/O. Runs on every PR including from forks. Free, ~5 seconds.
- **Tier 3: llm-providers-sample** — runs the same smoke set with real LLM calls. Catches provider authentication, response parsing, and integration failures. Runs on trusted PRs and push to `main`. ~$0.01, ~30 seconds, secrets-gated.

## Selection criteria

A valid smoke set covers:

1. **Three live verdict classes** — Supported, Partially supported, Not supported. Ensures the verdict-handling code paths are all exercised.
2. **All three fetch types** — HTML (live), PDF (live or archive), archive (Wayback Machine). Ensures the fetch and content-extraction paths in the proxy are all exercised.
3. **Stability** — rows whose source URLs are reasonably stable (live URLs that don't change content frequently; Wayback URLs that resolve to a captured snapshot). Smoke runs should not be flaky due to upstream content changes.

## Current rows

| row_id | verdict | fetch type | rationale |
|---|---|---|---|
| row_2 | Supported | html | Stable cis.org immigration report. Most common verdict class on the most common fetch type. |
| row_17 | Supported | pdf | Wayback PDF from census.gov. Only PDF in the smoke set; exercises the unpdf path. |
| row_22 | Partially supported | archive | Wayback archive URL. Exercises Wayback preamble stripping. |
| row_75 | Not supported | html | Live HTML where the source does not support the claim. |

## Updating the smoke set

The smoke set is hand-edited. Update it when:

- A row in the current set is removed or renumbered in `dataset.json`.
- The dataset gains a new fetch type or verdict class that the smoke set should cover.
- A row in the current set becomes flaky (its source URL changes content, decays, or starts returning different verdicts across runs).

To update:

1. Edit `benchmark/smoke-set.json` directly. Keep the row count between 3 and 5.
2. Verify the new selection still satisfies all four selection criteria above.
3. Run `npm run benchmark:non-llm-infrastructure:sample` (Phase 3 will add this script) to confirm the runner accepts the new set.
4. Update the table in this file to match.

The runner errors if `smoke-set.json` references a `row_id` that doesn't exist in `dataset.json` — keeping the file honest as the dataset evolves.

## Why hand-curation

An automatically-generated sample (e.g. "first 5 rows" or random) would not reliably cover the three live verdict classes — the dataset is heavily skewed toward Supported. The smoke set's purpose is to exercise specific code paths, not to be statistically representative.
