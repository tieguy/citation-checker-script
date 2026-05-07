import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  callPublicAIAPI,
  callHuggingFaceAPI,
  callClaudeAPI,
  callGeminiAPI,
  callProviderAPI,
} from '../core/providers.js';

function withMockFetch(fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return fn(url, opts);
  };
  return {
    calls,
    restore: () => { globalThis.fetch = original; },
  };
}

test('callClaudeAPI sends Anthropic headers and parses response', async () => {
  const mock = withMockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ text: 'OK' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
  }));
  try {
    const result = await callClaudeAPI({
      apiKey: 'sk-test',
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'system',
      userContent: 'user',
    });
    assert.equal(result.text, 'OK');
    assert.equal(result.usage.input, 10);
    assert.equal(result.usage.output, 5);
    assert.equal(mock.calls[0].opts.headers['x-api-key'], 'sk-test');
  } finally {
    mock.restore();
  }
});

test('callPublicAIAPI posts to workerBase and returns text + usage', async () => {
  const mock = withMockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: 'verdict' } }],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    }),
  }));
  try {
    const result = await callPublicAIAPI({
      model: 'qwen',
      systemPrompt: 's',
      userContent: 'u',
    });
    assert.equal(result.text, 'verdict');
    assert.ok(mock.calls[0].url.startsWith('https://publicai-proxy.alaexis.workers.dev'));
  } finally {
    mock.restore();
  }
});

test('callHuggingFaceAPI posts to workerBase /hf and returns text + usage', async () => {
  const mock = withMockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: 'hf-verdict' } }],
      usage: { prompt_tokens: 50, completion_tokens: 10 },
    }),
  }));
  try {
    const result = await callHuggingFaceAPI({
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      systemPrompt: 's',
      userContent: 'u',
    });
    assert.equal(result.text, 'hf-verdict');
    assert.equal(result.usage.input, 50);
    assert.equal(result.usage.output, 10);
    assert.equal(mock.calls[0].url, 'https://publicai-proxy.alaexis.workers.dev/hf');
    const sent = JSON.parse(mock.calls[0].opts.body);
    assert.equal(sent.model, 'meta-llama/Llama-3.3-70B-Instruct');
  } finally {
    mock.restore();
  }
});

test('callHuggingFaceAPI with apiKey hits HF router with Bearer header', async () => {
  const mock = withMockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: 'hf-direct' } }],
      usage: { prompt_tokens: 30, completion_tokens: 5 },
    }),
  }));
  try {
    const result = await callHuggingFaceAPI({
      apiKey: 'hf_test_key',
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      systemPrompt: 's',
      userContent: 'u',
    });
    assert.equal(result.text, 'hf-direct');
    assert.equal(mock.calls[0].url, 'https://router.huggingface.co/v1/chat/completions');
    assert.equal(mock.calls[0].opts.headers['Authorization'], 'Bearer hf_test_key');
  } finally {
    mock.restore();
  }
});

test('callHuggingFaceAPI without apiKey omits Authorization header', async () => {
  const mock = withMockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: 'ok' } }],
      usage: {},
    }),
  }));
  try {
    await callHuggingFaceAPI({ model: 'm', systemPrompt: 's', userContent: 'u' });
    assert.equal(mock.calls[0].url, 'https://publicai-proxy.alaexis.workers.dev/hf');
    assert.equal(mock.calls[0].opts.headers['Authorization'], undefined);
  } finally {
    mock.restore();
  }
});

test('callHuggingFaceAPI surfaces upstream error messages', async () => {
  const mock = withMockFetch(async () => ({
    ok: false,
    status: 429,
    text: async () => JSON.stringify({ error: { message: 'rate limited' } }),
  }));
  try {
    await assert.rejects(
      () => callHuggingFaceAPI({ model: 'm', systemPrompt: 's', userContent: 'u' }),
      /HuggingFace API request failed \(429\): rate limited/
    );
  } finally {
    mock.restore();
  }
});

test('callProviderAPI dispatches huggingface to /hf', async () => {
  const mock = withMockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: 'ok' } }],
      usage: {},
    }),
  }));
  try {
    await callProviderAPI('huggingface', {
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      systemPrompt: 's',
      userContent: 'u',
    });
    assert.ok(mock.calls[0].url.endsWith('/hf'));
  } finally {
    mock.restore();
  }
});

test('callProviderAPI dispatches to the named provider', async () => {
  const mock = withMockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ content: [{ text: 'via-dispatcher' }], usage: {} }),
  }));
  try {
    const result = await callProviderAPI('claude', {
      apiKey: 'k',
      model: 'm',
      systemPrompt: 's',
      userContent: 'u',
    });
    assert.equal(result.text, 'via-dispatcher');
  } finally {
    mock.restore();
  }
});

test('callProviderAPI throws on unknown provider', async () => {
  await assert.rejects(
    () => callProviderAPI('nope', {}),
    /Unknown provider: nope/
  );
});

test('callGeminiAPI requests JSON-only output via responseMimeType', async () => {
  // Issue #75: Gemini occasionally emits prose, markdown-fenced JSON, or
  // truncated JSON which the verdict parser then fails to read. Setting
  // responseMimeType: application/json constrains Gemini to emit syntactically
  // valid JSON, recovering parse-failed rows.
  const mock = withMockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: '{"verdict":"Supported"}' }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    }),
  }));
  try {
    await callGeminiAPI({
      apiKey: 'k',
      model: 'gemini-2.5-flash',
      systemPrompt: 's',
      userContent: 'u',
    });
    const body = JSON.parse(mock.calls[0].opts.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
  } finally {
    mock.restore();
  }
});

test('callClaudeAPI throws on non-ok response', async () => {
  const mock = withMockFetch(async () => ({
    ok: false,
    status: 401,
    text: async () => 'unauthorized',
  }));
  try {
    await assert.rejects(
      () => callClaudeAPI({ apiKey: 'bad', model: 'm', systemPrompt: 's', userContent: 'u' }),
      /401/
    );
  } finally {
    mock.restore();
  }
});
