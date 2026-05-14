#!/usr/bin/env node
/**
 * Results Analysis Script
 *
 * Analyzes benchmark results and generates detailed metrics for each LLM provider.
 *
 * Usage: node analyze_results.js [--output report.md] [--version v1|v2|all]
 *                                [--results <path>] [--dataset <path>] [--analysis <path>]
 *
 * Output:
 *   - Console summary
 *   - Markdown report (optional, via --output)
 *   - analysis.json: Detailed metrics in JSON format (path overridable via --analysis)
 *
 * Reproducing the original v1 analysis from the frozen snapshots:
 *   node analyze_results.js \
 *     --results results_v1.json --dataset dataset_v1.json \
 *     --analysis analysis_v1_recomputed.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, readFileSync } from 'node:fs';
import { loadRows } from './io.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Path to the compound-corpus labels file in the workspace workbench.
 * Exported for unit testing — ensures the path math is correct.
 * From benchmark/analyze_results.js, walk up 4 levels to reach the workspace root
 * (analyze_results.js → benchmark → .worktrees → citation-checker-script → alex-cite-checker).
 */
export const LABELS_PATH = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..', '..', '..', '..', 'workbench', 'compound-corpus', 'labels.json'
);

// Parse command line arguments
const args = process.argv.slice(2);
function flagValue(name) {
    const i = args.indexOf(name);
    return i !== -1 ? args[i + 1] : null;
}

const REPORT_PATH = flagValue('--output');
// VERSION_FILTER: 'all' | 'v1' | 'v2' | ... — limit results to entries whose
// dataset_version matches, so the original 76-row v1 metrics can be re-derived.
const VERSION_FILTER = flagValue('--version') || 'all';

// Configuration (paths are overridable so v1 snapshots can be re-analyzed in place)
const RESULTS_PATH = path.resolve(__dirname, flagValue('--results') || 'results.json');
const DATASET_PATH = path.resolve(__dirname, flagValue('--dataset') || 'dataset.json');
const ANALYSIS_PATH = path.resolve(__dirname, flagValue('--analysis') || 'analysis.json');

// Verdict categories for confusion matrix
const VERDICT_CATEGORIES = ['Supported', 'Partially supported', 'Not supported', 'Source unavailable'];

/**
 * Calculate the median of an array of numbers
 */
function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Normalize verdict to standard categories
 */
function normalizeVerdict(verdict) {
    if (!verdict) return 'Unknown';
    const v = verdict.toLowerCase().trim();
    if (v.includes('not supported') || v.includes('not_supported')) return 'Not supported';
    if (v.includes('partially')) return 'Partially supported';
    if (v.includes('unavailable')) return 'Source unavailable';
    if (v.includes('supported')) return 'Supported';
    if (v.includes('error')) return 'Error';
    return 'Unknown';
}

/**
 * Calculate accuracy metrics for a set of results
 */
