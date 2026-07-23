// Book grounding via Open Library + the Internet Archive.
//
// Book citations are the largest class of source we cannot read: they have no
// fetchable URL, so `fetchSourceContent` has nothing to give the verifier and
// every one of them lands in the Source-Unavailable bucket. This module closes
// that gap without a borrow and without downloading a scan:
//
//   1. Resolve the exact edition through Open Library (Books API), keyed on the
//      identifiers the footnote actually carries (ISBN / OCLC / LCCN / OL).
//   2. Ask Open Library's Read API whether that edition has an online scan,
//      and take only an `exact` match — a `similar` item is a scan of a
//      *different edition*, whose pagination and text may differ, so grounding
//      a page-specific citation against it would be a false positive.
//   3. Read the scan's item metadata for its designated server and directory,
//      run the BookReader full-text search there, and assemble the returned
//      page-numbered verbatim OCR snippets into a source body that the
//      existing prompts and verdict parser judge unchanged.
//
// Two outcomes must not be confused, and the split is the reason this module
// reports a structured `bookOutcome` rather than just null-or-content:
//
//   - We could not read the book (no catalog record, no exact-edition scan,
//     not a text item, no full-text index, transport failure)
//         -> Source unavailable. A statement about us.
//   - We searched an indexed scan and it returned nothing
//         -> Not supported (omission). A statement about the book.
//
// Every request is a read-only GET. In particular the resolve lane never
// addresses `openlibrary.org/isbn/{isbn}.json`, which is documented under
// "Import by ISBN" and can create a record on a miss.

// The side-effect-free catalog lookup.
export const OPEN_LIBRARY_BOOKS_API = 'https://openlibrary.org/api/books';
// The scan-availability base, consulted only after catalog resolution.
export const OPEN_LIBRARY_READ_API_BASE = 'https://openlibrary.org/api/volumes/brief';
// The archive.org item-metadata endpoint, which names the item's designated
// server and directory the full-text search must run against.
export const ARCHIVE_METADATA_BASE = 'https://archive.org/metadata';

// Most matches carried into an assembled body. Bounds the body (and the prompt
// it feeds) on common-word queries that return hundreds of hits.
const MAX_SNIPPET_MATCHES = 8;
// Most claim terms carried into the search query.
const MAX_QUERY_TERMS = 6;

// ---------------------------------------------------------------------------
// Identifier normalization
//
// Each normalizer returns `{ scheme, value }` or null. A null is a hard gate:
// resolution only ever runs on a genuinely positive identifier, never a guess.
// ---------------------------------------------------------------------------

// ISBN-10 (mod-11, check digit may be X) or ISBN-13 (EAN-13). Checksums are
// validated because Wikipedia footnotes carry plenty of typo'd ISBNs, and an
// unvalidated one would resolve to either nothing or, worse, a different book.
export function normalizeIsbn(raw) {
    if (typeof raw !== 'string') return null;
    const compact = raw.replace(/[\s-]/g, '').toUpperCase();

    if (/^\d{9}[\dX]$/.test(compact)) {
        let sum = 0;
        for (let i = 0; i < 10; i++) {
            const char = compact[i];
            sum += (10 - i) * (char === 'X' ? 10 : Number(char));
        }
        return sum % 11 === 0 ? { scheme: 'isbn', value: compact } : null;
    }

    if (/^\d{13}$/.test(compact)) {
        let sum = 0;
        for (let i = 0; i < 13; i++) {
            sum += Number(compact[i]) * (i % 2 === 0 ? 1 : 3);
        }
        return sum % 10 === 0 ? { scheme: 'isbn', value: compact } : null;
    }

    return null;
}

// OCLC control number with the `ocm`/`ocn`/`on` record prefixes stripped.
export function normalizeOclc(raw) {
    if (typeof raw !== 'string') return null;
    const lower = raw.trim().toLowerCase();
    const digits = lower.replace(/^(?:ocm|ocn|on)/, '').trim();
    return /^\d+$/.test(digits) ? { scheme: 'oclc', value: digits } : null;
}

