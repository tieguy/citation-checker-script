import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitIntoBatches, buildPageWikitext } from '../benchmark/emit_migration_batches.js';
import { loadCsvRows } from '../benchmark/suite_parity.js';
import { parseSuite } from '../benchmark/suite.js';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CSV = path.join(REPO, 'Benchmarking_data_Citations.csv');

test('splitIntoBatches partitions the CSV into the three historical cohorts', () => {
    const batches = splitIntoBatches(loadCsvRows(CSV));
    assert.equal(batches.v1.length, 76);
    assert.equal(batches.v2.length, 34);
    assert.equal(batches.v3.length, 79);
    assert.equal(batches.v1.length + batches.v2.length + batches.v3.length, 189);
});

test('splitIntoBatches treats an untagged row as v1, matching the pipeline default', () => {
    const rows = [{ 'Dataset version': '', _rowIndex: 2 }, { 'Dataset version': 'v2', _rowIndex: 3 }];
    const batches = splitIntoBatches(rows);
    assert.equal(batches.v1.length, 1);
    assert.equal(batches.v2.length, 1);
});

test('splitIntoBatches rejects an unrecognized cohort tag rather than dropping the row', () => {
    assert.throws(
        () => splitIntoBatches([{ 'Dataset version': 'v9', _rowIndex: 5 }]),
        /v9/,
    );
});

test('buildPageWikitext produces a page whose rows all parse and validate', () => {
    const batches = splitIntoBatches(loadCsvRows(CSV));
    const page = buildPageWikitext(batches.v1);
    const { rows } = parseSuite(page);
    assert.equal(rows.length, 76);
});

test('buildPageWikitext is cumulative-ready: the full page holds all 189 rows', () => {
    const b = splitIntoBatches(loadCsvRows(CSV));
    const page = buildPageWikitext([...b.v1, ...b.v2, ...b.v3]);
    assert.equal(parseSuite(page).rows.length, 189);
});

test('buildPageWikitext keeps the header and closes the table exactly once', () => {
    const page = buildPageWikitext(splitIntoBatches(loadCsvRows(CSV)).v1);
    assert.equal((page.match(/^\{\| class="wikitable sortable"$/gm) || []).length, 1);
    assert.equal((page.match(/^\|\}$/gm) || []).length, 1);
    assert.match(page, /== About this page ==/);
});
