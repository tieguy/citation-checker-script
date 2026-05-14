import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSystemPrompt, generateUserPrompt } from '../core/prompts.js';

test('generateSystemPrompt returns a non-empty string', () => {
  const out = generateSystemPrompt();
  assert.equal(typeof out, 'string');
  assert.ok(out.length > 500, 'prompt should be substantial');
});

test('generateSystemPrompt enumerates the three model-attributed verdict categories', () => {
  // "Source unavailable" is intentionally absent from the LLM's verdict set —
  // it's now pipeline-derived (set by core/body-classifier.js). The prompt
  // explicitly notes the pre-screening so the model knows not to emit SU.
  const out = generateSystemPrompt();
  for (const verdict of ['SUPPORTED', 'PARTIALLY SUPPORTED', 'NOT SUPPORTED']) {
    assert.ok(out.includes(verdict), `missing verdict: ${verdict}`);
  }
  // Ensure SOURCE UNAVAILABLE is not offered as a valid verdict choice.
  assert.ok(!/SOURCE UNAVAILABLE.*\bSUPPORTED\b/s.test(out) || out.includes('pre-screened'),
    'prompt should explicitly note that SOURCE UNAVAILABLE is pipeline-derived, not a verdict the LLM emits');
});

test('generateUserPrompt embeds claim and source text', () => {
  const claim = 'THE CLAIM TEXT MARKER';
  const source = 'THE SOURCE TEXT MARKER';
  const out = generateUserPrompt(claim, source);
  assert.ok(out.includes(claim));
  assert.ok(out.includes(source));
});
