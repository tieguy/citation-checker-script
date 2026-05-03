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

const TIEBREAKER_RANK = {
    'Partially supported': 4,
    'Not supported': 3,
    'Source unavailable': 2,
    'Supported': 1
};

export function isSupportClass(verdict) {
    return verdict === 'Supported' || verdict === 'Partially supported';
}

export function computeNClassVote(verdicts) {
    const counts = {};
    for (const v of verdicts) counts[v] = (counts[v] || 0) + 1;
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
