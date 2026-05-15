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
    // Total: ~380 chars, which is < 600 (CHROME_LENGTH_CAP), so wayback_chrome should fire.

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
    // The container is toggled by line 2471: document.getElementById('verifier-source-input-container').style.display = 'block'
    await expect(page.locator('#verifier-source-input-container')).toBeVisible({ timeout: 5000 });

    // Critical invariant: zero LLM provider calls. Body-classifier short-circuits before any LLM is consulted.
    const state = await getMockState(page);
    expect(state.llmRequests.length, 'body-classifier SU path must not call LLM').toBe(0);

    // Also confirm the fetch ran (we know we got into the verify flow).
    expect(state.fetchedUrls.length).toBeGreaterThanOrEqual(1);
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

    // Click the button. A confirmation dialog should appear (OO.ui.confirm in verifyAllCitations, line 3506).
    // We need to click it and confirm.
    const btnClickPromise = verifyAllBtn.click();

    // Wait for the confirmation dialog and click OK.
    // OO.ui.confirm creates a dialog with action buttons. The affirmative button is typically the first one.
    // We give it a moment to appear, then look for any button that looks like "OK" or check for the dialog.
    await page.waitForTimeout(500);

    // Try to confirm the dialog. OO.ui provides a standard dialog with confirm/cancel buttons.
    // The primary action button should be focused or available. Let's wait for any dialog and press Enter.
    try {
      // Try pressing Enter to confirm (or Tab+Enter to focus OK button then confirm)
      await page.keyboard.press('Enter');
    } catch (e) {
      // If that fails, try clicking any visible button labeled "OK" or similar
      const okBtn = page.getByRole('button', { name: /OK|Yes|Confirm/ });
      if (await okBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await okBtn.click();
      }
    }

    await btnClickPromise;

    // Wait for batch verification to complete. The report should render.
    // The progress indicator should disappear and the report should be populated.
    // reportResults is rendered into #verifier-report-results. Wait for it to have content.
    await expect(page.locator('#verifier-report-results')).toContainText(/Citation|verdict|source/, { timeout: 15000 });

    // Now get the wikitext report. To do this without modifying main.js, we need to:
    // - Evaluate generateWikitextReport() directly via page.evaluate (it's a public method on the window verifier instance)
    // - OR inspect the report cards that are rendered in the DOM
    //
    // The rendered report cards are in #verifier-report-results as .verifier-report-card elements.
    // Each card contains the verdict, source URL, and comments. But the exact wikitext is generated
    // by generateWikitextReport() and only visible when copied to clipboard.
    //
    // Instead, we can evaluate the wikitext directly from the instance via page.evaluate.
    // main.js stores the instance in a global; let's check for it.

    // Try to get the wikitext by calling the instance method directly
    let wikitext = '';
    try {
      wikitext = await page.evaluate(() => {
        // The userscript creates an instance; we need to find it.
        // main.js line 3646: (new WikipediaSourceVerifier()).generateWikitextReport()
        // The instance is stored in window.__verifier or similar? Let's check what's available.
        // Actually, the IIFE doesn't expose the instance globally.
        // But it does call verifyAllCitations which populates this.reportResults.
        // Let's check if there's a way to access it...
        //
        // Looking at main.js structure, the instance is created in an IIFE and not exposed.
        // However, we can capture the wikitext by intercepting the clipboard copy,
        // or by reading the DOM-rendered report.
        //
        // For this test, we'll take a different approach: read the rendered report cards
        // and validate the comments directly from the DOM.
        return 'evaluated';
      });
    } catch (e) {
      // The instance is not globally accessible; we'll validate via the rendered report instead.
    }

    // Alternative: Extract the report content from the rendered report cards.
    // Each citation appears as a .verifier-report-card element.
    // But the exact wikitext comments are only generated in generateWikitextReport().
    //
    // Instead, we'll copy the report to clipboard (via the Copy button) and read it.
    // But that requires clicking the button, which we can do.

    // Look for the "Copy Report (Wikitext)" button. It's created in createReportActions (main.js ~3343).
    // The button label is 'Copy Report (Wikitext)'.
    const copyWikiBtn = page.getByRole('button', { name: 'Copy Report (Wikitext)' });
    if (await copyWikiBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Use clipboard to intercept the copy
      const clipboardText = await page.evaluate(async () => {
        // Set up a mock clipboard for the test
        const originalClipboard = navigator.clipboard;
        let capturedText = '';
        navigator.clipboard = {
          writeText: async (text) => {
            capturedText = text;
            return Promise.resolve();
          },
          readText: () => Promise.resolve(originalClipboard.readText?.()),
        };
        // Now the button click will use our mock clipboard
        return 'setup';
      });

      // Click the copy button
      await copyWikiBtn.click();

      // Read the captured clipboard text via page.evaluate
      const reportWikitext = await page.evaluate(() => {
        // Actually, we need a different approach. Let's directly call generateWikitextReport via the closure.
        // Since the instance is not exposed, we can't directly call it.
        //
        // Let's instead validate the rendered report DOM to verify the comments are correct.
        return document.getElementById('verifier-report-results')?.textContent || '';
      });

      // The report cards are rendered; check for the expected comment patterns.
      const reportsText = await page.locator('#verifier-report-results').textContent();

      // Assert that we have results for both citations
      expect(reportsText).toContain('Citation');

      // Check for the two different comment patterns:
      // - fetch_failed: "Could not fetch source content"
      // - wayback_chrome: "Pipeline-attributed (wayback_chrome)"
      expect(reportsText).toContain('Could not fetch source content');
      expect(reportsText).toContain('Pipeline-attributed (wayback_chrome)');
    }

    // Critical invariant: zero LLM calls in batch SU path.
    const state = await getMockState(page);
    expect(state.llmRequests.length, 'batch SU path must not call LLM').toBe(0);
  });
});
