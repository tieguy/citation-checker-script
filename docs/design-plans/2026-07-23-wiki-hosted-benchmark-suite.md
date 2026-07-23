# Wiki-Hosted Benchmark Suite Design

> **Status (2026-07-23):** Proposed. Drafted, not started.

## Summary

The core move is swapping the dataset's source of truth from a version-controlled CSV
to a live, editable Wikipedia user subpage — so ground-truth benchmark rows can be
contributed by any logged-in Wikipedia editor without touching the git repo or a
Google Form. Each row becomes a transclusion of a wikitext template carrying identity
fields (article, revision, citation number), a human verdict, and optional model
output for comparison. A new pure-function parser/validator (`benchmark/suite.js`,
built on `wtf_wikipedia`) turns that wikitext into the same row shape the pipeline
already consumes, with validation treated as load-bearing because the underlying
parser can silently drop malformed rows rather than erroring.

Reproducibility is preserved by fetching raw wikitext at a pinned revision ID,
freezing it to disk, and deriving all downstream extraction from that frozen snapshot
rather than a live fetch — replacing the current `v1`/`v2`/`v3` version tags with
revision IDs that mark cumulative migration boundaries. A parallel change to row
identity (a content hash over identity fields, rather than CSV line number) fixes a
known fragility where inserting rows mid-file silently renumbers and misaligns
historical results; an alias map keeps old artifacts joinable to the new IDs. Finally,
the userscript's existing submit button is rewired to write directly to the wiki page
via the MediaWiki API under the contributor's own session, with a new dialog added to
capture the human verdict the button previously never collected.

## Definition of Done

Move the benchmark suite from the in-repo `Benchmarking_data_Citations.csv` onto an
editable Wikipedia page, so Wikipedia editors can add benchmark rows without a
GitHub account, and pin benchmark runs to a revision of that page instead of the
current `v1`/`v2`/`v3` subset tags.

### Deliverables

1. **Suite page.** `User:Alaexis/AI_Source_Verification/Benchmark` on en.wikipedia
   holds all 189 current rows as per-row template transclusions, rendering as a
   readable table. A prominent header section on the page itself carries the
   ground-truth principle (*label what an editor following the citation to the live
   page would find — not what our scraper captured*), the value-formatting rules, and
   the "second editor confirms" convention.

   A page-specific editnotice would be the more conventional vehicle for this, but
   `Template:Editnotices/Page/<title>` is title-blacklisted to admins, template
   editors, and page movers — rights the maintainer does not hold. A page header
   requires no rights and is visible to readers as well as editors.

2. **Revision-pinned extraction.** `extract_dataset.js` builds `dataset.json` from
   that page at a pinned revision (`--suite-oldid N`), producing output equivalent to
   today's CSV-derived rows for all 189 migrated rows. The resolved suite is committed
   as a snapshot so runs reproduce offline and without network access.

3. **Stable row IDs.** Row identity survives mid-table insertion, retiring the
   `row_<csv_line>` scheme. An alias map preserves joinability to existing
   `results.json` and `historical-runs/` artifacts.

4. **Userscript rewiring.** The shipped "Submit to dataset" button (merged
   2026-05-17, `core/submission.js`) writes a row to the suite page via the
   MediaWiki API instead of opening a Google Form. Because a benchmark row needs a
   *human* verdict and the current UI only ever captures the model's, the button
   gains a small confirmation dialog that collects `truth` before writing.

   MediaWiki's `preload` parameter cannot append to a non-empty page — it is
   silently ignored — so a URL-only "prefilled edit" approach is not available.
   The write goes through `mw.Api().postWithEditToken({action: 'edit',
   appendtext})` using the contributor's own logged-in session; no OAuth is
   involved and the edit is attributed to them.

5. **vN retirement via migration revids.** The page is built in three successive
   edits — v1's 76 rows, then v2's 34, then v3's 79 — so each batch boundary is a
   revision. `--version v1` becomes `--suite-oldid <rev-after-edit-1>` and
   `--version v1,v2` becomes `--suite-oldid <rev-after-edit-2>`. The `--version`
   filter apparatus and its npm scripts are replaced by a constants table of three
   revids. Cohort membership becomes derivable from revision history rather than
   stored per row.

### Success criteria

- Parity diff between CSV-derived and wiki-derived `dataset.json` is clean across
  all 189 rows.
- A row added by a non-maintainer editor lands in the next pinned run with zero
  maintainer file edits.
- The three migration revids reproduce the current `v1` and `v1+v2` subsets.

