import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAtomizedFlags } from '../benchmark/run_benchmark.js';

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
