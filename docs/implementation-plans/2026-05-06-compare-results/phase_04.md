# Compare Results — Phase 4: Documentation

> **For Claude:** REQUIRED SUB-SKILL: Use `ed3d-plan-and-execute:executing-an-implementation-plan` to implement this plan task-by-task.

**Goal:** Create `docs/comparing-benchmark-runs.md` — a single reference doc that explains what `ccs compare` does, when contributors would use it, and the use-case patterns it supports. Lives in `citation-checker-script/docs/` alongside `llm-benchmarking-overview.md`. End state: a contributor (you, future contributors, or Alex) can understand from this doc alone how to run a comparison and what subset filters are available.

**Architecture:** Reference-style doc, not a design plan. Should follow the prose density of `docs/llm-benchmarking-overview.md` (which exists in the same `docs/` directory) — narrative paragraphs with short code blocks, not heavy tables.

**Tech Stack:** Plain Markdown. No status header (those are for `docs/design-plans/`, not reference docs).

**Branch context:** Continues on the same feature branch as Phases 1–3. Phases 1–3 must be complete with all tests passing before starting.

**Scope:** Phase 4 of 4.

**Codebase verified:** 2026-05-06.

**Codebase verification findings:**
- ✓ `docs/` exists in the upstream tree (added by PR #154, per workspace `CLAUDE.md`).
- ✓ `docs/README.md` distinguishes reference docs (top of `docs/`) from design plans (`docs/design-plans/`). The new doc is a reference doc, so it goes at the top of `docs/`.
- ✓ `docs/llm-benchmarking-overview.md` is the existing reference doc to take stylistic cues from.
- ✓ No existing `docs/comparing-benchmark-runs.md` — fresh ground.

---

## Task 1: Write `docs/comparing-benchmark-runs.md`

**Files:**
- Create: `citation-checker-script/docs/comparing-benchmark-runs.md`

**Step 1: Create the file**

Create the doc with the following content. Adjust prose to match the rhythm of `docs/llm-benchmarking-overview.md` if it differs significantly — keep the doc readable in one sitting (target ~500 words of prose, plus code blocks and tables):

```markdown
# Comparing benchmark runs

The `ccs compare` subcommand turns two `results.json` files (a *control* and a *treatment*) into a structured per-provider accuracy + flip report. It exists so contributors can validate prompt changes, worker-side changes, dataset augmentations, or panel-member swaps against a baseline without writing a one-off comparison script every time.

The tool operates on the *intersection* of cells present in both runs — `(entry_id, provider)` pairs that successfully predicted in both control and treatment. Cells where either side errored or didn't run are excluded from the comparison so accuracy isn't skewed by missing data.

## Quick start

From inside `benchmark/`:

```sh
# Render a Markdown report
npm run compare -- control.json treatment.json --dataset dataset.json --report out.md

# Render a self-contained HTML report
npm run compare -- control.json treatment.json --dataset dataset.json --report out.html

# Print JSON to stdout for piping into another tool
npm run compare -- control.json treatment.json --dataset dataset.json
```

Or invoke the underlying CLI directly:

```sh
npx ccs compare control.json treatment.json --dataset dataset.json --report out.html
```

The format of the report is chosen by the file extension on `--report`: `.html`, `.md` (or `.markdown`), or `.json`. With no `--report`, JSON is written to stdout.

## What the report shows

Two tables, in both Markdown and HTML output:

1. **Headline accuracy.** For each provider, the count of correct cells out of total compared cells, in both control and treatment, with a Δ in percentage points. Three metrics:
    - *exact match* — the predicted verdict equals ground truth literally (after case/whitespace normalization).
    - *lenient* — exact, plus `Supported ↔ Partially supported` counted as a near-miss. Useful when the GT distinction between those two is itself fuzzy and a Supported→Partially shift shouldn't count as an error.
    - *binary* — Supported and Partially supported are pooled into one class; Not supported and Source unavailable into the other.

    Rows whose `|Δ|` falls below the noise floor (default ±5pp, configurable via `--noise-floor`) on *all three* metrics are flagged so a reader treats them as noise rather than signal.
2. **Flip table.** Every cell that changed verdict, classified as one of:
    - **improvement** — wrong in control, correct in treatment.
    - **regression** — correct in control, wrong in treatment.
    - **lateral** — wrong in both, but the verdict shifted to a different wrong answer.

Cells that were *unchanged-correct* or *unchanged-wrong-same* are aggregated in the per-provider counts but don't appear in the flip table.

## Subset filtering

The `--filter <key>=<value>` flag re-aggregates the comparison over a subset of cells *after the full comparison runs*. This is deliberate: pre-classifying rows before the experiment and filtering before the comparison invites confirmation bias. Always run the full comparison, then slice in the report.

Supported filter keys:

| Key | Example | Effect |
|---|---|---|
| `version` | `--filter version=v2` | Restrict to dataset rows with `dataset_version === 'v2'`. |
| `provider` | `--filter provider=openrouter-vote-3` | Restrict to a single provider/panel. |
| `direction` | `--filter direction=regression` | Restrict to cells with a specific flip direction (useful for "show me only the regressions"). |

Combine filters by running the comparison multiple times with different `--filter` values; the JSON output is small enough that piping through `jq` is also fine for ad-hoc slicing.

## Recording what changed

Two optional flags add metadata to the report so a reader knows what they're looking at:

- `--change-axis <name>` — repeat for each thing that differs between control and treatment (e.g., `--change-axis prompt --change-axis source_text`). Recorded in the report's metadata block.
- `--gt-version <label>` — the ground-truth version (e.g., `post-audit-2026-04-30`). Useful when re-scoring an old result file against a revised dataset; the report records which GT was applied.

These don't change the comparison logic, only the report's metadata. Use them so readers can audit which axis each comparison isolates.

## When to use this

- **Before/after a prompt change.** Run the benchmark once with the old prompt, once with the new, then compare. `--change-axis prompt`.
- **Before/after a worker / proxy change.** Compare against a baseline run before the change. `--change-axis source_text`.
- **Control vs augmented dataset.** When testing whether a dataset augmentation (e.g., prepending Citoid metadata) helps, run both with and without and compare.
- **Provider-panel A/B.** Compare runs that included a different mix of panel members.
- **Pre-submission check before opening a PR.** Run your branch's benchmark against a frozen canonical baseline; the report's flip table is what to paste into the PR description.

## Exit codes

- `0` — comparison ran successfully. Always returned on a clean run, regardless of whether regressions were found. **Inspect the report; the tool does not gate on regressions.**
- `2` — bad arguments, file not found, JSON parse failure, no overlapping cells, or unrecognized `--filter` key. Genuine errors only.

If you want a CI gate that fails on regression, pipe the JSON output through a separate script that decides the threshold — do not bake gating into this tool.

## Source layout

- `benchmark/compare_results.js` — pure comparison logic (`compareResults`, `filterComparison`, verdict normalizers, classification, aggregation).
- `benchmark/render_compare.js` — Markdown / HTML / JSON renderers (`renderMarkdown`, `renderHtml`, `renderJson`).
- `cli/compare.js` — argument parsing and the `runCompare` orchestration that loads files, calls compare, applies filters, writes reports.
- `tests/compare_results.test.js`, `tests/render_compare.test.js`, `tests/compare_cli.test.js` — unit + integration coverage.

The pure logic in `compare_results.js` and `render_compare.js` does no I/O — they take parsed inputs and return data structures or strings. The CLI is the only layer that touches the filesystem. This is intentional so the comparison logic is callable from a script, a test, or a future GUI without dragging file-system assumptions along.
```

**Step 2: Verify the file was written and tables/code blocks are well-formed**

Run: `wc -l docs/comparing-benchmark-runs.md && head -30 docs/comparing-benchmark-runs.md`
Expected: Non-zero line count and the first 30 lines look correct.

If you have access to a Markdown previewer (VS Code, GitHub preview), open the file and confirm the tables render correctly and the code blocks are properly fenced. Code-block fence balance can also be sanity-checked with: `grep -c '^```' docs/comparing-benchmark-runs.md` — the count should be even.

**Step 3: Verify it links from `docs/README.md` if appropriate**

Read `docs/README.md` to see if it indexes the reference docs. If it does, add a one-line entry pointing at `comparing-benchmark-runs.md`. If it doesn't (it's just the design-plans pointer), no change needed.

