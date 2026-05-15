// Shared loader used by every spec: sets the fixture HTML, injects jQuery,
// real OOUI libraries, then mw-stubs.js, then main.js. Returns once main.js's async init has run
// the sidebar mount.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchor paths to this file's location (fixes cwd-relative path issues).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_FIXTURE_HTML_PATH = path.join(__dirname, 'article.html');
// Using unminified dist/ builds for readable stack traces when OOUI behavior surfaces in tests.
// Swap to .min.js if startup time becomes a concern.
const JQUERY_PATH = path.join(REPO_ROOT, 'node_modules', 'jquery', 'dist', 'jquery.min.js');
const OOJS_PATH = path.join(REPO_ROOT, 'node_modules', 'oojs', 'dist', 'oojs.js');
const OOJS_UI_CORE_PATH = path.join(REPO_ROOT, 'node_modules', 'oojs-ui', 'dist', 'oojs-ui-core.js');
const OOJS_UI_WINDOWS_PATH = path.join(REPO_ROOT, 'node_modules', 'oojs-ui', 'dist', 'oojs-ui-windows.js');
const OOJS_UI_WIKIMEDIAUI_PATH = path.join(REPO_ROOT, 'node_modules', 'oojs-ui', 'dist', 'oojs-ui-wikimediaui.js');
const STUBS_PATH = path.join(__dirname, 'mw-stubs.js');
const MAIN_JS_PATH = path.join(REPO_ROOT, 'main.js');

/**
 * Load the userscript into a fake-Wikipedia fixture page and wait for its sidebar to mount.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {string} [options.fixturePath] - Optional path to an alternative HTML fixture (defaults to article.html)
 */
export async function loadUserscript(page, options = {}) {
  const fixturePath = options.fixturePath || DEFAULT_FIXTURE_HTML_PATH;
  const html = await readFile(fixturePath, 'utf8');

  // Route all requests to en.wikipedia.org to return the fixture HTML.
  // This gives the page a real origin where native localStorage works
  // and addInitScript-seeded values persist (fixing Phase 5's provider seeding).
  await page.route('https://en.wikipedia.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: html })
  );

  // Navigate to a fake Wikipedia URL to give the page a real origin.
  await page.goto('https://en.wikipedia.org/wiki/Test_Article', { waitUntil: 'domcontentloaded' });

  // Order matters: jQuery → oojs → oojs-ui-core → oojs-ui-windows → theme → mw-stubs → main.js
  // jQuery and OOUI must load before mw-stubs so that OO is globally available when mw-stubs
  // validates that OOUI is loaded. main.js depends on mw + $ + OO.
  // The wikimediaui theme provides OO.ui.WikimediaUITheme which mw-stubs initializes.
  await page.addScriptTag({ path: JQUERY_PATH });
  await page.addScriptTag({ path: OOJS_PATH });
  await page.addScriptTag({ path: OOJS_UI_CORE_PATH });
  await page.addScriptTag({ path: OOJS_UI_WINDOWS_PATH });
  await page.addScriptTag({ path: OOJS_UI_WIKIMEDIAUI_PATH });
  await page.addScriptTag({ path: STUBS_PATH });
  await page.addScriptTag({ path: MAIN_JS_PATH });

  // main.js's outer IIFE awaits mw.loader.using(...).then(...) which our stub resolves
  // synchronously, but the sidebar mount happens inside a $(function() {...}) callback
  // which is queued via jQuery's DOMReady. Wait explicitly for the sidebar element.
  // Real OOUI is now globally available before main.js runs, so no stubs needed.
  await page.waitForSelector('#source-verifier-sidebar', { state: 'attached', timeout: 5000 });
}
