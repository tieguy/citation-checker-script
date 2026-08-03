// Parse and validate the on-wiki benchmark suite page.
//
// Pure functions over wikitext strings: no network, no filesystem. The fetch and
// snapshot layer lives in suite_fetch.js; this module only ever sees text.
//
// WHY TWO PARSERS: wtf_wikipedia's failure mode for a malformed row is that the
// row silently disappears from its output — no error, no warning. A vanished row
// changes the denominator of every accuracy metric computed downstream. So the
// raw text is scanned independently (extractRowBlocks + splitTopLevelParams) and
// the two readings are reconciled; a count mismatch is a hard failure. The raw
// scan also recovers the three things wtf_wikipedia destroys before we could
// inspect them: duplicate params (last silently wins), empty values
// (indistinguishable from absent), and stray pipes (truncate the value and
// invent a spurious `list` param).
//
// Measured against wtf_wikipedia 10.4.2; see tests/suite.test.js for the full
// behavior matrix and docs/implementation-plans/2026-07-23-wiki-hosted-benchmark-suite/README.md
// for the measurements.

import { createHash } from 'node:crypto';
import { canonicalizeVerdict, toTitleCase } from '../core/verdicts.js';

// Import wtf_wikipedia once, then re-export the same binding. Tests import `wtf`
// from this module rather than resolving the package themselves, so the fixtures
// that pin wtf_wikipedia's quirks exercise the exact instance parseSuite() uses.
// Any future version drift from the floating ^10.4.2 range hits both equally.
import wtf from 'wtf_wikipedia';
export { wtf };

export const SUITE_TEMPLATE_TITLE = 'User:Alaexis/AI Source Verification/Benchmark/Row';

// wtf_wikipedia lowercases template names but PRESERVES spaces (it does not
// convert them to underscores). This is the form .json().template returns.
export const SUITE_TEMPLATE_KEY = SUITE_TEMPLATE_TITLE.toLowerCase();

