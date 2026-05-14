import { test } from 'node:test';
import assert from 'node:assert/strict';

function mockFetch(impl) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return impl(url, opts);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('augmentWithCitoidStructured returns { sourceText, metadata } shape', async () => {
  // Import inside test to ensure mockFetch is set up first
  const { augmentWithCitoidStructured } = await import('../core/citoid.js');

  const mock = mockFetch(async (url) => {
    if (url.includes('/api/rest_v1/data/citation/')) {
      return {
        ok: true,
        json: async () => ([{
          publicationTitle: 'Example Publication',
          date: '2026-05-08',
          title: 'Example Article',
        }]),
      };
    }
    throw new Error('unexpected URL: ' + url);
  });
  try {
    const result = await augmentWithCitoidStructured(
      'the original source body',
      'https://example.com/doc'
    );
    assert.equal(typeof result.sourceText, 'string');
    assert.ok(result.sourceText.includes('"publication": "Example Publication"'));
    assert.ok(result.sourceText.includes('the original source body'));
    assert.equal(typeof result.metadata, 'object');
    assert.equal(result.metadata.publication, 'Example Publication');
    assert.equal(result.metadata.published, '2026-05-08');
  } finally {
    mock.restore();
  }
});

test('augmentWithCitoidStructured returns metadata=null when citoid fails', async () => {
  const { augmentWithCitoidStructured } = await import('../core/citoid.js');

  const mock = mockFetch(async () => ({ ok: false, json: async () => ({}) }));
  try {
    const result = await augmentWithCitoidStructured('body', 'https://example.com/doc');
    assert.equal(result.sourceText, 'body');
    assert.equal(result.metadata, null);
  } finally {
    mock.restore();
  }
});