### Out of scope

- **Licensing.** Relicensing is available to the authors; not addressed here.
- **Per-wiki suite pages.** The tool now supports French Wikipedia, but this design
  ships en-only. Every row carries an explicit `wiki=enwiki` param and the parser
  requires it, so a second suite page can be added later without a schema migration.
- **v3-in-isolation.** Revisions are cumulative, so revid pinning expresses
  `v1`, `v1+v2`, `v1+v2+v3` but not `v3` alone. Confirmed not needed; no row-level
  cohort-filter mechanism is built.
- **Removing `core/submission.js`.** The Google Form plumbing stays in place as a
  fallback during migration; a follow-up removes it once the wiki page proves out.
- **Dispute resolution venue.** Ground-truth disagreements are handled elsewhere,
  drawing from this page rather than living on it.

### Resolved trade-offs

| Chose | Over | Consequence accepted |
| --- | --- | --- |
| Friction-free row addition | Label gating | Rows count toward headline metrics immediately; advancing the pinned revid is the only review gate. |
| Social review | Pipeline state | Contributor supplies ground truth with a rationale; a second editor confirms. No `proposed`/`accepted` machinery. |
| Direct editing, invited by a page header | A separate `/Submissions` subpage | Relies on social signalling to overcome the "don't edit user space" norm. |
| Continuity in the UI | A clean end state | The Submit button is repointed rather than removed; Form plumbing lingers. |
| Forward-compat on `wiki=` only | Full multi-wiki support | One reserved param today; per-wiki pinning deferred. |

## Glossary

- **User subpage**: A Wikipedia page namespaced under a specific user (e.g.
  `User:Alaexis/...`), editable like any wiki page but conventionally treated as that
  user's personal space — hence this design's reliance on a prominent page header to
  invite outside edits despite the norm.
- **Transclusion**: Embedding one page's or template's content inside another via
  `{{...}}` syntax. The suite page renders as a table built from many individual
  row-template invocations rather than one hand-edited table.
- **Wikitext**: MediaWiki's markup source format, as opposed to rendered HTML. The
  design stores and parses this raw format specifically because it — unlike rendered
  output — reproduces exactly at a given revision.
- **Revision / `oldid`**: MediaWiki's identifier for a specific saved version of a
  page. `action=raw&oldid=N` fetches that exact historical wikitext, which is how a
  benchmark run is pinned to an immutable input.
- **Editnotice**: A MediaWiki mechanism displaying a custom notice to anyone editing a
  specific page. Considered and rejected here: page-specific editnotices live under
  `Template:Editnotices/Page/`, which is title-blacklisted to admins, template
  editors, and page movers.
- **Tracking category**: A category a template auto-adds a page to when given
  malformed input, making validation errors visible on-wiki without running any
  tooling.
- **`wtf_wikipedia`**: Third-party JS library parsing wikitext into structured data.
  Adopted here as the first benchmark-pipeline dependency beyond `jsdom`; its parsing
  quirks (see the behavior table) drive the validator's design.
- **`mw.Api()` / `postWithEditToken`**: MediaWiki's client-side JavaScript API and its
  token-authenticated write method, letting the userscript save an edit under the
  logged-in user's own session without OAuth.
- **`preload` parameter**: A URL parameter that pre-fills a *new* page's edit box.
  Unusable here because it silently no-ops when the target page already has content —
  it cannot append to an existing table.
- **Content hash (row ID)**: A stable identifier derived by hashing a row's identity
  fields (`wiki`, `oldid`, `citation`, `instance`) rather than its position in a file,
  so correcting or reordering rows doesn't change their ID. Replaces the legacy
  `row_<csv_line>` scheme.
- **`{metadata, rows}` envelope**: The existing JSON shape (`benchmark/io.js`) that
  dataset and results files conform to. New fields (`suite_page`, `suite_oldid`) fit
  into the existing metadata block rather than a parallel manifest.
- **Cohort / version tag (`v1`/`v2`/`v3`)**: The current per-row tag recording which
  historical import batch a row came from. Replaced by revision-based cohorts — a row
  belongs to `v1` if it existed by revision X — derived from page history rather than
  stored per row.
- **Parity harness**: The migration's correctness check, comparing rows produced by
  the new wiki-sourced pipeline against the same rows from the CSV-sourced pipeline.
  Compares identity, ground-truth, and claim fields only; `source_text` is excluded
  because live sources drift.

## Architecture

