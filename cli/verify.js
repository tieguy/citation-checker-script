// Entry point for the `ccs` CLI. Later phases add argv parsing, Wikipedia
// fetch, and the verification pipeline. For now this is a placeholder so
// `bin/ccs` can import something.

import { parseArgs } from 'node:util';

const KNOWN_PROVIDERS = ['publicai', 'claude', 'gemini', 'openai'];

export function parseCliArgs(argv) {
    const raw = argv.slice(2);

    if (raw.length === 0) {
        return { help: true };
    }

    const { values, positionals } = parseArgs({
        args: raw,
        options: {
            provider: { type: 'string', default: 'publicai' },
            'no-log': { type: 'boolean', default: false },
            help:     { type: 'boolean', short: 'h', default: false },
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
    if (!KNOWN_PROVIDERS.includes(provider)) {
        throw new UsageError(`unknown provider: ${provider} (choose from: ${KNOWN_PROVIDERS.join(', ')})`);
    }

    return {
        help: false,
        subcommand: 'verify',
        url,
        citationNumber,
        provider,
        noLog: values['no-log'],
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

export async function main(argv) {
    let opts;
    try {
        opts = parseCliArgs(argv);
    } catch (err) {
        if (err instanceof UsageError) {
            process.stderr.write(`ccs: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    if (opts.help) {
        process.stdout.write('usage: ccs verify <wikipedia-url> <citation-number> [--provider <name>] [--no-log]\n');
        return 0;
    }

    // Full verification pipeline lands in Phase 4.
    process.stderr.write(`ccs: verify not yet implemented (url=${opts.url}, citation=${opts.citationNumber}, provider=${opts.provider})\n`);
    return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main(process.argv).then((code) => process.exit(code));
}
