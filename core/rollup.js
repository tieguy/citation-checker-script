// Stage 3 of the atomized verification pipeline. Composes per-atom
// verdicts into a single claim-level verdict.
//
// RollupResult = { verdict: 'SUPPORTED' | 'PARTIALLY SUPPORTED' | 'NOT SUPPORTED',
//                  comments: string, judgeReasoning?: string }
//
// Two modes:
//   'deterministic' — fixed rule, no LLM call. All-supported → SUPPORTED;
//                     all-not_supported → NOT SUPPORTED; mix → PARTIALLY
//                     SUPPORTED. comments reproduces the per-atom rationale.
//   'judge'         — one additional LLM call. Higher fidelity on edge
//                     cases. judgeReasoning is the model's explanation.

import { callProviderAPI } from './providers.js';
import {
    generateJudgeRollupSystemPrompt,
    generateJudgeRollupUserPrompt,
} from './prompts.js';

const DEFAULT_MAX_TOKENS = 512;

async function defaultTransport(providerConfig, { systemPrompt, userPrompt, signal }) {
    const callConfig = {
        ...providerConfig,
        systemPrompt,
        userContent: userPrompt,
        maxTokens: providerConfig.maxTokens ?? DEFAULT_MAX_TOKENS,
        signal,
    };
    return await callProviderAPI(providerConfig.type, callConfig);
}

export function deterministicVerdict(atomResults) {
    if (atomResults.length === 0) {
        // No atoms means nothing to verify. Defensive default; in practice
        // atomize() always returns at least the single-atom fallback.
        return 'NOT SUPPORTED';
    }
    const supported = atomResults.filter(r => r.verdict === 'supported').length;
    const notSupported = atomResults.filter(r => r.verdict === 'not_supported').length;
    if (supported === atomResults.length) return 'SUPPORTED';
    if (notSupported === atomResults.length) return 'NOT SUPPORTED';
    return 'PARTIALLY SUPPORTED';
}

export function summarizeAtomResults(atoms, atomResults) {
    // Produce a single comments string from the atom-by-atom rationale.
    // Pairs atoms with results by atomId; falls back to result order if
    // atoms array doesn't align.
    const byId = new Map(atoms.map(a => [a.id, a]));
    return atomResults.map((r, i) => {
        const a = byId.get(r.atomId) ?? atoms[i];
        const assertion = a?.assertion ?? `atom ${r.atomId}`;
        const status = r.verdict === 'supported' ? 'supported' : 'not_supported';
        const detail = r.evidence ?? r.error ?? '';
        return `${r.atomId} (${status}): "${assertion}"${detail ? ' — ' + detail : ''}`;
    }).join('; ');
}

export function parseJudgeResponse(text) {
    if (!text || typeof text !== 'string') return null;
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
    const VALID = new Set(['SUPPORTED', 'PARTIALLY SUPPORTED', 'NOT SUPPORTED']);
    if (!VALID.has(parsed?.verdict)) return null;
    return {
        verdict: parsed.verdict,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
}

/**
 * Roll up atom-level verdicts into a single claim-level verdict.
 *
 * @param {Array} atoms
 * @param {Array} atomResults
 * @param {'deterministic' | 'judge'} mode
 * @param {object} [providerConfig] — required when mode === 'judge'
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.transport]
 * @param {string} [opts.claim] — required for judge mode (the original claim)
 * @returns {Promise<{verdict, comments, judgeReasoning?}>}
 */
export async function rollup(atoms, atomResults, mode, providerConfig, opts = {}) {
    if (mode === 'deterministic') {
        return {
            verdict: deterministicVerdict(atomResults),
            comments: summarizeAtomResults(atoms, atomResults),
        };
    }
    if (mode === 'judge') {
        if (!providerConfig) throw new Error('judge mode requires providerConfig');
        if (!opts.claim) throw new Error('judge mode requires opts.claim');
        const transport = opts.transport ?? defaultTransport;
        const systemPrompt = generateJudgeRollupSystemPrompt();
        const userPrompt = generateJudgeRollupUserPrompt(opts.claim, atomResults);
        let response;
        try {
            response = await transport(providerConfig, {
                systemPrompt,
                userPrompt,
                signal: opts.signal,
            });
        } catch (e) {
            // On transport failure, fall back to deterministic — at least
            // we have *something* to return.
            return {
                verdict: deterministicVerdict(atomResults),
                comments: summarizeAtomResults(atoms, atomResults),
                judgeReasoning: 'judge call failed: ' + (e?.message ?? String(e)) + '; fell back to deterministic',
            };
        }
        const parsed = parseJudgeResponse(response?.text ?? '');
        if (parsed === null) {
            // Judge returned garbage — fall back to deterministic.
            return {
                verdict: deterministicVerdict(atomResults),
                comments: summarizeAtomResults(atoms, atomResults),
                judgeReasoning: 'judge response unparseable; fell back to deterministic',
            };
        }
        return {
            verdict: parsed.verdict,
            comments: summarizeAtomResults(atoms, atomResults),
            judgeReasoning: parsed.reasoning,
        };
    }
    throw new Error(`unknown rollup mode: ${mode}`);
}
