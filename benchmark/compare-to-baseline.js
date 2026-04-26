#!/usr/bin/env node
/**
 * Compare a benchmark analysis to a checked-in baseline. Used by CI tier 4
 * (accuracy-regression). Exits 0 on no regression, 1 on regression.
 *
 * See docs/design-plans/2026-04-26-ci.md for the full design.
 *
 * Usage:
 *   node benchmark/compare-to-baseline.js [analysis.json] [baseline.json]
 *   node benchmark/compare-to-baseline.js  # uses defaults
 *
 * Defaults:
 *   analysis: benchmark/analysis.json
 *   baseline: benchmark/baseline.json
 *
 * Tolerance:
 *   - binaryAccuracy: must be >= baseline - 2pp (i.e., a 2-percentage-point drop is allowed)
 *   - mustPassFailures: zero-tolerance on new failures (rows where the runner short-circuited
 *     to SOURCE UNAVAILABLE — see analyze_results.js' computeMustPassFailures).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_ANALYSIS_PATH = path.join(__dirname, 'analysis.json');
const DEFAULT_BASELINE_PATH = path.join(__dirname, 'baseline.json');

/**
 * Pure comparator. Returns a structured result describing any regressions.
 *
 * @param {object} analysis - The analyze_results.js output (analysis.json shape).
 * @param {object} baseline - The baseline file (baseline.json shape).
 * @param {object} [options]
 * @param {number} [options.binaryAccuracyToleranceFloorPp=-2] - How many percentage points
 *   the binary accuracy is allowed to drop. Default -2 (i.e., a 2pp drop fails).
 * @returns {{ ok: boolean, unseeded: boolean, regressions: Array<object> }}
 */
export function compareToBaseline(analysis, baseline, options = {}) {
  const { binaryAccuracyToleranceFloorPp = -2 } = options;

  if (baseline.schema_version !== 1) {
    throw new Error(
      `Unsupported baseline schema_version: ${baseline.schema_version} (expected 1)`,
    );
  }

  const baselineProviders = baseline.providers || {};
  if (Object.keys(baselineProviders).length === 0) {
    return {
      ok: true,
      unseeded: true,
      regressions: [],
      message: 'baseline.json has no providers — unseeded. Skipping comparison.',
    };
  }

  const regressions = [];
  const actualProviders = analysis.providers || {};

  for (const [provider, baseMetrics] of Object.entries(baselineProviders)) {
    const actualEntry = actualProviders[provider];
    if (!actualEntry) {
      regressions.push({
        provider,
        kind: 'provider-missing',
        message: `Baseline expects results for "${provider}", none in analysis.`,
      });
      continue;
    }

    const actualMetrics = actualEntry.metrics || {};
    const actualMustPassFailures = actualEntry.mustPassFailures ?? 0;

    // Binary accuracy regression
    if (typeof baseMetrics.binaryAccuracy === 'number') {
      const actualValue = actualMetrics.binaryAccuracy;
      if (typeof actualValue !== 'number') {
        regressions.push({
          provider,
          kind: 'binary-accuracy-missing',
          message: `Baseline has binaryAccuracy for "${provider}" but analysis does not.`,
          baseline: baseMetrics.binaryAccuracy,
        });
      } else {
        const deltaPp = (actualValue - baseMetrics.binaryAccuracy) * 100;
        if (deltaPp < binaryAccuracyToleranceFloorPp) {
          regressions.push({
            provider,
            kind: 'binary-accuracy-drop',
            baseline: baseMetrics.binaryAccuracy,
            actual: actualValue,
            delta_pp: deltaPp,
            floor_pp: binaryAccuracyToleranceFloorPp,
            message:
              `binaryAccuracy dropped ${(-deltaPp).toFixed(2)}pp (${baseMetrics.binaryAccuracy} → ${actualValue}); ` +
              `floor is ${binaryAccuracyToleranceFloorPp}pp.`,
          });
        }
      }
    }

    // Must-pass failures: zero tolerance on new failures.
    const baseMustPassFailures = baseMetrics.mustPassFailures ?? 0;
    if (actualMustPassFailures > baseMustPassFailures) {
      regressions.push({
        provider,
        kind: 'must-pass-new-failures',
        baseline_failures: baseMustPassFailures,
        actual_failures: actualMustPassFailures,
        new_failures: actualMustPassFailures - baseMustPassFailures,
        message:
          `Must-pass failures rose from ${baseMustPassFailures} to ${actualMustPassFailures} ` +
          `(${actualMustPassFailures - baseMustPassFailures} new). Rows with extraction_status='source_fetch_failed' must resolve to "Source unavailable".`,
      });
    }
  }

  return {
    ok: regressions.length === 0,
    unseeded: false,
    regressions,
  };
}

/**
 * Pretty-print the comparator result for human consumption (CI logs, terminal).
 */
export function formatResult(result) {
  if (result.unseeded) {
    return `[compare-to-baseline] ${result.message}`;
  }
  if (result.ok) {
    return `[compare-to-baseline] OK — no regressions detected.`;
  }
  const lines = [`[compare-to-baseline] FAIL — ${result.regressions.length} regression(s):`];
  for (const r of result.regressions) {
    lines.push(`  - [${r.provider}] ${r.kind}: ${r.message}`);
  }
  return lines.join('\n');
}

// CLI entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const analysisPath = args[0] || DEFAULT_ANALYSIS_PATH;
  const baselinePath = args[1] || DEFAULT_BASELINE_PATH;

  if (!fs.existsSync(analysisPath)) {
    console.error(`Analysis file not found: ${analysisPath}`);
    process.exit(2);
  }
  if (!fs.existsSync(baselinePath)) {
    console.error(`Baseline file not found: ${baselinePath}`);
    process.exit(2);
  }

  const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

  const result = compareToBaseline(analysis, baseline);
  console.log(formatResult(result));

  process.exit(result.ok ? 0 : 1);
}
