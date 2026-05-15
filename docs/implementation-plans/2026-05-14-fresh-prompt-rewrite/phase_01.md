# Fresh prompt rewrite — Phase 1: Scaffolding + provider config

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Move benchmark's PROVIDERS registry to `core/providers.js` (adding `smallModel` + `supportsAtomize`), create skeleton modules for the atomized pipeline, and land the design doc with the first commit.

**Architecture:** All atomized-pipeline modules live in `core/` so they're shared by userscript, CLI, and benchmark. Provider metadata is centralized in `core/providers.js` (alongside the existing dispatch functions). Skeleton modules throw `not implemented` so the build stays green while later phases fill them in.

**Tech Stack:** Node.js ES modules; `node --test` + `node:assert/strict`; no transpilation; userscript build via `scripts/sync-main.js`.

**Scope:** Phase 1 of 6.

**Codebase verified:** 2026-05-14 against worktree HEAD `649cac7` (openrouter-response-format + body-classifier cherry-picks); 203/203 tests passing; `main.js` in sync.

---

## Task 1: Commit the design plan

**Already done.** The design plan + this implementation plan + their
adjustments from the compound-corpus experiment review were committed
together as a setup commit before Phase 1 execution started.

Verify with: `git log --oneline -1 -- docs/design-plans/`
Expected: a commit at HEAD~ or earlier whose message starts with
`design+plan: fresh prompt rewrite`.

If that commit is not present, halt and ask the operator — the
implementation plan should have been committed before any Phase 1
implementation task began. Do NOT recreate a separate design-doc commit;
it would duplicate the setup commit.

---

## Task 2: Extract PROVIDERS from benchmark to `core/providers.js`

**Files:**
- Modify: `core/providers.js` (currently dispatch-only, 247 lines)
- Modify: `benchmark/run_benchmark.js:45-173` (PROVIDERS object lives here today)

**Step 1: Append PROVIDERS export to `core/providers.js`**

Add at the **end** of `core/providers.js` (after `callProviderAPI`):

```js
// Provider metadata registry. Source of truth for atomized-pipeline
// orchestration (atomize, verifyAtoms, rollup) and for the benchmark
// runner. The userscript (main.js) keeps its own UI-facing registry in
// the WikipediaSourceVerifier constructor — that one carries BYOK key
// names, colors, and display labels. This one carries model IDs and
// the atomized-pipeline knobs (`smallModel`, `supportsAtomize`,
// `responseFormat`).
//
// Conventions:
//   - `smallModel` names the cheap variant for atomizer/judge calls.
//     When unset, the atomizer uses `model`.
//   - `supportsAtomize` defaults true. Flip to false per-provider if
//     Cell 1 vs Cell 2 ablation shows atomizer-quality issues; the
//     dispatcher in core/worker.js will fall back to the single-pass
//     verifier for those.
//   - `responseFormat` is forwarded to the OpenAI-compatible upstream
//     when present. Granite-4.1-8B opts in to JSON-mode this way.
export const PROVIDERS = {
    // <paste the entire object body from benchmark/run_benchmark.js:45-173>
    // For every entry, add:
    //   supportsAtomize: true,
    //   smallModel: <cheap variant per provider; see table below>
};
```

**`smallModel` values to add per provider** (no `smallModel` means atomizer reuses `model`):

| Provider key                       | smallModel                       |
|------------------------------------|----------------------------------|
| `claude-sonnet-4-5`                | `'claude-haiku-4-5-20251001'`    |
| `gemini-2.5-flash`                 | `'gemini-2.5-flash'` *(no smaller variant; same model)* |
| `apertus-70b`                      | *(omit; PublicAI has no smaller variant)* |
| `qwen-sealion`                     | *(omit)*                         |
| `olmo-32b`                         | *(omit)*                         |
| `openrouter-mistral-small-3.2`     | *(omit; treat as no smaller)*    |
| `openrouter-olmo-3.1-32b`          | *(omit)*                         |
| `openrouter-deepseek-v3.2`         | *(omit)*                         |
| `openrouter-granite-4.1-8b`        | *(omit; already small)*          |
| `openrouter-gemma-4-26b-a4b`       | *(omit)*                         |
| `openrouter-qwen-3-32b`            | *(omit)*                         |
| `hf-qwen3-32b`                     | *(omit; allowlist constraint)*   |
| `hf-gpt-oss-20b`                   | *(omit)*                         |
| `hf-deepseek-v3`                   | *(omit)*                         |

Set `supportsAtomize: true` on **every** entry.

**Step 2: Update `benchmark/run_benchmark.js` to import PROVIDERS**

Replace the `const PROVIDERS = { ... }` block at lines 45-173 with:

```js
import { PROVIDERS } from '../core/providers.js';
```

(Move that import up next to the other `../core/` imports at the top of the file.)

Run: `grep -n "^const PROVIDERS" benchmark/run_benchmark.js`
Expected: no match.

Run: `grep -n "PROVIDERS\[" benchmark/run_benchmark.js | head -3`
Expected: at least one match — the existing usage sites still work.

**Step 3: Update `scripts/sync-main.js` if needed**

