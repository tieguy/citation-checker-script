import { test } from 'node:test';
import assert from 'node:assert/strict';

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
});
