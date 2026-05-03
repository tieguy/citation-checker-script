#!/usr/bin/env node
/**
 * compute_ensemble.js — synthesize ensemble-vote rows for the OpenRouter
 * 5-model voting panel.
 *
 * Reads benchmark/results.json (the {metadata, rows} shape introduced in
 * the prompt-unification work) and, for each entry where all five panel
 * members produced a row, appends two synthesized rows:
 *
 *   openrouter-vote-5         — 4-class plurality vote with skeptical-rank
 *                               tiebreaker on tied verdicts.
 *   openrouter-vote-5-binary  — strict-majority support vote (3 of 5);
 *                               sub-majority defaults to "Not supported".
 *                               Materialized as Supported / Not supported
 *                               so analyze_results.js scores it on its
 *                               existing axes.
 *
 * Idempotent: any prior rows with these synthesized provider IDs are
 * stripped before new rows are appended.
 *
 * Usage:
 *   node compute_ensemble.js              # dry-run, prints what would be added
 *   node compute_ensemble.js --write      # append synthesized rows to results.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { computeNClassVote, computeBinaryVoteN } from './voting.js';
import { loadRows, loadMetadata, writeWithMetadata } from './io.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const PANEL = [
    'openrouter-mistral-small-3.2',
    'openrouter-olmo-3.1-32b',
    'openrouter-granite-4.1-8b',
    'openrouter-gemma-4-26b-a4b',
    'openrouter-qwen-3-32b'
];

const ENSEMBLE_4CLASS = 'openrouter-vote-5';
const ENSEMBLE_BINARY = 'openrouter-vote-5-binary';

// Mirror run_benchmark.js compareVerdicts so synthesized rows score on the
// same axes as native provider rows in analyze_results.js.
function compareVerdicts(predicted, groundTruth) {
    const p = (predicted || '').toLowerCase();
    const g = (groundTruth || '').toLowerCase();
    if (p === g) return 'exact';
    const normalize = v => {
        if (v.includes('not supported')) return 'not_supported';
        if (v.includes('partially')) return 'partial';
        if (v.includes('supported')) return 'supported';
        if (v.includes('unavailable')) return 'unavailable';
        return v;
    };
    if (normalize(p) === normalize(g)) return 'exact';
    const pn = normalize(p);
    const gn = normalize(g);
    if ((pn === 'partial' && gn === 'supported') || (pn === 'supported' && gn === 'partial')) {
        return 'partial';
    }
    return 'wrong';
}

function sumOrNull(values) {
    const valid = values.filter(v => typeof v === 'number');
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0);
}

export function buildVoteRows(rows, panel) {
    const realRows = rows.filter(r => r.provider !== ENSEMBLE_4CLASS && r.provider !== ENSEMBLE_BINARY);
    const byEntry = new Map();
    for (const r of realRows) {
        if (!byEntry.has(r.entry_id)) byEntry.set(r.entry_id, {});
        byEntry.get(r.entry_id)[r.provider] = r;
    }
    const synthesized = [];
    for (const [entryId, byProvider] of byEntry) {
        const panelRows = panel.map(p => byProvider[p]).filter(Boolean);
        if (panelRows.length !== panel.length) continue;
        const verdicts = panelRows.map(r => r.predicted_verdict);
        const groundTruth = panelRows[0].ground_truth;
        const totalCost = sumOrNull(panelRows.map(r => r.cost_usd));
        const totalLatency = sumOrNull(panelRows.map(r => r.latency_ms));
        const promptTokens = sumOrNull(panelRows.map(r => r.prompt_tokens));
        const completionTokens = sumOrNull(panelRows.map(r => r.completion_tokens));
        const timestamp = new Date().toISOString();

        const verdict4 = computeNClassVote(verdicts);
        synthesized.push({
            entry_id: entryId,
            provider: ENSEMBLE_4CLASS,
            model: 'plurality-5',
            ground_truth: groundTruth,
            predicted_verdict: verdict4,
            confidence: 0,
            comments: `Plurality vote of ${panel.join(', ')}`,
            latency_ms: totalLatency,
            cost_usd: totalCost,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            error: null,
            correct: compareVerdicts(verdict4, groundTruth),
            timestamp
        });

        const verdictBinary = computeBinaryVoteN(verdicts);
        synthesized.push({
            entry_id: entryId,
            provider: ENSEMBLE_BINARY,
            model: 'majority-5-binary',
            ground_truth: groundTruth,
            predicted_verdict: verdictBinary,
            confidence: 0,
            comments: `Strict-majority binary vote of ${panel.join(', ')}`,
            latency_ms: totalLatency,
            cost_usd: totalCost,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            error: null,
            correct: compareVerdicts(verdictBinary, groundTruth),
            timestamp
        });
    }
    return synthesized;
}

function main() {
    const args = process.argv.slice(2);
    const resultsArg = args.find(a => a.startsWith('--results='));
    const RESULTS_PATH = resultsArg
        ? resultsArg.split('=')[1]
        : path.join(__dirname, 'results.json');
    const WRITE = args.includes('--write');

    if (!fs.existsSync(RESULTS_PATH)) {
        console.error(`Results file not found: ${RESULTS_PATH}`);
        process.exit(1);
    }
    const rows = loadRows(RESULTS_PATH);
    const metadata = loadMetadata(RESULTS_PATH);
    const realRows = rows.filter(r => r.provider !== ENSEMBLE_4CLASS && r.provider !== ENSEMBLE_BINARY);
    const synthesized = buildVoteRows(rows, PANEL);

    const entryCount = new Set(synthesized.map(r => r.entry_id)).size;
    console.log(`Synthesizing ensemble rows from ${realRows.length} real rows across ${PANEL.length} panel members.`);
    console.log(`Entries with complete panel: ${entryCount}`);
    console.log(`Synthesized rows to add: ${synthesized.length} (${entryCount} ${ENSEMBLE_4CLASS} + ${entryCount} ${ENSEMBLE_BINARY})`);
    const stripped = rows.length - realRows.length;
    if (stripped > 0) console.log(`Prior synthesized rows stripped: ${stripped}`);

    if (!WRITE) {
        console.log('\nDry-run. Re-run with --write to append to results.json.');
        return;
    }
    const next = [...realRows, ...synthesized];
    writeWithMetadata(RESULTS_PATH, metadata, next);
    console.log(`\nWrote ${next.length} rows to ${RESULTS_PATH}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
