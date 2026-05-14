/**
 * Voting helpers for benchmark voting-panel ensembles.
 *
 * computeNClassVote — 4-class plurality vote with skeptical-rank tiebreaker
 * applied only to the verdicts tied at the maximum vote count. Skeptical rank:
 * Partially supported > Not supported > Source unavailable > Supported,
 * mirroring the wikidata-SIFT tie-toward-reject default.
 *
 * computeBinaryVoteN — strict majority for support; ties or sub-majority
 * default to "Not supported". Treats Supported and Partially supported as
 * the support class, Not supported and Source unavailable as not-support.
 */

// Verdict normalization: callers come from two pipelines that emit different
// casings — legacy single-call (verifyClaim) emits title case
// ('Supported', 'Partially supported', 'Not supported'), while the atomized
// rollup (core/rollup.js) emits upper case ('SUPPORTED', 'PARTIALLY SUPPORTED',
// 'NOT SUPPORTED'). Canonicalize to title case at the boundary so every
// downstream check is consistent.
const TITLE_CASE_BY_LOWER = {
    'supported': 'Supported',
    'partially supported': 'Partially supported',
    'not supported': 'Not supported',
    'source unavailable': 'Source unavailable',
};

function normalizeVerdict(v) {
    if (typeof v !== 'string') return v;
    return TITLE_CASE_BY_LOWER[v.toLowerCase()] || v;
}

const TIEBREAKER_RANK = {
    'Partially supported': 4,
    'Not supported': 3,
    'Source unavailable': 2,
    'Supported': 1
};

export function isSupportClass(verdict) {
    const v = normalizeVerdict(verdict);
    return v === 'Supported' || v === 'Partially supported';
}

export function computeNClassVote(verdicts) {
    const normalized = verdicts.map(normalizeVerdict);
    const counts = {};
    for (const v of normalized) counts[v] = (counts[v] || 0) + 1;
    const maxCount = Math.max(...Object.values(counts));
    const tied = Object.keys(counts).filter(v => counts[v] === maxCount);
    if (tied.length === 1) return tied[0];
    let best = tied[0];
    for (const v of tied) {
        if ((TIEBREAKER_RANK[v] || 0) > (TIEBREAKER_RANK[best] || 0)) best = v;
    }
    return best;
}

export function computeBinaryVoteN(verdicts) {
    const supportCount = verdicts.filter(isSupportClass).length;
    return supportCount > verdicts.length / 2 ? 'Supported' : 'Not supported';
}
