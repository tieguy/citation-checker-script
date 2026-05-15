// Calls to the Cloudflare Worker proxy: source fetching and verification logging.

import { isGoogleBooksUrl } from './urls.js';
import { classifyBody } from './body-classifier.js';

// fetchSourceContent return shapes:
//   string                                  — usable body, formatted as
//                                             "Source URL: <u>\n\nSource Content:\n<body>"
//   { sourceUnavailable, reason }           — source cannot be verified deterministically.
//                                             Callers should record a "Source unavailable"
//                                             verdict without invoking the LLM. Reasons:
//                                               'google_books_skip' — Google Books URL,
//                                                                    intentionally not fetched
//                                               'fetch_failed'      — proxy error, empty response,
//                                                                    or network exception
//                                               '<classifier code>' — body fetched but flagged
//                                                                    structurally bad by
//                                                                    core/body-classifier.js
//                                                                    (wayback_chrome, short_body,
//                                                                    json_ld_leak, css_leak,
//                                                                    amazon_stub, anti_bot_challenge)
export async function fetchSourceContent(url, pageNum, { workerBase = 'https://publicai-proxy.alaexis.workers.dev' } = {}) {
    if (isGoogleBooksUrl(url)) {
        console.log('[CitationVerifier] Skipping Google Books URL:', url);
        return { sourceUnavailable: true, reason: 'google_books_skip' };
    }

    try {
        let proxyUrl = `${workerBase}/?fetch=${encodeURIComponent(url)}`;
        if (pageNum) {
            proxyUrl += `&page=${pageNum}`;
        }
        const response = await fetch(proxyUrl);
        const data = await response.json();

        if (data.error) {
            console.warn('[CitationVerifier] Proxy error:', data.error);
            return { sourceUnavailable: true, reason: 'fetch_failed' };
        }

        if (data.content && data.content.length > 100) {
            const classification = classifyBody(data.content);
            if (!classification.usable) {
                return { sourceUnavailable: true, reason: classification.reason };
            }
            // Proxy caps fetched content around 12k chars. If we're at or
            // above that, the source was almost certainly truncated and
            // only partially sent to the model.
            const isTruncated = data.truncated === true || data.content.length >= 12000;
            let meta = `Source URL: ${url}`;
            if (data.pdf) {
                meta += `\nPDF: ${data.totalPages} pages`;
                if (data.page) {
                    meta += ` (extracted page ${data.page})`;
                }
            }
            if (isTruncated) {
                meta += `\nTruncated: true`;
            }
            return `${meta}\n\nSource Content:\n${data.content}`;
        }

        // If PDF was large and we didn't request a specific page, retry
        // with the citation page if available
        if (data.pdf && !pageNum && data.totalPages > 15) {
            console.log('[CitationVerifier] Large PDF without page param, content may be truncated');
        }
    } catch (error) {
        console.error('Proxy fetch failed:', error);
    }
    // Reached when content is missing/too-short or an exception was caught.
    // Both are forms of "couldn't get usable content" → fetch_failed SU.
    return { sourceUnavailable: true, reason: 'fetch_failed' };
}

// User-facing status text for an SU return shape. Used by main.js's
// single-citation Verify path. fetch_failed preserves the pre-unification
// wording ("Could not fetch source…") since users see "fetched nothing"
// as different in tone from "fetched but body is bad," even though the
// runtime treats them identically. All other reasons surface the reason
// code in parentheses so the user can distinguish patterns over time.
export function sourceUnavailableStatusText(reason) {
    if (reason === 'fetch_failed') {
        return 'Could not fetch source. Please paste the source text below.';
    }
    return `Source unavailable (${reason}). Paste the source text below if you have it.`;
}

// Report-comment text for an SU return shape. Used by main.js's batch-report
// path and by benchmark/run_benchmark.js's synthesizePipelineSU. fetch_failed
// preserves the pre-unification "Could not fetch source content" wording;
// other reasons use the Pipeline-attributed prefix so analyze_results.js
// (and human reviewers) can pattern-match on it.
export function sourceUnavailableComment(reason) {
    if (reason === 'fetch_failed') {
        return 'Could not fetch source content';
    }
    return `Pipeline-attributed (${reason})`;
}

export function logVerification(payload, { workerBase = 'https://publicai-proxy.alaexis.workers.dev' } = {}) {
    // Wrap the fetch POST in try/catch exactly as main.js does.
    // `payload` replaces the constructed object in main.js — caller supplies
    //   { article_url, article_title, citation_number, source_url, provider, verdict, confidence }.
    try {
        fetch(`${workerBase}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).catch(() => {});
    } catch (e) {
        // logging should never break the main flow
    }
}
