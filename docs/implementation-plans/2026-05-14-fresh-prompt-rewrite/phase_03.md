# Fresh prompt rewrite — Phase 3: atomize() + verifyAtoms() pipeline

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Fill in the `atomize()` and `verifyAtoms()` skeletons with real implementations. Cover JSON parsing + graceful-degradation fallback, bounded concurrency, transport injection for testability, and per-atom error sentinels.

**Architecture:** Both functions follow a transport-injection pattern so tests can substitute deterministic responses without monkey-patching `globalThis.fetch`. Default transport is `callProviderAPI` from `core/providers.js`. `atomize` returns `Atom[]`; on malformed-JSON output, falls back to a single content atom containing the full claim verbatim (degrades to single-pass-equivalent). `verifyAtoms` fans out via `Promise.allSettled` with a bounded-concurrency wrapper; per-atom failures surface as `{atomId, verdict: 'not_supported', error: '...'}` rather than rejecting the whole call.

**Tech Stack:** Node.js ES modules; native `Promise.allSettled`; AbortController. No new dependencies.

**Scope:** Phase 3 of 6.

**Codebase verified:** 2026-05-14. `tests/worker.test.js` uses the `mockFetch` pattern (intercept `globalThis.fetch`). For per-provider transport mocking, we'll prefer a function-argument injection pattern (`opts.transport`) so unit tests don't have to know about HTTP shapes. Both styles coexist — `mockFetch` covers integration tests; `opts.transport` covers unit tests.

---

## Task 1: Define the shared transport interface in `core/atomize.js`

**Files:**
- Modify: `core/atomize.js` (currently a skeleton from Phase 1)

**Step 1: Add the transport docstring**

Replace the file contents:

```js
// Stage 1 of the atomized verification pipeline. Splits a compound claim
// into discrete verifiable assertions ("atoms"), each tagged as either
// content (verified against the source body) or provenance (verified
// against citoid metadata).
//
// Atom = { id: string, assertion: string, kind: 'content' | 'provenance' }
//
// Transport contract (for opts.transport):
//   transport(providerConfig, { systemPrompt, userPrompt, signal, model? })
//     → Promise<{ text: string, usage?: object }>
//
// Default transport is callProviderAPI from core/providers.js, wrapped
// so it returns the same shape regardless of upstream API. Tests can
// inject a synchronous fake.

import { callProviderAPI } from './providers.js';
import {
    generateAtomizerSystemPrompt,
    generateAtomizerUserPrompt,
} from './prompts.js';

const DEFAULT_MAX_TOKENS = 1024;

async function defaultTransport(providerConfig, { systemPrompt, userPrompt, signal, model }) {
    const callConfig = {
        ...providerConfig,
        model: model ?? providerConfig.model,
        systemPrompt,
        userContent: userPrompt,
        maxTokens: DEFAULT_MAX_TOKENS,
        signal,
    };
    return await callProviderAPI(providerConfig.type, callConfig);
}

/**
 * Decompose a claim into atoms.
 *
 * @param {string} claim
 * @param {object} providerConfig — a PROVIDERS[name] entry from core/providers.js
 * @param {object} [opts]
 * @param {string} [opts.claimContainer] — surrounding sentence/paragraph context
 *   (load-bearing for fragmentary claim_text from mid-sentence citations).
 *   When provided and different from `claim`, threaded to the atomizer prompt
 *   as context-only.
 * @param {boolean} [opts.useSmallModel] — opt into providerConfig.smallModel
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.transport] — test-injection hook
 * @returns {Promise<Array<{id: string, assertion: string, kind: 'content'|'provenance'}>>}
 */
export async function atomize(claim, providerConfig, opts = {}) {
    const transport = opts.transport ?? defaultTransport;
    const model = opts.useSmallModel && providerConfig.smallModel
        ? providerConfig.smallModel
        : providerConfig.model;

    const systemPrompt = generateAtomizerSystemPrompt();
    const userPrompt = generateAtomizerUserPrompt(claim, opts.claimContainer);

    let response;
    try {
        response = await transport(providerConfig, {
            systemPrompt,
            userPrompt,
            signal: opts.signal,
            model,
        });
    } catch (e) {
        // Transport error (network, 429, etc.) — propagate. Caller decides
        // whether to retry or surface up.
        throw e;
    }

    const text = response?.text ?? '';
    const atoms = parseAtomsResponse(text);
    if (atoms === null) {
        // Malformed JSON or wrong shape — degrade gracefully to a single
        // content atom containing the full claim. Downstream pipeline
        // still produces a meaningful verdict (atom-count of 1 is the
        // single-pass-equivalent case).
        return [{ id: 'a1', assertion: claim, kind: 'content' }];
    }
    return atoms;
}

// Exported for unit testing only.
export function parseAtomsResponse(text) {
    if (!text || typeof text !== 'string') return null;

    // Models sometimes wrap JSON in markdown fences; strip them.
    const cleaned = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        return null;
    }

    if (!parsed || !Array.isArray(parsed.atoms)) return null;

    const atoms = parsed.atoms.filter(a =>
        a && typeof a.id === 'string'
          && typeof a.assertion === 'string'
          && (a.kind === 'content' || a.kind === 'provenance')
    );
    if (atoms.length === 0) return null;
    return atoms;
}
```

