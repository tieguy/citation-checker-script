# Wiki-Hosted Benchmark Suite Implementation Plan — Phase 1

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Author the row template, the suite page header, and the template
documentation as version-controlled wikitext in the repo, then have the maintainer
publish them to en.wikipedia so a rendering, documented, empty suite page exists.

**Architecture:** The wikitext is a *repo artifact first*. `benchmark/wiki/` holds the
canonical source of every on-wiki page this project owns; publishing is a copy-paste of
those files. That keeps the template reviewable in PRs and diffable over time, instead
of living only on-wiki where it can drift silently.

**Tech Stack:** MediaWiki wikitext, ParserFunctions (`#if`, `#switch`), `urlencode`.
No JavaScript in this phase.

**Scope:** Phase 1 of 7.

**Codebase verified:** 2026-07-23

---

## Human-gated phase

Tasks 1–3 are `[AGENT]` — ordinary file authoring and commits.
Tasks 4–6 are `[HUMAN]` — they save edits to en.wikipedia and require the maintainer's
account. An agent executing this plan must **stop at Task 4** and hand off, then resume
once the maintainer confirms the page titles and reports back the created page's URL.

---

### Task 1: Create the row template wikitext `[AGENT]`

**Files:**
- Create: `benchmark/wiki/Row.wikitext`

**Step 1: Create the directory and file**

Create `benchmark/wiki/Row.wikitext` with exactly this content:

```
<noinclude>
{{Documentation|User:Alaexis/AI Source Verification/Benchmark/Row/doc}}
</noinclude><includeonly>|-
| id="{{{id|}}}" | <code>{{{id|}}}</code>
| {{#if:{{{article|}}}{{{oldid|}}}|[https://{{#switch:{{{wiki|}}}|enwiki=en|frwiki=fr|#default=en}}.wikipedia.org/w/index.php?title={{urlencode:{{{article|}}}|WIKI}}&oldid={{{oldid|}}} {{{article|}}}]&nbsp;<small>(rev&nbsp;{{{oldid|}}})</small>|<span class="error">missing article/oldid</span>}}
| style="text-align:center" | {{{citation|}}}{{#if:{{{instance|}}}|&nbsp;#{{{instance|}}}}}
| style="font-weight:bold" | {{{truth|<span class="error">missing truth</span>}}}
| {{{rationale|}}}
| <small>{{#if:{{{added-by|}}}|added by [[User:{{{added-by}}}|{{{added-by}}}]]}}{{#if:{{{confirmed-by|}}}|<br />confirmed by [[User:{{{confirmed-by}}}|{{{confirmed-by}}}]]|<br />''unconfirmed''}}</small>
| {{#if:{{{claim-text|}}}{{{source-url|}}}|<small>{{{claim-text|}}}{{#if:{{{source-url|}}}|<br />{{{source-url}}}}}{{#if:{{{provenance|}}}|<br />''{{{provenance}}}''}}</small>}}
| style="color:#666; font-size:85%" | {{#if:{{{llm-verdict|}}}|{{{llm-verdict}}}{{#if:{{{llm-model|}}}|&nbsp;<code>{{{llm-model}}}</code>}}{{#if:{{{llm-rationale|}}}|<br />{{{llm-rationale}}}}}{{#if:{{{fetch-status|}}}|<br />fetch: {{{fetch-status}}}}}}}
{{#if:{{{id|}}}{{{wiki|}}}{{{article|}}}{{{oldid|}}}{{{citation|}}}{{{instance|}}}{{{truth|}}}||[[Category:AI Source Verification benchmark rows with errors]]}}{{#if:{{{id|}}}||[[Category:AI Source Verification benchmark rows with errors]]}}{{#if:{{{wiki|}}}||[[Category:AI Source Verification benchmark rows with errors]]}}{{#if:{{{article|}}}||[[Category:AI Source Verification benchmark rows with errors]]}}{{#if:{{{oldid|}}}||[[Category:AI Source Verification benchmark rows with errors]]}}{{#if:{{{citation|}}}||[[Category:AI Source Verification benchmark rows with errors]]}}{{#if:{{{instance|}}}||[[Category:AI Source Verification benchmark rows with errors]]}}{{#if:{{{truth|}}}||[[Category:AI Source Verification benchmark rows with errors]]}}</includeonly>
```

Notes for the implementer — do not change these without re-reading Phase 2:

