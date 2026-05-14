import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rollup,
  deterministicVerdict,
  summarizeAtomResults,
  parseJudgeResponse,
  resolveMaxTokens,
} from '../core/rollup.js';

test('rollup module exports are available', () => {
  assert.equal(typeof rollup, 'function');
  assert.equal(typeof deterministicVerdict, 'function');
  assert.equal(typeof summarizeAtomResults, 'function');
  assert.equal(typeof parseJudgeResponse, 'function');
});

// === deterministicVerdict (pure function) ===

test('deterministicVerdict: all supported → SUPPORTED', () => {
  assert.equal(deterministicVerdict([
    { atomId: 'a1', verdict: 'supported' },
    { atomId: 'a2', verdict: 'supported' },
  ]), 'SUPPORTED');
});

test('deterministicVerdict: all not_supported → NOT SUPPORTED', () => {
  assert.equal(deterministicVerdict([
    { atomId: 'a1', verdict: 'not_supported' },
    { atomId: 'a2', verdict: 'not_supported' },
  ]), 'NOT SUPPORTED');
});

test('deterministicVerdict: mixed → PARTIALLY SUPPORTED', () => {
  assert.equal(deterministicVerdict([
    { atomId: 'a1', verdict: 'supported' },
    { atomId: 'a2', verdict: 'not_supported' },
  ]), 'PARTIALLY SUPPORTED');
});

test('deterministicVerdict: single supported atom → SUPPORTED', () => {
  assert.equal(deterministicVerdict([
    { atomId: 'a1', verdict: 'supported' },
  ]), 'SUPPORTED');
});

test('deterministicVerdict: single not_supported atom → NOT SUPPORTED', () => {
  assert.equal(deterministicVerdict([
    { atomId: 'a1', verdict: 'not_supported' },
  ]), 'NOT SUPPORTED');
});

test('deterministicVerdict: empty array → NOT SUPPORTED (defensive)', () => {
  assert.equal(deterministicVerdict([]), 'NOT SUPPORTED');
});

// === summarizeAtomResults ===

test('summarizeAtomResults includes assertion text and verdict', () => {
  const atoms = [
    { id: 'a1', assertion: 'The dam is 95m tall.', kind: 'content' },
    { id: 'p1', assertion: 'Published in Guardian.', kind: 'provenance' },
  ];
  const results = [
    { atomId: 'a1', verdict: 'supported', evidence: 'body matches' },
    { atomId: 'p1', verdict: 'not_supported', evidence: 'metadata empty' },
  ];
  const out = summarizeAtomResults(atoms, results);
  assert.match(out, /a1.*supported.*95m tall.*body matches/);
  assert.match(out, /p1.*not_supported.*Guardian.*metadata empty/);
});

test('summarizeAtomResults handles missing atom (atom-by-id lookup miss)', () => {
  const atoms = []; // empty
  const results = [{ atomId: 'a1', verdict: 'supported' }];
  const out = summarizeAtomResults(atoms, results);
  assert.match(out, /a1.*supported/);
});

// === parseJudgeResponse ===

test('parseJudgeResponse: valid SUPPORTED verdict', () => {
  const t = JSON.stringify({ verdict: 'SUPPORTED', reasoning: 'all atoms supported' });
  const r = parseJudgeResponse(t);
  assert.equal(r.verdict, 'SUPPORTED');
  assert.equal(r.reasoning, 'all atoms supported');
});

test('parseJudgeResponse: PARTIALLY SUPPORTED verdict', () => {
  const t = JSON.stringify({ verdict: 'PARTIALLY SUPPORTED', reasoning: '...' });
  assert.equal(parseJudgeResponse(t).verdict, 'PARTIALLY SUPPORTED');
});

test('parseJudgeResponse: NOT SUPPORTED verdict', () => {
  const t = JSON.stringify({ verdict: 'NOT SUPPORTED' });
  const r = parseJudgeResponse(t);
  assert.equal(r.verdict, 'NOT SUPPORTED');
  assert.equal(r.reasoning, '');
});

test('parseJudgeResponse: unknown verdict → null', () => {
  assert.equal(parseJudgeResponse('{"verdict":"MAYBE"}'), null);
});

test('parseJudgeResponse: malformed JSON → null', () => {
  assert.equal(parseJudgeResponse('garbage'), null);
});

