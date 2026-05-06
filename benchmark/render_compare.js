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

/**
 * Serialize a ComparisonResult to pretty-printed JSON.
 * The `perProvider` Map is converted to a plain object.
 * The `cells` array drops the back-reference to `datasetEntry` to avoid
 * duplicating dataset content into the report.
 *
 * @param {ReturnType<import('./compare_results.js').compareResults>} result
 * @param {{indent?: number}} [options]
 */
export function renderJson(result, options = {}) {
    const indent = options.indent ?? 2;
    const serializable = {
        metadata: result.metadata,
        coverage: result.coverage,
        perProvider: Object.fromEntries(result.perProvider),
        cells: result.cells.map(({ datasetEntry, ...rest }) => rest),
        flips: result.flips.map(({ datasetEntry, ...rest }) => rest),
    };
    return JSON.stringify(serializable, null, indent);
}

function fmtPct(n) {
    return `${n.toFixed(1)}%`;
}
function fmtDelta(n) {
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(1)}`;
}

/**
 * Render a ComparisonResult as a Markdown report.
 * Sections: header (metadata + coverage), headline accuracy table, flip table.
 *
 * @param {ReturnType<import('./compare_results.js').compareResults>} result
 * @param {{noiseFloor?: number}} [options]
 */
export function renderMarkdown(result, options = {}) {
    const noiseFloor = options.noiseFloor ?? 5;
    const lines = [];
    lines.push(`# Compare Results — ${result.metadata.generatedAt}`);
    lines.push('');
    if (result.metadata.changeAxes && result.metadata.changeAxes.length > 0) {
        const axes = result.metadata.changeAxes.map(a => `\`${a}\``).join(', ');
        lines.push(`Change axes: ${axes}`);
    }
    if (result.metadata.groundTruthVersion) {
        lines.push(`Ground truth version: \`${result.metadata.groundTruthVersion}\``);
    }
    if (result.metadata.controlRunAt) {
        lines.push(`Control run at: ${result.metadata.controlRunAt}`);
    }
    if (result.metadata.treatmentRunAt) {
        lines.push(`Treatment run at: ${result.metadata.treatmentRunAt}`);
    }
    lines.push('');
    lines.push(`Compared cells: **${result.coverage.comparedCells}** of ${result.coverage.intersectionCells} intersection (${result.coverage.controlOnlyCells} control-only, ${result.coverage.treatmentOnlyCells} treatment-only excluded). Dataset: ${result.coverage.datasetValid} valid of ${result.coverage.datasetTotal}.`);
    lines.push(`Noise floor: ±${noiseFloor}pp (single-provider 95% CI heuristic).`);
    lines.push('');

    lines.push('## Headline accuracy');
    lines.push('');
    lines.push('| Provider | n | Control exact | Treatment exact | Δ exact | Control lenient | Treatment lenient | Δ lenient | Control binary | Treatment binary | Δ binary |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const [provider, stats] of result.perProvider) {
        const flag = (Math.abs(stats.exact.delta) < noiseFloor
                   && Math.abs(stats.lenient.delta) < noiseFloor
                   && Math.abs(stats.binary.delta) < noiseFloor)
            ? ' (noise)'
            : '';
        lines.push(
            `| ${provider}${flag} | ${stats.n} | ${fmtPct(stats.exact.controlPct)} | ${fmtPct(stats.exact.treatmentPct)} | ${fmtDelta(stats.exact.delta)} | ${fmtPct(stats.lenient.controlPct)} | ${fmtPct(stats.lenient.treatmentPct)} | ${fmtDelta(stats.lenient.delta)} | ${fmtPct(stats.binary.controlPct)} | ${fmtPct(stats.binary.treatmentPct)} | ${fmtDelta(stats.binary.delta)} |`
        );
    }
    lines.push('');

    lines.push('## Flips');
    lines.push('');
    if (result.flips.length === 0) {
        lines.push('_No flips — every cell either stayed correct or stayed wrong with the same verdict._');
    } else {
        lines.push('| Provider | Entry ID | Direction | Control | Treatment | Ground truth | Claim |');
        lines.push('|---|---|---|---|---|---|---|');
        for (const flip of result.flips) {
            const claim = flip.claimText.length > 60 ? flip.claimText.slice(0, 60) + '…' : flip.claimText;
            lines.push(
                `| ${flip.provider} | ${flip.entryId} | ${flip.direction} | ${flip.controlVerdict} | ${flip.treatmentVerdict} | ${flip.groundTruth} | ${claim.replace(/\|/g, '\\|')} |`
            );
        }
    }
    lines.push('');

    return lines.join('\n');
}