`core/providers.js` is already in CORE_ORDER at position 6 (`scripts/sync-main.js:16-25`). No change. The new `PROVIDERS` export is a `const` declaration; `sync-main.js` strips the `export` keyword and inlines it, same as the existing exports.

**Step 4: Re-run build sync**

Run: `npm run build`
Expected: `main.js updated` or similar success message.

Run: `npm run build -- --check`
Expected: `main.js in sync with core/`.

---

## Task 3: Verify PROVIDERS extraction with a test

**Files:**
- New: `tests/providers_registry.test.js`

**Step 1: Write the test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS } from '../core/providers.js';

test('PROVIDERS exports a populated registry', () => {
  assert.equal(typeof PROVIDERS, 'object');
  const keys = Object.keys(PROVIDERS);
  assert.ok(keys.length >= 14, `expected at least 14 providers, got ${keys.length}`);
});

test('every PROVIDERS entry has name + model + type + supportsAtomize', () => {
  for (const [key, entry] of Object.entries(PROVIDERS)) {
    assert.equal(typeof entry.name, 'string', `${key}.name`);
    assert.equal(typeof entry.model, 'string', `${key}.model`);
    assert.equal(typeof entry.type, 'string', `${key}.type`);
    assert.equal(typeof entry.supportsAtomize, 'boolean', `${key}.supportsAtomize`);
  }
});

test('claude-sonnet-4-5 has smallModel set to claude-haiku-4-5', () => {
  assert.equal(PROVIDERS['claude-sonnet-4-5'].smallModel, 'claude-haiku-4-5-20251001');
});

test('openrouter-granite-4.1-8b preserves responseFormat', () => {
  const granite = PROVIDERS['openrouter-granite-4.1-8b'];
  assert.deepEqual(granite.responseFormat, { type: 'json_object' });
});
```

**Step 2: Run**

Run: `npm test -- --test-name-pattern="PROVIDERS"`
Expected: 4 tests pass.

---

## Task 4: Create `core/atomize.js` skeleton

**Files:**
- New: `core/atomize.js`

**Step 1: Write the skeleton**

```js
// Stage 1 of the atomized verification pipeline. Splits a compound claim
// into discrete verifiable assertions ("atoms"), each tagged as either
// content (verified against the source body) or provenance (verified
// against citoid metadata).
//
// Atom = { id: string, assertion: string, kind: 'content' | 'provenance' }
//
// Implementation lands in Phase 3.

/**
 * @param {string} claim
 * @param {object} providerConfig — a PROVIDERS[name] entry from core/providers.js
 * @param {object} [opts]
 * @param {string} [opts.claimContainer] — surrounding sentence/paragraph context.
 *   20% of dataset rows are fragmentary (sentence fragments from mid-sentence
 *   citations); when present, the atomizer prompt uses claimContainer as
 *   context-only so reading-comprehension benefits from the surrounding
 *   sentence without expanding the atom set to container-only assertions.
 * @param {boolean} [opts.useSmallModel] — opt into providerConfig.smallModel
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.transport] — test-injection hook; defaults to callProviderAPI
 * @returns {Promise<Array<{id: string, assertion: string, kind: 'content'|'provenance'}>>}
 */
export async function atomize(claim, providerConfig, opts = {}) {
    throw new Error('not implemented: filled in Phase 3');
}
```

**Step 2: Verify import**

Run: `node -e "import('./core/atomize.js').then(m => console.log(Object.keys(m)))"`
Expected: `[ 'atomize' ]`

---

## Task 5: Create `core/verify-atoms.js` skeleton

**Files:**
- New: `core/verify-atoms.js`

**Step 1: Write the skeleton**

```js
// Stage 2 of the atomized verification pipeline. Verifies each atom
// independently against the right slice of input — content atoms against
// the source body, provenance atoms against the citoid metadata block.
//
// AtomResult = { atomId: string, verdict: 'supported' | 'not_supported',
//                evidence?: string, error?: string }
//
// Implementation lands in Phase 3.

/**
 * @param {Array} atoms — from atomize()
 * @param {string} sourceText — Defuddle-extracted body (with citoid header)
 * @param {object|null} metadata — citoid metadata, when available
 * @param {object} providerConfig — a PROVIDERS[name] entry
 * @param {object} [opts]
 * @param {number} [opts.concurrency] — defaults unbounded
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.transport]
 * @returns {Promise<Array<{atomId: string, verdict: string, evidence?: string, error?: string}>>}
 */
export async function verifyAtoms(atoms, sourceText, metadata, providerConfig, opts = {}) {
    throw new Error('not implemented: filled in Phase 3');
}
```

**Step 2: Verify import**

Run: `node -e "import('./core/verify-atoms.js').then(m => console.log(Object.keys(m)))"`
Expected: `[ 'verifyAtoms' ]`

---

## Task 6: Create `core/rollup.js` skeleton

**Files:**
- New: `core/rollup.js`

**Step 1: Write the skeleton**

```js
// Stage 3 of the atomized verification pipeline. Composes per-atom
// verdicts into a single claim-level verdict.
//
// RollupResult = { verdict: 'SUPPORTED' | 'PARTIALLY SUPPORTED' | 'NOT SUPPORTED',
//                  comments: string, judgeReasoning?: string }
//
// Implementation lands in Phase 4.