**Step 2: Run the existing smoke test, expect it to still pass**

Run: `npm test -- --test-name-pattern="atomize"`
Expected: 1 passing test (the smoke test from Phase 1 — it asserts atomize is exported and either throws or completes; the implementation now completes via the fallback path on empty input).

The Phase 1 smoke test asserted `/not implemented/` — it will FAIL now. We need to update it.

**Step 3: Update the Phase 1 smoke test**

Replace `tests/atomize.test.js` contents (keeps the basic-import smoke, removes the not-implemented assertion):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atomize, parseAtomsResponse } from '../core/atomize.js';

// Imports OK
test('atomize() and parseAtomsResponse() are exported', () => {
  assert.equal(typeof atomize, 'function');
  assert.equal(typeof parseAtomsResponse, 'function');
});
```

The thorough tests come in Task 2.

---

## Task 2: Comprehensive unit tests for `atomize()`

**Files:**
- Modify: `tests/atomize.test.js`

**Step 1: Append tests covering all paths**

Append to `tests/atomize.test.js`:

```js
// === parseAtomsResponse pure-parser tests ===

test('parseAtomsResponse parses well-formed JSON', () => {
  const text = JSON.stringify({
    atoms: [
      { id: 'a1', assertion: 'Foo.', kind: 'content' },
      { id: 'p1', assertion: 'Bar.', kind: 'provenance' },
    ],
  });
  const result = parseAtomsResponse(text);
  assert.equal(result.length, 2);
  assert.equal(result[0].kind, 'content');
});

test('parseAtomsResponse strips markdown code fences', () => {
  const text = '```json\n' + JSON.stringify({
    atoms: [{ id: 'a1', assertion: 'Foo.', kind: 'content' }],
  }) + '\n```';
  const result = parseAtomsResponse(text);
  assert.equal(result.length, 1);
});

test('parseAtomsResponse returns null for malformed JSON', () => {
  assert.equal(parseAtomsResponse('this is not json'), null);
  assert.equal(parseAtomsResponse(''), null);
  assert.equal(parseAtomsResponse(null), null);
  assert.equal(parseAtomsResponse(undefined), null);
});

test('parseAtomsResponse returns null when atoms array is missing or empty', () => {
  assert.equal(parseAtomsResponse('{}'), null);
  assert.equal(parseAtomsResponse('{"atoms": []}'), null);
  assert.equal(parseAtomsResponse('{"atoms": "not an array"}'), null);
});

test('parseAtomsResponse filters out atoms with wrong kind', () => {
  const text = JSON.stringify({
    atoms: [
      { id: 'a1', assertion: 'Good.', kind: 'content' },
      { id: 'bad', assertion: 'Bad.', kind: 'invalid' },
    ],
  });
  const result = parseAtomsResponse(text);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'a1');
});

// === atomize end-to-end with mocked transport ===

function fakeTransport(textResponse) {
  return async () => ({ text: textResponse });
}

test('atomize returns parsed atoms for well-formed model output', async () => {
  const transport = fakeTransport(JSON.stringify({
    atoms: [
      { id: 'p1', assertion: 'Published in The Guardian.', kind: 'provenance' },
      { id: 'a1', assertion: 'The dam is 95m tall.', kind: 'content' },
    ],
  }));
  const result = await atomize('In 2019 The Guardian reported the dam is 95m tall.', {
    type: 'claude',
    model: 'claude-sonnet-4-5',
  }, { transport });
  assert.equal(result.length, 2);
  assert.equal(result[0].kind, 'provenance');
  assert.equal(result[1].kind, 'content');
});

