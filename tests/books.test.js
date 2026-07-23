import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
    normalizeIsbn,
    normalizeOclc,
    normalizeLccn,
    normalizeOlid,
    bibkey,
    extractBookIdentifiers,
    buildCatalogLookupUrl,
    parseCatalogLookup,
    buildScanAvailabilityUrl,
    parseScanAvailability,
    groundableScan,
    resolveBookSource,
    extractOcaid,
    buildItemMetadataUrl,
    parseItemMetadata,
    buildSearchInsideUrl,
    parseSearchInside,
    searchQuery,
    searchQueryLadder,
    scanDeepLink,
    leadingPageNumber,
    prepareBookGrounding,
    fetchBookSourceContent,
} from '../core/books.js';

// A transport stub in the shape core/books.js expects: each call shifts the
// next queued outcome. `{ status, data }` resolves; an Error instance throws
// (transport failure, which must read as "unknown", never "not found").
function stubTransport(queue) {
    const urls = [];
    const getJson = async (url) => {
        urls.push(url);
        const next = queue.shift();
        assert.ok(next !== undefined, `unexpected extra request: ${url}`);
        if (next instanceof Error) throw next;
        return next;
    };
    return { getJson, urls };
}

const ok = (data) => ({ status: 200, data });

const CATALOG_HIT = {
    'ISBN:9780140328721': {
        url: 'https://openlibrary.org/books/OL7826547M/Matilda',
        key: '/books/OL7826547M',
        title: 'Matilda',
        authors: [{ name: 'Roald Dahl' }],
        number_of_pages: 240,
        identifiers: { isbn_10: ['0140328726'], isbn_13: ['9780140328721'] },
        publishers: [{ name: 'Puffin' }],
        publish_date: 'October 1, 1988',
        subjects: [{ name: 'School stories' }],
        cover: {
            small: 'https://covers.openlibrary.org/b/id/8314135-S.jpg',
            large: 'https://covers.openlibrary.org/b/id/8314135-L.jpg',
        },
    },
};

const READ_API_EXACT = {
    items: [{
        match: 'exact',
        status: 'full access',
        itemURL: 'https://archive.org/details/matilda00dahl',
        'ol-edition-id': 'OL7826547M',
    }],
};

const ITEM_METADATA = {
    server: 'ia800300.us.archive.org',
    dir: '/12/items/matilda00dahl',
    metadata: { identifier: 'matilda00dahl', mediatype: 'texts' },
};

const SEARCH_HITS = {
    indexed: true,
    matches: [
        {
            text: 'Matilda longed for her parents to be {{{good}}} and {{{loving}}}.',
            par: [{ page: 42 }],
        },
        {
            text: 'a {{{good}}} and {{{loving}}} child somewhere else in the book',
            par: [{ page: 7 }],
        },
    ],
};

const ISBN = { scheme: 'isbn', value: '9780140328721' };

// ---------------------------------------------------------------------------
// Identifier normalization
// ---------------------------------------------------------------------------

test('normalizeIsbn accepts and compacts checksum-valid ISBN-10 and ISBN-13', () => {
    assert.deepEqual(normalizeIsbn('978-0-14-032872-1'), ISBN);
    assert.deepEqual(normalizeIsbn('0 14 032872 6'), { scheme: 'isbn', value: '0140328726' });
    // ISBN-10 check digit X is valid and uppercased.
    assert.deepEqual(normalizeIsbn('080442957x'), { scheme: 'isbn', value: '080442957X' });
});

test('normalizeIsbn rejects bad checksums and wrong lengths', () => {
    assert.equal(normalizeIsbn('978-0-14-032872-2'), null, 'bad EAN-13 check digit');
    assert.equal(normalizeIsbn('0140328727'), null, 'bad mod-11 check digit');
    assert.equal(normalizeIsbn('12345'), null);
    assert.equal(normalizeIsbn(''), null);
    assert.equal(normalizeIsbn(null), null);
});

