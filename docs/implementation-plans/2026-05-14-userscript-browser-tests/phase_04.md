# Userscript Browser Tests — Phase 4: Tracer-Bullet Smoke Test

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Get the harness end-to-end-working for the simplest possible assertion: load main.js into a fake-Wikipedia fixture page and verify the sidebar mounts. This phase exists to surface and fix harness bugs (missing OOUI stubs, wrong URL patterns in mocks, wrong selectors) before writing more tests on top.

**Architecture:** A shared `load-userscript.js` helper does `setContent` → `addScriptTag(jquery)` → `addScriptTag(mw-stubs.js)` → `addScriptTag(main.js)`. The smoke spec calls the helper and asserts `#source-verifier-sidebar` exists and has no console errors.

**Tech Stack:** Playwright Test, ESM imports.

**Scope:** Phase 4 of 5. **This is the iteration phase** — expect 1-3 cycles of "run → fix stub → re-run" before green. Each iteration may require small edits in `tests/e2e/fixtures/mw-stubs.js` (Phase 2 file). That's expected; don't treat it as backtracking.

**Codebase verified:** 2026-05-14. main.js entry guard at line 3597 requires `mw.config.get('wgNamespaceNumber') ∈ [0, 118]`; init does `mw.loader.using([...]).then(() => createUI())`; sidebar created at line 830 with `id = 'source-verifier-sidebar'`.

---

## Task 1: Create the load-userscript helper

**Files:**
- Create: `tests/e2e/fixtures/load-userscript.js`

**Step 1: Write the helper**

Create `tests/e2e/fixtures/load-userscript.js`:

```javascript
// Shared loader used by every spec: sets the fixture HTML, injects jQuery,
// then mw-stubs.js, then main.js. Returns once main.js's async init has run
// the sidebar mount.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FIXTURE_HTML_PATH = path.join('tests', 'e2e', 'fixtures', 'article.html');
const JQUERY_PATH = path.join('node_modules', 'jquery', 'dist', 'jquery.min.js');
const STUBS_PATH = path.join('tests', 'e2e', 'fixtures', 'mw-stubs.js');
const MAIN_JS_PATH = 'main.js';

/**
 * Load the userscript into a fake-Wikipedia fixture page and wait for its sidebar to mount.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function loadUserscript(page) {
  const html = await readFile(FIXTURE_HTML_PATH, 'utf8');
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  // Order matters: jQuery, then stubs (depend on $), then main.js (depends on mw + $ + OO).
  await page.addScriptTag({ path: JQUERY_PATH });
  await page.addScriptTag({ path: STUBS_PATH });
  await page.addScriptTag({ path: MAIN_JS_PATH });

  // main.js's outer IIFE awaits mw.loader.using(...).then(...) which our stub resolves
  // synchronously, but the sidebar mount happens inside a $(function() {...}) callback
  // which is queued via jQuery's DOMReady. Wait explicitly for the sidebar element.
  await page.waitForSelector('#source-verifier-sidebar', { state: 'attached', timeout: 5000 });
}
```

**Why the explicit wait:** `addScriptTag` resolves when the script tag loads, but main.js's init chain is async (`mw.loader.using(...).then(...)`). Without an explicit wait on the sidebar, assertions could race the mount.

**Step 2: Syntax check**

```bash
node --check tests/e2e/fixtures/load-userscript.js
```

Expected: no output, exits 0.

**No commit yet** — committed alongside the smoke test once green.

---

## Task 2: Write the smoke test

**Files:**
- Create: `tests/e2e/smoke.spec.js`

**Step 1: Write the test**

Create `tests/e2e/smoke.spec.js`:

```javascript
import { test, expect } from '@playwright/test';
import { loadUserscript } from './fixtures/load-userscript.js';
import { setupWorkerMocks } from './fixtures/mock-worker.js';

test.describe('smoke', () => {
  test('loads on a fixture page and mounts the sidebar', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    await setupWorkerMocks(page);
    await loadUserscript(page);

    await expect(page.locator('#source-verifier-sidebar')).toBeAttached();

    // No uncaught errors during init.
    expect(consoleErrors, `unexpected console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
```

**Step 2: Run the test**

```bash
npm run test:e2e -- smoke.spec.js
```

**Expected on first run:** likely a failure. Common failure modes and fixes:

| Failure | Likely cause | Fix |
|---|---|---|
| `Error: function X is not defined` from `OO.ui.SomeWidget` | Stub missing a constructor or method | Add to `tests/e2e/fixtures/mw-stubs.js`; re-run |
| `mw.config.get('foo') returned undefined` warning | A new mw.config key is read | Add the key to `mwConfig` in `mw-stubs.js` |
| `#source-verifier-sidebar` selector timeout | Init never reached `createUI()` — check pageerror in console output | Read the trace file (`test-results/.../trace.zip`); inspect the unhandled exception |
| `TypeError: $(...).foo is not a function` | jQuery extension method not loaded | Ensure jQuery loaded before stubs |
| CORS error on `?fetch=` request | OPTIONS preflight not handled | Verify `mock-worker.js` handles OPTIONS — it does, but if the test still fails, log the request URL via `page.on('request', …)` and adjust the route pattern |

Read the test output. Read the trace if available. Make the smallest fix. Re-run. Repeat.

**Step 3: When green, commit**

```bash
git add tests/e2e/fixtures/load-userscript.js tests/e2e/smoke.spec.js
# Also include any iterative fixes to mw-stubs.js or mock-worker.js
git add tests/e2e/fixtures/mw-stubs.js tests/e2e/fixtures/mock-worker.js 2>/dev/null
git commit -m "test(e2e): tracer-bullet smoke test for userscript sidebar mount"
```

If iterative fixes spanned multiple stubs, consider splitting into two commits: one for the harness (helper + smoke test), one for the stub fixes. Use your judgment based on how much the stubs changed.

---

## Phase 4 Done When

- `npm run test:e2e -- smoke.spec.js` exits 0 with `1 passed`.
- No console errors emitted during the test run.
- `tests/e2e/fixtures/load-userscript.js` and `tests/e2e/smoke.spec.js` exist.
- One or more commits capturing the harness + any stub iteration.

**If you can't make this green:** STOP and surface the blocker. The remaining phases assume a working harness. Don't proceed to Phase 5 with a flaky smoke test.