function calculateMetrics(results) {
    const total = results.length;
    if (total === 0) return null;

    // Filter out errors
    const validResults = results.filter(r => !r.error && r.predicted_verdict !== 'ERROR');
    const validTotal = validResults.length;

    // Exact matches
    const exactMatches = validResults.filter(r => {
        const pred = normalizeVerdict(r.predicted_verdict);
        const truth = normalizeVerdict(r.ground_truth);
        return pred === truth;
    }).length;

    // Partial matches (Supported <-> Partially supported)
    const partialMatches = validResults.filter(r => {
        const pred = normalizeVerdict(r.predicted_verdict);
        const truth = normalizeVerdict(r.ground_truth);
        if (pred === truth) return false;
        return (
            (pred === 'Supported' && truth === 'Partially supported') ||
            (pred === 'Partially supported' && truth === 'Supported')
        );
    }).length;

    // Binary accuracy (Supported/Partial vs Not supported)
    const binaryCorrect = validResults.filter(r => {
        const pred = normalizeVerdict(r.predicted_verdict);
        const truth = normalizeVerdict(r.ground_truth);
        const predPositive = pred === 'Supported' || pred === 'Partially supported';
        const truthPositive = truth === 'Supported' || truth === 'Partially supported';
        return predPositive === truthPositive;
    }).length;

    // Confusion matrix
    const confusionMatrix = {};
    VERDICT_CATEGORIES.forEach(truth => {
        confusionMatrix[truth] = {};
        VERDICT_CATEGORIES.forEach(pred => {
            confusionMatrix[truth][pred] = 0;
        });
    });

    validResults.forEach(r => {
        const pred = normalizeVerdict(r.predicted_verdict);
        const truth = normalizeVerdict(r.ground_truth);
        if (confusionMatrix[truth] && confusionMatrix[truth][pred] !== undefined) {
            confusionMatrix[truth][pred]++;
        }
    });

    // Latency stats
    const latencies = results.map(r => r.latency_ms).filter(l => l > 0);
    const avgLatency = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;
    const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

    // Confidence stats
    const confidences = validResults.map(r => r.confidence).filter(c => c > 0);
    const avgConfidence = confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;

    // Confidence by correctness
    const correctConfidences = validResults
        .filter(r => normalizeVerdict(r.predicted_verdict) === normalizeVerdict(r.ground_truth))
        .map(r => r.confidence);
    const wrongConfidences = validResults
        .filter(r => normalizeVerdict(r.predicted_verdict) !== normalizeVerdict(r.ground_truth))
        .map(r => r.confidence);

    const avgConfidenceCorrect = correctConfidences.length > 0
        ? correctConfidences.reduce((a, b) => a + b, 0) / correctConfidences.length
        : 0;
    const avgConfidenceWrong = wrongConfidences.length > 0
        ? wrongConfidences.reduce((a, b) => a + b, 0) / wrongConfidences.length
        : 0;

    return {
        total,
        valid: validTotal,
        errors: total - validTotal,
        exactMatches,
        partialMatches,
        exactAccuracy: validTotal > 0 ? exactMatches / validTotal : 0,
        lenientAccuracy: validTotal > 0 ? (exactMatches + partialMatches) / validTotal : 0,
        binaryAccuracy: validTotal > 0 ? binaryCorrect / validTotal : 0,
        confusionMatrix,
        latency: {
            avg: avgLatency,
            min: minLatency,
            max: maxLatency
        },
        confidence: {
            avg: avgConfidence,
            avgWhenCorrect: avgConfidenceCorrect,
            avgWhenWrong: avgConfidenceWrong,
            calibration: avgConfidenceCorrect - avgConfidenceWrong // Higher = better calibrated
        }
    };
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(analysis) {
    let md = '# Citation Verification Benchmark Results\n\n';
    md += `Generated: ${new Date().toISOString()}\n\n`;

    // Overview
    md += '## Overview\n\n';
    md += `- Total entries: ${analysis.overview.totalEntries}\n`;
    md += `- Providers tested: ${analysis.overview.providers.join(', ')}\n`;
    md += `- Total API calls: ${analysis.overview.totalCalls}\n`;
    if (analysis.overview.pipelineCoverage) {
        const pc = analysis.overview.pipelineCoverage;
        md += `- Pipeline coverage: ${(pc.ratio * 100).toFixed(1)}% (${pc.usableEntries}/${analysis.overview.totalEntries} usable; ${pc.pipelineAttributedEntries} pipeline-attributed SU)\n`;
    }
    md += '\n';

    // Comparison table
    md += '## Provider Comparison\n\n';
    md += '| Provider | Model | Exact Accuracy | Lenient Accuracy | Binary Accuracy | Avg Latency |\n';
    md += '|----------|-------|----------------|------------------|-----------------|-------------|\n';

    const providers = Object.keys(analysis.providers).sort((a, b) =>
        analysis.providers[b].metrics.exactAccuracy - analysis.providers[a].metrics.exactAccuracy
    );

    for (const provider of providers) {
        const data = analysis.providers[provider];
        const m = data.metrics;
        md += `| ${data.name} | ${data.model} | ${(m.exactAccuracy * 100).toFixed(1)}% | `;
        md += `${(m.lenientAccuracy * 100).toFixed(1)}% | ${(m.binaryAccuracy * 100).toFixed(1)}% | `;
        md += `${m.latency.avg.toFixed(0)}ms |\n`;
    }
    md += '\n';

    // Detailed metrics per provider
    md += '## Detailed Results\n\n';

    for (const provider of providers) {
        const data = analysis.providers[provider];
        const m = data.metrics;

        md += `### ${data.name} (${data.model})\n\n`;

        md += '**Accuracy Metrics:**\n';
        md += `- Exact match (all): ${m.exactMatches}/${m.valid} (${(m.exactAccuracy * 100).toFixed(1)}%)\n`;
        if (data.metricsOnUsable && analysis.overview.pipelineCoverage?.pipelineAttributedEntries > 0) {
            const mu = data.metricsOnUsable;
            md += `- Exact match (model-attributed, excl. pipeline SU): ${mu.exactMatches}/${mu.valid} (${(mu.exactAccuracy * 100).toFixed(1)}%)\n`;
        }
        md += `- Lenient (includes partial): ${m.exactMatches + m.partialMatches}/${m.valid} (${(m.lenientAccuracy * 100).toFixed(1)}%)\n`;
        md += `- Binary (support vs not): ${(m.binaryAccuracy * 100).toFixed(1)}%\n`;
        md += `- Errors: ${m.errors}\n\n`;

        md += '**Latency:**\n';
        md += `- Average: ${m.latency.avg.toFixed(0)}ms\n`;
        md += `- Range: ${m.latency.min.toFixed(0)}ms - ${m.latency.max.toFixed(0)}ms\n\n`;

        md += '**Confidence Calibration:**\n';
        md += `- Average confidence: ${m.confidence.avg.toFixed(1)}\n`;
        md += `- When correct: ${m.confidence.avgWhenCorrect.toFixed(1)}\n`;
        md += `- When wrong: ${m.confidence.avgWhenWrong.toFixed(1)}\n`;
        md += `- Calibration gap: ${m.confidence.calibration.toFixed(1)} (higher = better)\n\n`;

        md += '**Confusion Matrix:**\n\n';
        md += '| Ground Truth \\ Predicted | Supported | Partial | Not Supported | Unavailable |\n';
        md += '|--------------------------|-----------|---------|---------------|-------------|\n';

        const shortNames = {
            'Supported': 'Supported',
            'Partially supported': 'Partial',
            'Not supported': 'Not Supported',
            'Source unavailable': 'Unavailable'
        };

        for (const truth of VERDICT_CATEGORIES) {
            const row = m.confusionMatrix[truth];
            md += `| ${shortNames[truth]} | ${row['Supported']} | ${row['Partially supported']} | `;
            md += `${row['Not supported']} | ${row['Source unavailable']} |\n`;
        }
        md += '\n';
    }

    // Recommendations
    md += '## Recommendations\n\n';

    const best = providers[0];
    const bestData = analysis.providers[best];

    md += `Based on the benchmark results:\n\n`;
    md += `1. **Best overall accuracy**: ${bestData.name} with ${(bestData.metrics.exactAccuracy * 100).toFixed(1)}% exact match\n`;

    const fastestProvider = providers.reduce((a, b) =>
        analysis.providers[a].metrics.latency.avg < analysis.providers[b].metrics.latency.avg ? a : b
    );
    md += `2. **Fastest response**: ${analysis.providers[fastestProvider].name} with ${analysis.providers[fastestProvider].metrics.latency.avg.toFixed(0)}ms average\n`;

    const bestCalibrated = providers.reduce((a, b) =>
        analysis.providers[a].metrics.confidence.calibration > analysis.providers[b].metrics.confidence.calibration ? a : b
    );
    md += `3. **Best calibrated**: ${analysis.providers[bestCalibrated].name} (confidence scores correlate with correctness)\n`;

    return md;
}

/**
 * Main analysis function
 */
function main() {
    console.log('=== Benchmark Results Analysis ===\n');

    // Check results exist
    if (!fs.existsSync(RESULTS_PATH)) {
        console.error(`Results not found: ${RESULTS_PATH}`);
        console.error('Run run_benchmark.js first to generate results.');
        process.exit(1);
    }

    // Load data (loadRows handles both legacy [...rows] and new {metadata, rows} shapes)
    let results = loadRows(RESULTS_PATH);
    console.log(`Loaded ${results.length} results from ${path.basename(RESULTS_PATH)}`);

    if (VERSION_FILTER !== 'all') {
        if (!fs.existsSync(DATASET_PATH)) {
            console.error(`--version filter requires dataset at ${DATASET_PATH}; not found.`);
            process.exit(1);
        }
        const dataset = loadRows(DATASET_PATH);
        const versionById = new Map(dataset.map(e => [e.id, e.dataset_version || 'v1']));
        const before = results.length;
        results = results.filter(r => (versionById.get(r.entry_id) || 'v1') === VERSION_FILTER);
        console.log(`Filtered to dataset version "${VERSION_FILTER}": ${results.length}/${before} results`);
    }

    // Group by provider
    const byProvider = {};
    results.forEach(r => {
        if (!byProvider[r.provider]) {
            byProvider[r.provider] = [];
        }
        byProvider[r.provider].push(r);
    });

    const providers = Object.keys(byProvider);
    console.log(`Providers: ${providers.join(', ')}\n`);

    // Pipeline-coverage stats: how many rows have a deterministic SU verdict
    // synthesized by the body-classifier rather than computed from an LLM call.
    // Pipeline-attributed rows are excluded from `metricsOnUsable` so per-provider
    // model accuracy isn't contaminated by deterministic pipeline-level outcomes.
    // See benchmark/run_benchmark.js (synthesizePipelineSU) and
    // core/body-classifier.js for how the pipeline_attributed flag is set.
    const totalEntryIds = new Set(results.map(r => r.entry_id));
    const pipelineAttributedEntryIds = new Set(
        results.filter(r => r.pipeline_attributed === true).map(r => r.entry_id)
    );
    const usableEntryCount = totalEntryIds.size - pipelineAttributedEntryIds.size;
    const pipelineCoverage = totalEntryIds.size > 0
        ? usableEntryCount / totalEntryIds.size
        : 0;

    // Calculate metrics per provider
    const analysis = {
        generated: new Date().toISOString(),
        overview: {
            datasetVersion: VERSION_FILTER,
            totalEntries: totalEntryIds.size,
            totalCalls: results.length,
            providers: providers,
            pipelineCoverage: {
                ratio: pipelineCoverage,
                usableEntries: usableEntryCount,
                pipelineAttributedEntries: pipelineAttributedEntryIds.size,
            }
        },
        providers: {}
    };

    console.log(`Pipeline coverage: ${(pipelineCoverage * 100).toFixed(1)}% (${usableEntryCount}/${totalEntryIds.size} entries usable; ${pipelineAttributedEntryIds.size} pipeline-attributed SU)\n`);

    for (const provider of providers) {
        const providerResults = byProvider[provider];
        const usableProviderResults = providerResults.filter(r => !r.pipeline_attributed);
        const metrics = calculateMetrics(providerResults);
        const metricsOnUsable = usableProviderResults.length > 0
            ? calculateMetrics(usableProviderResults)
            : null;

        // Get provider info from first result
        const firstResult = providerResults[0];

        analysis.providers[provider] = {
            name: provider.charAt(0).toUpperCase() + provider.slice(1),
            model: firstResult.model,
            sampleCount: providerResults.length,
            metrics,
            metricsOnUsable,
        };

        // Print summary
        console.log(`${provider.toUpperCase()} (${firstResult.model}):`);
        console.log(`  Exact accuracy (all):    ${(metrics.exactAccuracy * 100).toFixed(1)}%`);
        if (metricsOnUsable && pipelineAttributedEntryIds.size > 0) {
            console.log(`  Exact accuracy (model):  ${(metricsOnUsable.exactAccuracy * 100).toFixed(1)}% on ${metricsOnUsable.valid} usable rows`);
        }
        console.log(`  Lenient accuracy: ${(metrics.lenientAccuracy * 100).toFixed(1)}%`);
        console.log(`  Binary accuracy:  ${(metrics.binaryAccuracy * 100).toFixed(1)}%`);
        console.log(`  Avg latency: ${metrics.latency.avg.toFixed(0)}ms`);
        console.log(`  Errors: ${metrics.errors}/${metrics.total}`);
        console.log('');
    }

    // Atom-count distribution (only for rows with atomized verification)
    const atomCounts = results
        .filter(r => Array.isArray(r.atoms))
        .map(r => r.atoms.length);

    const atomCountSummary = atomCounts.length === 0
        ? null
        : {
            rowsWithAtoms: atomCounts.length,
            medianAtoms: median(atomCounts),
            pctSingleAtom: atomCounts.filter(n => n === 1).length / atomCounts.length,
            pctOverThree:  atomCounts.filter(n => n > 3).length / atomCounts.length,
            max: Math.max(...atomCounts),
        };

    // Include in the per-provider report
    if (atomCountSummary) {
        console.log('\nAtom-count distribution:');
        console.log(`  rows with atoms: ${atomCountSummary.rowsWithAtoms}`);
        console.log(`  median atoms: ${atomCountSummary.medianAtoms}`);
        console.log(`  % single-atom: ${(atomCountSummary.pctSingleAtom * 100).toFixed(1)}%`);
        console.log(`  % >3 atoms: ${(atomCountSummary.pctOverThree * 100).toFixed(1)}%`);
        console.log(`  max: ${atomCountSummary.max}`);
    }

    // Compoundness × verdict stratification (optional, joins against workbench/compound-corpus/labels.json)
    let labelsById = null;
    if (existsSync(LABELS_PATH)) {
        try {
            const parsed = JSON.parse(readFileSync(LABELS_PATH, 'utf8'));
            const rows = parsed.rows ?? parsed;   // tolerate {metadata, rows} or bare array
            labelsById = Object.fromEntries(rows.map(r => [r.entry_id, r]));
        } catch (e) {
            // Malformed labels.json — skip silently rather than crash the analyzer.
            console.warn(`compound-corpus labels.json present but unreadable: ${e.message}`);
        }
    }

    if (labelsById) {
        // Cross-tab: compoundness bucket (c=1 / c=2 / c=3+) × verdict bucket × correctness
        const buckets = { 1: [], 2: [], '3+': [] };
        for (const r of results) {
            const label = labelsById[r.entry_id];
            if (!label) continue;                  // row not labeled — skip
            const key = label.compoundness >= 3 ? '3+' : String(label.compoundness);
            if (!buckets[key]) continue;
            buckets[key].push(r);
        }

        console.log('\nCompoundness × verdict cross-tab (corpus labels):');
        for (const key of ['1', '2', '3+']) {
            const rs = buckets[key];
            if (rs.length === 0) continue;
            const correct = rs.filter(r => r.correct).length;
            const pct = (correct / rs.length * 100).toFixed(1);
            // Per-verdict breakdown
            const byVerdict = {};
            for (const r of rs) {
                const v = r.predicted_verdict ?? 'UNKNOWN';
                byVerdict[v] = (byVerdict[v] || 0) + 1;
            }
            const verdictStr = Object.entries(byVerdict)
                .map(([v, n]) => `${v}: ${n}`)
                .join(', ');
            console.log(`  c=${key}: ${rs.length} rows, ${correct} correct (${pct}%) — ${verdictStr}`);
        }
    }

    // Save analysis JSON
    fs.writeFileSync(ANALYSIS_PATH, JSON.stringify(analysis, null, 2));
    console.log(`Analysis saved to: ${ANALYSIS_PATH}`);

    // Generate markdown report if requested
    if (REPORT_PATH) {
        const report = generateMarkdownReport(analysis);
        fs.writeFileSync(REPORT_PATH, report);
        console.log(`Report saved to: ${REPORT_PATH}`);
    }

    // Print ranking
    console.log('\n=== Ranking (by exact accuracy) ===\n');

    const ranked = providers.sort((a, b) =>
        analysis.providers[b].metrics.exactAccuracy - analysis.providers[a].metrics.exactAccuracy
    );

    ranked.forEach((provider, index) => {
        const data = analysis.providers[provider];
        console.log(`${index + 1}. ${data.name}: ${(data.metrics.exactAccuracy * 100).toFixed(1)}%`);
    });
}

// Run
main();