test('atomize falls back to single-atom on malformed JSON', async () => {
  const transport = fakeTransport('not json at all');
  const claim = 'A compound claim about something.';
  const result = await atomize(claim, { type: 'claude', model: 'm' }, { transport });
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, 'content');
  assert.equal(result[0].assertion, claim);
  assert.equal(result[0].id, 'a1');
});

test('atomize uses smallModel when useSmallModel is true', async () => {
  let receivedModel = null;
  const transport = async (_pc, { model }) => {
    receivedModel = model;
    return { text: '{"atoms":[{"id":"a1","assertion":"x","kind":"content"}]}' };
  };
  await atomize('claim', {
    type: 'claude',
    model: 'claude-sonnet-4-5',
    smallModel: 'claude-haiku-4-5-20251001',
  }, { transport, useSmallModel: true });
  assert.equal(receivedModel, 'claude-haiku-4-5-20251001');
});

test('atomize uses main model when useSmallModel is false', async () => {
  let receivedModel = null;
  const transport = async (_pc, { model }) => {
    receivedModel = model;
    return { text: '{"atoms":[{"id":"a1","assertion":"x","kind":"content"}]}' };
  };
  await atomize('claim', {
    type: 'claude',
    model: 'main-model',
    smallModel: 'small-model',
  }, { transport });
  assert.equal(receivedModel, 'main-model');
});

test('atomize propagates transport errors', async () => {
  const transport = async () => { throw new Error('transport-failed'); };
  await assert.rejects(
    () => atomize('claim', { type: 'claude', model: 'm' }, { transport }),
    /transport-failed/
  );
});

test('atomize threads opts.claimContainer to the user prompt', async () => {
  let receivedUserPrompt = null;
  const transport = async (_pc, { userPrompt }) => {
    receivedUserPrompt = userPrompt;
    return { text: '{"atoms":[{"id":"a1","assertion":"x","kind":"content"}]}' };
  };
  const claim = 'the LTTE formally joined a common militant front';
  const container = 'In April 1984, the LTTE formally joined a common militant front, the ENLF.';
  await atomize(claim, { type: 'claude', model: 'm' }, {
    transport,
    claimContainer: container,
  });
  assert.ok(receivedUserPrompt.includes(container),
    'container must be threaded to the user prompt');
  assert.match(receivedUserPrompt, /context|surrounding/i,
    'prompt must instruct the model to treat container as context');
});

test('atomize omits container threading when claimContainer is identical to claim', async () => {
  let receivedUserPrompt = null;
  const transport = async (_pc, { userPrompt }) => {
    receivedUserPrompt = userPrompt;
    return { text: '{"atoms":[{"id":"a1","assertion":"x","kind":"content"}]}' };
  };
  const claim = 'A complete sentence.';
  await atomize(claim, { type: 'claude', model: 'm' }, {
    transport,
    claimContainer: claim,
  });
  // No "Container" section in the rendered prompt when claim==container
  assert.doesNotMatch(receivedUserPrompt, /Container.*for context/i);
});
```

**Step 2: Run all atomize tests**

Run: `npm test -- --test-name-pattern="atomize|parseAtomsResponse"`
Expected: 11 tests passing (1 smoke + 5 parser + 5 atomize-e2e).

---

## Task 3: Implement `verifyAtoms()` with bounded concurrency

**Files:**
- Modify: `core/verify-atoms.js`

**Step 1: Replace the skeleton**

```js
// Stage 2 of the atomized verification pipeline. Verifies each atom
// independently against the right slice of input — content atoms against
// the source body, provenance atoms against the citoid metadata block.
//
// AtomResult = { atomId: string, verdict: 'supported' | 'not_supported',
//                evidence?: string, error?: string }
//
// Concurrency: by default each atom is dispatched immediately
// (Promise.all over the array). `opts.concurrency` caps the pool when
// atom counts get large (rate-limit safety).
//
// Failure handling: per-atom errors do NOT reject the whole call.
// They surface as { atomId, verdict: 'not_supported', error } so the
// rollup stage can incorporate partial information.

import { callProviderAPI } from './providers.js';
import {
    generateVerifierSystemPrompt,
    generateVerifierUserPrompt,
} from './prompts.js';

const DEFAULT_MAX_TOKENS = 512;

