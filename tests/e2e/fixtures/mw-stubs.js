// MediaWiki + OOUI stubs for Playwright tests.
// Provides the minimal surface main.js requires to run outside MediaWiki.
// Requires: jQuery ($) must already be loaded.

(function () {
  if (typeof window.$ !== 'function') {
    throw new Error('mw-stubs.js: jQuery ($) must be loaded before this file');
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

  // --- OO.ui stubs ---
  // Each widget builds real DOM so Playwright role/text selectors work.

  function ButtonWidget(opts) {
    opts = opts || {};
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = opts.label != null ? String(opts.label) : '';
    if (opts.icon) btn.setAttribute('data-icon', opts.icon);
    if (opts.flags) {
      const flags = Array.isArray(opts.flags) ? opts.flags : [opts.flags];
      btn.setAttribute('data-flags', flags.join(' '));
    }
    if (opts.disabled) btn.disabled = true;
    if (opts.title) btn.title = opts.title;
    this.$element = window.$(btn);
    this._btn = btn;
  }
  ButtonWidget.prototype.on = function (event, fn) {
    if (event === 'click') {
      this._btn.addEventListener('click', () => fn());
    }
    return this;
  };
  ButtonWidget.prototype.setDisabled = function (disabled) {
    this._btn.disabled = !!disabled;
    return this;
  };
  ButtonWidget.prototype.setLabel = function (label) {
    this._btn.textContent = String(label);
    return this;
  };

  function MenuOptionWidget(opts) {
    opts = opts || {};
    this.data = opts.data;
    this.label = opts.label;
  }

  function DropdownWidget(opts) {
    opts = opts || {};
    const wrapper = document.createElement('div');
    wrapper.className = 'oo-ui-dropdown-stub';
    const select = document.createElement('select');
    const items = (opts.menu && opts.menu.items) || [];
    items.forEach((item) => {
      const o = document.createElement('option');
      o.value = String(item.data);
      o.textContent = String(item.label != null ? item.label : item.data);
      select.appendChild(o);
    });
    wrapper.appendChild(select);
    this.$element = window.$(wrapper);
    this._select = select;
  }
  DropdownWidget.prototype.getMenu = function () {
    const self = this;
    return {
      selectItemByData: (data) => {
        self._select.value = String(data);
      },
      on: (event, fn) => {
        if (event === 'select') {
          self._select.addEventListener('change', () => {
            const data = self._select.value;
            fn({ getData: () => data, data });
          });
        }
      },
      getSelectedItem: () => ({
        getData: () => self._select.value,
        data: self._select.value,
      }),
    };
  };

  function TextInputWidget(opts) {
    opts = opts || {};
    const input = document.createElement('input');
    input.type = 'text';
    if (opts.value != null) input.value = String(opts.value);
    if (opts.placeholder) input.placeholder = String(opts.placeholder);
    this.$element = window.$(input);
    this._input = input;
  }
  TextInputWidget.prototype.getValue = function () { return this._input.value; };
  TextInputWidget.prototype.setValue = function (v) { this._input.value = String(v == null ? '' : v); return this; };
  TextInputWidget.prototype.on = function (event, fn) {
    if (event === 'change' || event === 'input') {
      this._input.addEventListener('input', () => fn(this._input.value));
    }
    return this;
  };

  function MultilineTextInputWidget(opts) {
    opts = opts || {};
    const ta = document.createElement('textarea');
    if (opts.value != null) ta.value = String(opts.value);
    if (opts.placeholder) ta.placeholder = String(opts.placeholder);
    if (opts.rows) ta.rows = opts.rows;
    this.$element = window.$(ta);
    this._ta = ta;
  }
  MultilineTextInputWidget.prototype.getValue = function () { return this._ta.value; };
  MultilineTextInputWidget.prototype.setValue = function (v) { this._ta.value = String(v == null ? '' : v); return this; };
  MultilineTextInputWidget.prototype.on = function (event, fn) {
    if (event === 'change' || event === 'input') {
      this._ta.addEventListener('input', () => fn(this._ta.value));
    }
    return this;
  };

  function MessageDialog(opts) {
    this.opts = opts || {};
  }
  MessageDialog.prototype.initialize = function () {};

  function WindowManager() {
    const div = document.createElement('div');
    div.className = 'oo-ui-window-manager-stub';
    this.$element = window.$(div);
  }
  WindowManager.prototype.addWindows = function () { return this; };
  WindowManager.prototype.openWindow = function () {
    return { closed: Promise.resolve({ action: 'cancel' }) };
  };

  window.OO = {
    ui: {
      ButtonWidget,
      MenuOptionWidget,
      DropdownWidget,
      TextInputWidget,
      MultilineTextInputWidget,
      MessageDialog,
      WindowManager,
      confirm: () => ({
        done: (fn) => { fn(true); },
      }),
    },
  };
})();
