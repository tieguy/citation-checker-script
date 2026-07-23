# Wiki-Hosted Benchmark Suite Implementation Plan — Phase 7

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** The shipped "Give feedback" button writes a benchmark row to the suite page via
the MediaWiki API under the contributor's own session, after collecting the one thing the
current UI never captures — a *human* verdict.

**Architecture:** All wikitext construction and value escaping lives in `core/submission.js`
as pure functions with `node:test` coverage; `main.js` holds only the OOUI dialog and the
`mw.Api()` call, which cannot be unit-tested in this repo. The Google Form path stays in
place as a fallback and is not removed here.

**Tech Stack:** OOUI (lazy-loaded via `mw.loader.using()`), `mw.Api().postWithEditToken`,
`core/submission.js` inlined into `main.js` by `scripts/sync-main.js`.

**Scope:** Phase 7 of 7. Depends on Phase 5 (a live suite page to write to).

**Codebase verified:** 2026-07-23

---

## Gate: maintainer sign-off required before starting

This phase changes `main.js`'s rendered surface — it adds a dialog and changes what four
existing buttons do. Repo convention requires alignment with the primary maintainer
(@alex-o-748) **before** implementation, not at review time.

**Do not begin Task 1 until sign-off is recorded.** The specific decisions needing
agreement:

1. The button gains a dialog instead of opening a new tab. Its label ("Give feedback")
   may no longer be right — the action is now "contribute a benchmark row".
2. Logged-out users get an explanatory state rather than a working button.
3. The edit is attributed to the contributor's own account and appears in their
   contributions and watchlist.
4. Whether the wikitext report link at `main.js:3859` should also be repointed
   (see Task 5) or left on the Form.

---

### Task 1: Pure wikitext construction in `core/submission.js`

**Files:**
- Modify: `core/submission.js`
- Modify: `tests/submission.test.js`

**Step 1: Write the failing test**

Append to `tests/submission.test.js`:

