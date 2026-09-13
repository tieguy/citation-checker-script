# Userscript Browser Tests — Phase 3: Mock Worker Helper

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Provide deterministic, per-test-configurable mocks for the three Cloudflare-Worker endpoints `main.js` calls. No real network ever leaves the test runner.

**Architecture:** A single ESM module `mock-worker.js` exporting `setupWorkerMocks(page, overrides)` and `getMockState(page)`. Intercepts three endpoints via `page.route()`:
- `GET https://publicai-proxy.alaexis.workers.dev/?fetch=…` → returns a fixed source-text JSON body.
- `POST https://publicai-proxy.alaexis.workers.dev/` (no path) → returns a fixed LLM verdict JSON.
- `POST https://publicai-proxy.alaexis.workers.dev/log` → returns `{ok: true}` and records the payload onto `window.__loggedVerifications`.

Also blocks direct calls to Anthropic/OpenAI/Gemini/OpenRouter origins to fail fast if a test accidentally selects a non-PublicAI provider.

**Tech Stack:** Playwright `page.route()` API; uses `route.fulfill()` with CORS headers; OPTIONS preflight handled explicitly.

**Scope:** Phase 3 of 5.

**Codebase verified:** 2026-05-14. Endpoints confirmed via grep of `main.js`:
- Source fetch: GET to `${workerBase}/?fetch=<encoded-url>&page=<n>` (main.js:647). Worker default `https://publicai-proxy.alaexis.workers.dev`.
- LLM (PublicAI route): POST to base worker URL (main.js:445).
- Log: POST to `${workerBase}/log` (main.js:693).
- No Citoid calls on `origin/main` (PR #203 not merged).

---

## Task 1: Create the mock-worker helper

**Files:**
- Create: `tests/e2e/fixtures/mock-worker.js`

**Step 1: Write the helper**

Create `tests/e2e/fixtures/mock-worker.js`:

```javascript
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
  const map = {
    'https://example.com/source-1': 'Source 1 fully supports the claim that the sky is blue.',
    'https://example.com/source-2': 'Source 2 mentions the color green tangentially.',
  };
  const content = map[url] || `Generic source content for ${url}.`;
  return { content, truncated: false, pdf: false, totalPages: 1, page: 1 };
}

function defaultLlmResponse() {
  // OpenAI-compatible chat completion shape (what the PublicAI route returns).
  return {
    id: 'mock-id',
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify({
            verdict: 'Supported',
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

    // LLM call: POST to base worker URL (no path or empty path).
    if (method === 'POST' && (url.pathname === '/' || url.pathname === '')) {
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
```

**Step 2: Syntax check**

```bash
node --check tests/e2e/fixtures/mock-worker.js
```

Expected: no output, exits 0.

**Step 3: Commit**

```bash
git add tests/e2e/fixtures/mock-worker.js
git commit -m "test(e2e): add worker-endpoint mocks with override hooks"
```

---

## Phase 3 Done When

- `tests/e2e/fixtures/mock-worker.js` exists, exports `setupWorkerMocks` and `getMockState`, and passes `node --check`.
- One new commit.

**What's deliberately not verified:** that the mock URL patterns actually match what `main.js` requests. Phase 4's smoke test will exercise the GET-source-fetch path; Phase 5 exercises the POST-LLM and POST-log paths. If the URL patterns don't match (e.g. main.js sends a different query parameter shape), revisit here.
