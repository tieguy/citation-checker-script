import { test, expect } from '@playwright/test';
import { loadUserscript } from './fixtures/load-userscript.js';
import { setupWorkerMocks, getMockState } from './fixtures/mock-worker.js';

// Seed provider and sidebar visibility so LLM traffic routes through the mocked worker at /hf,
// and click handlers don't return early due to sidebar being hidden.
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

test.describe('source unavailable (SU) paths', () => {
  test('body-classifier rejection (wayback_chrome) routes to manual-paste UI without LLM call', async ({ page }) => {
    // Stub: fetch returns a Wayback-Machine chrome wrapper that body-classifier should
    // reject as wayback_chrome. The pattern is: "The Wayback Machine - https://..." at start,
    // with total length under CHROME_LENGTH_CAP (600 chars).
    // Build content that:
    //   - Matches the wayback_chrome regex (starts with "The Wayback Machine - https://")
    //   - Is under 600 chars (to trigger wayback_chrome, not let LLM handle it)
    //   - Over 100 chars (minimum content length for fetchSourceContent)
    //
    // According to body-classifier.js line 71: wayback_chrome detects on
    // /^The Wayback Machine - https?:\/\// in the head (SIGNATURE_LEN=500).
    const waybackContent =
      'The Wayback Machine - https://web.archive.org/web/20120324190450/http://example.org/ ' +
      'This is a captured page but the content is minimal and does not contain the article body. ' +
      'The Wayback Machine is a digital archive of the World Wide Web and other information on the Internet. ' +
      'It was founded in 1996. The archive contains petabytes of data and is accessed by historians, journalists, scholars, activists, and the general public.';
    // Total: ~428 chars, which is < 600 (CHROME_LENGTH_CAP), so wayback_chrome should fire.

    await setupWorkerMocks(page, {
      fetch: () => ({
        content: waybackContent,
        truncated: false,
        pdf: false,
        totalPages: 1,
        page: 1,
      }),
    });
    await loadUserscript(page);

    await page.locator('sup.reference').first().locator('a').click();

    // The textarea fallback should become visible (showSourceTextInput called from the SU branch).
    // The container is toggled by document.getElementById('verifier-source-input-container').style.display = 'block'
    await expect(page.locator('#verifier-source-input-container')).toBeVisible({ timeout: 5000 });

    // User-visible invariant: Verify button is disabled when activeSource is null.
    // On the SU path, body-classifier rejection prevents activeSource from being set.
    // This is the user-facing regression guard — if the button were enabled, the user could
    // accidentally trigger an LLM call, which would be a bug.
    const verifyButton = page.getByRole('button', { name: 'Verify Claim' });
    await expect(verifyButton).toBeDisabled({ timeout: 5000 });
  });

  test('batch report writes unified comments for fetch error and body-classifier reject rows', async ({ page }) => {
    // Stub two source URLs differently:
    //   source-1 → fetch error (500) → should produce "Could not fetch source content" comment
    //   source-2 → wayback chrome body (body-classifier reject) → should produce "Pipeline-attributed (wayback_chrome)" comment
    const waybackContent =
      'The Wayback Machine - https://web.archive.org/web/20120324190450/http://example.org/ ' +
      'A captured page without substantive content. The Wayback Machine archive covers petabytes of data. ' +
      'Historians and researchers use it frequently for reference and validation purposes. ' +
      'This particular snapshot contains only the chrome wrapper without the original article body.';

    await setupWorkerMocks(page, {
      fetch: (url) => {
        if (url === 'https://example.com/source-1') {
          // Return an HTTP error (fetch_failed path in worker.js)
          return { status: 500, body: { error: 'upstream timeout' } };
        }
        if (url === 'https://example.com/source-2') {
          // Return wayback chrome content (body-classifier reject path)
          return {
            content: waybackContent,
            truncated: false,
            pdf: false,
            totalPages: 1,
            page: 1,
          };
        }
        // fallback (shouldn't be hit, but provide a default for safety)
        return {
          content: 'default fallback content for other urls to pass body-classifier checks. '.repeat(5),
          truncated: false,
          pdf: false,
          totalPages: 1,
          page: 1,
        };
      },
    });
    await loadUserscript(page);

    // Trigger batch verification. The button is labeled "Verify All Citations" (main.js line 2149).
    const verifyAllBtn = page.getByRole('button', { name: 'Verify All Citations' });
    await expect(verifyAllBtn).toBeVisible({ timeout: 5000 });

    // Click the button. A confirmation dialog should appear (OO.ui.confirm in verifyAllCitations).
    const btnClickPromise = verifyAllBtn.click();

    // Wait positively for the OO.ui MessageDialog, then click its action button.
    // The dialog is rendered in the DOM with class 'oo-ui-messageDialog'.
    const dialog = page.locator('.oo-ui-messageDialog').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // The affirmative action button in OO.ui.confirm is the last button (OK/Yes).
    // First button is Cancel, second is the affirmative action.
    const buttons = dialog.getByRole('button');
    const buttonCount = await buttons.count();
    if (buttonCount < 2) {
      throw new Error(`Dialog has ${buttonCount} button(s), expected at least 2`);
    }
    const confirmButton = dialog.getByRole('button').nth(1);
    await confirmButton.click();

    await btnClickPromise;

    // Wait for batch verification to complete. Use card count as the unambiguous signal.
    await expect(page.locator('#verifier-report-results .verifier-report-card')).toHaveCount(2, { timeout: 15000 });

    const reportText = await page.locator('#verifier-report-results').textContent();

    // Verify both citations produced Unavailable verdicts
    const unavailableMatches = reportText.match(/\bUnavailable\b/g);
    expect(unavailableMatches?.length ?? 0).toBeGreaterThanOrEqual(2);

    // Verify the two different SU comment types were generated correctly
    expect(reportText).toContain('Could not fetch source content'); // fetch_failed path
    expect(reportText).toContain('Pipeline-attributed (wayback_chrome)'); // body-classifier reject path

    // Critical invariant: zero LLM calls in batch SU path
    const state = await getMockState(page);
    expect(state.llmRequests.length, 'batch SU path must not call LLM').toBe(0);
  });
});
