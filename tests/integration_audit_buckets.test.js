import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomize } from '../core/atomize.js';
import { verifyAtoms } from '../core/verify-atoms.js';
import { rollup } from '../core/rollup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_PATH = path.resolve(__dirname, '../benchmark/dataset.json');

// Load dataset once.
const dataset = JSON.parse(await fs.readFile(DATASET_PATH, 'utf8'));
const rowsById = new Map(dataset.rows.map(r => [r.id, r]));

// Helper: find a row, fail the test if missing.
function getRow(id) {
  const row = rowsById.get(id);
  if (!row) throw new Error(`fixture row ${id} not in benchmark/dataset.json — may have shifted; re-pin to the new id`);
  return row;
}

// expectedAtoms values are re-pinned to compound-corpus labels.json's
// `compoundness` field (at workbench/compound-corpus/labels.json). Bucket
// labels still describe the audit's failure-mode taxonomy; rows are picked
// to fit each bucket while also satisfying deterministic-rollup logic.

// === Bucket B fixtures: SU/NS boundary — source has prose but doesn't address the claim ===

const BUCKET_B = [
  {
    id: 'row_100',
    expectedAtoms: 1,                       // labels.json: compoundness=1
    atomVerdicts: ['not_supported'],
    // Audit pattern: source body talks around the claim but doesn't make
    // the specific assertion; classifier admitted the body, but the single
    // atom still verifies as not_supported.
  },
  {
    id: 'row_108',
    expectedAtoms: 2,                       // labels.json: compoundness=2
    atomVerdicts: ['not_supported', 'not_supported'],
  },
  {
    id: 'row_148',
    expectedAtoms: 2,                       // labels.json: compoundness=2 (was 1 in original draft)
    atomVerdicts: ['not_supported', 'not_supported'],
  },
];

// === Bucket C fixtures: NS/PS boundary — minor numeric/date discrepancy ===

const BUCKET_C = [
  // row_112 (PS, c=1) and row_71 (PS, c=1) from the original draft are
  // swapped out — c=1 in a PS bucket creates a deterministic-rollup
  // contradiction (one atom can't roll up to PARTIALLY SUPPORTED).
  // row_5 and row_10 are confirmed c=2 PS rows from labels.json.
  {
    id: 'row_5',
    expectedAtoms: 2,                       // labels.json: compoundness=2
    atomVerdicts: ['supported', 'not_supported'],
    // Audit pattern: claim has a minor error (date or number); one atom
    // verifies as supported (the supported part of the claim) and one as
    // not_supported (the discrepant part).
  },
  {
    id: 'row_186',
    expectedAtoms: 2,                       // labels.json: compoundness=2
    atomVerdicts: ['supported', 'not_supported'],
  },
  {
    id: 'row_10',
    expectedAtoms: 2,                       // labels.json: compoundness=2
    atomVerdicts: ['supported', 'not_supported'],
  },
];

// === Bucket D fixtures: literal-attribution gap — claim requires a direct quote/statement ===

const BUCKET_D = [
  {
    id: 'row_24',
    expectedAtoms: 3,                       // labels.json: compoundness=3 (was 2 in original draft)
    atomVerdicts: ['supported', 'supported', 'supported'],
    // Audit pattern: the source supports the claim's content via direct
    // quote or explicit statement; with atomization, every atom verifies
    // as supported.
  },
  {
    id: 'row_55',
    expectedAtoms: 2,                       // labels.json: compoundness=2
    atomVerdicts: ['supported', 'supported'],
  },
  {
    id: 'row_88',
    expectedAtoms: 3,                       // labels.json: compoundness=3 (was 1 in original draft)
    atomVerdicts: ['supported', 'supported', 'supported'],
  },
];

// === Bookend cases ===

