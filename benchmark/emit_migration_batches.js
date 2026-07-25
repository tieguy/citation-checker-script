#!/usr/bin/env node
// Emit the three migration batches as paste-ready wikitext.
//
// The page is built in three successive edits — v1's rows, then v2's, then v3's —
// so each historical batch boundary becomes a revision. `--version v1` then
// becomes `--suite-oldid <revision after edit 1>`, and cohort membership is a
// fact about page history rather than a tag stored on every row.
//
// Revisions are cumulative, so this expresses v1, v1+v2 and v1+v2+v3 — but not
// v3 alone. Confirmed not needed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvRowsToWikitext } from './csv_to_suite.js';
import { loadCsvRows } from './suite_parity.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV = path.join(MODULE_DIR, '..', 'Benchmarking_data_Citations.csv');
const HEADER_PATH = path.join(MODULE_DIR, 'wiki', 'Benchmark.wikitext');
const OUT_DIR = path.join(MODULE_DIR, 'wiki', 'migration');

export const BATCH_ORDER = Object.freeze(['v1', 'v2', 'v3']);

export function splitIntoBatches(csvRows) {
    // Derived from BATCH_ORDER so the recognized cohorts have a single source of truth.
    const batches = Object.fromEntries(BATCH_ORDER.map(v => [v, []]));

    for (const row of csvRows) {
        // Untagged rows default to v1, matching the `|| 'v1'` fallback that
        // extract_dataset.js, run_benchmark.js and analyze_results.js all use.
        const version = (row['Dataset version'] || 'v1').trim();
        if (!(version in batches)) {
            throw new Error(
                `CSV line ${row._rowIndex}: unrecognized dataset version "${version}" `
                + `(expected one of ${BATCH_ORDER.join(', ')})`);
        }
        batches[version].push(row);
    }

    return batches;
}

/**
 * Wrap rendered rows in the suite page's header and table, reusing the committed
 * header verbatim so the page's prose has exactly one source of truth.
 */
export function buildPageWikitext(csvRows, headerPath = HEADER_PATH) {
    const template = fs.readFileSync(headerPath, 'utf-8');
    const closeIndex = template.lastIndexOf('\n|}');

    if (closeIndex === -1) {
        throw new Error(`${headerPath} does not end its wikitable with "|}"`);
    }

    return template.slice(0, closeIndex)
        + '\n' + csvRowsToWikitext(csvRows)
        + template.slice(closeIndex);
}

function main() {
    const csvPath = process.argv[2] ?? DEFAULT_CSV;
    const batches = splitIntoBatches(loadCsvRows(csvPath));

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const cumulative = [];

    for (const version of BATCH_ORDER) {
        cumulative.push(...batches[version]);
        const label = BATCH_ORDER.slice(0, BATCH_ORDER.indexOf(version) + 1).join('+');
        const outPath = path.join(OUT_DIR, `edit-${BATCH_ORDER.indexOf(version) + 1}-${label}.wikitext`);
        fs.writeFileSync(outPath, buildPageWikitext(cumulative), 'utf-8');
        console.log(`edit ${BATCH_ORDER.indexOf(version) + 1} (${label}): `
            + `${batches[version].length} new, ${cumulative.length} total -> ${outPath}`);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
