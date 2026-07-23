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

import { canonicalizeVerdict, toTitleCase } from '../core/verdicts.js';

// Re-export wtf so tests and benchmark code share a single resolved module.
// This ensures both paths use the same wtf_wikipedia instance and any future
// version drift from floating ^10.4.2 ranges hits all regression fixtures equally.
export { default as wtf } from 'wtf_wikipedia';

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
    'id', 'wiki', 'article', 'oldid', 'citation', 'instance', 'truth',
]);

export const OPTIONAL_PARAMS = Object.freeze([
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
