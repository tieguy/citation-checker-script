import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { HELP_TEXT, main, parseCliArgs, parseWikiUrl, deriveRestUrl, findReferenceByCitationNumber, runVerify } from '../cli/verify.js';

function args(...rest) {
  return ['node', 'bin/ccs', ...rest];
}

test('parseCliArgs: help flag', () => {
  const result = parseCliArgs(args('--help'));
  assert.equal(result.help, true);
});

test('parseCliArgs: short help flag', () => {
  const result = parseCliArgs(args('-h'));
  assert.equal(result.help, true);
});

test('parseCliArgs: empty argv is treated as help', () => {
  const result = parseCliArgs(args());
  assert.equal(result.help, true);
});

test('parseCliArgs: verify subcommand with url and citation number', () => {
  const result = parseCliArgs(args('verify', 'https://en.wikipedia.org/wiki/Foo', '3'));
  assert.equal(result.help, false);
  assert.equal(result.subcommand, 'verify');
  assert.equal(result.url, 'https://en.wikipedia.org/wiki/Foo');
  assert.equal(result.citationNumber, 3);
  assert.equal(result.provider, 'hf-qwen3-32b');
  assert.equal(result.noLog, false);
});

test('parseCliArgs: --provider overrides default', () => {
  const result = parseCliArgs(args('verify', 'https://en.wikipedia.org/wiki/Foo', '3', '--provider', 'claude-sonnet-4-5'));
  assert.equal(result.provider, 'claude-sonnet-4-5');
});

test('parseCliArgs: --no-log sets noLog true', () => {
  const result = parseCliArgs(args('verify', 'https://en.wikipedia.org/wiki/Foo', '3', '--no-log'));
  assert.equal(result.noLog, true);
});

test('parseCliArgs: throws on unknown subcommand', () => {
  assert.throws(
    () => parseCliArgs(args('banana', 'https://en.wikipedia.org/wiki/Foo', '3')),
    /unknown subcommand: banana/i,
  );
});

test('parseCliArgs: throws on verify with missing url', () => {
  assert.throws(
    () => parseCliArgs(args('verify')),
    /usage/i,
  );
});

test('parseCliArgs: throws on verify with missing citation number', () => {
  assert.throws(
    () => parseCliArgs(args('verify', 'https://en.wikipedia.org/wiki/Foo')),
    /usage/i,
  );
});

test('parseCliArgs: throws on non-numeric citation number', () => {
  assert.throws(
    () => parseCliArgs(args('verify', 'https://en.wikipedia.org/wiki/Foo', 'abc')),
    /citation number must be a positive integer/i,
  );
});

test('parseCliArgs: throws on citation number 0 or negative', () => {
  assert.throws(
    () => parseCliArgs(args('verify', 'https://en.wikipedia.org/wiki/Foo', '0')),
    /citation number must be a positive integer/i,
  );
});

test('parseWikiUrl: plain article URL', () => {
  const result = parseWikiUrl('https://en.wikipedia.org/wiki/Great_Migration_(African_American)');
  assert.equal(result.title, 'Great_Migration_(African_American)');
  assert.equal(result.oldid, null);
});

test('parseWikiUrl: article URL with oldid', () => {
  const result = parseWikiUrl('https://en.wikipedia.org/wiki/Foo?oldid=1234567');
  assert.equal(result.title, 'Foo');
  assert.equal(result.oldid, '1234567');
});

test('parseWikiUrl: article URL with oldid and other params', () => {
  const result = parseWikiUrl('https://en.wikipedia.org/wiki/Foo?oldid=1234567&useskin=vector');
  assert.equal(result.title, 'Foo');
  assert.equal(result.oldid, '1234567');
});

test('parseWikiUrl: percent-encoded parentheses decode to raw', () => {
  const result = parseWikiUrl('https://en.wikipedia.org/wiki/Great_Migration_%28African_American%29');
  assert.equal(result.title, 'Great_Migration_(African_American)');
});

test('parseWikiUrl: http (not https) accepted', () => {
  const result = parseWikiUrl('http://en.wikipedia.org/wiki/Foo');
  assert.equal(result.title, 'Foo');
});

