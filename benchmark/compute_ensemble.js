#!/usr/bin/env node
/**
 * compute_ensemble.js — synthesize ensemble-vote rows for the OpenRouter
 * voting panels.
 *
 * Reads benchmark/results.json (the {metadata, rows} shape introduced in
 * the prompt-unification work) and, for each panel where every member
 * produced a row for an entry, appends two synthesized rows:
 *
 *   openrouter-vote-N         — 4-class plurality vote with skeptical-rank
 *                               tiebreaker on tied verdicts.
 *   openrouter-vote-N-binary  — strict-majority support vote (>N/2);
 *                               sub-majority defaults to "Not supported".
 *                               Materialized as Supported / Not supported
 *                               so analyze_results.js scores it on its
 *                               existing axes.
 *
 * Two panels are recognized:
 *   PANEL_FULL — Mistral + OLMo + Granite + Gemma + Qwen (vote-5 / vote-5-binary)
 *   PANEL_FAST — Mistral + Granite + Gemma           (vote-3 / vote-3-binary)
 * The fast set drops the two slowest panel members for smoketesting; the full
 * set is the headline ensemble.
 *
 * Idempotent: any prior rows with synthesized provider IDs (any
 * openrouter-vote-N or openrouter-vote-N-binary) are stripped before new
 * rows are appended.
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

export const PANEL_FULL = [
    'openrouter-mistral-small-3.2',
    'openrouter-olmo-3.1-32b',
    'openrouter-granite-4.1-8b',
    'openrouter-gemma-4-26b-a4b',
    'openrouter-qwen-3-32b'
];

// PANEL_FAST drops the two slowest members of the full panel (Qwen and
// OLMo). Used for smoketesting prompt or pipeline changes — finishes a
// whole-dataset sweep in ~1/3 of the full-panel wall time while still
// producing a usable ensemble verdict.
export const PANEL_FAST = [
    'openrouter-mistral-small-3.2',
    'openrouter-granite-4.1-8b',
    'openrouter-gemma-4-26b-a4b'
];

// PANEL is the historical name; preserved as an alias to PANEL_FULL so
// that callers and tests written before the fast-set existed keep working.
export const PANEL = PANEL_FULL;

function ensembleProviders(panel) {
    return {
        fourClass: `openrouter-vote-${panel.length}`,
        binary: `openrouter-vote-${panel.length}-binary`
    };
}

const SYNTH_PROVIDER_RE = /^openrouter-vote-\d+(-binary)?$/;

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
    const { fourClass: ensemble4Class, binary: ensembleBinary } = ensembleProviders(panel);
    const realRows = rows.filter(r => !SYNTH_PROVIDER_RE.test(r.provider));
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
            provider: ensemble4Class,
            model: `plurality-${panel.length}`,
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
            provider: ensembleBinary,
            model: `majority-${panel.length}-binary`,
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
    const realRows = rows.filter(r => !SYNTH_PROVIDER_RE.test(r.provider));
    const stripped = rows.length - realRows.length;

    // Synthesize both panels where their members are present. buildVoteRows
    // skips entries with incomplete panels, so a results.json that only has
    // the fast-set's three providers will get vote-3 rows and zero vote-5.
    const panels = [
        { name: 'PANEL_FULL', members: PANEL_FULL },
        { name: 'PANEL_FAST', members: PANEL_FAST }
    ];
    const allSynthesized = [];
    for (const { name, members } of panels) {
        const synth = buildVoteRows(realRows, members);
        const entryCount = new Set(synth.map(r => r.entry_id)).size;
        const { fourClass, binary } = ensembleProviders(members);
        console.log(`${name} (${members.length} members → ${fourClass} / ${binary}): ${entryCount} entries with complete panel, ${synth.length} synthesized rows.`);
        allSynthesized.push(...synth);
    }
    if (stripped > 0) console.log(`Prior synthesized rows stripped: ${stripped}`);

    if (!WRITE) {
        console.log('\nDry-run. Re-run with --write to append to results.json.');
        return;
    }
    const next = [...realRows, ...allSynthesized];
    writeWithMetadata(RESULTS_PATH, metadata, next);
    console.log(`\nWrote ${next.length} rows to ${RESULTS_PATH}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