test('normalizeOclc strips record prefixes and requires digits', () => {
    assert.deepEqual(normalizeOclc('ocm12345678'), { scheme: 'oclc', value: '12345678' });
    assert.deepEqual(normalizeOclc('ocn123'), { scheme: 'oclc', value: '123' });
    assert.deepEqual(normalizeOclc(' 12345678 '), { scheme: 'oclc', value: '12345678' });
    assert.equal(normalizeOclc('abc123'), null);
    assert.equal(normalizeOclc('ocm'), null);
});

test('normalizeLccn applies LC normalization rules', () => {
    assert.deepEqual(normalizeLccn('n 78-890351'), { scheme: 'lccn', value: 'n78890351' });
    assert.deepEqual(normalizeLccn('agr 25-000003/L'), { scheme: 'lccn', value: 'agr25000003' });
    assert.deepEqual(normalizeLccn('2001-000002'), { scheme: 'lccn', value: '2001000002' });
    assert.equal(normalizeLccn('n 78-8903512'), null, 'serial longer than six digits');
    assert.equal(normalizeLccn(''), null);
});

test('normalizeOlid canonicalizes edition and work ids but rejects authors', () => {
    assert.deepEqual(normalizeOlid('7030731M'), { scheme: 'olid', value: 'OL7030731M' });
    assert.deepEqual(normalizeOlid('OL7030731M'), { scheme: 'olid', value: 'OL7030731M' });
    assert.deepEqual(normalizeOlid('ol123w'), { scheme: 'olid', value: 'OL123W' });
    assert.equal(normalizeOlid('OL34184A'), null, 'author ids are not book identifiers');
    assert.equal(normalizeOlid('OLM'), null);
});

test('bibkey covers every scheme', () => {
    assert.equal(bibkey(ISBN), 'ISBN:9780140328721');
    assert.equal(bibkey(normalizeOclc('ocm12345678')), 'OCLC:12345678');
    assert.equal(bibkey(normalizeLccn('n 78-890351')), 'LCCN:n78890351');
    assert.equal(bibkey(normalizeOlid('7030731M')), 'OLID:OL7030731M');
});

// ---------------------------------------------------------------------------
// Identifier extraction from rendered Wikipedia footnotes
// ---------------------------------------------------------------------------

function refDom(footnoteHtml) {
    const dom = new JSDOM(`<!doctype html><body>
        <sup id="cite_ref-1"><a href="#cite_note-1">[1]</a></sup>
        <ol><li id="cite_note-1">${footnoteHtml}</li></ol>
    </body>`);
    const doc = dom.window.document;
    return { doc, anchor: doc.querySelector('#cite_ref-1 a') };
}

test('extractBookIdentifiers reads a Special:BookSources ISBN link', () => {
    // What {{cite book|isbn=}} actually renders on en.wikipedia.org.
    const { doc, anchor } = refDom(
        '<cite class="citation book">Dahl, Roald (1988). <i>Matilda</i>. Puffin. '
        + '<a rel="nofollow" class="external text" href="/wiki/Special:BookSources/978-0-14-032872-1">'
        + 'ISBN 978-0-14-032872-1</a>.</cite>'
    );
    assert.deepEqual(extractBookIdentifiers(anchor, doc), [ISBN]);
});

test('extractBookIdentifiers reads OCLC, LCCN and OL links', () => {
    const { doc, anchor } = refDom(
        '<cite>'
        + '<a href="https://search.worldcat.org/oclc/12345678">OCLC 12345678</a> '
        + '<a href="https://lccn.loc.gov/n78890351">LCCN n78890351</a> '
        + '<a href="https://openlibrary.org/books/OL7826547M">OL 7826547M</a>'
        + '</cite>'
    );
    assert.deepEqual(extractBookIdentifiers(anchor, doc), [
        { scheme: 'oclc', value: '12345678' },
        { scheme: 'lccn', value: 'n78890351' },
        { scheme: 'olid', value: 'OL7826547M' },
    ]);
});

test('extractBookIdentifiers falls back to bare ISBN text and dedupes', () => {
    const { doc, anchor } = refDom(
        '<cite>Some Book. ISBN 978-0-14-032872-1. '
        + '<a href="/wiki/Special:BookSources/9780140328721">ISBN 9780140328721</a></cite>'
    );
    assert.deepEqual(extractBookIdentifiers(anchor, doc), [ISBN], 'same ISBN reported once');
});

