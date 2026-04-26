import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareToBaseline,
  formatResult,
} from '../benchmark/compare-to-baseline.js';

const STUB_ANALYSIS = {
  providers: {
    'claude-haiku-4-5': {
      metrics: { binaryAccuracy: 0.857 },
      mustPassFailures: 0,
    },
  },
};

const STUB_BASELINE = {
  schema_version: 1,
  providers: {
    'claude-haiku-4-5': {
      binaryAccuracy: 0.857,
      mustPassFailures: 0,
    },
  },
};

test('unseeded baseline (empty providers) returns ok with unseeded flag', () => {
  const result = compareToBaseline(STUB_ANALYSIS, { schema_version: 1, providers: {} });
  assert.equal(result.ok, true);
  assert.equal(result.unseeded, true);
  assert.equal(result.regressions.length, 0);
});

test('exact baseline match returns ok with no regressions', () => {
  const result = compareToBaseline(STUB_ANALYSIS, STUB_BASELINE);
  assert.equal(result.ok, true);
  assert.equal(result.unseeded, false);
  assert.equal(result.regressions.length, 0);
});

test('binary accuracy within tolerance returns ok', () => {
  const analysis = JSON.parse(JSON.stringify(STUB_ANALYSIS));
  // Drop accuracy by 1.5pp; default floor is -2pp
  analysis.providers['claude-haiku-4-5'].metrics.binaryAccuracy = 0.842;
  const result = compareToBaseline(analysis, STUB_BASELINE);
  assert.equal(result.ok, true);
});

test('binary accuracy beyond tolerance fails', () => {
  const analysis = JSON.parse(JSON.stringify(STUB_ANALYSIS));
  // Drop accuracy by 3pp; default floor is -2pp
  analysis.providers['claude-haiku-4-5'].metrics.binaryAccuracy = 0.827;
  const result = compareToBaseline(analysis, STUB_BASELINE);
  assert.equal(result.ok, false);
  assert.equal(result.regressions.length, 1);
  assert.equal(result.regressions[0].kind, 'binary-accuracy-drop');
  assert.equal(result.regressions[0].provider, 'claude-haiku-4-5');
});

test('custom tolerance floor applied', () => {
  const analysis = JSON.parse(JSON.stringify(STUB_ANALYSIS));
  // Drop accuracy by 1pp
  analysis.providers['claude-haiku-4-5'].metrics.binaryAccuracy = 0.847;
  // Strict tolerance: -0.5pp floor — 1pp drop should fail
  const strict = compareToBaseline(analysis, STUB_BASELINE, { binaryAccuracyToleranceFloorPp: -0.5 });
  assert.equal(strict.ok, false);
  // Lenient tolerance: -5pp floor — 1pp drop should pass
  const lenient = compareToBaseline(analysis, STUB_BASELINE, { binaryAccuracyToleranceFloorPp: -5 });
  assert.equal(lenient.ok, true);
});

test('new must-pass failure fails with zero tolerance', () => {
  const analysis = JSON.parse(JSON.stringify(STUB_ANALYSIS));
  // Was 0, now 1
  analysis.providers['claude-haiku-4-5'].mustPassFailures = 1;
  const result = compareToBaseline(analysis, STUB_BASELINE);
  assert.equal(result.ok, false);
  assert.equal(result.regressions.length, 1);
  assert.equal(result.regressions[0].kind, 'must-pass-new-failures');
  assert.equal(result.regressions[0].new_failures, 1);
});

test('must-pass failures equal to baseline are accepted', () => {
  // Baseline already has 1 failure; analysis still has 1 → no new regression
  const baseline = JSON.parse(JSON.stringify(STUB_BASELINE));
  baseline.providers['claude-haiku-4-5'].mustPassFailures = 1;
  const analysis = JSON.parse(JSON.stringify(STUB_ANALYSIS));
  analysis.providers['claude-haiku-4-5'].mustPassFailures = 1;
  const result = compareToBaseline(analysis, baseline);
  assert.equal(result.ok, true);
});

test('missing provider in analysis fails', () => {
  const analysis = { providers: {} };
  const result = compareToBaseline(analysis, STUB_BASELINE);
  assert.equal(result.ok, false);
  assert.equal(result.regressions[0].kind, 'provider-missing');
  assert.equal(result.regressions[0].provider, 'claude-haiku-4-5');
});

test('analysis missing mustPassFailures is treated as zero', () => {
  // If the analyzer didn't emit mustPassFailures (e.g. older analysis.json),
  // treat it as 0 so there's no false positive.
  const analysis = JSON.parse(JSON.stringify(STUB_ANALYSIS));
  delete analysis.providers['claude-haiku-4-5'].mustPassFailures;
  const result = compareToBaseline(analysis, STUB_BASELINE);
  assert.equal(result.ok, true);
});

test('multiple regressions across providers all reported', () => {
  const baseline = {
    schema_version: 1,
    providers: {
      provider_a: { binaryAccuracy: 0.9, mustPassFailures: 0 },
      provider_b: { binaryAccuracy: 0.8, mustPassFailures: 0 },
    },
  };
  const analysis = {
    providers: {
      provider_a: { metrics: { binaryAccuracy: 0.85 }, mustPassFailures: 0 },
      provider_b: { metrics: { binaryAccuracy: 0.75 }, mustPassFailures: 0 },
    },
  };
  const result = compareToBaseline(analysis, baseline);
  assert.equal(result.ok, false);
  assert.equal(result.regressions.length, 2);
  const providers = result.regressions.map(r => r.provider).sort();
  assert.deepEqual(providers, ['provider_a', 'provider_b']);
});

test('unsupported schema_version throws', () => {
  assert.throws(
    () => compareToBaseline(STUB_ANALYSIS, { schema_version: 2, providers: {} }),
    /Unsupported baseline schema_version: 2/,
  );
});

test('formatResult on ok returns OK message', () => {
  const result = { ok: true, unseeded: false, regressions: [] };
  assert.match(formatResult(result), /OK — no regressions/);
});

test('formatResult on unseeded returns its message', () => {
  const result = { ok: true, unseeded: true, regressions: [], message: 'unseeded msg' };
  assert.equal(formatResult(result), '[compare-to-baseline] unseeded msg');
});

test('formatResult on regression lists each one', () => {
  const result = {
    ok: false,
    unseeded: false,
    regressions: [
      { provider: 'p1', kind: 'binary-accuracy-drop', message: 'm1' },
      { provider: 'p2', kind: 'must-pass-new-failures', message: 'm2' },
    ],
  };
  const out = formatResult(result);
  assert.match(out, /FAIL — 2 regression\(s\)/);
  assert.match(out, /\[p1\] binary-accuracy-drop: m1/);
  assert.match(out, /\[p2\] must-pass-new-failures: m2/);
});
