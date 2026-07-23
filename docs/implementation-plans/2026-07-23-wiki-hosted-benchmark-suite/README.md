# Wiki-Hosted Benchmark Suite — Implementation Plan

> **Status (2026-07-23):** Planned, not started.

Implementation plan for
[`docs/design-plans/2026-07-23-wiki-hosted-benchmark-suite.md`](../../design-plans/2026-07-23-wiki-hosted-benchmark-suite.md).

Seven phases, one file each. Execute in order — every phase depends on the one before it.

| Phase | File | Human-gated? |
| --- | --- | --- |
| 1 | [`phase_01.md`](phase_01.md) — Row template + suite page scaffolding | **Yes** — on-wiki edits |
| 2 | [`phase_02.md`](phase_02.md) — Suite parser and validator | No |
| 3 | [`phase_03.md`](phase_03.md) — Fetch and snapshot layer | One step (Task 4 Step 3) |
| 4 | [`phase_04.md`](phase_04.md) — Extraction integration | No |
| 5 | [`phase_05.md`](phase_05.md) — Migration | **Yes** — on-wiki edits |
| 6 | [`phase_06.md`](phase_06.md) — vN retirement | No |
| 7 | [`phase_07.md`](phase_07.md) — Userscript write path | **Yes** — maintainer sign-off |

## Human-gated steps

Three phases contain steps an agent cannot perform:

- **Phase 1 and Phase 5** require saving edits to en.wikipedia under the maintainer's
  own account. Every task in those phases is structured so that *tooling generates
  the exact wikitext* and a human performs only the paste-and-save. Tasks marked
  **`[HUMAN]`** must be handed to the maintainer; tasks marked `[AGENT]` are ordinary
  code work.
- **Phase 7** changes `main.js`'s rendered surface (a new dialog, four button
  behaviours). Per repo convention this requires alignment with the primary
  maintainer (@alex-o-748) *before* implementation. Do not start Phase 7 without
  recorded sign-off.

## Verified codebase state (2026-07-23)

Investigated before planning. Where the design and reality diverge, **this section
wins** and the phase files are written against reality.

