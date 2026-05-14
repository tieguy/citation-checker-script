# Fresh prompt rewrite — Phase 5: Wire into worker.js + CLI

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Extract `verifyClaim()` from `cli/verify.js`'s inline composition into `core/worker.js` as a behavior-preserving refactor, then add `verifyClaimAtomized()` alongside it. Wire both into the CLI via `--atomized` / `--no-atomized` flags. End-to-end CLI runs against a real provider produce both code paths.

**Architecture:** `core/worker.js` gains two new exports: `verifyClaim(claim, sourceText, providerConfig, opts?)` (single-pass, legacy) and `verifyClaimAtomized(claim, sourceText, metadata, providerConfig, opts?)` (atomize → verifyAtoms → rollup). Both return `{ verdict, comments, ... }` shaped the same way so the CLI and userscript don't need to branch on shape. A top-level dispatcher `verify(claim, sourceText, metadata, providerConfig, opts?)` selects atomized vs legacy based on `providerConfig.supportsAtomize` and `opts.atomized`. The userscript's `main.js` is rebuilt via `sync-main.js` so it picks up the new exports — but the userscript's *callers* of these functions (the WikipediaSourceVerifier class methods) are NOT touched, per the `feedback_ui_changes_require_discussion` memory.

**Tech Stack:** Same. The CLI keeps `parseArgs` from `node:util`; new flags are additive.

**Scope:** Phase 5 of 6.

**Codebase verified:** 2026-05-14. The CLI inlines verification in `cli/verify.js`. Imports from `core/`: `extractClaimText`, `extractReferenceUrl`, `extractPageNumber`, `fetchSourceContent`, `logVerification`, `generateLegacySystemPrompt`, `generateLegacyUserPrompt` (renamed in Phase 2), `callProviderAPI`, `parseVerificationResult`. After this phase, the CLI imports `verify` (the dispatcher) instead of `generateLegacy*` + `callProviderAPI` + `parseVerificationResult`. The Phase 2 legacy stubs in `core/prompts.js` are **removed** in this phase since nothing else imports them.

**Metadata wiring:** `verifyClaimAtomized()` expects `metadata` as a separate argument so provenance atoms can be verified against it. But `core/citoid.js`'s `augmentWithCitoid()` currently returns only the prepended string — the structured metadata object is computed internally and discarded. Task 1 of this phase adds a sibling helper to surface that structured object so callers (CLI + benchmark) can thread it through. **Without this, every provenance atom would verify as not_supported** even when citoid has data, polluting Phase 6's smoke run.

---

## Task 1: Surface structured Citoid metadata for metadata-aware callers

**Files:**
- Modify: `core/citoid.js`

**Step 1: Add a sibling `augmentWithCitoidStructured` export**

Append to `core/citoid.js` (after the existing `augmentWithCitoid` export):

```js
/**
 * Like augmentWithCitoid, but returns the structured metadata block
 * alongside the augmented sourceText so callers can pass metadata into
 * the atomized verifier's provenance-atom path.
 *
 * @param {string} sourceText
 * @param {string} sourceUrl
 * @param {object} [opts]
 * @returns {Promise<{ sourceText: string, metadata: object | null }>}
 */
export async function augmentWithCitoidStructured(sourceText, sourceUrl, opts = {}) {
    const citoidData = await fetchCitoidMetadata(sourceUrl, opts);
    if (!citoidData) return { sourceText, metadata: null };
    const header = buildCitoidHeader(citoidData, sourceUrl);
    if (!header) return { sourceText, metadata: null };
    return {
        sourceText: prependMetadataHeader(header, sourceText),
        metadata: header,
    };
}
```

(Note: this function reuses the existing `fetchCitoidMetadata`, `buildCitoidHeader`, and `prependMetadataHeader` exports — all confirmed present in `core/citoid.js`.)

**Step 2: Write a test**

Append to `tests/citoid.test.js` (or whichever test file currently covers citoid.js — `grep -l "augmentWithCitoid" tests/`):