test('parseJudgeResponse: lowercase verdict not in taxonomy → null', () => {
  // Verdict must be uppercase strings from the canonical taxonomy
  assert.equal(parseJudgeResponse('{"verdict":"supported"}'), null);
});

// === rollup() in deterministic mode ===

test('rollup deterministic: all-supported case', async () => {
  const atoms = [{ id: 'a1', assertion: 'A', kind: 'content' }];
  const results = [{ atomId: 'a1', verdict: 'supported', evidence: 'body matches' }];
  const r = await rollup(atoms, results, 'deterministic');
  assert.equal(r.verdict, 'SUPPORTED');
  assert.match(r.comments, /a1.*supported/);
  assert.equal(r.judgeReasoning, undefined);
});

test('rollup deterministic: mixed case → PARTIALLY SUPPORTED', async () => {
  const atoms = [
    { id: 'a1', assertion: 'A', kind: 'content' },
    { id: 'a2', assertion: 'B', kind: 'content' },
  ];
  const results = [
    { atomId: 'a1', verdict: 'supported' },
    { atomId: 'a2', verdict: 'not_supported' },
  ];
  const r = await rollup(atoms, results, 'deterministic');
  assert.equal(r.verdict, 'PARTIALLY SUPPORTED');
});

// === rollup() in judge mode ===

test('rollup judge: model returns SUPPORTED', async () => {
  const transport = async () => ({
    text: JSON.stringify({ verdict: 'SUPPORTED', reasoning: 'all good' }),
  });
  const atoms = [{ id: 'a1', assertion: 'A', kind: 'content' }];
  const results = [{ atomId: 'a1', verdict: 'supported' }];
  const r = await rollup(atoms, results, 'judge', { type: 'claude', model: 'm' }, {
    transport,
    claim: 'A.',
  });
  assert.equal(r.verdict, 'SUPPORTED');
  assert.equal(r.judgeReasoning, 'all good');
});

test('rollup judge: model returns garbage → deterministic fallback', async () => {
  const transport = async () => ({ text: 'unparseable' });
  const atoms = [
    { id: 'a1', assertion: 'A', kind: 'content' },
    { id: 'a2', assertion: 'B', kind: 'content' },
  ];
  const results = [
    { atomId: 'a1', verdict: 'supported' },
    { atomId: 'a2', verdict: 'not_supported' },
  ];
  const r = await rollup(atoms, results, 'judge', { type: 'claude', model: 'm' }, {
    transport,
    claim: 'A and B.',
  });
  assert.equal(r.verdict, 'PARTIALLY SUPPORTED');
  assert.match(r.judgeReasoning, /unparseable.*deterministic/);
});

test('rollup judge: transport throws → deterministic fallback with annotation', async () => {
  const transport = async () => { throw new Error('429 rate limit'); };
  const atoms = [{ id: 'a1', assertion: 'A', kind: 'content' }];
  const results = [{ atomId: 'a1', verdict: 'supported' }];
  const r = await rollup(atoms, results, 'judge', { type: 'claude', model: 'm' }, {
    transport,
    claim: 'A.',
  });
  assert.equal(r.verdict, 'SUPPORTED');
  assert.match(r.judgeReasoning, /429.*deterministic/);
});

test('rollup judge: missing providerConfig throws', async () => {
  await assert.rejects(
    () => rollup([], [], 'judge', null, { claim: 'A' }),
    /providerConfig/
  );
});

test('rollup judge: missing opts.claim throws', async () => {
  await assert.rejects(
    () => rollup([], [], 'judge', { type: 'claude', model: 'm' }, { transport: async () => ({}) }),
    /opts\.claim/
  );
});

test('rollup: unknown mode throws', async () => {
  await assert.rejects(
    () => rollup([], [], 'invalid'),
    /unknown rollup mode/
  );
});

// === resolveMaxTokens pure function tests ===

test('resolveMaxTokens: caller-supplied maxTokens wins', () => {
  assert.equal(resolveMaxTokens({ maxTokens: 999 }, 512), 999);
});

test('resolveMaxTokens: falls back to default when maxTokens is undefined', () => {
  assert.equal(resolveMaxTokens({}, 512), 512);
});

test('resolveMaxTokens: falls back to default when maxTokens is null', () => {
  assert.equal(resolveMaxTokens({ maxTokens: null }, 512), 512);
});