```javascript
import {
    SUITE_PAGE_TITLE, escapeSuiteParamValue, buildSuiteRowWikitext, buildSuiteEditSummary,
} from '../core/submission.js';

const submission = (over = {}) => ({
    wiki: 'enwiki',
    article: 'Immigration to the United States',
    oldid: 1331476438,
    citation: 3,
    instance: 1,
    truth: 'Partially supported',
    rationale: 'The source supports the figure but not the date.',
    addedBy: 'ExampleUser',
    ...over,
});

test('escapeSuiteParamValue encodes a pipe, the only escape that survives', () => {
    assert.equal(escapeSuiteParamValue('a | b'), 'a &#124; b');
});

test('escapeSuiteParamValue strips braces, which would delete the row', () => {
    assert.equal(escapeSuiteParamValue('a {b} c'), 'a b c');
});

test('escapeSuiteParamValue collapses newlines into spaces', () => {
    assert.equal(escapeSuiteParamValue('one\ntwo'), 'one two');
});

test('buildSuiteRowWikitext emits every required parameter', () => {
    const text = buildSuiteRowWikitext(submission());
    for (const param of ['wiki', 'article', 'oldid', 'citation', 'instance', 'truth']) {
        assert.match(text, new RegExp(`\\|\\s*${param}\\s*=`), `missing ${param}`);
    }
    assert.match(text, /^\{\{User:Alaexis\/AI Source Verification\/Benchmark\/Row\n/);
    assert.match(text, /\n\}\}$/);
});

test('buildSuiteRowWikitext omits an id so a maintainer assigns the content hash', () => {
    // The id is a hash over identity fields; letting the browser guess one risks
    // a mismatch that would read as identity drift on ingestion.
    assert.doesNotMatch(buildSuiteRowWikitext(submission()), /\|\s*id\s*=/);
});

test('buildSuiteRowWikitext omits blank optional parameters entirely', () => {
    const text = buildSuiteRowWikitext(submission({ rationale: '', addedBy: '' }));
    assert.doesNotMatch(text, /rationale/);
    assert.doesNotMatch(text, /added-by/);
});

test('buildSuiteRowWikitext canonicalizes the human verdict', () => {
    assert.match(buildSuiteRowWikitext(submission({ truth: 'not supported' })),
        /\|\s*truth\s*=\s*Not supported/);
});

test('buildSuiteRowWikitext throws on an unrecognized verdict', () => {
    assert.throws(() => buildSuiteRowWikitext(submission({ truth: 'maybe' })), /verdict/i);
});

test('buildSuiteRowWikitext records model output under llm- parameters only', () => {
    const text = buildSuiteRowWikitext(submission({
        llmVerdict: 'Supported', llmRationale: 'The model said so',
        llmProvider: 'publicai', llmModel: 'qwen', fetchStatus: 'ok',
    }));
    assert.match(text, /\|\s*llm-verdict\s*=\s*Supported/);
    assert.match(text, /\|\s*llm-model\s*=\s*qwen/);
    // The human verdict must remain the only `truth`.
    assert.match(text, /\|\s*truth\s*=\s*Partially supported/);
});

test('buildSuiteRowWikitext survives a round trip through the suite parser', async () => {
    // No id is emitted, and since Phase 4 parseSuite computes one rather than
    // rejecting the row — which is exactly the path a contributed row takes.
    const { parseSuite } = await import('../benchmark/suite.js');
    const text = buildSuiteRowWikitext(submission({
        rationale: 'Contains a | pipe and {braces} and a URL https://e.com/p?a=1&b=2',
    }));
    const { rows, warnings } = parseSuite(text);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].truth, 'Partially supported');
    assert.equal(rows[0].citation, 3);
    assert.match(rows[0].id, /^ctb-[0-9a-f]{6}$/);
    assert.equal(warnings[0].code, 'ID_COMPUTED');
});

test('buildSuiteEditSummary names the article and citation', () => {
    const summary = buildSuiteEditSummary(submission());
    assert.match(summary, /Immigration to the United States/);
    assert.match(summary, /3/);
});
```

**Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern='buildSuiteRowWikitext' 'tests/**/*.test.js'`
Expected: FAIL — `buildSuiteRowWikitext` is not exported.

**Step 3: Write the implementation**

Append to `core/submission.js`:

```javascript
// --- On-wiki benchmark suite submission -------------------------------------
//
// Writes a row directly to the suite page instead of opening a Google Form. The
// Form path above stays in place as a fallback during migration.
//
// Everything here is pure so it can be unit-tested; the mw.Api() call and the
// dialog live in main.js, which has no test harness.

export const SUITE_PAGE_TITLE = 'User:Alaexis/AI Source Verification/Benchmark';
export const SUITE_ROW_TEMPLATE = 'User:Alaexis/AI Source Verification/Benchmark/Row';

/**
 * Make a value safe for a template parameter.
 *
 * Measured against the parser used on ingestion: an unbalanced brace deletes the
 * entire row, a bare pipe truncates the value, and neither {{!}} nor <nowiki>
 * escapes a pipe — only the numeric entity does. Braces are stripped rather than
 * encoded because no encoding of them is safe enough to be worth the risk.
 */