```js
import { augmentWithCitoidStructured } from '../core/citoid.js';

test('augmentWithCitoidStructured returns { sourceText, metadata } shape', async () => {
  const mock = mockFetch(async (url) => {
    if (url.includes('/api/rest_v1/data/citation/')) {
      return {
        ok: true,
        json: async () => ([{
          publicationTitle: 'Example Publication',
          date: '2026-05-08',
          title: 'Example Article',
        }]),
      };
    }
    throw new Error('unexpected URL: ' + url);
  });
  try {
    const result = await augmentWithCitoidStructured(
      'the original source body',
      'https://example.com/doc'
    );
    assert.equal(typeof result.sourceText, 'string');
    assert.ok(result.sourceText.includes('"publication": "Example Publication"'));
    assert.ok(result.sourceText.includes('the original source body'));
    assert.equal(typeof result.metadata, 'object');
    assert.equal(result.metadata.publication, 'Example Publication');
    assert.equal(result.metadata.published, '2026-05-08');
  } finally {
    mock.restore();
  }
});

test('augmentWithCitoidStructured returns metadata=null when citoid fails', async () => {
  const mock = mockFetch(async () => ({ ok: false, json: async () => ({}) }));
  try {
    const result = await augmentWithCitoidStructured('body', 'https://example.com/doc');
    assert.equal(result.sourceText, 'body');
    assert.equal(result.metadata, null);
  } finally {
    mock.restore();
  }
});
```

Use the same `mockFetch` pattern as `tests/worker.test.js`.

**Step 3: Run**

Run: `npm test -- --test-name-pattern="augmentWithCitoidStructured"`
Expected: 2 tests passing.

Run: `npm run build`
Expected: success.

---

## Task 2: Extract `verifyClaim()` to `core/worker.js`

**Files:**
- Modify: `core/worker.js`
- Read: `cli/verify.js` (to identify the inline composition)

**Step 1: Identify the existing inline flow in `cli/verify.js`**

Run: `grep -n "callProviderAPI\|generateLegacy" cli/verify.js`

The inline flow is approximately:
```js
const systemPrompt = generateLegacySystemPrompt();
const userPrompt = generateLegacyUserPrompt(claim, sourceText);
const apiResult = await callProviderAPI(provider, { ...config, systemPrompt, userContent: userPrompt, ... });
const parsed = parseVerificationResult(apiResult.text);
```

This composition becomes the body of the new `verifyClaim()` function in `core/worker.js`.

**Step 2: Add `verifyClaim()` to `core/worker.js`**

Append to `core/worker.js`:

```js
// === Verification orchestration ===
//
// Two paths into one return shape:
//   verifyClaim()          — single-pass (legacy). One LLM call.
//   verifyClaimAtomized()  — atomize → verifyAtoms → rollup. 2+N LLM calls.
//
// Both return { verdict, comments, confidence?, atoms?, atomResults?, ... }
// so callers don't have to branch on shape. `verify()` is the dispatcher.

import { callProviderAPI } from './providers.js';
import {
    generateLegacySystemPrompt,
    generateLegacyUserPrompt,
} from './prompts.js';
import { parseVerificationResult } from './parsing.js';
import { atomize } from './atomize.js';
import { verifyAtoms } from './verify-atoms.js';
import { rollup } from './rollup.js';

/**
 * Single-pass verification (legacy single-call path).
 *
 * @param {string} claim
 * @param {string} sourceText
 * @param {object} providerConfig — PROVIDERS[name] entry
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{verdict, comments, confidence}>}
 */
export async function verifyClaim(claim, sourceText, providerConfig, opts = {}) {
    const systemPrompt = generateLegacySystemPrompt();
    const userPrompt = generateLegacyUserPrompt(claim, sourceText);
    const apiResult = await callProviderAPI(providerConfig.type, {
        ...providerConfig,
        systemPrompt,
        userContent: userPrompt,
        signal: opts.signal,
    });
    const parsed = parseVerificationResult(apiResult.text);
    return {
        verdict: parsed.verdict,
        comments: parsed.comments ?? '',
        confidence: parsed.confidence,
    };
}

/**
 * Atomized verification.
 *
 * @param {string} claim
 * @param {string} sourceText
 * @param {object|null} metadata — citoid metadata, when available
 * @param {object} providerConfig
 * @param {object} [opts]
 * @param {string} [opts.claimContainer] — surrounding sentence/paragraph for
 *   fragmentary claim_text (from dataset.row.claim_container). Threaded to
 *   atomize() as context-only.
 * @param {boolean} [opts.useSmallAtomizer] — opt into providerConfig.smallModel for atomize()
 * @param {'deterministic'|'judge'} [opts.rollupMode] — defaults 'deterministic'
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{verdict, comments, atoms, atomResults, rollupMode, judgeReasoning?}>}
 */
export async function verifyClaimAtomized(claim, sourceText, metadata, providerConfig, opts = {}) {
    const rollupMode = opts.rollupMode ?? 'deterministic';

    const atoms = await atomize(claim, providerConfig, {
        claimContainer: opts.claimContainer,
        useSmallModel: opts.useSmallAtomizer,
        signal: opts.signal,
    });

    const atomResults = await verifyAtoms(atoms, sourceText, metadata, providerConfig, {
        signal: opts.signal,
    });

    const rolled = await rollup(atoms, atomResults, rollupMode, providerConfig, {
        signal: opts.signal,
        claim,
    });

    return {
        verdict: rolled.verdict,
        comments: rolled.comments,
        atoms,
        atomResults,
        rollupMode,
        ...(rolled.judgeReasoning ? { judgeReasoning: rolled.judgeReasoning } : {}),
    };
}

/**
 * Top-level dispatcher. Selects atomized vs legacy.
 *
 * @param {string} claim
 * @param {string} sourceText
 * @param {object|null} metadata
 * @param {object} providerConfig
 * @param {object} [opts]
 * @param {boolean} [opts.atomized] — defaults true when providerConfig.supportsAtomize
 * @param {'deterministic'|'judge'} [opts.rollupMode]
 * @param {boolean} [opts.useSmallAtomizer]
 * @param {string} [opts.claimContainer] — surrounding sentence/paragraph context;
 *   passed to verifyClaimAtomized() and ignored by verifyClaim().
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{verdict, comments, ...}>}
 */
export async function verify(claim, sourceText, metadata, providerConfig, opts = {}) {
    const wantAtomized = opts.atomized !== undefined
        ? opts.atomized
        : providerConfig.supportsAtomize !== false;
    if (wantAtomized) {
        return await verifyClaimAtomized(claim, sourceText, metadata, providerConfig, opts);
    }
    return await verifyClaim(claim, sourceText, providerConfig, opts);
}
```

