import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAtomizedFlags, loadAtomsCache } from '../benchmark/run_benchmark.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

test('benchmark/run_benchmark.js imports cleanly after atomized wiring', async () => {
  // If imports break (e.g., missing exports), this throws.
  // This is a smoke test to verify the wiring changes don't break the module.
  const mod = await import('../benchmark/run_benchmark.js');
  assert.ok(mod);
  // Verify key exports are available (used by the main function)
  assert.equal(typeof mod.withRetry, 'function', 'withRetry export required');
  assert.equal(typeof mod.runPool, 'function', 'runPool export required');
  assert.equal(typeof mod.makeSaver, 'function', 'makeSaver export required');
  assert.equal(typeof mod.hostForProvider, 'function', 'hostForProvider export required');
  assert.equal(typeof mod.synthesizePipelineSU, 'function', 'synthesizePipelineSU export required');
  assert.equal(typeof mod.compareVerdicts, 'function', 'compareVerdicts export required');
  assert.equal(typeof mod.parseAtomizedFlags, 'function', 'parseAtomizedFlags export required');
});

// === parseAtomizedFlags pure function tests ===

test('parseAtomizedFlags: default args (empty)', () => {
  const result = parseAtomizedFlags([]);
  assert.equal(result.ok, true);
  assert.equal(result.wantAtomized, true);
  assert.equal(result.rollupMode, 'deterministic');
  assert.equal(result.useSmallAtomizer, false);
});

test('parseAtomizedFlags: --no-atomized', () => {
  const result = parseAtomizedFlags(['--no-atomized']);
  assert.equal(result.ok, true);
  assert.equal(result.wantAtomized, false);
  assert.equal(result.rollupMode, 'deterministic');
});

test('parseAtomizedFlags: --rollup-mode=judge', () => {
  const result = parseAtomizedFlags(['--rollup-mode=judge']);
  assert.equal(result.ok, true);
  assert.equal(result.rollupMode, 'judge');
});

test('parseAtomizedFlags: --rollup-mode=deterministic (explicit)', () => {
  const result = parseAtomizedFlags(['--rollup-mode=deterministic']);
  assert.equal(result.ok, true);
  assert.equal(result.rollupMode, 'deterministic');
});

test('parseAtomizedFlags: --rollup-mode=garbage → error', () => {
  const result = parseAtomizedFlags(['--rollup-mode=garbage']);
  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 2);
  assert.match(result.message, /Invalid --rollup-mode.*garbage/);
});

test('parseAtomizedFlags: --rollup-mode= (empty value) → error', () => {
  const result = parseAtomizedFlags(['--rollup-mode=']);
  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 2);
  assert.match(result.message, /Invalid or missing/);
});

test('parseAtomizedFlags: --use-small-atomizer', () => {
  const result = parseAtomizedFlags(['--use-small-atomizer']);
  assert.equal(result.ok, true);
  assert.equal(result.useSmallAtomizer, true);
});

test('parseAtomizedFlags: combined flags', () => {
  const result = parseAtomizedFlags([
    '--no-atomized',
    '--rollup-mode=judge',
    '--use-small-atomizer',
    '--some-other-flag=ignored',
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.wantAtomized, false);
  assert.equal(result.rollupMode, 'judge');
  assert.equal(result.useSmallAtomizer, true);
});

// === --atoms-cache flag ===

test('parseAtomizedFlags: --atoms-cache=<path> sets atomsCache', () => {
  const result = parseAtomizedFlags(['--atoms-cache=/tmp/cache.json']);
  assert.equal(result.ok, true);
  assert.equal(result.atomsCache, '/tmp/cache.json');
});

test('parseAtomizedFlags: missing --atoms-cache value → error', () => {
  const result = parseAtomizedFlags(['--atoms-cache=']);
  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 2);
  assert.match(result.message, /Missing --atoms-cache value/);
});

test('parseAtomizedFlags: default atomsCache is null when flag absent', () => {
  const result = parseAtomizedFlags([]);
  assert.equal(result.atomsCache, null);
});

// === loadAtomsCache ===

function withTempFile(contents, fn) {
  const tmp = path.join(os.tmpdir(), `atoms-cache-test-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(tmp, typeof contents === 'string' ? contents : JSON.stringify(contents));
  try {
    return fn(tmp);
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

test('loadAtomsCache: results.json shape (rows[].entry_id + rows[].atoms)', () => {
  const fixture = {
    rows: [
      { entry_id: 'row_2', atoms: [{ id: 'a1', assertion: 'X.', kind: 'content' }] },
      { entry_id: 'row_3', atoms: [{ id: 'a1', assertion: 'Y.', kind: 'content' }] },
    ],
  };
  withTempFile(fixture, (tmp) => {
    const map = loadAtomsCache(tmp);
    assert.equal(map.size, 2);
    assert.equal(map.get('row_2')[0].assertion, 'X.');
    assert.equal(map.get('row_3')[0].assertion, 'Y.');
  });
});

test('loadAtomsCache: atoms.json sweep shape (rows[].id + rows[].atoms)', () => {
  const fixture = {
    ran_at: '2026-05-14T21:27:07.167Z',
    rows: [
      { id: 'row_2', atoms: [{ id: 'a1', assertion: 'X.', kind: 'content' }] },
    ],
  };
  withTempFile(fixture, (tmp) => {
    const map = loadAtomsCache(tmp);
    assert.equal(map.size, 1);
    assert.equal(map.get('row_2')[0].assertion, 'X.');
  });
});

test('loadAtomsCache: multi-provider results.json (same entry_id repeated) — first non-null wins', () => {
  // run_benchmark.js writes one row per (entry_id, provider). Atomization is
  // deterministic across providers when --atoms-cache fed in, so any provider's
  // row carries the same atoms — but we should still de-duplicate.
  const sharedAtoms = [{ id: 'a1', assertion: 'shared.', kind: 'content' }];
  const fixture = {
    rows: [
      { entry_id: 'row_2', provider: 'claude-sonnet-4-5', atoms: sharedAtoms },
      { entry_id: 'row_2', provider: 'gemini-2.5-flash', atoms: sharedAtoms },
    ],
  };
  withTempFile(fixture, (tmp) => {
    const map = loadAtomsCache(tmp);
    assert.equal(map.size, 1);
    assert.deepEqual(map.get('row_2'), sharedAtoms);
  });
});

test('loadAtomsCache: skips rows with null/empty atoms', () => {
  const fixture = {
    rows: [
      { entry_id: 'row_2', atoms: null },
      { entry_id: 'row_3', atoms: [] },
      { entry_id: 'row_4', atoms: [{ id: 'a1', assertion: 'real.', kind: 'content' }] },
    ],
  };
  withTempFile(fixture, (tmp) => {
    const map = loadAtomsCache(tmp);
    assert.equal(map.size, 1);
    assert.ok(map.has('row_4'));
    assert.ok(!map.has('row_2'));
    assert.ok(!map.has('row_3'));
  });
});

test('loadAtomsCache: throws on empty map (defensive — would silently fall through to per-row atomize)', () => {
  const fixture = { rows: [{ entry_id: 'row_2', atoms: null }] };
  withTempFile(fixture, (tmp) => {
    assert.throws(() => loadAtomsCache(tmp), /empty entry_id → atoms map/);
  });
});

test('loadAtomsCache: throws when rows is not an array', () => {
  const fixture = { metadata: 'no rows here' };
  withTempFile(fixture, (tmp) => {
    assert.throws(() => loadAtomsCache(tmp), /no usable rows array/);
  });
});
