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
