import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAliasMap, resolveRowId } from '../benchmark/generate_row_aliases.js';
import { loadCsvRows } from '../benchmark/suite_parity.js';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CSV = path.join(REPO, 'Benchmarking_data_Citations.csv');

test('buildAliasMap maps every legacy row id to a ctb- id', () => {
    const map = buildAliasMap(loadCsvRows(CSV));
    assert.equal(Object.keys(map).length, 189);
    assert.match(map['row_2'], /^ctb-[0-9a-f]{6}$/);
});

test('resolveRowId passes a ctb- id straight through', () => {
    assert.equal(resolveRowId('ctb-a1b2c3', { row_2: 'ctb-ffffff' }), 'ctb-a1b2c3');
});

test('resolveRowId translates a legacy id through the alias map', () => {
    assert.equal(resolveRowId('row_2', { row_2: 'ctb-ffffff' }), 'ctb-ffffff');
});

test('resolveRowId returns an unknown id unchanged rather than throwing', () => {
    // A historical artifact may reference a row that has since been removed;
    // returning it unchanged lets the caller report a clean "not found".
    assert.equal(resolveRowId('row_9999', {}), 'row_9999');
});

test('the committed alias map matches what the CSV currently generates', () => {
    const committed = JSON.parse(
        fs.readFileSync(path.join(REPO, 'benchmark', 'row-id-aliases.json'), 'utf-8'));
    assert.deepEqual(committed.aliases, buildAliasMap(loadCsvRows(CSV)));
});
