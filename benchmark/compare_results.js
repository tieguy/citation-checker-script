/**
 * Normalize a verdict string to its canonical short form.
 * Returns one of: 'support' | 'partial' | 'not' | 'unavailable' | <other-lowercased>.
 * Handles null/undefined and case/whitespace variations.
 */
export function normalizeVerdict(v) {
    const s = String(v ?? '').toLowerCase().trim();
    if (s.includes('partial')) return 'partial';
    if (s.includes('not support') || s.includes('not-support') || s.includes('not_support')) return 'not';
    if (s.includes('support')) return 'support';
    if (s.includes('unavailable')) return 'unavailable';
    return s;
}

export function verdictsEqualExact(a, b) {
    return normalizeVerdict(a) === normalizeVerdict(b);
}

function isSupportClass(v) {
    const n = normalizeVerdict(v);
    return n === 'support' || n === 'partial';
}

export function verdictsEqualBinary(a, b) {
    return isSupportClass(a) === isSupportClass(b);
}

/**
 * Lenient match: exact, plus Supported ↔ Partially supported as mutual near-misses.
 * Useful when the GT distinction between Supported and Partially supported is itself
 * fuzzy and a control→treatment shift between them shouldn't count as an error.
 */
export function verdictsEqualLenient(a, b) {
    const na = normalizeVerdict(a);
    const nb = normalizeVerdict(b);
    if (na === nb) return true;
    if ((na === 'support' && nb === 'partial') || (na === 'partial' && nb === 'support')) return true;
    return false;
}

/**
 * Index result rows by `${entry_id}:${provider}` key.
 * Drops rows where `error` is truthy or `predicted_verdict === 'ERROR'`
 * (treating either signal as "no successful prediction").
 *
 * @param {Array<Object>} rows
 * @returns {Map<string, Object>}
 */
export function indexCellsByPair(rows) {
    const out = new Map();
    for (const row of rows) {
        if (row.error) continue;
        if (row.predicted_verdict === 'ERROR') continue;
        const key = `${row.entry_id}:${row.provider}`;
        out.set(key, row);
    }
    return out;
}