test('extractBookIdentifiers ignores invalid identifiers and non-book refs', () => {
    const { doc, anchor } = refDom(
        '<cite>ISBN 978-0-14-032872-2 (typo). '
        + '<a href="https://example.org/article">A web source</a></cite>'
    );
    assert.deepEqual(extractBookIdentifiers(anchor, doc), []);
});

test('extractBookIdentifiers follows a Harvard/sfn CITEREF link', () => {
    const dom = new JSDOM(`<!doctype html><body>
        <sup id="cite_ref-1"><a href="#cite_note-1">[1]</a></sup>
        <ol><li id="cite_note-1"><a href="#CITEREFDahl1988">Dahl 1988</a>, p. 42.</li></ol>
        <ul><li id="CITEREFDahl1988">Dahl, Roald (1988). <i>Matilda</i>.
            <a href="/wiki/Special:BookSources/978-0-14-032872-1">ISBN 978-0-14-032872-1</a>.</li></ul>
    </body>`);
    const doc = dom.window.document;
    const anchor = doc.querySelector('#cite_ref-1 a');
    assert.deepEqual(extractBookIdentifiers(anchor, doc), [ISBN]);
});

// ---------------------------------------------------------------------------
// Open Library: catalog resolution
// ---------------------------------------------------------------------------

test('catalog lookup addresses only the side-effect-free Books API', () => {
    const url = buildCatalogLookupUrl(ISBN);
    assert.equal(
        url,
        'https://openlibrary.org/api/books?bibkeys=ISBN%3A9780140328721&jscmd=data&format=json'
    );
    // The /isbn/{isbn}.json endpoint can import-on-miss; the resolve lane
    // must never address it.
    assert.ok(!url.includes('openlibrary.org/isbn/'));
});

test('parseCatalogLookup reads the jscmd=data shape', () => {
    const edition = parseCatalogLookup(ISBN, CATALOG_HIT);
    assert.equal(edition.key, '/books/OL7826547M');
    assert.equal(edition.recordUrl, 'https://openlibrary.org/books/OL7826547M/Matilda');
    assert.equal(edition.title, 'Matilda');
    assert.deepEqual(edition.authors, ['Roald Dahl']);
    assert.deepEqual(edition.publishers, ['Puffin']);
    assert.equal(edition.publishDate, 'October 1, 1988');
    assert.equal(edition.numberOfPages, 240);
    assert.deepEqual(edition.isbn13, ['9780140328721']);
    assert.deepEqual(edition.subjects, ['School stories']);
    assert.equal(edition.coverUrl, 'https://covers.openlibrary.org/b/id/8314135-L.jpg');
});

test('parseCatalogLookup miss is null and never a create', () => {
    assert.equal(parseCatalogLookup(ISBN, {}), null);
    assert.equal(parseCatalogLookup(ISBN, null), null);
    assert.equal(parseCatalogLookup(ISBN, { 'ISBN:0000000000': {} }), null);
});

test('parseCatalogLookup tolerates a thin record', () => {
    const edition = parseCatalogLookup(ISBN, { 'ISBN:9780140328721': { title: 'Matilda' } });
    assert.equal(edition.title, 'Matilda');
    assert.deepEqual(edition.authors, []);
    assert.equal(edition.numberOfPages, null);
});

// ---------------------------------------------------------------------------
// Open Library: scan availability
// ---------------------------------------------------------------------------

test('scan availability request uses the brief Read API', () => {
    assert.equal(
        buildScanAvailabilityUrl(ISBN),
        'https://openlibrary.org/api/volumes/brief/isbn/9780140328721.json'
    );
    assert.equal(
        buildScanAvailabilityUrl(normalizeOlid('7030731M')),
        'https://openlibrary.org/api/volumes/brief/olid/OL7030731M.json'
    );
});

test('scan items partition by match and only exact grounds', () => {
    const availability = parseScanAvailability({
        records: { '/books/OL7826547M': {} },
        items: [
            { match: 'similar', status: 'lendable', itemURL: 'https://archive.org/details/matilda00dahl_1' },
            { match: 'exact', status: 'full access', itemURL: 'https://archive.org/details/matilda00dahl', 'ol-edition-id': 'OL7826547M' },
        ],
    });
    assert.equal(availability.exact.length, 1);
    assert.equal(availability.similar.length, 1);
    const scan = groundableScan(availability);
    assert.equal(scan.ocaid, 'matilda00dahl');
    assert.equal(scan.olEditionId, 'OL7826547M');
});