// LCCN per the Library of Congress normalization rules: lowercase, spaces
// removed, everything from the first `/` dropped, hyphenated serial zero-padded
// to six digits.
export function normalizeLccn(raw) {
    if (typeof raw !== 'string') return null;
    let value = raw.toLowerCase().replace(/\s/g, '');
    const slash = value.indexOf('/');
    if (slash !== -1) value = value.slice(0, slash);

    const hyphen = value.indexOf('-');
    if (hyphen !== -1) {
        const prefix = value.slice(0, hyphen);
        const serial = value.slice(hyphen + 1);
        if (!/^\d{1,6}$/.test(serial)) return null;
        value = prefix + serial.padStart(6, '0');
    }

    return /^[a-z0-9]+$/.test(value) ? { scheme: 'lccn', value } : null;
}

// Open Library edition (`OL…M`) or work (`OL…W`) id, canonicalized. An author
// id (`OL…A`) is not a book identifier and is rejected.
export function normalizeOlid(raw) {
    if (typeof raw !== 'string') return null;
    const match = raw.trim().match(/^(?:OL)?(\d+)([MW])$/i);
    return match ? { scheme: 'olid', value: `OL${match[1]}${match[2].toUpperCase()}` } : null;
}

// The Books API bibkey for an identifier, e.g. `ISBN:9780140328721`.
export function bibkey(identifier) {
    return `${identifier.scheme.toUpperCase()}:${identifier.value}`;
}

// ---------------------------------------------------------------------------
// Identifier extraction from rendered Wikipedia footnotes
//
// Unlike a wikitext pipeline, we only see the rendered footnote, so the
// identifiers come from the links MediaWiki generates for cite-template params
// (`isbn=` becomes a Special:BookSources link, `oclc=` a worldcat.org link, and
// so on), with a bare-text ISBN sweep as a fallback for hand-written cites.
// ---------------------------------------------------------------------------