const BOOKENDS = [
  {
    id: 'row_24', // already in bucket D; reuse as fully-supported bookend
    label: 'fully-supported bookend',
    expectedAtoms: 3,                       // labels.json: compoundness=3
    atomVerdicts: ['supported', 'supported', 'supported'],
    expectedVerdict: 'SUPPORTED',
  },
  {
    id: 'row_148', // already in bucket B; reuse as fully-unsupported bookend
    label: 'fully-unsupported bookend',
    expectedAtoms: 2,                       // labels.json: compoundness=2
    atomVerdicts: ['not_supported', 'not_supported'],
    expectedVerdict: 'NOT SUPPORTED',
  },
];

// === Stubbed transport ===

// The transport receives systemPrompt + userPrompt. We pattern-match
// against the userPrompt to decide what to return — this simulates
// Sonnet/Opus's behavior on these audit rows but is fully deterministic.
function makeStubTransport(fixture) {
  let callIndex = 0;
  return async (_providerConfig, { systemPrompt }) => {
    const isAtomizer = systemPrompt.includes('decomposing a Wikipedia citation claim');
    const isVerifier = systemPrompt.includes('verifying a single atomic assertion');
    if (isAtomizer) {
      // Return N atoms based on expectedAtoms
      const atoms = Array.from({ length: fixture.expectedAtoms }, (_, i) => ({
        id: `a${i + 1}`,
        assertion: `atomic assertion ${i + 1} from claim`,
        kind: 'content',
      }));
      return { text: JSON.stringify({ atoms }) };
    }
    if (isVerifier) {
      // Return the per-atom verdict in order
      const verdict = fixture.atomVerdicts[callIndex++] ?? 'not_supported';
      return { text: JSON.stringify({ verdict, evidence: `stub evidence for ${verdict}` }) };
    }
    throw new Error('stub transport: unknown prompt type');
  };
}

// === The contract: deterministic rollup matches GT for every fixture ===

function expectedVerdictFromGT(gt) {
  // Map dataset ground_truth strings to the rollup's verdict surface.
  // Dataset uses 'Supported' / 'Partially supported' / 'Not supported'
  // (title-case); rollup produces 'SUPPORTED' / 'PARTIALLY SUPPORTED' / 'NOT SUPPORTED'.
  const map = {
    'Supported': 'SUPPORTED',
    'Partially supported': 'PARTIALLY SUPPORTED',
    'Not supported': 'NOT SUPPORTED',
  };
  return map[gt] ?? null;
}

const ALL_FIXTURES = [...BUCKET_B, ...BUCKET_C, ...BUCKET_D];

for (const fixture of ALL_FIXTURES) {
  test(`integration: ${fixture.id} (${fixture.atomVerdicts.length} atoms) — deterministic rollup matches GT`, async () => {
    const row = getRow(fixture.id);
    const providerConfig = { type: 'claude', model: 'claude-sonnet-4-5' };
    const transport = makeStubTransport(fixture);

    const atoms = await atomize(row.claim_text, providerConfig, { transport });
    assert.equal(atoms.length, fixture.expectedAtoms);

    const atomResults = await verifyAtoms(atoms, row.source_text, null, providerConfig, { transport });
    assert.equal(atomResults.length, fixture.expectedAtoms);

    const result = await rollup(atoms, atomResults, 'deterministic');
    const expectedGT = expectedVerdictFromGT(row.ground_truth);
    assert.ok(expectedGT, `dataset row ${fixture.id} has unknown ground_truth ${row.ground_truth}`);
    assert.equal(
      result.verdict,
      expectedGT,
      `${fixture.id}: expected ${expectedGT} (GT=${row.ground_truth}) but rollup produced ${result.verdict}`
    );
  });
}

// Bookends — explicit verdict assertions
for (const bookend of BOOKENDS) {
  test(`integration: ${bookend.id} (${bookend.label})`, async () => {
    const row = getRow(bookend.id);
    const providerConfig = { type: 'claude', model: 'claude-sonnet-4-5' };
    const transport = makeStubTransport(bookend);

    const atoms = await atomize(row.claim_text, providerConfig, { transport });
    const atomResults = await verifyAtoms(atoms, row.source_text, null, providerConfig, { transport });
    const result = await rollup(atoms, atomResults, 'deterministic');
    assert.equal(result.verdict, bookend.expectedVerdict);
  });
}
