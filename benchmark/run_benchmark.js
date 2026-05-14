#!/usr/bin/env node
/**
 * Benchmark Runner Script
 *
 * Runs the enriched dataset through multiple LLM providers and records results.
 *
 * Usage: node run_benchmark.js [--providers claude,openai,gemini] [--limit N] [--resume] [--version v1|v2|v3|all] [--concurrency N]
 *
 * Environment variables for API keys:
 *   ANTHROPIC_API_KEY - Claude API key
 *   OPENAI_API_KEY - OpenAI API key
 *   GEMINI_API_KEY - Google Gemini API key
 *
 * Output:
 *   - results.json: Complete benchmark results
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateLegacySystemPrompt as coreGenerateSystemPrompt } from '../core/prompts.js';
import {
    callOpenAICompatibleChat,
    callClaudeAPI,
    callGeminiAPI,
    callOpenRouterAPI,
    callHuggingFaceAPI,
    PROVIDERS,
} from '../core/providers.js';
import { augmentWithCitoidStructured } from '../core/citoid.js';
import { verify } from '../core/worker.js';
import { loadRows, loadMetadata, todayIso } from './io.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MAX_RETRIES = 5;
const RETRYABLE_STATUS = /^HTTP (429|500|502|503|504)\b/;
const RETRYABLE_NETWORK = /timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up/i;

// Configuration
const DATASET_PATH = path.join(__dirname, 'dataset.json');
const RESULTS_PATH = path.join(__dirname, 'results.json');

/**
 * Parse atomized-pipeline flags from command-line arguments.
 * Supported forms:
 *   --no-atomized          → wantAtomized: false (default is true)
 *   --rollup-mode=deterministic|judge  → rollupMode set accordingly
 *   --use-small-atomizer   → useSmallAtomizer: true
 *   --atoms-cache=<path>   → atomsCache: <path> (read atoms from a prior run's
 *                            results.json instead of calling atomize() per row)
 *
 * @param {string[]} args - process.argv.slice(2) or equivalent
 * @returns {object} { ok: boolean, wantAtomized, rollupMode, useSmallAtomizer, atomsCache, exitCode?, message? }
 *   When ok === true: { ok: true, wantAtomized, rollupMode, useSmallAtomizer, atomsCache }
 *   When ok === false: { ok: false, exitCode, message } — caller should exit(exitCode) after printing message
 */
export function parseAtomizedFlags(args) {
    const wantAtomized = !args.includes('--no-atomized');

    const rollupModeArg = args.find(a => a.startsWith('--rollup-mode='));
    let rollupMode = 'deterministic';
    if (rollupModeArg) {
        const value = rollupModeArg.split('=')[1];
        if (!value) {
            return {
                ok: false,
                exitCode: 2,
                message: 'Invalid or missing --rollup-mode value. Use \'deterministic\' or \'judge\'.',
            };
        }
        if (value !== 'deterministic' && value !== 'judge') {
            return {
                ok: false,
                exitCode: 2,
                message: `Invalid --rollup-mode: ${value}. Use 'deterministic' or 'judge'.`,
            };
        }
        rollupMode = value;
    }

    const useSmallAtomizer = args.includes('--use-small-atomizer');

    const atomsCacheArg = args.find(a => a.startsWith('--atoms-cache='));
    let atomsCache = null;
    if (atomsCacheArg) {
        const value = atomsCacheArg.split('=')[1];
        if (!value) {
            return {
                ok: false,
                exitCode: 2,
                message: 'Missing --atoms-cache value. Use --atoms-cache=<path-to-results.json-or-atoms.json>.',
            };
        }
        atomsCache = value;
    }

    return { ok: true, wantAtomized, rollupMode, useSmallAtomizer, atomsCache };
}