test('ocaid is recovered from the records arm when itemURL is a /borrow link', () => {
    // Live drift: exact-match items now carry an openlibrary.org /borrow
    // itemURL rather than archive.org/details/<ocaid>.
    const availability = parseScanAvailability({
        records: {
            '/books/OL34854896M': {
                data: { ebooks: [{ preview_url: 'https://archive.org/details/wessexbkpeopleon0000robi' }] },
                details: { details: { ocaid: 'wessexbkpeopleon0000robi' } },
            },
        },
        items: [{
            match: 'exact',
            status: 'lendable',
            fromRecord: '/books/OL34854896M',
            itemURL: 'http://openlibrary.org/books/OL43436388M/Wessex/borrow',
        }],
    });
    assert.equal(groundableScan(availability).ocaid, 'wessexbkpeopleon0000robi');
});

test('a sole ocaid-bearing record is the fallback, but ambiguity is not', () => {
    const sole = parseScanAvailability({
        records: { '/books/OL1M': { details: { details: { ocaid: 'soleitem0001' } } } },
        items: [{ match: 'exact', status: 'lendable', itemURL: 'http://openlibrary.org/books/OL2M/X/borrow' }],
    });
    assert.equal(groundableScan(sole).ocaid, 'soleitem0001');

    const ambiguous = parseScanAvailability({
        records: {
            '/books/OL1M': { details: { details: { ocaid: 'firstitem001' } } },
            '/books/OL2M': { details: { details: { ocaid: 'seconditem02' } } },
        },
        items: [{ match: 'exact', status: 'lendable', itemURL: 'http://openlibrary.org/books/OL3M/X/borrow' }],
    });
    assert.equal(groundableScan(ambiguous), null, 'two candidate scans must not be guessed between');
});

test('groundableScan prefers full access, and needs a recoverable ocaid', () => {
    // IA's fulltext endpoint 403s lendable (print-disabled) items, so a
    // full-access exact scan wins regardless of order.
    const byStatus = parseScanAvailability({
        items: [
            { match: 'exact', status: 'lendable', itemURL: 'https://archive.org/details/lendable0001' },
            { match: 'exact', status: 'full access', itemURL: 'https://archive.org/details/fullaccess01' },
        ],
    });
    assert.equal(groundableScan(byStatus).ocaid, 'fullaccess01');

    // But a usable ocaid beats better status: an item whose scan identity
    // could not be recovered cannot ground at all.
    const byUsability = parseScanAvailability({
        items: [
            { match: 'exact', status: 'full access', itemURL: 'http://openlibrary.org/books/OL1M/X/borrow' },
            { match: 'exact', status: 'lendable', itemURL: 'https://archive.org/details/usable0001' },
        ],
    });
    assert.equal(groundableScan(byUsability).ocaid, 'usable0001');

    const none = parseScanAvailability({
        items: [{ match: 'exact', status: 'full access', itemURL: 'http://openlibrary.org/books/OL1M/X/borrow' }],
    });
    assert.equal(none.exact.length, 1, 'still reported as exact');
    assert.equal(groundableScan(none), null, 'but never groundable without a scan identity');
});

test('similar-edition scans never ground', () => {
    const availability = parseScanAvailability({
        items: [{ match: 'similar', status: 'lendable', itemURL: 'https://archive.org/details/other-edition' }],
    });
    assert.equal(groundableScan(availability), null);
    assert.equal(availability.similar.length, 1);
});

test('empty items means no scan, not no record', () => {
    assert.deepEqual(parseScanAvailability({ records: {}, items: [] }), { exact: [], similar: [] });
    assert.deepEqual(parseScanAvailability({}), { exact: [], similar: [] });
    assert.equal(parseScanAvailability(null), null, 'an unparseable body is unknown');
});

// ---------------------------------------------------------------------------
// Open Library: resolve lane
// ---------------------------------------------------------------------------