const LINK_PATTERNS = [
    [/Special:BookSources\/([^"'#?\s]+)/i, normalizeIsbn],
    [/worldcat\.org\/oclc\/([^/?#]+)/i, normalizeOclc],
    [/lccn\.loc\.gov\/([^/?#]+)/i, normalizeLccn],
    [/openlibrary\.org\/(?:books|works)\/(OL\d+[MW])/i, normalizeOlid],
];

// A hand-written "ISBN 0-14-032872-6" in the footnote prose. Deliberately loose
// on shape — the checksum in `normalizeIsbn` is what actually gates acceptance.
const BARE_ISBN_PATTERN = /ISBN\s*:?\s*([0-9][0-9\s-]{7,}[0-9Xx])/g;

// Resolve the footnote body a citation anchor points at, following a
// Harvard/sfn short-cite through to the full citation when that is all the
// footnote holds (mirroring `extractReferenceUrl` in core/urls.js).
function resolveFootnoteElements(refElement, doc) {
    const href = refElement && refElement.getAttribute('href');
    if (!href) return [];
    const fragmentIndex = href.indexOf('#');
    if (fragmentIndex === -1) return [];
    const refTarget = doc.getElementById(href.substring(fragmentIndex + 1));
    if (!refTarget) return [];

    const elements = [refTarget];
    const citerefLink = refTarget.querySelector('a[href^="#CITEREF"]');
    if (citerefLink) {
        const fullCitation = doc.getElementById(citerefLink.getAttribute('href').substring(1));
        if (fullCitation) {
            elements.push(fullCitation.closest('li') || fullCitation);
        }
    }
    return elements;
}

// Every book identifier a citation carries, in document order, deduplicated.
// Link-derived identifiers come first (they are what the cite template
// declared); bare-text ISBNs are appended.
export function extractBookIdentifiers(refElement, doc = globalThis.document) {
    const found = [];
    const seen = new Set();
    const add = (identifier) => {
        if (!identifier) return;
        const key = `${identifier.scheme}:${identifier.value}`;
        if (seen.has(key)) return;
        seen.add(key);
        found.push(identifier);
    };

    const elements = resolveFootnoteElements(refElement, doc);

    for (const element of elements) {
        for (const link of element.querySelectorAll('a[href]')) {
            const href = link.getAttribute('href');
            for (const [pattern, normalize] of LINK_PATTERNS) {
                const match = href.match(pattern);
                if (match) add(normalize(decodeURIComponent(match[1])));
            }
        }
    }

    for (const element of elements) {
        for (const match of element.textContent.matchAll(BARE_ISBN_PATTERN)) {
            add(normalizeIsbn(match[1]));
        }
    }

    return found;
}

// ---------------------------------------------------------------------------
// Transport
//
// `getJson(url)` resolves to `{ status, data }` — `data` null when the body was
// not JSON — and throws on transport failure. That distinction matters: a
// throw is "we do not know", which must never be reported as "not found".
//
// The default is a direct fetch, which is what the CLI, the benchmark and the
// tests use. All three of these APIs send `Access-Control-Allow-Origin: *`, but
// the userscript path should still inject a proxy-backed transport to stay
// consistent with how every other outbound request is made.
// ---------------------------------------------------------------------------

export async function defaultJsonTransport(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    let data = null;
    try {
        data = await response.json();
    } catch (_) {
        data = null;
    }
    return { status: response.status, data };
}

const isOk = (status) => status >= 200 && status < 300;

// ---------------------------------------------------------------------------
// Open Library: catalog resolution
// ---------------------------------------------------------------------------

export function buildCatalogLookupUrl(identifier) {
    const params = new URLSearchParams({
        bibkeys: bibkey(identifier),
        jscmd: 'data',
        format: 'json',
    });
    return `${OPEN_LIBRARY_BOOKS_API}?${params}`;
}

// Parse a `jscmd=data` response for the identifier it was queried with. Null is
// a catalog miss ("no record found") or an unparseable body — never a create.
// Every field is best-effort: a thin record simply has absences.
export function parseCatalogLookup(identifier, data) {
    const record = data && typeof data === 'object' ? data[bibkey(identifier)] : null;
    if (!record || typeof record !== 'object') return null;

    const stringOf = (key) => {
        const value = record[key];
        return typeof value === 'string' && value.trim() ? value : null;
    };
    const namesOf = (value) => (Array.isArray(value) ? value : [])
        .map((entry) => entry && entry.name)
        .filter((name) => typeof name === 'string' && name.trim());
    const identifierList = (key) => {
        const values = record.identifiers && record.identifiers[key];
        return (Array.isArray(values) ? values : []).filter((v) => typeof v === 'string');
    };
    const cover = record.cover || {};
    const coverUrl = ['large', 'medium', 'small']
        .map((size) => cover[size])
        .find((url) => typeof url === 'string') || null;

    return {
        key: stringOf('key'),
        recordUrl: stringOf('url'),
        title: stringOf('title'),
        authors: namesOf(record.authors),
        publishers: namesOf(record.publishers),
        publishDate: stringOf('publish_date'),
        numberOfPages: typeof record.number_of_pages === 'number' ? record.number_of_pages : null,
        isbn10: identifierList('isbn_10'),
        isbn13: identifierList('isbn_13'),
        subjects: namesOf(record.subjects),
        coverUrl,
    };
}

export function buildScanAvailabilityUrl(identifier) {
    return `${OPEN_LIBRARY_READ_API_BASE}/${identifier.scheme}/${identifier.value}.json`;
}

// The ocaid a Read API record names, from `details.details.ocaid` or an
// `archive.org/details/…` link in `data.ebooks[].preview_url`.
function recordOcaid(record) {
    const direct = record && record.details && record.details.details
        && record.details.details.ocaid;
    if (typeof direct === 'string' && direct) return direct;

    const ebooks = record && record.data && record.data.ebooks;
    for (const ebook of Array.isArray(ebooks) ? ebooks : []) {
        const ocaid = extractOcaid(ebook && ebook.preview_url);
        if (ocaid) return ocaid;
    }
    return null;
}

// Parse a Read API brief response into availability partitioned by match
// quality. Null only for an unparseable body; a well-formed response with no
// items yields empty lists, which means "record may exist, no usable scan" —
// not "no record".
//
// The scan identity (`ocaid`) is resolved here rather than at use: it comes
// from the `itemURL` when that is an `archive.org/details/…` link, and
// otherwise from the item's `fromRecord` record, because lendable items now
// carry an `openlibrary.org/…/borrow` URL in `itemURL` instead.
export function parseScanAvailability(data) {
    if (!data || typeof data !== 'object') return null;
    const availability = { exact: [], similar: [] };
    if (!Array.isArray(data.items)) return availability;

    const records = (data.records && typeof data.records === 'object') ? data.records : {};
    const recordOcaids = Object.values(records).map(recordOcaid).filter(Boolean);
    // Ambiguous (two records naming different scans) means no fallback: we
    // would be guessing which scan the citation meant.
    const soleRecordOcaid = new Set(recordOcaids).size === 1 ? recordOcaids[0] : null;

    for (const item of data.items) {
        const itemUrl = item && item.itemURL;
        if (typeof itemUrl !== 'string') continue;

        const fromRecord = typeof item.fromRecord === 'string' ? records[item.fromRecord] : null;
        const scan = {
            status: typeof item.status === 'string' ? item.status : '',
            itemUrl,
            olEditionId: typeof item['ol-edition-id'] === 'string' ? item['ol-edition-id'] : null,
            ocaid: extractOcaid(itemUrl) || (fromRecord && recordOcaid(fromRecord)) || soleRecordOcaid,
        };
        // An unlabeled match is treated as similar: never ground on it.
        if (item.match === 'exact') availability.exact.push(scan);
        else availability.similar.push(scan);
    }

    return availability;
}

// The one scan eligible to enter grounding: an exact-edition match whose scan
// identity we actually recovered, preferring `full access` — the full-text
// endpoint returns 403 for lending-restricted (print-disabled) items, so a
// full-access scan grounds where a lendable one cannot. Null when only
// similar-edition scans exist, or no exact item carries an ocaid; grounding
// then degrades to source-unavailable rather than verifying a page-specific
// citation against a different edition.
export function groundableScan(availability) {
    if (!availability) return null;
    const usable = availability.exact.filter((item) => item.ocaid);
    if (usable.length === 0) return null;
    return usable.find((item) => item.status.toLowerCase() === 'full access') || usable[0];
}

// Try each identifier in document order against the Books API; on the first
// catalog hit, additionally look up scan availability. Strictly read-only and
// best-effort — any transport failure degrades to `lookup_failed` rather than
// throwing, and a miss issues no retry against a write path.
export async function resolveBookSource(identifiers, { getJson = defaultJsonTransport } = {}) {
    let failure = null;

    for (const identifier of identifiers) {
        let response;
        try {
            response = await getJson(buildCatalogLookupUrl(identifier));
        } catch (error) {
            failure = failure || (error && error.message) || String(error);
            continue;
        }
        if (!isOk(response.status)) {
            failure = failure || `catalog lookup returned ${response.status}`;
            continue;
        }
        // An unparseable 2xx body is a failure, not a miss: "not_found" is
        // reserved for a clean catalog answer with no record under our bibkey.
        if (response.data === null || response.data === undefined) {
            failure = failure || 'catalog lookup body was not JSON';
            continue;
        }

        const edition = parseCatalogLookup(identifier, response.data);
        if (edition) {
            return {
                kind: 'resolved',
                identifier,
                edition,
                scan: await fetchScanAvailability(getJson, identifier),
            };
        }
        // A clean miss under this identifier — try the next one.
    }

    return failure ? { kind: 'lookup_failed', message: failure } : { kind: 'not_found' };
}

// Best-effort availability check; any failure yields null (availability
// unknown), which never blocks or fails the resolution.
async function fetchScanAvailability(getJson, identifier) {
    try {
        const response = await getJson(buildScanAvailabilityUrl(identifier));
        return isOk(response.status) ? parseScanAvailability(response.data) : null;
    } catch (_) {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Internet Archive: search inside
// ---------------------------------------------------------------------------

// The archive.org item id from an item URL, e.g.
// `https://archive.org/details/matilda00dahl` -> `matilda00dahl`.
// Both the `/details/` and the older `/stream/` forms appear in live Read API
// responses (full-access items are still reported with `/stream/`).
export function extractOcaid(itemUrl) {
    if (typeof itemUrl !== 'string') return null;
    let url;
    try {
        url = new URL(itemUrl);
    } catch (_) {
        return null;
    }
    if (url.hostname !== 'archive.org' && url.hostname !== 'www.archive.org') return null;
    const segments = url.pathname.split('/').filter(Boolean);
    if ((segments[0] !== 'details' && segments[0] !== 'stream') || !segments[1]) return null;
    return segments[1];
}

export function buildItemMetadataUrl(ocaid) {
    return `${ARCHIVE_METADATA_BASE}/${encodeURIComponent(ocaid)}`;
}

// Where an item's full-text search runs, plus whether it is a text item at all.
// Null for an unparseable body or one missing the server/dir designation.
export function parseItemMetadata(data) {
    if (!data || typeof data !== 'object') return null;
    if (typeof data.server !== 'string' || typeof data.dir !== 'string') return null;
    return {
        server: data.server,
        dir: data.dir,
        isTextItem: Boolean(data.metadata) && data.metadata.mediatype === 'texts',
    };
}

// The BookReader full-text search, on the item's designated server. Null when
// the metadata-supplied server does not form a valid URL.
export function buildSearchInsideUrl(location, ocaid, query) {
    try {
        const url = new URL(`https://${location.server}/fulltext/inside.php`);
        url.search = new URLSearchParams({
            item_id: ocaid,
            doc: ocaid,
            path: location.dir,
            q: query,
        }).toString();
        return url.toString();
    } catch (_) {
        return null;
    }
}

// The search marks matched terms inline. Both the historical `{{{…}}}` form and
// the `<IA_FTS_MATCH>` tags the endpoint returns today have to come out, or the
// markup ends up inside text we present to the model as verbatim OCR — and
// inside any quote the model lifts from it.
function stripHighlightMarkers(text) {
    return text
        .replace(/<\/?IA_FTS_MATCH>/g, '')
        .replace(/\{\{\{|\}\}\}/g, '');
}

// Parse a search-inside response. Null for an unparseable body. `indexed` is
// false when the item has no full-text index, which the endpoint signals either
// explicitly or by erroring without a matches array.
export function parseSearchInside(data) {
    if (!data || typeof data !== 'object') return null;
    const indexed = typeof data.indexed === 'boolean'
        ? data.indexed
        : Object.prototype.hasOwnProperty.call(data, 'matches');

    const matches = (Array.isArray(data.matches) ? data.matches : [])
        .map((entry) => {
            if (!entry || typeof entry.text !== 'string') return null;
            const par = Array.isArray(entry.par) ? entry.par[0] : null;
            const page = par && Number.isInteger(par.page) ? par.page : null;
            return { text: stripHighlightMarkers(entry.text), page };
        })
        .filter(Boolean);

    return { indexed, matches };
}

// A conservative full-text query from a claim: the distinct longer words
// (>= 5 chars, falling back to >= 4, then the trimmed claim) in claim order.
// Deliberately simple — term selection affects only recall, never grounding,
// since the returned snippet bytes are what any quote is checked against.
export function searchQuery(claim) {
    const words = String(claim).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    for (const floor of [5, 4]) {
        const picked = [];
        for (const word of words) {
            if ([...word].length >= floor && !picked.includes(word)) {
                picked.push(word);
                if (picked.length === MAX_QUERY_TERMS) break;
            }
        }
        if (picked.length > 0) return picked.join(' ');
    }
    return String(claim).trim();
}

// A page-anchored deep link into the scan with the search terms highlighted —
// the reader's jump to the page that supports or contradicts the claim.
export function scanDeepLink(ocaid, page, query) {
    const base = page
        ? `https://archive.org/details/${ocaid}/page/${page}`
        : `https://archive.org/details/${ocaid}`;
    const url = new URL(base);
    url.search = new URLSearchParams({ q: query }).toString();
    return url.toString();
}

// The leading page number of a cited page value: "42", "42–45" and "42, 44" all
// yield 42. Null when it does not start with a number (roman numerals, say) —
// the whole-book pass covers those.
export function leadingPageNumber(citedPage) {
    if (typeof citedPage === 'number') return Number.isInteger(citedPage) ? citedPage : null;
    if (typeof citedPage !== 'string') return null;
    const match = citedPage.trim().match(/^\d+/);
    return match ? Number(match[0]) : null;
}

// Prepare the grounding body for one claim against one scan: item metadata ->
// full-text search -> cited-page-first snippet selection. Every failure maps
// onto an outcome rather than an exception.
export async function prepareBookGrounding({ getJson = defaultJsonTransport } = {}, ocaid, claim, citedPage) {
    // 1. Item metadata: where does this item's full-text search run?
    let metadata;
    try {
        metadata = await getJson(buildItemMetadataUrl(ocaid));
    } catch (error) {
        return { kind: 'unreachable', message: (error && error.message) || String(error) };
    }
    if (!isOk(metadata.status)) {
        return { kind: 'unreachable', message: `item metadata returned ${metadata.status}` };
    }
    const location = parseItemMetadata(metadata.data);
    if (!location) return { kind: 'no_usable_body', detail: 'item metadata unusable' };
    if (!location.isTextItem) return { kind: 'no_usable_body', detail: 'not a text item' };

    // 2. Full-text search on the designated server.
    const query = searchQuery(claim);
    const searchUrl = buildSearchInsideUrl(location, ocaid, query);
    if (!searchUrl) return { kind: 'no_usable_body', detail: 'search server unusable' };

    let search;
    try {
        search = await getJson(searchUrl);
    } catch (error) {
        return { kind: 'unreachable', message: (error && error.message) || String(error) };
    }
    // A 403 here is the lending-restricted case, and it is the common one:
    // as of 2026-07 the Internet Archive returns 403 from this endpoint for
    // in-copyright (print-disabled / lendable) scans, so in practice only
    // full-access items can be grounded. Either way it is a failure to read,
    // not a finding about the book, so it must never become "not supported".
    if (!isOk(search.status)) {
        return {
            kind: 'unreachable',
            message: search.status === 403
                ? 'search-inside returned 403 (scan is lending-restricted, not full access)'
                : `search-inside returned ${search.status}`,
        };
    }
    const result = parseSearchInside(search.data);
    if (!result) return { kind: 'no_usable_body', detail: 'search response unusable' };
    if (!result.indexed) return { kind: 'no_usable_body', detail: 'no full-text index' };
    if (result.matches.length === 0) {
        return { kind: 'no_matches', query, deepLink: scanDeepLink(ocaid, null, query) };
    }

    // 3. Cited page first, then the whole book. The search already returns
    //    page-numbered matches for the entire scan, so this is a filter rather
    //    than a second request. A cited-page miss is recorded, not hidden: scan
    //    pagination frequently differs from the cited edition.
    const citedPageNumber = leadingPageNumber(citedPage);
    const onCitedPage = citedPageNumber === null
        ? []
        : result.matches.filter((entry) => entry.page === citedPageNumber);
    const citedPageHit = onCitedPage.length > 0;
    const selected = (citedPageHit ? onCitedPage : result.matches).slice(0, MAX_SNIPPET_MATCHES);

    const text = selected
        .map((entry) => entry.text.trim())
        .filter(Boolean)
        .join('\n\n');
    if (!text) return { kind: 'no_usable_body', detail: 'empty snippets' };

    return { kind: 'body', text, matches: selected, citedPageHit, query };
}

// ---------------------------------------------------------------------------
// Top level
// ---------------------------------------------------------------------------

// Describe the pages a set of matches came from, for the body preamble.
function pageSummary(matches, citedPageHit, citedPage) {
    const pages = [...new Set(matches.map((entry) => entry.page).filter(Boolean))];
    if (pages.length === 0) return 'The scan did not report page numbers for these snippets.';
    if (citedPageHit) return `They are from the cited page (page ${pages[0]}).`;

    const list = pages.sort((a, b) => a - b).join(', ');
    const noun = pages.length === 1 ? 'page' : 'pages';
    const citedNumber = leadingPageNumber(citedPage);
    // A cited page we searched for and did not find is worth saying out loud:
    // it usually means the scan is a different printing, and the reader needs
    // to know the snippets are not from the page the citation named.
    return citedNumber === null
        ? `They are from ${noun} ${list} of the book.`
        : `They are from ${noun} ${list}; the cited page ${citedNumber} had no match, `
          + 'so the scan\'s pagination probably differs from the cited edition.';
}

// A short human description of the edition, for the body preamble.
function describeEdition(edition) {
    const title = edition.title || 'the cited book';
    const parts = [];
    if (edition.authors.length > 0) parts.push(`by ${edition.authors.join(', ')}`);
    const imprint = [edition.publishers[0], edition.publishDate].filter(Boolean).join(', ');
    if (imprint) parts.push(`(${imprint})`);
    return parts.length > 0 ? `"${title}" ${parts.join(' ')}` : `"${title}"`;
}

// Assemble the source body. The preamble sits *inside* the Source Content block
// because `extractSourceText` in core/prompts.js discards everything before the
// marker — anything the model needs has to be on that side of it. It tells the
// model these are OCR snippets rather than an article, which keeps a
// legitimately fragmentary body from being read as an unusable one.
function assembleBody(edition, ocaid, prep, citedPage, deepLink) {
    const meta = `Source URL: ${deepLink}\nBook scan: archive.org/details/${ocaid}`;
    const preamble = `The following are verbatim OCR snippets from a scan of ${describeEdition(edition)}, `
        + `located by full-text search of the whole book. ${pageSummary(prep.matches, prep.citedPageHit, citedPage)} `
        + 'They are excerpts, not the full text, and the passages between them were not searched.';
    return `${meta}\n\nSource Content:\n${preamble}\n\n${prep.text}`;
}

// Resolve a book citation to a source body the existing verifier can judge.
//
// Returns the `{ content, error, status }` shape `fetchSourceContent` uses, so
// callers can treat the two interchangeably, plus:
//   - `bookOutcome`: which of the outcomes above we reached, for reporting.
//   - `verdict`: a synthesized verdict when the outcome IS the answer — set
//     only for `no_matches`, where an indexed scan was searched and returned
//     nothing. Null everywhere else, including every could-not-read outcome,
//     which the caller should surface as source-unavailable.
//   - `deepLink`: a page-anchored, query-highlighted link into the scan.
export async function fetchBookSourceContent(identifiers, claim, citedPage, options = {}) {
    const { getJson = defaultJsonTransport } = options;
    const fail = (bookOutcome, error) => ({
        content: null, error, status: null, bookOutcome, verdict: null, deepLink: null,
    });

    if (!identifiers || identifiers.length === 0) {
        return fail('no_identifiers', 'Citation carries no book identifier to resolve');
    }

    const resolution = await resolveBookSource(identifiers, { getJson });
    if (resolution.kind === 'not_found') {
        return fail('not_found', 'No Open Library record for this edition');
    }
    if (resolution.kind === 'lookup_failed') {
        return fail('lookup_failed', `Open Library lookup failed: ${resolution.message}`);
    }

    const scan = groundableScan(resolution.scan);
    if (!scan) {
        return fail('no_groundable_scan',
            'Open Library has no exact-edition scan of this book to search');
    }

    const prep = await prepareBookGrounding({ getJson }, scan.ocaid, claim, citedPage);

    if (prep.kind === 'unreachable') {
        return fail('unreachable', `Book scan unreachable: ${prep.message}`);
    }
    if (prep.kind === 'no_usable_body') {
        return fail('no_usable_body', `Book scan cannot be searched: ${prep.detail}`);
    }
    if (prep.kind === 'no_matches') {
        // The source WAS read. Reporting this as source-unavailable would
        // throw away a real finding: the book was searched and does not
        // contain the claim's terms.
        return {
            content: null,
            error: null,
            status: null,
            bookOutcome: 'no_matches',
            deepLink: prep.deepLink,
            verdict: {
                verdict: 'NOT SUPPORTED',
                reason_type: 'omission',
                // Deliberately non-zero: confidence 0 is the codebase's
                // sentinel for SOURCE UNAVAILABLE, which is the opposite of
                // what this outcome means.
                confidence: 15,
                source_quote: '',
                comments: `A full-text search of the scanned book for "${prep.query}" returned no matches, `
                    + 'so the cited pages do not appear to contain the claim. Note this searches the '
                    + 'scan\'s OCR, which can miss text in tables, images or poorly scanned pages.',
            },
        };
    }

    const page = prep.matches.map((entry) => entry.page).find(Boolean) || null;
    const deepLink = scanDeepLink(scan.ocaid, page, prep.query);
    return {
        content: assembleBody(resolution.edition, scan.ocaid, prep, citedPage, deepLink),
        error: null,
        status: null,
        bookOutcome: 'body',
        verdict: null,
        deepLink,
    };
}