test('parseWikiUrl: trailing slash on title rejected', () => {
  assert.throws(
    () => parseWikiUrl('https://en.wikipedia.org/wiki/'),
    /could not extract article title/i,
  );
});

test('parseWikiUrl: non-wikipedia host rejected', () => {
  assert.throws(
    () => parseWikiUrl('https://example.com/wiki/Foo'),
    /must be an en\.wikipedia\.org/i,
  );
});

test('parseWikiUrl: /w/index.php?title= form rejected (not supported in Phase 1)', () => {
  assert.throws(
    () => parseWikiUrl('https://en.wikipedia.org/w/index.php?title=Foo&oldid=1234567'),
    /\/wiki\/<title>/i,
  );
});

test('parseWikiUrl: garbage input rejected', () => {
  assert.throws(
    () => parseWikiUrl('not a url'),
    /invalid URL/i,
  );
});

test('deriveRestUrl: no oldid', () => {
  const result = deriveRestUrl({ title: 'Foo', oldid: null });
  assert.equal(result, 'https://en.wikipedia.org/api/rest_v1/page/html/Foo');
});

test('deriveRestUrl: with oldid', () => {
  const result = deriveRestUrl({ title: 'Foo', oldid: '1234567' });
  assert.equal(result, 'https://en.wikipedia.org/api/rest_v1/page/html/Foo/1234567');
});

test('deriveRestUrl: title with parentheses is percent-encoded', () => {
  const result = deriveRestUrl({ title: 'Great_Migration_(African_American)', oldid: null });
  assert.equal(result, 'https://en.wikipedia.org/api/rest_v1/page/html/Great_Migration_(African_American)');
});

test('deriveRestUrl: title with slash is percent-encoded', () => {
  // Wikipedia article titles can contain slashes (e.g. subpages on Meta wikis);
  // don't treat a slash as a path separator.
  const result = deriveRestUrl({ title: 'AC/DC', oldid: null });
  assert.equal(result, 'https://en.wikipedia.org/api/rest_v1/page/html/AC%2FDC');
});

function mkDoc(html) {
  return new JSDOM(`<!DOCTYPE html><body>${html}</body>`).window.document;
}

test('findReferenceByCitationNumber: finds the reference with matching text', () => {
  const doc = mkDoc(`
    <p>Sentence one.<sup class="reference"><a href="#cite_note-1">[1]</a></sup>
    Sentence two.<sup class="reference"><a href="#cite_note-2">[2]</a></sup></p>
  `);
  const ref = findReferenceByCitationNumber(doc, 2);
  assert.ok(ref, 'expected to find citation [2]');
  assert.equal(ref.tagName, 'SUP');
  assert.ok(ref.textContent.includes('[2]'));
});

test('findReferenceByCitationNumber: returns null when citation number not present', () => {
  const doc = mkDoc(`
    <p>Only one citation.<sup class="reference"><a href="#cite_note-1">[1]</a></sup></p>
  `);
  const ref = findReferenceByCitationNumber(doc, 5);
  assert.equal(ref, null);
});

test('findReferenceByCitationNumber: tolerates whitespace inside the sup', () => {
  const doc = mkDoc(`
    <p>A.<sup class="reference">  <a href="#cite_note-1">[1]</a>  </sup></p>
  `);
  const ref = findReferenceByCitationNumber(doc, 1);
  assert.ok(ref, 'expected to tolerate whitespace');
});

test('findReferenceByCitationNumber: does not match [10] when asked for [1]', () => {
  const doc = mkDoc(`
    <p>Ten.<sup class="reference"><a href="#cite_note-10">[10]</a></sup></p>
  `);
  const ref = findReferenceByCitationNumber(doc, 1);
  assert.equal(ref, null);
});

