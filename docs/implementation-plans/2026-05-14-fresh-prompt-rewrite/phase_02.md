# Fresh prompt rewrite — Phase 2: Prompt rendering (atomizer/verifier/judge)

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Replace `core/prompts.js`'s two-function single-call surface with six pure prompt-generation functions for the three-stage atomized pipeline. New few-shot examples target the audit's known failure modes.

**Architecture:** Six pure functions: `generateAtomizerSystemPrompt`, `generateAtomizerUserPrompt(claim)`, `generateVerifierSystemPrompt`, `generateVerifierUserPrompt(atom, sourceText, metadata?)`, `generateJudgeRollupSystemPrompt`, `generateJudgeRollupUserPrompt(claim, atomResults)`. The atomizer emits structured JSON via `responseFormat: { type: 'json_object' }` (already plumbed in `callOpenAICompatibleChat`). Prompts restore structural cues (numbered steps, explicit verdict taxonomy paragraph) to help small instruction-tuned models — the dd13c3d "collapsed paragraph" prompt regressed Granite-4.1-8B by 1.7pp on body-usable rows and that signal informs the rewrite.

**Tech Stack:** Plain JavaScript template literals; no JSON-Schema library; few-shot examples encoded as in-prompt JSON strings.

**Scope:** Phase 2 of 6.

**Codebase verified:** 2026-05-14. Current `core/prompts.js` is 152 lines, exports `generateSystemPrompt` (two-step framing) + `generateUserPrompt(claim, sourceInfo)`. Both are imported by `cli/verify.js`, `benchmark/run_benchmark.js`, and consumed when `main.js` is built. **Both old functions will be removed in this phase** — every caller needs to be updated. Tests for the existing prompts live in `tests/prompts.test.js` and will be replaced.

---

## Task 1: Write the failing test for `generateAtomizerSystemPrompt`

**Files:**
- Modify: `tests/prompts.test.js` (currently tests the to-be-removed `generateSystemPrompt`)

**Step 1: Rewrite the test file**

