// MediaWiki stubs for Playwright tests.
// Provides the minimal surface main.js requires to run outside MediaWiki.
// Requires: jQuery ($) and real OOUI (window.OO.ui) must already be loaded.

(function () {
  if (typeof window.$ !== 'function') {
    throw new Error('mw-stubs.js: jQuery ($) must be loaded before this file');
  }

  if (!window.OO || !window.OO.ui || !window.OO.ui.ButtonWidget) {
    throw new Error('mw-stubs.js: real oojs-ui (OO.ui.ButtonWidget and companions) must be loaded before this file');
  }

  // Widgets reference OO.ui.theme during construction. oojs-ui-wikimediaui.js normally assigns this
  // global at load time; this fallback exists in case that bundle is dropped from the load chain.
  if (!window.OO.ui.theme) {
    window.OO.ui.theme = new window.OO.ui.WikimediaUITheme();
  }

  // --- mw.config values (test environment defaults) ---
  const mwConfig = {
    wgNamespaceNumber: 0,
    wgAction: 'view',
    wgTitle: 'Test Article',
    wgPageName: 'Test_Article',
    wgServer: 'https://en.wikipedia.org',
    wgScript: '/w/index.php',
    wgCurRevisionId: 12345,
    skin: 'vector-2022',
  };

  // --- mw.notify call log (tests assert against this) ---
  window.__mwNotifications = [];

  window.mw = {
    config: {
      get: (key) => (key in mwConfig ? mwConfig[key] : null),
    },
    loader: {
      using: () => Promise.resolve(),
    },
    util: {
      addPortletLink: (portletId, href, label) => {
        const li = document.createElement('li');
        li.textContent = label;
        if (href) {
          const a = document.createElement('a');
          a.href = href;
          a.textContent = label;
          li.innerHTML = '';
          li.appendChild(a);
        }
        return li;
      },
      getUrl: (title, params) => {
        const qs = params ? '&' + new URLSearchParams(params).toString() : '';
        return `/w/index.php?title=${encodeURIComponent(title || mwConfig.wgPageName)}${qs}`;
      },
    },
    notify: (msg, opts) => {
      window.__mwNotifications.push({ msg: String(msg), opts: opts || null });
    },
    Api: function () {
      this.get = () => Promise.resolve({});
      this.post = () => Promise.resolve({});
    },
  };
})();
