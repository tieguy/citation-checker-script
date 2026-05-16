// Dataset-submission helpers. Pure logic for building a prefilled Google Form
// URL so Wikipedia editors can contribute citation/ground-truth examples
// without an API or auth. Inlined into main.js between <core-injected>
// markers, and importable from tests.
//
// To activate the feature once a Form exists:
//   1. Create a Google Form whose questions correspond to the keys in
//      DATASET_SUBMISSION_ENTRY_IDS (articleUrl, citationNumber, claimText,
//      sourceUrl, llmVerdict, llmRationale, llmProvider, llmModel,
//      editorHandle, notes).
//   2. Use the Form's "Get pre-filled link" tool, fill every field with a
//      unique sentinel, and copy the resulting URL.
//   3. Replace DATASET_SUBMISSION_FORM_URL with the /viewform URL, and
//      replace each `entry.PLACEHOLDER_*` value with the matching
//      `entry.<numeric-id>` from the pre-filled link.
//   4. Run `npm run build` so the constants are re-inlined into main.js.

// Sentinel substring that marks scaffolded values as not-yet-configured.
// isDatasetSubmissionConfigured() looks for this exact token; don't reuse it
// anywhere else in this file.
export const DATASET_SUBMISSION_PLACEHOLDER = 'PLACEHOLDER';

export const DATASET_SUBMISSION_FORM_URL =
    'https://docs.google.com/forms/d/e/PLACEHOLDER_FORM_ID/viewform';

export const DATASET_SUBMISSION_ENTRY_IDS = {
    articleUrl:     'entry.PLACEHOLDER_1',
    citationNumber: 'entry.PLACEHOLDER_2',
    claimText:      'entry.PLACEHOLDER_3',
    sourceUrl:      'entry.PLACEHOLDER_4',
    llmVerdict:     'entry.PLACEHOLDER_5',
    llmRationale:   'entry.PLACEHOLDER_6',
    llmProvider:    'entry.PLACEHOLDER_7',
    llmModel:       'entry.PLACEHOLDER_8',
    // Populated only for SOURCE UNAVAILABLE rows where the proxy reported an
    // HTTP status — lets the dataset distinguish "we never fetched" from
    // "we fetched and the source returned 4xx/5xx".
    fetchStatus:    'entry.PLACEHOLDER_11',
    editorHandle:   'entry.PLACEHOLDER_9',
    notes:          'entry.PLACEHOLDER_10',
};

export function isDatasetSubmissionConfigured(
    formUrl = DATASET_SUBMISSION_FORM_URL,
    entryIds = DATASET_SUBMISSION_ENTRY_IDS,
) {
    if (!formUrl || formUrl.includes(DATASET_SUBMISSION_PLACEHOLDER)) return false;
    return Object.values(entryIds).every(
        id => typeof id === 'string' && id && !id.includes(DATASET_SUBMISSION_PLACEHOLDER)
    );
}

export function buildDatasetSubmissionUrl(
    fields,
    formUrl = DATASET_SUBMISSION_FORM_URL,
    entryIds = DATASET_SUBMISSION_ENTRY_IDS,
) {
    const params = new URLSearchParams();
    params.set('usp', 'pp_url');
    for (const key of Object.keys(entryIds)) {
        const value = fields == null ? undefined : fields[key];
        if (value === undefined || value === null || value === '') continue;
        params.set(entryIds[key], String(value));
    }
    return `${formUrl}?${params.toString()}`;
}