Replace the entire contents of `tests/prompts.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAtomizerSystemPrompt,
  generateAtomizerUserPrompt,
  generateVerifierSystemPrompt,
  generateVerifierUserPrompt,
  generateJudgeRollupSystemPrompt,
  generateJudgeRollupUserPrompt,
} from '../core/prompts.js';

// === Atomizer ===

test('generateAtomizerSystemPrompt instructs JSON output with content/provenance kinds', () => {
  const out = generateAtomizerSystemPrompt();
  assert.match(out, /JSON/);
  assert.match(out, /content/);
  assert.match(out, /provenance/);
  assert.match(out, /atoms/i);
  // Structural cues for small models
  assert.match(out, /1\./);
  assert.match(out, /2\./);
});

test('generateAtomizerSystemPrompt explicitly distinguishes content vs provenance', () => {
  const out = generateAtomizerSystemPrompt();
  // Must define both kinds explicitly so small models can follow
  assert.match(out, /provenance.*author|provenance.*publication|provenance.*publication date/i);
  assert.match(out, /content.*assertion|content.*body|content.*article/i);
});

test('generateAtomizerUserPrompt embeds the claim verbatim', () => {
  const claim = 'In 2019, Jane Doe wrote in the Guardian that the dam was 95 meters tall.';
  const out = generateAtomizerUserPrompt(claim);
  assert.ok(out.includes(claim));
});

test('generateAtomizerUserPrompt is short when no container provided', () => {
  const out = generateAtomizerUserPrompt('A short claim.');
  // Without container, the prompt is a thin wrapper, not a re-statement of instructions
  assert.ok(out.length < 500, `user prompt too long: ${out.length} chars`);
});

test('generateAtomizerUserPrompt includes claim_container as context-only when provided', () => {
  const claim = 'the LTTE formally joined a common militant front';
  const container = 'In April 1984, the LTTE formally joined a common militant front, the Eelam National Liberation Front (ENLF), a union between LTTE, TELO, EROS, PLOTE and EPRLF.';
  const out = generateAtomizerUserPrompt(claim, container);
  // Both must appear, AND the prompt must make clear container is context-only
  assert.ok(out.includes(claim), 'claim must appear');
  assert.ok(out.includes(container), 'container must appear');
  assert.match(out, /context|surrounding|do not.*container/i,
    'must instruct the model to treat container as context, not source of atoms');
});

test('generateAtomizerUserPrompt ignores container when identical to claim (non-fragmentary)', () => {
  const claim = 'A short claim.';
  // When container == claim, no fragment context is needed — prompt stays in short form
  const out = generateAtomizerUserPrompt(claim, claim);
  assert.ok(out.length < 500, `user prompt unnecessarily long when container==claim: ${out.length} chars`);
});

// === Verifier ===

test('generateVerifierSystemPrompt enumerates supported/not_supported verdicts (no SU)', () => {
  const out = generateVerifierSystemPrompt();
  assert.match(out, /supported/);
  assert.match(out, /not_supported|not supported/i);
  // SOURCE_UNAVAILABLE is handled upstream by the body-usability classifier;
  // it must NOT appear in the verifier's output set.
  assert.doesNotMatch(out, /SOURCE[_\s]?UNAVAILABLE/i);
  assert.doesNotMatch(out, /source unavailable/i);
});

test('generateVerifierSystemPrompt includes structural cues for small models', () => {
  const out = generateVerifierSystemPrompt();
  // numbered steps + verdict taxonomy paragraph — informed by Granite regression
  assert.match(out, /1\./);
  assert.match(out, /2\./);
  // explicit verdict taxonomy
  assert.match(out, /verdict/i);
});

test('generateVerifierUserPrompt embeds atom assertion and source text', () => {
  const atom = { id: 'a1', assertion: 'The dam is 95 meters tall.', kind: 'content' };
  const sourceText = 'The dam, completed in 1972, stands 95 meters tall and spans the river.';
  const out = generateVerifierUserPrompt(atom, sourceText);
  assert.ok(out.includes(atom.assertion));
  assert.ok(out.includes('95 meters tall'));
});

test('generateVerifierUserPrompt scopes provenance atoms to metadata only', () => {
  const atom = { id: 'p1', assertion: 'Published in The Guardian.', kind: 'provenance' };
  const sourceText = 'The dam, completed in 1972, stands 95 meters tall.';
  const metadata = { publication: 'The Guardian', published: '2019-04-12' };
  const out = generateVerifierUserPrompt(atom, sourceText, metadata);
  // Provenance prompts must reference the metadata block, not just the body
  assert.match(out, /metadata|provenance|publication/i);
  assert.ok(out.includes('The Guardian'));
});

test('generateVerifierUserPrompt handles no-metadata case gracefully', () => {
  const atom = { id: 'a1', assertion: 'The dam is 95 meters tall.', kind: 'content' };
  const out = generateVerifierUserPrompt(atom, 'body text', undefined);
  assert.equal(typeof out, 'string');
  assert.ok(out.length > 0);
});

// === Judge rollup ===

test('generateJudgeRollupSystemPrompt enumerates SUPPORTED/PARTIALLY/NOT verdicts', () => {
  const out = generateJudgeRollupSystemPrompt();
  assert.match(out, /SUPPORTED/);
  assert.match(out, /PARTIALLY SUPPORTED/);
  assert.match(out, /NOT SUPPORTED/);
  // No SU
  assert.doesNotMatch(out, /SOURCE[_\s]?UNAVAILABLE/i);
});

test('generateJudgeRollupUserPrompt embeds the original claim and all atom results', () => {
  const claim = 'In 2019, Jane Doe wrote in the Guardian that the dam was 95 meters tall.';
  const atomResults = [
    { atomId: 'a1', verdict: 'supported', evidence: 'The dam stands 95 meters tall.' },
    { atomId: 'p1', verdict: 'not_supported', evidence: 'Metadata shows New York Times.' },
  ];
  const out = generateJudgeRollupUserPrompt(claim, atomResults);
  assert.ok(out.includes(claim));
  assert.ok(out.includes('supported'));
  assert.ok(out.includes('not_supported'));
  assert.ok(out.includes('95 meters tall'));
});
```

**Step 2: Run, expect failure**

Run: `npm test -- --test-name-pattern="generateAtomizer|generateVerifier|generateJudge"`
Expected: 12 tests fail with "generateAtomizerSystemPrompt is not exported" (or similar) — the old `core/prompts.js` doesn't define these yet.

---

## Task 2: Rewrite `core/prompts.js` with the six new exports

**Files:**
- Modify: `core/prompts.js` (currently 152 lines; will become ~300-400 lines).

**Step 1: Replace the entire file contents**