/**
 * Load atoms from a cache file and return a Map of entry_id → atoms array.
 *
 * Accepts two shapes:
 *   1. A benchmark results.json: rows[].entry_id + rows[].atoms (the just-run
 *      output of run_benchmark.js with --atomized). If the same entry appears
 *      multiple times (multi-provider run), the first non-null atoms array wins
 *      — atomization is deterministic per (claim, atomizer), so any provider's
 *      row carries the same atoms.
 *   2. A standalone atomizer sweep (workbench/atomizer-sweep/atoms.json):
 *      rows[].id + rows[].atoms.
 *
 * Throws on unreadable file or zero-atom map (a silent empty cache would
 * fall through to per-row atomize calls and waste the run).
 *
 * @param {string} cachePath
 * @returns {Map<string, Array>}
 */
export function loadAtomsCache(cachePath) {
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const rows = raw.rows ?? raw;
    if (!Array.isArray(rows)) {
        throw new Error(`Atoms cache ${cachePath} has no usable rows array.`);
    }
    const map = new Map();
    for (const row of rows) {
        const id = row.entry_id ?? row.id;
        if (!id || !Array.isArray(row.atoms) || row.atoms.length === 0) continue;
        if (!map.has(id)) map.set(id, row.atoms);
    }
    if (map.size === 0) {
        throw new Error(`Atoms cache ${cachePath} produced an empty entry_id → atoms map.`);
    }
    return map;
}

/**
 * Build a result row to push to the results array.
 * Exported for unit testing — exercises the optional chaining pattern used
 * when verifyResult is null (error path) or defined (happy path).
 *
 * @param {object} params
 * @param {object} params.entry - dataset entry with id, ground_truth
 * @param {string} params.provider - provider name (key in PROVIDERS)
 * @param {string} params.model - resolved model name
 * @param {object|null} params.verifyResult - result from verify() or null on exception
 * @param {object} params.result - { verdict, confidence, comments, latency, error }
 * @param {number} params.latency - elapsed time in ms
 * @param {boolean} params.wantAtomized - flag; true if --no-atomized was NOT set
 * @returns {object} the row to push to results array
 */
export function buildResultRow({ entry, provider, model, verifyResult, result, latency, wantAtomized }) {
    return {
        entry_id: entry.id,
        provider,
        model,
        ground_truth: entry.ground_truth,
        predicted_verdict: result.verdict,
        confidence: result.confidence,
        comments: result.comments,
        latency_ms: result.latency,
        error: result.error,
        correct: compareVerdicts(result.verdict, entry.ground_truth),
        timestamp: new Date().toISOString(),
        atomized: wantAtomized,
        rollupMode: verifyResult?.rollupMode ?? null,
        atoms: verifyResult?.atoms ?? null,
        atomResults: verifyResult?.atomResults ?? null,
        judgeReasoning: verifyResult?.judgeReasoning ?? null,
    };
}

// Parse command line arguments
const args = process.argv.slice(2);
const providerArg = args.find(a => a.startsWith('--providers='));
const selectedProviders = providerArg
    ? providerArg.split('=')[1].split(',')
    : Object.keys(PROVIDERS);
// --limit accepts both `--limit N` and `--limit=N` to match the style of
// --concurrency, --rollup-mode, etc.
const limitArg = args.find(a => a.startsWith('--limit='));
const limitIndex = args.indexOf('--limit');
const LIMIT = (() => {
    const raw = limitArg
        ? limitArg.split('=')[1]
        : (limitIndex !== -1 ? args[limitIndex + 1] : null);
    const n = raw ? parseInt(raw, 10) : null;
    return Number.isFinite(n) && n > 0 ? n : null;
})();
const RESUME = args.includes('--resume');
const versionIndex = args.indexOf('--version');
// VERSION_FILTER: 'all' | 'v1' | 'v2' | ... — restricts which dataset entries
// to benchmark, so the original 76-row v1 analysis can be reproduced on demand.
const VERSION_FILTER = versionIndex !== -1 ? args[versionIndex + 1] : 'all';
const concurrencyArg = args.find(a => a.startsWith('--concurrency='));
const concurrencyIndex = args.indexOf('--concurrency');
const CONCURRENCY = (() => {
    const raw = concurrencyArg
        ? concurrencyArg.split('=')[1]
        : (concurrencyIndex !== -1 ? args[concurrencyIndex + 1] : null);
    const n = raw ? parseInt(raw, 10) : 5;
    return Number.isFinite(n) && n > 0 ? n : 5;
})();