- The `<includeonly>` block **starts with `|-`** so each transclusion becomes one
  wikitable row. The suite page supplies the opening `{|` and closing `|}`.
- The `llm-*` fields are rendered last, small, and grey. This is the design's stated
  mitigation for anchoring pressure — the human `truth` is bold and early, the model's
  output is de-emphasized and grouped apart. Do not reorder.
- Each required param gets its **own** `#if` category call rather than one combined
  check, so a page missing any single required param still lands in the tracking
  category. (The first combined `#if` is redundant but harmless; leave it — it makes
  the "all params missing" case explicit.)
- `{{urlencode:...|WIKI}}` produces underscore-for-space encoding, which is what
  `index.php?title=` expects.

**Step 2: Verify the file is well-formed**

There is no local wikitext linter. Verify structurally:

Run: `grep -o 'Category:AI Source Verification benchmark rows with errors' benchmark/wiki/Row.wikitext | wc -l`
Expected: `8`

(`grep -c` counts matching *lines*, not matches — all 8 category calls are on one line,
so it would report `1`.)

Run: `node -e "const t=require('fs').readFileSync('benchmark/wiki/Row.wikitext','utf8'); const o=(t.match(/\{\{/g)||[]).length, c=(t.match(/\}\}/g)||[]).length; console.log('open',o,'close',c); if(o!==c) process.exit(1)"`
Expected: `open` and `close` counts are equal, exit 0.

**Step 3: Commit**

```bash
git add benchmark/wiki/Row.wikitext
git commit -m "benchmark: add row template wikitext for wiki-hosted suite"
```

---

### Task 2: Create the suite page header and wrapper wikitext `[AGENT]`

**Files:**
- Create: `benchmark/wiki/Benchmark.wikitext`

**Step 1: Create the file**

Create `benchmark/wiki/Benchmark.wikitext` with exactly this content:

```
{{DISPLAYTITLE:AI Source Verification benchmark suite}}
== About this page ==

This page is the ground-truth dataset for the [[User:Alaexis/AI Source Verification|AI Source Verification]] tool. Each row records one citation, the claim it supports, and a '''human''' judgement of whether the source actually supports that claim. Benchmark accuracy numbers are computed against these labels.

'''You are invited to edit this page.''' It lives in user space, but it is a shared resource — adding a row or confirming someone else's label is welcome and does not need permission.

=== How to label a row ===

Label what '''an editor following the citation to the live source would find'''. Do not label based on what an automated scraper captured. The two differ often: a scraper may miss tables, byline dates, late-loading content, or paywalled material that a human reader can see. If the live source supports the claim, the row is <code>Supported</code> even when our tooling failed to retrieve the text.

Use one of exactly four values in <code>truth</code>:

* <code>Supported</code> — the source states the claim.
* <code>Partially supported</code> — the source supports part of the claim but not all of it.
* <code>Not supported</code> — the source does not support the claim, or contradicts it.
* <code>Source unavailable</code> — the source cannot be consulted at all (dead link with no archive, unobtainable offline work).

Please fill in <code>rationale</code> with a sentence explaining the call. A second editor is asked to check the row and add their username to <code>confirmed-by</code>; a confirmed row carries more weight in disputes.

=== Formatting rules (important) ===

The ingestion tooling parses this page's wikitext. Some characters silently corrupt or '''delete''' a row rather than producing a visible error, so these rules are enforced by a validator that refuses to run on a malformed page:

* Never use <code>|</code>, <code>{</code>, or <code>}</code> inside a parameter value. Not even escaped — <code><nowiki>{{!}}</nowiki></code> and <code><nowiki><nowiki>|</nowiki></nowiki></code> do '''not''' work here. Write <code>&amp;#124;</code> if you truly need a pipe character.
* Never nest a template (<code><nowiki>{{...}}</nowiki></code>) inside a parameter value.
* Leave a parameter out entirely rather than giving it an empty value.
* Never repeat the same parameter twice in one row.
* <code>=</code> is safe, including inside URLs.

A row that breaks these rules will appear in [[:Category:AI Source Verification benchmark rows with errors]].

=== Machine output is not ground truth ===

The <code>llm-*</code> parameters record what a model said. They are stored for comparison only and are '''never''' read as ground truth. Do not let them influence your <code>truth</code> value — judge the source yourself.

== Rows ==

{| class="wikitable sortable"
! ID !! Article !! Citation !! Ground truth !! Rationale !! Attribution !! Source override !! Model output (not ground truth)
|}

[[Category:AI Source Verification]]
```

