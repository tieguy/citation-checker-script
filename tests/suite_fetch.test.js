import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    buildRawUrl, SUITE_USER_AGENT, SUITE_PAGE_TITLE,
    snapshotPaths, writeSnapshot, readSnapshot, hasSnapshot,
    resolveSuiteRef, loadSuite,
} from '../benchmark/suite_fetch.js';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'suite-'));

test('buildRawUrl pins to an exact revision via action=raw', () => {
    const url = buildRawUrl(12345);
    assert.match(url, /^https:\/\/en\.wikipedia\.org\/w\/index\.php\?/);
    assert.match(url, /action=raw/);
    assert.match(url, /oldid=12345/);
    assert.match(url, /title=User%3AAlaexis/);
});

test('buildRawUrl rejects a non-numeric revision', () => {
    assert.throws(() => buildRawUrl('latest'), /numeric revision/i);
});

test('SUITE_USER_AGENT identifies the tool and a contact URL', () => {
    // Wikimedia's User-Agent policy requires an identifying agent for automated
    // requests. A spoofed browser string risks the whole project being blocked.
    assert.match(SUITE_USER_AGENT, /citation-checker/i);
    assert.match(SUITE_USER_AGENT, /https?:\/\//);
    assert.doesNotMatch(SUITE_USER_AGENT, /Mozilla/);
});

test('writeSnapshot stores wikitext byte-exact alongside parsed rows', () => {
    const dir = tmpDir();
    try {
        const wikitext = '{{Example|a=1}}\n\ntrailing space   \n';
        writeSnapshot(dir, 999, wikitext, { rows: [{ id: 'ctb-a1b2c3' }] }, { fetched_at: '2026-07-23' });

        const { wikitextPath, jsonPath } = snapshotPaths(dir, 999);
        assert.equal(fs.readFileSync(wikitextPath, 'utf-8'), wikitext);

        const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        assert.equal(meta.metadata.suite_oldid, 999);
        assert.equal(meta.metadata.fetched_at, '2026-07-23');
        assert.equal(meta.rows.length, 1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('readSnapshot round-trips exactly what writeSnapshot stored', () => {
    const dir = tmpDir();
    try {
        const wikitext = '{{Example|a=1}}\n';
        writeSnapshot(dir, 42, wikitext, { rows: [] }, {});
        assert.equal(hasSnapshot(dir, 42), true);
        assert.equal(readSnapshot(dir, 42).wikitext, wikitext);
        assert.equal(readSnapshot(dir, 42).metadata.suite_oldid, 42);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('hasSnapshot is false when only one of the two files exists', () => {
    const dir = tmpDir();
    try {
        fs.writeFileSync(snapshotPaths(dir, 7).wikitextPath, 'x');
        assert.equal(hasSnapshot(dir, 7), false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SUITE_PAGE_TITLE matches the page Phase 1 published', () => {
    assert.equal(SUITE_PAGE_TITLE, 'User:Alaexis/AI Source Verification/Benchmark');
});

test('resolveSuiteRef passes a bare revision id straight through', () => {
    const PINS = { v1: 1000, 'v1+v2': 2000, latest: 3000 };
    assert.equal(resolveSuiteRef('123456', PINS), 123456);
    assert.equal(resolveSuiteRef(123456, PINS), 123456);
});

test('resolveSuiteRef resolves a named pin', () => {
    const PINS = { v1: 1000, 'v1+v2': 2000, latest: 3000 };
    assert.equal(resolveSuiteRef('v1', PINS), 1000);
    assert.equal(resolveSuiteRef('v1+v2', PINS), 2000);
});

test('resolveSuiteRef lists the available pins when a name is unknown', () => {
    const PINS = { v1: 1000, 'v1+v2': 2000, latest: 3000 };
    assert.throws(() => resolveSuiteRef('v9', PINS), /unknown suite pin "v9"/);
    assert.throws(() => resolveSuiteRef('v9', PINS), /v1\+v2/);
});

test('resolveSuiteRef refuses an empty pins table with an actionable message', () => {
    assert.throws(() => resolveSuiteRef('v1', {}), /no pins are defined/i);
});

test('loadSuite fetches once, writes a snapshot, then never fetches again', async () => {
    const { SUITE_TEMPLATE_TITLE } = await import('../benchmark/suite.js');
    const validPage = `{{${SUITE_TEMPLATE_TITLE}
| id = ctb-a1b2c3
| wiki = enwiki
| article = Immigration to the United States
| oldid = 1331476438
| citation = 1
| instance = 1
| truth = Supported
}}`;

    const dir = tmpDir();
    try {
        let fetches = 0;
        const fetchFn = async () => { fetches++; return validPage; };

        const first = await loadSuite(111, { dir, fetchFn });
        assert.equal(fetches, 1);
        assert.equal(first.rows.length, 1);
        assert.equal(first.fromSnapshot, false);

        const second = await loadSuite(111, { dir, fetchFn });
        assert.equal(fetches, 1, 'second call must not hit the network');
        assert.equal(second.fromSnapshot, true);
        assert.deepEqual(second.rows, first.rows);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('loadSuite with offline:true refuses to fetch a missing snapshot', async () => {
    const { SUITE_TEMPLATE_TITLE } = await import('../benchmark/suite.js');
    const validPage = `{{${SUITE_TEMPLATE_TITLE}
| id = ctb-a1b2c3
| wiki = enwiki
| article = Immigration to the United States
| oldid = 1331476438
| citation = 1
| instance = 1
| truth = Supported
}}`;

    const dir = tmpDir();
    try {
        await assert.rejects(
            () => loadSuite(222, { dir, offline: true, fetchFn: async () => validPage }),
            /no snapshot/i,
        );
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('loadSuite does not write a snapshot when validation fails', async () => {
    const { SUITE_TEMPLATE_TITLE } = await import('../benchmark/suite.js');
    const dir = tmpDir();
    try {
        const bad = `{{${SUITE_TEMPLATE_TITLE}|id=ctb-a1b2c3|truth=Supported}}`;
        await assert.rejects(() => loadSuite(333, { dir, fetchFn: async () => bad }));
        assert.equal(hasSnapshot(dir, 333), false,
            'an invalid suite must not be frozen — it would reproduce the corruption');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('loadSuite re-parses stored wikitext rather than trusting stored rows', async () => {
    const { SUITE_TEMPLATE_TITLE } = await import('../benchmark/suite.js');
    const validPage = `{{${SUITE_TEMPLATE_TITLE}
| id = ctb-a1b2c3
| wiki = enwiki
| article = Immigration to the United States
| oldid = 1331476438
| citation = 1
| instance = 1
| truth = Supported
}}`;

    const dir = tmpDir();
    try {
        await loadSuite(444, { dir, fetchFn: async () => validPage });
        // Corrupt only the derived JSON. The wikitext is the source of record, so
        // the reload must reflect the wikitext, not the tampered rows.
        const { jsonPath } = snapshotPaths(dir, 444);
        const stored = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        stored.rows = [{ id: 'ctb-ffffff' }, { id: 'ctb-eeeeee' }];
        fs.writeFileSync(jsonPath, JSON.stringify(stored));

        const reloaded = await loadSuite(444, { dir, fetchFn: async () => { throw new Error('no fetch'); } });
        assert.equal(reloaded.rows.length, 1);
        assert.equal(reloaded.rows[0].id, 'ctb-a1b2c3');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