// Parse atomized-pipeline flags (--no-atomized, --rollup-mode=deterministic|judge, --use-small-atomizer)
const atomizedFlagsParsed = parseAtomizedFlags(args);
if (!atomizedFlagsParsed.ok) {
    console.error(atomizedFlagsParsed.message);
    process.exit(atomizedFlagsParsed.exitCode);
}
const { wantAtomized, rollupMode, useSmallAtomizer, atomsCache } = atomizedFlagsParsed;

// Load atoms cache up-front so cache errors fail loudly before any LLM calls.
// Map is entry_id → atoms[]; consulted in the verify dispatch below.
const cachedAtomsByEntry = atomsCache ? loadAtomsCache(atomsCache) : null;
if (cachedAtomsByEntry) {
    console.log(`Atoms cache loaded from ${atomsCache}: ${cachedAtomsByEntry.size} entries`);
}

// generateSystemPrompt and generateUserPrompt are imported from core/prompts.js
// (single source of truth shared with main.js and cli/verify.js). The benchmark
// used to keep local copies of both that drifted silently from main.js's
// canonical pair — this PR is the unification.
//
// In the userscript and CLI paths, callers pass `sourceInfo` strings that
// carry `Source URL: <url>\n\nSource Content:\n<text>` metadata, which
// core.generateUserPrompt strips via its `Source Content:` regex before
// emitting the final `Claim: "<claim>"\n\nSource text:\n<text>` shape.
// The benchmark already has clean `source_text`, so it just passes that
// directly — core's else-branch uses the input verbatim and produces
// byte-identical output to the strip path.

/**
 * Resolve the system prompt at run time. Defaults to core/prompts.js
 * (single source of truth shared with main.js + cli/verify.js).
 *
 * Set BENCHMARK_PROMPT_OVERRIDE_FILE=<path> to load the system prompt
 * from a file instead — used for the historical-replay experiment that
 * scores past userscript prompts (recovered via `git show <sha>:core/prompts.js`
 * or `git show <sha>:main.js` for pre-#118 dates) against the current dataset.
 *
 * See benchmark/historical-runs/README.md for a worked example.
 */
function getSystemPrompt() {
    const override = process.env.BENCHMARK_PROMPT_OVERRIDE_FILE;
    if (override) {
        return fs.readFileSync(override, 'utf-8');
    }
    return coreGenerateSystemPrompt();
}

/**
 * Retry `fn` on transient failures (429, 5xx, network) with exponential
 * backoff + jitter. `sleepFn` is injectable so tests can run instantly.
 */
export async function withRetry(fn, { maxRetries = MAX_RETRIES, sleepFn = sleep } = {}) {
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const retryable = RETRYABLE_STATUS.test(error.message)
                || RETRYABLE_NETWORK.test(error.message);
            if (!retryable || attempt === maxRetries - 1) break;
            const backoff = Math.min(30000, 1000 * Math.pow(2, attempt)) + Math.random() * 500;
            await sleepFn(backoff);
        }
    }
    throw lastError;
}

// Benchmark-side knobs preserved verbatim from the pre-consolidation runner.
// core/providers.js has its own defaults tuned for userscript/CLI use; the
// runner overrides them here so that benchmark numbers stay comparable to
// past runs until a deliberate re-baselining experiment changes them.
// These are threaded through the providerConfig when calling verify().
const BENCHMARK_MAX_TOKENS = 1000;
const BENCHMARK_TEMPERATURE = 0.1;

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Return the API hostname for a configured provider key. Tasks sharing a
 * hostname share one concurrency budget, since they share an upstream
 * rate-limit boundary.
 */
export function hostForProvider(provider, providers = PROVIDERS) {
    return new URL(providers[provider].endpoint).hostname;
}

