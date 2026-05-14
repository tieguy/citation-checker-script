// Stage 2 of the atomized verification pipeline. Verifies each atom
// independently against the right slice of input — content atoms against
// the source body, provenance atoms against the citoid metadata block.
//
// AtomResult = { atomId: string, verdict: 'supported' | 'not_supported',
//                evidence?: string, error?: string }
//
// Concurrency: by default each atom is dispatched immediately
// (Promise.all over the array). `opts.concurrency` caps the pool when
// atom counts get large (rate-limit safety).
//
// Failure handling: per-atom errors do NOT reject the whole call.
// They surface as { atomId, verdict: 'not_supported', error } so the
// rollup stage can incorporate partial information.

import { callProviderAPI } from './providers.js';
import {
    generateVerifierSystemPrompt,
    generateVerifierUserPrompt,
} from './prompts.js';

const DEFAULT_MAX_TOKENS = 512;

/**
 * Resolve the effective maxTokens value, preferring providerConfig.maxTokens
 * if set, falling back to the default. Exported for unit testing.
 * @param {object} providerConfig
 * @param {number} fallback — the default value (usually DEFAULT_MAX_TOKENS)
 * @returns {number}
 */
export function resolveMaxTokens(providerConfig, fallback) {
    return providerConfig.maxTokens ?? fallback;
}

async function defaultTransport(providerConfig, { systemPrompt, userPrompt, signal }) {
    const callConfig = {
        ...providerConfig,
        systemPrompt,
        userContent: userPrompt,
        maxTokens: resolveMaxTokens(providerConfig, DEFAULT_MAX_TOKENS),
        signal,
    };
    return await callProviderAPI(providerConfig.type, callConfig);
}

export function parseAtomResultResponse(text, atomId) {
    if (!text || typeof text !== 'string') {
        return { atomId, verdict: 'not_supported', error: 'empty response' };
    }
    const cleaned = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        return { atomId, verdict: 'not_supported', error: 'unparseable JSON' };
    }
    const verdict = parsed?.verdict;
    if (verdict !== 'supported' && verdict !== 'not_supported') {
        return { atomId, verdict: 'not_supported', error: 'unknown verdict: ' + verdict };
    }
    const result = { atomId, verdict };
    if (typeof parsed.evidence === 'string') result.evidence = parsed.evidence;
    return result;
}

async function verifyOneAtom(atom, sourceText, metadata, providerConfig, transport, signal) {
    try {
        const systemPrompt = generateVerifierSystemPrompt();
        const userPrompt = generateVerifierUserPrompt(atom, sourceText, metadata);
        const response = await transport(providerConfig, {
            systemPrompt,
            userPrompt,
            signal,
        });
        return parseAtomResultResponse(response?.text ?? '', atom.id);
    } catch (e) {
        return {
            atomId: atom.id,
            verdict: 'not_supported',
            error: e?.message ?? String(e),
        };
    }
}

// Simple promise pool — bounded concurrency. Replaces Promise.all() when
// opts.concurrency is set. Standard pattern; no library dependency.
async function runPool(items, concurrency, worker) {
    const results = new Array(items.length);
    let next = 0;
    async function consume() {
        while (true) {
            const i = next++;
            if (i >= items.length) return;
            results[i] = await worker(items[i], i);
        }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, consume);
    await Promise.all(workers);
    return results;
}

/**
 * Verify all atoms against the source.
 *
 * @param {Array} atoms — from atomize()
 * @param {string} sourceText
 * @param {object|null} metadata — citoid bibliographic data; required for provenance atoms
 * @param {object} providerConfig — a PROVIDERS[name] entry
 * @param {object} [opts]
 * @param {number} [opts.concurrency] — bound pool size; default = atoms.length (unbounded)
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.transport]
 * @returns {Promise<Array<{atomId, verdict, evidence?, error?}>>}
 */
export async function verifyAtoms(atoms, sourceText, metadata, providerConfig, opts = {}) {
    const transport = opts.transport ?? defaultTransport;
    const concurrency = opts.concurrency ?? atoms.length;

    return await runPool(atoms, concurrency, async (atom) =>
        verifyOneAtom(atom, sourceText, metadata, providerConfig, transport, opts.signal)
    );
}
