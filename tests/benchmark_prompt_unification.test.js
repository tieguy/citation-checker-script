import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// open-issues #29: the benchmark must source its system prompt from
// core/prompts.js, not a local copy. This guards against silent re-divergence
// — if someone re-introduces a local generateSystemPrompt or stops importing
// from core, this test fails before drift shows up in benchmark numbers.
test('run_benchmark.js imports generateSystemPrompt from core/prompts.js', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'benchmark', 'run_benchmark.js'),
    'utf-8'
  );
  assert.match(src, /import\s*\{[^}]*generateSystemPrompt[^}]*\}\s*from\s*['"]\.\.\/core\/prompts\.js['"]/,
    'run_benchmark.js must import generateSystemPrompt from ../core/prompts.js');
  assert.doesNotMatch(src, /^function\s+generateSystemPrompt\s*\(/m,
    'run_benchmark.js must not define a local generateSystemPrompt — see open-issues #29');
});
