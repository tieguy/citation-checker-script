import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadSmokeSet,
  filterEntriesBySmokeSet,
} from '../benchmark/run_benchmark.js';

function writeTempJson(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smokeset-test-'));
  const filePath = path.join(dir, 'smoke-set.json');
  fs.writeFileSync(filePath, JSON.stringify(content));
  return filePath;
}

const DATASET_FIXTURE = [
  { id: 'row_1', expected_tool_verdict: 'Supported', source_availability: 'available', needs_manual_review: false },
  { id: 'row_2', expected_tool_verdict: 'Partially supported', source_availability: 'available', needs_manual_review: false },
  { id: 'row_3', expected_tool_verdict: 'Not supported', source_availability: 'available', needs_manual_review: false },
  { id: 'row_4', expected_tool_verdict: 'Source unavailable', source_availability: 'unfetchable', needs_manual_review: false },
  { id: 'row_5', expected_tool_verdict: 'Supported', source_availability: 'available', needs_manual_review: true },
];

test('loadSmokeSet parses a valid schema_version: 1 file', () => {
  const filePath = writeTempJson({
    schema_version: 1,
    rows: [{ row_id: 'row_1' }, { row_id: 'row_2' }],
  });
  const smokeSet = loadSmokeSet(filePath);
  assert.equal(smokeSet.schema_version, 1);
  assert.equal(smokeSet.rows.length, 2);
});

test('loadSmokeSet throws when file does not exist', () => {
  assert.throws(
    () => loadSmokeSet('/nonexistent/path/smoke-set.json'),
    /Smoke set file not found/,
  );
});

test('loadSmokeSet throws on unsupported schema_version', () => {
  const filePath = writeTempJson({ schema_version: 2, rows: [{ row_id: 'row_1' }] });
  assert.throws(
    () => loadSmokeSet(filePath),
    /Unsupported smoke-set schema_version: 2/,
  );
});

test('loadSmokeSet throws on missing rows array', () => {
  const filePath = writeTempJson({ schema_version: 1 });
  assert.throws(
    () => loadSmokeSet(filePath),
    /must contain a non-empty 'rows' array/,
  );
});

test('loadSmokeSet throws on empty rows array', () => {
  const filePath = writeTempJson({ schema_version: 1, rows: [] });
  assert.throws(
    () => loadSmokeSet(filePath),
    /must contain a non-empty 'rows' array/,
  );
});

test('filterEntriesBySmokeSet returns only the listed rows', () => {
  const entries = DATASET_FIXTURE.filter(e => !e.needs_manual_review);
  const smokeSet = { rows: [{ row_id: 'row_1' }, { row_id: 'row_3' }] };
  const filtered = filterEntriesBySmokeSet(entries, smokeSet, DATASET_FIXTURE);
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map(e => e.id), ['row_1', 'row_3']);
});

test('filterEntriesBySmokeSet preserves ordering from the input entries (not smoke-set order)', () => {
  const entries = DATASET_FIXTURE.filter(e => !e.needs_manual_review);
  // Smoke set lists row_3 first, but row_1 appears earlier in entries
  const smokeSet = { rows: [{ row_id: 'row_3' }, { row_id: 'row_1' }] };
  const filtered = filterEntriesBySmokeSet(entries, smokeSet, DATASET_FIXTURE);
  assert.deepEqual(filtered.map(e => e.id), ['row_1', 'row_3']);
});

test('filterEntriesBySmokeSet throws when a smoke-set row id is not in the dataset', () => {
  const entries = DATASET_FIXTURE.filter(e => !e.needs_manual_review);
  const smokeSet = { rows: [{ row_id: 'row_1' }, { row_id: 'row_doesnt_exist' }] };
  assert.throws(
    () => filterEntriesBySmokeSet(entries, smokeSet, DATASET_FIXTURE),
    /references row id\(s\) not present in dataset: row_doesnt_exist/,
  );
});

test('filterEntriesBySmokeSet validates against full dataset, not pre-filtered entries', () => {
  // row_5 exists in the dataset but was filtered out by needs_manual_review.
  // The smoke-set should still validate against the *full* dataset, so
  // referencing row_5 should NOT throw — it should just produce zero entries
  // since row_5 is excluded from the entries array.
  const entries = DATASET_FIXTURE.filter(e => !e.needs_manual_review);
  const smokeSet = { rows: [{ row_id: 'row_5' }] };
  const filtered = filterEntriesBySmokeSet(entries, smokeSet, DATASET_FIXTURE);
  assert.equal(filtered.length, 0);
});

test('filterEntriesBySmokeSet throws with all missing ids listed in the error', () => {
  const entries = DATASET_FIXTURE.filter(e => !e.needs_manual_review);
  const smokeSet = { rows: [{ row_id: 'row_a' }, { row_id: 'row_b' }] };
  assert.throws(
    () => filterEntriesBySmokeSet(entries, smokeSet, DATASET_FIXTURE),
    /references row id\(s\) not present in dataset: row_a, row_b/,
  );
});
