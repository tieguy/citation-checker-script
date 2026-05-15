import { test, expect } from '@playwright/test';
import { loadUserscript } from './fixtures/load-userscript.js';
import { setupWorkerMocks } from './fixtures/mock-worker.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_ARTICLE_FIXTURE = path.join(__dirname, 'fixtures', 'real-article.html');

// Seed provider and sidebar visibility so test can verify sidebar mounts and claim extraction works.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('source_verifier_provider', 'huggingface');
      window.localStorage.setItem('verifier_sidebar_visible', 'true');
      window.localStorage.setItem('verifier_first_run_done', 'true');
    } catch (e) { /* ignore in environments without storage */ }
  });
});

test.describe('real Wikipedia article fixture', () => {
  test('loads on a real Wikipedia article fixture and mounts the sidebar', async ({ page }) => {
    // Capture console errors and page errors before loading to catch init-time errors.
    const consoleMessages = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleMessages.push(`pageerror: ${err.message}`);
    });

    await setupWorkerMocks(page);
    await loadUserscript(page, { fixturePath: REAL_ARTICLE_FIXTURE });

    // Sidebar should attach successfully.
    const sidebar = page.locator('#source-verifier-sidebar');
    await expect(sidebar).toBeAttached({ timeout: 5000 });

    // Give a brief moment for any deferred errors to surface.
    await page.waitForTimeout(500);
    // Verify no console errors during load or deferred execution.
    expect(consoleMessages, `unexpected console errors:\n${consoleMessages.join('\n')}`).toEqual([]);
  });

  test('clicking a reference in a real Wikipedia article populates the claim', async ({ page }) => {
    await setupWorkerMocks(page);
    await loadUserscript(page, { fixturePath: REAL_ARTICLE_FIXTURE });

    // Click the stable [1] reference marker.
    // Real article has: "Gehry originally called the house Ginger and Fred (after the dancers Ginger Rogers and Fred Astaire – the house resembles a pair of dancers),[1]"
    await page.locator('sup#cite_ref-1 a').click();

    const claim = page.locator('#verifier-claim-text');
    // Verify that a unique phrase from the [1] claim context appears. "Gehry originally called the house" is unique to [1].
    await expect(claim).toContainText('Gehry originally called the house', { timeout: 5000 });
  });
});