/**
 * @param {Array} atoms
 * @param {Array} atomResults — from verifyAtoms()
 * @param {'deterministic' | 'judge'} mode
 * @param {object} [providerConfig] — required when mode === 'judge'
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.transport]
 * @returns {Promise<{verdict: string, comments: string, judgeReasoning?: string}>}
 */
export async function rollup(atoms, atomResults, mode, providerConfig, opts = {}) {
    throw new Error('not implemented: filled in Phase 4');
}
```

**Step 2: Verify import**

Run: `node -e "import('./core/rollup.js').then(m => console.log(Object.keys(m)))"`
Expected: `[ 'rollup' ]`

---

## Task 7: Add new modules to `scripts/sync-main.js`

**Files:**
- Modify: `scripts/sync-main.js:16-25` (CORE_ORDER array)

**Step 1: Add three entries to CORE_ORDER**

Insert after `'worker.js'`:

```js
const CORE_ORDER = [
    'prompts.js',
    'parsing.js',
    'urls.js',
    'claim.js',
    'citoid.js',
    'providers.js',
    'body-classifier.js',
    'worker.js',
    'atomize.js',      // NEW
    'verify-atoms.js', // NEW
    'rollup.js',       // NEW
];
```

Ordering rationale: `atomize`, `verify-atoms`, `rollup` depend on `providers` and `worker` — they go after both.

**Step 2: Rebuild and verify**

Run: `npm run build`
Expected: `main.js updated`.

Run: `npm run build -- --check`
Expected: `main.js in sync with core/`.

Run: `grep -c "throw new Error('not implemented" main.js`
Expected: `3` (one per skeleton).

---

## Task 8: Add smoke tests for the three skeleton modules

**Files:**
- New: `tests/atomize.test.js`
- New: `tests/verify_atoms.test.js`
- New: `tests/rollup.test.js`

**Step 1: Write `tests/atomize.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atomize } from '../core/atomize.js';

test('atomize() is exported and throws not-implemented (filled in Phase 3)', async () => {
  await assert.rejects(
    () => atomize('a claim', {}),
    /not implemented/
  );
});
```

**Step 2: Write `tests/verify_atoms.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyAtoms } from '../core/verify-atoms.js';

test('verifyAtoms() is exported and throws not-implemented (filled in Phase 3)', async () => {
  await assert.rejects(
    () => verifyAtoms([], '', null, {}),
    /not implemented/
  );
});
```

**Step 3: Write `tests/rollup.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollup } from '../core/rollup.js';

test('rollup() is exported and throws not-implemented (filled in Phase 4)', async () => {
  await assert.rejects(
    () => rollup([], [], 'deterministic'),
    /not implemented/
  );
});
```

**Step 4: Run the new tests**

Run: `npm test`
Expected: passing count = baseline (203) + 4 (PROVIDERS) + 3 (skeleton smoke) = 210 minimum. Zero failures.

---

## Task 9: Commit the scaffolding

**Step 1: Stage**

```bash
git add core/providers.js core/atomize.js core/verify-atoms.js core/rollup.js \
        benchmark/run_benchmark.js scripts/sync-main.js main.js \
        tests/providers_registry.test.js tests/atomize.test.js \
        tests/verify_atoms.test.js tests/rollup.test.js
```

(Explicit file enumeration per `feedback_explicit_git_add_paths`. Do NOT use `git add .` or `git add core/`.)

**Step 2: Verify staged set**

Run: `git status --short`
Expected: all listed files staged (`M ` or `A `), no others.

**Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
core: scaffolding for atomized verification pipeline

- Move PROVIDERS metadata registry from benchmark/run_benchmark.js to
  core/providers.js. Add smallModel + supportsAtomize fields. Anthropic
  gets claude-haiku-4-5 as smallModel; other providers keep their main
  model (no smaller variant yet).
- Add core/atomize.js, core/verify-atoms.js, core/rollup.js as skeletons
  with throw new Error('not implemented'). Filled in Phases 3 and 4.
- Inline new modules into main.js via sync-main.js's CORE_ORDER.
- Smoke tests covering PROVIDERS shape and skeleton-module imports.

Tests: 210+/210+ passing. main.js in sync.
EOF
)"
```

**Step 4: Verify**

Run: `git log -1 --stat`
Expected: commit listed; ~10 files changed.

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: pass = tests; fail = 0.

Run: `npm run build -- --check`
Expected: `main.js in sync with core/`.

---

**Phase 1 done when:**
- `npm test` passes (210+ tests, 0 failures)
- `npm run build -- --check` exits 0
- `node -e "import('./core/atomize.js')"`, `verify-atoms.js`, `rollup.js` all succeed
- `git log --oneline -3` shows the design-doc commit and the scaffolding commit on top of `649cac7`
- `core/providers.js` exports `PROVIDERS` with all 14 entries plus `smallModel`/`supportsAtomize`
- `benchmark/run_benchmark.js` imports PROVIDERS from `../core/providers.js`
