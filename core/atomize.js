// Stage 1 of the atomized verification pipeline. Splits a compound claim
// into discrete verifiable assertions ("atoms"), each tagged as either
// content (verified against the source body) or provenance (verified
// against citoid metadata).
//
// Atom = { id: string, assertion: string, kind: 'content' | 'provenance' }
//
// Transport contract (for opts.transport):
//   transport(providerConfig, { systemPrompt, userPrompt, signal, model? })
//     → Promise<{ text: string, usage?: object }>
//
// Default transport is callProviderAPI from core/providers.js, wrapped
// so it returns the same shape regardless of upstream API. Tests can
// inject a synchronous fake.

import { callProviderAPI } from './providers.js';
import {
    generateAtomizerSystemPrompt,
    generateAtomizerUserPrompt,
} from './prompts.js';

const DEFAULT_MAX_TOKENS = 1024;

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

async function defaultTransport(providerConfig, { systemPrompt, userPrompt, signal, model }) {
    const callConfig = {
        ...providerConfig,
        model: model ?? providerConfig.model,
        systemPrompt,
        userContent: userPrompt,
        maxTokens: resolveMaxTokens(providerConfig, DEFAULT_MAX_TOKENS),
        signal,
    };
    return await callProviderAPI(providerConfig.type, callConfig);
}

/**
 * Decompose a claim into atoms.
 *
 * @param {string} claim
 * @param {object} providerConfig — a PROVIDERS[name] entry from core/providers.js
 * @param {object} [opts]
 * @param {string} [opts.claimContainer] — surrounding sentence/paragraph context
 *   (load-bearing for fragmentary claim_text from mid-sentence citations).
 *   When provided and different from `claim`, threaded to the atomizer prompt
 *   as context-only.
 * @param {boolean} [opts.useSmallModel] — opt into providerConfig.smallModel
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.transport] — test-injection hook
 * @returns {Promise<Array<{id: string, assertion: string, kind: 'content'|'provenance'}>>}
 */
export async function atomize(claim, providerConfig, opts = {}) {
    const transport = opts.transport ?? defaultTransport;
    const model = opts.useSmallModel && providerConfig.smallModel
        ? providerConfig.smallModel
        : providerConfig.model;

    const systemPrompt = generateAtomizerSystemPrompt();
    const userPrompt = generateAtomizerUserPrompt(claim, opts.claimContainer);

    let response;
    try {
        response = await transport(providerConfig, {
            systemPrompt,
            userPrompt,
            signal: opts.signal,
            model,
        });
    } catch (e) {
        // Transport error (network, 429, etc.) — propagate. Caller decides
        // whether to retry or surface up.
        throw e;
    }

    const text = response?.text ?? '';
    const atoms = parseAtomsResponse(text);
    if (atoms === null) {
        // Malformed JSON or wrong shape — degrade gracefully to a single
        // content atom containing the full claim. Downstream pipeline
        // still produces a meaningful verdict (atom-count of 1 is the
        // single-pass-equivalent case).
        return [{ id: 'a1', assertion: claim, kind: 'content' }];
    }
    return atoms;
}

// Exported for unit testing only.
export function parseAtomsResponse(text) {
    if (!text || typeof text !== 'string') return null;

    // Models sometimes wrap JSON in markdown fences; strip them.
    const cleaned = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        return null;
    }

    if (!parsed || !Array.isArray(parsed.atoms)) return null;

    const atoms = parsed.atoms.filter(a =>
        a && typeof a.id === 'string'
          && typeof a.assertion === 'string'
          && (a.kind === 'content' || a.kind === 'provenance')
    );
    if (atoms.length === 0) return null;
    return atoms;
}
