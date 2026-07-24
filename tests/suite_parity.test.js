import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkParity, loadCsvRows } from '../benchmark/suite_parity.js';
import { computeRowId, parseArticleUrl } from '../benchmark/suite.js';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CSV = path.join(REPO, 'Benchmarking_data_Citations.csv');

test('the CSV still has the 189 rows this migration was planned against', () => {
    assert.equal(loadCsvRows(CSV).length, 189);
});

test('parity is clean across every CSV row after a wikitext round trip', () => {
    const report = checkParity(loadCsvRows(CSV));
    assert.equal(report.total, 189);
    assert.deepEqual(report.mismatches, [],
        `parity failures:\n${JSON.stringify(report.mismatches, null, 2)}`);
    assert.equal(report.clean, true);
});

test('every row gets a unique content-hash id', () => {
    // 189 rows in a 16.7M-value space: a collision is unlikely but not
    // impossible, and would silently merge two benchmark rows.
    //
    // Checked directly rather than through checkParity: parseSuite raises
    // DUPLICATE_ID and throws before checkParity could ever populate its
    // collisions array, so asserting on report.collisions would prove nothing.
    const ids = loadCsvRows(CSV).map(row => {
        const { oldid, wiki } = parseArticleUrl(row['Article']);
        return computeRowId({
            wiki, oldid,
            citation: String(row['Citation number']).trim(),
            instance: String(row['Citation instance'] || '1').trim(),
        });
    });
    assert.equal(new Set(ids).size, ids.length, 'content-hash collision across the dataset');
});

test('checkParity reports a mismatch rather than throwing when one exists', () => {
    const rows = loadCsvRows(CSV).slice(0, 3);
    const report = checkParity(rows, {
        mutate: (r, i) => (i === 1 ? { ...r, 'Ground truth': 'Not supported' } : r),
    });
    assert.equal(report.clean, false);
    assert.equal(report.mismatches.length, 1);
    assert.equal(report.mismatches[0].field, 'truth');
});
