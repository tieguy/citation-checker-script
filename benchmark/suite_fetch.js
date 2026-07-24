// Fetch and freeze the on-wiki benchmark suite.
//
// Separated from suite.js so that module stays pure (string in, objects out,
// no I/O) the way core/claim.js and core/verdicts.js are.
//
// WHY RAW WIKITEXT, NOT RENDERED HTML: an oldid reproduces a page's *source*
// exactly, but not its historical *rendering* — the row template it transcludes
// may have changed since. Freezing source is therefore the only representation
// that actually reproduces.

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { parseSuite } from './suite.js';

export const SUITE_PAGE_TITLE = 'User:Alaexis/AI Source Verification/Benchmark';
export const SUITE_WIKI_HOST = 'en.wikipedia.org';

// Wikimedia's User-Agent policy requires automated requests to identify the tool
// and offer a contact route. https://meta.wikimedia.org/wiki/User-Agent_policy
export const SUITE_USER_AGENT =
    'citation-checker-script benchmark suite fetcher '
    + '(https://github.com/alex-o-748/citation-checker-script)';

const FETCH_TIMEOUT_MS = 30000;

export function buildRawUrl(oldid, { title = SUITE_PAGE_TITLE, host = SUITE_WIKI_HOST } = {}) {
    if (!/^\d+$/.test(String(oldid))) {
        throw new Error(`suite oldid must be a numeric revision id, got: ${oldid}`);
    }
    const params = new URLSearchParams({
        title: title.replace(/ /g, '_'),
        oldid: String(oldid),
        action: 'raw',
    });
    return `https://${host}/w/index.php?${params}`;
}

export function fetchRawWikitext(oldid, options = {}) {
    const url = buildRawUrl(oldid, options);

    return new Promise((resolve, reject) => {
        const request = https.get(url, {
            headers: { 'User-Agent': SUITE_USER_AGENT, 'Accept': 'text/plain' },
        }, (response) => {
            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error(`suite fetch failed: HTTP ${response.statusCode} for ${url}`));
                return;
            }
            response.setEncoding('utf8');
            let data = '';
            response.on('data', chunk => { data += chunk; });
            response.on('end', () => resolve(data));
        });

        request.on('error', reject);
        request.setTimeout(FETCH_TIMEOUT_MS, () => {
            request.destroy();
            reject(new Error(`suite fetch timed out after ${FETCH_TIMEOUT_MS}ms: ${url}`));
        });
    });
}

export function snapshotPaths(dir, oldid) {
    return {
        wikitextPath: path.join(dir, `${oldid}.wikitext`),
        jsonPath: path.join(dir, `${oldid}.json`),
    };
}

export function hasSnapshot(dir, oldid) {
    const { wikitextPath, jsonPath } = snapshotPaths(dir, oldid);
    return fs.existsSync(wikitextPath) && fs.existsSync(jsonPath);
}

/**
 * Freeze a suite revision. The wikitext is written byte-exact — no trimming, no
 * newline normalization — because it is the reproducibility artifact and any
 * rewriting would make the snapshot diverge from what the page actually said.
 */
export function writeSnapshot(dir, oldid, wikitext, parsed, extraMetadata = {}) {
    fs.mkdirSync(dir, { recursive: true });
    const { wikitextPath, jsonPath } = snapshotPaths(dir, oldid);

    fs.writeFileSync(wikitextPath, wikitext, 'utf-8');
    fs.writeFileSync(jsonPath, JSON.stringify({
        metadata: {
            suite_page: SUITE_PAGE_TITLE,
            suite_oldid: Number(oldid),
            suite_url: buildRawUrl(oldid),
            row_count: parsed.rows.length,
            ...extraMetadata,
        },
        rows: parsed.rows,
    }, null, 2) + '\n', 'utf-8');
}

export function readSnapshot(dir, oldid) {
    const { wikitextPath, jsonPath } = snapshotPaths(dir, oldid);
    if (!hasSnapshot(dir, oldid)) {
        throw new Error(`no snapshot for suite revision ${oldid} in ${dir}`);
    }
    const stored = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    return {
        wikitext: fs.readFileSync(wikitextPath, 'utf-8'),
        metadata: stored.metadata,
        rows: stored.rows,
    };
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SUITE_PINS_PATH = path.join(MODULE_DIR, 'suite-pins.json');
export const SUITE_SNAPSHOT_DIR = path.join(MODULE_DIR, 'suites');

export function loadPins(pinsPath = SUITE_PINS_PATH) {
    if (!fs.existsSync(pinsPath)) return {};
    return JSON.parse(fs.readFileSync(pinsPath, 'utf-8')).pins ?? {};
}

/**
 * Resolve `--suite-oldid` to a numeric revision. Accepts either a bare revision
 * id or a name from suite-pins.json, so callers can say `v1` without looking up
 * which revision that was.
 */
export function resolveSuiteRef(ref, pins = loadPins()) {
    if (/^\d+$/.test(String(ref))) return Number(ref);

    const names = Object.keys(pins);
    if (names.length === 0) {
        throw new Error(
            `cannot resolve suite pin "${ref}": no pins are defined yet in suite-pins.json. `
            + 'Pass a numeric revision id instead.');
    }
    if (!(ref in pins)) {
        throw new Error(`unknown suite pin "${ref}". Available pins: ${names.join(', ')}`);
    }
    return Number(pins[ref]);
}

/**
 * Resolve a suite revision to validated rows.
 *
 * On a cache miss: fetch, validate, and only then freeze. An invalid suite is
 * never written to disk — freezing it would make the corruption reproducible,
 * which is the opposite of the point.
 *
 * On a cache hit: re-parse the stored wikitext rather than trusting the stored
 * rows. The wikitext is the artifact of record; the JSON is a convenience
 * derivation, and re-deriving it means a validator improvement applies to
 * existing snapshots for free.
 */
export async function loadSuite(ref, {
    dir = SUITE_SNAPSHOT_DIR,
    pins = undefined,
    offline = false,
    fetchFn = fetchRawWikitext,
    fetchedAt = undefined,
} = {}) {
    const oldid = resolveSuiteRef(ref, pins ?? loadPins());

    if (hasSnapshot(dir, oldid)) {
        const snapshot = readSnapshot(dir, oldid);
        const { rows } = parseSuite(snapshot.wikitext);
        return { oldid, rows, wikitext: snapshot.wikitext, metadata: snapshot.metadata, fromSnapshot: true };
    }

    if (offline) {
        throw new Error(
            `no snapshot for suite revision ${oldid} in ${dir} and offline mode is set. `
            + 'Run once with network access to freeze it.');
    }

    const wikitext = await fetchFn(oldid);
    const parsed = parseSuite(wikitext);

    writeSnapshot(dir, oldid, wikitext, parsed, {
        fetched_at: fetchedAt ?? new Date().toISOString().slice(0, 10),
    });

    const snapshot = readSnapshot(dir, oldid);
    return { oldid, rows: parsed.rows, wikitext, metadata: snapshot.metadata, fromSnapshot: false };
}
