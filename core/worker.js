// Calls to the Cloudflare Worker proxy: source fetching and verification logging.

import { isGoogleBooksUrl } from './urls.js';
import { augmentWithCitoid } from './citoid.js';
import { classifyBody } from './body-classifier.js';
import { callProviderAPI } from './providers.js';
import {
    generateLegacySystemPrompt,
    generateLegacyUserPrompt,
} from './prompts.js';
import { parseVerificationResult } from './parsing.js';
import { atomize } from './atomize.js';
import { verifyAtoms } from './verify-atoms.js';
import { rollup } from './rollup.js';

// fetchSourceContent return shapes:
//   string                                  — usable body, formatted as
//                                             "Source URL: <u>\n\nSource Content:\n<body>"
//                                             with a Citoid metadata header prepended to
//                                             <body> when augment !== false (default true).
//   null                                    — fetch failed (network/proxy/Google Books skip)
//   { sourceUnavailable, reason }           — body is structurally bad (Wayback chrome,
//                                             CSS leak, JSON-LD blob, anti-bot challenge,
//                                             etc.). Callers should record a deterministic
//                                             "Source unavailable" verdict without invoking
//                                             the LLM. See core/body-classifier.js.
//                                             Classification runs BEFORE Citoid augmentation
//                                             so the classifier judges raw body text, not
//                                             the metadata-prepended composite.
export async function fetchSourceContent(url, pageNum, { workerBase = 'https://publicai-proxy.alaexis.workers.dev', augment = true } = {}) {
    if (isGoogleBooksUrl(url)) {
        console.log('[CitationVerifier] Skipping Google Books URL:', url);
        return null;
    }

    try {
        let proxyUrl = `${workerBase}/?fetch=${encodeURIComponent(url)}`;
        if (pageNum) {
            proxyUrl += `&page=${pageNum}`;
        }
        const response = await fetch(proxyUrl);
        const data = await response.json();

        if (data.error) {
            console.warn('[CitationVerifier] Proxy error:', data.error);
            return null;
        }

        if (data.content && data.content.length > 100) {
            const classification = classifyBody(data.content);
            if (!classification.usable) {
                return { sourceUnavailable: true, reason: classification.reason };
            }
            // Proxy caps fetched content around 12k chars. If we're at or
            // above that, the source was almost certainly truncated and
            // only partially sent to the model.
            const isTruncated = data.truncated === true || data.content.length >= 12000;
            let meta = `Source URL: ${url}`;
            if (data.pdf) {
                meta += `\nPDF: ${data.totalPages} pages`;
                if (data.page) {
                    meta += ` (extracted page ${data.page})`;
                }
            }
            if (isTruncated) {
                meta += `\nTruncated: true`;
            }
            const body = augment ? await augmentWithCitoid(data.content, url) : data.content;
            return `${meta}\n\nSource Content:\n${body}`;
        }

        // If PDF was large and we didn't request a specific page, retry
        // with the citation page if available
        if (data.pdf && !pageNum && data.totalPages > 15) {
            console.log('[CitationVerifier] Large PDF without page param, content may be truncated');
        }
    } catch (error) {
        console.error('Proxy fetch failed:', error);
    }
    return null; // Falls back to manual input
}