**Step 4: Commit**

```bash
git add docs/comparing-benchmark-runs.md
# If docs/README.md was updated, add it too:
# git add docs/README.md
git commit -m "docs: explain ccs compare subcommand, use cases, and subset filters"
```

---

## Task 2: Final verification — full test suite + manual smoke

**Step 1: Run all tests one more time**

Run: `npm test`
Expected: All tests pass. Total: ~202 tests on integration-base baseline of 174 + ~28 new across phases 1–3.

**Step 2: End-to-end smoke against real benchmark output**

If you have a `benchmark/results.json` file from a recent run plus the matching `dataset.json`, do a self-comparison sanity check (control == treatment, so every cell should be `unchanged-correct` and there should be zero flips):

```bash
node bin/ccs compare benchmark/results.json benchmark/results.json --dataset benchmark/dataset.json --report /tmp/self-compare.html
```
Expected: `Report written to /tmp/self-compare.html`. Open the file: every Δ should be 0.0 with the `(noise)` annotation, and the flip table should say "No flips."

Coverage may be less than the total number of (entry_id, provider) combinations if any cells errored in the original run — errored cells are filtered from both sides and excluded from the intersection. That's expected; the report's coverage block lists how many cells were excluded.

If you have two real result files from different runs (e.g., `benchmark/historical-runs/2026-04-19-results.json` and the current `benchmark/results.json` if the schema is compatible), run a real comparison and eyeball whether the flip table is plausible.

**Step 3: Final commit (if any housekeeping)**

If the smoke run revealed any issues, fix them and commit; otherwise no commit for this task.

---

## Plan complete

After Task 2 succeeds:
- `benchmark/compare_results.js` is implemented, tested, and exports a clean public API.
- `benchmark/render_compare.js` produces Markdown, HTML, and JSON reports.
- `cli/compare.js` integrates the comparison as `npx ccs compare`.
- `docs/comparing-benchmark-runs.md` documents the subcommand and use cases.
- ~28 new tests cover the surface; all 174 pre-existing tests still pass.

The branch is ready for a PR to `alex-o-748/citation-checker-script`. Per `FORK.md`, the PR is the canonical artifact; `integration-base` will absorb the merged changes once Alex merges (or once it lands as `alex-o-748/main` shifts forward, whichever happens first).

Out-of-scope follow-up work (already noted in the design sketch and tracked separately):
- Verdict-shift transition matrix per provider (Sup→NSup, NSup→Sup, etc.).
- FP/FN rate breakdown by ground-truth class.
- Wikitext renderer for AI-skeptic Wikipedians.
- Three-way comparison via `--baseline` (control vs treatment vs canonical baseline).
