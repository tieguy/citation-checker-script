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
