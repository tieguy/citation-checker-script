import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atomize } from '../core/atomize.js';
import { verifyAtoms } from '../core/verify-atoms.js';

test('atomize → verifyAtoms executes end-to-end against mocked transport', async () => {
  // Atomizer response: 2 atoms
  const atomizerTransport = async () => ({
    text: JSON.stringify({
      atoms: [
        { id: 'a1', assertion: 'The dam is 95m tall.', kind: 'content' },
        { id: 'p1', assertion: 'Published in 2019.', kind: 'provenance' },
      ],
    }),
  });

  // Verifier responses: a1 supported (body matches), p1 not_supported (metadata empty)
  const verifyResponses = [
    { text: JSON.stringify({ verdict: 'supported', evidence: 'matches body' }) },
    { text: JSON.stringify({ verdict: 'not_supported', evidence: 'no publication date' }) },
  ];
  let i = 0;
  const verifyTransport = async () => verifyResponses[i++];

  const claim = 'In 2019, the dam stands 95m tall.';
  const providerConfig = { type: 'claude', model: 'claude-sonnet-4-5', smallModel: 'claude-haiku-4-5-20251001' };

  const atoms = await atomize(claim, providerConfig, { transport: atomizerTransport });
  assert.equal(atoms.length, 2);

  const sourceText = 'The dam, completed in 1972, stands 95 meters tall.';
  const metadata = null;
  const results = await verifyAtoms(atoms, sourceText, metadata, providerConfig, { transport: verifyTransport });
  assert.equal(results.length, 2);
  assert.equal(results[0].verdict, 'supported');
  assert.equal(results[1].verdict, 'not_supported');
});
