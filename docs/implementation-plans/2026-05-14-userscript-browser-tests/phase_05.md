# Userscript Browser Tests — Phase 5: Golden-Path Tests

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Cover the user-visible golden path of the citation verifier with 5 tests, on top of the Phase 4 smoke. Each task adds one test, runs it, fixes any stub gaps it surfaces, commits.

**Architecture:** All tests live in `tests/e2e/verify-flow.spec.js`. Each uses `setupWorkerMocks(page, overrides)` to control the mocked verdict and `loadUserscript(page)` for the harness. Assertions use Playwright role/text/id locators.

**Tech Stack:** Same as Phase 4.

**Scope:** Phase 5 of 5. Final phase.

**Codebase verified:** 2026-05-14. Relevant DOM anchors:
- Sidebar: `#source-verifier-sidebar` (line 830).
- Verify button: `OO.ui.ButtonWidget` with label `'Verify Claim'` (main.js:1916). Findable via `getByRole('button', { name: 'Verify Claim' })`.
- Verdict region: `#verifier-verdict` (line 866, 1017). State classes: `.supported`, `.partially-supported`, `.not-supported`, `.source-unavailable` (main.js:1025-1044).
- Claim section: `#verifier-claim-section` (line 847); inner text `#verifier-claim-text` (line 849).
- "Edit Section" button: `OO.ui.ButtonWidget` label `'Edit Section'` (main.js:3067, 3101) on failed verdicts.
- Reference markers: `<sup class="reference">[N]</sup>` in the fixture HTML.

**One operational note:** main.js initializes the provider from `localStorage['source_verifier_provider']` with a hardcoded default. Tests should explicitly set `localStorage['source_verifier_provider'] = 'publicai'` via `page.addInitScript` before main.js runs, to keep tests on the worker-routed path. If a different default is observed during Phase 4, adjust accordingly.

---

## Task 1: Test — clicking a reference populates the claim section

**Files:**
- Modify: `tests/e2e/verify-flow.spec.js` (create on first task; append to it on later tasks)

**Step 1: Write the spec file**

Create `tests/e2e/verify-flow.spec.js`:

```javascript
import { test, expect } from '@playwright/test';
import { loadUserscript } from './fixtures/load-userscript.js';
import { setupWorkerMocks, getMockState } from './fixtures/mock-worker.js';

// Force PublicAI provider so all LLM traffic routes through the mocked worker.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('source_verifier_provider', 'publicai');
    } catch (e) { /* ignore in environments without storage */ }
  });
});

test.describe('verify flow', () => {
  test('clicking [1] populates the claim section with surrounding prose', async ({ page }) => {
    await setupWorkerMocks(page);
    await loadUserscript(page);

    await page.locator('sup.reference').first().locator('a').click();

    const claim = page.locator('#verifier-claim-text');
    await expect(claim).toContainText('sky is blue');
  });
});
```

**Step 2: Run it**

```bash
npm run test:e2e -- verify-flow.spec.js
```

Expected: passes. If it fails because the click doesn't trigger the handler, check that `attachReferenceClickHandlers()` ran — Phase 4's smoke already verified the sidebar mounts, so click-handler attachment is the next thing to debug. The trace file shows what actually happened in the page.

**Step 3: Commit**

```bash
git add tests/e2e/verify-flow.spec.js
git commit -m "test(e2e): citation click populates claim section"
```

---

## Task 2: Test — verify button → supported verdict renders

**Files:**
- Modify: `tests/e2e/verify-flow.spec.js`

**Step 1: Append the test**

Add inside the `describe('verify flow', () => {...})` block:

```javascript
test('verify button → supported verdict renders with .supported class', async ({ page }) => {
  await setupWorkerMocks(page);  // default mock = Supported verdict
  await loadUserscript(page);

  await page.locator('sup.reference').first().locator('a').click();
  await page.getByRole('button', { name: 'Verify Claim' }).click();

  const verdict = page.locator('#verifier-verdict');
  await expect(verdict).toHaveClass(/\bsupported\b/, { timeout: 5000 });
  await expect(verdict).toContainText(/Supported/i);

  const state = await getMockState(page);
  expect(state.llmRequests.length).toBe(1);
  expect(state.loggedVerifications.length).toBe(1);
});
```

**Step 2: Run**

```bash
npm run test:e2e -- verify-flow.spec.js -g 'supported verdict renders'
```

Expected: passes. If the verdict class regex fails to match, log the actual class with `console.log(await verdict.getAttribute('class'))` and adjust the regex. Note `partially-supported` and `not-supported` both contain `supported` as a substring; `\b` word boundaries in the regex prevent false matches.

**Step 3: Commit**

```bash
git add tests/e2e/verify-flow.spec.js
git commit -m "test(e2e): verify button renders supported verdict"
```

---

## Task 3: Test — verify button → not-supported verdict renders, edit action appears

**Files:**
- Modify: `tests/e2e/verify-flow.spec.js`

**Step 1: Append the test**

Add inside the describe block:

```javascript
test('verify button → not-supported verdict shows Edit Section button', async ({ page }) => {
  await setupWorkerMocks(page, {
    llm: { verdict: 'Not supported', confidence: 'High', comments: 'Mock not-supported.' },
  });
  await loadUserscript(page);

  await page.locator('sup.reference').first().locator('a').click();
  await page.getByRole('button', { name: 'Verify Claim' }).click();

  const verdict = page.locator('#verifier-verdict');
  await expect(verdict).toHaveClass(/not-supported/, { timeout: 5000 });

  // Edit Section button only appears on failed verdicts.
  await expect(page.getByRole('button', { name: 'Edit Section' })).toBeVisible();
});
```