The CSV is replaced by a Wikipedia page as the dataset's source of truth. Everything
downstream of row objects is unchanged: `extract_dataset.js` still fetches articles,
extracts claims via `core/claim.js`, and writes `dataset.json` in the existing
`{metadata, rows}` envelope from `benchmark/io.js`.

Four components are new or changed:

**Suite page (on-wiki).** `User:Alaexis/AI Source Verification/Benchmark` holds one
transclusion per row of a row template at
`User:Alaexis/AI Source Verification/Benchmark/Row`. The template renders each row
into a wikitable, reconstructs a permalink from `article` + `oldid` so the table is
readable, and self-categorizes malformed calls into a tracking category so errors are
visible on-wiki before ingestion runs.

**Suite parser + validator (`benchmark/suite.js`).** Pure functions over wikitext
strings, no network. Parsing uses `wtf_wikipedia` — a `benchmark/`-only dependency,
never `core/`, because everything in `core/` is inlined into `main.js` by
`scripts/sync-main.js` and `main.js` cannot load npm packages. Validation is the
load-bearing half; see Additional Considerations.

**Snapshot + pin layer.** Raw wikitext is fetched once via
`index.php?title=…&oldid=N&action=raw` and stored byte-exact under
`benchmark/suites/<oldid>.wikitext`, alongside parsed rows and fetch metadata in
`benchmark/suites/<oldid>.json`. Extraction reads the snapshot when present, so runs
are offline and deterministic. Storing raw wikitext (rather than rendered HTML) also
sidesteps template drift: an `oldid` does not reproduce historical *rendering*,
because transcluded templates may have changed since, but it does reproduce source
exactly. Named pins live in `benchmark/suite-pins.json`; `--suite-oldid` accepts a
revid or a pin name.

**Write path (userscript).** `buildSubmitToDatasetButton()` (`main.js:4429`) and its
four call sites move from `href`-based `ButtonWidget`s to click handlers that open a
verdict dialog, then append a row via `mw.Api()`.

### Row template contract

| Param | Required | Notes |
| --- | --- | --- |
| `id` | yes | `ctb-` + 6 hex chars; content hash over identity fields |
| `wiki` | yes | `enwiki` today; the reserved multi-wiki hook |
| `article` | yes | Page title, not a URL |
| `oldid` | yes | Article revision (numeric) |
| `citation` | yes | Citation number (numeric) |
| `instance` | yes | Occurrence index (numeric) |
| `truth` | yes | Verdict, canonicalized via `core/verdicts.js` |
| `rationale` | no | Human reasoning for the label |
| `added-by`, `confirmed-by` | no | Usernames; `confirmed-by` is the second-editor signal |
| `claim-text`, `source-url`, `provenance` | no | WMF override trio; both of the first two present skips the article fetch |
| `llm-verdict`, `llm-rationale`, `llm-provider`, `llm-model`, `fetch-status` | no | Machine output; never read as ground truth |

**Value rules (all params):** no `|`, `{`, or `}`; no nested `{{…}}`. Bare `=` is
safe, including inside URLs. These are not stylistic — they are measured
`wtf_wikipedia` failure modes (see Additional Considerations).

Two changes from the CSV schema:

- `Article` splits into `article` + `oldid`. Two labelled fields are more reliably
  hand-edited than an assembled query string, and each half validates independently.
- `Dataset version` is dropped. Cohort membership becomes derivable from the three
  migration revisions. `dataset_version` is still populated in `dataset.json` for
  backwards compatibility, computed by set-membership against the committed migration
  snapshots. Rows added after migration have no cohort.

### Row identity

`id` is a content hash over identity fields only — `wiki`, `oldid`, `citation`,
`instance` — excluding ground truth, rationale, and overrides, so correcting a label
never renumbers a row. The written value is authoritative; ingestion recomputes the
hash and **warns on mismatch without overriding**, so a corrected `oldid` flags
identity drift while keeping the row joinable to historical results. Hash collisions
are a hard validation error.

`benchmark/row-id-aliases.json` maps the 189 legacy `row_<csv_line>` IDs to their
`ctb-` equivalents, generated once at migration. `analyze_results.js`,
`compare_results.js`, and the `--rows` flag join through it, so existing
`results.json` and `historical-runs/` artifacts remain readable without rewriting.

## Existing Patterns

This design follows patterns found in the current codebase:

- **`{metadata, rows}` envelope** — `benchmark/io.js` already provides `loadRows` /
  `loadMetadata` with tests in `tests/benchmark_io.test.js`. `suite_page` and
  `suite_oldid` join `extracted_at` in the metadata block rather than introducing a
  parallel manifest.