test('resolveBookSource returns the edition and its scan availability', async () => {
    const { getJson } = stubTransport([ok(CATALOG_HIT), ok(READ_API_EXACT)]);
    const outcome = await resolveBookSource([ISBN], { getJson });
    assert.equal(outcome.kind, 'resolved');
    assert.deepEqual(outcome.identifier, ISBN);
    assert.equal(outcome.edition.title, 'Matilda');
    assert.equal(groundableScan(outcome.scan).ocaid, 'matilda00dahl');
});

test('resolveBookSource tries identifiers in order until a hit', async () => {
    const oclc = normalizeOclc('12345678');
    const { getJson } = stubTransport([
        ok({}),                                  // isbn: clean miss
        ok({ 'OCLC:12345678': { title: 'Matilda' } }),
        ok({ items: [] }),
    ]);
    const outcome = await resolveBookSource([ISBN, oclc], { getJson });
    assert.equal(outcome.kind, 'resolved');
    assert.deepEqual(outcome.identifier, oclc);
    assert.deepEqual(outcome.scan, { exact: [], similar: [] });
});

test('resolveBookSource distinguishes a clean miss from a failed lookup', async () => {
    const miss = await resolveBookSource([ISBN], { getJson: stubTransport([ok({})]).getJson });
    assert.equal(miss.kind, 'not_found');

    const thrown = await resolveBookSource([ISBN], {
        getJson: stubTransport([new Error('connection reset')]).getJson,
    });
    assert.equal(thrown.kind, 'lookup_failed');
    assert.match(thrown.message, /connection reset/);

    const http503 = await resolveBookSource([ISBN], {
        getJson: stubTransport([{ status: 503, data: null }]).getJson,
    });
    assert.equal(http503.kind, 'lookup_failed');
    assert.match(http503.message, /503/);

    // A 2xx body that is not JSON is a failure, not a miss: "not_found" is
    // reserved for a clean catalog answer with no record under our bibkey.
    const garbage = await resolveBookSource([ISBN], {
        getJson: stubTransport([{ status: 200, data: null }]).getJson,
    });
    assert.equal(garbage.kind, 'lookup_failed');
});

test('resolveBookSource degrades to unknown scan when availability fails', async () => {
    const { getJson } = stubTransport([ok(CATALOG_HIT), new Error('read api down')]);
    const outcome = await resolveBookSource([ISBN], { getJson });
    assert.equal(outcome.kind, 'resolved');
    assert.equal(outcome.scan, null, 'unknown (null), not absent (empty)');
});

test('resolveBookSource addresses only the two read endpoints', async () => {
    const { getJson, urls } = stubTransport([ok({}), ok(CATALOG_HIT), ok(READ_API_EXACT)]);
    assert.equal((await resolveBookSource([ISBN], { getJson })).kind, 'not_found');
    assert.equal((await resolveBookSource([ISBN], { getJson })).kind, 'resolved');
    assert.equal(urls.length, 3, 'a miss issues one read and no follow-up');
    for (const url of urls) {
        assert.ok(
            url.startsWith('https://openlibrary.org/api/books?')
            || url.startsWith('https://openlibrary.org/api/volumes/brief/'),
            `unexpected endpoint: ${url}`
        );
        assert.ok(!url.startsWith('https://openlibrary.org/isbn/'), `import path hit: ${url}`);
    }
});

// ---------------------------------------------------------------------------
// Internet Archive: search inside
// ---------------------------------------------------------------------------

test('extractOcaid accepts the archive.org item URL forms', () => {
    assert.equal(extractOcaid('https://archive.org/details/matilda00dahl'), 'matilda00dahl');
    assert.equal(extractOcaid('https://archive.org/details/matilda00dahl/page/8'), 'matilda00dahl');
    // The live Read API still reports full-access items with the older
    // /stream/ path on the www host.
    assert.equal(extractOcaid('http://www.archive.org/stream/onoriginofspeci00darw'), 'onoriginofspeci00darw');
    assert.equal(extractOcaid('https://example.org/details/x'), null);
    assert.equal(extractOcaid('https://archive.org/download/x'), null);
    assert.equal(extractOcaid('not a url'), null);
});

