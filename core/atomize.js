// Stage 1 of the atomized verification pipeline. Splits a compound claim
// into discrete verifiable assertions ("atoms"), each tagged as either
// content (verified against the source body) or provenance (verified
// against citoid metadata).
//
// Atom = { id: string, assertion: string, kind: 'content' | 'provenance' }
//
// Implementation lands in Phase 3.

/**
 * @param {string} claim
 * @param {object} providerConfig — a PROVIDERS[name] entry from core/providers.js
 * @param {object} [opts]
 * @param {string} [opts.claimContainer] — surrounding sentence/paragraph context.
 *   20% of dataset rows are fragmentary (sentence fragments from mid-sentence
 *   citations); when present, the atomizer prompt uses claimContainer as
 *   context-only so reading-comprehension benefits from the surrounding
 *   sentence without expanding the atom set to container-only assertions.
 * @param {boolean} [opts.useSmallModel] — opt into providerConfig.smallModel
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.transport] — test-injection hook; defaults to callProviderAPI
 * @returns {Promise<Array<{id: string, assertion: string, kind: 'content'|'provenance'}>>}
 */
export async function atomize(claim, providerConfig, opts = {}) {
    throw new Error('not implemented: filled in Phase 3');
}
