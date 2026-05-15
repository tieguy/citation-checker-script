// Per-test mocks for the Cloudflare Worker endpoints called by main.js.
// Usage in a spec:
//   await setupWorkerMocks(page);                                       // happy path
//   await setupWorkerMocks(page, { llm: { verdict: 'Not supported' } }); // override verdict

const WORKER_HOST = 'publicai-proxy.alaexis.workers.dev';
const BLOCKED_LLM_HOSTS = [
  'api.anthropic.com',
  'api.openai.com',
  'generativelanguage.googleapis.com',
  'openrouter.ai',
];

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': '*',
};

function defaultFetchResponse(url) {
  // Map source URLs to deterministic text for assertion in tests.
  // Content must be > 100 chars to pass the minimum-content-length check in
  // fetchSourceContent(), AND > 300 chars to pass core/body-classifier.js's
  // SHORT_BODY_FLOOR on branches where the body-usability classifier is wired
  // in (e.g., body-classifier-on-pr203 / PR #217). Padding the strings keeps
  // tests passing on both pre- and post-classifier code paths.
  const map = {
    'https://example.com/source-1': 'Source 1 fully supports the claim that the sky is blue. This is a comprehensive source that discusses the color and properties of the sky in detail. The evidence is clear and direct. Multiple paragraphs cover atmospheric science, light scattering, and historical observations to substantiate the claim with rigor and clarity for the reader.',
    'https://example.com/source-2': 'Source 2 mentions the color green tangentially. While the article discusses many colors, green appears in the context of grass and vegetation. The reference is relevant to botanical claims. The text continues with discussions of chlorophyll, photosynthesis, and the visible-light spectrum, providing supporting background context.',
  };
  const content = map[url] || `Generic source content for ${url}. This is placeholder content to ensure minimum length requirements are met for the fetch response. Additional substantive prose is appended so the body-usability classifier does not flag the response as short_body during e2e test runs. The fallback text includes enough body to clear the SHORT_BODY_FLOOR threshold defined in core/body-classifier.js.`;
  return { content, truncated: false, pdf: false, totalPages: 1, page: 1 };
}

function defaultLlmResponse() {
  // OpenAI-compatible chat completion shape (what the PublicAI route returns).
  // Note: verdict must be in UPPERCASE (SUPPORTED, NOT SUPPORTED, etc.) to match main.js display logic.
  return {
    id: 'mock-id',
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify({
            verdict: 'SUPPORTED',
            confidence: 'High',
            comments: 'Mock verdict from setupWorkerMocks default.',
          }),
        },
        finish_reason: 'stop',
      },
    ],
  };
}

/**
 * Install request interception for the Cloudflare Worker endpoints.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [overrides]
 * @param {function|object} [overrides.fetch]    For `?fetch=` GET. (url) => responseObj, or static obj, or {status, body}.
 * @param {function|object} [overrides.llm]      For LLM POST. (requestBody) => responseObj, or static {verdict, confidence, comments}.
 * @param {function|object} [overrides.log]      For /log POST. (requestBody) => responseObj, or static obj.
 */
export async function setupWorkerMocks(page, overrides = {}) {
  // Initialize per-page state buckets. These live on window so tests can read them via page.evaluate.
  await page.addInitScript(() => {
    window.__loggedVerifications = [];
    window.__fetchedUrls = [];
    window.__llmRequests = [];
  });

  // ---- Worker host: intercept everything ----
  await page.route(`https://${WORKER_HOST}/**`, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    // /log endpoint
    if (url.pathname === '/log' && method === 'POST') {
      const body = safeJson(request.postData());
      await page.evaluate((b) => { window.__loggedVerifications.push(b); }, body);
      const payload = resolveOverride(overrides.log, body, { ok: true });
      await fulfillJson(route, payload);
      return;
    }

    // Source fetch: GET with ?fetch=<url>
    if (method === 'GET' && url.searchParams.has('fetch')) {
      const fetchUrl = url.searchParams.get('fetch');
      await page.evaluate((u) => { window.__fetchedUrls.push(u); }, fetchUrl);
      const override = overrides.fetch;
      const payload = resolveOverride(override, fetchUrl, defaultFetchResponse(fetchUrl));
      // {status, body} shape lets a test inject errors.
      if (payload && typeof payload === 'object' && 'status' in payload && payload.status !== 200) {
        await route.fulfill({
          status: payload.status,
          headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
          body: JSON.stringify(payload.body || { error: 'Mock fetch error' }),
        });
        return;
      }
      await fulfillJson(route, payload);
      return;
    }

    // LLM call: POST to base worker URL (no path or empty path) or /hf (HuggingFace route).
    if (method === 'POST' && (url.pathname === '/' || url.pathname === '' || url.pathname === '/hf')) {
      const body = safeJson(request.postData());
      await page.evaluate((b) => { window.__llmRequests.push(b); }, body);
      const override = overrides.llm;
      let resolved;
      if (typeof override === 'function') {
        resolved = override(body);
      } else if (override && typeof override === 'object') {
        // Compact override: { verdict, confidence?, comments? } -> wrap in OpenAI shape.
        if ('verdict' in override) {
          resolved = {
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  verdict: override.verdict,
                  confidence: override.confidence || 'High',
                  comments: override.comments || 'Mock override.',
                }),
              },
              finish_reason: 'stop',
            }],
          };
        } else {
          resolved = override;
        }
      } else {
        resolved = defaultLlmResponse();
      }
      await fulfillJson(route, resolved);
      return;
    }

    // Anything else under the worker host: fail loudly.
    await route.fulfill({
      status: 501,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ error: `mock-worker: unhandled ${method} ${url.pathname}` }),
    });
  });

  // ---- Block direct LLM API hosts (fail-fast) ----
  for (const host of BLOCKED_LLM_HOSTS) {
    await page.route(`https://${host}/**`, async (route) => {
      await route.fulfill({
        status: 599,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify({
          error: `mock-worker: direct call to ${host} blocked; tests should use the PublicAI route through the worker`,
        }),
      });
    });
  }
}

/**
 * Read the captured request log from the page.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{loggedVerifications: object[], fetchedUrls: string[], llmRequests: object[], mwNotifications: object[]}>}
 */
export async function getMockState(page) {
  return page.evaluate(() => ({
    loggedVerifications: window.__loggedVerifications || [],
    fetchedUrls: window.__fetchedUrls || [],
    llmRequests: window.__llmRequests || [],
    mwNotifications: window.__mwNotifications || [],
  }));
}

// ---- internal helpers ----

function safeJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function fulfillJson(route, payload) {
  await route.fulfill({
    status: 200,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function resolveOverride(override, input, fallback) {
  if (override == null) return fallback;
  if (typeof override === 'function') return override(input);
  return override;
}
