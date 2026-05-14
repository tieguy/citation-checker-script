import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Prompt-unification invariant: the benchmark must source BOTH its system
// and user prompts from core/prompts.js, not local copies. This guards
// against silent re-divergence — if someone re-introduces a local
// generateSystemPrompt or duplicates the core generateUserPrompt body, this
// test fails before drift shows up in benchmark numbers.
//
// The benchmark keeps a thin local wrapper around core.generateUserPrompt
// that builds the `Source URL: ...\n\nSource Content:\n<text>` shape that the
// userscript and CLI both produce naturally — that wrapper is OK; what's not
// OK is a local copy of the prompt-construction logic itself.
test('run_benchmark.js imports both prompt builders from core/prompts.js', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'benchmark', 'run_benchmark.js'),
    'utf-8'
  );
  assert.match(src, /import\s*\{[^}]*generateLegacy[^}]*\}\s*from\s*['"]\.\.\/core\/prompts\.js['"]/,
    'run_benchmark.js must import generateLegacy* from ../core/prompts.js');
  assert.doesNotMatch(src, /^function\s+generateSystemPrompt\s*\(/m,
    'run_benchmark.js must not define a local generateSystemPrompt — re-introducing it would re-create the prompt drift this PR closed');
  assert.doesNotMatch(src, /CLAIM FROM WIKIPEDIA:/,
    'run_benchmark.js must not contain the legacy local-prompt header — re-introducing it would re-create the prompt drift this PR closed');
});