**Step 3: Write tests for `verifyClaim` and `verifyClaimAtomized`**

Add to `tests/worker.test.js`:

```js
import { verifyClaim, verifyClaimAtomized, verify } from '../core/worker.js';

test('verifyClaim returns parsed verdict from single LLM call', async () => {
  // verifyClaim uses callProviderAPI internally; mock via globalThis.fetch.
  // parseVerificationResult (core/parsing.js) expects JSON of the shape
  // { verdict, confidence, comments }. The mock must return JSON in
  // Anthropic's content[].text envelope.
  const mock = mockFetch(async (url) => {
    if (url.includes('anthropic.com')) {
      return {
        ok: true,
        json: async () => ({
          content: [{
            text: JSON.stringify({
              verdict: 'SUPPORTED',
              confidence: 'high',
              comments: 'matches body',
            }),
          }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      };
    }
    throw new Error('unexpected URL: ' + url);
  });
  try {
    const result = await verifyClaim(
      'The dam is 95m tall.',
      'The dam stands 95 meters tall.',
      { type: 'claude', model: 'claude-sonnet-4-5', apiKey: 'test' }
    );
    assert.equal(result.verdict, 'SUPPORTED');
    assert.equal(result.confidence, 'high');
    assert.equal(result.comments, 'matches body');
  } finally {
    mock.restore();
  }
});

test('verifyClaimAtomized end-to-end against mocked transport for both calls', async () => {
  // The atomized path uses opts.transport injection (set on atomize, verifyAtoms,
  // rollup individually). Easier than mocking fetch since these aren't HTTP-shaped.
  // verifyClaimAtomized doesn't currently accept a transport override directly —
  // we test via globalThis.fetch since callProviderAPI is the default transport
  // inside atomize/verifyAtoms.
  const responses = [
    // Atomizer call
    JSON.stringify({
      content: [{ text: JSON.stringify({
        atoms: [{ id: 'a1', assertion: 'The dam is 95m tall.', kind: 'content' }],
      }) }],
    }),
    // Verifier call (one atom)
    JSON.stringify({
      content: [{ text: JSON.stringify({ verdict: 'supported', evidence: 'matches body' }) }],
    }),
  ];
  let i = 0;
  const mock = mockFetch(async () => ({ ok: true, json: async () => JSON.parse(responses[i++]) }));
  try {
    const result = await verifyClaimAtomized(
      'The dam is 95m tall.',
      'The dam stands 95 meters tall.',
      null,
      { type: 'claude', model: 'claude-sonnet-4-5', apiKey: 'test' }
    );
    assert.equal(result.verdict, 'SUPPORTED');
    assert.equal(result.atoms.length, 1);
    assert.equal(result.atomResults.length, 1);
    assert.equal(result.atomResults[0].verdict, 'supported');
    assert.equal(result.rollupMode, 'deterministic');
  } finally {
    mock.restore();
  }
});
```