| Design assumption | Reality |
| --- | --- |
| Fetch pattern to copy lives in `core/citoid.js` | **`core/citoid.js` does not exist.** The only Node fetch helper is `fetchURL()` in `benchmark/extract_dataset.js:135-164`, which sends `User-Agent: Mozilla/5.0 (compatible; BenchmarkBot/1.0)` — a spoofed generic UA that violates [WMF's UA policy](https://meta.wikimedia.org/wiki/User-Agent_policy). Phase 3 writes a fresh, correctly-identifying fetch helper rather than copying it. |
| `--rows` alias join covers `compare_results.js` | `--rows` as a *flag* exists only in `extract_dataset.js:348-361`. But `compare_results.js` **does** join on row id — `compare_results.js:157` builds `datasetById` from `dataset.json` and `:175` looks up `results.entry_id` against it. Once dataset ids become `ctb-`, comparing a historical `results.json` (legacy `row_N` ids) against a new run silently loses every dataset entry. The design's requirement was right; Phase 4 Task 7 wires alias resolution there too. |
| CSV at `benchmark/Benchmarking_data_Citations.csv` | Repo root: `Benchmarking_data_Citations.csv`, referenced as `path.join(__dirname, '..', ...)` at `extract_dataset.js:43`. 189 data rows, 8 columns. |
| `buildSubmitToDatasetButton` call sites at `main.js:3627, 3706, 3747, 4395` | Actual: **3628, 3709, 3750, 4396**. Function itself is at 4429 as stated. Phase 7 instructs locating call sites by content, not line number. |
| `benchmark/` already depends on something wiki-related | Only dependency is `jsdom@^24.0.0`. `wtf_wikipedia` is new. |

Confirmed as described: `benchmark/io.js` (`loadRows`/`loadMetadata`/`writeWithMetadata`/`todayIso`),
`core/verdicts.js` (`canonicalizeVerdict`, four canonical UPPERCASE verdicts),
`core/submission.js` (Google-Form helpers, inlined by `scripts/sync-main.js`),
`scripts/sync-main.js` markers `// <core-injected>` / `// </core-injected>` with 9 modules,
`benchmark/dataset.json` (189 rows, `{metadata, rows}` envelope, per-row `dataset_version`),
`benchmark/historical-runs/` (stores `entry_id`), and the three independent `--version`
implementations (`extract_dataset.js:54-57,340-345`, `run_benchmark.js:190-193,483-487`,
`analyze_results.js:41,286-296`).

## Measured `wtf_wikipedia` behavior

The design presents a failure-mode table as "measured". Published docs and issues
document **none** of it, so it was re-measured directly against `wtf_wikipedia@10.4.2`
(the design's target version, and the current npm release) using the real template
name. Results below are what the phase-2 fixtures encode.

| Input in a param value | Measured result |
| --- | --- |
| bare `=`, `?a=1&b=2#frag`, non-ASCII, `"` and `'` | **intact** — design correct |
| `[[Foo\|bar]]` | flattened to `bar` — design correct (lossy, accepted) |
| bare `\|` | value truncated to `a`, spurious `list: ["b"]` param invented — design correct |
| `{{!}}` and `<nowiki>\|</nowiki>` | **identical corruption to a bare pipe** — design correct, the standard escapes do not work |
| `&#124;` | survives encoded as the literal string `&#124;` — design correct |
| empty value (`\|rationale=\|`) | param silently absent from output — design correct |
| duplicate param | last wins silently — design correct |
| `{{CURRENTYEAR}}` | expanded to `2026` at parse time — design correct, breaks reproducibility |

**Three corrections to the design's table:**

1. **Braces: only *unbalanced* braces destroy the row.** The design says "`{` or `}` in
   a value → entire template returns `null`". Measured: `rationale=a {b} c` parses
   **fine**; `rationale=see {note` and `rationale=see note}` each return `[]` — the
   template vanishes entirely. The vanishing failure is real and catastrophic, so the
   validator still rejects **any** `{` or `}` as a conservative rule, but the phase-2
   fixtures encode the balanced case explicitly so a future maintainer doesn't
   "fix" the rule after observing that `{b}` works.

2. **Template-name normalization is lowercase, not underscored.** The internet
   research claimed spaces become underscores. Measured: `.json()` returns
   `template: "user:alaexis/ai source verification/benchmark/row"` — **spaces
   preserved, whole name lowercased**. Matching must be case-insensitive on the
   lowercased-with-spaces form. Phase 2 depends on this.

3. **The parser silently strips some whitespace before punctuation — the design
   does not mention this at all, and it breaks naive parity.** Measured: `x , y`
   comes back as `x, y`, and a trailing ` .` loses its space. The behavior is
   irregular rather than a rule — only the *first* ` ,` in a value is affected
   (`a , b , c` → `a, b , c`), only a *trailing* ` .`, and `;:!?` are untouched
   mid-string. Four real CSV rows (lines 158, 170, 178, 180) contain ` ,` and
   would fail a byte-comparison parity check for this reason alone.

   Reproducing the quirk in our own code would be fragile. Instead
   `escapeParamValue` **pre-normalizes whitespace before punctuation itself**, so
   the sequences that trigger the quirk never reach the parser and the round trip
   is exact. Verified across the full case set including the four affected rows.
   The cost is that migration rewrites ` ,` to `,` in four claim-text values — a
   cosmetic typo cleanup, expected in the diff and called out in Phase 4 Task 3.

Additional measured facts the phases rely on:

- `.json()` returns the named params **plus a reserved `template` key**. A row param
  named `template` would collide; the validator rejects it.
- Multi-line "pretty" template calls (`{{Name\n| id = x\n| truth = Supported\n}}`)
  parse correctly with values trimmed. This is the format the suite page uses.
- Templates transcluded inside a `{|class="wikitable"` render block parse normally.
- Raw-occurrence reconciliation is viable: a page with 3 raw `{{…/Row` occurrences
  where one has an unbalanced brace yields 3 regex matches and 2 parsed templates —
  exactly the mismatch the validator must hard-fail on.

The probe script that produced this table is reproduced as a committed test fixture in
Phase 2, Task 3, so the claims stay verifiable and re-checkable on dependency bumps.

## Deliberate divergences from the design

Every place this plan does something the design did not say, with the reason.

| Divergence | Where | Why |
| --- | --- | --- |
| Fetch helper is written fresh, not copied from `core/citoid.js` | Phase 3 | That file does not exist; the nearest analogue sends a spoofed browser UA that violates WMF policy. |
| CSV→wikitext generator built in Phase 4, not Phase 5 | Phase 4 Task 2 | Parity cannot be demonstrated before rows exist on-wiki; generating and round-tripping offline is a stronger check, and Phase 5 then publishes exactly what parity validated. |
| Fetch/snapshot split into `suite_fetch.js` rather than living in `suite.js` | Phase 3 | Keeps `suite.js` a pure string→object module like `core/claim.js`; the purity is asserted by a check. |
| `escapeParamValue` lives in `core/submission.js`, shared by benchmark and userscript | Phase 4 Task 2 | The escaping rule must be byte-identical on both sides or the userscript writes rows the parity harness would flag. One implementation, two consumers. |
| `escapeParamValue` normalizes whitespace before punctuation | Phase 4 Task 2 | Defuses the undocumented parser quirk above; see correction 3. |
| Ingestion computes a missing `id` instead of rejecting the row | Phase 2 Task 4, Phase 7 | The design requires hash recomputation with a warn-on-mismatch (design "Row identity"), and requires editor contributions to land with zero maintainer file edits (success criterion 2). A contributed row cannot carry a correct hash, and rejecting it would let one contribution block ingestion for everyone. |
| Phase 3 Task 4 includes one on-wiki edit | Phase 3 Task 4 | Needed to exercise the happy path against a *valid* page; the Phase 1 sample rows are deliberately invalid. Marked `[HUMAN]` inline. |
| Alias resolution added to `compare_results.js` | Phase 4 Task 7 | Required after all — see the verified-state table above. |

## Conventions the executor must follow

From the root `CLAUDE.md` and observed test files:

- **Tests:** `node:test` + `node:assert/strict`, flat `test('...', () => {})` calls, no
  describe/it nesting. Run with `npm test` from the repo root
  (`node --test 'tests/**/*.test.js'`). All new tests go in `tests/` as `*.test.js`.
- **Filtering tests — `npm test -- --test-name-pattern=X` does NOT work.** Verified:
  it runs all 290 tests and silently ignores the filter, because Node only parses
  options that appear *before* the file-list argument. To run a subset use:

  ```sh
  node --test --test-name-pattern='<pattern>' 'tests/**/*.test.js'
  ```

  Every "run this subset" command in the phase files uses that form. Always finish a
  task with a bare `npm test` regardless, to catch cross-file regressions.
- **Modules:** ESM everywhere (`"type": "module"` in both the root and `benchmark/`
  package.json). Node `>=18`.
- **`cd benchmark && npm install` is a prerequisite for the root `npm test`** from
  Phase 2 onward: `wtf_wikipedia` is declared in `benchmark/package.json`, and
  `benchmark/suite.js` re-exports it so that both `benchmark/suite.js` and
  `tests/suite*.test.js` resolve to the same `wtf_wikipedia` instance. This guards
  against version drift if the `^10.4.2` range floats to a different patch level.
- **Fixtures:** no fixture directory convention exists; tests use inline data, helper
  builders, and temp files cleaned up in `finally`. This plan follows that — all
  wikitext fixtures are inline via small builder helpers, and no `tests/fixtures/`
  directory is introduced.
- **Entry guard:** any script with a `main()` must gate it behind
  `if (process.argv[1] === fileURLToPath(import.meta.url))` so tests can import it.
- **No linter, no formatter, no test CI.** `npm test` and `npm run build -- --check`
  are manual pre-submission checks.
- **Analytical tools always exit 0.** Input-integrity validation is the documented
  exception — the suite validator *must* exit non-zero on malformed input, because
  silent row loss changes the denominator of every accuracy metric.
- **Staging:** enumerate files explicitly in `git add`; never `git add <dir>/`.
  `benchmark/package-lock.json` sweeps in unwanted otherwise.
