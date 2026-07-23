import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractRowBlocks, splitTopLevelParams, SUITE_TEMPLATE_TITLE } from '../benchmark/suite.js';

const T = SUITE_TEMPLATE_TITLE;
const row = (params) => `{{${T}|${params}}}`;

test('extractRowBlocks finds each row call and its full extent', () => {
    const page = `intro\n${row('id=a|citation=1')}\n${row('id=b|citation=2')}\nouttro`;
    const blocks = extractRowBlocks(page);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].balanced, true);
    assert.equal(blocks[0].text, row('id=a|citation=1'));
    assert.equal(blocks[1].text, row('id=b|citation=2'));
});

test('extractRowBlocks tolerates balanced braces inside a value', () => {
    const blocks = extractRowBlocks(row('id=a|rationale=a {b} c|citation=1'));
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].balanced, true);
    assert.equal(blocks[0].text, row('id=a|rationale=a {b} c|citation=1'));
});

test('extractRowBlocks flags an unbalanced brace instead of silently ending', () => {
    const blocks = extractRowBlocks(row('id=a|rationale=see {note|citation=1'));
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].balanced, false);
});

test('extractRowBlocks matches underscore and lowercase title variants', () => {
    const page = '{{user:alaexis/AI_Source_Verification/Benchmark/Row|id=a}}';
    assert.equal(extractRowBlocks(page).length, 1);
});

test('extractRowBlocks does not match the /doc subpage transclusion', () => {
    const page = `{{${T}/doc}}`;
    assert.equal(extractRowBlocks(page).length, 0);
});

test('splitTopLevelParams separates params without splitting inside a wikilink', () => {
    const block = row('id=a|rationale=see [[Foo|bar]] here|citation=1');
    const { name, params } = splitTopLevelParams(block);
    assert.equal(name, T);
    assert.deepEqual(params, ['id=a', 'rationale=see [[Foo|bar]] here', 'citation=1']);
});

test('splitTopLevelParams handles the multi-line pretty format', () => {
    const block = `{{${T}\n| id = a\n| truth = Supported\n}}`;
    const { params } = splitTopLevelParams(block);
    assert.deepEqual(params.map(p => p.trim()), ['id = a', 'truth = Supported']);
});