Note: the wikitable is intentionally left with no rows. Phase 5 inserts row
transclusions between the header line and the closing `|}`.

**Step 2: Verify**

Run: `grep -c '^{| class="wikitable sortable"' benchmark/wiki/Benchmark.wikitext`
Expected: `1`

Run: `grep -c '^|}' benchmark/wiki/Benchmark.wikitext`
Expected: `1`

**Step 3: Commit**

```bash
git add benchmark/wiki/Benchmark.wikitext
git commit -m "benchmark: add suite page header and empty table wrapper"
```

---

### Task 3: Create the template documentation `[AGENT]`

**Files:**
- Create: `benchmark/wiki/Row.doc.wikitext`
- Create: `benchmark/wiki/README.md`

**Step 1: Create `benchmark/wiki/Row.doc.wikitext`**

```
== Usage ==

One transclusion per benchmark row, inside the wikitable on [[User:Alaexis/AI Source Verification/Benchmark]].

<pre>
{{User:Alaexis/AI Source Verification/Benchmark/Row
| id        = ctb-a1b2c3
| wiki      = enwiki
| article   = Immigration to the United States
| oldid     = 1331476438
| citation  = 1
| instance  = 1
| truth     = Supported
| rationale = The cited report gives this figure on page 4.
| added-by  = Example
}}
</pre>

== Parameters ==

{| class="wikitable"
! Parameter !! Required !! Meaning
|-
| <code>id</code> || yes || Stable row identifier, <code>ctb-</code> followed by 6 hex characters. Generated by the tooling; do not invent one by hand — leave it out and a maintainer will fill it in.
|-
| <code>wiki</code> || yes || Wiki database name. <code>enwiki</code> today.
|-
| <code>article</code> || yes || Article title, '''not''' a URL. Example: <code>Immigration to the United States</code>
|-
| <code>oldid</code> || yes || Revision ID of the article the citation was read at. Numeric.
|-
| <code>citation</code> || yes || Citation number as shown in the article. Numeric.
|-
| <code>instance</code> || yes || Which occurrence of that citation, counting from 1.
|-
| <code>truth</code> || yes || One of <code>Supported</code>, <code>Partially supported</code>, <code>Not supported</code>, <code>Source unavailable</code>.
|-
| <code>rationale</code> || no || Why you chose that label. Strongly encouraged.
|-
| <code>added-by</code> || no || Username of the editor who added the row.
|-
| <code>confirmed-by</code> || no || Username of a second editor who checked it.
|-
| <code>claim-text</code> || no || Override: the claim text, when it cannot be extracted from the article.
|-
| <code>source-url</code> || no || Override: the source URL. When both this and <code>claim-text</code> are present, the tooling skips fetching the article.
|-
| <code>provenance</code> || no || Where an overridden row came from.
|-
| <code>llm-verdict</code>, <code>llm-rationale</code>, <code>llm-provider</code>, <code>llm-model</code>, <code>fetch-status</code> || no || Recorded model output. Never treated as ground truth.
|}

== Value rules ==

Parameter values must not contain <code>|</code>, <code>{</code>, or <code>}</code>, and must not nest templates. Use <code>&amp;#124;</code> for a literal pipe. An empty value is treated as a missing parameter — omit it instead. See the [[User:Alaexis/AI Source Verification/Benchmark|suite page]] header for the full explanation.

== Errors ==

Rows missing a required parameter are collected in [[:Category:AI Source Verification benchmark rows with errors]].
```

**Step 2: Create `benchmark/wiki/README.md`**

```markdown
# On-wiki page sources

Canonical source for the Wikipedia pages this project owns. These files are the
authority; the on-wiki pages are published copies. Edit here, then publish.

| File | On-wiki title |
| --- | --- |
| `Row.wikitext` | `User:Alaexis/AI Source Verification/Benchmark/Row` |
| `Row.doc.wikitext` | `User:Alaexis/AI Source Verification/Benchmark/Row/doc` |
| `Benchmark.wikitext` | `User:Alaexis/AI Source Verification/Benchmark` |

Publishing is manual: open the page, paste the file contents, save. There is no
sync script — these change rarely, and an automated writer would need credentials
the repo deliberately does not hold.

The suite page's row content is **not** mirrored here. `Benchmark.wikitext` holds
only the header and the empty table wrapper; the rows live on-wiki and are pulled
back into the repo as frozen snapshots under `benchmark/suites/` (see
`benchmark/suite.js`).
```