test('item metadata designates the search server and gates on text items', () => {
    assert.equal(buildItemMetadataUrl('matilda00dahl'), 'https://archive.org/metadata/matilda00dahl');
    const location = parseItemMetadata(ITEM_METADATA);
    assert.equal(location.server, 'ia800300.us.archive.org');
    assert.equal(location.dir, '/12/items/matilda00dahl');
    assert.equal(location.isTextItem, true);
    assert.equal(
        parseItemMetadata({ server: 's', dir: '/d', metadata: { mediatype: 'movies' } }).isTextItem,
        false
    );
    assert.equal(parseItemMetadata({}), null);
});

test('search request targets the designated server', () => {
    const location = { server: 'ia800300.us.archive.org', dir: '/12/items/matilda00dahl', isTextItem: true };
    const url = buildSearchInsideUrl(location, 'matilda00dahl', 'good loving');
    assert.ok(url.startsWith('https://ia800300.us.archive.org/fulltext/inside.php?'));
    assert.ok(url.includes('item_id=matilda00dahl'));
    assert.ok(url.includes('path=%2F12%2Fitems%2Fmatilda00dahl'));
    assert.ok(url.includes('q=good+loving'));
    assert.equal(buildSearchInsideUrl({ ...location, server: 'not a host' }, 'x', 'q'), null);
});

test('parseSearchInside strips both highlight marker formats and reads pages', () => {
    const result = parseSearchInside(SEARCH_HITS);
    assert.equal(result.indexed, true);
    assert.equal(result.matches[0].text, 'Matilda longed for her parents to be good and loving.');
    assert.equal(result.matches[0].page, 42);

    // The live API returns <IA_FTS_MATCH> tags, not the {{{...}}} form.
    // Leaving them in would put markup into the "verbatim" OCR body.
    const live = parseSearchInside({
        indexed: true,
        matches: [{ text: 'the origin of <IA_FTS_MATCH>species</IA_FTS_MATCH> by means', par: [{ page: 8 }] }],
    });
    assert.equal(live.matches[0].text, 'the origin of species by means');

    assert.equal(parseSearchInside({ indexed: false }).indexed, false);
    assert.equal(parseSearchInside(null), null);
});

test('searchQuery takes distinct longer words in claim order', () => {
    assert.equal(
        searchQuery('Matilda longed for her parents to be good and loving.'),
        'Matilda longed parents loving'
    );
    assert.equal(searchQuery('The cat sat down'), 'down', 'falls back to the 4-char floor');
    assert.equal(searchQuery('a b c'), 'a b c', 'then to the raw claim');
});

test('searchQueryLadder narrows until a single distinctive term remains', () => {
    // The load-bearing safety property: one word missing from a scan's OCR
    // index zeroes the whole query, so "no matches" must not be concluded
    // from a wide query alone.
    assert.deepEqual(
        searchQueryLadder('Natural selection acts by the preservation of slight favourable variations.'),
        [
            'Natural selection preservation slight favourable variations',
            'preservation favourable variations',
            'preservation',
        ]
    );
    // A claim with few long words collapses to fewer distinct rungs.
    assert.deepEqual(searchQueryLadder('The cat sat down'), ['down']);
});

test('the query ladder rescues a claim whose wide query returns nothing', async () => {
    const { getJson, urls } = stubTransport([
        ok(ITEM_METADATA),
        ok({ indexed: true, matches: [] }),                                   // 6 terms: poisoned
        ok({ indexed: true, matches: [] }),                                   // 3 terms: still poisoned
        ok({ indexed: true, matches: [{ text: 'the preservation of favoured races', par: [{ page: 3 }] }] }),
    ]);
    const prep = await prepareBookGrounding({ getJson },
        'x', 'Natural selection acts by the preservation of slight favourable variations.', null);
    assert.equal(prep.kind, 'body');
    assert.equal(prep.query, 'preservation', 'the narrowest rung is what produced the body');
    assert.equal(urls.length, 4);
});

