// Migration correctness check: do CSV rows survive a trip through the suite
// wikitext format unchanged?
//
// Compares identity, ground-truth and claim-override fields only. `source_text`
// is deliberately excluded — live sources drift, so re-fetching produces
// different bytes for reasons unrelated to this migration, and comparing it
// would fail for the wrong reason while masking real errors.
//
// Per project convention this tool prints its findings for the caller to
// inspect rather than gating on a pass/fail exit code. The one exception it
// inherits: a structurally *invalid* suite still throws via `parseSuite` — a
// duplicate content-hash id (DUPLICATE_ID) or an unrecognized ground truth
// (from `csvRowToWikitext`) aborts the run instead of being folded into the
// report, because those corrupt the input set rather than producing a merely
// debatable result. The `collisions` return field below is therefore vestigial
// on the current parser path (DUPLICATE_ID fires first); it is retained as part
// of the documented report shape and covered directly by the unique-id test.

import fs from 'node:fs';
import { parseSuite, computeRowId, parseArticleUrl } from './suite.js';
import { csvRowsToWikitext, escapeParamValue } from './csv_to_suite.js';
import { canonicalizeVerdict, toTitleCase } from '../core/verdicts.js';

export function loadCsvRows(csvPath) {
    const content = fs.readFileSync(csvPath, 'utf-8');
    // Line-based split: this handles quote-doubling *within* a physical line
    // (see parseCsvLine) but NOT RFC-4180 quoted fields that span newlines.
    // The current dataset has no multi-line fields; revisit if one is added.
    const lines = content.trim().split('\n');
    const headers = parseCsvLine(lines[0]);

    return lines.slice(1).map((line, index) => {
        const values = parseCsvLine(line);
        const row = {};
        headers.forEach((header, i) => { row[header.trim()] = values[i]?.trim() || ''; });
        row._rowIndex = index + 2; // 1-based, accounting for the header
        return row;
    });
}

// Deliberately NOT identical to parseCSVLine in extract_dataset.js:102-112.
// That one toggles inQuotes on every `"` and never un-doubles `""`, so a field
// containing an escaped quote comes back wrong. This version implements RFC 4180
// doubling correctly.
//
// The divergence is safe for parity — both sides of the comparison use THIS
// parser, so it is self-consistent — but it means Phase 6's CSV regeneration
// reads the file with stricter semantics than the pipeline historically did.
// Phase 6 Task 5's diff inspection calls that out.
//
// Duplicated rather than imported because importing extract_dataset.js pulls in
// its whole module graph for four lines of quoting rules.
function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

/**
 * Project a CSV row onto the comparable field set.
 */
function expectedFrom(csvRow) {
    const { article, oldid, wiki } = parseArticleUrl(csvRow['Article']);
    const citation = String(csvRow['Citation number']).trim();
    const instance = String(csvRow['Citation instance'] || '1').trim();
    return {
        id: computeRowId({ wiki, oldid, citation, instance }),
        wiki,
        article,
        oldid,
        citation: Number(citation),
        instance: Number(instance),
        truth: toTitleCase(canonicalizeVerdict(csvRow['Ground truth'])),
        // The generator escapes values on the way out; compare against the same
        // escaping so a legitimately-transformed pipe is not reported as drift.
        claimText: escapeParamValue(csvRow['WMF claim text']) || null,
        sourceUrl: escapeParamValue(csvRow['WMF source URL']) || null,
    };
}

function actualFrom(suiteRow) {
    return {
        id: suiteRow.id,
        wiki: suiteRow.wiki,
        article: suiteRow.article,
        oldid: suiteRow.oldid,
        citation: suiteRow.citation,
        instance: suiteRow.instance,
        truth: suiteRow.truth,
        claimText: suiteRow.claimText,
        sourceUrl: suiteRow.sourceUrl,
    };
}

/**
 * Round-trip every CSV row through suite wikitext and diff the result.
 *
 * @param {object[]} csvRows
 * @param {{mutate?: (row: object, index: number) => object}} [options]
 *        `mutate` rewrites rows before rendering; used by tests to inject a
 *        known mismatch and confirm the harness reports rather than hides it.
 * @returns {{total:number, clean:boolean, mismatches:object[], collisions:object[]}}
 */
export function checkParity(csvRows, { mutate } = {}) {
    const sourceRows = mutate ? csvRows.map(mutate) : csvRows;
    const wikitext = csvRowsToWikitext(sourceRows);
    const { rows: suiteRows } = parseSuite(wikitext);

    const mismatches = [];
    const seenIds = new Map();
    const collisions = [];

    csvRows.forEach((csvRow, i) => {
        const expected = expectedFrom(csvRow);
        const actual = suiteRows[i] ? actualFrom(suiteRows[i]) : null;

        if (actual === null) {
            mismatches.push({ csvLine: csvRow._rowIndex, field: '*', expected, actual: null });
            return;
        }

        for (const field of Object.keys(expected)) {
            if (expected[field] !== actual[field]) {
                mismatches.push({
                    csvLine: csvRow._rowIndex,
                    legacyId: `row_${csvRow._rowIndex}`,
                    field,
                    expected: expected[field],
                    actual: actual[field],
                });
            }
        }

        if (seenIds.has(expected.id)) {
            collisions.push({ id: expected.id, rows: [seenIds.get(expected.id), csvRow._rowIndex] });
        } else {
            seenIds.set(expected.id, csvRow._rowIndex);
        }
    });

    return {
        total: csvRows.length,
        clean: mismatches.length === 0 && collisions.length === 0,
        mismatches,
        collisions,
    };
}