async function defaultTransport(providerConfig, { systemPrompt, userPrompt, signal }) {
    const callConfig = {
        ...providerConfig,
        systemPrompt,
        userContent: userPrompt,
        maxTokens: DEFAULT_MAX_TOKENS,
        signal,
    };
    return await callProviderAPI(providerConfig.type, callConfig);
}

export function parseAtomResultResponse(text, atomId) {
    if (!text || typeof text !== 'string') {
        return { atomId, verdict: 'not_supported', error: 'empty response' };
    }
    const cleaned = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        return { atomId, verdict: 'not_supported', error: 'unparseable JSON' };
    }
    const verdict = parsed?.verdict;
    if (verdict !== 'supported' && verdict !== 'not_supported') {
        return { atomId, verdict: 'not_supported', error: 'unknown verdict: ' + verdict };
    }
    const result = { atomId, verdict };
    if (typeof parsed.evidence === 'string') result.evidence = parsed.evidence;
    return result;
}

async function verifyOneAtom(atom, sourceText, metadata, providerConfig, transport, signal) {
    try {
        const systemPrompt = generateVerifierSystemPrompt();
        const userPrompt = generateVerifierUserPrompt(atom, sourceText, metadata);
        const response = await transport(providerConfig, {
            systemPrompt,
            userPrompt,
            signal,
        });
        return parseAtomResultResponse(response?.text ?? '', atom.id);
    } catch (e) {
        return {
            atomId: atom.id,
            verdict: 'not_supported',
            error: e?.message ?? String(e),
        };
    }
}

// Simple promise pool — bounded concurrency. Replaces Promise.all() when
// opts.concurrency is set. Standard pattern; no library dependency.
async function runPool(items, concurrency, worker) {
    const results = new Array(items.length);
    let next = 0;
    async function consume() {
        while (true) {
            const i = next++;
            if (i >= items.length) return;
            results[i] = await worker(items[i], i);
        }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, consume);
    await Promise.all(workers);
    return results;
}

/**
 * Verify all atoms against the source.
 *
 * @param {Array} atoms — from atomize()
 * @param {string} sourceText
 * @param {object|null} metadata — citoid bibliographic data; required for provenance atoms
 * @param {object} providerConfig — a PROVIDERS[name] entry
 * @param {object} [opts]
 * @param {number} [opts.concurrency] — bound pool size; default = atoms.length (unbounded)
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.transport]
 * @returns {Promise<Array<{atomId, verdict, evidence?, error?}>>}
 */