- **Wikimedia fetch with identifying User-Agent** — `core/citoid.js` establishes the
  pattern (named UA, `AbortController` timeout, null-on-failure). The suite fetch
  follows it.
- **Verdict canonicalization** — `core/verdicts.js` is the single source of truth for
  verdict strings; the validator calls `canonicalizeVerdict()` rather than
  reimplementing the mapping.
- **Pure `core/`-style modules with `node:test` siblings** — `benchmark/suite.js` is
  pure functions over strings with a sibling test file, matching how `core/claim.js`,
  `core/parsing.js`, and `core/verdicts.js` are structured and tested.
- **Frozen snapshots for reproducibility** — `dataset_v1.json` / `results_v1.json`
  established the "freeze the inputs, re-derive the analysis" convention.
  `benchmark/suites/<oldid>.*` is the same idea applied to the dataset source.

Divergence: `wtf_wikipedia` is the first third-party runtime dependency in the
benchmark pipeline beyond `jsdom`. Justified because the alternative — a hand-written
wikitext parser — owns unicode, entity, and link-flattening edge cases that
`wtf_wikipedia` has already solved, and the validation layer that catches its failure
modes is required regardless of which parser is used.

## Implementation Phases

### Phase 1: Row template and suite page scaffolding

**Goal:** A rendering, documented, empty suite page on-wiki.

**Components:** `User:Alaexis/AI Source Verification/Benchmark/Row` (row template with
permalink rendering and error tracking category); the suite page wrapper table; a page
header carrying the ground-truth principle and value rules; template documentation.

All of these are created in the maintainer's own user space and require no permissions
beyond ordinary editing.

**Dependencies:** None.

**Done when:** The page renders a table from hand-added sample rows; a row with a
missing `oldid` lands in the tracking category.

### Phase 2: Suite parser and validator

**Goal:** Wikitext in, validated row objects out, fully offline.

**Components:** `benchmark/suite.js` — parse (via `wtf_wikipedia`), validate, and
normalize to the row shape `extract_dataset.js` consumes; `tests/suite.test.js` with
regression fixtures for every measured `wtf_wikipedia` edge case (`{{!}}` corruption,
`}`-returns-null, duplicate-param collapse, empty-value dropout, plus the safe cases:
bare `=`, URLs with query strings, non-ASCII, templates inside tables).

**Dependencies:** Phase 1 (template shape settled).

**Done when:** Fixtures pass; a suite with a deliberately malformed row fails
validation naming the row and param rather than silently dropping it.

### Phase 3: Fetch and snapshot layer

**Goal:** Retrieve and freeze a suite revision.

**Components:** Suite fetch in `benchmark/suite.js` (`action=raw&oldid`, identifying
User-Agent per `core/citoid.js`); `benchmark/suites/` snapshot read/write;
`benchmark/suite-pins.json` and pin-name resolution.

**Dependencies:** Phase 2.

**Done when:** A named pin resolves to a revid, fetches once, writes both snapshot
files, and a second run with no network produces identical parsed output.

### Phase 4: Extraction integration

**Goal:** `dataset.json` built from a pinned suite.

**Components:** `--suite-oldid` in `benchmark/extract_dataset.js` replacing `parseCSV`
as the row source; `ctb-` ID generation; `benchmark/row-id-aliases.json` generation;
alias resolution in `--rows`; a parity harness comparing wiki-derived against
CSV-derived output.

**Dependencies:** Phase 3.

**Done when:** Parity is clean across all 189 rows on identity, ground-truth, and
claim fields; tests cover ID stability under mid-table insertion.

### Phase 5: Migration

**Goal:** The 189 existing rows live on-wiki, with cohort revids recorded.