test('findReferenceByCitationNumber: returns the first match when a ref is reused', () => {
  // Wikipedia reuses a <ref name="..."> by rendering [5] multiple times at
  // different positions. We want the first occurrence because that's where
  // the claim text lives on the initial citation.
  const doc = mkDoc(`
    <p>First use.<sup class="reference" id="first"><a href="#cite_note-x">[5]</a></sup>
    Something else.<sup class="reference" id="second"><a href="#cite_note-x">[5]</a></sup></p>
  `);
  const ref = findReferenceByCitationNumber(doc, 5);
  assert.ok(ref);
  assert.equal(ref.id, 'first');
});


function mkFetchMock(routes) {
  // routes: [{ match: (url, opts) => boolean, respond: async (url, opts) => Response-like }]
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    for (const route of routes) {
      if (route.match(url, opts)) return route.respond(url, opts);
    }
    throw new Error(`unmocked fetch: ${url}`);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function mkStream() {
  const chunks = [];
  return {
    write: (s) => { chunks.push(s); return true; },
    value: () => chunks.join(''),
  };
}

const WIKI_HTML_WITH_ONE_CITATION = `
<!DOCTYPE html><html><body>
<div class="mw-parser-output">
  <p>The sky is blue on clear days.<sup class="reference" id="cite_ref-1"><a href="#cite_note-1">[1]</a></sup></p>
  <ol class="references">
    <li id="cite_note-1">Smith, <a href="https://example.com/source">Study on sky color</a>, 2020.</li>
  </ol>
</div>
</body></html>
`;

test('runVerify: success path prints verdict and returns 0', async () => {
  const mock = mkFetchMock([
    {
      match: (url) => String(url).startsWith('https://en.wikipedia.org/api/rest_v1/'),
      respond: async () => ({ ok: true, status: 200, text: async () => WIKI_HTML_WITH_ONE_CITATION }),
    },
    {
      match: (url) => String(url).includes('publicai-proxy.alaexis.workers.dev') && String(url).includes('?fetch='),
      // Body padded above SHORT_BODY_FLOOR (300 chars in core/body-classifier.js).
      respond: async () => ({ ok: true, json: async () => ({ content: 'The sky is indeed blue due to Rayleigh scattering. ' + 'Sunlight entering the atmosphere is scattered by gas molecules, with shorter wavelengths (blue) scattering more strongly than longer ones (red), producing the characteristic blue color we see overhead during daytime. '.repeat(2) }) }),
    },
    {
      match: (url, opts) => String(url) === 'https://publicai-proxy.alaexis.workers.dev' && opts?.method === 'POST',
      respond: async () => ({
        ok: true, status: 200, json: async () => ({
          choices: [{ message: { content: '{"verdict": "SUPPORTED", "confidence": 92, "comments": "matches source"}' } }],
          usage: { prompt_tokens: 50, completion_tokens: 20 },
        }),
      }),
    },
    {
      match: (url) => String(url).endsWith('/log'),
      respond: async () => ({ ok: true, json: async () => ({}) }),
    },
  ]);
  const stdout = mkStream();
  const stderr = mkStream();
  try {
    const code = await runVerify(
      { url: 'https://en.wikipedia.org/wiki/Sky', citationNumber: 1, provider: 'apertus-70b', atomized: false, noLog: true },
      { stdout, stderr, env: { PUBLICAI_API_KEY: 'test-key' } },
    );
    assert.equal(code, 0, `stderr: ${stderr.value()}`);
    assert.match(stdout.value(), /Verdict:\s+SUPPORTED/);
    assert.match(stdout.value(), /Confidence:\s+92/);
  } finally {
    mock.restore();
  }
});

test('runVerify: missing API key returns 8', async () => {
  const stdout = mkStream();
  const stderr = mkStream();
  const code = await runVerify(
    { url: 'https://en.wikipedia.org/wiki/Sky', citationNumber: 1, provider: 'claude-sonnet-4-5', noLog: true },
    { stdout, stderr, env: {} }, // No ANTHROPIC_API_KEY
  );
  assert.equal(code, 8, `stderr: ${stderr.value()}`);
  assert.match(stderr.value(), /ANTHROPIC_API_KEY/);
});

test('runVerify: Wikipedia 404 returns 3', async () => {
  const mock = mkFetchMock([
    {
      match: (url) => String(url).startsWith('https://en.wikipedia.org/api/rest_v1/'),
      respond: async () => ({ ok: false, status: 404, text: async () => 'Not found' }),
    },
  ]);
  const stdout = mkStream();
  const stderr = mkStream();
  try {
    const code = await runVerify(
      { url: 'https://en.wikipedia.org/wiki/Doesnotexist', citationNumber: 1, provider: 'apertus-70b', atomized: false, noLog: true },
      { stdout, stderr, env: { PUBLICAI_API_KEY: 'test-key' } },
    );
    assert.equal(code, 3, `stderr: ${stderr.value()}`);
    assert.match(stderr.value(), /not found/i);
  } finally {
    mock.restore();
  }
});

test('runVerify: missing citation number returns 5', async () => {
  const mock = mkFetchMock([
    {
      match: (url) => String(url).startsWith('https://en.wikipedia.org/api/rest_v1/'),
      respond: async () => ({ ok: true, status: 200, text: async () => WIKI_HTML_WITH_ONE_CITATION }),
    },
  ]);
  const stdout = mkStream();
  const stderr = mkStream();
  try {
    const code = await runVerify(
      { url: 'https://en.wikipedia.org/wiki/Sky', citationNumber: 99, provider: 'apertus-70b', atomized: false, noLog: true },
      { stdout, stderr, env: { PUBLICAI_API_KEY: 'test-key' } },
    );
    assert.equal(code, 5);
    assert.match(stderr.value(), /\[99\]/);
  } finally {
    mock.restore();
  }
});

test('runVerify: provider=hf-qwen3-32b without HF_TOKEN returns error code 8', async () => {
  const stdout = mkStream();
  const stderr = mkStream();
  // Don't mock fetch since we should exit before reaching it
  const code = await runVerify(
    { url: 'https://en.wikipedia.org/wiki/Sky', citationNumber: 1, provider: 'hf-qwen3-32b', atomized: false, noLog: true },
    { stdout, stderr, env: {} }, // No HF_TOKEN
  );
  assert.equal(code, 8, 'should exit with error code 8 for missing API key');
  assert.match(stderr.value(), /missing API key/i);
});

test('runVerify: provider=hf-qwen3-32b with HF_TOKEN hits HF router with Bearer header', async () => {
  const mock = mkFetchMock([
    {
      match: (url) => String(url).startsWith('https://en.wikipedia.org/api/rest_v1/'),
      respond: async () => ({ ok: true, status: 200, text: async () => WIKI_HTML_WITH_ONE_CITATION }),
    },
    {
      match: (url) => String(url).includes('?fetch='),
      respond: async () => ({ ok: true, json: async () => ({ content: 'x'.repeat(300) }) }),
    },
    {
      match: (url, opts) => String(url) === 'https://router.huggingface.co/v1/chat/completions' && opts?.method === 'POST',
      respond: async (_url, opts) => {
        assert.equal(opts.headers['Authorization'], 'Bearer hf_test_key');
        return {
          ok: true, status: 200, json: async () => ({
            choices: [{ message: { content: '{"verdict":"SUPPORTED","confidence":80,"comments":"ok"}' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        };
      },
    },
  ]);
  const stdout = mkStream();
  const stderr = mkStream();
  try {
    const code = await runVerify(
      { url: 'https://en.wikipedia.org/wiki/Sky', citationNumber: 1, provider: 'hf-qwen3-32b', atomized: false, noLog: true },
      { stdout, stderr, env: { HF_TOKEN: 'hf_test_key' } },
    );
    assert.equal(code, 0, `stderr: ${stderr.value()}`);
  } finally {
    mock.restore();
  }
});

test('runVerify: provider 500 returns 10', async () => {
  const mock = mkFetchMock([
    {
      match: (url) => String(url).startsWith('https://en.wikipedia.org/api/rest_v1/'),
      respond: async () => ({ ok: true, status: 200, text: async () => WIKI_HTML_WITH_ONE_CITATION }),
    },
    {
      match: (url) => String(url).includes('?fetch='),
      respond: async () => ({ ok: true, json: async () => ({ content: 'x'.repeat(300) }) }),
    },
    {
      match: (url, opts) => String(url) === 'https://publicai-proxy.alaexis.workers.dev' && opts?.method === 'POST',
      respond: async () => ({ ok: false, status: 500, text: async () => 'boom' }),
    },
  ]);
  const stdout = mkStream();
  const stderr = mkStream();
  try {
    const code = await runVerify(
      { url: 'https://en.wikipedia.org/wiki/Sky', citationNumber: 1, provider: 'apertus-70b', atomized: false, noLog: true },
      { stdout, stderr, env: { PUBLICAI_API_KEY: 'test-key' } },
    );
    assert.equal(code, 10, `stderr: ${stderr.value()}`);
  } finally {
    mock.restore();
  }
});

test('runVerify: malformed LLM JSON returns 11', async () => {
  const mock = mkFetchMock([
    {
      match: (url) => String(url).startsWith('https://en.wikipedia.org/api/rest_v1/'),
      respond: async () => ({ ok: true, status: 200, text: async () => WIKI_HTML_WITH_ONE_CITATION }),
    },
    {
      match: (url) => String(url).includes('?fetch='),
      respond: async () => ({ ok: true, json: async () => ({ content: 'x'.repeat(300) }) }),
    },
    {
      match: (url, opts) => String(url) === 'https://publicai-proxy.alaexis.workers.dev' && opts?.method === 'POST',
      respond: async () => ({
        ok: true, status: 200, json: async () => ({
          choices: [{ message: { content: 'this is not json at all' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      }),
    },
  ]);
  const stdout = mkStream();
  const stderr = mkStream();
  try {
    const code = await runVerify(
      { url: 'https://en.wikipedia.org/wiki/Sky', citationNumber: 1, provider: 'apertus-70b', atomized: false, noLog: true },
      { stdout, stderr, env: { PUBLICAI_API_KEY: 'test-key' } },
    );
    assert.equal(code, 11);
    assert.match(stderr.value(), /malformed/i);
  } finally {
    mock.restore();
  }
});

test('runVerify: logs to /log endpoint when noLog is false', async () => {
  let logPayload = null;
  const mock = mkFetchMock([
    {
      match: (url) => String(url).startsWith('https://en.wikipedia.org/api/rest_v1/'),
      respond: async () => ({ ok: true, status: 200, text: async () => WIKI_HTML_WITH_ONE_CITATION }),
    },
    {
      match: (url) => String(url).includes('?fetch='),
      respond: async () => ({ ok: true, json: async () => ({ content: 'x'.repeat(300) }) }),
    },
    {
      match: (url, opts) => String(url) === 'https://publicai-proxy.alaexis.workers.dev' && opts?.method === 'POST',
      respond: async () => ({
        ok: true, status: 200, json: async () => ({
          choices: [{ message: { content: '{"verdict": "SUPPORTED", "confidence": 90, "comments": "ok"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      }),
    },
    {
      match: (url) => String(url).endsWith('/log'),
      respond: async (_url, opts) => {
        logPayload = JSON.parse(opts.body);
        return { ok: true, json: async () => ({}) };
      },
    },
  ]);
  const stdout = mkStream();
  const stderr = mkStream();
  try {
    const code = await runVerify(
      { url: 'https://en.wikipedia.org/wiki/Sky', citationNumber: 1, provider: 'apertus-70b', atomized: false, noLog: false },
      { stdout, stderr, env: { PUBLICAI_API_KEY: 'test-key' } },
    );
    assert.equal(code, 0, `stderr: ${stderr.value()}`);
    // The log fetch is fire-and-forget (not awaited in core/worker.js), so
    // give it one tick to land before asserting on the captured payload.
    await new Promise((r) => setImmediate(r));
    assert.ok(logPayload, 'expected /log endpoint to have been called');
    assert.equal(logPayload.verdict, 'SUPPORTED');
    assert.equal(logPayload.provider, 'apertus-70b');
    assert.equal(logPayload.citation_number, '1');
    assert.equal(logPayload.article_title, 'Sky');
  } finally {
    mock.restore();
  }
});

test('runVerify: logs article title with literal percent character correctly', async () => {
  // Regression test for redundant decodeURIComponent: titles containing a
  // literal "%" (e.g., "100%") should not crash the log path.
  // parseWikiUrl already decodes %25 → %, so by the time it reaches the log
  // block, parsedWikiUrl.title is already decoded. Calling decodeURIComponent
  // again would throw URIError for titles with a literal %.
  let logPayload = null;
  const mock = mkFetchMock([
    {
      match: (url) => String(url).startsWith('https://en.wikipedia.org/api/rest_v1/'),
      respond: async () => ({ ok: true, status: 200, text: async () => WIKI_HTML_WITH_ONE_CITATION }),
    },
    {
      match: (url) => String(url).includes('?fetch='),
      respond: async () => ({ ok: true, json: async () => ({ content: 'x'.repeat(300) }) }),
    },
    {
      match: (url, opts) => String(url) === 'https://publicai-proxy.alaexis.workers.dev' && opts?.method === 'POST',
      respond: async () => ({
        ok: true, status: 200, json: async () => ({
          choices: [{ message: { content: '{"verdict": "SUPPORTED", "confidence": 85, "comments": "ok"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      }),
    },
    {
      match: (url) => String(url).endsWith('/log'),
      respond: async (_url, opts) => {
        logPayload = JSON.parse(opts.body);
        return { ok: true, json: async () => ({}) };
      },
    },
  ]);
  const stdout = mkStream();
  const stderr = mkStream();
  try {
    // %25 is the URL-encoded form of %; it decodes to literal "100%"
    const code = await runVerify(
      { url: 'https://en.wikipedia.org/wiki/100%25', citationNumber: 1, provider: 'apertus-70b', atomized: false, noLog: false },
      { stdout, stderr, env: { PUBLICAI_API_KEY: 'test-key' } },
    );
    assert.equal(code, 0, `stderr: ${stderr.value()}`);
    await new Promise((r) => setImmediate(r));
    assert.ok(logPayload, 'expected /log endpoint to have been called');
    assert.equal(logPayload.article_title, '100%', 'article title should have literal % character');
  } finally {
    mock.restore();
  }
});

test('runVerify: DOM traversal chain works against a realistic Wikipedia fixture', async () => {
  // A slightly more realistic HTML shape: multi-citation paragraph, named
  // reference with an anchor inside <span class="reference-text"> (closer
  // to how MediaWiki actually renders cites). This exercises
  // findReferenceByCitationNumber + extractClaimText + extractReferenceUrl
  // without mocking any of them.
  const richHtml = `
    <div class="mw-parser-output">
      <p>Water boils at 100 degrees Celsius at sea level.<sup class="reference" id="cite_ref-1"><a href="#cite_note-first">[1]</a></sup>
      Under higher pressure the boiling point rises.<sup class="reference" id="cite_ref-2"><a href="#cite_note-second">[2]</a></sup></p>
      <ol class="references">
        <li id="cite_note-first"><span class="reference-text"><a class="external" href="https://example.com/first">First source</a></span></li>
        <li id="cite_note-second"><span class="reference-text"><a class="external" href="https://example.com/second">Second source</a></span></li>
      </ol>
    </div>
  `;

  const mock = mkFetchMock([
    {
      match: (url) => String(url).startsWith('https://en.wikipedia.org/api/rest_v1/'),
      respond: async () => ({ ok: true, status: 200, text: async () => richHtml }),
    },
    {
      match: (url) => String(url).includes('?fetch=https%3A%2F%2Fexample.com%2Fsecond'),
      // Body padded above SHORT_BODY_FLOOR (300 chars in core/body-classifier.js)
      // so the body-usability classifier passes it through to the LLM mock.
      respond: async () => ({ ok: true, json: async () => ({ content: 'At higher pressures the boiling point of water increases above 100 C. ' + 'Water exhibits its standard boiling point at 100 C only at one standard atmosphere of pressure; at altitude or under reduced pressure the boiling point drops, while pressure cookers and industrial autoclaves raise it well above that. '.repeat(2) }) }),
    },
    {
      match: (url, opts) => String(url) === 'https://publicai-proxy.alaexis.workers.dev' && opts?.method === 'POST',
      respond: async (_url, opts) => {
        // Assert on the claim text that was embedded in the user prompt:
        // should correspond to citation [2], not [1].
        const body = JSON.parse(opts.body);
        const userMessage = body.messages.find((m) => m.role === 'user')?.content ?? '';
        assert.match(userMessage, /higher pressure/i, 'user prompt should contain the [2] claim');
        assert.doesNotMatch(userMessage, /sea level/i, 'user prompt should NOT contain the [1] claim');
        return {
          ok: true, status: 200, json: async () => ({
            choices: [{ message: { content: '{"verdict": "SUPPORTED", "confidence": 88, "comments": "matches"}' } }],
            usage: { prompt_tokens: 50, completion_tokens: 10 },
          }),
        };
      },
    },
  ]);

  const stdout = mkStream();
  const stderr = mkStream();
  try {
    const code = await runVerify(
      { url: 'https://en.wikipedia.org/wiki/Boiling_point', citationNumber: 2, provider: 'apertus-70b', atomized: false, noLog: true },
      { stdout, stderr, env: { PUBLICAI_API_KEY: 'test-key' } },
    );
    assert.equal(code, 0, `stderr: ${stderr.value()}`);
    assert.match(stdout.value(), /Source:\s+https:\/\/example\.com\/second/);
  } finally {
    mock.restore();
  }
});

test('HELP_TEXT: documents the verify subcommand usage', () => {
  assert.match(HELP_TEXT, /ccs verify <wikipedia-url> <citation-number>/);
});

test('HELP_TEXT: documents --provider option', () => {
  assert.match(HELP_TEXT, /--provider/);
});

test('HELP_TEXT: documents --no-log', () => {
  assert.match(HELP_TEXT, /--no-log/);
});

test('HELP_TEXT: documents the API key requirement and at least 2 real provider keys', () => {
  assert.match(HELP_TEXT, /requires/i);
  // At least 2 provider keys should be documented (e.g., claude-sonnet-4-5, gemini-2.5-flash)
  assert.match(HELP_TEXT, /claude-sonnet-4-5/);
  assert.match(HELP_TEXT, /gemini-2.5-flash/);
  // Environment variable mappings should be documented
  assert.match(HELP_TEXT, /ANTHROPIC_API_KEY/);
  assert.match(HELP_TEXT, /GEMINI_API_KEY/);
});

test('HELP_TEXT: documents every exit code from the error table', () => {
  // Exit codes from docs/design-plans/2026-04-23-factor-and-cli.md, minus the
  // success exit (0), which doesn't need to appear in a table of failures.
  const expectedCodes = ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
  for (const code of expectedCodes) {
    assert.match(HELP_TEXT, new RegExp(`\\b${code}\\b`), `HELP_TEXT missing exit code ${code}`);
  }
});

test('main() with --help writes HELP_TEXT to the injected stdout and returns 0', async () => {
  const stdout = mkStream();
  const stderr = mkStream();
  const code = await main(['node', 'bin/ccs', '--help'], { stdout, stderr, env: { PUBLICAI_API_KEY: 'test-key' } });
  assert.equal(code, 0, `stderr: ${stderr.value()}`);
  assert.match(stdout.value(), /ccs verify/);
  assert.match(stdout.value(), /Exit codes:/);
});

test('runVerify with unknown provider returns exit code 2', async () => {
  const stdout = mkStream();
  const stderr = mkStream();
  const code = await runVerify(
    { url: 'https://en.wikipedia.org/wiki/Sky', citationNumber: 1, provider: 'no-such-provider', atomized: false, noLog: true },
    { stdout, stderr, env: {} },
  );
  assert.equal(code, 2, 'should exit with code 2 for unknown provider');
  assert.match(stderr.value(), /unknown provider/i);
});