**Step 4: Run sync + tests**

Run: `npm run build`
Run: `npm test -- --test-name-pattern="verifyClaim|verifyClaimAtomized"`
Expected: tests pass.

---

## Task 3: Update `cli/verify.js` to use the dispatcher

**Files:**
- Modify: `cli/verify.js`

**Step 1: Update imports**

Read the current imports (around lines 6-13). The CLI currently imports:
- `extractClaimText` from `../core/claim.js`
- `extractReferenceUrl, extractPageNumber` from `../core/urls.js`
- `fetchSourceContent, logVerification` from `../core/worker.js`
- `generateLegacySystemPrompt, generateLegacyUserPrompt` from `../core/prompts.js`
- `callProviderAPI` from `../core/providers.js`
- `parseVerificationResult` from `../core/parsing.js`

Replace the prompt/provider/parsing imports with:
- `verify, fetchSourceContent, logVerification` from `../core/worker.js`
- `PROVIDERS` from `../core/providers.js`

Final imports section:
```js
import { parseArgs } from 'node:util';
import { JSDOM } from 'jsdom';
import { extractClaimText } from '../core/claim.js';
import { extractReferenceUrl, extractPageNumber } from '../core/urls.js';
import { verify, fetchSourceContent, logVerification } from '../core/worker.js';
import { PROVIDERS } from '../core/providers.js';
import { augmentWithCitoidStructured } from '../core/citoid.js';
```

The legacy prompt + parsing + callProviderAPI imports are removed because they're now encapsulated inside `verify()`. `augmentWithCitoidStructured` (Task 1) is added so the CLI can thread structured metadata into `verify()`'s atomized path.

**Step 2: Update `parseCliArgs` to accept new flags**

Find `parseArgs(...)` in `cli/verify.js`. Extend the `options` object:

```js
const { values, positionals } = parseArgs({
    args: raw,
    options: {
        provider:           { type: 'string', default: 'huggingface' },
        'no-log':           { type: 'boolean', default: false },
        atomized:           { type: 'boolean', default: true },
        'no-atomized':      { type: 'boolean', default: false },
        'rollup-mode':      { type: 'string', default: 'deterministic' },
        'use-small-atomizer': { type: 'boolean', default: false },
        help:               { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
    strict: true,
});
```

Add to the returned parsed-args object (after the existing fields):
```js
return {
    subcommand: positionals[0],
    url: positionals[1],
    citationNumber: positionals[2],
    provider: values.provider,
    noLog: values['no-log'],
    atomized: values['no-atomized'] ? false : values.atomized,
    rollupMode: values['rollup-mode'],
    useSmallAtomizer: values['use-small-atomizer'],
};
```

**Step 3: Update `runVerify` to use the dispatcher and thread metadata**

Find the verification block in `runVerify()` (somewhere after `fetchSourceContent` and before `logVerification`). The CLI's current flow calls `fetchSourceContent` with `augment: true` (the default) — which means the returned `sourceText` already has a citoid metadata header prepended, but the structured metadata is discarded inside `augmentWithCitoid`. We need both.

Refactor: change the source-fetch step to do a 2-step pull — fetch the raw body via `fetchSourceContent` with `augment: false`, then call `augmentWithCitoidStructured` separately so we keep both the augmented text AND the structured metadata.

Replace the prior single fetch + verification block with:

```js
// Fetch raw body (no Citoid augmentation yet; we want the structured metadata separately).
const rawFetch = await fetchSourceContent(sourceUrl, pageNumber, { augment: false });
if (rawFetch === null) {
    console.error('Failed to fetch source content');
    process.exit(7);
}
if (typeof rawFetch === 'object' && rawFetch.sourceUnavailable) {
    console.error(`Source unavailable: ${rawFetch.reason}`);
    process.exit(7);
}
// rawFetch is a string in the "Source URL: ...\n\nSource Content:\n<body>" shape.

// Augment with structured Citoid metadata.
const { sourceText: augmentedText, metadata } = await augmentWithCitoidStructured(
    rawFetch,
    sourceUrl
);

// Resolve provider config from the centralized registry.
const providerConfig = PROVIDERS[args.provider];
if (!providerConfig) {
    console.error(`Unknown provider: ${args.provider}. Known: ${Object.keys(PROVIDERS).join(', ')}`);
    process.exit(2);
}
// Inject API key from environment per the provider entry's keyEnv.
const apiKey = providerConfig.keyEnv ? process.env[providerConfig.keyEnv] : undefined;
if (providerConfig.requiresKey && !apiKey) {
    console.error(`Missing API key: set ${providerConfig.keyEnv}`);
    process.exit(8);
}

const verifyOpts = {
    atomized: args.atomized,
    rollupMode: args.rollupMode,
    useSmallAtomizer: args.useSmallAtomizer,
};
const verifyResult = await verify(
    claimText,
    augmentedText,
    metadata,    // structured metadata for provenance atoms; null when citoid had no data
    { ...providerConfig, apiKey },
    verifyOpts
);
```

Then update the result-printing block to use `verifyResult.verdict`, `verifyResult.comments`, and (when atomized) `verifyResult.atoms` / `verifyResult.atomResults`.

**Note about return-shape change of `fetchSourceContent`:** `fetchSourceContent` already may return `{ sourceUnavailable: true, reason }` (added by the body-classifier commits). Handle this explicitly above. The new step here is `augment: false` to defer Citoid augmentation; the body-classifier path is unchanged.

**Step 4: Update the help output**

Add the new flags to the `--help` output in `cli/verify.js`. Run `grep -n "Usage:" cli/verify.js` to find the help text. Add lines like:

```
  --atomized              Use the atomized verification pipeline (default).
  --no-atomized           Use the legacy single-pass path.
  --rollup-mode MODE      'deterministic' (default) or 'judge'.
  --use-small-atomizer    Use providerConfig.smallModel for atomize() call.
```

---

## Task 4: Remove the legacy prompt stubs from Phase 2

**Files:**
- Modify: `core/prompts.js` (remove `generateLegacySystemPrompt` + `generateLegacyUserPrompt`)
- Modify: `benchmark/run_benchmark.js` (was using the legacy stubs from Phase 2)
- Modify: `tests/benchmark_prompt_unification.test.js`

**Step 1: Update `benchmark/run_benchmark.js`**

Replace the `generateLegacy*` usage in `benchmark/run_benchmark.js` with the `verify()` dispatcher. This is structurally similar to the CLI change, including the metadata-threading.

Find the existing Citoid augmentation block (added by the citoid-defuddle-combined branch in `benchmark/run_benchmark.js`):

```js
const augmentEnabled = process.env.CITOID_AUGMENT !== '0';
const sourceText = augmentEnabled
    ? await augmentWithCitoid(entry.source_text, entry.source_url)
    : entry.source_text;
```

Replace with the structured variant:

```js
const augmentEnabled = process.env.CITOID_AUGMENT !== '0';
const { sourceText, metadata } = augmentEnabled
    ? await augmentWithCitoidStructured(entry.source_text, entry.source_url)
    : { sourceText: entry.source_text, metadata: null };
```

Update the import at the top: `import { augmentWithCitoidStructured } from '../core/citoid.js';` (or modify the existing `augmentWithCitoid` import).

Then where the inline composition calls `callProviderAPI`, replace with:

```js
const verifyResult = await verify(
    entry.claim_text,
    sourceText,
    metadata,   // structured citoid metadata for provenance atoms
    { ...PROVIDERS[provider], apiKey: <env-var lookup per PROVIDERS[provider].keyEnv> },
    {
        atomized: false,                       // Phase 5 keeps benchmark on legacy path; Phase 6 adds --atomized
        claimContainer: entry.claim_container, // present on every dataset row; threaded so Phase 6's atomized path uses it
    }
);
```

**Step 2: Remove the legacy exports from `core/prompts.js`**

In `core/prompts.js`, remove the two `export function generateLegacy*` definitions.

**Step 3: Update `tests/benchmark_prompt_unification.test.js`**

The test was about the CLI and benchmark agreeing on prompt text. Now both go through `verify()` from `core/worker.js`. The test can be:
- Rewritten to assert both call paths go through `verify()` and pass the same arguments (e.g., via a shared mock of `core/worker.js`)
- OR simply deleted if it's no longer meaningful (both call sites converge on `verify()` so unification is structural, not textual)

