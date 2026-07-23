import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVerificationResult } from '../core/parsing.js';

test('parses bare JSON', () => {
  const raw = JSON.stringify({ verdict: 'SUPPORTED', confidence: 'High', comments: 'ok' });
  const out = parseVerificationResult(raw);
  assert.equal(out.verdict, 'SUPPORTED');
  assert.equal(out.confidence, 'High');
});

test('parses JSON inside ```json code fence', () => {
  const raw = '```json\n{"verdict":"NOT SUPPORTED","confidence":"Medium","comments":"c"}\n```';
  const out = parseVerificationResult(raw);
  assert.equal(out.verdict, 'NOT SUPPORTED');
});

test('parses JSON surrounded by prose (legacy {...} extraction)', () => {
  const raw = 'Here is my answer:\n{"verdict":"SUPPORTED","confidence":80,"comments":"matches"}\nThanks.';
  const out = parseVerificationResult(raw);
  assert.equal(out.verdict, 'SUPPORTED');
  assert.equal(out.confidence, 80);
});

test('recovers verdict from Granite-style **Verdict:** SUPPORTED prose', () => {
  const raw = `**Step-by-step verification**

1. **Identify the claim's specific assertions**
   - …

2. **Locate the relevant passage in the article body**
   > "…"

**Verdict:** SUPPORTED
**Comments:** "…" Both the date and the founder match.
`;
  const out = parseVerificationResult(raw);
  assert.equal(out.verdict, 'SUPPORTED');
  assert.equal(out.confidence, null);
  assert.match(out.comments, /non-JSON/);
});

test('fallback recovery is case-insensitive on the "verdict" keyword (lowercase)', () => {
  const raw = '**verdict:** SUPPORTED\n**comments:** ok';
  const out = parseVerificationResult(raw);
  assert.equal(out.verdict, 'SUPPORTED');
});

test('fallback recovery is case-insensitive on the "verdict" keyword (uppercase)', () => {
  const raw = '**VERDICT:** SUPPORTED\n**COMMENTS:** ok';
  const out = parseVerificationResult(raw);
  assert.equal(out.verdict, 'SUPPORTED');
});

test('fallback preserves two-word verdict (NOT SUPPORTED)', () => {
  const raw = `**Verdict:** NOT SUPPORTED
**Comments:** The source contradicts the claim.`;
  const out = parseVerificationResult(raw);
  assert.equal(out.verdict, 'NOT SUPPORTED');
});

test('fallback preserves PARTIALLY SUPPORTED', () => {
  const raw = '**Verdict:** PARTIALLY SUPPORTED\nReasoning: hedged.';
  const out = parseVerificationResult(raw);
  assert.equal(out.verdict, 'PARTIALLY SUPPORTED');
});

test('returns PARSE_ERROR sentinel on pure prose with no verdict marker', () => {
  const out = parseVerificationResult('I cannot determine whether this claim is accurate.');
  assert.equal(out.verdict, 'PARSE_ERROR');
  assert.equal(out.confidence, null);
  assert.match(out.comments, /Failed to parse/);
});

test('returns PARSE_ERROR sentinel on completely malformed input', () => {
  const out = parseVerificationResult('not json at all');
  assert.equal(out.verdict, 'PARSE_ERROR');
  assert.equal(out.confidence, null);
  assert.match(out.comments, /Failed to parse/);
});

test('extracts reason_type from NOT SUPPORTED JSON response', () => {
  const raw = JSON.stringify({
    verdict: 'NOT SUPPORTED',
    confidence: 15,
    reason_type: 'contradiction',
    comments: 'Source says 2002, not 1998.'
  });
  const out = parseVerificationResult(raw);
  assert.equal(out.verdict, 'NOT SUPPORTED');
  assert.equal(out.reason_type, 'contradiction');
});

test('reason_type defaults to null when not present', () => {
  const raw = JSON.stringify({
    verdict: 'SUPPORTED',
    confidence: 90,
    comments: 'Matches.'
  });
  const out = parseVerificationResult(raw);
  assert.equal(out.reason_type, null);
});

// --- quote (grounding backport, Phase 0) ------------------------------------
// The `quote` field carries the verbatim span the model claims to have copied
// out of the source body. Phase 1 re-locates it; Phase 0 only extracts it.
// It is additive: confidence and reason_type keep their existing behaviour.

test('extracts quote alongside verdict, confidence and comments', () => {
  const raw = JSON.stringify({
    confidence: 95,
    verdict: 'SUPPORTED',
    quote: 'Acme Corp was established in 1985.',
    comments: 'Founding year matches.'
  });
  const out = parseVerificationResult(raw);
  assert.equal(out.verdict, 'SUPPORTED');
  assert.equal(out.quote, 'Acme Corp was established in 1985.');
  assert.equal(out.confidence, 95);
  assert.equal(out.comments, 'Founding year matches.');
});

test('quote is null when the field is absent', () => {
  const raw = JSON.stringify({ verdict: 'SUPPORTED', confidence: 90, comments: 'ok' });
  assert.equal(parseVerificationResult(raw).quote, null);
});

test('quote is null when the field is an empty string', () => {
  const raw = JSON.stringify({ verdict: 'SOURCE UNAVAILABLE', confidence: 0, quote: '', comments: 'Paywall.' });
  assert.equal(parseVerificationResult(raw).quote, null);
});

test('quote is null when the field is whitespace-only', () => {
  // An all-whitespace quote would "locate everywhere" in Phase 1; normalise it
  // to null at the parse boundary so no downstream consumer has to.
  const raw = JSON.stringify({ verdict: 'SUPPORTED', confidence: 90, quote: '   \n\t ', comments: 'ok' });
  assert.equal(parseVerificationResult(raw).quote, null);
});

test('quote is trimmed at the edges but preserved verbatim inside', () => {
  const raw = JSON.stringify({
    verdict: 'SUPPORTED',
    confidence: 90,
    quote: '  The bridge opened\n  to traffic in 2002.  ',
    comments: 'ok'
  });
  assert.equal(parseVerificationResult(raw).quote, 'The bridge opened\n  to traffic in 2002.');
});

test('quote is null on the markdown-emphasis fallback path', () => {
  const out = parseVerificationResult('**Verdict:** SUPPORTED\n**Comments:** matches.');
  assert.equal(out.verdict, 'SUPPORTED');
  assert.equal(out.quote, null);
});

test('quote is null on the PARSE_ERROR path', () => {
  const out = parseVerificationResult('not json at all');
  assert.equal(out.verdict, 'PARSE_ERROR');
  assert.equal(out.quote, null);
});

test('a non-string quote is rejected rather than propagated', () => {
  // Small open-weight models occasionally emit a list of spans. Phase 1's
  // locator takes a string; anything else must not reach it.
  const raw = JSON.stringify({ verdict: 'SUPPORTED', confidence: 90, quote: ['a', 'b'], comments: 'ok' });
  assert.equal(parseVerificationResult(raw).quote, null);
});
