// Entry point for the `ccs` CLI. Owns argv parsing, Wikipedia REST
// fetching, JSDOM parsing, dispatch into core/, exit-code classification,
// and stdout formatting. core/ owns the pure logic; this file is the only
// place that does I/O.

import { parseArgs } from 'node:util';
import { JSDOM } from 'jsdom';
import { extractClaimText } from '../core/claim.js';
import { extractReferenceUrl, extractPageNumber } from '../core/urls.js';
import { verify, fetchSourceContent, logVerification } from '../core/worker.js';
import { PROVIDERS } from '../core/providers.js';
import { augmentWithCitoidStructured } from '../core/citoid.js';


export function parseCliArgs(argv) {
    const raw = argv.slice(2);

    if (raw.length === 0) {
        return { help: true };
    }

    const { values, positionals } = parseArgs({
        args: raw,
        options: {
            provider:           { type: 'string', default: 'hf-qwen3-32b' },
            'no-log':           { type: 'boolean', default: false },
            atomized:           { type: 'boolean', default: true },
            'no-atomized':      { type: 'boolean', default: false },
            'rollup-mode':      { type: 'string', default: 'deterministic' },
            'use-small-atomizer': { type: 'boolean', default: false },
            help:               { type: 'boolean', short: 'h', default: false },
        },
        allowPositionals: true,
        strict: true,
    });

    if (values.help) {
        return { help: true };
    }

    const subcommand = positionals[0];
    if (!subcommand) {
        return { help: true };
    }
    if (subcommand !== 'verify') {
        throw new UsageError(`unknown subcommand: ${subcommand}`);
    }

    const url = positionals[1];
    const citationStr = positionals[2];
    if (!url || !citationStr) {
        throw new UsageError('usage: ccs verify <wikipedia-url> <citation-number> [--provider <name>] [--no-log]');
    }

    const citationNumber = Number(citationStr);
    if (!Number.isInteger(citationNumber) || citationNumber < 1) {
        throw new UsageError(`citation number must be a positive integer (got: ${citationStr})`);
    }

    const provider = values.provider;

    return {
        help: false,
        subcommand: 'verify',
        url,
        citationNumber,
        provider,
        noLog: values['no-log'],
        atomized: values['no-atomized'] ? false : values.atomized,
        rollupMode: values['rollup-mode'],
        useSmallAtomizer: values['use-small-atomizer'],
    };
}

export class UsageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UsageError';
    }
}

export function parseWikiUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new UsageError(`invalid URL: ${rawUrl}`);
    }

    if (parsed.hostname !== 'en.wikipedia.org') {
        throw new UsageError(`URL must be an en.wikipedia.org article URL (got host: ${parsed.hostname})`);
    }

    if (!parsed.pathname.startsWith('/wiki/')) {
        throw new UsageError(`URL must be the /wiki/<title> form (got path: ${parsed.pathname})`);
    }

    const encodedTitle = parsed.pathname.slice('/wiki/'.length);
    if (!encodedTitle) {
        throw new UsageError(`could not extract article title from URL: ${rawUrl}`);
    }

    const title = decodeURIComponent(encodedTitle);
    const oldid = parsed.searchParams.get('oldid');

    return { title, oldid };
}

export function deriveRestUrl({ title, oldid }) {
    // encodeURIComponent percent-encodes '/' but leaves '(' ')' alone —
    // both desirable for the REST API path segment.
    const encodedTitle = encodeURIComponent(title);
    const base = `https://en.wikipedia.org/api/rest_v1/page/html/${encodedTitle}`;
    return oldid ? `${base}/${oldid}` : base;
}

export function findReferenceByCitationNumber(document, citationNumber) {
    const target = `[${citationNumber}]`;
    const refs = document.querySelectorAll('sup.reference');
    for (const ref of refs) {
        if (ref.textContent.replace(/\s+/g, '') === target) {
            return ref;
        }
    }
    return null;
}