test('no_matches is only reached after every rung comes back empty', async () => {
    const { getJson, urls } = stubTransport([
        ok(ITEM_METADATA),
        ok({ indexed: true, matches: [] }),
        ok({ indexed: true, matches: [] }),
        ok({ indexed: true, matches: [] }),
    ]);
    const prep = await prepareBookGrounding({ getJson },
        'x', 'Natural selection acts by the preservation of slight favourable variations.', null);
    assert.equal(prep.kind, 'no_matches');
    assert.equal(prep.query, 'preservation');
    assert.equal(urls.length, 4);
});

test('scanDeepLink anchors the page and highlights the query', () => {
    assert.equal(
        scanDeepLink('matilda00dahl', 42, 'good loving'),
        'https://archive.org/details/matilda00dahl/page/42?q=good+loving'
    );
    assert.equal(scanDeepLink('matilda00dahl', null, 'good'), 'https://archive.org/details/matilda00dahl?q=good');
});

test('leadingPageNumber reads the first number of a cited page range', () => {
    assert.equal(leadingPageNumber('42'), 42);
    assert.equal(leadingPageNumber('42–45'), 42);
    assert.equal(leadingPageNumber(' 42, 44'), 42);
    assert.equal(leadingPageNumber('xiv'), null, 'roman numerals fall through to the whole-book pass');
    assert.equal(leadingPageNumber(null), null);
    assert.equal(leadingPageNumber(42), 42, 'an already-numeric cited page passes through');
});

// ---------------------------------------------------------------------------
// Grounding preparation
// ---------------------------------------------------------------------------

test('grounding selects the cited page first', async () => {
    const { getJson } = stubTransport([ok(ITEM_METADATA), ok(SEARCH_HITS)]);
    const prep = await prepareBookGrounding({ getJson }, 'matilda00dahl',
        'Matilda longed for her parents to be good and loving.', '42');
    assert.equal(prep.kind, 'body');
    assert.equal(prep.citedPageHit, true);
    assert.equal(prep.matches.length, 1, 'only the cited-page match');
    assert.equal(prep.matches[0].page, 42);
    assert.ok(prep.text.includes('good and loving'));
});

test('grounding falls back to the whole book on a cited-page miss', async () => {
    const { getJson } = stubTransport([ok(ITEM_METADATA), ok(SEARCH_HITS)]);
    const prep = await prepareBookGrounding({ getJson }, 'matilda00dahl',
        'Matilda longed for her parents to be good and loving.', '99');
    assert.equal(prep.kind, 'body');
    assert.equal(prep.citedPageHit, false, 'pagination mismatch is recorded, not hidden');
    assert.equal(prep.matches.length, 2);
});

test('an indexed scan with zero matches is no_matches, not unusable', async () => {
    // The load-bearing semantic split: searched-and-found-nothing is a
    // statement about the book, so it must reach the reader as
    // "not supported", never as "we could not read the source".
    const { getJson } = stubTransport([ok(ITEM_METADATA), ok({ indexed: true, matches: [] })]);
    const prep = await prepareBookGrounding({ getJson }, 'matilda00dahl', 'claim text here', null);
    assert.equal(prep.kind, 'no_matches');
    assert.ok(prep.deepLink.startsWith('https://archive.org/details/matilda00dahl?q='));
});

test('a non-text item and a missing index are both no_usable_body', async () => {
    const movie = { server: 's.archive.org', dir: '/d', metadata: { mediatype: 'movies' } };
    const notText = await prepareBookGrounding(
        { getJson: stubTransport([ok(movie)]).getJson }, 'x', 'claim text here', null);
    assert.equal(notText.kind, 'no_usable_body');
    assert.equal(notText.detail, 'not a text item');

    const noIndex = await prepareBookGrounding(
        { getJson: stubTransport([ok(ITEM_METADATA), ok({ indexed: false })]).getJson },
        'x', 'claim text here', null);
    assert.equal(noIndex.kind, 'no_usable_body');
    assert.equal(noIndex.detail, 'no full-text index');
});

test('a 403 on a lending-restricted scan is unreachable', async () => {
    // Print-disabled items 403 the fulltext endpoint; that is a failure to
    // read, not a statement that the book lacks the passage.
    const { getJson } = stubTransport([ok(ITEM_METADATA), { status: 403, data: null }]);
    const prep = await prepareBookGrounding({ getJson }, 'x', 'claim text here', null);
    assert.equal(prep.kind, 'unreachable');
    assert.match(prep.message, /403/);
    assert.match(prep.message, /lending-restricted/, 'the common case names itself');
});

