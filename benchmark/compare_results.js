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

/**
 * Classify a single (control, treatment, ground_truth) cell into one of:
 *   'improvement'         — control wrong, treatment correct
 *   'regression'          — control correct, treatment wrong
 *   'unchanged-correct'   — both correct
 *   'unchanged-wrong-same'— both wrong with the same (normalized) verdict
 *   'lateral'             — both wrong with different verdicts
 *
 * @param {{ controlVerdict: string, treatmentVerdict: string, groundTruth: string }} cell
 * @returns {'improvement'|'regression'|'unchanged-correct'|'unchanged-wrong-same'|'lateral'}
 */
export function classifyDirection({ controlVerdict, treatmentVerdict, groundTruth }) {
    const cCorrect = verdictsEqualExact(controlVerdict, groundTruth);
    const tCorrect = verdictsEqualExact(treatmentVerdict, groundTruth);
    if (!cCorrect && tCorrect) return 'improvement';
    if (cCorrect && !tCorrect) return 'regression';
    if (cCorrect && tCorrect) return 'unchanged-correct';
    if (normalizeVerdict(controlVerdict) === normalizeVerdict(treatmentVerdict)) {
        return 'unchanged-wrong-same';
    }
    return 'lateral';
}

function pct(num, denom) {
    return denom > 0 ? (num / denom) * 100 : 0;
}

/**
 * Aggregate stats for a list of cells belonging to one provider.
 * Returns exact + lenient + binary accuracy for control and treatment, deltas,
 * and flip counts. Lenient treats Partially supported ↔ Supported as a near-miss.
 *
 * @param {Array<{direction: string, controlVerdict: string, treatmentVerdict: string, groundTruth: string}>} cells
 */
export function computeProviderStats(cells) {
    const n = cells.length;
    let cExact = 0, tExact = 0, cLenient = 0, tLenient = 0, cBinary = 0, tBinary = 0;
    const flips = {
        improvement: 0,
        regression: 0,
        lateral: 0,
        'unchanged-correct': 0,
        'unchanged-wrong-same': 0,
    };
    for (const cell of cells) {
        if (verdictsEqualExact(cell.controlVerdict, cell.groundTruth)) cExact++;
        if (verdictsEqualExact(cell.treatmentVerdict, cell.groundTruth)) tExact++;
        if (verdictsEqualLenient(cell.controlVerdict, cell.groundTruth)) cLenient++;
        if (verdictsEqualLenient(cell.treatmentVerdict, cell.groundTruth)) tLenient++;
        if (verdictsEqualBinary(cell.controlVerdict, cell.groundTruth)) cBinary++;
        if (verdictsEqualBinary(cell.treatmentVerdict, cell.groundTruth)) tBinary++;
        flips[cell.direction]++;
    }
    return {
        n,
        exact: {
            control: cExact,
            treatment: tExact,
            controlPct: pct(cExact, n),
            treatmentPct: pct(tExact, n),
            delta: pct(tExact, n) - pct(cExact, n),
        },
        lenient: {
            control: cLenient,
            treatment: tLenient,
            controlPct: pct(cLenient, n),
            treatmentPct: pct(tLenient, n),
            delta: pct(tLenient, n) - pct(cLenient, n),
        },
        binary: {
            control: cBinary,
            treatment: tBinary,
            controlPct: pct(cBinary, n),
            treatmentPct: pct(tBinary, n),
            delta: pct(tBinary, n) - pct(cBinary, n),
        },
        flips,
    };
}
