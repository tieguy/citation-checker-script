# Wiki-Hosted Benchmark Suite Implementation Plan — Phase 3

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Fetch a suite revision's raw wikitext once, freeze it byte-exact to disk, and
resolve named pins to revision IDs — so every later run is offline and deterministic.

**Architecture:** Raw wikitext is stored, not rendered HTML. An `oldid` reproduces a
page's *source* exactly but does **not** reproduce its historical *rendering*, because
transcluded templates may have changed since. Storing source sidesteps template drift
entirely. The snapshot is the input of record; a run that finds a snapshot never touches
the network.

**Deliberate divergence from the design:** the design places the fetch inside
`benchmark/suite.js`. This plan puts it in a separate `benchmark/suite_fetch.js` so
`suite.js` stays a pure string→object module with no I/O, matching how `core/claim.js`,
`core/parsing.js`, and `core/verdicts.js` are structured and tested. Phase 2's
verification step asserts that purity.

**Tech Stack:** Node `node:https`, `node:fs`, `node:test`. No new dependencies.

**Scope:** Phase 3 of 7. Depends on Phase 2.

**Codebase verified:** 2026-07-23

---

### Task 1: The suite fetcher

**Files:**
- Create: `benchmark/suite_fetch.js`
- Create: `tests/suite_fetch.test.js`

**Note on the User-Agent.** The design says to follow `core/citoid.js`. **That file does
not exist** — verified 2026-07-23. The only existing Node fetch helper is `fetchURL()` at
`benchmark/extract_dataset.js:136-165`, which sends
`User-Agent: Mozilla/5.0 (compatible; BenchmarkBot/1.0)` — a spoofed browser string that
violates the [Wikimedia User-Agent policy](https://meta.wikimedia.org/wiki/User-Agent_policy)
for automated requests. Do **not** copy it. This module sends a properly identifying
agent. Leave `extract_dataset.js`'s helper alone; fixing it is out of scope here.

**Step 1: Write the failing test**

Create `tests/suite_fetch.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    buildRawUrl, SUITE_USER_AGENT, SUITE_PAGE_TITLE,
    snapshotPaths, writeSnapshot, readSnapshot, hasSnapshot,
} from '../benchmark/suite_fetch.js';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'suite-'));

test('buildRawUrl pins to an exact revision via action=raw', () => {
    const url = buildRawUrl(12345);
    assert.match(url, /^https:\/\/en\.wikipedia\.org\/w\/index\.php\?/);
    assert.match(url, /action=raw/);
    assert.match(url, /oldid=12345/);
    assert.match(url, /title=User%3AAlaexis/);
});

test('buildRawUrl rejects a non-numeric revision', () => {
    assert.throws(() => buildRawUrl('latest'), /numeric revision/i);
});

test('SUITE_USER_AGENT identifies the tool and a contact URL', () => {
    // Wikimedia's User-Agent policy requires an identifying agent for automated
    // requests. A spoofed browser string risks the whole project being blocked.
    assert.match(SUITE_USER_AGENT, /citation-checker/i);
    assert.match(SUITE_USER_AGENT, /https?:\/\//);
    assert.doesNotMatch(SUITE_USER_AGENT, /Mozilla/);
});

test('writeSnapshot stores wikitext byte-exact alongside parsed rows', () => {
    const dir = tmpDir();
    try {
        const wikitext = '{{Example|a=1}}\n\ntrailing space   \n';
        writeSnapshot(dir, 999, wikitext, { rows: [{ id: 'ctb-a1b2c3' }] }, { fetched_at: '2026-07-23' });

        const { wikitextPath, jsonPath } = snapshotPaths(dir, 999);
        assert.equal(fs.readFileSync(wikitextPath, 'utf-8'), wikitext);

        const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        assert.equal(meta.metadata.suite_oldid, 999);
        assert.equal(meta.metadata.fetched_at, '2026-07-23');
        assert.equal(meta.rows.length, 1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('readSnapshot round-trips exactly what writeSnapshot stored', () => {
    const dir = tmpDir();
    try {
        const wikitext = '{{Example|a=1}}\n';
        writeSnapshot(dir, 42, wikitext, { rows: [] }, {});
        assert.equal(hasSnapshot(dir, 42), true);
        assert.equal(readSnapshot(dir, 42).wikitext, wikitext);
        assert.equal(readSnapshot(dir, 42).metadata.suite_oldid, 42);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('hasSnapshot is false when only one of the two files exists', () => {
    const dir = tmpDir();
    try {
        fs.writeFileSync(snapshotPaths(dir, 7).wikitextPath, 'x');
        assert.equal(hasSnapshot(dir, 7), false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SUITE_PAGE_TITLE matches the page Phase 1 published', () => {
    assert.equal(SUITE_PAGE_TITLE, 'User:Alaexis/AI Source Verification/Benchmark');
});
```

**Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern='buildRawUrl' 'tests/**/*.test.js'`
Expected: FAIL — `Cannot find module '.../benchmark/suite_fetch.js'`

**Step 3: Write the implementation**

Create `benchmark/suite_fetch.js`:

```javascript
// Fetch and freeze the on-wiki benchmark suite.
//
// Separated from suite.js so that module stays pure (string in, objects out,
// no I/O) the way core/claim.js and core/verdicts.js are.
//
// WHY RAW WIKITEXT, NOT RENDERED HTML: an oldid reproduces a page's *source*
// exactly, but not its historical *rendering* — the row template it transcludes
// may have changed since. Freezing source is therefore the only representation
// that actually reproduces.

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

export const SUITE_PAGE_TITLE = 'User:Alaexis/AI Source Verification/Benchmark';
export const SUITE_WIKI_HOST = 'en.wikipedia.org';

// Wikimedia's User-Agent policy requires automated requests to identify the tool
// and offer a contact route. https://meta.wikimedia.org/wiki/User-Agent_policy
export const SUITE_USER_AGENT =
    'citation-checker-script benchmark suite fetcher '
    + '(https://github.com/alex-o-748/citation-checker-script)';

const FETCH_TIMEOUT_MS = 30000;

export function buildRawUrl(oldid, { title = SUITE_PAGE_TITLE, host = SUITE_WIKI_HOST } = {}) {
    if (!/^\d+$/.test(String(oldid))) {
        throw new Error(`suite oldid must be a numeric revision id, got: ${oldid}`);
    }
    const params = new URLSearchParams({
        title: title.replace(/ /g, '_'),
        oldid: String(oldid),
        action: 'raw',
    });
    return `https://${host}/w/index.php?${params}`;
}

export function fetchRawWikitext(oldid, options = {}) {
    const url = buildRawUrl(oldid, options);

    return new Promise((resolve, reject) => {
        const request = https.get(url, {
            headers: { 'User-Agent': SUITE_USER_AGENT, 'Accept': 'text/plain' },
        }, (response) => {
            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error(`suite fetch failed: HTTP ${response.statusCode} for ${url}`));
                return;
            }
            response.setEncoding('utf8');
            let data = '';
            response.on('data', chunk => { data += chunk; });
            response.on('end', () => resolve(data));
        });

        request.on('error', reject);
        request.setTimeout(FETCH_TIMEOUT_MS, () => {
            request.destroy();
            reject(new Error(`suite fetch timed out after ${FETCH_TIMEOUT_MS}ms: ${url}`));
        });
    });
}