export function escapeSuiteParamValue(value) {
    return String(value ?? '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[{}]/g, '')
        .replace(/\|/g, '&#124;')
        .replace(/\s+/g, ' ')
        .trim();
}

const SUITE_PARAM_ORDER = [
    'wiki', 'article', 'oldid', 'citation', 'instance',
    'truth', 'rationale', 'added-by',
    'llm-verdict', 'llm-rationale', 'llm-provider', 'llm-model', 'fetch-status',
];

/**
 * Render a contributed row.
 *
 * Deliberately emits no `id`: it is a hash over identity fields, and a value
 * guessed in the browser that disagreed with the computed hash would surface on
 * ingestion as identity drift. A maintainer assigns it.
 */
export function buildSuiteRowWikitext(submission) {
    const truth = canonicalizeVerdict(submission.truth);
    if (truth === null) {
        throw new Error(`cannot submit: "${submission.truth}" is not a recognized verdict`);
    }

    const llmVerdict = submission.llmVerdict
        ? canonicalizeVerdict(submission.llmVerdict)
        : null;

    const values = {
        wiki: submission.wiki || 'enwiki',
        article: submission.article,
        oldid: submission.oldid,
        citation: submission.citation,
        instance: submission.instance ?? 1,
        truth: toTitleCase(truth),
        rationale: submission.rationale,
        'added-by': submission.addedBy,
        'llm-verdict': llmVerdict === null ? '' : toTitleCase(llmVerdict),
        'llm-rationale': submission.llmRationale,
        'llm-provider': submission.llmProvider,
        'llm-model': submission.llmModel,
        'fetch-status': submission.fetchStatus,
    };

    const lines = SUITE_PARAM_ORDER
        .map(name => [name, escapeSuiteParamValue(values[name])])
        // An empty value is indistinguishable from an absent one to the parser,
        // and the validator rejects it outright.
        .filter(([, value]) => value !== '')
        .map(([name, value]) => `| ${name.padEnd(13)} = ${value}`);

    return `{{${SUITE_ROW_TEMPLATE}\n${lines.join('\n')}\n}}`;
}

export function buildSuiteEditSummary(submission) {
    return `Add benchmark row: ${submission.article} citation ${submission.citation} `
        + `(via AI Source Verification)`;
}

/**
 * The row must land INSIDE the wikitable, not after its closing `|}`. appendtext
 * cannot express that, so the caller reads the page, splices, and writes back.
 */
export function spliceRowIntoPage(pageWikitext, rowWikitext) {
    const closeIndex = pageWikitext.lastIndexOf('\n|}');
    if (closeIndex === -1) {
        throw new Error('suite page does not end its table with "|}" — refusing to guess');
    }
    return pageWikitext.slice(0, closeIndex) + '\n' + rowWikitext + pageWikitext.slice(closeIndex);
}
```

Add `canonicalizeVerdict` and `toTitleCase` to `core/submission.js`'s imports from
`./verdicts.js`. **Check the sync order first:** `scripts/sync-main.js` inlines
`verdicts.js` at position 2 and `submission.js` at position 9, so the dependency
direction is already correct and no sync-order change is needed.

**Step 4: Add a splice test**

Append to `tests/submission.test.js`:

```javascript
import { spliceRowIntoPage } from '../core/submission.js';

test('spliceRowIntoPage inserts inside the table, not after it', () => {
    const page = '== Rows ==\n\n{| class="wikitable"\n! ID\n{{Existing}}\n|}\n\n[[Category:X]]';
    const out = spliceRowIntoPage(page, '{{New}}');
    assert.match(out, /\{\{Existing\}\}\n\{\{New\}\}\n\|\}/);
    assert.match(out, /\[\[Category:X\]\]$/);
});

test('spliceRowIntoPage refuses a page with no table close', () => {
    assert.throws(() => spliceRowIntoPage('no table here', '{{New}}'), /refusing to guess/);
});
```

**Step 5: Run to verify it passes**

Run: `node --test --test-name-pattern='Suite|splice' 'tests/**/*.test.js'`
Expected: PASS, 13 tests.

**Step 6: Commit**

```bash
git add core/submission.js tests/submission.test.js
git commit -m "core: build suite row wikitext for on-wiki benchmark submission"
```

---

### Task 2: Re-sync `main.js` and confirm it stays byte-consistent

**Files:**
- Modify: `main.js` (generated region only)

**Step 1: Confirm main.js is currently in sync**

Run: `npm run build -- --check`
Expected: exit 0.

If it exits 1, `main.js` was already stale before this phase. Stop and report rather
than silently absorbing an unrelated drift into this change.

**Step 2: Re-sync**

Run: `npm run build`
Expected: rewrites only the region between `// <core-injected>` and `// </core-injected>`.

