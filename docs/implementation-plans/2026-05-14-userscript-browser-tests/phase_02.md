# Userscript Browser Tests — Phase 2: Test Fixture

> **For Claude:** REQUIRED SUB-SKILL: Use ed3d-plan-and-execute:executing-an-implementation-plan to implement this plan task-by-task.

**Goal:** Create the minimal "fake Wikipedia article" environment — an HTML body the script can read, plus `mw.*` and `OO.ui.*` stubs that satisfy the script's preconditions and let it instantiate its UI.

**Architecture:** A static `article.html` (body only, no `<script>` tags) loaded via `page.setContent()`. A `mw-stubs.js` injected via `page.addScriptTag()` after jQuery to define `window.mw` and a hand-rolled `window.OO.ui` whose widgets create real DOM (so Playwright role/text selectors work).

**Tech Stack:** Vanilla DOM + minimal jQuery interop (the stub creates real elements and wraps with `$(el)` for OOUI's `.$element` contract).

**Scope:** Phase 2 of 5.

**Codebase verified:** 2026-05-14 against worktree HEAD `bcadb75`.

**Note for the engineer:** These stubs are best-effort. The exact `OO.ui.*` surface main.js exercises was inventoried in Phase 0 investigation but the stubs are unproven until Phase 4 runs them. **Expect Phase 4 to surface missing methods on these stubs.** When that happens, return here, add the missing method, re-run.

---

## Task 1: Create the article fixture HTML

**Files:**
- Create: `tests/e2e/fixtures/article.html`

**Step 1: Create the directory**

```bash
mkdir -p tests/e2e/fixtures
```

**Step 2: Write the fixture**

Create `tests/e2e/fixtures/article.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Test Article - Wikipedia</title>
</head>
<body class="mw-body">
  <div id="content" class="mw-body" role="main">
    <h1 id="firstHeading">Test Article</h1>
    <div id="bodyContent">
      <div id="mw-content-text">
        <div class="mw-parser-output">
          <p>
            The sky is blue<sup id="cite_ref-source-1" class="reference"><a href="#cite_note-source-1">[1]</a></sup>
            and grass is green<sup id="cite_ref-source-2" class="reference"><a href="#cite_note-source-2">[2]</a></sup>.
          </p>
          <h2><span class="mw-headline" id="References">References</span></h2>
          <ol class="references">
            <li id="cite_note-source-1">
              <span class="mw-cite-backlink"><a href="#cite_ref-source-1">^</a></span>
              <span class="reference-text">
                <cite class="citation web">
                  <a rel="nofollow" class="external text" href="https://example.com/source-1">Source 1 (example.com)</a>.
                </cite>
              </span>
            </li>
            <li id="cite_note-source-2">
              <span class="mw-cite-backlink"><a href="#cite_ref-source-2">^</a></span>
              <span class="reference-text">
                <cite class="citation web">
                  <a rel="nofollow" class="external text" href="https://example.com/source-2">Source 2 (example.com)</a>.
                </cite>
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
```

**Why these specific tags/classes:** main.js extracts claims by walking the DOM between adjacent `<sup class="reference">` markers and reading the matching `<li id="cite_note-...">` for the source URL. The structure above mirrors what Wikipedia actually renders (minus chrome). Keep the class names exact — `core/claim.js` and `core/urls.js` look for them.

**Step 3: Verify the file is well-formed**

```bash
node -e "console.log(require('fs').readFileSync('tests/e2e/fixtures/article.html', 'utf8').length, 'bytes')"
```

Expected: prints a byte count (~1200), no error.

**Step 4: Commit**

```bash
git add tests/e2e/fixtures/article.html
git commit -m "test(e2e): add minimal Wikipedia-shaped article fixture"
```

---

## Task 2: Create the MediaWiki + OOUI stubs

**Files:**
- Create: `tests/e2e/fixtures/mw-stubs.js`

**Step 1: Write the stubs**

Create `tests/e2e/fixtures/mw-stubs.js`:

```javascript
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
```

**Why each widget creates real DOM:** main.js attaches the widget's `.$element[0]` (an actual `<button>`, `<select>`, etc.) to the sidebar via `appendChild`. Playwright then finds these elements via `getByRole('button', { name: 'Verify Claim' })` etc. If we returned bare JS objects, the sidebar would have no real DOM and selectors would fail.

**Step 2: Syntax check**

```bash
node --check tests/e2e/fixtures/mw-stubs.js
```

Expected: no output, exits 0. (Any syntax error gets reported.)

**Step 3: Commit**

```bash
git add tests/e2e/fixtures/mw-stubs.js
git commit -m "test(e2e): add mw.* and OO.ui.* stubs for Playwright fixture"
```

---

## Phase 2 Done When

- `tests/e2e/fixtures/article.html` exists and parses as valid HTML.
- `tests/e2e/fixtures/mw-stubs.js` exists and passes `node --check`.
- Two new commits.

**What's deliberately not verified:** that the stubs are *complete*. Phase 4's smoke test is where we discover what's missing; revisit this phase to add methods as needed.
