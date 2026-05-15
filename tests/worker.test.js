import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchSourceContent,
  logVerification,
  sourceUnavailableStatusText,
  sourceUnavailableComment,
} from '../core/worker.js';

function mockFetch(impl) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return impl(url, opts);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('fetchSourceContent returns SU(google_books_skip) for Google Books URLs without hitting the network', async () => {
  const mock = mockFetch(async () => { throw new Error('should not be called'); });
  try {
    const result = await fetchSourceContent('https://books.google.com/books?id=abc', null);
    assert.deepEqual(result, { sourceUnavailable: true, reason: 'google_books_skip' });
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test('fetchSourceContent returns SU(fetch_failed) on proxy error', async () => {
  const mock = mockFetch(async () => ({
    ok: true,
    json: async () => ({ error: 'upstream timeout' }),
  }));
  try {
    const result = await fetchSourceContent('https://example.com/doc', null);
    assert.deepEqual(result, { sourceUnavailable: true, reason: 'fetch_failed' });
  } finally {
    mock.restore();
  }
});

test('fetchSourceContent returns SU(fetch_failed) on empty proxy response', async () => {
  const mock = mockFetch(async () => ({
    ok: true,
    json: async () => ({ content: '', truncated: false }),
  }));
  try {
    const result = await fetchSourceContent('https://example.com/doc', null);
    assert.deepEqual(result, { sourceUnavailable: true, reason: 'fetch_failed' });
  } finally {
    mock.restore();
  }
});

test('fetchSourceContent returns SU(fetch_failed) on network exception', async () => {
  const mock = mockFetch(async () => { throw new Error('network down'); });
  try {
    const result = await fetchSourceContent('https://example.com/doc', null);
    assert.deepEqual(result, { sourceUnavailable: true, reason: 'fetch_failed' });
  } finally {
    mock.restore();
  }
});

test('fetchSourceContent returns formatted source text on success', async () => {
  const mock = mockFetch(async () => ({
    ok: true,
    json: async () => ({ content: 'a'.repeat(500), truncated: false }),
  }));
  try {
    const result = await fetchSourceContent('https://example.com/doc', null);
    assert.ok(result.includes('Source URL: https://example.com/doc'));
    assert.ok(result.includes('Source Content:'));
    assert.ok(mock.calls[0].url.includes('?fetch=https%3A%2F%2Fexample.com%2Fdoc'));
  } finally {
    mock.restore();
  }
});

test('fetchSourceContent returns sourceUnavailable object when body is structurally bad', async () => {
  // Wayback Machine chrome wrapper, short body — should hit the wayback_chrome
  // pattern in core/body-classifier.js. Real failure case from row_94.
  const chromeBody = 'The Wayback Machine - https://web.archive.org/web/20120324190450/http://www.croydonminster.org/about-us A Living Past and a Growing Future If you want to help us support Croydon Minster, you can donate online through JustGiving.';
  const mock = mockFetch(async () => ({
    ok: true,
    json: async () => ({ content: chromeBody, truncated: false }),
  }));
  try {
    const result = await fetchSourceContent('https://web.archive.org/web/20120324190450/http://www.croydonminster.org/about-us', null);
    assert.deepEqual(result, { sourceUnavailable: true, reason: 'wayback_chrome' });
  } finally {
    mock.restore();
  }
});

test('fetchSourceContent passes usable body through unchanged (Wayback prefix + real article)', async () => {
  // Wayback URL prefix on a long body — body-classifier should let this through.
  // Real success case from row_9 (USCIS country-limit glossary).
  const usableBody = 'The Wayback Machine - https://web.archive.org/web/20160121232201/http://www.uscis.gov/tools/glossary/country-limit The maximum number of family-sponsored and employment-based preference visas that can be issued to citizens of any country in a fiscal year. The limits are calculated each fiscal year depending on the total number of family-sponsored and employment-based visas available. No more than 7 percent of the visas may be issued to natives of any one independent country in a fiscal year; no more than 2 percent may issued to any one dependency of any independent country. The per-country limit does not indicate, however, that a country is entitled to the maximum number of visas each year, just that it cannot receive more than that number.';
  const mock = mockFetch(async () => ({
    ok: true,
    json: async () => ({ content: usableBody, truncated: false }),
  }));
  try {
    const result = await fetchSourceContent('https://example.com/doc', null);
    assert.equal(typeof result, 'string');
    assert.ok(result.includes('Source Content:'));
    assert.ok(result.includes('family-sponsored'));
  } finally {
    mock.restore();
  }
});

// ---- sourceUnavailableStatusText (user-facing status in single-Verify) -----

test('sourceUnavailableStatusText: fetch_failed preserves pre-unification wording', () => {
  // Regression guard: before the SU-shape unification, the userscript showed
  // "Could not fetch source. Please paste the source text below." on null
  // returns. Preserved verbatim for the fetch_failed reason so users don't
  // see new jargon on the most common failure mode.
  assert.equal(
    sourceUnavailableStatusText('fetch_failed'),
    'Could not fetch source. Please paste the source text below.'
  );
});

test('sourceUnavailableStatusText: classifier reasons surface in parens', () => {
  assert.equal(
    sourceUnavailableStatusText('wayback_chrome'),
    'Source unavailable (wayback_chrome). Paste the source text below if you have it.'
  );
  assert.equal(
    sourceUnavailableStatusText('short_body'),
    'Source unavailable (short_body). Paste the source text below if you have it.'
  );
});

test('sourceUnavailableStatusText: google_books_skip surfaces with reason', () => {
  // No special-case wording yet; if/when we add user-friendly copy for Google
  // Books citations specifically, update this test alongside the helper.
  assert.equal(
    sourceUnavailableStatusText('google_books_skip'),
    'Source unavailable (google_books_skip). Paste the source text below if you have it.'
  );
});

test('sourceUnavailableStatusText: unknown reason still produces a coherent message', () => {
  assert.equal(
    sourceUnavailableStatusText('something_new'),
    'Source unavailable (something_new). Paste the source text below if you have it.'
  );
});

// ---- sourceUnavailableComment (report comment field) ------------------------

test('sourceUnavailableComment: fetch_failed preserves pre-unification wording', () => {
  // Batch-report results.json previously recorded "Could not fetch source
  // content" for null returns. Preserved verbatim for fetch_failed so the
  // benchmark-runner's synthesizePipelineSU output for source_fetch_failed
  // rows matches the userscript's batch-report comment string.
  assert.equal(
    sourceUnavailableComment('fetch_failed'),
    'Could not fetch source content'
  );
});

test('sourceUnavailableComment: classifier reasons use Pipeline-attributed prefix', () => {
  // Pattern that analyze_results.js readers and human reviewers can grep on
  // to attribute outcomes to the deterministic pipeline rather than the LLM.
  assert.equal(
    sourceUnavailableComment('json_ld_leak'),
    'Pipeline-attributed (json_ld_leak)'
  );
  assert.equal(
    sourceUnavailableComment('amazon_stub'),
    'Pipeline-attributed (amazon_stub)'
  );
});

test('sourceUnavailableComment: unknown reason produces a coherent comment', () => {
  assert.equal(
    sourceUnavailableComment('unknown'),
    'Pipeline-attributed (unknown)'
  );
});

test('logVerification posts payload and swallows failures', async () => {
  const mock = mockFetch(async () => ({ ok: true, json: async () => ({}) }));
  try {
    assert.doesNotThrow(() => logVerification({
      article_url: 'https://en.wikipedia.org/wiki/Foo',
      article_title: 'Foo',
      citation_number: '3',
      source_url: 'https://example.com',
      provider: 'publicai',
      verdict: 'SUPPORTED',
      confidence: 'High',
    }));
    assert.equal(mock.calls[0].url, 'https://publicai-proxy.alaexis.workers.dev/log');
    assert.equal(mock.calls[0].opts.method, 'POST');
  } finally {
    mock.restore();
  }
});
