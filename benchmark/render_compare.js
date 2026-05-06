/**
 * Escape HTML-significant characters: & < > " '
 * Returns empty string for null/undefined.
 */
export function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Background color for an accuracy delta given a noise floor (in pp).
 * Green if delta >= +floor, red if delta <= -floor, grey otherwise.
 */
export function deltaColor(delta, noiseFloor = 5) {
    if (delta >= noiseFloor) return '#e6ffe6';
    if (delta <= -noiseFloor) return '#ffe6e6';
    return '#f0f0f0';
}

/**
 * Background color for a flip direction.
 */
export function directionColor(direction) {
    switch (direction) {
        case 'improvement': return '#e6ffe6';
        case 'regression':  return '#ffe6e6';
        case 'lateral':     return '#fff5cc';
        default:            return '#ffffff';
    }
}
