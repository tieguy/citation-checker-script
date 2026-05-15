> **Status (2026-05-14):** Implemented end-to-end (atomize → verifyAtoms → rollup live in `core/`, wired into `main.js` via the existing sync-script). Full-panel benchmark complete; headline result is in the **Results** section below — on the 180-row apples-to-apples overlap with the April baseline, recall on problematic citations (`GT ∈ {Not supported, Partially supported}`, panel flagged as `Not supported` or `Partially supported`) jumped from a 17–31 % band to 87–96 % for most current panel members, while the editor-perspective false-positive rate (`GT = Not supported` but panel said Supported / Partially) stayed roughly flat (Claude Sonnet 4.5: 18.2 % → 17.8 %). The benchmark is scored against the corrected ground-truth dataset shipped in PR #205 (12 v1 GT corrections across two audit rounds — 7 in the original audit, 5 added 2026-05-14). Input shape preserves PR #203's citoid bibliographic-metadata header on top of the production proxy's strip-extracted source text — **PAP #14 (Defuddle) is explicitly not a dependency**: prior testing showed Defuddle alone regresses every panel member by 3-7 pp exact, and the PAP-8+14 combination compounds that regression; the production proxy stays on strip extraction. `SOURCE_UNAVAILABLE` handling remains out of scope — covered by the parallel body-usability-classifier stream.

# Fresh prompt rewrite for citation verification

## Results (2026-05-14, full panel on 180-row apples-to-apples overlap with April baseline)

The headline finding has two parts and is best read together. They are not independent gains — they are the same trade made deliberately in one direction.

