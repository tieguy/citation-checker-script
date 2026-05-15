import { test, expect } from '@playwright/test';
import { loadUserscript } from './fixtures/load-userscript.js';
import { setupWorkerMocks } from './fixtures/mock-worker.js';

test.describe('smoke', () => {
  test('loads on a fixture page and mounts the sidebar', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`pageerror: ${err.message}`);
    });

    await setupWorkerMocks(page);
    await loadUserscript(page);

    await expect(page.locator('#source-verifier-sidebar')).toBeAttached();

    // No uncaught errors during init.
    expect(consoleErrors, `unexpected console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