export const HELP_TEXT = `usage: ccs verify <wikipedia-url> <citation-number> [options]

Verify a Wikipedia citation by fetching its source and asking an LLM
whether the cited claim is supported.

Arguments:
  <wikipedia-url>    An https://en.wikipedia.org/wiki/<Title> URL.
                     Optional ?oldid=<rev> query param pins a revision.
  <citation-number>  The [N] bracketed reference number as it appears
                     in the rendered article (positive integer).

Options:
  --provider <name>  LLM provider to use. One of:
                       huggingface (default; routed via the worker proxy,
                                    no API key needed; set HF_API_KEY to
                                    call HF directly and unlock any
                                    HF-hosted model)
                       publicai    (routed via the worker proxy,
                                    no API key needed)
                       claude      (requires CLAUDE_API_KEY)
                       gemini      (requires GEMINI_API_KEY)
                       openai      (requires OPENAI_API_KEY)
  --no-log           Do not log the verification to the worker proxy's
                     /log endpoint.
  --atomized         Use the atomized verification pipeline (default).
  --no-atomized      Use the legacy single-pass path.
  --rollup-mode MODE 'deterministic' (default) or 'judge'.
  --use-small-atomizer
                     Use providerConfig.smallModel for atomize() call.
  --help, -h         Show this help and exit.

Exit codes:
  0   success
  2   bad command-line arguments
  3   Wikipedia article not found (404)
  4   Wikipedia fetch failed (5xx or network error)
  5   citation number not present in article
  6   citation has no fetchable source URL
  7   source unavailable (fetch returned empty or the URL was unfetchable)
  8   required API key environment variable is missing
  9   provider returned a 4xx (auth error, rate limit, bad request)
  10  provider returned a 5xx or network error
  11  LLM returned malformed JSON

Examples:
  ccs verify https://en.wikipedia.org/wiki/Great_Migration_(African_American) 14
  ccs verify https://en.wikipedia.org/wiki/Foo 3 --provider claude
  ccs verify https://en.wikipedia.org/wiki/Foo?oldid=1234567 3 --no-log
`;

async function fetchWikipediaHtml(restUrl) {
    const response = await fetch(restUrl, {
        headers: {
            'User-Agent': 'ccs-cli (https://github.com/alex-o-748/citation-checker-script)',
            'Accept': 'text/html',
        },
    });

    if (response.status === 404) {
        const err = new Error(`Wikipedia article not found (404): ${restUrl}`);
        err.exitCode = 3;
        throw err;
    }
    if (!response.ok) {
        const err = new Error(`Wikipedia fetch failed (${response.status}): ${restUrl}`);
        err.exitCode = 4;
        throw err;
    }
    return await response.text();
}

