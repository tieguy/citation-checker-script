> **Status (2026-05-15):** Implementation complete on `fresh-prompt-on-217`; **not ready for upstream submission**. First measurement on the rebased branch shows a regression under the maintainer's preferred binary metric (atomized verifier over-emits "Not supported", producing wasted hard flags on supported and partially-supported citations across 7 of 9 panel members). Mistral Small 3.2 is the only clear-cut win. The rewrite was rebased from `tieguy/fresh-prompt-rewrite` onto `origin/main` + PR #203 (citoid header, two-step prompt commit dropped) + PR #217 (body-usability classifier). PAP #14 (Defuddle) is explicitly not a dependency. Next workstream: per-atom verifier prompt tuning (the per-atom verifier is too strict on hedged / paraphrased / loosely-supported atoms; the deterministic rollup then escalates a single false-negative atom to "Partially supported" and an all-false-negative set to "Not supported"). The Results section below carries the first-measurement numbers and explicitly reports both the binary-metric regression and the recall-on-problem-rows finding so the trade is visible.

# Fresh prompt rewrite for citation verification

## Results (2026-05-15, first measurement; rewrite is NOT ready for upstream — see Status header)

### Top-line: the rewrite regresses under the maintainer's binary metric on 7 of 9 providers

The binary metric collapses verdicts to {Supported, Partially supported} vs {Not supported, Source unavailable} — i.e., "does the panel raise an action-required flag on this citation?" Under that lens, an `S → PS` shift on a fully-supported citation is *not* a wasted click (the editor wouldn't necessarily act on a "Partially supported" verdict either), so the only costs that count are (a) bad citations that get no action-required flag at all and (b) supported / partially-supported citations that get the hard "Not supported" flag the editor *will* act on.

Net binary errors per provider over the 185-row dataset (lower is better):

| Provider | Old (legacy single-call) | New (atomized) | Δ |
|---|---:|---:|---:|
| Mistral Small 3.2 | 36 | 35 | **−1** (the only win — and offset by the wasted-hard-flag column; see breakdown) |
| Claude Sonnet 4.5 | 39 | 41 | +2 (wash) |
| Granite 4.1-8B | 32 | 37 | +5 |
| DeepSeek-V3 (HF) | 28 | 32 | +4 |
| Gemma 4-26B | 39 | 46 | +7 |
| Gemini 2.5 Flash | 28 | 36 | +8 |
| Qwen-3-32B (OR) | 28 | 39 | +11 |
| Qwen3-32B (HF) | 27 | 43 | **+16** |
| gpt-oss-20b (HF) | 38 | 57 | **+19** |

The driver is uniform across the panel: the atomized verifier emits more "Not supported" verdicts on citations that don't actually need the source removed. Mechanically, the atomizer breaks claims into atoms; the per-atom verifier judges each atom; the deterministic rollup escalates any single false-negative atom to `Partially supported` and an all-false-negative atom set to `Not supported`. Small models with over-strict per-atom judgments end up producing more hard flags than the original single-call verifier did. That's the followup workstream — the prompt is too strict, not the architecture.

### Secondary view: the rewrite catches more "Partially supported" problems under the recall lens

The headline finding has two parts and is best read together. **This framing makes the rewrite look better than it is under the binary metric above — both views are real, but the binary view is what governs editor workflow per the maintainer's preference.**

**1. The system catches more problems.** "Catches a problem" = a citation whose ground-truth verdict is *Not supported* or *Partially supported*, and where the panel emitted *Not supported* or *Partially supported* (i.e., flagged it for editor attention rather than passing it). Comparison is over the 1554-cell intersection of the legacy single-call control and the atomized treatment, both run on the same dataset (176 complete + 9 body-classifier-attributed *Source unavailable* + 4 fetch-failed errors). Control was measured on 2026-05-14 on the `body-classifier-bench` worktree (integration base + #217 commits); treatment was measured 2026-05-15 on `fresh-prompt-on-217` (this branch) with the atomized pipeline. Body-classifier is active on both sides so its 9 short-circuited rows are pipeline-attributed in both.

| Provider | n | gt_pos | Recall control → treatment | Δ recall | gt_neg | Editor-FP control → treatment | Δ FP |
|---|---:|---:|---:|---:|---:|---:|---:|
| `claude-sonnet-4-5` | 185 | 102 | 80 (78.4%) → 89 (87.3%) | **+8.8** | 48 | 10 (20.8%) → 8 (16.7%) | -4.2 |
| `gemini-2.5-flash` | 185 | 95 | 80 (84.2%) → 83 (87.4%) | **+3.2** | 46 | 8 (17.4%) → 8 (17.4%) | +0.0 |
| `hf-deepseek-v3` | 185 | 102 | 82 (80.4%) → 84 (82.4%) | **+2.0** | 48 | 11 (22.9%) → 10 (20.8%) | -2.1 |
| `hf-gpt-oss-20b` | 185 | 90 | 80 (88.9%) → 82 (91.1%) | **+2.2** | 44 | 2 (4.5%) → 5 (11.4%) | +6.8 |
| `hf-qwen3-32b` | 185 | 102 | 83 (81.4%) → 91 (89.2%) | **+7.8** | 48 | 7 (14.6%) → 7 (14.6%) | +0.0 |
| `openrouter-gemma-4-26b-a4b` | 185 | 102 | 91 (89.2%) → 91 (89.2%) | **+0.0** | 48 | 7 (14.6%) → 6 (12.5%) | -2.1 |
| `openrouter-granite-4.1-8b` | 185 | 101 | 69 (68.3%) → 83 (82.2%) | **+13.9** | 47 | 14 (29.8%) → 11 (23.4%) | -6.4 |
| `openrouter-mistral-small-3.2` | 185 | 102 | 67 (65.7%) → 87 (85.3%) | **+19.6** | 48 | 25 (52.1%) → 9 (18.8%) | -33.3 |
| `openrouter-qwen-3-32b` | 185 | 101 | 84 (83.2%) → 91 (90.1%) | **+6.9** | 48 | 7 (14.6%) → 8 (16.7%) | +2.1 |

Recall on problem rows improves on every panel member. The biggest gains are on Mistral Small 3.2 (+19.6 pp), Granite 4.1-8B (+13.9 pp), Claude Sonnet 4.5 (+8.8 pp), and HF Qwen3-32B (+7.8 pp). The smallest move is `openrouter-gemma-4-26b-a4b` at +0.0 pp; that cell already caught 89.2% in the control, so the headroom was small.

**2. The editor-perspective false-positive rate is roughly flat or better.** "Editor-FP" = of the rows whose ground truth is *Not supported*, the share where the panel said *Supported* or *Partially supported* (i.e., wrongly accepted a citation that doesn't hold up under inspection). This is the metric editors care most about — it bounds how often the tool will tell an editor "this is fine" when the editor would conclude otherwise on review. Editor-FP moves 0 or favorably (negative) on 7 of 9 cells. The two exceptions are `hf-gpt-oss-20b` (4.5% → 11.4%, still excellent in absolute terms) and `openrouter-qwen-3-32b` (14.6% → 16.7%, within noise). Mistral's editor-FP collapses from 52.1% to 18.8% — a structural improvement, not a noise-level shift.

For the flagship verifier (Claude Sonnet 4.5) recall improves from 78.4% to 87.3% **and** editor-FP improves from 20.8% to 16.7%. Catching more problems while wrongly accepting fewer of them is unambiguously good.

**3. Why the trade is the right one, restated for the user-facing audience.** Under the legacy single-call verifier, the flagship (Claude Sonnet 4.5) was already a fairly aggressive flagger on the integration base — it caught ~78% of problem rows at ~21% editor-FP. The atomized rewrite pushes that to ~87% caught at ~17% editor-FP — about a third fewer missed problems with a corresponding drop in false accepts. Smaller/cheaper panel members improve in roughly the same shape, with Mistral's enormous editor-FP collapse the standout result.

**4. Exact-match regresses by 1–14 pp across the panel.** This is the deliberate cost of the trade. The atomized verifier is more willing to emit `Partially supported` on compound claims where some atoms are supported and others aren't — correct against `Partially supported` GT, but wrong against `Supported` GT. The 4-way exact-match metric penalizes that uniformly; the editor-perspective recall + editor-FP framing rewards it on problem rows and is neutral on it on `Supported` rows. Full exact / lenient / binary deltas:

| Provider | n | Control exact | Treatment exact | Δ exact | Δ lenient | Δ binary |
|---|---:|---:|---:|---:|---:|---:|
| `claude-sonnet-4-5` (noise) | 176 | 59.7% | 58.5% | -1.1 | -1.1 | -1.1 |
| `gemini-2.5-flash` | 167 | 67.7% | 62.3% | -5.4 | -4.8 | -4.8 |
| `hf-deepseek-v3` | 176 | 71.6% | 64.2% | -7.4 | -2.3 | -2.3 |
| `hf-gpt-oss-20b` | 158 | 62.0% | 48.1% | -13.9 | -12.0 | -12.0 |
| `hf-qwen3-32b` | 176 | 68.2% | 54.5% | -13.6 | -8.0 | -8.5 |
| `openrouter-gemma-4-26b-a4b` | 176 | 61.4% | 54.5% | -6.8 | -4.0 | -4.0 |
| `openrouter-granite-4.1-8b` | 175 | 63.4% | 57.7% | -5.7 | -2.9 | -2.9 |
| `openrouter-mistral-small-3.2` (noise) | 176 | 60.2% | 60.2% | +0.0 | +0.6 | +0.6 |
| `openrouter-qwen-3-32b` | 174 | 68.4% | 56.3% | -12.1 | -6.3 | -6.3 |

The cells with the largest exact-match regression (`hf-gpt-oss-20b`, `hf-qwen3-32b`, `openrouter-qwen-3-32b`) are also among the cells with the largest recall gains. That's the trade made visible.

**5. Caveats.** The headline panel is the model selection used during development. Two integration-base providers that ship with the userscript or are available on this branch are not in the headline comparison:

- `claude-sonnet-4-6` — added to PROVIDERS in this design's bucket 5 commit but not run for this Results section. It can be added with one fresh treatment-side sweep (no control re-run needed, since the control is already locked) when a maintainer wants the user-facing 4.6 cell. The closest reference is `claude-sonnet-4-5` (+8.8 pp recall, -4.2 pp editor-FP); 4.6 is expected to behave similarly on the editor-perspective metrics.
- `openrouter-nemotron-nano-9b-v2` — added to PROVIDERS via #211 on `origin/main`. Same situation: addable in a follow-up sweep, no control re-run needed.
- `publicai` (Qwen-SEA-LION via the production proxy) — not in this run. The PR-114 / PAP-8 prior measurement noted reliability problems on the PublicAI route (98 sub-500ms fast-fails out of 181); diagnosing those is upstream of this design.

The `openrouter-olmo-3.1-32b` cell is permanently disabled on this panel (sub-100ms empty responses on the OR route; see `core/providers.js` for the comment).

**6. Data location.** `benchmark/results.json` is the treatment-side run; the 9-provider control snapshot and the `ccs compare` report are committed at [`benchmark/historical-runs/2026-05-15-atomized-pipeline/`](../../benchmark/historical-runs/2026-05-15-atomized-pipeline/). Both are scored against `benchmark/dataset.json` post-#205 ground-truth corrections (the 12-row GT-corrections set landed upstream as PR #205). The recall + editor-FP table above is reproducible via `python3 benchmark/historical-runs/2026-05-15-atomized-pipeline/recall_table.py` with no external state.

## Summary

The citation checker currently verifies Wikipedia claims in a single LLM call: it sends the full claim text plus the fetched source body to a provider and asks for a single verdict. That single-call design struggles on compound claims — claims that assert multiple distinct facts at once — because a mixed result (one assertion supported, another not) tends to collapse unpredictably to either `SUPPORTED` or `NOT SUPPORTED` rather than the correct `PARTIALLY SUPPORTED`.

This design replaces the single-call approach with a three-stage pipeline that runs entirely client-side inside `core/worker.js`. First, an **atomizer** LLM call decomposes the claim into discrete verifiable assertions called atoms, each tagged as either a content assertion (something about what the source says) or a provenance assertion (something about author, publication, or date). Second, each atom is verified independently in a parallel fan-out, with content atoms checked against the source body and provenance atoms checked against structured citoid metadata. Third, a **rollup** stage collapses the per-atom verdicts to a claim-level verdict — either by a deterministic rule (any mix of supported and not-supported atoms → `PARTIALLY SUPPORTED`) or by an additional judge LLM call for higher fidelity on edge cases. The prompts throughout are rewritten from scratch using Wikipedia community standards as primary sources, with FActScore and SemanticCite as secondary references, and are tested against a set of regression fixtures targeting the specific failure patterns identified in the both-wrong audit.

## Definition of Done

**Deliverable.** A fresh system prompt (and any supporting orchestration — e.g., an optional claim-decomposition pre-pass) for the citation-checker, drafted from Wikipedia-community materials (WP:V, WP:RS, WikiEdu brochures, template-usage guidance) with SemanticCite, the WMF "Citation Needed" taxonomy, and FActScore as secondary references. Replaces PR #203's prompt commit in-place; input shape (citoid bibliographic-metadata header on top of the production proxy's strip-extracted source text — **not** Defuddle, which was tested and regressed) from #203 stays fixed.

**Success criteria.** The four pillars:

1. **Prompt + taxonomy.** Committed to `core/prompts.js` with `main.js` resynced via `npm run build`. Taxonomy is fully open — may stay 4-bucket (`SUPPORTED | PARTIALLY SUPPORTED | NOT SUPPORTED | SOURCE UNAVAILABLE`), add a narrow label (e.g., an explicit `IRRELEVANT` carve-out from `SOURCE UNAVAILABLE` or `NOT SUPPORTED`), or evolve in any direction that demonstrably reduces the audit's bucket-B (SU/NS) and bucket-C (NS/PS minor-error) boundary failures. The SIFT 6-label decision (memory record 2026-04-24) is revisitable as a design variable, not pre-bound.

2. **Optional claim-decomposition pre-pass.** Brainstorming explores whether a small-model atomic-claim splitter — converting compound claims into per-atom sub-claims before verdict — materially reduces the load on "Partially supported." If yes, it ships as part of the design (model selection, orchestration layer, latency/cost trade-off all part of the design decision). If no, the decision is recorded with reasoning.

3. **Testing infrastructure.** Unit/integration coverage at the prompt-rendering layer (`core/prompts.js` and any new orchestration modules) — fixtures for the audit's failure modes: SU/NS boundary (Bucket B, ~17 rows), NS/PS minor-error boundary (Bucket C, ~10 rows), literal-attribution gaps (Bucket D, ~8 rows). A future prompt regression on these patterns is caught before benchmark drift.

4. **Benchmarking + agent eval.**
   - **A/B/C decomposition** on corrected-GT dataset (post-#205) against the current panel (Claude Sonnet 4.5, Gemini 2.5 Flash, Qwen-HF, Mistral, gpt-oss, Nemotron, Apertus, OLMo via OpenRouter if available) plus Claude Opus 4.7 as flagship comparator.
   - **Headline metric**: exact-match delta vs the current #203 prompt, with stratified breakdown on audit buckets B and C.
   - **Agent-driven qualitative eval** (LLM-judge or pairwise comparison) over verdict-and-reasoning outputs on a stratified subset, producing per-row commentary and aggregate themes — this is the **first-pass eval**, since statistical wins may not be obvious. Output is a structured artifact usable as input for subsequent prompt iterations.

**Ship bar.** "Big improvement on exact" — specific number derived during brainstorming. Likely shape: ≥+X pp exact on flagship (Claude Sonnet) against corrected-GT, with no panel-member regression beyond the noise floor.

**Out of scope.**

- Input-pipeline changes (PAP-side extraction tweaks, Wayback handling, Defuddle settings)
- Dataset GT corrections beyond PR #205 (the 6 bucket-E GT bugs from the both-wrong audit are a separate follow-up PR)
- Scraper-completeness gate from bucket A (~15 rows; separate piece of work — see `workbench/integration-benchmark/both-wrong-audit-summary.md`)
- UI changes to `main.js`'s rendered surface
- Wholesale SIFT-style 6-label adoption (memory still binds; narrow taxonomy additions OK if audit-grounded)

## Glossary

- **atom / atomization**: The output unit of Stage 1. A single verifiable assertion extracted from a compound claim, tagged as either `content` (what the source says) or `provenance` (author, publication, or date). Atomization is the act of splitting a multi-part claim into these units before verification.
- **provenance atom vs content atom**: Two kinds of atoms. Provenance atoms (e.g., "published in _The Guardian_", "authored by Jane Doe") are verified against citoid metadata. Content atoms (everything else) are verified against the source body text.
- **deterministic rollup vs judge rollup**: The two pluggable Stage 3 modes. Deterministic rollup applies a fixed rule — all-supported → `SUPPORTED`, all-not-supported → `NOT SUPPORTED`, any mix → `PARTIALLY SUPPORTED` — with no LLM call. Judge rollup uses an additional LLM call to compose the atom-level results into a claim-level verdict, giving higher fidelity on edge cases at the cost of one extra API call.
- **both-wrong audit**: A post-hoc audit of the 64 benchmark rows where both Claude Sonnet 4.5 and Claude Opus 4.7 were wrong simultaneously, used to identify systematic failure patterns. Results are in `workbench/integration-benchmark/both-wrong-audit-summary.md`.
- **audit buckets A–F**: Categories from the both-wrong audit grouping failure causes: Bucket A = scraper-completeness failures (JS-rendered, Wayback chrome, paywalled), Bucket B = SU/NS boundary ambiguity (~17 rows, source has prose but doesn't address the claim), Bucket C = NS/PS boundary on minor errors (~10 rows, small numeric/date discrepancies), Bucket D = literal-attribution gaps (~8 rows, claim requires a quote or direct statement not present), Bucket E = genuine ground-truth bugs in the dataset (~6 rows), Bucket F = other.
- **corrected-GT dataset**: The benchmark dataset after PR #205 applies seven ground-truth corrections identified in the both-wrong audit. Used as the baseline for all benchmark cells in this design.
- **citoid metadata**: Structured bibliographic data (author, title, publication, publication date, DOI, etc.) fetched from the Wikimedia Citoid service for a given source URL. Used in this design specifically to verify provenance atoms without requiring the full source body.
- **Defuddle**: A JavaScript library (used in PAP PR #14) that runs Mozilla's Readability plus custom heuristics to strip page chrome (navigation, ads, headers, footers) and extract the main article body from a fetched HTML page. Produces a cleaner `source_text` than the prior strip-based extractor.
- **PAP / public-ai-proxy**: `alex-o-748/public-ai-proxy`, the Cloudflare Worker that proxies LLM API calls, fetches source URLs through CORS, and logs results. The pipeline in this design is entirely CCS client-side; PAP remains a thin proxy.
- **CCS / citation-checker-script**: `alex-o-748/citation-checker-script`, the repository this design plan lives in. Includes `main.js` (the Wikipedia userscript), `core/` (shared verification logic), `benchmark/` (the accuracy evaluation suite), and `cli/` (the `ccs` command-line tool).
- **body-usability-classifier**: A parallel work stream (separate branch) responsible for detecting whether a fetched source body is usable before it reaches the verifier. It handles `SOURCE_UNAVAILABLE` cases (empty bodies, Wayback chrome, JS-rendered pages). This design explicitly excludes `SOURCE_UNAVAILABLE` from the verifier's output surface, relying on that classifier to short-circuit unusable bodies upstream.
- **`SOURCE_UNAVAILABLE` handling**: The case where a source URL returns no usable content. Out of scope for this prompt rewrite; handled by the body-usability-classifier. If the classifier isn't in place, the verifier may incorrectly emit `NOT SUPPORTED` for empty bodies.
- **BYOK**: Bring Your Own Key. The userscript's model for API access — users supply their own API keys for each provider (Anthropic, Google, OpenAI, etc.) stored in `localStorage`. Relevant here because provider-family symmetry in atomizer/verifier pairing means each BYOK key covers both calls.
- **OOUI**: OOjs UI, the MediaWiki component library used by the Wikipedia userscript for buttons and dialogs. The multi-stage pipeline introduces latency that the existing OOUI progress dialog doesn't represent well; a multi-stage progress indicator is flagged as a deferred UX follow-up.
- **flagship vs panel models**: Flagship = a single high-quality representative model used for primary evaluation (Claude Sonnet 4.5, Claude Opus 4.7, Gemini 2.5 Flash). Panel = the full set of benchmark providers (adds Qwen-HF, Mistral, gpt-oss, Nemotron, Apertus, OLMo where available). Flagship cells run first for cost; full-panel cells confirm generalization.
- **`ccs compare`**: The `ccs compare` subcommand (PR #195) that diffs two `results.json` benchmark runs, producing per-provider accuracy deltas and per-row flip counts. Used in Phase 8 to produce the cell-to-cell comparison artifacts.
- **FActScore**: A research framework for decomposing long-form LLM outputs into atomic facts and scoring each against a reference corpus. Referenced here as a secondary inspiration for the atomization design, not a direct dependency.
- **SemanticCite**: A research system for structured citation verification using semantic decomposition of claims. Referenced alongside FActScore as prior art informing the prompt design.

## Architecture

The current single-call two-step prompt is replaced with a **three-stage pipeline**:

```
claim ──► atomize ──► verifyAtoms (parallel per atom) ──► rollup ──► RollupResult
```

All orchestration is **client-side in CCS**. `public-ai-proxy` stays a thin proxy/fetch/log worker — no new LLM-calling responsibility there. The pipeline runs inside `core/worker.js`, which means it executes identically in the userscript, the `ccs verify` CLI, and the benchmark runner (all three import the same `core/` modules).

### Stage 1: Atomize

Input: a single `claim` string. Output: an ordered `Atom[]`, where each `Atom = { id, assertion, kind: 'content' | 'provenance' }`. Each atom encodes one verifiable assertion drawn from the claim. The atomizer LLM call uses the same provider family as the verifier — by default the same model, with an opt-in `smallModel` override (e.g., Sonnet → Haiku, HF → smallest allow-listed HF model). Provenance atoms (`kind: 'provenance'`) encode publication / author / publication-date assertions; content atoms encode everything else.

### Stage 2: Verify per atom

Input: `(atoms, sourceText, metadata, providerConfig)`. Output: `AtomResult[]`. Each atom is verified independently against the right slice of input — content atoms against the body, provenance atoms against the citoid metadata block. Per-atom calls fan out under bounded concurrency (default = all-atoms-in-parallel; cap configurable). Each `AtomResult = { atomId, verdict: 'supported' | 'not_supported', evidence?: string }`. Atom verdicts are deliberately binary; per-atom granularity is what turns Bucket-C and Bucket-D failures (compound claims with mixed support) into the right `PARTIALLY SUPPORTED` rollup instead of an all-or-nothing miss.

### Stage 3: Rollup

Input: `(atoms, atomResults, mode, providerConfig?)`. Output: `RollupResult = { verdict, comments, judgeReasoning? }`. The rollup `mode` is **pluggable**:

- **`'deterministic'`** — rule-based. All atoms supported → `SUPPORTED`; all atoms not-supported → `NOT SUPPORTED`; any mix → `PARTIALLY SUPPORTED`. Zero LLM calls, fully predictable.
- **`'judge'`** — an additional LLM call composes the atoms, atomResults, and original claim into a claim-level verdict. Higher fidelity on edge cases (e.g., where the deterministic mix-rule under-weighs a single high-stakes contradictory atom). One extra LLM call per verification.

The benchmark measures `'judge'` vs `'deterministic'` head-to-head on the flagship provider; the better mode becomes production default per the ship-bar thresholds (see Phase 8). Whichever mode loses ships as an opt-in flag, not as removed code.

### Verdict surface

Claim-level verdict surface in this design: **`{ SUPPORTED, PARTIALLY SUPPORTED, NOT SUPPORTED }`**.

`SOURCE_UNAVAILABLE` is intentionally **absent** from this prompt's output set. The parallel `body-usability-classifier` work (CCS + PAP) is responsible for short-circuiting unusable-body cases before they reach the verifier. This design assumes the source body presented to the verifier is usable; if that contract is violated the verifier may emit `NOT SUPPORTED` instead of `SOURCE_UNAVAILABLE` for chrome/empty bodies, which is acceptable because the upstream classifier is the canonical path.

### Provider-family symmetry

Atomizer and verifier always run within the same provider family (Anthropic ↔ Anthropic; HuggingFace ↔ HuggingFace; Google ↔ Google). This avoids cross-provider compositional bias and keeps the BYOK story simple: one user-configured API key per provider drives both calls. `core/providers.js` gains a per-provider `smallModel?` field that names the cheap variant; both the userscript and the benchmark accept an optional flag to opt in to it.

## Existing Patterns

This design follows several patterns already established in CCS:

- **`core/` as the single source of truth for shared logic.** All new modules (`core/atomize.js`, `core/verify-atoms.js`, `core/rollup.js`) live alongside the existing `core/{claim,parsing,prompts,providers,urls,worker}.js`. The userscript build (`scripts/sync-main.js`) inlines `core/` into `main.js` byte-identically between `<core-injected>` markers; the CLI (`cli/verify.js`) and benchmark (`benchmark/run_benchmark.js`) import directly from `core/`. New modules slot into this convention without ceremony.
- **`node --test` + `node:assert/strict` for the test suite.** Tests live in `tests/**/*.test.js`; new helpers get sibling test files. Modules that do work at import time gate it behind `if (process.argv[1] === fileURLToPath(import.meta.url))` so they're safely importable from tests.
- **`benchmark/` is ESM with imports from `../core/`.** The benchmark already imports `extractClaimText` from `../core/claim.js`; the new atomized pipeline is wired the same way — `run_benchmark.js` imports `atomize`, `verifyAtoms`, `rollup` from `core/` and drives them per row.
- **Provider abstraction in `core/providers.js`.** The existing object holds `{ name, model, apiBase, ... }` per provider; extending each entry with `smallModel?` and `supportsAtomize` is additive. The current `callProviderAPI()` dispatch in `core/worker.js` stays unchanged; the new atomize/verify wiring lives in `worker.js` alongside it.
- **`ccs compare` for results-vs-results diffing.** PR #195's `compare` subcommand is the diff engine for benchmark cells; the new cells (1–4) use it the same way the 2026-05-10 combined-integration run did. No new comparison infrastructure required at the CLI level; cell pairs render via existing `--format` (json / markdown / self-contained HTML).
- **`workbench/` for local-only validation.** The agent-eval scripts (`workbench/prompt-rewrite-eval/`) follow the existing pattern from `workbench/citoid-validation/`, `workbench/integration-benchmark/`, etc. — ESM scripts, an `.env`-driven API-key boundary, never committed to either sub-repo. Reuses the `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` env vars already provisioned for the benchmark.
- **`docs/design-plans/` status-header convention.** This document's status header follows `docs/design-plans/README.md` — `> **Status (YYYY-MM-DD):** <state>. <one-sentence pointer>`. State will move from `Proposed` to `In progress` when the implementation branch is cut, to `Implemented` when the headline cells land.

**One divergence from existing code:** the current `core/prompts.js` exports two functions (`generateSystemPrompt`, `generateUserPrompt`). This design adds six exports for three roles (atomizer / verifier / judge × system / user). The existing two are removed; nothing else in `core/` references them by name (`core/worker.js` is the only consumer).

## Implementation Phases

8 discrete phases. Each phase ends with a working build and its own tests.

### Phase 1: Scaffolding + provider config

**Goal:** Module skeletons in place, provider config extended, build green.

**Components:**
- `core/providers.js` — extended: each provider entry gains `smallModel?: string` and `supportsAtomize: boolean` fields. Anthropic gets `smallModel: 'claude-haiku-4-5-20251001'`; Google gets `smallModel: 'gemini-2.5-flash'`; HuggingFace providers get the smallest current HF-allowlist entry; PublicAI providers (Apertus, OLMo if reintroduced) get the same as their main model (no smaller variant yet). `supportsAtomize` defaults `true`; provider entries that fail benchmark Cell 1 due to atomizer-quality issues can have it flipped off later.
- `core/atomize.js`, `core/verify-atoms.js`, `core/rollup.js` — module skeletons (function signatures, JSDoc, `throw new Error('not implemented')` bodies). Importable but non-functional.
- `tests/core_providers.test.js`, `tests/atomize.test.js`, `tests/verify_atoms.test.js`, `tests/rollup.test.js` — test scaffolding files with one passing smoke assertion each (module imports cleanly).

**Dependencies:** None (first phase).

**Done when:** `npm test` passes; `npm run build` produces a `main.js` whose `<core-injected>` block parses (even if the new pure-stub functions aren't called by the userscript yet); `node -e "import('./core/atomize.js')"` succeeds.

### Phase 2: Prompt rendering for atomizer, verifier, judge

**Goal:** Pure prompt-generation functions in `core/prompts.js`, with snapshot tests proving they render the expected text for known inputs.

**Components:**
- `core/prompts.js` — six new exports replacing the existing two:
  - `generateAtomizerSystemPrompt(): string`
  - `generateAtomizerUserPrompt(claim: string): string`
  - `generateVerifierSystemPrompt(): string`
  - `generateVerifierUserPrompt(atom: Atom, sourceText: string, metadata?: object): string`
  - `generateJudgeRollupSystemPrompt(): string`
  - `generateJudgeRollupUserPrompt(claim: string, atomResults: AtomResult[]): string`
  - The atomizer prompt emits structured JSON describing atoms with `kind` distinction (content vs provenance). The verifier prompt scopes its evidence search by atom kind. The judge prompt receives the original claim plus all atom results and a one-paragraph rollup-quality rubric.
- Few-shot examples are rewritten from scratch — the existing 9 examples are scoped to the two-step framing and don't survive the rewrite. New examples target the audit's failure modes: Bucket B (source has prose but doesn't address claim), Bucket C (minor numeric/date error), Bucket D (literal-attribution gap), plus a fully-supported and a provenance-bearing example.
- `tests/core_prompts.test.js` — snapshot-style tests asserting each `generate*Prompt` function produces the expected string for a fixed input. Snapshots stored inline (string literals) for diffability in code review; updated explicitly when prompt text changes.

**Dependencies:** Phase 1.

**Done when:** snapshot tests pass; prompt-generation functions handle all expected input shapes (simple claim, compound claim, provenance-bearing claim, no-metadata case, with-metadata case); `npm run build` succeeds (main.js stays in sync with core/).

### Phase 3: Pipeline orchestration (atomize + verifyAtoms)

**Goal:** Implement `atomize()` and `verifyAtoms()` with bounded concurrency and mocked-provider unit tests.

**Components:**
- `core/atomize.js` — full implementation:
  ```js
  atomize(claim, providerConfig, opts?) → Promise<Atom[]>
  // opts: { useSmallModel?: boolean, signal?: AbortSignal, transport?: ProviderTransport }
  ```
  Resolves an LLM call using `providerConfig` (and `providerConfig.smallModel` when `opts.useSmallModel`), parses the response JSON, returns the atoms array. Failure modes: malformed JSON → fall back to a single content atom containing the full claim verbatim (degrades gracefully to single-pass-equivalent behavior); transport error → propagate. Tests assert each path via a fake transport.
- `core/verify-atoms.js` — full implementation:
  ```js
  verifyAtoms(atoms, sourceText, metadata, providerConfig, opts?) → Promise<AtomResult[]>
  // opts: { concurrency?: number, signal?: AbortSignal, transport?: ProviderTransport }
  ```
  Fans out per atom via `Promise.all` with a bounded concurrency wrapper (default = unbounded for typical 2-4 atoms; cap available for larger atom counts). Each per-atom call passes `metadata` only when atom kind is `provenance`. Tests assert: per-atom call count matches atoms[].length; partial failure handling (one atom 429s, others succeed → AtomResult[] surfaces an error sentinel for the failed atom, not a full reject); concurrency cap respected.

**Dependencies:** Phase 2.

**Done when:** all tests pass including failure-path coverage; the atomize → verifyAtoms call sequence executes end-to-end against a mocked transport for a simple compound claim; rate-limit / abort behavior verified.

### Phase 4: Rollup (deterministic + judge) and audit-fixture integration tests

**Goal:** Both rollup modes implemented; the audit-bucket fixture suite locks in regression coverage.

**Components:**
- `core/rollup.js` — both modes:
  ```js
  rollup(atoms, atomResults, mode, providerConfig?, opts?) → Promise<RollupResult>
  // mode: 'deterministic' | 'judge'
  ```
  Deterministic mode: rule = `all-supported ⇒ SUPPORTED`; `all-not_supported ⇒ NOT SUPPORTED`; `mix ⇒ PARTIALLY SUPPORTED`. The `comments` field of the `RollupResult` reproduces the per-atom rationale in a concise format ("Atom 1 supported; Atom 2 not-supported: …"). Judge mode: one LLM call using the judge prompt from Phase 2; `judgeReasoning` populated with the model's explanation. Tests cover all atom-combination rules exhaustively and the judge mode wire-up via mocked transport.
- `tests/integration_audit_buckets.test.js` — the regression-contract suite. Reads 11 fixture rows from `benchmark/dataset.json` by `row_<id>`: 3 Bucket B rows (`row_100`, `row_108`, `row_148`), 3 Bucket C rows (`row_112`, `row_186`, `row_71`), 3 Bucket D rows (`row_24`, `row_55`, `row_88`), 1 fully-supported bookend, 1 fully-unsupported bookend. For each, the test runs the **real** atomizer/verifier/rollup prompts against a **stubbed** provider transport that returns hand-crafted JSON simulating each LLM call's response — chosen to mimic the patterns Sonnet 4.5 / Opus 4.7 produced on those rows during the both-wrong audit. Assertions: deterministic-mode rollup matches the GT verdict on all 11 rows. (Judge mode is not asserted here — it's an LLM call, not a pure function.)

**Dependencies:** Phase 3 (verifyAtoms produces the AtomResult[] that rollup consumes).

**Done when:** all 11 integration fixtures pass under deterministic rollup; both rollup modes wire up correctly via the mocked transport in unit tests; the regression contract is in CI-visible form (failing fixtures fail `npm test`).

### Phase 5: Wire into worker.js + CLI

**Goal:** End-to-end atomized verification path through the existing entry points; userscript stays in sync via the build script.

**Components:**
- `core/worker.js` — extended with an `verifyClaimAtomized(claim, sourceText, metadata, providerConfig, opts?)` function that orchestrates atomize → verifyAtoms → rollup and returns the legacy `{ verdict, comments, ... }` shape the userscript and CLI already consume. Existing `verifyClaim()` stays in place as `--legacy-single-pass` mode for benchmark replay against pre-rewrite snapshots and as a fallback path for providers with `supportsAtomize: false`. A top-level dispatcher inside `worker.js` selects atomized vs legacy based on `providerConfig.supportsAtomize` and an explicit `opts.atomized` flag.
- `cli/verify.js` — accepts `--atomized` / `--no-atomized` (default: `--atomized`) and `--rollup-mode {deterministic|judge}` (default: `deterministic` until Phase 8 measures otherwise) and `--use-small-atomizer` flags. Pass-through to `verifyClaimAtomized()`.
- `scripts/sync-main.js` — no source change, but **must run** to re-inline the rewritten `core/` modules into `main.js`'s `<core-injected>` block. `npm run build -- --check` verifies main.js is up to date.

**Dependencies:** Phase 4 (full pipeline works end-to-end against mocked transports).

**Done when:** `npx ccs verify <url> <n>` on a known-supporting Wikipedia citation returns `SUPPORTED` via the atomized path against a real provider; `npx ccs verify --no-atomized <url> <n>` against the same returns the legacy single-pass result; `npm run build -- --check` is green.

### Phase 6: Benchmark wiring

**Goal:** Benchmark cells 0–4 runnable from `benchmark/run_benchmark.js`; sample run validates pipeline against real LLM responses.

**Components:**
- `benchmark/run_benchmark.js` — extended with `--atomized` / `--no-atomized` and `--rollup-mode {deterministic|judge}` and `--small-atomizer` flags, matching the CLI surface. Calls into `verifyClaimAtomized()` from `core/worker.js`. Per-row result rows in `results.json` are extended with new fields: `atoms` (the Atom[]), `atomResults` (the AtomResult[]), `rollupMode`, and `judgeReasoning` (when applicable). Existing fields (`verdict`, `correct`, `ground_truth`, etc.) stay in shape.
- `benchmark/analyze_results.js` — no change required at the metric level (verdict surface is unchanged), but adds an atom-count distribution to the analysis output: median atoms/claim, % single-atom, % >3 atoms. Stratified bucket breakdowns reuse the row lists from `workbench/integration-benchmark/both-wrong-audit-summary.md` already used in prior runs.
- `benchmark/package.json` scripts: extend with `benchmark:atomized` (Cell 2 default) and `benchmark:judge` (Cell 3). Existing `benchmark` script remains unchanged for Cell 0 / Cell 1 reproducibility.
- **20-row smoke run** before any full panel run: subset to first 20 dataset rows, run flagship Sonnet 4.5 under Cell 2, manually inspect atom output for sanity, only then proceed to full panel.

**Dependencies:** Phase 5 (worker.js path live).

**Done when:** the 20-row smoke run completes without errors; atom output on those 20 rows is plausibly correct (median atom count 1–4; provenance atoms emitted only for claims with explicit attribution); `npx ccs compare` between a 20-row Cell 0 and 20-row Cell 2 run renders cleanly.

### Phase 7: Agent-eval infrastructure

**Goal:** The pairwise + rubric judging infrastructure is in `workbench/prompt-rewrite-eval/` and produces structured outputs from results-pair input.

**Components:**
- `workbench/prompt-rewrite-eval/pairwise_judge.mjs` — reads two `results.json` files plus `dataset.json`; samples a stratified 50-row subset (10 each from Buckets B, C, D plus 20 "no known bucket" baseline); for each row, constructs a prompt presenting `{claim, source_text, output_X, output_Y}` to the judge LLM with X/Y randomized per row; collects judge verdicts (`X` / `Y` / `tie`) and aggregates win-rate per side (and per bucket). Multi-judge ensemble: runs against ≥2 judge providers (Claude Sonnet, Gemini 2.5 Pro). Output: per-row JSON + aggregate markdown.
- `workbench/prompt-rewrite-eval/rubric_judge.mjs` — reads one `results.json` plus `dataset.json`; for each row, presents `{claim, source_text, output}` to the judge LLM with a fixed 3-axis rubric (evidence-groundedness, logical coherence, bucket-blind quality); collects per-axis scores. Same multi-judge ensemble. Output: per-row JSON + aggregate markdown.
- `workbench/prompt-rewrite-eval/aggregate_eval.mjs` — composes outputs from the two judges into a single markdown summary report. Cross-references judges' agreement/disagreement rate and surfaces high-disagreement rows as a flag.
- `workbench/prompt-rewrite-eval/README.md` — usage docs and the .env / API-key requirements.

**Dependencies:** Phase 6 (benchmark results.json artifacts to feed the judges).

**Done when:** running `node workbench/prompt-rewrite-eval/pairwise_judge.mjs <cell0.json> <cell2.json> <dataset.json>` against the 20-row smoke artifacts from Phase 6 produces a structured output (per-row JSON + aggregate markdown) without errors; same for `rubric_judge.mjs`; the aggregator combines them into a single report.

### Phase 8: Full panel benchmark + comparison report

**Goal:** All five cells run against their target coverage; comparison report renders all ship-bar deltas; rollup-mode decision artifact filed.

**Components:**
- Cell 0 (control, full panel) — reuses 2026-05-10 combined-integration benchmark results from `workbench/integration-benchmark/`. No new run required.
- Cell 1 (rules-only ablation, flagship subset = Sonnet, Opus, Gemini Flash, one HF) — fresh run using new prompts with `--no-atomized`.
- Cell 2 (atomized + deterministic, full panel = Sonnet 4.5, Opus 4.7, Gemini Flash, Qwen-HF, Mistral, gpt-oss, Nemotron, Apertus; OLMo excluded) — fresh run with `--atomized --rollup-mode deterministic`.
- Cell 3 (atomized + judge, flagship subset) — `--atomized --rollup-mode judge`.
- Cell 4 (atomizer-model ablation, flagship only = Sonnet, Gemini) — `--atomized --small-atomizer --rollup-mode deterministic`.
- **Comparison artifacts** (under `workbench/integration-benchmark/cell-comparisons/` or similar):
  - Per-cell × per-provider deltas via `ccs compare`
  - Per-row flip matrices between cells (especially Cell 1 vs Cell 2 to attribute architecture wins, and Cell 2 vs Cell 3 to attribute rollup-mode wins)
  - Stratified bucket breakdowns from the audit
  - Atom-count distribution summary across the full panel
  - Agent-eval outputs (Phase 7) on the Cell 0 vs Cell 2 pair
- **Ship-bar decision artifact** — a markdown summary file recording the architecture-pass/fail, rollup-mode-decision, and atomizer-model-decision against the thresholds set in this design. Either includes a "ready to ship" verdict or a "rework needed" verdict citing specific bucket-level regressions.

**Dependencies:** Phase 7 (agent-eval available to consult when stat deltas are marginal).

**Done when:** all five cells have results.json artifacts; the comparison report renders all ship-bar deltas (architecture, rollup mode, atomizer model, headline exact-match); the ship-bar decision artifact says ship or rework; if ship, the design doc's Status header is updated to `Implemented`.

## Additional Considerations

**Worktree placement and PR strategy.** Implementation lives on a new worktree `.worktrees/fresh-prompt-rewrite/` branched off the local `citoid-defuddle-combined` branch (PR #203, three CCS-side commits: citoid metadata + two-step prompt + userscript wiring) so it inherits PR #203's input wiring. The branch name "citoid-defuddle-combined" reflects the empirical methodology PR #203 used to gather its measurement numbers, not the branch's code contents — **PAP #14 (Defuddle) is not on the dependency path**: it was tested separately, regressed every panel member, and the production proxy stays on strip extraction. This is intentionally a *separate* branch from `body-usability-classifier`; the two streams of work integrate at merge time, not on a shared branch. The final PR strategy — replace #203's prompt commit in-place via a rebase, or file as a separate PR that stacks on #203 — is decided at Phase 8 based on what's merged upstream. The design doc itself moves to the new worktree at start-implementation-plan time; first commit on the new branch is "design: fresh prompt rewrite + scaffolding."

**Production latency.** Userscript verification now spans 2+ LLM calls (atomize, then N parallel verifications, then optional judge). For typical 2-3 atom claims that's roughly a 2× wall-clock increase; for compound claims with 4+ atoms and judge mode it can be 3×. The existing OOUI progress dialog needs a multi-stage progress indicator. Treated as a follow-up — not blocking this design's ship bar, but a known UX cost. Flagged for a paired issue when the userscript-side rollout begins.

**Backward compatibility.** `core/worker.js` keeps the legacy `verifyClaim()` single-pass function alongside the new `verifyClaimAtomized()`. The CLI exposes `--no-atomized` to invoke it; the benchmark uses the same flag for Cell 1. Provider entries with `supportsAtomize: false` (none initially, but available as a per-provider escape hatch if Cell 1 vs Cell 2 ablation surfaces atomizer-quality issues on weak panel models) automatically fall back. Pre-rewrite `results.json` snapshots remain replayable via the legacy path.

**Test-fixture drift.** The integration-test fixtures pin specific `row_<id>` IDs from `benchmark/dataset.json`. The `row_<csv_line>` ID scheme is known-fragile (per the CCS CLAUDE.md "latent fragility": IDs shift when CSV rows are inserted in the middle). If a future dataset extension shifts these IDs, the integration tests will reference the wrong rows; remediation is to re-pin the fixtures to the current ID after extension, or to migrate to content-hash IDs as a separate refactor. Flagged but not addressed here.

**Judge-mode cost.** Cell 3 adds one LLM call per verification. Across the flagship-subset full benchmark (4 providers × ~184 rows × 1 judge call each) that's ~736 extra calls per Cell 3 run. Anthropic/Google direct costs are out-of-pocket; HF judge calls are WMF-funded via the existing `/hf` allowlist (which currently includes gpt-oss-20b, Qwen3-32B, DeepSeek-V3.2-Exp — DeepSeek-V3.2-Exp is a candidate judge model). Optimizing for tokens + clock time per the `feedback_hf_cost_proxy` memory.

**Atom-quality observability.** The benchmark records per-row `atoms` and `atomResults` arrays in `results.json`. This means atom-quality regressions are inspectable without rerunning — the data is in the artifact. Future iterations can write atom-quality judges as new `workbench/` scripts without re-extracting anything.

**Out of scope, named explicitly.** Body-usability classification (the `SOURCE_UNAVAILABLE` pathway) lives in the parallel `body-usability-classifier` work. Scraper-completeness improvements (Bucket A in the both-wrong audit) are unrelated. Dataset GT corrections beyond #205 (the 6 Bucket E rows) are a separate follow-up PR. UI changes in `main.js` (progress dialog, verdict rendering) are deferred per the `feedback_ui_changes_require_discussion` memory.