// Matches a row transclusion's opening. The lookahead for `|` or `}` prevents
// matching `{{.../Row/doc}}`. Case-insensitive and underscore-tolerant because
// MediaWiki treats those as the same title.
const ROW_CALL_RE =
    /\{\{\s*(?:Template:)?User:Alaexis\/AI[ _]Source[ _]Verification\/Benchmark\/Row\s*(?=[|}])/gi;

export const REQUIRED_PARAMS = Object.freeze([
    'wiki', 'article', 'oldid', 'citation', 'instance', 'truth',
]);

export const OPTIONAL_PARAMS = Object.freeze([
    'id',
    'rationale', 'added-by', 'confirmed-by',
    'claim-text', 'source-url', 'provenance',
    'llm-verdict', 'llm-rationale', 'llm-provider', 'llm-model', 'fetch-status',
]);

const KNOWN_PARAMS = new Set([...REQUIRED_PARAMS, ...OPTIONAL_PARAMS]);
const NUMERIC_PARAMS = Object.freeze(['oldid', 'citation', 'instance']);

// wtf_wikipedia injects the template's own name under this key in .json().
// A row param of the same name would be silently overwritten.
const RESERVED_PARAM = 'template';

const ID_RE = /^ctb-[0-9a-f]{6}$/;
const PARAM_RE = /^\s*([A-Za-z0-9_-]+)\s*=([\s\S]*)$/;

// Maps a wiki database name to its Wikipedia subdomain. `wiki` is required on
// every row specifically so a second suite page can be added without a schema
// migration; only enwiki is in use today.
export const WIKI_SUBDOMAINS = Object.freeze({ enwiki: 'en', frwiki: 'fr' });

/**
 * Locate every row transclusion, using brace-depth matching rather than a
 * regex, so a value containing balanced braces does not truncate the block and
 * an unbalanced brace is reported rather than silently swallowing the rest of
 * the page.
 *
 * @returns {Array<{start:number,end:number,text:string,balanced:boolean}>}
 */
export function extractRowBlocks(wikitext) {
    const blocks = [];
    ROW_CALL_RE.lastIndex = 0;
    let match;

    while ((match = ROW_CALL_RE.exec(wikitext)) !== null) {
        const start = match.index;
        let depth = 0;
        let end = -1;

        for (let i = start; i < wikitext.length; i++) {
            const ch = wikitext[i];
            if (ch === '{') {
                depth++;
            } else if (ch === '}') {
                depth--;
                if (depth === 0) { end = i + 1; break; }
            }
        }

        if (end === -1) {
            // Unterminated: nothing after this point can be trusted, because the
            // missing close brace swallows every subsequent row.
            blocks.push({ start, end: wikitext.length, text: wikitext.slice(start), balanced: false });
            break;
        }

        blocks.push({ start, end, text: wikitext.slice(start, end), balanced: true });
        ROW_CALL_RE.lastIndex = end;
    }

    return blocks;
}

/**
 * Split a row block into its template name and raw parameter segments, honoring
 * brace and wikilink nesting so `[[Foo|bar]]` does not split into two params.
 *
 * @returns {{name:string, params:string[]}}
 */
export function splitTopLevelParams(blockText) {
    // Defensively strip delimiters rather than assuming fixed offsets, in case the
    // block's trailing braces are unbalanced (e.g., from extractRowBlocks terminating
    // on depth-zero with a single `}` instead of `}}` remaining).
    const inner = blockText.replace(/^\{\{/, '').replace(/\}\}?$/, '');
    const segments = [];
    let current = '';
    let depth = 0;
    let link = 0;

    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];

        if (ch === '{') { depth++; }
        else if (ch === '}') { depth--; }
        else if (ch === '[' && inner[i + 1] === '[') { link++; }
        else if (ch === ']' && inner[i + 1] === ']') { link--; }

        if (ch === '|' && depth === 0 && link <= 0) {
            segments.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    segments.push(current);

    return { name: segments[0].trim(), params: segments.slice(1) };
}

export class SuiteValidationError extends Error {
    constructor(errors) {
        const lines = errors.map(e =>
            `  [${e.code}] row ${e.row}`
            + (e.id ? ` (${e.id})` : '')
            + (e.param ? ` param "${e.param}"` : '')
            + `: ${e.message}`);
        super(`Suite validation failed with ${errors.length} error(s):\n${lines.join('\n')}`);
        this.name = 'SuiteValidationError';
        this.errors = errors;
    }
}

/**
 * Parse and validate an entire suite page.
 *
 * Throws SuiteValidationError listing EVERY problem found, rather than the first.
 * A partially-valid suite is never returned: silent row loss changes the
 * denominator of every downstream accuracy metric, so ingestion refuses to
 * proceed on a malformed page. This is the documented exception to the project
 * convention that analytical tools always exit 0 — that convention guards against
 * rubber-stamping *results*, whereas this guards the *inputs*.
 *
 * @param {string} wikitext
 * @returns {{rows: object[], warnings: object[]}} validated rows in page order
 */
export function parseSuite(wikitext) {
    const errors = [];
    const warnings = [];
    const blocks = extractRowBlocks(wikitext);

    // --- Reading 1: raw text. Recovers what wtf_wikipedia destroys.
    const rawRows = blocks.map((block, i) => {
        const rowNo = i + 1;

        if (!block.balanced) {
            errors.push({
                row: rowNo, id: null, param: null, code: 'UNBALANCED_BRACES',
                message: 'unbalanced { or } — this row and everything after it is lost by the parser',
            });
            return null;
        }

        const { params } = splitTopLevelParams(block.text);
        const values = new Map();
        const seen = new Set();

        for (const segment of params) {
            const m = PARAM_RE.exec(segment);
            if (!m) {
                if (segment.trim() === '') continue; // trailing newline before }}
                errors.push({
                    row: rowNo, id: null, param: null, code: 'STRAY_PIPE',
                    message: `"${segment.trim().slice(0, 40)}" is not a "name = value" pair `
                        + '— an unescaped | in a value truncates it silently',
                });
                continue;
            }

            const name = m[1].trim();
            const value = m[2].trim();

            if (seen.has(name)) {
                errors.push({
                    row: rowNo, id: values.get('id') ?? null, param: name, code: 'DUPLICATE_PARAM',
                    message: 'given more than once — the parser silently keeps only the last',
                });
            }
            seen.add(name);

            if (name === RESERVED_PARAM) {
                errors.push({
                    row: rowNo, id: values.get('id') ?? null, param: name, code: 'RESERVED_PARAM',
                    message: `"${RESERVED_PARAM}" is reserved by the parser and would be overwritten`,
                });
                continue;
            }
            if (!KNOWN_PARAMS.has(name)) {
                errors.push({
                    row: rowNo, id: values.get('id') ?? null, param: name, code: 'UNKNOWN_PARAM',
                    message: 'not a recognized parameter',
                });
                continue;
            }
            if (value === '') {
                errors.push({
                    row: rowNo, id: values.get('id') ?? null, param: name, code: 'EMPTY_PARAM',
                    message: 'empty value — omit the parameter instead; the parser cannot '
                        + 'tell an empty value from an absent one',
                });
                continue;
            }
            if (/\{\{|\}\}/.test(value)) {
                errors.push({
                    row: rowNo, id: values.get('id') ?? null, param: name, code: 'NESTED_TEMPLATE',
                    message: 'contains a nested template — it expands at parse time and breaks '
                        + 'reproducibility; {{!}} does not escape a pipe here',
                });
                continue;
            }
            if (/[{}]/.test(value)) {
                errors.push({
                    row: rowNo, id: values.get('id') ?? null, param: name, code: 'FORBIDDEN_CHAR',
                    message: 'contains { or } — an unbalanced brace deletes the entire row',
                });
                continue;
            }

            values.set(name, value);
        }

        return values;
    });

    // --- Reading 2: wtf_wikipedia. Supplies values, and its count is the cross-check.
    let parsed = wtf(wikitext).templates()
        .map(t => t.json())
        .filter(j => j.template === SUITE_TEMPLATE_KEY);

    // Test seam. Every cause of row loss we know about makes a block unbalanced,
    // and reconciliation is skipped in that case — so the branch below is
    // unreachable from any fixture. This lets the test suite drop a row to prove
    // the guard against causes we have NOT modelled actually fires.
    if (typeof globalThis.__suiteParseHook === 'function') {
        parsed = globalThis.__suiteParseHook(parsed);
    }

    // Skip reconciliation when a block is already known unbalanced: that case is
    // reported precisely by UNBALANCED_BRACES, and the count will necessarily
    // disagree, so also raising ROW_COUNT_MISMATCH would be noise on top of a
    // diagnosis we already have. Reconciliation exists for the rows we CANNOT
    // explain — a row wtf drops for a reason this validator does not model.
    const anyUnbalanced = blocks.some(b => !b.balanced);

    if (!anyUnbalanced && parsed.length !== blocks.length) {
        errors.push({
            row: 0, id: null, param: null, code: 'ROW_COUNT_MISMATCH',
            message: `found ${blocks.length} row transclusion(s) in the raw wikitext but the `
                + `parser returned ${parsed.length} — some rows are being silently dropped`,
        });
    }

    // --- Semantic validation, using the raw values (authoritative for integrity)
    //     and the parsed values (authoritative for text normalization).
    const rows = [];
    const idsSeen = new Map();

    rawRows.forEach((values, i) => {
        if (values === null) return;
        const rowNo = i + 1;
        const id = values.get('id') ?? null;
        let effectiveId = id;
        const parsedRow = parsed.length === blocks.length ? parsed[i] : null;
        const err = (code, param, message) => errors.push({ row: rowNo, id: effectiveId, param, code, message });

        for (const param of REQUIRED_PARAMS) {
            if (!values.has(param)) err('MISSING_PARAM', param, 'is required but absent');
        }

        // Identity fields must be valid before a hash means anything.
        const identityUsable = ['wiki', 'oldid', 'citation', 'instance']
            .every(p => values.has(p)) && /^\d+$/.test(values.get('oldid') ?? '');
        const computedId = identityUsable ? computeRowId({
            wiki: values.get('wiki'),
            oldid: values.get('oldid'),
            citation: values.get('citation'),
            instance: values.get('instance'),
        }) : null;

        if (id === null) {
            // A contributed row: nobody could have written the hash. Compute it
            // rather than rejecting, so one contribution cannot block ingestion.
            if (computedId === null) {
                err('MISSING_PARAM', 'id', 'absent, and identity fields are too incomplete '
                    + 'to compute one');
            } else {
                effectiveId = computedId;
                warnings.push({
                    row: rowNo, id: computedId, code: 'ID_COMPUTED',
                    message: 'no id on the row; computed from identity fields. A maintainer '
                        + 'should write it back to the page.',
                });
            }
        } else if (!ID_RE.test(id)) {
            err('BAD_ID_FORMAT', 'id', `"${id}" is not "ctb-" followed by 6 hex characters`);
        } else if (computedId !== null && computedId !== id) {
            // Never override: the written id keeps the row joinable to historical
            // results even when its identity fields have since been corrected.
            warnings.push({
                row: rowNo, id, code: 'ID_DRIFT',
                message: `written id ${id} does not match the hash of its identity fields `
                    + `(${computedId}) — an identity field was probably corrected after the `
                    + 'row was created. Keeping the written id.',
            });
        }

        if (effectiveId !== null && ID_RE.test(effectiveId)) {
            if (idsSeen.has(effectiveId)) {
                err('DUPLICATE_ID', 'id', `already used by row ${idsSeen.get(effectiveId)}`);
            } else {
                idsSeen.set(effectiveId, rowNo);
            }
        }

        for (const param of NUMERIC_PARAMS) {
            const v = values.get(param);
            if (v !== undefined && !/^\d+$/.test(v)) {
                err('NON_NUMERIC', param, `"${v}" is not a positive integer`);
            }
        }

        const wiki = values.get('wiki');
        if (wiki !== undefined && !(wiki in WIKI_SUBDOMAINS)) {
            err('UNKNOWN_WIKI', 'wiki', `"${wiki}" is not a known wiki `
                + `(expected one of: ${Object.keys(WIKI_SUBDOMAINS).join(', ')})`);
        }

        const truth = values.get('truth');
        const canonicalTruth = truth === undefined ? null : canonicalizeVerdict(truth);
        if (truth !== undefined && canonicalTruth === null) {
            err('BAD_VERDICT', 'truth', `"${truth}" is not one of Supported, Partially supported, `
                + 'Not supported, Source unavailable');
        }

        const llmVerdict = values.get('llm-verdict');
        const canonicalLlm = llmVerdict === undefined ? null : canonicalizeVerdict(llmVerdict);

        // Prefer the parser's value for free-text fields — it flattens wikilinks
        // and resolves entities. Fall back to raw when reconciliation failed.
        const text = (name) => {
            const fromParser = parsedRow ? parsedRow[name] : undefined;
            return fromParser !== undefined ? String(fromParser) : (values.get(name) ?? null);
        };

        rows.push({
            id: effectiveId,
            wiki,
            article: text('article'),
            oldid: Number(values.get('oldid')),
            citation: Number(values.get('citation')),
            instance: Number(values.get('instance')),
            truth: canonicalTruth === null ? null : toTitleCase(canonicalTruth),
            rationale: text('rationale'),
            addedBy: values.get('added-by') ?? null,
            confirmedBy: values.get('confirmed-by') ?? null,
            claimText: text('claim-text'),
            sourceUrl: values.get('source-url') ?? null,
            provenance: values.get('provenance') ?? null,
            llmVerdict: canonicalLlm === null ? null : toTitleCase(canonicalLlm),
            llmRationale: text('llm-rationale'),
            llmProvider: values.get('llm-provider') ?? null,
            llmModel: values.get('llm-model') ?? null,
            fetchStatus: values.get('fetch-status') ?? null,
        });
    });

    if (errors.length > 0) throw new SuiteValidationError(errors);

    return { rows, warnings };
}

export const ROW_ID_PREFIX = 'ctb-';
const ROW_ID_HEX_LENGTH = 6;

/**
 * Stable row identity: a hash over identity fields ONLY.
 *
 * Deliberately excludes ground truth, rationale, and the override trio, so
 * correcting a label never renumbers a row. Replaces the `row_<csv_line>`
 * scheme, where inserting a row mid-file shifted every id after it while
 * results.json kept the old ids — a misalignment that went undetected for two
 * weeks in May 2026.
 *
 * Fields are joined with a separator that cannot appear in any of them, so
 * (citation=1, instance=11) and (citation=11, instance=1) hash differently.
 */
export function computeRowId({ wiki, oldid, citation, instance }) {
    const material = [wiki, oldid, citation, instance].map(v => String(v)).join(' ');
    const digest = createHash('sha256').update(material, 'utf8').digest('hex');
    return ROW_ID_PREFIX + digest.slice(0, ROW_ID_HEX_LENGTH);
}

/**
 * Recover identity fields from the pre-assembled `Article` URL the CSV stores.
 * Needed to compute a content hash for legacy rows during migration.
 */
export function parseArticleUrl(url) {
    const parsed = new URL(url);
    const title = parsed.searchParams.get('title');
    const oldid = parsed.searchParams.get('oldid');

    if (!title || !oldid) {
        throw new Error(
            `cannot derive row identity from "${url}": expected title and oldid query parameters`);
    }

    const subdomain = parsed.hostname.split('.')[0];
    const wiki = Object.entries(WIKI_SUBDOMAINS).find(([, sub]) => sub === subdomain)?.[0];
    if (!wiki) throw new Error(`unrecognized wiki host in "${url}"`);

    return { article: decodeURIComponent(title).replace(/_/g, ' '), oldid: Number(oldid), wiki };
}

/**
 * Build the article permalink a row points at. The CSV stored this as one
 * pre-assembled URL; the suite page stores title and revision separately
 * because two labelled fields are more reliably hand-edited than a query
 * string, and each half validates independently.
 */
export function buildArticleUrl(row) {
    const subdomain = WIKI_SUBDOMAINS[row.wiki] ?? 'en';
    const title = encodeURIComponent(String(row.article).replace(/ /g, '_'))
        .replace(/%2F/g, '/');
    return `https://${subdomain}.wikipedia.org/w/index.php?title=${title}&oldid=${row.oldid}`;
}

/**
 * Convert a validated suite row into the CSV-column shape that
 * extract_dataset.js already consumes, so swapping the row source touches no
 * downstream extraction logic.
 *
 * `_id` replaces the old `_rowIndex`: identity now travels with the row instead
 * of being derived from its position in a file.
 *
 * `Dataset version` is deliberately absent — cohort membership is derived from
 * the migration revision snapshots, not stored per row.
 */
export function toDatasetRow(row) {
    return {
        'Citation number': String(row.citation),
        'Citation instance': String(row.instance),
        'Article': buildArticleUrl(row),
        'Ground truth': row.truth ?? '',
        'WMF claim text': row.claimText ?? '',
        'WMF source URL': row.sourceUrl ?? '',
        'WMF provenance': row.provenance ?? '',
        _id: row.id,
        _suiteRow: row,
    };
}