test('a transport failure is unreachable', async () => {
    const { getJson } = stubTransport([new Error('archive.org unreachable')]);
    const prep = await prepareBookGrounding({ getJson }, 'x', 'claim text here', null);
    assert.equal(prep.kind, 'unreachable');
    assert.match(prep.message, /archive.org unreachable/);
});

// ---------------------------------------------------------------------------
// Top-level: fetchBookSourceContent
// ---------------------------------------------------------------------------

test('fetchBookSourceContent assembles a body the existing verifier can judge', async () => {
    const { getJson } = stubTransport([
        ok(CATALOG_HIT), ok(READ_API_EXACT), ok(ITEM_METADATA), ok(SEARCH_HITS),
    ]);
    const result = await fetchBookSourceContent(
        [ISBN], 'Matilda longed for her parents to be good and loving.', 42, { getJson });

    assert.equal(result.error, null);
    assert.equal(result.bookOutcome, 'body');
    // The shape core/prompts.js parses: everything the model sees lives
    // after the "Source Content:" marker.
    assert.ok(result.content.startsWith('Source URL: '));
    const body = result.content.split('Source Content:\n')[1];
    assert.ok(body.includes('Matilda'), 'book context reaches the model');
    assert.ok(body.includes('page 42'), 'page provenance reaches the model');
    assert.ok(
        body.includes('Matilda longed for her parents to be good and loving.'),
        'the OCR snippet is verbatim and quotable'
    );
    assert.ok(!body.includes('{{{'), 'no highlight markers survive into the body');
    assert.equal(result.deepLink, 'https://archive.org/details/matilda00dahl/page/42?q=Matilda+longed+parents+loving');
});

test('fetchBookSourceContent reports searched-but-nothing-found as not supported', async () => {
    const { getJson } = stubTransport([
        ok(CATALOG_HIT), ok(READ_API_EXACT), ok(ITEM_METADATA),
        // Every rung of the query ladder, all empty.
        ok({ indexed: true, matches: [] }), ok({ indexed: true, matches: [] }),
    ]);
    const result = await fetchBookSourceContent([ISBN], 'A claim the book never makes', null, { getJson });
    assert.equal(result.content, null);
    assert.equal(result.bookOutcome, 'no_matches');
    assert.deepEqual(result.verdict, {
        verdict: 'NOT SUPPORTED',
        reason_type: 'omission',
        // Non-zero on purpose: confidence 0 is this codebase's sentinel for
        // SOURCE UNAVAILABLE, which is precisely what this outcome is not.
        confidence: 15,
        source_quote: '',
        comments: result.verdict.comments,
    });
    assert.match(result.verdict.comments, /full-text search/i);
});

test('fetchBookSourceContent reports unreadable scans as source unavailable', async () => {
    // No catalog record at all.
    const notFound = await fetchBookSourceContent([ISBN], 'claim', null, {
        getJson: stubTransport([ok({})]).getJson,
    });
    assert.equal(notFound.content, null);
    assert.equal(notFound.bookOutcome, 'not_found');
    assert.equal(notFound.verdict, null, 'no synthesized verdict — the source was never read');

    // Record exists but only a different edition is scanned.
    const similarOnly = await fetchBookSourceContent([ISBN], 'claim', null, {
        getJson: stubTransport([
            ok(CATALOG_HIT),
            ok({ items: [{ match: 'similar', status: 'lendable', itemURL: 'https://archive.org/details/other' }] }),
        ]).getJson,
    });
    assert.equal(similarOnly.content, null);
    assert.equal(similarOnly.bookOutcome, 'no_groundable_scan');
    assert.match(similarOnly.error, /no exact-edition scan/i);
});

test('fetchBookSourceContent needs at least one valid identifier', async () => {
    const result = await fetchBookSourceContent([], 'claim', null, { getJson: async () => ok({}) });
    assert.equal(result.content, null);
    assert.equal(result.bookOutcome, 'no_identifiers');
});