Choose: delete the test for now. Add a TODO in this plan's Phase 6 notes if the user wants similar coverage at the atomized layer.

Run: `[ -f tests/benchmark_prompt_unification.test.js ] && git rm tests/benchmark_prompt_unification.test.js || echo "test already absent"`

(The file may or may not exist depending on what's accumulated in the cherry-picks; this guarded form is idempotent.)

**Step 4: Build + tests**

Run: `npm run build`
Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: pass = tests; fail = 0.

---

## Task 5: End-to-end CLI smoke against a real provider

This is an operational check, not a test commit. The user runs it manually.

**Step 1: Smoke command (atomized path)**

```bash
ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" npx ccs verify \
    'https://en.wikipedia.org/wiki/Hoover_Dam' \
    1 \
    --provider=claude-sonnet-4-5 \
    --atomized \
    --rollup-mode=deterministic
```

Expected: exits 0, prints a verdict (likely SUPPORTED or PARTIALLY SUPPORTED), and the output mentions atoms (since `--atomized` was used).

**Step 2: Smoke command (legacy path)**

```bash
ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" npx ccs verify \
    'https://en.wikipedia.org/wiki/Hoover_Dam' \
    1 \
    --provider=claude-sonnet-4-5 \
    --no-atomized
```

Expected: exits 0, prints a verdict, no atoms output.

**Step 3: Build check**

Run: `npm run build -- --check`
Expected: `main.js in sync with core/`.

---

## Task 6: Commit

**Step 1: Stage**

```bash
git add core/citoid.js core/worker.js core/prompts.js cli/verify.js \
        benchmark/run_benchmark.js \
        tests/citoid.test.js tests/worker.test.js main.js
```

The `git rm tests/benchmark_prompt_unification.test.js` step (Task 4) already stages the deletion if the file existed.

**Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
core/worker: add verifyClaim, verifyClaimAtomized, verify dispatcher

- verifyClaim(claim, sourceText, providerConfig, opts) — legacy single-pass
  verification extracted from cli/verify.js's inline composition. Returns
  { verdict, comments, confidence }.
- verifyClaimAtomized(claim, sourceText, metadata, providerConfig, opts)
  — orchestrates atomize → verifyAtoms → rollup. Returns { verdict,
  comments, atoms, atomResults, rollupMode, judgeReasoning? }. Both
  return shapes are compatible — both have verdict + comments — so
  callers can use either without branching.
- verify(claim, sourceText, metadata, providerConfig, opts) — top-level
  dispatcher. opts.atomized (default = providerConfig.supportsAtomize)
  selects atomized vs legacy. opts.rollupMode chooses deterministic vs
  judge.
- cli/verify.js refactored to use verify() instead of inline
  generateLegacy* + callProviderAPI + parseVerificationResult.
  New flags: --atomized / --no-atomized (default --atomized),
  --rollup-mode {deterministic|judge}, --use-small-atomizer.
- benchmark/run_benchmark.js refactored to use verify() with
  --atomized=false for now; Phase 6 adds the --atomized flag and
  surfaces atoms in results.json.
- core/prompts.js: generateLegacySystemPrompt and
  generateLegacyUserPrompt deleted — verify() encapsulates them
  (still inlined into verifyClaim).
- tests/benchmark_prompt_unification.test.js removed — both CLI and
  benchmark now go through verify(); textual unification is structural.

Tests: 265+/265+ passing. main.js in sync.
EOF
)"
```

**Step 3: Verify**

Run: `git log -1 --stat`
Expected: ~6 files changed.

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: pass = tests; fail = 0.

---

**Phase 5 done when:**
- `npm test` passes (265+ tests, 0 failures)
- `npm run build -- --check` exits 0
- `core/worker.js` exports `verifyClaim`, `verifyClaimAtomized`, `verify` (plus the existing `fetchSourceContent`, `logVerification`)
- `cli/verify.js` parses `--atomized` / `--no-atomized` / `--rollup-mode` / `--use-small-atomizer` and routes through `verify()`
- `core/prompts.js` no longer exports `generateLegacy*`
- `npx ccs verify <wikipedia-url> <citation-number> --provider=claude-sonnet-4-5 --atomized` exits 0 and produces a verdict (manual operational check)
- `npx ccs verify <wikipedia-url> <citation-number> --provider=claude-sonnet-4-5 --no-atomized` exits 0 (manual operational check)