export async function verifyAtoms(atoms, sourceText, metadata, providerConfig, opts = {}) {
    const transport = opts.transport ?? defaultTransport;
    const concurrency = opts.concurrency ?? atoms.length;

    return await runPool(atoms, concurrency, async (atom) =>
        verifyOneAtom(atom, sourceText, metadata, providerConfig, transport, opts.signal)
    );
}
```

---

## Task 4: Comprehensive unit tests for `verifyAtoms()`

**Files:**
- Modify: `tests/verify_atoms.test.js`

**Step 1: Replace contents**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyAtoms, parseAtomResultResponse } from '../core/verify-atoms.js';

// === parseAtomResultResponse ===

test('parseAtomResultResponse parses a supported verdict', () => {
  const text = JSON.stringify({ verdict: 'supported', evidence: 'the source says so' });
  const r = parseAtomResultResponse(text, 'a1');
  assert.equal(r.atomId, 'a1');
  assert.equal(r.verdict, 'supported');
  assert.equal(r.evidence, 'the source says so');
});

test('parseAtomResultResponse parses a not_supported verdict', () => {
  const text = JSON.stringify({ verdict: 'not_supported', evidence: 'source contradicts' });
  const r = parseAtomResultResponse(text, 'a1');
  assert.equal(r.verdict, 'not_supported');
});

test('parseAtomResultResponse returns not_supported with error on malformed JSON', () => {
  const r = parseAtomResultResponse('garbage', 'a1');
  assert.equal(r.verdict, 'not_supported');
  assert.match(r.error, /unparseable JSON/);
});

test('parseAtomResultResponse returns not_supported with error on unknown verdict', () => {
  const text = JSON.stringify({ verdict: 'maybe' });
  const r = parseAtomResultResponse(text, 'a1');
  assert.equal(r.verdict, 'not_supported');
  assert.match(r.error, /unknown verdict/);
});

test('parseAtomResultResponse strips markdown fences', () => {
  const text = '```json\n' + JSON.stringify({ verdict: 'supported' }) + '\n```';
  const r = parseAtomResultResponse(text, 'a1');
  assert.equal(r.verdict, 'supported');
});

// === verifyAtoms end-to-end with mocked transport ===

function recordingTransport(responsesByOrder) {
  let i = 0;
  const calls = [];
  return {
    calls,
    transport: async (pc, { userPrompt }) => {
      calls.push({ userPrompt });
      const r = responsesByOrder[i++] ?? { text: JSON.stringify({ verdict: 'not_supported' }) };
      if (r.throw) throw r.throw;
      return r;
    },
  };
}

test('verifyAtoms makes one call per atom and returns AtomResult[] in order', async () => {
  const atoms = [
    { id: 'a1', assertion: 'A.', kind: 'content' },
    { id: 'a2', assertion: 'B.', kind: 'content' },
    { id: 'p1', assertion: 'C.', kind: 'provenance' },
  ];
  const { calls, transport } = recordingTransport([
    { text: JSON.stringify({ verdict: 'supported' }) },
    { text: JSON.stringify({ verdict: 'not_supported' }) },
    { text: JSON.stringify({ verdict: 'supported' }) },
  ]);
  const results = await verifyAtoms(atoms, 'body', { publication: 'X' }, { type: 'claude', model: 'm' }, { transport });
  assert.equal(calls.length, 3);
  assert.equal(results.length, 3);
  assert.equal(results[0].verdict, 'supported');
  assert.equal(results[1].verdict, 'not_supported');
  assert.equal(results[2].verdict, 'supported');
});

test('verifyAtoms scopes provenance atoms to metadata', async () => {
  const atoms = [
    { id: 'a1', assertion: 'About body.', kind: 'content' },
    { id: 'p1', assertion: 'About publication.', kind: 'provenance' },
  ];
  const { calls, transport } = recordingTransport([
    { text: JSON.stringify({ verdict: 'supported' }) },
    { text: JSON.stringify({ verdict: 'supported' }) },
  ]);
  await verifyAtoms(atoms, 'body content', { publication: 'NYT' }, { type: 'claude', model: 'm' }, { transport });
  // The content atom should reference the source body; the provenance atom should reference metadata
  assert.ok(calls[0].userPrompt.includes('body content'));
  assert.ok(calls[1].userPrompt.includes('NYT'));
});

test('verifyAtoms surfaces per-atom errors as not_supported with error', async () => {
  const atoms = [
    { id: 'a1', assertion: 'A.', kind: 'content' },
    { id: 'a2', assertion: 'B.', kind: 'content' },
  ];
  const { transport } = recordingTransport([
    { text: JSON.stringify({ verdict: 'supported' }) },
    { throw: new Error('429 rate limited') },
  ]);
  const results = await verifyAtoms(atoms, 'body', null, { type: 'claude', model: 'm' }, { transport });
  assert.equal(results.length, 2);
  assert.equal(results[0].verdict, 'supported');
  assert.equal(results[1].verdict, 'not_supported');
  assert.match(results[1].error, /429/);
});

test('verifyAtoms respects bounded concurrency', async () => {
  const atoms = Array.from({ length: 10 }, (_, i) => ({
    id: 'a' + i, assertion: 'A' + i, kind: 'content',
  }));
  let active = 0;
  let maxActive = 0;
  const transport = async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    // Force the pool to actually parallelize
    await new Promise(r => setTimeout(r, 5));
    active--;
    return { text: JSON.stringify({ verdict: 'supported' }) };
  };
  await verifyAtoms(atoms, 'body', null, { type: 'claude', model: 'm' }, { transport, concurrency: 3 });
  assert.ok(maxActive <= 3, `expected max 3 in-flight, observed ${maxActive}`);
});

test('verifyAtoms with no atoms returns empty array (no calls)', async () => {
  const { calls, transport } = recordingTransport([]);
  const results = await verifyAtoms([], 'body', null, { type: 'claude', model: 'm' }, { transport });
  assert.deepEqual(results, []);
  assert.equal(calls.length, 0);
});
```

**Step 2: Run**

Run: `npm test -- --test-name-pattern="verifyAtoms|parseAtomResultResponse"`
Expected: 10 tests passing (5 parser + 5 e2e).

---

## Task 5: End-to-end pipeline smoke test (atomize → verifyAtoms)

**Files:**
- New: `tests/pipeline_smoke.test.js`

**Step 1: Write**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atomize } from '../core/atomize.js';
import { verifyAtoms } from '../core/verify-atoms.js';