export function snapshotPaths(dir, oldid) {
    return {
        wikitextPath: path.join(dir, `${oldid}.wikitext`),
        jsonPath: path.join(dir, `${oldid}.json`),
    };
}

export function hasSnapshot(dir, oldid) {
    const { wikitextPath, jsonPath } = snapshotPaths(dir, oldid);
    return fs.existsSync(wikitextPath) && fs.existsSync(jsonPath);
}

/**
 * Freeze a suite revision. The wikitext is written byte-exact — no trimming, no
 * newline normalization — because it is the reproducibility artifact and any
 * rewriting would make the snapshot diverge from what the page actually said.
 */
export function writeSnapshot(dir, oldid, wikitext, parsed, extraMetadata = {}) {
    fs.mkdirSync(dir, { recursive: true });
    const { wikitextPath, jsonPath } = snapshotPaths(dir, oldid);

    fs.writeFileSync(wikitextPath, wikitext, 'utf-8');
    fs.writeFileSync(jsonPath, JSON.stringify({
        metadata: {
            suite_page: SUITE_PAGE_TITLE,
            suite_oldid: Number(oldid),
            suite_url: buildRawUrl(oldid),
            row_count: parsed.rows.length,
            ...extraMetadata,
        },
        rows: parsed.rows,
    }, null, 2) + '\n', 'utf-8');
}