**Step 3: Commit**

```bash
git add benchmark/wiki/Row.doc.wikitext benchmark/wiki/README.md
git commit -m "benchmark: document the wiki row template and page sources"
```

---

### Task 4: Publish the row template `[HUMAN]`

**Performed by the maintainer on en.wikipedia. An agent must stop here.**

**Step 1:** Open `https://en.wikipedia.org/w/index.php?title=User:Alaexis/AI_Source_Verification/Benchmark/Row&action=edit`

**Step 2:** Paste the entire contents of `benchmark/wiki/Row.wikitext`.

**Step 3:** Save with summary: `Row template for the AI Source Verification benchmark suite`

**Step 4:** Open `https://en.wikipedia.org/w/index.php?title=User:Alaexis/AI_Source_Verification/Benchmark/Row/doc&action=edit`, paste `benchmark/wiki/Row.doc.wikitext`, save.

**Verification:** The `/doc` subpage renders the parameter table. The template page
itself renders the documentation box.

---

### Task 5: Publish the suite page and test rendering `[HUMAN]`

**Step 1:** Open `https://en.wikipedia.org/w/index.php?title=User:Alaexis/AI_Source_Verification/Benchmark&action=edit`

**Step 2:** Paste the contents of `benchmark/wiki/Benchmark.wikitext`.

**Step 3:** Before saving, insert these two sample rows between the `! ID !! ...`
header line and the closing `|}`:

```
{{User:Alaexis/AI Source Verification/Benchmark/Row
| id        = ctb-000001
| wiki      = enwiki
| article   = Immigration to the United States
| oldid     = 1331476438
| citation  = 1
| instance  = 1
| truth     = Supported
| rationale = Sample row for template testing. Delete before migration.
| added-by  = Alaexis
}}
{{User:Alaexis/AI Source Verification/Benchmark/Row
| id        = ctb-000002
| wiki      = enwiki
| article   = Immigration to the United States
| citation  = 2
| instance  = 1
| truth     = Not supported
| rationale = Sample row deliberately missing oldid, to test error tracking. Delete before migration.
}}
```

**Step 4:** Use "Show preview" and confirm:
- The table renders two rows.
- Row 1's Article cell is a working permalink to revision 1331476438.
- Row 2's Article cell shows the red `missing article/oldid` error text.

**Step 5:** Save with summary: `Create benchmark suite page with sample rows`

**Verification (the phase's "done when"):**
- Visit `https://en.wikipedia.org/wiki/Category:AI_Source_Verification_benchmark_rows_with_errors`
- The suite page is listed there, because row 2 is missing `oldid`.

If the category page is empty, the tracking category is not working — the
`#if` calls in `Row.wikitext` are inside `<includeonly>` and must not have been
wrapped in `<noinclude>`. Fix `benchmark/wiki/Row.wikitext` in the repo first, then
re-publish.

---

### Task 6: Record the published page titles `[HUMAN]` + `[AGENT]`

**Files:**
- Modify: `benchmark/wiki/README.md`

**Step 1:** The maintainer reports the exact final page titles (they may differ from
the plan if a title was already taken).

**Step 2:** If any title differs from the table in `benchmark/wiki/README.md`, update
that table, and update the corresponding title strings in `benchmark/wiki/Row.doc.wikitext`
and `benchmark/wiki/Benchmark.wikitext`.

**Step 3:** Commit

```bash
git add benchmark/wiki/README.md
git commit -m "benchmark: record published wiki page titles"
```

**Do not delete the sample rows yet** — Phase 3 uses this revision as a live fetch
target, and Phase 5 Task 1 removes them as its first step.

---

## Phase 1 done when

- [ ] `benchmark/wiki/` contains `Row.wikitext`, `Row.doc.wikitext`, `Benchmark.wikitext`, `README.md`, all committed.
- [ ] All three pages exist on en.wikipedia.
- [ ] The suite page renders a two-row table with a working permalink in row 1.
- [ ] The suite page appears in `Category:AI Source Verification benchmark rows with errors` because row 2 lacks `oldid`.
