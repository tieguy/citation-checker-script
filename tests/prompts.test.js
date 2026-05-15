import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAtomizerSystemPrompt,
  generateAtomizerUserPrompt,
  generateVerifierSystemPrompt,
  generateVerifierUserPrompt,
  generateJudgeRollupSystemPrompt,
  generateJudgeRollupUserPrompt,
} from '../core/prompts.js';

// === Atomizer ===

test('generateAtomizerSystemPrompt instructs JSON output with content/provenance kinds', () => {
  const out = generateAtomizerSystemPrompt();
  assert.match(out, /JSON/);
  assert.match(out, /content/);
  assert.match(out, /provenance/);
  assert.match(out, /atoms/i);
  // Structural cues for small models
  assert.match(out, /1\./);
  assert.match(out, /2\./);
});

test('generateAtomizerSystemPrompt explicitly distinguishes content vs provenance', () => {
  const out = generateAtomizerSystemPrompt();
  // Must define both kinds explicitly so small models can follow
  assert.match(out, /provenance.*author|provenance.*publication|provenance.*publication date/i);
  assert.match(out, /content.*assertion|content.*body|content.*article/i);
});

test('generateAtomizerUserPrompt embeds the claim verbatim', () => {
  const claim = 'In 2019, Jane Doe wrote in the Guardian that the dam was 95 meters tall.';
  const out = generateAtomizerUserPrompt(claim);
  assert.ok(out.includes(claim));
});

test('generateAtomizerUserPrompt is short when no container provided', () => {
  const out = generateAtomizerUserPrompt('A short claim.');
  // Without container, the prompt is a thin wrapper, not a re-statement of instructions
  assert.ok(out.length < 500, `user prompt too long: ${out.length} chars`);
});

test('generateAtomizerUserPrompt includes claim_container as context-only when provided', () => {
  const claim = 'the LTTE formally joined a common militant front';
  const container = 'In April 1984, the LTTE formally joined a common militant front, the Eelam National Liberation Front (ENLF), a union between LTTE, TELO, EROS, PLOTE and EPRLF.';
  const out = generateAtomizerUserPrompt(claim, container);
  // Both must appear, AND the prompt must make clear container is context-only
  assert.ok(out.includes(claim), 'claim must appear');
  assert.ok(out.includes(container), 'container must appear');
  assert.match(out, /context|surrounding|do not.*container/i,
    'must instruct the model to treat container as context, not source of atoms');
});

test('generateAtomizerUserPrompt ignores container when identical to claim (non-fragmentary)', () => {
  const claim = 'A short claim.';
  // When container == claim, no fragment context is needed — prompt stays in short form
  const out = generateAtomizerUserPrompt(claim, claim);
  assert.ok(out.length < 500, `user prompt unnecessarily long when container==claim: ${out.length} chars`);
});

// === Verifier ===

test('generateVerifierSystemPrompt enumerates supported/not_supported verdicts (no SU)', () => {
  const out = generateVerifierSystemPrompt();
  assert.match(out, /supported/);
  assert.match(out, /not_supported|not supported/i);
  // SOURCE_UNAVAILABLE is handled upstream by the body-usability classifier;
  // it must NOT appear in the verifier's output set.
  assert.doesNotMatch(out, /SOURCE[_\s]?UNAVAILABLE/i);
  assert.doesNotMatch(out, /source unavailable/i);
});

test('generateVerifierSystemPrompt includes structural cues for small models', () => {
  const out = generateVerifierSystemPrompt();
  // numbered steps + verdict taxonomy paragraph — informed by Granite regression
  assert.match(out, /1\./);
  assert.match(out, /2\./);
  // explicit verdict taxonomy
  assert.match(out, /verdict/i);
});

test('generateVerifierUserPrompt embeds atom assertion and source text', () => {
  const atom = { id: 'a1', assertion: 'The dam is 95 meters tall.', kind: 'content' };
  const sourceText = 'The dam, completed in 1972, stands 95 meters tall and spans the river.';
  const out = generateVerifierUserPrompt(atom, sourceText);
  assert.ok(out.includes(atom.assertion));
  assert.ok(out.includes('95 meters tall'));
});

test('generateVerifierUserPrompt scopes provenance atoms to metadata only', () => {
  const atom = { id: 'p1', assertion: 'Published in The Guardian.', kind: 'provenance' };
  const sourceText = 'The dam, completed in 1972, stands 95 meters tall.';
  const metadata = { publication: 'The Guardian', published: '2019-04-12' };
  const out = generateVerifierUserPrompt(atom, sourceText, metadata);
  // Provenance prompts must reference the metadata block, not just the body
  assert.match(out, /metadata|provenance|publication/i);
  assert.ok(out.includes('The Guardian'));
});

test('generateVerifierUserPrompt handles no-metadata case gracefully', () => {
  const atom = { id: 'a1', assertion: 'The dam is 95 meters tall.', kind: 'content' };
  const out = generateVerifierUserPrompt(atom, 'body text', undefined);
  assert.equal(typeof out, 'string');
  assert.ok(out.length > 0);
});

// === Judge rollup ===

test('generateJudgeRollupSystemPrompt enumerates SUPPORTED/PARTIALLY/NOT verdicts', () => {
  const out = generateJudgeRollupSystemPrompt();
  assert.match(out, /SUPPORTED/);
  assert.match(out, /PARTIALLY SUPPORTED/);
  assert.match(out, /NOT SUPPORTED/);
  // No SU
  assert.doesNotMatch(out, /SOURCE[_\s]?UNAVAILABLE/i);
});

test('generateJudgeRollupUserPrompt embeds the original claim and all atom results', () => {
  const claim = 'In 2019, Jane Doe wrote in the Guardian that the dam was 95 meters tall.';
  const atomResults = [
    { atomId: 'a1', verdict: 'supported', evidence: 'The dam stands 95 meters tall.' },
    { atomId: 'p1', verdict: 'not_supported', evidence: 'Metadata shows New York Times.' },
  ];
  const out = generateJudgeRollupUserPrompt(claim, atomResults);
  assert.ok(out.includes(claim));
  assert.ok(out.includes('supported'));
  assert.ok(out.includes('not_supported'));
  assert.ok(out.includes('95 meters tall'));
});
