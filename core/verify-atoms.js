// Stage 2 of the atomized verification pipeline. Verifies each atom
// independently against the right slice of input — content atoms against
// the source body, provenance atoms against the citoid metadata block.
//
// AtomResult = { atomId: string, verdict: 'supported' | 'not_supported',
//                evidence?: string, error?: string }
//
// Implementation lands in Phase 3.

/**
 * @param {Array} atoms — from atomize()
 * @param {string} sourceText — Defuddle-extracted body (with citoid header)
 * @param {object|null} metadata — citoid metadata, when available
 * @param {object} providerConfig — a PROVIDERS[name] entry
 * @param {object} [opts]
 * @param {number} [opts.concurrency] — defaults unbounded
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.transport]
 * @returns {Promise<Array<{atomId: string, verdict: string, evidence?: string, error?: string}>>}
 */
export async function verifyAtoms(atoms, sourceText, metadata, providerConfig, opts = {}) {
    throw new Error('not implemented: filled in Phase 3');
}