**1. The system catches a lot more problems.** "Catches a problem" = a citation whose ground-truth verdict is *Not supported* or *Partially supported*, and where the panel emitted *Not supported* or *Partially supported* (i.e., flagged it for editor attention rather than passing it). All comparisons below are restricted to the 180-row overlap between the April benchmark set and the current benchmark set (`n = 96` problematic rows on the April side, `n = 100` on the current side — the small difference comes from the 12 GT-correction flips in PR #205 reclassifying some rows from *Supported* to *Partially supported* or *Not supported*). April-side numbers are recomputed from `benchmark/historical-runs/2026-04-19-results.json` against the corrected GT, so the comparison is apples-to-apples on the same rows.

| Provider                          | April (single-call, 9 few-shots) | Current (atomize + verify + deterministic rollup) |
|-----------------------------------|---------------------------------:|--------------------------------------------------:|
| `claude-sonnet-4-5`               | 30 / 96  (31 %)                  | 95 / 100  (95 %)                                  |
| `openrouter-mistral-small-3.2`    | 24 / 96  (25 %)                  | 90 / 100  (90 %)                                  |
| `openrouter-deepseek-v3.2` / `-v3`| 16 / 96  (17 %)                  | 87 / 100  (87 %)                                  |
| `openrouter-olmo-3.1-32b`         | 19 / 96  (20 %)                  | n/a (excluded — empty-body bug)                   |
| `openrouter-vote-3` (4-class)     | 16 / 96  (17 %)                  | 91 / 100  (91 %)                                  |
| `gemini-2.5-flash`                | 81 / 96  (84 %)                  | (not in current panel)                            |

Gemini's April-side outlier (84 %) reflects an already-lenient flagger — it traded recall for editor-FP rate at the time (see below).

**2. The editor-perspective false-positive rate is roughly flat (and in some cells, better).** "Editor-FP" = of the rows whose ground truth is *Not supported*, the share where the panel said *Supported* or *Partially supported* (i.e., wrongly accepted a citation that doesn't hold up under inspection). This is the metric editors care most about — it bounds how often the tool will tell an editor "this is fine" when the editor would conclude otherwise on review. Same 180-row overlap (`gt_neg = 44` on the April side, `45` on the current side — again the difference is the GT-correction flips):

| Provider                          | April editor-FP | Current editor-FP |
|-----------------------------------|----------------:|------------------:|
| `claude-sonnet-4-5`               | 8 / 44 (18.2 %) | 8 / 45 (17.8 %)   |
| `openrouter-mistral-small-3.2`    | 14 / 44 (31.8 %)| 10 / 45 (22.2 %)  |
| `openrouter-deepseek-v3.2` / `-v3`| 5 / 44 (11.4 %) | 7 / 45 (15.6 %)   |
| `openrouter-olmo-3.1-32b`         | 12 / 44 (27.3 %)| n/a               |
| `openrouter-vote-3` (4-class)     | 9 / 44 (20.5 %) | 10 / 45 (22.2 %)  |
| `gemini-2.5-flash`                | 3 / 44 (6.8 %)  | (not in current panel) |
| `hf-gpt-oss-20b`                  | (not run)       | 4 / 45 (8.9 %)    |
| `hf-qwen3-32b`                    | (not run)       | 8 / 45 (17.8 %)   |
| `openrouter-qwen-3-32b`           | (not run)       | 9 / 45 (20.0 %)   |
| `openrouter-granite-4.1-8b`       | (not run)       | 15 / 45 (33.3 %)  |

For the flagship verifier (Claude Sonnet 4.5) the editor-FP rate moved from 18.2 % to 17.8 % — within noise. Mistral improves from 31.8 % to 22.2 %. The full current panel's editor-FP rate ranges from 8.9 % (gpt-oss) to 33.3 % (granite, the smallest model); most members sit in the 13–22 % band. Gemini was the April low at 6.8 % but at the cost of flagging only ~22 % of all citations (see flag-rate below).

**3. Why the trade is the right one, restated for the user-facing audience.** In April the script flagged ~22 % of citations total (Claude, 40 / 180) and missed ~69 % of real problems (66 / 96). After the rewrite the script flags ~72 % of citations (130 / 180) and misses only ~5 % (5 / 100). The "wrongly accepts a bad cite" rate stayed in the same range — around one in five for Claude. The change is essentially: **trade a higher inspection load for catching ~3× more problems, without making the false-acceptance rate worse**. For an editor working a referenced article this means the tool now flags most of the cites that warrant inspection, instead of mostly only the cites that were already obviously broken.

**4. Caveats on the binary ensembles.** `openrouter-vote-3-binary` and `hf-vote-3-binary` (collapse Supported / Partially supported / Not supported to a 2-way support / no-support before voting) show much lower recall (48 / 100 = 48 % and 57 / 100 = 57 % respectively) because the binary collapse can only catch *Not supported*-class problems — Partially-supported claims, which are most of the problem rows, fall into the "support" bucket by collapse rule and are uncatchable. The 4-class `openrouter-vote-3` and `hf-vote-3` are the right ensembles to read for the recall claim above.

**5. Exact-match metric (for completeness, though it's not the load-bearing one for the editor audience).** On 4-way exact-match (Supported / Partially / Not / Source-unavailable, normalized for casing) restricted to the 180-row overlap, `claude-sonnet-4-5` improves 47.8 % → 64.4 %, `openrouter-mistral-small-3.2` 48.3 % → 63.3 %, `openrouter-vote-3` 47.2 % → 65.0 %. Most current panel members are in the 52–65 % band; the headline editor-facing argument carries on the recall + editor-FP framing above, not on exact-match.

**6. User-facing model coverage (gap-fill run, 2026-05-14 evening).** The headline panel above is the model selection used during development; it is not the same set of model IDs the userscript currently exposes to end users. The userscript's `WikipediaSourceVerifier.providers` registry in `main.js` offers five options (`publicai` = Qwen-SEA-LION-v4-32B-IT, `huggingface` = Qwen3-32B, `claude` = Sonnet 4.6, `gemini` = Flash-latest, `openai` = gpt-4o). To bound the gap between *measured* and *user-facing* numbers, a gap-fill cell was run against the same 180-row overlap with the same atomized pipeline, same cached Haiku atoms, deterministic rollup:

| User-facing cell | Model ID | Recall (caught/100) | Editor-FP (fp/45) | Status |
|---|---|---:|---:|---|
| `huggingface` (default for no-BYOK users) | `Qwen/Qwen3-32B` via `/hf` | 95 / 100 (95.0 %) | 8 / 45 (17.8 %) | ✅ Same cell as `hf-qwen3-32b` in headline panel |
| `claude` | `claude-sonnet-4-6` | 95 / 100 (95.0 %) | 8 / 45 (17.8 %) | ✅ Behavior-equivalent to 4.5 on the editor metrics; 4-way exact drops 64.4 % → 57.8 % (4.6 splits Supported/Partially differently, neutral on the user-facing aggregate) |
| `gemini` | `gemini-2.5-flash` | 96 / 100 (96.0 %) | 10 / 45 (22.2 %) | ✅ Versus April 84.4 % / 6.8 %: moves up the precision/recall tradeoff curve — catches 15 more real problems, accepts 7 more bad cites |
| `publicai` | `aisingapore/Qwen-SEA-LION-v4-32B-IT` | (unreliable) | (unreliable) | ⚠️ The PublicAI route (via the `publicai-proxy.alaexis.workers.dev` worker — same path as production) returned errors on 134 / 181 rows (98 sub-500ms fast-fail + 34 60-second timeouts + 2 other-fail). Only 47 rows had all atom calls succeed; on those 47 the verifier reads 21.3 % exact-match. **The 100 %-recall / 0 %-editor-FP figure on this cell is an artifact of failed-call → NOT SUPPORTED collapse in `parseAtomResultResponse`, not a real measurement.** This is a live production-reliability problem for the userscript's `publicai` default — worth filing upstream against PAP and/or PublicAI before continuing to recommend Qwen-SEA-LION as a no-BYOK option. |
| `openai` | `gpt-4o` | (not run) | (not run) | ❌ Out-of-pocket BYOK; not measured under the new pipeline. Closest reference: `hf-gpt-oss-20b` (an unrelated open-weight model that happens to share a vendor name) at 99 / 100 recall and 4 / 45 editor-FP. Not a substitute. |

**Takeaway.** Three of the five user-facing cells (`huggingface`, `claude`, `gemini`) are now empirically covered under the new pipeline at the exact model IDs the userscript ships with. The `publicai` cell is unusable on the benchmark route and worth investigating before it is recommended to users. The `openai` cell is unmeasured.

**Data location.** `benchmark/results.json` (current panel, 2026-05-14 run, including the three gap-fill cells appended via `--resume`) and `benchmark/historical-runs/2026-04-19-results.json` (April single-call baseline) are the committed artifacts. Both are scored against the same corrected `dataset.json` (the 12-row GT-corrections set lands in PR #205 as a sibling of this design's implementation PR). All numbers in this section are derived from those files; the scoring is reproducible from the repo without any external state.

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
