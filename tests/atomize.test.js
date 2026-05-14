import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atomize, parseAtomsResponse, resolveMaxTokens } from '../core/atomize.js';

// Imports OK
test('atomize() and parseAtomsResponse() are exported', () => {
  assert.equal(typeof atomize, 'function');
  assert.equal(typeof parseAtomsResponse, 'function');
});

// === parseAtomsResponse pure-parser tests ===

test('parseAtomsResponse parses well-formed JSON', () => {
  const text = JSON.stringify({
    atoms: [
      { id: 'a1', assertion: 'Foo.', kind: 'content' },
      { id: 'p1', assertion: 'Bar.', kind: 'provenance' },
    ],
  });
  const result = parseAtomsResponse(text);
  assert.equal(result.length, 2);
  assert.equal(result[0].kind, 'content');
});

test('parseAtomsResponse strips markdown code fences', () => {
  const text = '```json\n' + JSON.stringify({
    atoms: [{ id: 'a1', assertion: 'Foo.', kind: 'content' }],
  }) + '\n```';
  const result = parseAtomsResponse(text);
  assert.equal(result.length, 1);
});

test('parseAtomsResponse returns null for malformed JSON', () => {
  assert.equal(parseAtomsResponse('this is not json'), null);
  assert.equal(parseAtomsResponse(''), null);
  assert.equal(parseAtomsResponse(null), null);
  assert.equal(parseAtomsResponse(undefined), null);
});

test('parseAtomsResponse returns null when atoms array is missing or empty', () => {
  assert.equal(parseAtomsResponse('{}'), null);
  assert.equal(parseAtomsResponse('{"atoms": []}'), null);
  assert.equal(parseAtomsResponse('{"atoms": "not an array"}'), null);
});

test('parseAtomsResponse filters out atoms with wrong kind', () => {
  const text = JSON.stringify({
    atoms: [
      { id: 'a1', assertion: 'Good.', kind: 'content' },
      { id: 'bad', assertion: 'Bad.', kind: 'invalid' },
    ],
  });
  const result = parseAtomsResponse(text);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'a1');
});

// === atomize end-to-end with mocked transport ===

function fakeTransport(textResponse) {
  return async () => ({ text: textResponse });
}

test('atomize returns parsed atoms for well-formed model output', async () => {
  const transport = fakeTransport(JSON.stringify({
    atoms: [
      { id: 'p1', assertion: 'Published in The Guardian.', kind: 'provenance' },
      { id: 'a1', assertion: 'The dam is 95m tall.', kind: 'content' },
    ],
  }));
  const result = await atomize('In 2019 The Guardian reported the dam is 95m tall.', {
    type: 'claude',
    model: 'claude-sonnet-4-5',
  }, { transport });
  assert.equal(result.length, 2);
  assert.equal(result[0].kind, 'provenance');
  assert.equal(result[1].kind, 'content');
});

test('atomize falls back to single-atom on malformed JSON', async () => {
  const transport = fakeTransport('not json at all');
  const claim = 'A compound claim about something.';
  const result = await atomize(claim, { type: 'claude', model: 'm' }, { transport });
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, 'content');
  assert.equal(result[0].assertion, claim);
  assert.equal(result[0].id, 'a1');
});

test('atomize uses smallModel when useSmallModel is true', async () => {
  let receivedModel = null;
  const transport = async (_pc, { model }) => {
    receivedModel = model;
    return { text: '{"atoms":[{"id":"a1","assertion":"x","kind":"content"}]}' };
  };
  await atomize('claim', {
    type: 'claude',
    model: 'claude-sonnet-4-5',
    smallModel: 'claude-haiku-4-5-20251001',
  }, { transport, useSmallModel: true });
  assert.equal(receivedModel, 'claude-haiku-4-5-20251001');
});

test('atomize uses main model when useSmallModel is false', async () => {
  let receivedModel = null;
  const transport = async (_pc, { model }) => {
    receivedModel = model;
    return { text: '{"atoms":[{"id":"a1","assertion":"x","kind":"content"}]}' };
  };
  await atomize('claim', {
    type: 'claude',
    model: 'main-model',
    smallModel: 'small-model',
  }, { transport });
  assert.equal(receivedModel, 'main-model');
});

test('atomize propagates transport errors', async () => {
  const transport = async () => { throw new Error('transport-failed'); };
  await assert.rejects(
    () => atomize('claim', { type: 'claude', model: 'm' }, { transport }),
    /transport-failed/
  );
});

test('atomize threads opts.claimContainer to the user prompt', async () => {
  let receivedUserPrompt = null;
  const transport = async (_pc, { userPrompt }) => {
    receivedUserPrompt = userPrompt;
    return { text: '{"atoms":[{"id":"a1","assertion":"x","kind":"content"}]}' };
  };
  const claim = 'the LTTE formally joined a common militant front';
  const container = 'In April 1984, the LTTE formally joined a common militant front, the ENLF.';
  await atomize(claim, { type: 'claude', model: 'm' }, {
    transport,
    claimContainer: container,
  });
  assert.ok(receivedUserPrompt.includes(container),
    'container must be threaded to the user prompt');
  assert.match(receivedUserPrompt, /context|surrounding/i,
    'prompt must instruct the model to treat container as context');
});

test('atomize omits container threading when claimContainer is identical to claim', async () => {
  let receivedUserPrompt = null;
  const transport = async (_pc, { userPrompt }) => {
    receivedUserPrompt = userPrompt;
    return { text: '{"atoms":[{"id":"a1","assertion":"x","kind":"content"}]}' };
  };
  const claim = 'A complete sentence.';
  await atomize(claim, { type: 'claude', model: 'm' }, {
    transport,
    claimContainer: claim,
  });
  // No "Container" section in the rendered prompt when claim==container
  assert.doesNotMatch(receivedUserPrompt, /Container.*for context/i);
});

// === resolveMaxTokens pure function tests ===

test('resolveMaxTokens: caller-supplied maxTokens wins', () => {
  assert.equal(resolveMaxTokens({ maxTokens: 999 }, 1024), 999);
});

test('resolveMaxTokens: falls back to default when maxTokens is undefined', () => {
  assert.equal(resolveMaxTokens({}, 1024), 1024);
});

test('resolveMaxTokens: falls back to default when maxTokens is null', () => {
  assert.equal(resolveMaxTokens({ maxTokens: null }, 1024), 1024);
});

test('resolveMaxTokens: respects zero as a valid (though unusual) value', () => {
  assert.equal(resolveMaxTokens({ maxTokens: 0 }, 1024), 0);
});

test('resolveMaxTokens: integration with atomize — transport receives correct maxTokens', async () => {
  let capturedMaxTokens = null;
  const testTransport = async (providerConfig, { systemPrompt, userPrompt, signal, model }) => {
    capturedMaxTokens = resolveMaxTokens(providerConfig, 1024);
    return { text: '{"atoms":[{"id":"a1","assertion":"x","kind":"content"}]}' };
  };

  const providerConfig = {
    type: 'claude',
    model: 'claude-sonnet-4-5',
    maxTokens: 500,
  };

  await atomize('test claim', providerConfig, { transport: testTransport });

  assert.equal(capturedMaxTokens, 500,
    'atomize must pass providerConfig.maxTokens through to transport');
});
