// Characterization tests for benchmark/run_benchmark.js's callProvider.
//
// Asserts the unified contract that every provider type produces:
//   { verdict, confidence, comments, raw_response, usage: { input, output, cost_usd }, latency, error }
//
// Pre-refactor, callProvider used Node's `https` module per provider, returned
// { verdict, ... } without a usage field, and routed through a local httpPost
// helper. Post-refactor, callProvider delegates to core/providers.js (which
// uses fetch), giving every provider a consistent usage shape including
// cost_usd: null where the upstream API doesn't expose per-call cost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callProvider } from '../benchmark/run_benchmark.js';

function withMockFetch(handler) {
    const original = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, opts) => {
        calls.push({ url, opts });
        return handler(url, opts);
    };
    return {
        calls,
        restore: () => { globalThis.fetch = original; },
    };
}

const VERDICT_JSON = '{"verdict":"SUPPORTED","confidence":85,"comments":"clear match"}';

function withEnv(vars, fn) {
    const saved = {};
    for (const [k, v] of Object.entries(vars)) {
        saved[k] = process.env[k];
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    return fn().finally(() => {
        for (const [k, v] of Object.entries(saved)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    });
}

test('callProvider publicai returns parsed verdict and usage shape, max_tokens=1000', async () => {
    const mock = withMockFetch(async () => ({
        ok: true, status: 200,
        json: async () => ({
            choices: [{ message: { content: VERDICT_JSON } }],
            usage: { prompt_tokens: 120, completion_tokens: 18 },
        }),
    }));
    try {
        await withEnv({ PUBLICAI_API_KEY: 'test' }, async () => {
            const result = await callProvider('apertus-70b', 'sys', 'user');
            assert.equal(result.verdict, 'Supported');
            assert.equal(result.confidence, 85);
            assert.equal(result.comments, 'clear match');
            assert.equal(result.usage.input, 120);
            assert.equal(result.usage.output, 18);
            assert.equal(result.usage.cost_usd, null);
            assert.equal(result.error, null);
            assert.equal(typeof result.latency, 'number');
            // Benchmark holds max_tokens at 1000 across providers (preserves
            // pre-consolidation runner behavior; see BENCHMARK_MAX_TOKENS).
            const sent = JSON.parse(mock.calls[0].opts.body);
            assert.equal(sent.max_tokens, 1000);
        });
    } finally {
        mock.restore();
    }
});

test('callProvider claude returns parsed verdict and usage shape', async () => {
    const mock = withMockFetch(async () => ({
        ok: true, status: 200,
        json: async () => ({
            content: [{ text: VERDICT_JSON }],
            usage: { input_tokens: 200, output_tokens: 30 },
        }),
    }));
    try {
        await withEnv({ ANTHROPIC_API_KEY: 'test' }, async () => {
            const result = await callProvider('claude-sonnet-4-5', 'sys', 'user');
            assert.equal(result.verdict, 'Supported');
            assert.equal(result.usage.input, 200);
            assert.equal(result.usage.output, 30);
            assert.equal(result.usage.cost_usd, null);
            assert.equal(result.error, null);
        });
    } finally {
        mock.restore();
    }
});

test('callProvider gemini returns parsed verdict and usage shape', async () => {
    const mock = withMockFetch(async () => ({
        ok: true, status: 200,
        json: async () => ({
            candidates: [{ content: { parts: [{ text: VERDICT_JSON }] } }],
            usageMetadata: { promptTokenCount: 90, candidatesTokenCount: 14 },
        }),
    }));
    try {
        await withEnv({ GEMINI_API_KEY: 'test' }, async () => {
            const result = await callProvider('gemini-2.5-flash', 'sys', 'user');
            assert.equal(result.verdict, 'Supported');
            assert.equal(result.usage.input, 90);
            assert.equal(result.usage.output, 14);
            assert.equal(result.usage.cost_usd, null);
            assert.equal(result.error, null);
        });
    } finally {
        mock.restore();
    }
});

test('callProvider returns ERROR shape when env var is missing', async () => {
    await withEnv({ PUBLICAI_API_KEY: undefined }, async () => {
        const result = await callProvider('apertus-70b', 'sys', 'user');
        assert.equal(result.verdict, 'ERROR');
        assert.match(result.error, /PUBLICAI_API_KEY/);
        assert.equal(typeof result.latency, 'number');
    });
});
