import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadRows, loadMetadata, writeWithMetadata } from '../benchmark/io.js';

function tmp() {
  return path.join(os.tmpdir(), `ccs-io-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

test('loadRows handles legacy bare-array shape', () => {
  const p = tmp();
  fs.writeFileSync(p, JSON.stringify([{ id: 'row_1' }, { id: 'row_2' }]));
  try {
    assert.deepEqual(loadRows(p).map(r => r.id), ['row_1', 'row_2']);
    assert.deepEqual(loadMetadata(p), {});
  } finally { fs.unlinkSync(p); }
});

test('loadRows handles new {metadata, rows} shape', () => {
  const p = tmp();
  const meta = { run_at: '2026-05-02T15:30:00Z', prompt_date: '2026-05-02' };
  fs.writeFileSync(p, JSON.stringify({ metadata: meta, rows: [{ id: 'row_1' }] }));
  try {
    assert.deepEqual(loadRows(p).map(r => r.id), ['row_1']);
    assert.deepEqual(loadMetadata(p), meta);
  } finally { fs.unlinkSync(p); }
});

test('writeWithMetadata round-trips through loadRows + loadMetadata', () => {
  const p = tmp();
  const meta = { extracted_at: '2026-04-30', version_filter: 'v1' };
  const rows = [{ id: 'row_1', x: 1 }, { id: 'row_2', x: 2 }];
  try {
    writeWithMetadata(p, meta, rows);
    assert.deepEqual(loadMetadata(p), meta);
    assert.deepEqual(loadRows(p), rows);
  } finally { fs.unlinkSync(p); }
});