Replace `core/prompts.js` with:

```js
// Atomized verification pipeline prompts.
//
// Six pure functions — three roles (atomizer, verifier, judge) × two
// shapes (system, user) — replace the previous single-call
// generateSystemPrompt/generateUserPrompt pair. Removed in this phase;
// every caller (cli/verify.js, benchmark/run_benchmark.js, main.js via
// sync-main.js) is updated in Phase 5.
//
// Design constraints reflected in the prompt text:
//   - Verdict surface = { supported, not_supported } at atom level;
//     { SUPPORTED, PARTIALLY SUPPORTED, NOT SUPPORTED } at claim level.
//   - SOURCE_UNAVAILABLE is intentionally absent — the body-usability
//     classifier short-circuits unusable bodies upstream.
//   - Structural scaffolding (numbered steps, explicit verdict taxonomy
//     paragraph) is included specifically because small instruction-
//     tuned models (Granite-4.1-8B) regressed on the prior single-
//     paragraph framing.
//   - Provenance atoms verify against Citoid metadata; content atoms
//     verify against the article body. The verifier user prompt scopes
//     the input slice by atom kind.
//   - Atomizer output is JSON. Callers pass responseFormat:
//     { type: 'json_object' } to the OpenAI-compatible upstreams that
//     support it; others rely on the model's JSON-following discipline.

// === ATOMIZER ===

export function generateAtomizerSystemPrompt() {
    return `You are decomposing a Wikipedia citation claim into atomic assertions that can each be verified independently.

A claim may assert multiple distinct facts at once. Your job is to split it into individual assertions ("atoms"), each tagged by kind.

There are exactly two kinds of atoms:
1. content — an assertion about WHAT the source says (events, dates, numbers, names of people, places, things mentioned in the source body).
2. provenance — an assertion about WHO produced the source or WHEN/WHERE it was published (author name, publication title, publication date). Provenance atoms are verifiable from bibliographic metadata alone, without reading the body.

