// Shared loader used by every spec: sets the fixture HTML, injects jQuery,
// then mw-stubs.js, then main.js. Returns once main.js's async init has run
// the sidebar mount.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchor paths to this file's location (fixes cwd-relative path issues).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURE_HTML_PATH = path.join(__dirname, 'article.html');
const JQUERY_PATH = path.join(REPO_ROOT, 'node_modules', 'jquery', 'dist', 'jquery.min.js');
const STUBS_PATH = path.join(__dirname, 'mw-stubs.js');
const MAIN_JS_PATH = path.join(REPO_ROOT, 'main.js');

/**
 * Load the userscript into a fake-Wikipedia fixture page and wait for its sidebar to mount.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function loadUserscript(page) {
  const html = await readFile(FIXTURE_HTML_PATH, 'utf8');

  // Route all requests to en.wikipedia.org to return the fixture HTML.
  // This gives the page a real origin where native localStorage works
  // and addInitScript-seeded values persist (fixing Phase 5's provider seeding).
  await page.route('https://en.wikipedia.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: html })
  );

  // Navigate to a fake Wikipedia URL to give the page a real origin.
  await page.goto('https://en.wikipedia.org/wiki/Test_Article', { waitUntil: 'domcontentloaded' });

  // Order matters: jQuery, then stubs (depend on $), then main.js (depends on mw + $ + OO).
  await page.addScriptTag({ path: JQUERY_PATH });
  await page.addScriptTag({ path: STUBS_PATH });
  await page.addScriptTag({ path: MAIN_JS_PATH });

  // main.js's outer IIFE awaits mw.loader.using(...).then(...) which our stub resolves
  // synchronously, but the sidebar mount happens inside a $(function() {...}) callback
  // which is queued via jQuery's DOMReady. Wait explicitly for the sidebar element.
  await page.waitForSelector('#source-verifier-sidebar', { state: 'attached', timeout: 5000 });
}
