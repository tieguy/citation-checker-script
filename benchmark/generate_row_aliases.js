#!/usr/bin/env node
// Generate the legacy-id alias map, once, at migration.
//
// results.json and historical-runs/ store entry_id as `row_<csv_line>`. Rewriting
// those artifacts would destroy the record of what was actually run; translating
// at read time preserves it. The map is generated from the CSV while the CSV is
// still the source of truth — after Phase 6 it cannot be regenerated, which is
// why it is committed rather than computed on demand.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeRowId, parseArticleUrl } from './suite.js';
import { loadCsvRows } from './suite_parity.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ALIAS_MAP_PATH = path.join(MODULE_DIR, 'row-id-aliases.json');
const DEFAULT_CSV = path.join(MODULE_DIR, '..', 'Benchmarking_data_Citations.csv');

export function buildAliasMap(csvRows) {
    const map = {};
    for (const row of csvRows) {
        const { oldid, wiki } = parseArticleUrl(row['Article']);
        map[`row_${row._rowIndex}`] = computeRowId({
            wiki,
            oldid,
            citation: String(row['Citation number']).trim(),
            instance: String(row['Citation instance'] || '1').trim(),
        });
    }
    return map;
}

/**
 * Translate a possibly-legacy row id into the current scheme. Unknown ids pass
 * through unchanged so the caller can report a clean miss.
 */
export function resolveRowId(id, aliases) {
    if (typeof id === 'string' && id.startsWith('ctb-')) return id;
    return aliases[id] ?? id;
}

export function loadAliases(aliasPath = ALIAS_MAP_PATH) {
    if (!fs.existsSync(aliasPath)) return {};
    return JSON.parse(fs.readFileSync(aliasPath, 'utf-8')).aliases ?? {};
}

function main() {
    const csvPath = process.argv[2] ?? DEFAULT_CSV;
    const aliases = buildAliasMap(loadCsvRows(csvPath));

    fs.writeFileSync(ALIAS_MAP_PATH, JSON.stringify({
        _comment: 'Generated once at migration by generate_row_aliases.js. Maps the legacy '
            + 'row_<csv_line> ids stored in results.json and historical-runs/ onto content-hash '
            + 'ids, so those artifacts stay readable without being rewritten.',
        generated_from: path.basename(csvPath),
        count: Object.keys(aliases).length,
        aliases,
    }, null, 2) + '\n', 'utf-8');

    console.log(`Wrote ${Object.keys(aliases).length} aliases to ${ALIAS_MAP_PATH}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