export function logVerification(payload, { workerBase = 'https://publicai-proxy.alaexis.workers.dev' } = {}) {
    // Wrap the fetch POST in try/catch exactly as main.js does.
    // `payload` replaces the constructed object in main.js — caller supplies
    //   { article_url, article_title, citation_number, source_url, provider, verdict, confidence }.
    try {
        fetch(`${workerBase}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).catch(() => {});
    } catch (e) {
        // logging should never break the main flow
    }
}

// === Verification orchestration ===
//
// Two paths into one return shape:
//   verifyClaim()          — single-pass (legacy). One LLM call.
//   verifyClaimAtomized()  — atomize → verifyAtoms → rollup. 2+N LLM calls.
//
// Both return { verdict, comments, confidence?, atoms?, atomResults?, ... }
// so callers don't have to branch on shape. `verify()` is the dispatcher.

/**
 * Single-pass verification (legacy single-call path).
 *
 * @param {string} claim
 * @param {string} sourceText
 * @param {object} providerConfig — PROVIDERS[name] entry
 * @param {object} [opts]
 * @param {string} [opts.systemPromptOverride] — use this system prompt instead of core/prompts.js
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{verdict, comments, confidence}>}
 */
export async function verifyClaim(claim, sourceText, providerConfig, opts = {}) {
    const systemPrompt = opts.systemPromptOverride ?? generateLegacySystemPrompt();
    const userPrompt = generateLegacyUserPrompt(claim, sourceText);
    const apiResult = await callProviderAPI(providerConfig.type, {
        ...providerConfig,
        systemPrompt,
        userContent: userPrompt,
        signal: opts.signal,
    });
    const parsed = parseVerificationResult(apiResult.text);
    return {
        verdict: parsed.verdict,
        comments: parsed.comments ?? '',
        confidence: parsed.confidence,
    };
}

/**
 * Atomized verification.
 *
 * @param {string} claim
 * @param {string} sourceText
 * @param {object|null} metadata — citoid metadata, when available
 * @param {object} providerConfig
 * @param {object} [opts]
 * @param {string} [opts.claimContainer] — surrounding sentence/paragraph for
 *   fragmentary claim_text (from dataset.row.claim_container). Threaded to
 *   atomize() as context-only.
 * @param {boolean} [opts.useSmallAtomizer] — opt into providerConfig.smallModel for atomize()
 * @param {'deterministic'|'judge'} [opts.rollupMode] — defaults 'deterministic'
 * @param {Array<{id, assertion, kind}>} [opts.atoms] — when provided, skip the
 *   atomize() LLM call and verify against these atoms directly. Used by the
 *   benchmark --atoms-cache flag to share a single decomposition across many
 *   verifier providers (eliminates atomizer noise as a cross-provider confound).
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{verdict, comments, atoms, atomResults, rollupMode, judgeReasoning?}>}
 */
export async function verifyClaimAtomized(claim, sourceText, metadata, providerConfig, opts = {}) {
    const rollupMode = opts.rollupMode ?? 'deterministic';

    const atoms = opts.atoms ?? await atomize(claim, providerConfig, {
        claimContainer: opts.claimContainer,
        useSmallModel: opts.useSmallAtomizer,
        signal: opts.signal,
    });

    const atomResults = await verifyAtoms(atoms, sourceText, metadata, providerConfig, {
        signal: opts.signal,
    });

    const rolled = await rollup(atoms, atomResults, rollupMode, providerConfig, {
        signal: opts.signal,
        claim,
    });

    return {
        verdict: rolled.verdict,
        comments: rolled.comments,
        atoms,
        atomResults,
        rollupMode,
        ...(rolled.judgeReasoning ? { judgeReasoning: rolled.judgeReasoning } : {}),
    };
}

/**
 * Top-level dispatcher. Selects atomized vs legacy.
 *
 * @param {string} claim
 * @param {string} sourceText
 * @param {object|null} metadata
 * @param {object} providerConfig
 * @param {object} [opts]
 * @param {boolean} [opts.atomized] — defaults true when providerConfig.supportsAtomize
 * @param {'deterministic'|'judge'} [opts.rollupMode]
 * @param {boolean} [opts.useSmallAtomizer]
 * @param {string} [opts.claimContainer] — surrounding sentence/paragraph context;
 *   passed to verifyClaimAtomized() and ignored by verifyClaim().
 * @param {string} [opts.systemPromptOverride] — use this system prompt instead of core/prompts.js;
 *   only applies to the legacy verifyClaim() path.
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{verdict, comments, confidence, atoms?, atomResults?, rollupMode?}>}
 *   Note: confidence is populated only by the legacy verifyClaim() path.
 */
export async function verify(claim, sourceText, metadata, providerConfig, opts = {}) {
    const wantAtomized = opts.atomized !== undefined
        ? opts.atomized
        : providerConfig.supportsAtomize !== false;
    if (wantAtomized) {
        return await verifyClaimAtomized(claim, sourceText, metadata, providerConfig, opts);
    }
    return await verifyClaim(claim, sourceText, providerConfig, opts);
}
