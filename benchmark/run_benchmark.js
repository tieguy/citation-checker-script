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
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateSystemPrompt as coreGenerateSystemPrompt, generateUserPrompt } from '../core/prompts.js';
import { loadRows, loadMetadata, todayIso } from './io.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Reuse TCP/TLS connections across requests. Saves ~100–300ms per call (≈3–9%
// of a typical 3.5s LLM call — inference time dominates), but the main reason
// to enable it here is to avoid ephemeral-port / connection-tracking pressure
// when many requests fan out to the same host under per-host parallelism.
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 64 });

const MAX_RETRIES = 5;
const RETRYABLE_STATUS = /^HTTP (429|500|502|503|504)\b/;
const RETRYABLE_NETWORK = /timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up/i;

// Configuration
const DATASET_PATH = path.join(__dirname, 'dataset.json');
const RESULTS_PATH = path.join(__dirname, 'results.json');

// Provider configurations
const PROVIDERS = {
    // Open-source models via PublicAI (direct API)
    'apertus-70b': {
        name: 'Apertus 70B',
        model: 'swiss-ai/apertus-70b-instruct',
        endpoint: 'https://api.publicai.co/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'PUBLICAI_API_KEY',
        type: 'publicai'
    },
    'qwen-sealion': {
        name: 'Qwen SEA-LION v4',
        model: 'aisingapore/Qwen-SEA-LION-v4-32B-IT',
        endpoint: 'https://api.publicai.co/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'PUBLICAI_API_KEY',
        type: 'publicai'
    },
    'olmo-32b': {
        name: 'OLMo 3.1 32B',
        model: 'allenai/Olmo-3.1-32B-Instruct',
        endpoint: 'https://api.publicai.co/v1/chat/completions',
        requiresKey: true,
        keyEnv: 'PUBLICAI_API_KEY',
        type: 'publicai'
    },
    // Claude
    'claude-sonnet-4-5': {
        name: 'Claude Sonnet 4.5',
        model: 'claude-sonnet-4-5-20250929',
        endpoint: 'https://api.anthropic.com/v1/messages',
        requiresKey: true,
        keyEnv: 'ANTHROPIC_API_KEY',
        type: 'claude'
    },
    // Gemini
    'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash',
        model: 'gemini-2.5-flash',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        requiresKey: true,
        keyEnv: 'GEMINI_API_KEY',
        type: 'gemini'
    }
};

// Parse command line arguments
const args = process.argv.slice(2);
const providerArg = args.find(a => a.startsWith('--providers='));
const selectedProviders = providerArg
    ? providerArg.split('=')[1].split(',')
    : Object.keys(PROVIDERS);
const limitIndex = args.indexOf('--limit');
const LIMIT = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;
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

/**
 * Make API call to provider, retrying on transient failures.
 */
async function callProvider(provider, systemPrompt, userPrompt) {
    const config = PROVIDERS[provider];
    const startTime = Date.now();
    try {
        const result = await withRetry(() => {
            switch (config.type) {
                case 'publicai': return callPublicAI(config, systemPrompt, userPrompt);
                case 'claude':   return callClaude(config, systemPrompt, userPrompt);
                case 'openai':   return callOpenAI(config, systemPrompt, userPrompt);
                case 'gemini':   return callGemini(config, systemPrompt, userPrompt);
                default: throw new Error(`Unknown provider type: ${config.type}`);
            }
        });
        return { ...result, latency: Date.now() - startTime, error: null };
    } catch (error) {
        return {
            verdict: 'ERROR',
            confidence: 0,
            comments: error.message,
            latency: Date.now() - startTime,
            error: error.message
        };
    }
}

/**
 * Call PublicAI API
 */
async function callPublicAI(config, systemPrompt, userPrompt) {
    const apiKey = process.env[config.keyEnv];
    if (!apiKey) throw new Error(`Missing ${config.keyEnv}`);

    const response = await httpPost(config.endpoint, {
        model: config.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000
    }, {
        'Authorization': `Bearer ${apiKey}`
    });

    const content = response.choices?.[0]?.message?.content || '';
    return parseResponse(content);
}

/**
 * Call Claude API
 */
async function callClaude(config, systemPrompt, userPrompt) {
    const apiKey = process.env[config.keyEnv];
    if (!apiKey) throw new Error(`Missing ${config.keyEnv}`);

    const response = await httpPost(config.endpoint, {
        model: config.model,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
    }, {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
    });

    const content = response.content?.[0]?.text || '';
    return parseResponse(content);
}

/**
 * Call OpenAI API
 */
