// Render CSV rows as suite-page wikitext.
//
// Used twice: by the Phase 4 parity harness (generate, parse back, diff), and by
// the Phase 5 migration (generate the bytes a human pastes on-wiki). Those being
// the same code path is deliberate — the migration publishes exactly what parity
// validated.

import { computeRowId, parseArticleUrl, SUITE_TEMPLATE_TITLE } from './suite.js';
import { escapeParamValue } from '../core/submission.js';
import { canonicalizeVerdict, toTitleCase } from '../core/verdicts.js';

export { escapeParamValue };

const PARAM_ORDER = [
    'id', 'wiki', 'article', 'oldid', 'citation', 'instance',
    'truth', 'rationale', 'added-by', 'confirmed-by',
    'claim-text', 'source-url', 'provenance',
];

export function csvRowToWikitext(csvRow) {
    const { article, oldid, wiki } = parseArticleUrl(csvRow['Article']);
    const citation = String(csvRow['Citation number']).trim();
    const instance = String(csvRow['Citation instance'] || '1').trim();

    const canonical = canonicalizeVerdict(csvRow['Ground truth']);
    if (canonical === null) {
        throw new Error(
            `row citation=${citation} instance=${instance}: unrecognized ground truth `
            + `"${csvRow['Ground truth']}"`);
    }

    const values = {
        id: computeRowId({ wiki, oldid, citation, instance }),
        wiki,
        article,
        oldid: String(oldid),
        citation,
        instance,
        truth: toTitleCase(canonical),
        'claim-text': csvRow['WMF claim text'],
        'source-url': csvRow['WMF source URL'],
        provenance: csvRow['WMF provenance'],
    };

    const lines = PARAM_ORDER
        .map(name => [name, escapeParamValue(values[name])])
        // Omit blanks entirely: an empty value is indistinguishable from an
        // absent one to the parser, and the validator rejects it.
        .filter(([, value]) => value !== '')
        .map(([name, value]) => `| ${name.padEnd(11)} = ${value}`);

    return `{{${SUITE_TEMPLATE_TITLE}\n${lines.join('\n')}\n}}`;
}

export function csvRowsToWikitext(csvRows) {
    return csvRows.map(csvRowToWikitext).join('\n');
}