test('atomize → verifyAtoms executes end-to-end against mocked transport', async () => {
  // Atomizer response: 2 atoms
  const atomizerTransport = async () => ({
    text: JSON.stringify({
      atoms: [
        { id: 'a1', assertion: 'The dam is 95m tall.', kind: 'content' },
        { id: 'p1', assertion: 'Published in 2019.', kind: 'provenance' },
      ],
    }),
  });

  // Verifier responses: a1 supported (body matches), p1 not_supported (metadata empty)
  const verifyResponses = [
    { text: JSON.stringify({ verdict: 'supported', evidence: 'matches body' }) },
    { text: JSON.stringify({ verdict: 'not_supported', evidence: 'no publication date' }) },
  ];
  let i = 0;
  const verifyTransport = async () => verifyResponses[i++];

  const claim = 'In 2019, the dam stands 95m tall.';
  const providerConfig = { type: 'claude', model: 'claude-sonnet-4-5', smallModel: 'claude-haiku-4-5-20251001' };

  const atoms = await atomize(claim, providerConfig, { transport: atomizerTransport });
  assert.equal(atoms.length, 2);

  const sourceText = 'The dam, completed in 1972, stands 95 meters tall.';
  const metadata = null;
  const results = await verifyAtoms(atoms, sourceText, metadata, providerConfig, { transport: verifyTransport });
  assert.equal(results.length, 2);
  assert.equal(results[0].verdict, 'supported');
  assert.equal(results[1].verdict, 'not_supported');
});
```

**Step 2: Run**

Run: `npm test -- --test-name-pattern="atomize → verifyAtoms"`
Expected: 1 test passing.

---

## Task 6: Build sync + full suite

**Step 1: Rebuild**

Run: `npm run build`
Expected: success.

Run: `npm run build -- --check`
Expected: `main.js in sync with core/`.

**Step 2: Full test run**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: pass = tests; fail = 0. Test count ≥ 240 (Phase 2's 220 + 11 atomize + 10 verifyAtoms + 1 pipeline-smoke − adjustment for replaced Phase 1 smoke tests).

---

## Task 7: Commit

**Step 1: Stage**

```bash
git add core/atomize.js core/verify-atoms.js main.js \
        tests/atomize.test.js tests/verify_atoms.test.js \
        tests/pipeline_smoke.test.js
```

**Step 2: Verify staging**

Run: `git status --short`
Expected: 6 files staged.

**Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
core/atomize + core/verify-atoms: implement Stages 1 & 2 of pipeline

- atomize(claim, providerConfig, opts) — LLM call via injectable
  transport. Parses {atoms: [...]} JSON, strips markdown fences,
  validates each atom's id/assertion/kind shape. On malformed JSON,
  degrades to a single content atom containing the full claim
  (single-pass-equivalent fallback). opts.useSmallModel routes to
  providerConfig.smallModel when set. parseAtomsResponse exported
  for unit testing.
- verifyAtoms(atoms, sourceText, metadata, providerConfig, opts) —
  fans out one call per atom via a bounded-concurrency pool
  (opts.concurrency, default = atoms.length). Content atoms see the
  body; provenance atoms see the metadata block. Per-atom errors
  surface as { verdict: 'not_supported', error } rather than
  rejecting the whole call. parseAtomResultResponse exported for
  unit testing.
- Both functions use an injectable opts.transport so unit tests don't
  monkey-patch globalThis.fetch. Default transport wraps callProviderAPI
  from core/providers.js.
- End-to-end smoke test in tests/pipeline_smoke.test.js executes
  atomize → verifyAtoms against fully-mocked transports.

Tests: 240+/240+ passing. main.js in sync.
EOF
)"
```

**Step 4: Verify**

Run: `git log -1 --stat`
Expected: 6 files changed.

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: pass = tests; fail = 0.

---

**Phase 3 done when:**
- `npm test` passes (240+ tests, 0 failures)
- `npm run build -- --check` exits 0
- `core/atomize.js` implements `atomize()` + `parseAtomsResponse()` with malformed-JSON fallback
- `core/verify-atoms.js` implements `verifyAtoms()` + `parseAtomResultResponse()` with per-atom error sentinels and bounded concurrency
- `tests/pipeline_smoke.test.js` exercises end-to-end atomize → verifyAtoms against mocked transports
- All three skeleton modules' `throw new Error('not implemented')` from Phase 1 have been replaced — `grep "not implemented" core/atomize.js core/verify-atoms.js` returns nothing