export async function runVerify(opts, { stdout = process.stdout, stderr = process.stderr, env = process.env } = {}) {
    const { url, citationNumber, provider, noLog, atomized, rollupMode, useSmallAtomizer } = opts;

    // 2. Parse the article URL and derive the REST URL.
    let parsedWikiUrl, restUrl;
    try {
        parsedWikiUrl = parseWikiUrl(url);
        restUrl = deriveRestUrl(parsedWikiUrl);
    } catch (err) {
        stderr.write(`ccs: ${err.message}\n`);
        return 2;
    }

    // 3. Fetch the article HTML.
    let html;
    try {
        html = await fetchWikipediaHtml(restUrl);
    } catch (err) {
        stderr.write(`ccs: ${err.message}\n`);
        return err.exitCode ?? 4;
    }

    // 4. Parse with JSDOM. The `url` option lets relative hrefs resolve.
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // 5. Locate the citation reference element.
    const refSup = findReferenceByCitationNumber(document, citationNumber);
    if (!refSup) {
        stderr.write(`ccs: no citation [${citationNumber}] found in article\n`);
        return 5;
    }
    const refAnchor = refSup.querySelector('a');
    if (!refAnchor) {
        stderr.write(`ccs: citation [${citationNumber}] has no anchor element\n`);
        return 5;
    }

    // 6. Extract the claim text.
    const claim = extractClaimText(refSup);
    if (!claim) {
        stderr.write(`ccs: could not extract claim text for citation [${citationNumber}]\n`);
        return 5;
    }

    // 7. Extract the source URL and page number. Phase 1 of this plan
    //    refactored core/urls.js to take `document` as an explicit param,
    //    so no global shim is needed.
    const sourceUrl = extractReferenceUrl(refAnchor, document);
    const pageNum = extractPageNumber(refAnchor, document);
    if (!sourceUrl) {
        stderr.write(`ccs: citation [${citationNumber}] has no fetchable URL\n`);
        return 6;
    }

    // 8. Check API key availability up-front (exit 8).
    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) {
        stderr.write(`ccs: unknown provider: ${provider}. Known: ${Object.keys(PROVIDERS).join(', ')}\n`);
        return 2;
    }
    const apiKey = providerConfig.keyEnv ? env[providerConfig.keyEnv] : undefined;
    if (providerConfig.requiresKey && !apiKey) {
        stderr.write(`ccs: missing API key: set ${providerConfig.keyEnv}\n`);
        return 8;
    }

    // 9. Fetch the source content via the worker proxy (raw, no augmentation yet).
    //    We defer Citoid augmentation so we can capture both the augmented text
    //    AND the structured metadata for the atomized path.
    const rawFetch = await fetchSourceContent(sourceUrl, pageNum, { augment: false });
    if (!rawFetch) {
        stderr.write(`ccs: source unavailable: ${sourceUrl}\n`);
        return 7;
    }
    if (typeof rawFetch === 'object' && rawFetch.sourceUnavailable) {
        // Body classifier flagged extracted content as structurally unusable
        // (Wayback chrome, JS-only skeleton, anti-bot challenge, etc.). The
        // verdict is pipeline-attributed; no LLM call needed.
        stderr.write(`ccs: source unavailable (${rawFetch.reason}): ${sourceUrl}\n`);
        return 7;
    }

    // 10. Augment with structured Citoid metadata.
    const { sourceText: augmentedText, metadata } = await augmentWithCitoidStructured(
        rawFetch,
        sourceUrl
    );

    // 11. Call the verify() dispatcher.
    const verifyOpts = {
        atomized,
        rollupMode,
        useSmallAtomizer,
    };
    let verifyResult;
    try {
        verifyResult = await verify(
            claim,
            augmentedText,
            metadata,
            { ...providerConfig, apiKey },
            verifyOpts
        );
    } catch (err) {
        stderr.write(`ccs: verification failed: ${err.message}\n`);
        return 10;
    }

    // Handle malformed verdicts from the atomized path
    if (verifyResult.verdict === 'ERROR' || verifyResult.verdict === 'PARSE_ERROR') {
        stderr.write(`ccs: LLM returned malformed JSON\n`);
        return 11;
    }

    // 12. Log (fire-and-forget).
    if (!noLog) {
        const articleTitle = parsedWikiUrl.title.replace(/_/g, ' ');
        logVerification({
            article_url: url,
            article_title: articleTitle,
            citation_number: String(citationNumber),
            source_url: sourceUrl,
            provider,
            verdict: verifyResult.verdict,
            confidence: verifyResult.confidence,
        });
    }

    // 13. Print the result.
    stdout.write(`Verdict:    ${verifyResult.verdict}\n`);
    stdout.write(`Confidence: ${verifyResult.confidence ?? 'n/a'}\n`);
    stdout.write(`Claim:      ${claim}\n`);
    stdout.write(`Source:     ${sourceUrl}\n`);
    stdout.write(`\n${verifyResult.comments}\n`);

    // If atomized, also print atoms and results
    if (atomized && verifyResult.atoms) {
        stdout.write(`\nAtomized Results (${verifyResult.atoms.length} atoms):\n`);
        verifyResult.atoms.forEach((atom, i) => {
            const result = verifyResult.atomResults?.[i];
            stdout.write(`  [${i + 1}] ${atom.assertion}\n`);
            if (result) {
                stdout.write(`      Verdict: ${result.verdict}\n`);
            }
        });
    }

    return 0;
}

export async function main(argv, { stdout = process.stdout, stderr = process.stderr, env = process.env } = {}) {
    let opts;
    try {
        opts = parseCliArgs(argv);
    } catch (err) {
        if (err instanceof UsageError) {
            stderr.write(`ccs: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    if (opts.help) {
        stdout.write(HELP_TEXT);
        return 0;
    }

    return await runVerify(opts, { stdout, stderr, env });
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main(process.argv).then((code) => process.exit(code));
}