**Step 3: Verify only the injected region changed**

Run: `git diff --stat main.js`

Run:
```bash
git diff main.js | grep -E '^[-+]' | grep -vE '^(\+\+\+|---)' | head -50
```
Expected: every changed line is one of the new `core/submission.js` additions. Any change
outside the markers means the sync script touched hand-maintained code — stop.

**Step 4: Verify the checker now passes**

Run: `npm run build -- --check`
Expected: exit 0.

Run: `npm test`
Expected: green.

**Step 5: Commit**

```bash
git add main.js
git commit -m "build: sync suite submission helpers into main.js"
```

---

### Task 3: The verdict-collection dialog

**Files:**
- Modify: `main.js`

**Step 1: Add the dialog method**

Add a new method to the `WikipediaSourceVerifier` class, immediately before
`buildSubmitToDatasetButton` (currently line 4429):

```javascript
        /**
         * Collect the human verdict before writing a benchmark row.
         *
         * The tool only ever captured the MODEL's verdict; a benchmark row needs a
         * human one. The model's output is shown de-emphasized and below, and is
         * recorded under llm-* parameters that ingestion never reads as ground
         * truth — but a contributor who simply agrees should have to say so
         * explicitly, so the verdict selector starts unset.
         */
        async promptForSuiteSubmission(result) {
            await mw.loader.using(['oojs-ui-core', 'oojs-ui-windows', 'mediawiki.api']);

            const verdictInput = new OO.ui.RadioSelectWidget({
                items: [
                    new OO.ui.RadioOptionWidget({ data: 'Supported', label: 'Supported' }),
                    new OO.ui.RadioOptionWidget({ data: 'Partially supported', label: 'Partially supported' }),
                    new OO.ui.RadioOptionWidget({ data: 'Not supported', label: 'Not supported' }),
                    new OO.ui.RadioOptionWidget({ data: 'Source unavailable', label: 'Source unavailable' }),
                ],
            });

            const rationaleInput = new OO.ui.MultilineTextInputWidget({
                rows: 3,
                placeholder: 'Why? One sentence is plenty.',
            });

            const fieldset = new OO.ui.FieldsetLayout({
                label: 'Add this citation to the benchmark dataset',
            });
            fieldset.addItems([
                new OO.ui.FieldLayout(verdictInput, {
                    label: 'Your verdict (judge the source yourself)',
                    align: 'top',
                }),
                new OO.ui.FieldLayout(rationaleInput, { label: 'Rationale', align: 'top' }),
            ]);

            const modelNote = new OO.ui.MessageWidget({
                type: 'notice',
                inline: true,
                label: `For reference, the model said: ${result?.verdict ?? 'nothing'}. `
                    + 'Your verdict is what gets recorded as ground truth.',
            });

            const confirmed = await OO.ui.confirm(
                $('<div>').append(fieldset.$element, modelNote.$element),
                { title: 'Contribute a benchmark row', actions: [
                    { action: 'accept', label: 'Publish to the benchmark page', flags: ['primary', 'progressive'] },
                    { action: 'reject', label: 'Cancel', flags: 'safe' },
                ] },
            );

            if (!confirmed) return null;

            const verdict = verdictInput.findSelectedItem()?.getData();
            if (!verdict) {
                await OO.ui.alert('Please choose a verdict before publishing.');
                return this.promptForSuiteSubmission(result);
            }

            return { truth: verdict, rationale: rationaleInput.getValue() };
        }
```

**Step 2: Verify the script still parses**

Run: `node --check main.js`
Expected: exit 0, no output.

**Step 3: Commit**

```bash
git add main.js
git commit -m "feat: add verdict-collection dialog for benchmark row submission"
```

---

### Task 4: The write path

**Files:**
- Modify: `main.js`

**Step 1: Add the submit method**

Add immediately after `promptForSuiteSubmission`:

```javascript
        /**
         * Write a benchmark row to the suite page under the contributor's own
         * session. No OAuth: mw.Api() uses the logged-in user's cookies, and the
         * edit is attributed to them.
         *
         * appendtext would put the row AFTER the table's closing `|}`, so the
         * page is read, spliced and written back. assert:'user' makes an expired
         * session fail loudly instead of silently editing as an IP.
         */
        async submitRowToSuite(result) {
            if (!mw.config.get('wgUserName')) {
                await OO.ui.alert(
                    'You need to be logged in to add a benchmark row, because the edit is '
                    + 'made under your own account.',
                    { title: 'Log in to contribute' },
                );
                return;
            }

            const collected = await this.promptForSuiteSubmission(result);
            if (!collected) return;

            const api = new mw.Api();

            try {
                const row = buildSuiteRowWikitext({
                    wiki: mw.config.get('wgDBname'),
                    article: mw.config.get('wgPageName').replace(/_/g, ' '),
                    oldid: mw.config.get('wgCurRevisionId'),
                    citation: result?.citationNumber,
                    instance: result?.occurrence ?? 1,
                    truth: collected.truth,
                    rationale: collected.rationale,
                    addedBy: mw.config.get('wgUserName'),
                    llmVerdict: result?.verdict,
                    llmRationale: result?.comments,
                    llmProvider: result?.providerName,
                    llmModel: result?.model,
                    fetchStatus: result?.fetchStatus,
                });

                const read = await api.get({
                    action: 'query', prop: 'revisions', rvprop: 'content|ids',
                    rvslots: 'main', titles: SUITE_PAGE_TITLE,
                    format: 'json', formatversion: 2,
                });

                const revision = read.query.pages[0]?.revisions?.[0];
                if (!revision) throw new Error(`could not read ${SUITE_PAGE_TITLE}`);

                await api.postWithEditToken({
                    action: 'edit',
                    title: SUITE_PAGE_TITLE,
                    text: spliceRowIntoPage(revision.slots.main.content, row),
                    // Fail rather than clobber a row someone else added meanwhile.
                    baserevid: revision.revid,
                    summary: buildSuiteEditSummary({
                        article: mw.config.get('wgPageName').replace(/_/g, ' '),
                        citation: result?.citationNumber,
                    }),
                    assert: 'user',
                    format: 'json',
                    formatversion: 2,
                });

                mw.notify('Benchmark row added. Thank you!', { type: 'success' });
            } catch (error) {
                this.reportSuiteSubmissionError(error);
            }
        }

        reportSuiteSubmissionError(error) {
            const code = typeof error === 'string' ? error : (error?.code ?? error?.message);

            const explanations = {
                assertuserfailed: 'Your session expired. Log in again and retry.',
                protectedpage: 'The benchmark page is protected; you cannot edit it.',
                blocked: 'Your account is blocked from editing.',
                readonly: 'Wikipedia is in read-only mode right now. Try again shortly.',
                ratelimited: 'You have hit Wikipedia\'s edit rate limit. Wait a minute and retry.',
                editconflict: 'Someone else edited the page at the same time. Please retry.',
                abusefilter: 'An edit filter blocked this edit.',
                spamblacklist: 'A URL in this row is on the spam blacklist.',
            };

            mw.notify(
                explanations[code] ?? `Could not add the benchmark row: ${code ?? 'unknown error'}`,
                { type: 'error' },
            );
        }
```

**Step 2: Convert the button from a link to a click handler**

Replace `buildSubmitToDatasetButton` (line 4429) with:

```javascript
        buildSubmitToDatasetButton(result, { label = 'Add to benchmark' } = {}) {
            const button = new OO.ui.ButtonWidget({
                label,
                icon: 'feedback',
                framed: false,
            });
            button.on('click', () => { this.submitRowToSuite(result); });
            return button;
        }
```

**Step 3: Fix the config gate at the four call sites**

The call sites themselves are unchanged — they append `button.$element[0]`, which still
works. But each is **gated on the Google Form being configured**:

```javascript
main.js:3627  if (result.verdict && result.verdict !== 'ERROR' && this.isDatasetSubmissionConfigured()) {
main.js:3708  if (result.verdict && result.verdict !== 'ERROR' && this.isDatasetSubmissionConfigured()) {
main.js:3749  if (result.verdict && result.verdict !== 'ERROR' && this.isDatasetSubmissionConfigured()) {
main.js:4395  if (verdict && verdict !== 'ERROR' && this.isDatasetSubmissionConfigured()) {
```

`isDatasetSubmissionConfigured()` checks `DATASET_SUBMISSION_FORM_URL` for a placeholder
token. After repointing, whether the **wiki** button renders would depend on the **Form**
URL still being populated — wrong on its own terms, and a trap for whoever removes the
Form plumbing, which the design explicitly schedules as a follow-up.

Add a gate that reflects what the button now does. In `core/submission.js`:

```javascript
/**
 * The wiki write path needs a logged-in user and the MediaWiki API — not the
 * Google Form config. Kept separate from isDatasetSubmissionConfigured() so
 * removing the Form plumbing later cannot silently hide the wiki button.
 */
export function isSuiteSubmissionAvailable(userName) {
    return Boolean(userName);
}
```

Add the `main.js` wrapper next to the existing `isDatasetSubmissionConfigured()` wrapper
(currently line 4407):

```javascript
        isSuiteSubmissionAvailable() {
            return isSuiteSubmissionAvailable(mw.config.get('wgUserName'));
        }
```

Then at each of the four call sites, replace `this.isDatasetSubmissionConfigured()` with
`this.isSuiteSubmissionAvailable()`. Locate them by content
(`this.buildSubmitToDatasetButton(`) rather than by line number — earlier tasks in this
phase shift the file.

Leave the `isDatasetSubmissionConfigured()` function itself in place: line 3859 still
uses it for the wikitext report link (Task 5).

Re-sync after editing `core/submission.js`:

Run: `npm run build && npm run build -- --check`
Expected: exits 0.

**Step 4: Verify**

Run: `node --check main.js`
Expected: exit 0.

Run: `command grep -c 'this.buildSubmitToDatasetButton(' main.js`
Expected: `4`

Run: `command grep -c 'this.isSuiteSubmissionAvailable()' main.js`
Expected: `4`

Run: `command grep -n 'href: this.buildDatasetSubmissionUrl' main.js`
Expected: no output — the button no longer navigates.

**Step 5: Commit**

```bash
git add core/submission.js main.js
git commit -m "feat: submit benchmark rows to the wiki suite page via the MediaWiki API"
```

---

### Task 5: The wikitext report link

**Files:**
- Modify: `main.js:3859`

The design enumerates four call sites. There is a **fifth** consumer of the Google Form,
not mentioned in the design: `main.js:3859` embeds a Form URL as a `[url Submit]` link
inside the generated wikitext report.

```javascript
                        ? `[${this.buildDatasetSubmissionUrl(r)} Submit]`
```

A wikitext report is copied onto a talk page, so its links must be plain URLs — there is
no JavaScript context to run a dialog in. The API write path cannot serve it.

**Step 1: Apply the decision from the sign-off gate**

- **If the maintainer chose to leave it on the Form:** make no change, and add a comment
  above the line recording why:

```javascript
                        // Stays on the Google Form: a wikitext report is pasted onto a
                        // talk page, where there is no JS context for the API write path.
```

- **If the maintainer chose to repoint it:** replace the Form URL with a plain link to
  the suite page so a reader can add the row by hand:

```javascript
                        ? `[[${SUITE_PAGE_TITLE}|Add to benchmark]]`
```

**Step 2: Verify**

Run: `node --check main.js`
Expected: exit 0.

**Step 3: Commit**

```bash
git add main.js
git commit -m "feat: record the wikitext report link's submission target"
```

---

### Task 6: Manual browser verification