Rules:
1. Each atom should be a single declarative sentence. Do not combine multiple assertions into one atom.
2. Use the kind tag carefully. "Published in The Guardian" is provenance. "The Guardian editor argued X" is content (it's about what was said, not just where).
3. Preserve quoted phrases verbatim when the original claim quotes the source.
4. Do not introduce facts that aren't in the claim. Do not paraphrase away nuance (e.g., "approximately 95 meters" must stay "approximately 95 meters").
5. If the claim is already atomic (one assertion), return a single atom.

Output ONLY a JSON object of this shape, with no surrounding prose:

{
  "atoms": [
    { "id": "a1", "assertion": "<single declarative sentence>", "kind": "content" },
    { "id": "p1", "assertion": "<single declarative sentence>", "kind": "provenance" }
  ]
}

Use 'a' prefix for content atoms, 'p' prefix for provenance atoms. Number them sequentially within each kind.

Examples:

Claim: "In 2019, Jane Doe reported in The Guardian that the dam stands 95 meters tall."
{
  "atoms": [
    { "id": "p1", "assertion": "The source was published in The Guardian.", "kind": "provenance" },
    { "id": "p2", "assertion": "The source was published in 2019.", "kind": "provenance" },
    { "id": "p3", "assertion": "The source was authored by Jane Doe.", "kind": "provenance" },
    { "id": "a1", "assertion": "The dam stands 95 meters tall.", "kind": "content" }
  ]
}

Claim: "The hurricane made landfall on September 12, 2017."
{
  "atoms": [
    { "id": "a1", "assertion": "The hurricane made landfall on September 12, 2017.", "kind": "content" }
  ]
}

Claim: "Smith's 2020 study found a 15% reduction in cases among vaccinated children aged 5-11."
{
  "atoms": [
    { "id": "p1", "assertion": "The source was authored by Smith.", "kind": "provenance" },
    { "id": "p2", "assertion": "The source was published in 2020.", "kind": "provenance" },
    { "id": "a1", "assertion": "The study found a 15% reduction in cases among vaccinated children aged 5-11.", "kind": "content" }
  ]
}`;
}

export function generateAtomizerUserPrompt(claim, claimContainer) {
    // claim_container is the surrounding sentence/paragraph from the Wikipedia
    // article. 20% of dataset rows are sentence fragments from mid-sentence
    // citations; the container restores reading-comprehension context without
    // expanding the atom set. We instruct the model to use container only for
    // context, not as a source of new atoms — the extraction-unit fix (whether
    // to decompose the full sentence vs the truncated fragment) is a separate
    // out-of-scope decision.
    if (claimContainer && claimContainer !== claim) {
        return `Decompose this claim into atoms.

The CLAIM is the text we want to verify. The CONTAINER is the surrounding sentence/paragraph from the Wikipedia article, included only as context for understanding the claim. Only emit atoms for assertions in the CLAIM. Do not emit atoms for assertions that appear only in the CONTAINER.

Claim:
${claim}

Container (for context only):
${claimContainer}`;
    }
    return `Decompose this claim into atoms:

${claim}`;
}

// === VERIFIER ===

export function generateVerifierSystemPrompt() {
    return `You are verifying a single atomic assertion against a single source.

You receive ONE atom (a single declarative sentence) and the relevant slice of the source. Your job is to decide whether the source supports the atom.

There are exactly two verdicts:
1. supported — the source explicitly states or unambiguously implies the assertion. The reader does not need outside knowledge to connect the source to the assertion.
2. not_supported — the source does not state the assertion, or the source explicitly contradicts it, or the source is silent on the question.

Rules:
1. Use ONLY the provided source slice. Do not use outside knowledge. Do not infer beyond what the source says.
2. For content atoms (kind=content), evaluate against the article body. Numbers, dates, names, and event descriptions must match the atom; minor wording differences are fine.
3. For provenance atoms (kind=provenance), evaluate against the metadata block (publication, published, author, title, url). If the metadata is missing or empty, the verdict is not_supported — the source's bibliographic record does not confirm the atom.
4. "Approximately" and "around" qualifiers in the atom or the source should be matched loosely (within 5%); exact numbers in both should match exactly.
5. If the source is in a different language, do your best with the cognates and proper nouns; if no useful overlap exists, return not_supported.
6. Do not hedge. Pick supported or not_supported.

Output ONLY a JSON object of this shape, with no surrounding prose:

{
  "verdict": "supported" | "not_supported",
  "evidence": "<one short sentence from the source that decided it, or an explanation if not_supported>"
}

Examples:

Atom: { "assertion": "The dam stands 95 meters tall.", "kind": "content" }
Source body: "The dam, completed in 1972, stands 95 meters tall and spans the river."
Output:
{ "verdict": "supported", "evidence": "stands 95 meters tall" }

Atom: { "assertion": "The dam stands 95 meters tall.", "kind": "content" }
Source body: "The dam is approximately 80 meters tall."
Output:
{ "verdict": "not_supported", "evidence": "source says approximately 80 meters, not 95" }

Atom: { "assertion": "The source was published in The Guardian.", "kind": "provenance" }
Metadata: { "publication": "The Guardian", "published": "2019-04-12" }
Output:
{ "verdict": "supported", "evidence": "metadata.publication = The Guardian" }

Atom: { "assertion": "The source was published in The Guardian.", "kind": "provenance" }
Metadata: { "publication": "The New York Times" }
Output:
{ "verdict": "not_supported", "evidence": "metadata.publication = The New York Times, not The Guardian" }

Atom: { "assertion": "The hurricane made landfall on September 12, 2017.", "kind": "content" }
Source body: "Strong winds and rain affected the coast that fall."
Output:
{ "verdict": "not_supported", "evidence": "source describes the season but not a specific landfall date" }`;
}

export function generateVerifierUserPrompt(atom, sourceText, metadata) {
    if (atom.kind === 'provenance') {
        const metaBlock = metadata
            ? JSON.stringify(metadata, null, 2)
            : '{}';
        return `Verify this provenance atom against the source metadata.

Atom: ${JSON.stringify({ assertion: atom.assertion, kind: 'provenance' })}

Metadata:
${metaBlock}`;
    }
    return `Verify this content atom against the source body.

Atom: ${JSON.stringify({ assertion: atom.assertion, kind: 'content' })}

Source body:
${sourceText}`;
}

// === JUDGE ROLLUP ===

export function generateJudgeRollupSystemPrompt() {
    return `You are composing a single citation-verification verdict from a set of per-atom verdicts.

You receive the original claim and an array of atom-level results. Each result has an atomId, a verdict (supported or not_supported), and an evidence snippet. Your job is to roll them up into a single claim-level verdict.

There are exactly three claim-level verdicts:
1. SUPPORTED — every atom is supported. The claim is fully backed by the source.
2. PARTIALLY SUPPORTED — at least one atom is supported AND at least one atom is not_supported. The claim is partially backed.
3. NOT SUPPORTED — every atom is not_supported. The claim is not backed by the source.

Rules:
1. Apply the rule mechanically when the atoms agree. If they're mixed, return PARTIALLY SUPPORTED.
2. The exception is when a single not_supported atom carries a high-stakes contradiction (e.g., the source actively says the opposite of a load-bearing atom). In that case PARTIALLY SUPPORTED may understate the problem and NOT SUPPORTED is appropriate. Use this exception sparingly.
3. Do not introduce verdicts not in the taxonomy. Do not output SOURCE UNAVAILABLE — unusable sources are filtered upstream and won't reach you.
4. Reason briefly about which atoms drove the verdict.

Output ONLY a JSON object of this shape:

{
  "verdict": "SUPPORTED" | "PARTIALLY SUPPORTED" | "NOT SUPPORTED",
  "reasoning": "<one or two sentences naming the atoms that decided the verdict>"
}`;
}

export function generateJudgeRollupUserPrompt(claim, atomResults) {
    return `Roll up these atom verdicts into a claim-level verdict.

Claim: ${claim}

Atom results:
${JSON.stringify(atomResults, null, 2)}`;
}
```

**Step 2: Run the tests, expect all 12 to pass**

Run: `npm test -- --test-name-pattern="generateAtomizer|generateVerifier|generateJudge"`
Expected: 12 tests pass.

---

## Task 3: Update call sites for the removed `generateSystemPrompt` / `generateUserPrompt`

**Files:**
- Modify: `cli/verify.js` (imports + usage; lines around 8-13 for imports, plus the verification flow)
- Modify: `benchmark/run_benchmark.js` (imports + usage)
- Modify: `tests/benchmark_prompt_unification.test.js` (tests for the unification — may need rewriting)

**Step 1: Find every caller**

Run: `grep -rn "generateSystemPrompt\|generateUserPrompt" --include="*.js" --include="*.mjs"`
Expected: matches in `cli/verify.js`, `benchmark/run_benchmark.js`, `tests/prompts.test.js` (already rewritten), `tests/benchmark_prompt_unification.test.js`, `main.js` (the inlined copy).

**Step 2: For each caller**

The old functions are now removed. Phase 5 wires `verifyClaim()` / `verifyClaimAtomized()` into `cli/verify.js` and `benchmark/run_benchmark.js`. **In this phase**, the goal is just to keep the build green — not to wire up the new pipeline. Two options:

- **(a) Stub-replace strategy (preferred for Phase 2):** Add a temporary `export function generateLegacySystemPrompt()` and `export function generateLegacyUserPrompt(claim, source)` to `core/prompts.js` that returns the same text the old functions returned (copy verbatim from the file's prior state, accessible via `git show 649cac7:core/prompts.js`). Update callers to use the legacy names. Phase 5 deletes the legacy stubs once the pipeline-level verifyClaim() takes over.

- **(b) Aggressive deletion strategy:** Remove the call sites entirely. The CLI and benchmark stop working until Phase 5 wires the atomized pipeline. The build stays green (no missing imports) but `npx ccs verify` fails until Phase 5.

**Use strategy (a).** Add the legacy stubs to `core/prompts.js`.

**First, extract the old function bodies:**

```bash
git show 649cac7:core/prompts.js > /tmp/old-prompts.js
```

Open `/tmp/old-prompts.js`. The file has two exports:
- `export function generateSystemPrompt() { return `<124-line template-literal body>`; }`
- `export function generateUserPrompt(claim, sourceInfo) { return `<short template-literal body>`; }`

**Then, append to `core/prompts.js` (after the six new exports):**

```js
// === LEGACY (Phase 5 will remove these) ===
//
// Kept temporarily so cli/verify.js and benchmark/run_benchmark.js continue
// to work between Phase 2 (prompt rewrite) and Phase 5 (worker.js +
// CLI/benchmark wiring). The text is copied verbatim from the
// pre-Phase-2 core/prompts.js to preserve regression-baseline behavior.

export function generateLegacySystemPrompt() {
    // Paste the entire template-literal body of /tmp/old-prompts.js's
    // generateSystemPrompt() function here (everything between the
    // opening backtick and closing backtick — 124 lines).
    return `...`;
}

export function generateLegacyUserPrompt(claim, sourceInfo) {
    // Paste the entire template-literal body of /tmp/old-prompts.js's
    // generateUserPrompt(claim, sourceInfo) function here.
    return `...`;
}
```

Verify the paste with: `grep -c "PARTIALLY SUPPORTED" core/prompts.js` — expect ≥ 1 hit (the old prompt enumerated all four verdicts including SOURCE UNAVAILABLE; the new prompts don't, so any legacy-only verdict text proves the paste worked).

**Step 3: Update `cli/verify.js`**

Find the import line:
```js
import { generateSystemPrompt, generateUserPrompt } from '../core/prompts.js';
```

Replace with:
```js
import { generateLegacySystemPrompt, generateLegacyUserPrompt } from '../core/prompts.js';
```

Find usages of `generateSystemPrompt()` and `generateUserPrompt(...)` in the file and replace with the legacy names. (Search `grep -n` to find them.)

**Step 4: Update `benchmark/run_benchmark.js`**

Same: replace the import and call-site names.

**Step 5: Update `tests/benchmark_prompt_unification.test.js`**

This test verifies the CLI and benchmark agree on prompt text. Since both now use `generateLegacy*`, update the test to import those names. The assertions stay structurally the same.

Run: `grep -n "generateSystemPrompt\|generateUserPrompt" tests/benchmark_prompt_unification.test.js`
Update each match to the legacy name.

**Step 6: Rebuild and re-test**

Run: `npm run build`
Expected: build succeeds; main.js updated.

Run: `npm test`
Expected: 210+ tests passing (the 12 new prompts tests + existing tests with renamed imports + previously-passing tests). Zero failures.

Run: `grep -c "generateLegacySystemPrompt\|generateLegacyUserPrompt" main.js`
Expected: ≥ 1 (inlined into main.js).

---

## Task 4: Commit

**Step 1: Stage**

```bash
git add core/prompts.js cli/verify.js benchmark/run_benchmark.js \
        tests/prompts.test.js tests/benchmark_prompt_unification.test.js \
        main.js
```

**Step 2: Verify staging**

Run: `git status --short`
Expected: 6 files staged; nothing else.

**Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
core/prompts: six new exports for atomized pipeline (atomizer/verifier/judge × system/user)

- generateAtomizerSystemPrompt — JSON-output instructions for splitting
  compound claims into content and provenance atoms; structural cues
  (numbered steps, explicit verdict taxonomy paragraph) restored to help
  small instruction-tuned models that regressed under the prior
  collapsed-paragraph framing.
- generateAtomizerUserPrompt(claim) — thin wrapper, claim verbatim.
- generateVerifierSystemPrompt — binary supported/not_supported verdict
  for a single atom against the right slice of input (body for content
  atoms, metadata for provenance atoms). SOURCE_UNAVAILABLE omitted —
  body-classifier intercepts upstream.
- generateVerifierUserPrompt(atom, sourceText, metadata?) — scopes the
  input by atom kind.
- generateJudgeRollupSystemPrompt — composes per-atom verdicts into
  SUPPORTED / PARTIALLY SUPPORTED / NOT SUPPORTED at claim level.
- generateJudgeRollupUserPrompt(claim, atomResults).

Legacy generateLegacySystemPrompt + generateLegacyUserPrompt kept
temporarily as text-identical copies of the prior exports, used by CLI
and benchmark until Phase 5 wires the atomized pipeline. Both legacy
stubs are deleted in Phase 5.

Tests: 12 new prompt-render assertions; full suite passing. main.js in
sync.
EOF
)"
```

**Step 4: Verify**

Run: `git log -1 --stat`
Expected: commit listed; ~6 files.

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: pass = tests; fail = 0.

Run: `npm run build -- --check`
Expected: `main.js in sync with core/`.

---

**Phase 2 done when:**
- `npm test` passes (220+ tests, 0 failures)
- `npm run build -- --check` exits 0
- `core/prompts.js` exports all six `generate*Prompt` functions + the two `generateLegacy*` stubs
- `grep "SOURCE[_\s]?UNAVAILABLE" core/prompts.js` matches **zero** lines in the new functions (legacy stubs may still mention it — that's text-identical preservation)
- `cli/verify.js` and `benchmark/run_benchmark.js` use `generateLegacy*` (build is green; behavior unchanged until Phase 5)
