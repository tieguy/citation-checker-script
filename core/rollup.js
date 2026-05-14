// Stage 3 of the atomized verification pipeline. Composes per-atom
// verdicts into a single claim-level verdict.
//
// RollupResult = { verdict: 'SUPPORTED' | 'PARTIALLY SUPPORTED' | 'NOT SUPPORTED',
//                  comments: string, judgeReasoning?: string }
//
// Implementation lands in Phase 4.

/**
 * @param {Array} atoms
 * @param {Array} atomResults — from verifyAtoms()
 * @param {'deterministic' | 'judge'} mode
 * @param {object} [providerConfig] — required when mode === 'judge'
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.transport]
 * @returns {Promise<{verdict: string, comments: string, judgeReasoning?: string}>}
 */
export async function rollup(atoms, atomResults, mode, providerConfig, opts = {}) {
    throw new Error('not implemented: filled in Phase 4');
}