`main.js` has no test harness in this repo — README states end-to-end validation is
manual plus the benchmark suite. These checks are therefore manual and **must** be
performed before the phase is considered done.

**Step 1: Load the script on a test article**

Use `User:Alaexis/AI_Source_Verification_test.js`, which tracks the dev branch, per the
README's testing note. Load an article with citations and verify one.

**Step 2: Logged-in happy path**

- Click "Add to benchmark".
- Confirm the dialog appears, the verdict selector starts **unset**, and the model's
  verdict is shown only as de-emphasized reference text.
- Try to publish without choosing a verdict → the dialog re-prompts.
- Choose a verdict, add a rationale, publish.
- Confirm a success notification appears.
- Open the suite page and confirm the new row rendered **inside** the table, and that the
  edit appears in your contributions.

**Step 3: Confirm the row ingests**

```bash
node -e "
import('./benchmark/suite_fetch.js').then(async m => {
  const r = await m.loadSuite('<new revision id>');
  console.log('rows', r.rows.length);
  console.log('warnings', JSON.stringify(r.warnings ?? [], null, 2));
})"
```

Expected: parses and validates, with the row count one higher than the previous pin, and
one `ID_COMPUTED` warning naming the new row.

This is the phase's headline criterion, and it is what design success criterion 2
requires: the row lands in the next pinned run with **zero maintainer file edits**. The
contributed row carries no `id` — the browser cannot compute the hash without guessing —
so Phase 4 Task 1 Step 5 made ingestion compute it and warn, rather than reject. Rejecting
would let a single contribution block ingestion for the whole dataset, since `parseSuite`
fails the entire page on any error.

Writing the computed id back onto the page is good hygiene but **not** required for the
run to work. To do so:

```bash
node -e "import('./benchmark/suite.js').then(m=>console.log(m.computeRowId({wiki:'enwiki',oldid:<oldid>,citation:<n>,instance:1})))"
```

Note `loadSuite` must forward `warnings` from `parseSuite` for the command above to print
them. If it does not, add `warnings` to both return objects in `loadSuite` — it is a
one-line change in each branch.

**Step 4: Logged-out path**

- Open the same article in a private window, logged out.
- Click "Add to benchmark".
- Confirm an explanatory "log in to contribute" dialog appears and **no** failed save is
  attempted.

**Step 5: Dark mode**

The repo documents two independent dark-mode paths, and a component styled for only one
stays light-on-light for every "follow OS" reader. This phase adds no custom CSS — the
dialog uses stock OOUI widgets, which theme themselves.

Confirm this holds by viewing the dialog under both:
- Wikipedia night theme (`html.skin-theme-clientpref-night`)
- "Follow OS" with the OS in dark mode (`html.skin-theme-clientpref-os` + `prefers-color-scheme: dark`)

If any element reads light-on-light, add overrides in **both** blocks in
`createStyles()` — not just the `-night` one.

**Step 6: Record the results**

Write the outcomes into the PR description. Do not mark the phase done on untested paths.

---

## Phase 7 done when

- [ ] Maintainer sign-off is recorded, including the Task 5 decision.
- [ ] `npm test` passes; `npm run build -- --check` exits 0.
- [ ] `node --check main.js` exits 0.
- [ ] A logged-in editor adds a row through the UI, it lands inside the table, and the
      next `loadSuite` on that revision parses it successfully with **no maintainer file
      edits** — emitting one `ID_COMPUTED` warning, not an error.
- [ ] The four buttons are gated on `isSuiteSubmissionAvailable()`, not on the Google
      Form's configuration.
- [ ] A logged-out user sees an explanatory dialog and no failed save is attempted.
- [ ] Edit failures surface a specific message for `assertuserfailed`, `protectedpage`,
      `blocked`, `readonly`, `ratelimited`, `editconflict`, `abusefilter` and
      `spamblacklist`.
- [ ] The dialog renders correctly under both dark-mode paths.
- [ ] `core/submission.js`'s Google Form helpers are still present and untouched.
