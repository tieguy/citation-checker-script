// Shared loader used by every spec: sets the fixture HTML, injects jQuery,
// then mw-stubs.js, then main.js. Returns once main.js's async init has run
// the sidebar mount.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FIXTURE_HTML_PATH = path.join('tests', 'e2e', 'fixtures', 'article.html');
const JQUERY_PATH = path.join('node_modules', 'jquery', 'dist', 'jquery.min.js');
const STUBS_PATH = path.join('tests', 'e2e', 'fixtures', 'mw-stubs.js');
const MAIN_JS_PATH = 'main.js';

/**
 * Load the userscript into a fake-Wikipedia fixture page and wait for its sidebar to mount.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function loadUserscript(page) {
  const html = await readFile(FIXTURE_HTML_PATH, 'utf8');
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  // Set up localStorage stub via direct script injection.
  // This must happen before any code tries to access localStorage.
  await page.addScriptTag({ content: `
(function() {
  const localStorageData = {};
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key) => localStorageData[key] || null,
      setItem: (key, value) => {
        localStorageData[key] = String(value);
      },
      removeItem: (key) => {
        delete localStorageData[key];
      },
      clear: () => {
        for (const key in localStorageData) {
          delete localStorageData[key];
        }
      },
      get length() {
        return Object.keys(localStorageData).length;
      },
      key: (index) => {
        const keys = Object.keys(localStorageData);
        return keys[index] || null;
      },
    },
    writable: true,
    configurable: true,
  });
})();
  ` });

  // Order matters: jQuery, then stubs (depend on $), then main.js (depends on mw + $ + OO).
  await page.addScriptTag({ path: JQUERY_PATH });
  await page.addScriptTag({ path: STUBS_PATH });
  await page.addScriptTag({ path: MAIN_JS_PATH });

  // main.js's outer IIFE awaits mw.loader.using(...).then(...) which our stub resolves
  // synchronously, but the sidebar mount happens inside a $(function() {...}) callback
  // which is queued via jQuery's DOMReady. Wait explicitly for the sidebar element.
  await page.waitForSelector('#source-verifier-sidebar', { state: 'attached', timeout: 5000 });
}
