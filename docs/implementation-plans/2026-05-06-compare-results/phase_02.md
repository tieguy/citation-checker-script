# Compare Results — Phase 2: Renderers

> **For Claude:** REQUIRED SUB-SKILL: Use `ed3d-plan-and-execute:executing-an-implementation-plan` to implement this plan task-by-task.

**Goal:** Create `benchmark/render_compare.js` that turns a `ComparisonResult` (from Phase 1) into a Markdown, HTML, or JSON report. Each renderer is independently usable; the CLI in Phase 3 picks one based on the output file extension. End state: tested renderers, no I/O at the renderer surface (they return strings; the CLI handles `fs.writeFileSync`).

**Architecture:** Pure functions — `renderJson(result, options)`, `renderMarkdown(result, options)`, `renderHtml(result, options)`. No external dependencies. The HTML renderer is a verbatim port of the table structure from `workbench/citoid-validation/compare.mjs` (escapeHtml + color-coded delta cells + flip table) minus the citoid-coverage table (Table C in citoid's report — that's experiment-specific and doesn't belong in core compare).

**Tech Stack:** Same as Phase 1 — ESM, `node:test`. No template engines (string interpolation is fine for a single-page report).

**Branch context:** Continues on the same feature branch as Phase 1. Phase 1 must be complete with all tests passing before starting.

**Scope:** Phase 2 of 4.

**Codebase verified:** 2026-05-06 (same investigation as Phase 1).

**Codebase verification findings:**
- ✓ `benchmark/compare_results.js` exists with the exports from Phase 1.
- ✓ `tests/compare_results.test.js` exists with Phase 1 tests passing.
- ✓ Source material: `workbench/citoid-validation/compare.mjs` lines 254–522 contain the HTML rendering (escapeHtml, deltaColor, directionColor, the three tables A/B/C, plus the inline CSS). Port the structure but drop Table C (citoid coverage) and Table D (post-hoc qualitative groupings — empty placeholder in citoid's version anyway).
- ✓ No existing `benchmark/render_compare.js` — fresh ground.
- ✓ Map iteration in JS preserves insertion order, so `perProvider` iteration in renderers will list providers in the order they first appeared in the cells array. If a stable display order is wanted later, the renderer can sort; not needed for v1.

---

## Task 1: HTML escape + color helpers

**Files:**
- Create: `benchmark/render_compare.js`
- Create: `tests/render_compare.test.js`

**Step 1: Write the failing test**

Create `tests/render_compare.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    escapeHtml,
    deltaColor,
    directionColor,
} from '../benchmark/render_compare.js';

test('escapeHtml escapes the five HTML-significant characters', () => {
    assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#x27;&lt;/a&gt;');
    assert.equal(escapeHtml(''), '');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(42), '42');
});

test('deltaColor returns green/red/grey based on noise floor', () => {
    assert.equal(deltaColor(10, 5), '#e6ffe6'); // above floor → green
    assert.equal(deltaColor(-10, 5), '#ffe6e6'); // below -floor → red
    assert.equal(deltaColor(2, 5), '#f0f0f0'); // within ±floor → grey
    assert.equal(deltaColor(-3, 5), '#f0f0f0');
    assert.equal(deltaColor(0, 5), '#f0f0f0');
});

test('directionColor maps each direction to a distinct shade', () => {
    assert.equal(directionColor('improvement'), '#e6ffe6');
    assert.equal(directionColor('regression'), '#ffe6e6');
    assert.equal(directionColor('lateral'), '#fff5cc');
    assert.equal(directionColor('unchanged-correct'), '#ffffff');
    assert.equal(directionColor('unchanged-wrong-same'), '#ffffff');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='escapeHtml|deltaColor|directionColor'`
Expected: All three tests fail with import errors.

**Step 3: Write minimal implementation**

Create `benchmark/render_compare.js`:

```js
/**
 * Escape HTML-significant characters: & < > " '
 * Returns empty string for null/undefined.
 */
export function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Background color for an accuracy delta given a noise floor (in pp).
 * Green if delta >= +floor, red if delta <= -floor, grey otherwise.
 */
export function deltaColor(delta, noiseFloor = 5) {
    if (delta >= noiseFloor) return '#e6ffe6';
    if (delta <= -noiseFloor) return '#ffe6e6';
    return '#f0f0f0';
}

/**
 * Background color for a flip direction.
 */
export function directionColor(direction) {
    switch (direction) {
        case 'improvement': return '#e6ffe6';
        case 'regression':  return '#ffe6e6';
        case 'lateral':     return '#fff5cc';
        default:            return '#ffffff';
    }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='escapeHtml|deltaColor|directionColor'`
Expected: All three pass.

**Step 5: Commit**

```bash
git add benchmark/render_compare.js tests/render_compare.test.js
git commit -m "benchmark: add escape/color helpers for compare-result rendering"
```

---

## Task 2: renderJson — straightforward serialization

**Files:**
- Modify: `benchmark/render_compare.js`
- Modify: `tests/render_compare.test.js`

**Step 1: Write the failing test**

Append to `tests/render_compare.test.js`:

```js
import { renderJson } from '../benchmark/render_compare.js';
import { compareResults } from '../benchmark/compare_results.js';

const TINY_DATASET = [
    { id: 'r1', ground_truth: 'Supported', claim_text: 'c1', source_url: 'http://x/1', extraction_status: 'complete', needs_manual_review: false },
];
const TINY_CONTROL = { rows: [{ entry_id: 'r1', provider: 'p', predicted_verdict: 'Not supported', error: null }] };
const TINY_TREATMENT = { rows: [{ entry_id: 'r1', provider: 'p', predicted_verdict: 'Supported', error: null }] };

test('renderJson serializes a ComparisonResult round-trippable through JSON.parse', () => {
    const result = compareResults({ control: TINY_CONTROL, treatment: TINY_TREATMENT, dataset: TINY_DATASET });
    const json = renderJson(result);
    const parsed = JSON.parse(json);
    assert.equal(parsed.coverage.comparedCells, 1);
    assert.equal(parsed.cells[0].direction, 'improvement');
    // perProvider was a Map; should serialize to a plain object.
    assert.equal(typeof parsed.perProvider, 'object');
    assert.equal(parsed.perProvider.p.n, 1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='renderJson'`
Expected: Fails with `renderJson is not a function`.

**Step 3: Write minimal implementation**

Append to `benchmark/render_compare.js`:

```js
/**
 * Serialize a ComparisonResult to pretty-printed JSON.
 * The `perProvider` Map is converted to a plain object.
 * The `cells` array drops the back-reference to `datasetEntry` to avoid
 * duplicating dataset content into the report.
 *
 * @param {ReturnType<import('./compare_results.js').compareResults>} result
 * @param {{indent?: number}} [options]
 */
export function renderJson(result, options = {}) {
    const indent = options.indent ?? 2;
    const serializable = {
        metadata: result.metadata,
        coverage: result.coverage,
        perProvider: Object.fromEntries(result.perProvider),
        cells: result.cells.map(({ datasetEntry, ...rest }) => rest),
        flips: result.flips.map(({ datasetEntry, ...rest }) => rest),
    };
    return JSON.stringify(serializable, null, indent);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='renderJson'`
Expected: Passes.

**Step 5: Commit**

```bash
git add benchmark/render_compare.js tests/render_compare.test.js
git commit -m "benchmark: renderJson serializer for ComparisonResult"
```

---

## Task 3: renderMarkdown — structured tables

**Files:**
- Modify: `benchmark/render_compare.js`
- Modify: `tests/render_compare.test.js`

**Step 1: Write the failing test**

Append to `tests/render_compare.test.js`:

```js
import { renderMarkdown } from '../benchmark/render_compare.js';

test('renderMarkdown emits a headline accuracy table (exact + lenient + binary) and a flip table', () => {
    const result = compareResults({ control: TINY_CONTROL, treatment: TINY_TREATMENT, dataset: TINY_DATASET });
    const md = renderMarkdown(result);
    // Headline section — header row carries all three metric pairs in order: exact, lenient, binary.
    assert.match(md, /## Headline accuracy/);
    assert.match(md, /\| Provider \| n \| Control exact \| Treatment exact \| Δ exact \| Control lenient \| Treatment lenient \| Δ lenient \| Control binary \| Treatment binary \| Δ binary \|/);
    assert.match(md, /\| p \| 1 \|/);
    // Flip section
    assert.match(md, /## Flips/);
    assert.match(md, /improvement/);
    // Coverage / metadata block
    assert.match(md, /Compared cells: \*\*1\*\*/);
});

test('renderMarkdown notes when changeAxes are provided', () => {
    const result = compareResults({
        control: TINY_CONTROL, treatment: TINY_TREATMENT, dataset: TINY_DATASET,
        options: { changeAxes: ['prompt', 'source_text'], groundTruthVersion: 'post-audit-2026-04-30' },
    });
    const md = renderMarkdown(result);
    assert.match(md, /Change axes: `prompt`, `source_text`/);
    assert.match(md, /Ground truth version: `post-audit-2026-04-30`/);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='renderMarkdown'`
Expected: Both fail with `renderMarkdown is not a function`.

**Step 3: Write minimal implementation**

Append to `benchmark/render_compare.js`:

```js
function fmtPct(n) {
    return `${n.toFixed(1)}%`;
}
function fmtDelta(n) {
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(1)}`;
}

/**
 * Render a ComparisonResult as a Markdown report.
 * Sections: header (metadata + coverage), headline accuracy table, flip table.
 *
 * @param {ReturnType<import('./compare_results.js').compareResults>} result
 * @param {{noiseFloor?: number}} [options]
 */
export function renderMarkdown(result, options = {}) {
    const noiseFloor = options.noiseFloor ?? 5;
    const lines = [];
    lines.push(`# Compare Results — ${result.metadata.generatedAt}`);
    lines.push('');
    if (result.metadata.changeAxes && result.metadata.changeAxes.length > 0) {
        const axes = result.metadata.changeAxes.map(a => `\`${a}\``).join(', ');
        lines.push(`Change axes: ${axes}`);
    }
    if (result.metadata.groundTruthVersion) {
        lines.push(`Ground truth version: \`${result.metadata.groundTruthVersion}\``);
    }
    if (result.metadata.controlRunAt) {
        lines.push(`Control run at: ${result.metadata.controlRunAt}`);
    }
    if (result.metadata.treatmentRunAt) {
        lines.push(`Treatment run at: ${result.metadata.treatmentRunAt}`);
    }
    lines.push('');
    lines.push(`Compared cells: **${result.coverage.comparedCells}** of ${result.coverage.intersectionCells} intersection (${result.coverage.controlOnlyCells} control-only, ${result.coverage.treatmentOnlyCells} treatment-only excluded). Dataset: ${result.coverage.datasetValid} valid of ${result.coverage.datasetTotal}.`);
    lines.push(`Noise floor: ±${noiseFloor}pp (single-provider 95% CI heuristic).`);
    lines.push('');

    lines.push('## Headline accuracy');
    lines.push('');
    lines.push('| Provider | n | Control exact | Treatment exact | Δ exact | Control lenient | Treatment lenient | Δ lenient | Control binary | Treatment binary | Δ binary |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const [provider, stats] of result.perProvider) {
        const flag = (Math.abs(stats.exact.delta) < noiseFloor
                   && Math.abs(stats.lenient.delta) < noiseFloor
                   && Math.abs(stats.binary.delta) < noiseFloor)
            ? ' (noise)'
            : '';
        lines.push(
            `| ${provider}${flag} | ${stats.n} | ${fmtPct(stats.exact.controlPct)} | ${fmtPct(stats.exact.treatmentPct)} | ${fmtDelta(stats.exact.delta)} | ${fmtPct(stats.lenient.controlPct)} | ${fmtPct(stats.lenient.treatmentPct)} | ${fmtDelta(stats.lenient.delta)} | ${fmtPct(stats.binary.controlPct)} | ${fmtPct(stats.binary.treatmentPct)} | ${fmtDelta(stats.binary.delta)} |`
        );
    }
    lines.push('');

    lines.push('## Flips');
    lines.push('');
    if (result.flips.length === 0) {
        lines.push('_No flips — every cell either stayed correct or stayed wrong with the same verdict._');
    } else {
        lines.push('| Provider | Entry ID | Direction | Control | Treatment | Ground truth | Claim |');
        lines.push('|---|---|---|---|---|---|---|');
        for (const flip of result.flips) {
            const claim = flip.claimText.length > 60 ? flip.claimText.slice(0, 60) + '…' : flip.claimText;
            lines.push(
                `| ${flip.provider} | ${flip.entryId} | ${flip.direction} | ${flip.controlVerdict} | ${flip.treatmentVerdict} | ${flip.groundTruth} | ${claim.replace(/\|/g, '\\|')} |`
            );
        }
    }
    lines.push('');

    return lines.join('\n');
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='renderMarkdown'`
Expected: Both pass.

**Step 5: Commit**

```bash
git add benchmark/render_compare.js tests/render_compare.test.js
git commit -m "benchmark: renderMarkdown emits headline accuracy + flip tables"
```

---

## Task 4: renderHtml — color-coded self-contained report

**Files:**
- Modify: `benchmark/render_compare.js`
- Modify: `tests/render_compare.test.js`

**Step 1: Write the failing test**

Append to `tests/render_compare.test.js`:

```js
import { renderHtml } from '../benchmark/render_compare.js';

test('renderHtml emits a self-contained HTML document with headline and flip tables', () => {
    const result = compareResults({ control: TINY_CONTROL, treatment: TINY_TREATMENT, dataset: TINY_DATASET });
    const html = renderHtml(result);
    assert.match(html, /<!DOCTYPE html>/);
    assert.match(html, /<style>/); // inline CSS
    assert.match(html, /Headline accuracy/);
    assert.match(html, /Flips/);
    assert.match(html, /<td[^>]*>p<\/td>/); // provider name in a row
    assert.match(html, /improvement/);
    // Color-coded direction cell present
    assert.match(html, /background-color:\s*#e6ffe6/);
});

test('renderHtml escapes claim text and source URLs', () => {
    const datasetWithDangerousChars = [{
        id: 'r1', ground_truth: 'Supported',
        claim_text: '<script>alert("x")</script>',
        source_url: 'http://x/?a=b&c=d',
        extraction_status: 'complete', needs_manual_review: false,
    }];
    const control = { rows: [{ entry_id: 'r1', provider: 'p', predicted_verdict: 'Not supported', error: null }] };
    const treatment = { rows: [{ entry_id: 'r1', provider: 'p', predicted_verdict: 'Supported', error: null }] };
    const result = compareResults({ control, treatment, dataset: datasetWithDangerousChars });
    const html = renderHtml(result);
    assert.equal(html.includes('<script>alert'), false);
    assert.match(html, /&lt;script&gt;alert/);
    assert.match(html, /a=b&amp;c=d/);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='renderHtml'`
Expected: Both fail with `renderHtml is not a function`.

**Step 3: Write minimal implementation**

Append to `benchmark/render_compare.js`. Port the structure from `workbench/citoid-validation/compare.mjs:280–502`, dropping Tables C and D (citoid coverage and post-hoc groupings — those are experiment-specific):

```js
/**
 * Render a ComparisonResult as a self-contained HTML document.
 * Includes inline CSS, a metadata header, a headline-accuracy table with
 * color-coded delta cells, and a flip table with color-coded direction cells.
 *
 * @param {ReturnType<import('./compare_results.js').compareResults>} result
 * @param {{noiseFloor?: number, title?: string}} [options]
 */
export function renderHtml(result, options = {}) {
    const noiseFloor = options.noiseFloor ?? 5;
    const title = options.title ?? 'Compare Results';

    const headerRows = [];
    if (result.metadata.changeAxes && result.metadata.changeAxes.length > 0) {
        headerRows.push(`<p><span class="metadata-key">Change axes:</span> ${escapeHtml(result.metadata.changeAxes.join(', '))}</p>`);
    }
    if (result.metadata.groundTruthVersion) {
        headerRows.push(`<p><span class="metadata-key">Ground truth version:</span> ${escapeHtml(result.metadata.groundTruthVersion)}</p>`);
    }
    if (result.metadata.controlRunAt) {
        headerRows.push(`<p><span class="metadata-key">Control run at:</span> ${escapeHtml(result.metadata.controlRunAt)}</p>`);
    }
    if (result.metadata.treatmentRunAt) {
        headerRows.push(`<p><span class="metadata-key">Treatment run at:</span> ${escapeHtml(result.metadata.treatmentRunAt)}</p>`);
    }
    headerRows.push(`<p><span class="metadata-key">Compared cells:</span> ${result.coverage.comparedCells} of ${result.coverage.intersectionCells} intersection</p>`);
    headerRows.push(`<p><span class="metadata-key">Dataset:</span> ${result.coverage.datasetValid} valid of ${result.coverage.datasetTotal}</p>`);
    headerRows.push(`<p><span class="metadata-key">Noise floor:</span> ±${noiseFloor}pp</p>`);
    headerRows.push(`<p><span class="metadata-key">Generated:</span> ${escapeHtml(result.metadata.generatedAt)}</p>`);

    const headlineRows = [];
    for (const [provider, stats] of result.perProvider) {
        headlineRows.push(`        <tr>
          <td>${escapeHtml(provider)}</td>
          <td class="num">${stats.n}</td>
          <td class="num">${stats.exact.control}/${stats.n} (${stats.exact.controlPct.toFixed(1)}%)</td>
          <td class="num">${stats.exact.treatment}/${stats.n} (${stats.exact.treatmentPct.toFixed(1)}%)</td>
          <td class="num delta" style="background-color: ${deltaColor(stats.exact.delta, noiseFloor)};">${stats.exact.delta >= 0 ? '+' : ''}${stats.exact.delta.toFixed(1)}</td>
          <td class="num">${stats.lenient.control}/${stats.n} (${stats.lenient.controlPct.toFixed(1)}%)</td>
          <td class="num">${stats.lenient.treatment}/${stats.n} (${stats.lenient.treatmentPct.toFixed(1)}%)</td>
          <td class="num delta" style="background-color: ${deltaColor(stats.lenient.delta, noiseFloor)};">${stats.lenient.delta >= 0 ? '+' : ''}${stats.lenient.delta.toFixed(1)}</td>
          <td class="num">${stats.binary.control}/${stats.n} (${stats.binary.controlPct.toFixed(1)}%)</td>
          <td class="num">${stats.binary.treatment}/${stats.n} (${stats.binary.treatmentPct.toFixed(1)}%)</td>
          <td class="num delta" style="background-color: ${deltaColor(stats.binary.delta, noiseFloor)};">${stats.binary.delta >= 0 ? '+' : ''}${stats.binary.delta.toFixed(1)}</td>
        </tr>`);
    }

    const flipRows = [];
    for (const flip of result.flips) {
        const claim = flip.claimText.length > 80 ? flip.claimText.slice(0, 80) + '…' : flip.claimText;
        flipRows.push(`        <tr style="background-color: ${directionColor(flip.direction)};">
          <td>${escapeHtml(flip.provider)}</td>
          <td>${escapeHtml(flip.entryId)}</td>
          <td><a href="${escapeHtml(flip.sourceUrl)}" target="_blank" rel="noopener" title="${escapeHtml(flip.claimText)}">${escapeHtml(claim)}</a></td>
          <td>${escapeHtml(flip.controlVerdict)}</td>
          <td>${escapeHtml(flip.treatmentVerdict)}</td>
          <td>${escapeHtml(flip.groundTruth)}</td>
          <td><strong>${escapeHtml(flip.direction)}</strong></td>
        </tr>`);
    }
    if (flipRows.length === 0) {
        flipRows.push(`        <tr><td colspan="7"><em>No flips — every cell either stayed correct or stayed wrong with the same verdict.</em></td></tr>`);
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; line-height: 1.6; color: #333; }
    h1, h2 { color: #222; }
    h1 { border-bottom: 2px solid #ccc; padding-bottom: 10px; }
    .header-section { background: #f9f9f9; padding: 15px; border-radius: 4px; margin-bottom: 30px; }
    .header-section p { margin: 5px 0; }
    .metadata-key { font-weight: bold; display: inline-block; width: 180px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 30px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    .num { text-align: right; }
    .delta { font-weight: 600; text-align: center; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="header-section">
${headerRows.join('\n')}
  </div>
  <h2>Headline accuracy</h2>
  <table>
    <thead>
      <tr>
        <th>Provider</th><th>n</th>
        <th>Control exact</th><th>Treatment exact</th><th>Δ exact</th>
        <th>Control lenient</th><th>Treatment lenient</th><th>Δ lenient</th>
        <th>Control binary</th><th>Treatment binary</th><th>Δ binary</th>
      </tr>
    </thead>
    <tbody>
${headlineRows.join('\n')}
    </tbody>
  </table>
  <p style="font-size: 0.9em; color: #666;">Green = Δ ≥ +${noiseFloor}pp · Red = Δ ≤ -${noiseFloor}pp · Grey = within ±${noiseFloor}pp noise floor.</p>
  <h2>Flips</h2>
  <table>
    <thead>
      <tr>
        <th>Provider</th><th>Entry ID</th><th>Claim</th>
        <th>Control</th><th>Treatment</th><th>Ground truth</th><th>Direction</th>
      </tr>
    </thead>
    <tbody>
${flipRows.join('\n')}
    </tbody>
  </table>
  <p style="font-size: 0.9em; color: #666;">
    <span style="background: #e6ffe6; padding: 2px 4px;">green = improvement</span> ·
    <span style="background: #ffe6e6; padding: 2px 4px;">red = regression</span> ·
    <span style="background: #fff5cc; padding: 2px 4px;">yellow = lateral</span>.
  </p>
</body>
</html>
`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='renderHtml'`
Expected: Both pass.

**Step 5: Commit**

```bash
git add benchmark/render_compare.js tests/render_compare.test.js
git commit -m "benchmark: renderHtml self-contained report with color-coded tables"
```

---

## Task 5: Run full test suite

**Step 1: Run all tests**

Run: `npm test`
Expected: All previously passing tests still pass; new render_compare tests (~6 new tests) pass.

If any pre-existing test fails, investigate before proceeding to Phase 3.

**Step 2: Verify renderer public surface**

Run: `node --input-type=module -e "import * as M from './benchmark/render_compare.js'; console.log(Object.keys(M).sort());"`
Expected: `[ 'deltaColor', 'directionColor', 'escapeHtml', 'renderHtml', 'renderJson', 'renderMarkdown' ]`

No commit for this task.