async function callOpenAI(config, systemPrompt, userPrompt) {
    const apiKey = process.env[config.keyEnv];
    if (!apiKey) throw new Error(`Missing ${config.keyEnv}`);

    const response = await httpPost(config.endpoint, {
        model: config.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000
    }, {
        'Authorization': `Bearer ${apiKey}`
    });

    const content = response.choices?.[0]?.message?.content || '';
    return parseResponse(content);
}

/**
 * Call Gemini API
 */
async function callGemini(config, systemPrompt, userPrompt) {
    const apiKey = process.env[config.keyEnv];
    if (!apiKey) throw new Error(`Missing ${config.keyEnv}`);

    const url = `${config.endpoint}?key=${apiKey}`;

    const response = await httpPost(url, {
        contents: [{
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
        }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
            // Constrains Gemini to emit syntactically valid JSON only;
            // see issue #75.
            responseMimeType: 'application/json'
        }
    });

    const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseResponse(content);
}

/**
 * Parse LLM response to extract verdict
 */
function parseResponse(content) {
    // Try to extract JSON from response
    let jsonStr = content;

    // Handle markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1];
    }

    // Try to find JSON object
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) {
        jsonStr = objMatch[0];
    }

    try {
        const parsed = JSON.parse(jsonStr);
        return {
            verdict: normalizeVerdict(parsed.verdict || ''),
            confidence: parsed.confidence || 0,
            comments: parsed.comments || '',
            raw_response: content
        };
    } catch (e) {
        // Fallback: try to extract verdict from text
        const verdictMatch = content.match(/verdict["\s:]+([A-Z_ ]+)/i);
        return {
            verdict: verdictMatch ? normalizeVerdict(verdictMatch[1]) : 'PARSE_ERROR',
            confidence: 0,
            comments: 'Failed to parse JSON response',
            raw_response: content
        };
    }
}

/**
 * Normalize verdict string
 */
function normalizeVerdict(verdict) {
    const v = verdict.toUpperCase().trim();
    if (v.includes('NOT SUPPORTED') || v.includes('NOT_SUPPORTED')) return 'Not supported';
    if (v.includes('PARTIALLY')) return 'Partially supported';
    if (v.includes('UNAVAILABLE')) return 'Source unavailable';
    if (v.includes('SUPPORTED')) return 'Supported';
    return verdict;
}

/**
 * HTTP POST helper
 */
function httpPost(url, body, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            agent: httpsAgent,
            headers: {
                'Content-Type': 'application/json',
                ...extraHeaders
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode >= 400) {
                        reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                        return;
                    }
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.write(JSON.stringify(body));
        req.end();
    });
}

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

    // Filter to complete entries only
    let entries = dataset.filter(e => e.extraction_status === 'complete' && !e.needs_manual_review);
    console.log(`${entries.length} entries are complete and ready for benchmarking`);

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
    const runMetadata = {
        run_at: new Date().toISOString(),
        prompt_date: process.env.BENCHMARK_PROMPT_DATE || todayIso(),
        prompt_source: process.env.BENCHMARK_PROMPT_OVERRIDE_FILE || 'core/prompts.js',
        dataset_extracted_at: datasetMetadata.extracted_at || null,
        dataset_version_filter: VERSION_FILTER
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
                const userPrompt = generateUserPrompt(entry.claim_text, entry.source_text);

                const result = await callProvider(provider, systemPrompt, userPrompt);

                results.push({
                    entry_id: entry.id,
                    provider: provider,
                    model: PROVIDERS[provider].model,
                    ground_truth: entry.ground_truth,
                    predicted_verdict: result.verdict,
                    confidence: result.confidence,
                    comments: result.comments,
                    latency_ms: result.latency,
                    error: result.error,
                    correct: compareVerdicts(result.verdict, entry.ground_truth),
                    timestamp: new Date().toISOString()
                });

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
 * Compare predicted verdict with ground truth
 */
function compareVerdicts(predicted, groundTruth) {
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

        console.log(`${PROVIDERS[provider].name} (${PROVIDERS[provider].model}):`);
        console.log(`  Exact match: ${exact}/${providerResults.length} (${(exact/providerResults.length*100).toFixed(1)}%)`);
        console.log(`  Partial match: ${partial}/${providerResults.length}`);
        console.log(`  Wrong: ${wrong}/${providerResults.length}`);
        console.log(`  Errors: ${errors}/${providerResults.length}`);
        console.log(`  Avg latency: ${avgLatency.toFixed(0)}ms`);
        console.log('');
    }
}

// Run only when invoked as a script, not when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}
