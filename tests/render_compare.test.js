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