**Components:** Three sequential page edits (v1's 76 rows, v2's 34, v3's 79); three
pins in `suite-pins.json`; three snapshots; generated alias map.

**Dependencies:** Phase 4.

**Done when:** `--suite-oldid v1` reproduces today's `--version v1` row set, `v1+v2`
reproduces `v1,v2`, and the full pin reproduces all 189.

### Phase 6: vN retirement

**Goal:** Revision pins replace cohort tags.

**Components:** Remove `--version` from `benchmark/extract_dataset.js`,
`benchmark/run_benchmark.js`, and `benchmark/analyze_results.js` (each implements it
independently); delete `extract:v1`, `extract:v3`, `benchmark:v1`, `benchmark:v3`,
`analyze:v1`, `analyze:v3` from `benchmark/package.json`; regenerate the CSV from the
pinned suite for one deprecation release.

**Dependencies:** Phase 5.

**Done when:** No `--version` code path remains; `analyze:v1-snapshot` and
`analyze:v3-snapshot` still pass untouched (they read frozen files directly and never
consult the version filter).

### Phase 7: Userscript write path

**Goal:** One-click row contribution from the tool.

**Components:** Verdict-collection dialog (verdict selector defaulting to unset,
optional rationale, wikitext preview); `mw.Api().postWithEditToken` append; conversion
of the four `buildSubmitToDatasetButton()` call sites (`main.js:3627`, `:3706`,
`:3747`, `:4395`) from `href` to click handlers; row-value normalization before write;
logged-out and edit-failure states; `npm run build` re-sync.

**Dependencies:** Phase 5 (a live suite page to write to). Gated on maintainer
sign-off — it changes `main.js`'s rendered surface.

**Done when:** A logged-in editor adds a row that passes validation on the next
extraction; logged-out users see an explanatory state rather than a failed save.

## Additional Considerations

**Validation is the load-bearing component.** Measured `wtf_wikipedia` 10.4.2
behavior on the row template shape:

| Input | Behavior |
| --- | --- |
| bare `=`, URLs with `?a=1&b=2#frag`, non-ASCII, quotes | intact |
| `[[link]]`, `[[a\|b]]`, `[url label]` | flattened to text (lossy, acceptable) |
| bare `\|` in a value | truncates value, invents a spurious `list` param |
| `{{!}}`, `<nowiki>\|</nowiki>` | same corruption — the standard escapes do not work |
| `&#124;` | survives encoded |
| empty value | param silently vanishes; indistinguishable from missing |
| duplicate param | last wins, silently |
| `{` or `}` in a value | **entire template returns `null` — the row disappears** |
| `{{CURRENTYEAR}}` in a value | expands at parse time; breaks reproducibility |

The last row is why validation must fail loudly: a malformed row does not error, it
vanishes, silently changing the denominator of every accuracy metric. Ingestion
therefore reconciles the count of raw `{{…/Row` occurrences against parsed rows and
hard-fails on mismatch, detects duplicate params from raw text (the parser hides
them), and rejects empty required params. This is an input-integrity check, distinct
from the project convention that *analytical* tools always exit 0 — that convention
exists to prevent rubber-stamping of results, whereas silent row loss corrupts the
inputs.

**Alternative considered: a plain wikitable instead of a row template.** Measured,
`wtf_wikipedia` parses wikitables well — header names become object keys, numerics are
auto-typed, and row counts reconcile against `|-` markers in both cell syntaxes. On two
points it is *better* than templates: an empty cell yields `text: ""` (distinguishable
from an absent one, which templates cannot express), and no equivalent to the
template-returns-`null` vanishing-row failure was observed.

Rejected on data shape, not parsing. The row carries 7 required fields plus 11 optional
ones, giving an 18-column table that would be mostly empty, including two long-prose
columns (`claim-text`, `llm-rationale`) that make rows unreadable. Sparse optional
fields and long prose are what templates handle well and tables handle badly. Note the
decision would flip if the schema were cut to roughly 8 columns — which would mean
dropping the `llm-*` fields.

Templates require no special permissions: the row template lives in the maintainer's
own user space, and template creation on en.wikipedia is available to any autoconfirmed
user regardless.

**Parity excludes `source_text`.** Live sources drift, so re-fetching produces
different bytes for reasons unrelated to this migration. Comparing `source_text` would
fail for the wrong reason and mask real errors.

**Accepted trade: anchoring pressure.** `rationale` is optional while `llm-rationale`
is stored on the row, so the most visible reasoning on a typical row will be the
model's. Mitigations are presentational (the template renders `llm-*` fields
de-emphasized and grouped apart from `truth`) and documentary; the parser never reads
`llm-*` as ground truth. This is a known cost of prioritizing low-friction
contribution.

**Bad labels are bounded by the pin, not by review.** Rows count toward metrics
immediately, so the safeguard against a wrong label is that published numbers cannot
move retroactively: advancing a pin is a deliberate act with a reviewable diff.

**Reserved, not built:** `wiki=` is required on every row so a second suite page can
be added when the tool's French Wikipedia support needs benchmarking, without a schema
migration. Per-wiki pinning (a set of `(wiki, oldid)` pairs rather than one revid) is
out of scope.