/**
 * Run `worker` over `items` with at most `concurrency` in flight at once.
 */
export async function runPool(items, concurrency, worker) {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (cursor < items.length) {
            const idx = cursor++;
            await worker(items[idx], idx);
        }
    });
    await Promise.all(runners);
}

/**
 * Coalesced atomic save: while a save is in flight, one more is queued
 * and runs once the current one finishes — collapsing N concurrent
 * `requestSave()` calls into at most 2 disk writes. Writes go to a temp
 * file and are renamed into place so a Ctrl+C mid-write cannot corrupt
 * results.json.
 */
export function makeSaver(filePath, metadata, getData) {
    let inFlight = null;
    let pending = false;
    const flush = async () => {
        const tmp = `${filePath}.tmp`;
        await fs.promises.writeFile(tmp, JSON.stringify({ metadata, rows: getData() }, null, 2));
        await fs.promises.rename(tmp, filePath);
    };
    const requestSave = () => {
        if (inFlight) { pending = true; return inFlight; }
        inFlight = (async () => {
            try {
                do {
                    pending = false;
                    await flush();
                } while (pending);
            } finally {
                inFlight = null;
            }
        })();
        return inFlight;
    };
    const drain = async () => {
        if (inFlight) await inFlight;
        if (pending) await requestSave();
    };
    return { requestSave, drain };
}

/**
 * Main benchmark function
 */
