// Parses raw LLM response text into a structured verdict object.
//
// Happy path: JSON, optionally inside a ```json code fence or surrounded by
// prose. Falls back to a markdown-emphasis recovery regex for small
// open-weight models (e.g. Granite 4.1 8B) that occasionally emit
// "**Verdict:** SUPPORTED" prose instead of the requested JSON. On total
// failure, returns the 'PARSE_ERROR' sentinel — chosen to match what the
// benchmark already records for unrecoverable responses.

import { canonicalizeVerdict } from './verdicts.js';

// Normalises the model-supplied `quote` — the verbatim span it claims to have
// copied out of the source body — into either a non-empty string or null.
// Anything non-string (some small open-weight models emit a list of spans) and
// anything blank becomes null: a blank quote would re-locate everywhere, which
// is worse than admitting there is no quote.
function normalizeQuote(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

export function parseVerificationResult(response) {
    const trimmed = response.trim();

    try {
        let jsonStr = trimmed;
        const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
        } else {
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) jsonStr = jsonMatch[0];
        }
        const result = JSON.parse(jsonStr);
        return {
            verdict: result.verdict || 'UNKNOWN',
            confidence: result.confidence ?? null,
            quote: normalizeQuote(result.quote),
            comments: result.comments || '',
            reason_type: result.reason_type || null
        };
    } catch (e) {
        // fall through to the markdown-emphasis recovery
    }

    // Strip "**" and "__"-style emphasis so e.g. "**Verdict:** SUPPORTED"
    // becomes "Verdict: SUPPORTED", then capture the canonical word(s).
    const stripped = trimmed.replace(/\*+|__+/g, '');
    const match = stripped.match(/verdict[\s:"']+([A-Z][A-Z _]*)/i);
    if (match) {
        const verdict = canonicalizeVerdict(match[1]);
        if (verdict) {
            return { verdict, confidence: null, quote: null, comments: '<extracted from non-JSON response>' };
        }
    }

    return {
        verdict: 'PARSE_ERROR',
        confidence: null,
        quote: null,
        comments: `Failed to parse AI response: ${response.substring(0, 200)}`
    };
}
