import { test, expect } from '@playwright/test';
import { loadUserscript } from './fixtures/load-userscript.js';
import { setupWorkerMocks, getMockState } from './fixtures/mock-worker.js';

// Seed provider and sidebar visibility so LLM traffic routes through the mocked worker at /hf,
// and click handlers don't return early due to sidebar being hidden.
// Note: main.js:750-754 migrates legacy 'publicai'/'apertus' to 'huggingface', so we seed
// the target provider directly to keep routing clear.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('source_verifier_provider', 'huggingface');
      window.localStorage.setItem('verifier_sidebar_visible', 'true');
      // Suppress the first-run notification
      window.localStorage.setItem('verifier_first_run_done', 'true');
    } catch (e) { /* ignore in environments without storage */ }
  });
});

test.describe('verify flow', () => {
  test('clicking [1] populates the claim section with surrounding prose', async ({ page }) => {
    await setupWorkerMocks(page);
    await loadUserscript(page);

    await page.locator('sup.reference').first().locator('a').click();

    const claim = page.locator('#verifier-claim-text');
    await expect(claim).toContainText('sky is blue');
  });

  test('verify button → supported verdict renders with .supported class', async ({ page }) => {
    await setupWorkerMocks(page);  // default mock = Supported verdict
    await loadUserscript(page);

    await page.locator('sup.reference').first().locator('a').click();
    // Wait for the source to be fetched and the button to be enabled (not disabled).
    const verifyButton = page.getByRole('button', { name: 'Verify Claim' });
    await expect.poll(async () => {
      const isDisabled = await verifyButton.isDisabled();
      return !isDisabled;
    }, { timeout: 5000 }).toBeTruthy();
    await verifyButton.click();

    const verdict = page.locator('#verifier-verdict');
    await expect(verdict).toHaveClass(/\bsupported\b/, { timeout: 5000 });
    await expect(verdict).toContainText(/Supported/i);

    const state = await getMockState(page);
    expect(state.llmRequests.length).toBe(1);
    expect(state.loggedVerifications.length).toBe(1);
  });

  test('verify button → not-supported verdict shows Edit Section button', async ({ page }) => {
    await setupWorkerMocks(page, {
      llm: { verdict: 'NOT SUPPORTED', confidence: 'High', comments: 'Mock not-supported.' },
    });
    await loadUserscript(page);

    await page.locator('sup.reference').first().locator('a').click();
    // Wait for the source to be fetched and the button to be enabled (not disabled).
    const verifyButton = page.getByRole('button', { name: 'Verify Claim' });
    await expect.poll(async () => {
      const isDisabled = await verifyButton.isDisabled();
      return !isDisabled;
    }, { timeout: 5000 }).toBeTruthy();
    await verifyButton.click();

    const verdict = page.locator('#verifier-verdict');
    await expect(verdict).toHaveClass(/not-supported/, { timeout: 5000 });

    // Edit Section button only appears on failed verdicts.
    await expect(page.getByRole('button', { name: 'Edit Section' })).toBeVisible();
  });

  test('worker fetch error → source-text fallback shown', async ({ page }) => {
    await setupWorkerMocks(page, {
      fetch: { status: 500, body: { error: 'Source temporarily unavailable' } },
    });
    await loadUserscript(page);

    await page.locator('sup.reference').first().locator('a').click();

    // On fetch error, the source text input appears instead of displaying the fetched content.
    // This is the user-visible signal that the fetch failed.
    const sourceInput = page.locator('#verifier-source-text');
    await expect(sourceInput).toBeVisible({ timeout: 5000 });
    await expect(sourceInput).toContainText(/paste the source text/i);
  });

  test('click handlers attached to all reference markers (smoke for batch flow)', async ({ page }) => {
    await setupWorkerMocks(page);
    await loadUserscript(page);

    // Click [2] (not [1]) and assert claim section updates to reflect the second source.
    await page.locator('sup.reference').nth(1).locator('a').click();

    const claim = page.locator('#verifier-claim-text');
    await expect(claim).toContainText('grass is green');
  });
});