async function main() {
    console.log('=== Benchmark Runner ===\n');

    // Check dataset exists
    if (!fs.existsSync(DATASET_PATH)) {
        console.error(`Dataset not found: ${DATASET_PATH}`);
        console.error('Run extract_dataset.js first to create the dataset.');
        process.exit(1);
    }

    // Load dataset (handles both legacy [...rows] and new {metadata, rows} shapes)
    const dataset = loadRows(DATASET_PATH);
    const datasetMetadata = loadMetadata(DATASET_PATH);
    console.log(`Loaded ${dataset.length} entries from dataset`);

    // Filter to entries ready for benchmarking. Includes both:
    //   - extraction_status === 'complete'        — feeds normal LLM flow
    //   - extraction_status === 'body_unusable'   — feeds the synthetic-SU
    //     path below (no LLM call, deterministic SU verdict per provider)
    let entries = dataset.filter(
        e => (e.extraction_status === 'complete' || e.extraction_status === 'body_unusable')
             && !e.needs_manual_review
    );
    const usableCount = entries.filter(e => e.extraction_status === 'complete').length;
    const unusableCount = entries.length - usableCount;
    console.log(`${entries.length} entries ready for benchmarking (${usableCount} usable, ${unusableCount} body_unusable → synthetic SU)`);

    if (VERSION_FILTER !== 'all') {
        const before = entries.length;
        entries = entries.filter(e => (e.dataset_version || 'v1') === VERSION_FILTER);
        console.log(`Filtered to dataset version "${VERSION_FILTER}": ${entries.length}/${before} entries`);
    }

    if (entries.length === 0) {
        console.error('\nNo complete entries found. Please review and complete the dataset first.');
        process.exit(1);
    }

    if (LIMIT) {
        entries = entries.slice(0, LIMIT);
        console.log(`Limited to ${LIMIT} entries`);
    }

    // Check available providers
    const availableProviders = selectedProviders.filter(p => {
        const config = PROVIDERS[p];
        if (!config) {
            console.log(`Unknown provider: ${p}`);
            return false;
        }
        if (config.requiresKey && !process.env[config.keyEnv]) {
            console.log(`Skipping ${p}: missing ${config.keyEnv}`);
            return false;
        }
        return true;
    });

    if (availableProviders.length === 0) {
        console.error('\nNo providers available. Set API keys as environment variables.');
        process.exit(1);
    }

    console.log(`\nProviders to benchmark: ${availableProviders.join(', ')}`);

    // Surface decomposition source up-front so a stray Sonnet/Opus atomizer
    // doesn't go unnoticed until the bill arrives.
    if (wantAtomized) {
        if (cachedAtomsByEntry) {
            console.log(`Atomizer: cached (from ${atomsCache}; verifiers will not call atomize())`);
        } else {
            const lines = availableProviders.map(p => {
                const pc = PROVIDERS[p];
                const m = (useSmallAtomizer && pc.smallModel) ? pc.smallModel : pc.model;
                const tag = (useSmallAtomizer && pc.smallModel) ? '(smallModel)' : '(model — NO smallModel configured)';
                return `  ${p} → ${m} ${tag}`;
            });
            console.log(`Atomizer per provider (--use-small-atomizer=${useSmallAtomizer}):`);
            for (const line of lines) console.log(line);
        }
    } else {
        console.log('Atomized pipeline disabled (--no-atomized); using legacy single-call path.');
    }

    // Load existing results if resuming
    let results = [];
    const completedIds = new Set();

    if (RESUME && fs.existsSync(RESULTS_PATH)) {
        results = loadRows(RESULTS_PATH);
        results.forEach(r => completedIds.add(`${r.entry_id}|${r.provider}`));
        console.log(`Resuming: ${completedIds.size} results already completed`);
    }

    // Generate prompts
    const systemPrompt = getSystemPrompt();

    // Run-time metadata captured once and written into the results file header.
    // See benchmark/README.md "Reproducibility metadata" for the schema.
    // For historical-replay runs, set BENCHMARK_PROMPT_DATE=YYYY-MM-DD to
    // record the effective date of the overridden prompt; otherwise prompt_date
    // is today (the assumption being core/prompts.js was at HEAD).
    // Atomizer model resolution: if --atoms-cache was supplied, atomize() is
    // skipped entirely and atoms come from whatever model produced the cache;
    // we record the cache path so the model is traceable to that file's
    // metadata. If --use-small-atomizer was supplied, each provider's
    // smallModel is used (per provider, since providers can differ); we record
    // a map of provider → smallModel for the providers actually selected.
    // Otherwise atomization uses the provider's main model.
    function atomizerModelFor(provider) {
        const pc = PROVIDERS[provider];
        if (!pc) return null;
        return (useSmallAtomizer && pc.smallModel) ? pc.smallModel : pc.model;
    }
    const atomizerModelByProvider = {};
    for (const p of availableProviders) {
        atomizerModelByProvider[p] = atomizerModelFor(p);
    }

    const runMetadata = {
        run_at: new Date().toISOString(),
        prompt_date: process.env.BENCHMARK_PROMPT_DATE || todayIso(),
        prompt_source: process.env.BENCHMARK_PROMPT_OVERRIDE_FILE || 'core/prompts.js',
        dataset_extracted_at: datasetMetadata.extracted_at || null,
        dataset_version_filter: VERSION_FILTER,
        atomized: wantAtomized,
        rollup_mode: wantAtomized ? rollupMode : null,
        use_small_atomizer: useSmallAtomizer,
        atoms_cache: atomsCache,
        atomizer_model_by_provider: wantAtomized && !atomsCache ? atomizerModelByProvider : null,
    };

    // Build the task list, skipping anything already completed (resume).
    const allTasks = [];
    for (const entry of entries) {
        for (const provider of availableProviders) {
            if (completedIds.has(`${entry.id}|${provider}`)) continue;
            allTasks.push({ entry, provider });
        }
    }

    // Group tasks by API host so providers sharing an endpoint (e.g. all PublicAI
    // models hit api.publicai.co) share a single concurrency budget instead of
    // multiplying it. Independent hosts run their pools in parallel.
    const tasksByHost = new Map();
    for (const t of allTasks) {
        const host = hostForProvider(t.provider);
        if (!tasksByHost.has(host)) tasksByHost.set(host, []);
        tasksByHost.get(host).push(t);
    }

    const totalTasks = entries.length * availableProviders.length;
    let completed = completedIds.size;
    const remaining = allTasks.length;

    console.log(`\nRunning ${remaining} benchmark tasks (${totalTasks} total, ${completed} cached)`);
    console.log(`Concurrency: ${CONCURRENCY} per host across ${tasksByHost.size} host(s)\n`);

    const { requestSave, drain } = makeSaver(RESULTS_PATH, runMetadata, () => results);

    // Flush in-flight writes on Ctrl+C so resume state stays accurate.
    let interrupted = false;
    const onSigint = async () => {
        if (interrupted) process.exit(130);
        interrupted = true;
        console.log('\nInterrupted, flushing results...');
        await drain();
        process.exit(130);
    };
    process.on('SIGINT', onSigint);

    const startedAt = Date.now();

    await Promise.all(
        [...tasksByHost.entries()].map(([host, hostTasks]) =>
            runPool(hostTasks, CONCURRENCY, async ({ entry, provider }) => {
                // body_unusable rows synthesize a "Source unavailable" verdict
                // for every provider without invoking the LLM. The body-classifier
                // (in extract_dataset.js) already determined the answer; the
                // benchmark just records it. Short-circuit BEFORE Citoid augmentation
                // since augmenting a body we'll never send to the LLM is wasted work.
                if (entry.extraction_status === 'body_unusable') {
                    results.push(synthesizePipelineSU(entry, provider, PROVIDERS[provider].model));
                    completed++;
                    console.log(`[${completed}/${totalTasks}] ${entry.id} / ${provider} (pipeline_attributed=${entry.body_unusable_reason})`);
                    requestSave();
                    return;
                }

                // Augment source text with Citoid bibliographic metadata when enabled
                // (default ON; set CITOID_AUGMENT=0 to disable).
                const augmentEnabled = process.env.CITOID_AUGMENT !== '0';
                const { sourceText, metadata } = augmentEnabled
                    ? await augmentWithCitoidStructured(entry.source_text, entry.source_url)
                    : { sourceText: entry.source_text, metadata: null };

                // Call the verify() dispatcher with atomized=false for Phase 5.
                // Phase 6 will add the --atomized flag and surface atoms in results.json.
                const providerConfig = PROVIDERS[provider];
                const apiKey = providerConfig.keyEnv ? process.env[providerConfig.keyEnv] : undefined;

                let result;
                let verifyResult = null;
                const startTime = Date.now();
                try {
                    const verifyOpts = {
                        atomized: wantAtomized,
                        rollupMode,
                        useSmallAtomizer,
                        claimContainer: entry.claim_container,
                    };
                    if (cachedAtomsByEntry) {
                        const cached = cachedAtomsByEntry.get(entry.id);
                        if (cached) verifyOpts.atoms = cached;
                    }
                    if (process.env.BENCHMARK_PROMPT_OVERRIDE_FILE) {
                        verifyOpts.systemPromptOverride = systemPrompt;
                    }
                    const augmentedConfig = {
                        ...providerConfig,
                        apiKey,
                        maxTokens: BENCHMARK_MAX_TOKENS,
                        temperature: BENCHMARK_TEMPERATURE,
                    };
                    verifyResult = await verify(
                        entry.claim_text,
                        sourceText,
                        metadata,
                        augmentedConfig,
                        verifyOpts
                    );
                    result = {
                        verdict: verifyResult.verdict,
                        confidence: verifyResult.confidence,
                        comments: verifyResult.comments,
                        latency: Date.now() - startTime,
                        error: null,
                        raw_response: null,
                    };
                } catch (error) {
                    result = {
                        verdict: 'ERROR',
                        confidence: 0,
                        comments: error.message,
                        latency: Date.now() - startTime,
                        error: error.message,
                    };
                }

                results.push(buildResultRow({
                    entry,
                    provider,
                    model: PROVIDERS[provider].model,
                    verifyResult,
                    result,
                    latency: result.latency,
                    wantAtomized,
                }));

                completed++;
                const tag = result.error ? ' ERROR' : '';
                console.log(`[${completed}/${totalTasks}] ${entry.id} / ${provider} (${result.latency}ms)${tag}`);

                requestSave();
            })
        )
    );

    await drain();
    process.off('SIGINT', onSigint);

    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\nBenchmark complete in ${elapsedSec}s. Results saved to: ${RESULTS_PATH}`);

    // Print quick summary
    printSummary(results, availableProviders);
}

/**
 * Synthesize a deterministic "Source unavailable" result for a body_unusable
 * dataset row, without invoking the LLM. Used by the runner for rows where
 * the body-classifier flagged structurally-bad extracted content (Wayback
 * chrome, CSS leak, anti-bot challenge, etc.). The `pipeline_attributed`
 * flag lets analyze_results.js split pipeline-vs-model attribution in the
 * per-provider accuracy metric.
 */
export function synthesizePipelineSU(entry, provider, model) {
    const verdict = 'Source unavailable';
    return {
        entry_id: entry.id,
        provider,
        model,
        ground_truth: entry.ground_truth,
        predicted_verdict: verdict,
        confidence: 'High',
        comments: `Pipeline-attributed (${entry.body_unusable_reason || 'unknown'})`,
        latency_ms: 0,
        error: null,
        correct: compareVerdicts(verdict, entry.ground_truth),
        pipeline_attributed: true,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Compare predicted verdict with ground truth
 */
export function compareVerdicts(predicted, groundTruth) {
    const p = predicted.toLowerCase();
    const g = groundTruth.toLowerCase();

    // Exact match
    if (p === g) return 'exact';

    // Normalize for comparison
    const normalize = v => {
        if (v.includes('not supported')) return 'not_supported';
        if (v.includes('partially')) return 'partial';
        if (v.includes('supported')) return 'supported';
        if (v.includes('unavailable')) return 'unavailable';
        return v;
    };

    if (normalize(p) === normalize(g)) return 'exact';

    // Partial match (e.g., predicted "partial" for "supported" is closer than "not supported")
    const pn = normalize(p);
    const gn = normalize(g);

    if ((pn === 'partial' && gn === 'supported') || (pn === 'supported' && gn === 'partial')) {
        return 'partial';
    }

    return 'wrong';
}

/**
 * Print summary statistics
 */
function printSummary(results, providers) {
    console.log('\n=== Summary ===\n');

    for (const provider of providers) {
        const providerResults = results.filter(r => r.provider === provider);
        if (providerResults.length === 0) continue;

        const exact = providerResults.filter(r => r.correct === 'exact').length;
        const partial = providerResults.filter(r => r.correct === 'partial').length;
        const wrong = providerResults.filter(r => r.correct === 'wrong').length;
        const errors = providerResults.filter(r => r.error).length;
        const avgLatency = providerResults.reduce((sum, r) => sum + r.latency_ms, 0) / providerResults.length;

        const costRows = providerResults.filter(r => typeof r.cost_usd === 'number');
        const totalCost = costRows.reduce((sum, r) => sum + r.cost_usd, 0);

        console.log(`${PROVIDERS[provider].name} (${PROVIDERS[provider].model}):`);
        console.log(`  Exact match: ${exact}/${providerResults.length} (${(exact/providerResults.length*100).toFixed(1)}%)`);
        console.log(`  Partial match: ${partial}/${providerResults.length}`);
        console.log(`  Wrong: ${wrong}/${providerResults.length}`);
        console.log(`  Errors: ${errors}/${providerResults.length}`);
        console.log(`  Avg latency: ${avgLatency.toFixed(0)}ms`);
        if (costRows.length > 0) {
            const meanCost = totalCost / costRows.length;
            const correctCount = costRows.filter(r => r.correct === 'exact').length;
            const costPerCorrect = correctCount > 0 ? totalCost / correctCount : null;
            console.log(`  Total cost: $${totalCost.toFixed(6)} (over ${costRows.length} priced calls)`);
            console.log(`  Mean cost/call: $${meanCost.toFixed(6)}`);
            if (costPerCorrect !== null) {
                console.log(`  Cost per correct (exact): $${costPerCorrect.toFixed(6)}`);
            }
        }
        console.log('');
    }
}

// Run only when invoked as a script, not when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}