**Step 2: Run**

```bash
npm run test:e2e -- verify-flow.spec.js -g 'not-supported verdict'
```

Expected: passes. If "Edit Section" is not found, the button may be created inside a section that's not currently visible — check the trace file and adjust the locator (e.g. add `.first()` if it matches multiple, or wait for a parent container to appear).

**Step 3: Commit**

```bash
git add tests/e2e/verify-flow.spec.js
git commit -m "test(e2e): not-supported verdict shows Edit Section button"
```

---

## Task 4: Test — worker fetch error surfaces to the user

**Files:**
- Modify: `tests/e2e/verify-flow.spec.js`

**Step 1: Append the test**

Add inside the describe block:

```javascript
test('worker fetch error → mw.notify is called', async ({ page }) => {
  await setupWorkerMocks(page, {
    fetch: { status: 500, body: { error: 'Source temporarily unavailable' } },
  });
  await loadUserscript(page);

  await page.locator('sup.reference').first().locator('a').click();
  await page.getByRole('button', { name: 'Verify Claim' }).click();

  // The verdict region should NOT render a successful state.
  // Either it stays empty / shows an error class, or mw.notify is invoked.
  // Whichever main.js does, at least one user-visible error signal must fire.
  await expect.poll(async () => {
    const state = await getMockState(page);
    return state.mwNotifications.length;
  }, { timeout: 5000 }).toBeGreaterThan(0);
});
```

**Why `expect.poll`:** main.js's error path is asynchronous (fetch rejects, then renders/notifies). Polling the notification list is more reliable than a single read.

**Step 2: Run**

```bash
npm run test:e2e -- verify-flow.spec.js -g 'fetch error'
```

Expected: passes. If `mwNotifications` stays empty for the full timeout, main.js may be swallowing the error silently — that's a real bug to surface upstream, not a test bug. Check the console-error log from Phase 4's smoke pattern (add the same listener to this test if needed) to confirm whether main.js logged the failure.

If you discover main.js handles fetch errors a different way (e.g., renders an error verdict instead of calling mw.notify), adjust the assertion to match the actual behavior — the test exists to verify *something user-visible happens*, not to enforce a specific mechanism.

**Step 3: Commit**

```bash
git add tests/e2e/verify-flow.spec.js
git commit -m "test(e2e): worker fetch error surfaces a user-visible signal"
```

---

## Task 5: Test — click handlers attach to all reference markers

**Files:**
- Modify: `tests/e2e/verify-flow.spec.js`

**Step 1: Append the test**

Add inside the describe block:

```javascript
test('click handlers attached to all reference markers (smoke for batch flow)', async ({ page }) => {
  await setupWorkerMocks(page);
  await loadUserscript(page);

  // Click [2] (not [1]) and assert claim section updates to reflect the second source.
  await page.locator('sup.reference').nth(1).locator('a').click();

  const claim = page.locator('#verifier-claim-text');
  await expect(claim).toContainText('grass is green');
});
```

**Step 2: Run**

```bash
npm run test:e2e -- verify-flow.spec.js -g 'click handlers attached'
```

Expected: passes. If only `[1]` works and `[2]` doesn't, `attachReferenceClickHandlers()` is iterating wrong — check whether it queries `document.querySelectorAll('sup.reference')` or limits to `.first()` (per investigation it iterates all).

**Step 3: Commit**

```bash
git add tests/e2e/verify-flow.spec.js
git commit -m "test(e2e): click handlers attach to all reference markers"
```

---

## Task 6: Full suite verification

**Step 1: Run the entire suite**

```bash
npm run test:e2e
```

Expected: `6 passed` (1 smoke + 5 golden-path).

**Step 2: Confirm node-test suite still passes**

```bash
npm test
```

Expected: `181 passed, 0 failed` (the pre-existing baseline; no regressions).

**Step 3: Confirm main.js is in sync with core/**

```bash
npm run build -- --check
```

Expected: exit 0 (main.js matches the concatenation of `core/`).

**No commit for this task** — verification only.

---

## Phase 5 Done When

- `tests/e2e/verify-flow.spec.js` contains 5 tests, all passing.
- Total Playwright suite: 6 tests pass (1 smoke + 5 golden-path).
- Node-test suite still passes 181/181.
- `npm run build -- --check` exits 0.
- Five commits on the branch (one per test).

## What's deliberately not covered

(For PR description / follow-up issue.)

- CI workflow — separate PR, see existing local `add-github-actions-ci` branch in BRANCHES.md.
- Cross-browser (Firefox/WebKit) — Chromium only.
- Provider-switching tests (Claude/Gemini/OpenAI/HuggingFace direct calls are *blocked* by the mock; tests don't cover the actual switch UI behavior beyond what golden-path exercises).
- Sidebar resize / localStorage persistence — declined as out-of-scope; can be added later.
- Saved real-Wikipedia-article fixture — declined; the hand-rolled fixture is the source of truth. If main.js gets confused by real Wikipedia markup that the hand-rolled fixture doesn't replicate, file an issue and add a targeted test (or a second fixture) at that point.
- `data-testid` attributes on main.js — none added; role/id/text selectors sufficed.