export function readSnapshot(dir, oldid) {
    const { wikitextPath, jsonPath } = snapshotPaths(dir, oldid);
    if (!hasSnapshot(dir, oldid)) {
        throw new Error(`no snapshot for suite revision ${oldid} in ${dir}`);
    }
    const stored = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    return {
        wikitext: fs.readFileSync(wikitextPath, 'utf-8'),
        metadata: stored.metadata,
        rows: stored.rows,
    };
}
```

**Step 4: Run to verify it passes**

Run: `node --test --test-name-pattern='buildRawUrl|SUITE_|Snapshot|snapshot' 'tests/**/*.test.js'`
Expected: PASS, 7 tests.

**Step 5: Commit**

```bash
git add benchmark/suite_fetch.js tests/suite_fetch.test.js
git commit -m "benchmark: fetch and freeze suite revisions as raw wikitext"
```

---

### Task 2: Named pins

**Files:**
- Create: `benchmark/suite-pins.json`
- Modify: `benchmark/suite_fetch.js`
- Modify: `tests/suite_fetch.test.js`

**Step 1: Create the pins file**

Create `benchmark/suite-pins.json`. Phase 5 fills in the real revision IDs; it starts
empty so the resolver has something well-formed to read:

```json
{
  "_comment": "Named pins for benchmark suite revisions. A pin is an immutable revision id of the suite page; advancing one is a deliberate act with a reviewable diff. Populated by Phase 5 of the wiki-hosted-benchmark-suite plan.",
  "pins": {}
}
```

**Step 2: Write the failing test**

Append to `tests/suite_fetch.test.js`:

```javascript
import { resolveSuiteRef } from '../benchmark/suite_fetch.js';

const PINS = { v1: 1000, 'v1+v2': 2000, latest: 3000 };

test('resolveSuiteRef passes a bare revision id straight through', () => {
    assert.equal(resolveSuiteRef('123456', PINS), 123456);
    assert.equal(resolveSuiteRef(123456, PINS), 123456);
});

test('resolveSuiteRef resolves a named pin', () => {
    assert.equal(resolveSuiteRef('v1', PINS), 1000);
    assert.equal(resolveSuiteRef('v1+v2', PINS), 2000);
});

test('resolveSuiteRef lists the available pins when a name is unknown', () => {
    assert.throws(() => resolveSuiteRef('v9', PINS), /unknown suite pin "v9"/);
    assert.throws(() => resolveSuiteRef('v9', PINS), /v1\+v2/);
});

test('resolveSuiteRef refuses an empty pins table with an actionable message', () => {
    assert.throws(() => resolveSuiteRef('v1', {}), /no pins are defined/i);
});
```

**Step 3: Run to verify it fails**

Run: `node --test --test-name-pattern='resolveSuiteRef' 'tests/**/*.test.js'`
Expected: FAIL — `resolveSuiteRef` is not exported.

**Step 4: Write the implementation**

Append to `benchmark/suite_fetch.js`:

```javascript
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SUITE_PINS_PATH = path.join(MODULE_DIR, 'suite-pins.json');
export const SUITE_SNAPSHOT_DIR = path.join(MODULE_DIR, 'suites');

export function loadPins(pinsPath = SUITE_PINS_PATH) {
    if (!fs.existsSync(pinsPath)) return {};
    return JSON.parse(fs.readFileSync(pinsPath, 'utf-8')).pins ?? {};
}

/**
 * Resolve `--suite-oldid` to a numeric revision. Accepts either a bare revision
 * id or a name from suite-pins.json, so callers can say `v1` without looking up
 * which revision that was.
 */
export function resolveSuiteRef(ref, pins = loadPins()) {
    if (/^\d+$/.test(String(ref))) return Number(ref);

    const names = Object.keys(pins);
    if (names.length === 0) {
        throw new Error(
            `cannot resolve suite pin "${ref}": no pins are defined yet in suite-pins.json. `
            + 'Pass a numeric revision id instead.');
    }
    if (!(ref in pins)) {
        throw new Error(`unknown suite pin "${ref}". Available pins: ${names.join(', ')}`);
    }
    return Number(pins[ref]);
}
```

Note the `import` must be hoisted to the top of the file with the other imports —
place `import { fileURLToPath } from 'node:url';` alongside the existing `node:` imports
rather than mid-file.

**Step 5: Run to verify it passes**

Run: `node --test --test-name-pattern='resolveSuiteRef' 'tests/**/*.test.js'`
Expected: PASS, 4 tests.

**Step 6: Commit**

```bash
git add benchmark/suite-pins.json benchmark/suite_fetch.js tests/suite_fetch.test.js
git commit -m "benchmark: resolve named suite pins to revision ids"
```

---

### Task 3: The `loadSuite` entry point — fetch once, then offline forever

**Files:**
- Modify: `benchmark/suite_fetch.js`
- Modify: `tests/suite_fetch.test.js`
- Create: `benchmark/suites/.gitkeep`

**Step 1: Write the failing test**

Append to `tests/suite_fetch.test.js`:

```javascript
import { loadSuite } from '../benchmark/suite_fetch.js';
import { SUITE_TEMPLATE_TITLE } from '../benchmark/suite.js';

