# Userscript Browser Tests — Phase 1: Project Setup

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Install Playwright tooling and wire npm scripts so `npm run test:e2e` is wired up to first build `main.js`, then run an (initially empty) Playwright test suite.

**Architecture:** Add `@playwright/test` and `jquery` as devDependencies; add `playwright.config.js` configuring a single Chromium project rooted at `tests/e2e/`; add `pretest:e2e` (runs build) and `test:e2e` (runs Playwright) npm scripts.

**Tech Stack:** Node ≥18, @playwright/test ^1.49, jquery ^3.7.1, Chromium.

**Scope:** Phase 1 of 5.

**Codebase verified:** 2026-05-14 against worktree HEAD `bcadb75`.

---

## Task 1: Install @playwright/test and jquery as devDependencies

**Files:**
- Modify: `package.json` (root)

**Step 1: Install**

```bash
npm install --save-dev @playwright/test@^1.49.0 jquery@^3.7.1
```

Expected: `package.json` and `package-lock.json` updated; `node_modules/@playwright/test/` and `node_modules/jquery/` created.

**Step 2: Verify**

```bash
npm list @playwright/test jquery --depth=0
```

Expected: both packages listed, no missing dependencies.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add @playwright/test and jquery as devDependencies for browser tests"
```

---

## Task 2: Install Chromium browser locally

**Files:** None modified (per-machine setup; browser binaries are not committed).

**Step 1: Install Chromium with system deps**

```bash
npx playwright install chromium --with-deps
```

Expected: downloads Chromium (~150MB) into `~/.cache/ms-playwright/chromium-*`. On Linux this prompts for sudo to install OS-level deps — expected.

**Step 2: Verify**

```bash
ls ~/.cache/ms-playwright/ | grep -c chromium
```

Expected: prints `1` (or more if previous Playwright installs left versions behind).

**No commit** — this is per-developer setup.

---

## Task 3: Create playwright.config.js

**Files:**
- Create: `playwright.config.js` (repo root)

**Step 1: Write the config**

Create `playwright.config.js`:

```javascript
// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    headless: true,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

Key choices:
- `testMatch: '**/*.spec.js'` — separates Playwright `.spec.js` files from node-test `.test.js` files, so neither runner picks up the other's.
- `serviceWorkers: 'block'` — prevents a stray service worker from intercepting requests before `page.route()` does.
- `workers: 1` — Playwright tests are sequential. Lets us run a single worker without flakiness concerns; revisit if suite grows.
- `trace: 'retain-on-failure'` — captures trace files for failed tests; invaluable when debugging the OOUI stub.

**Step 2: Verify the config parses**

```bash
npx playwright test --list
```

Expected: lists 0 tests, exits 0. (No `.spec.js` files exist yet.)

A parse error here means the config has a typo — fix and retry before committing.

**Step 3: Commit**

```bash
git add playwright.config.js
git commit -m "build: add playwright.config.js (chromium-only, tests/e2e/)"
```

---

## Task 4: Add npm scripts

**Files:**
- Modify: `package.json`

**Step 1: Read current scripts block**

Open `package.json`. The existing `"scripts"` block contains:

```json
"scripts": {
  "test": "node --test 'tests/**/*.test.js'",
  "build": "node scripts/sync-main.js"
}
```

(Adjacent keys like `"bin"` and `"dependencies"` are unchanged.)

**Step 2: Add `pretest:e2e` and `test:e2e`**

Replace the scripts block with:

```json
"scripts": {
  "test": "node --test 'tests/**/*.test.js'",
  "build": "node scripts/sync-main.js",
  "pretest:e2e": "npm run build",
  "test:e2e": "playwright test"
}
```

`pretest:e2e` runs automatically before `test:e2e` via npm's lifecycle convention — ensures `main.js` is always synced from `core/` before browser tests run.

**Step 3: Verify**

```bash
npx playwright test --list
```

Expected: exits 0, lists 0 tests. (Direct `npm run test:e2e` may exit non-zero with "no tests found" depending on Playwright version — that's expected with an empty suite. Real verification of the full pipeline happens in Phase 4.)

**Step 4: Commit**

```bash
git add package.json
git commit -m "build: add pretest:e2e and test:e2e npm scripts"
```

---

## Phase 1 Done When

- `@playwright/test` and `jquery` are devDependencies (visible in `npm list --depth=0`).
- Chromium is installed locally (visible in `~/.cache/ms-playwright/`).
- `playwright.config.js` exists at the repo root and `npx playwright test --list` exits 0.
- `package.json` defines `pretest:e2e` and `test:e2e` scripts.
- Three new commits on the `userscript-browser-tests` branch.