const validPage = `{{${SUITE_TEMPLATE_TITLE}
| id = ctb-a1b2c3
| wiki = enwiki
| article = Immigration to the United States
| oldid = 1331476438
| citation = 1
| instance = 1
| truth = Supported
}}`;

test('loadSuite fetches once, writes a snapshot, then never fetches again', async () => {
    const dir = tmpDir();
    try {
        let fetches = 0;
        const fetchFn = async () => { fetches++; return validPage; };

        const first = await loadSuite(111, { dir, fetchFn });
        assert.equal(fetches, 1);
        assert.equal(first.rows.length, 1);
        assert.equal(first.fromSnapshot, false);

        const second = await loadSuite(111, { dir, fetchFn });
        assert.equal(fetches, 1, 'second call must not hit the network');
        assert.equal(second.fromSnapshot, true);
        assert.deepEqual(second.rows, first.rows);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('loadSuite with offline:true refuses to fetch a missing snapshot', async () => {
    const dir = tmpDir();
    try {
        await assert.rejects(
            () => loadSuite(222, { dir, offline: true, fetchFn: async () => validPage }),
            /no snapshot/i,
        );
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('loadSuite does not write a snapshot when validation fails', async () => {
    const dir = tmpDir();
    try {
        const bad = `{{${SUITE_TEMPLATE_TITLE}|id=ctb-a1b2c3|truth=Supported}}`;
        await assert.rejects(() => loadSuite(333, { dir, fetchFn: async () => bad }));
        assert.equal(hasSnapshot(dir, 333), false,
            'an invalid suite must not be frozen — it would reproduce the corruption');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('loadSuite re-parses stored wikitext rather than trusting stored rows', async () => {
    const dir = tmpDir();
    try {
        await loadSuite(444, { dir, fetchFn: async () => validPage });
        // Corrupt only the derived JSON. The wikitext is the source of record, so
        // the reload must reflect the wikitext, not the tampered rows.
        const { jsonPath } = snapshotPaths(dir, 444);
        const stored = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        stored.rows = [{ id: 'ctb-ffffff' }, { id: 'ctb-eeeeee' }];
        fs.writeFileSync(jsonPath, JSON.stringify(stored));

        const reloaded = await loadSuite(444, { dir, fetchFn: async () => { throw new Error('no fetch'); } });
        assert.equal(reloaded.rows.length, 1);
        assert.equal(reloaded.rows[0].id, 'ctb-a1b2c3');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
```

**Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern='loadSuite' 'tests/**/*.test.js'`
Expected: FAIL — `loadSuite` is not exported.

**Step 3: Write the implementation**

Add to the imports at the top of `benchmark/suite_fetch.js`:

```javascript
import { parseSuite } from './suite.js';
```

Append to `benchmark/suite_fetch.js`:

```javascript
/**
 * Resolve a suite revision to validated rows.
 *
 * On a cache miss: fetch, validate, and only then freeze. An invalid suite is
 * never written to disk — freezing it would make the corruption reproducible,
 * which is the opposite of the point.
 *
 * On a cache hit: re-parse the stored wikitext rather than trusting the stored
 * rows. The wikitext is the artifact of record; the JSON is a convenience
 * derivation, and re-deriving it means a validator improvement applies to
 * existing snapshots for free.
 */
export async function loadSuite(ref, {
    dir = SUITE_SNAPSHOT_DIR,
    pins = undefined,
    offline = false,
    fetchFn = fetchRawWikitext,
    fetchedAt = undefined,
} = {}) {
    const oldid = resolveSuiteRef(ref, pins ?? loadPins());

    if (hasSnapshot(dir, oldid)) {
        const snapshot = readSnapshot(dir, oldid);
        const { rows } = parseSuite(snapshot.wikitext);
        return { oldid, rows, wikitext: snapshot.wikitext, metadata: snapshot.metadata, fromSnapshot: true };
    }

    if (offline) {
        throw new Error(
            `no snapshot for suite revision ${oldid} in ${dir} and offline mode is set. `
            + 'Run once with network access to freeze it.');
    }

    const wikitext = await fetchFn(oldid);
    const parsed = parseSuite(wikitext);

    writeSnapshot(dir, oldid, wikitext, parsed, {
        fetched_at: fetchedAt ?? new Date().toISOString().slice(0, 10),
    });

    const snapshot = readSnapshot(dir, oldid);
    return { oldid, rows: parsed.rows, wikitext, metadata: snapshot.metadata, fromSnapshot: false };
}
```

**Step 4: Create the snapshot directory**

```bash
mkdir -p benchmark/suites
touch benchmark/suites/.gitkeep
```

**Step 5: Run to verify it passes**

Run: `node --test --test-name-pattern='loadSuite' 'tests/**/*.test.js'`
Expected: PASS, 4 tests.

Run: `npm test`
Expected: full suite green.

**Step 6: Commit**

```bash
git add benchmark/suite_fetch.js tests/suite_fetch.test.js benchmark/suites/.gitkeep
git commit -m "benchmark: load suite revisions from snapshot, fetching only on miss"
```

---

### Task 4: Live smoke check against the real page

This is the only task in Phase 3 that touches the network, and **Step 3 contains one
`[HUMAN]` on-wiki edit** — the Phase 1 sample rows are deliberately invalid, so a valid
revision has to be created before the snapshot path can be exercised. Everything else in
this phase is ordinary code work.

**Files:** none modified.

**Step 1: Find the current revision id of the suite page**

Run:
```bash
curl -s -H 'User-Agent: citation-checker-script benchmark suite fetcher (https://github.com/alex-o-748/citation-checker-script)' \
  'https://en.wikipedia.org/w/api.php?action=query&prop=revisions&titles=User:Alaexis/AI%20Source%20Verification/Benchmark&rvprop=ids&rvlimit=1&format=json&formatversion=2' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).query.pages[0].revisions[0].revid))"
```
Expected: a numeric revision id. Record it as `<REV>`.

**Step 2: Fetch and freeze that revision**

Run:
```bash
node -e "
import('./benchmark/suite_fetch.js').then(async m => {
  const r = await m.loadSuite(process.argv[1]);
  console.log('oldid', r.oldid, 'rows', r.rows.length, 'fromSnapshot', r.fromSnapshot);
})" <REV>
```

Expected: **the command fails.** It prints a `SuiteValidationError` naming row 2 and the
`oldid` parameter, and exits non-zero. Nothing is printed on stdout.

This is the correct outcome, not a setup mistake. The Phase 1 sample rows deliberately
include a row missing `oldid`; that row makes `parseSuite` throw, and per Task 3 no
snapshot is written on a validation failure. It proves end-to-end that a malformed
on-wiki row blocks ingestion instead of silently shrinking the dataset.

Confirm no snapshot was written:

Run: `ls benchmark/suites/`
Expected: only `.gitkeep`.

Record the error output; it is the phase's headline verification.

**Step 3: Confirm offline determinism `[HUMAN]` + `[AGENT]`**

Exercising the snapshot path needs a *valid* page, which requires one on-wiki edit. This
is the only step in Phase 3 an agent cannot perform on its own.

**`[HUMAN]`:** edit the suite page and add `| oldid = 1331476438` to the second sample
row, save, and report the new revision id as `<REV2>`.

**`[AGENT]`**, with that id:

Run: `node -e "import('./benchmark/suite_fetch.js').then(m=>m.loadSuite('<REV2>')).then(r=>console.log(r.rows.length, r.fromSnapshot))"`
Expected: `2 false`

Run the **same command again**:
Expected: `2 true` — served from the snapshot, no network.

Run with the network disabled (or `offline: true`):
```bash
node -e "import('./benchmark/suite_fetch.js').then(m=>m.loadSuite('<REV2>',{offline:true})).then(r=>console.log(r.rows.length,r.fromSnapshot))"
```
Expected: `2 true`

**Step 4: Commit the smoke snapshot**

```bash
git add benchmark/suites/<REV2>.wikitext benchmark/suites/<REV2>.json
git commit -m "benchmark: freeze first suite snapshot from the live page"
```

Enumerate the two files by name. Do not `git add benchmark/suites/`.

---

## Phase 3 done when

- [ ] `npm test` passes including all of `tests/suite_fetch.test.js` (15 tests).
- [ ] A named pin resolves to a revid, or errors listing the available pins.
- [ ] A first `loadSuite` call fetches and writes both snapshot files; a second call
      with the network unavailable produces byte-identical parsed output.
- [ ] A suite revision that fails validation leaves **no** snapshot on disk.
- [ ] `benchmark/suite.js` still performs no I/O:
      `grep -nE "fs\.|https?\.|fetch\(" benchmark/suite.js` returns nothing.
