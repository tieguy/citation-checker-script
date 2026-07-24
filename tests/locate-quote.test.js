import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locateQuote, locateQuoteFuzzy } from '../core/locate-quote.js';

// The anti-fabrication locator, ported from SP42
// (crates/sp42-citation/src/citation/locate_quote.rs). It decides whether a
// candidate supporting passage is present *verbatim* in the fetched source,
// returning { offset } (a code-unit index into the ORIGINAL source such that
// source.slice(offset) begins the located span) or null.
//
// The negative cases are the load-bearing half: a reworded or fabricated span
// must never locate, or the grounding signal is worthless.

// ---------------------------------------------------------------------------
// MUST LOCATE — exact and transcription-artifact folding
// ---------------------------------------------------------------------------

test('exact substring returns its offset', () => {
  const source = 'He won the Nobel Prize in 1921.';
  const hit = locateQuote('won the Nobel Prize', source);
  assert.ok(hit, 'should locate');
  assert.equal(hit.offset, 3);
  assert.ok(source.slice(hit.offset).startsWith('won the Nobel Prize'));
});

test('match at start is offset zero', () => {
  assert.deepEqual(locateQuote('Acme Corp', 'Acme Corp was founded'), { offset: 0 });
});

test('leading and trailing whitespace on the quote is ignored', () => {
  const hit = locateQuote('  Nobel Prize  ', 'the Nobel Prize');
  assert.ok(hit);
  assert.equal(hit.offset, 4);
});

test('re-cased quote locates and offset points at the original-cased span', () => {
  const source = 'won the Nobel Prize';
  const hit = locateQuote('NOBEL PRIZE', source);
  assert.ok(hit, 'case-insensitive match');
  assert.ok(source.slice(hit.offset).startsWith('Nobel Prize'));
});

test('mixed-case quote locates', () => {
  assert.ok(locateQuote('acme CORP', 'Acme Corp was founded'));
});

test('dash variants unify (en/em/minus vs hyphen)', () => {
  assert.ok(locateQuote('2010-2020', 'growth of 2010–2020 was steep'));
  assert.ok(locateQuote('cost—benefit', 'a cost-benefit analysis'));
});

test('zero-width chars in the source are ignored', () => {
  const source = 'the No​bel Prize';
  assert.ok(locateQuote('Nobel Prize', source));
});

test('whitespace runs in the source still locate and point at the original', () => {
  const source = 'won the\n   Nobel    Prize today';
  const hit = locateQuote('won the Nobel Prize', source);
  assert.ok(hit, 'should locate');
  assert.ok(source.slice(hit.offset).startsWith('won the'));
});

test('curly quotes in source match straight quotes in the quote', () => {
  const source = 'she said “hello world” loudly';
  const hit = locateQuote('"hello world"', source);
  assert.ok(hit, 'should locate');
  assert.ok(source.slice(hit.offset).startsWith('“'));
});

test('curly apostrophe in source matches straight apostrophe', () => {
  const source = 'the company’s founder';
  assert.ok(locateQuote("company's founder", source));
});

test('NFD source matches NFC quote', () => {
  const source = 'the café on the corner'; // decomposed é
  const quote = 'café'; // precomposed
  assert.ok(locateQuote(quote, source));
});

test('NFC source matches NFD quote', () => {
  const source = 'the café on the corner'; // precomposed
  const quote = 'café'; // decomposed
  assert.ok(locateQuote(quote, source));
});

test('offset round-trips into the original body string', () => {
  const source = 'Prelude. The quick brown fox jumped over the lazy dog. Coda.';
  const hit = locateQuote('quick   brown FOX jumped', source);
  assert.ok(hit);
  // The located span, sliced from the ORIGINAL string, still reads as the source wrote it.
  assert.ok(source.slice(hit.offset).startsWith('quick brown fox jumped'));
});

// ---------------------------------------------------------------------------
// MUST LOCATE — multi-fragment / ellipsis (SP42#25 layer 2)
// ---------------------------------------------------------------------------

test('multi-fragment locates in order and points at the first fragment', () => {
  const source =
    'The scruffy park near the corner of Third Street has gotten new asphalt ' +
    'on the dog-walking paths and removed brush and old tires from the cove.';
  const quote = 'The scruffy park near the corner ... removed brush and old tires';
  const hit = locateQuote(quote, source);
  assert.ok(hit, 'multi-fragment should locate');
  assert.ok(source.slice(hit.offset).startsWith('The scruffy park'));
});

test('multi-fragment with a unicode ellipsis locates', () => {
  const source =
    'Acme Corp was established in 1985 by investors, and its founder John Smith ' +
    'served as chief executive until 2001.';
  const quote = 'Acme Corp was established in 1985 … its founder John Smith';
  assert.ok(locateQuote(quote, source));
});

test('multi-fragment with a bracketed [...] elision locates', () => {
  const source =
    'The committee approved the budget on Monday after a long debate and then ' +
    'adjourned the session until the following week.';
  const quote = 'The committee approved the budget [...] adjourned the session';
  assert.ok(locateQuote(quote, source));
});

// ---------------------------------------------------------------------------
// MUST NOT LOCATE — the anti-fabrication guardrails
// ---------------------------------------------------------------------------

test('a fabricated span absent from the source does not locate', () => {
  assert.equal(locateQuote('never appears here', 'a completely different text'), null);
});

test('case folding does not let a fabricated span match', () => {
  assert.equal(locateQuote('entirely invented phrase', 'a completely different text'), null);
});

test('a reworded / paraphrased span does not locate (exact path)', () => {
  const source = 'the Acme Corporation was established in Springfield by local investors';
  // "founded" where the source says "established" — semantic reword, not a transcription artifact.
  assert.equal(locateQuote('the Acme Corporation was founded in Springfield', source), null);
});

test('empty quote returns null', () => {
  assert.equal(locateQuote('', 'anything'), null);
});

test('whitespace-only quote returns null', () => {
  assert.equal(locateQuote('   \n\t ', 'anything'), null);
});

test('multi-fragment out of document order does not stitch', () => {
  const source = 'The scruffy park near the corner has removed brush and old tires.';
  const quote = 'removed brush and old tires ... The scruffy park near the corner';
  assert.equal(locateQuote(quote, source), null);
});

test('multi-fragment with a fabricated fragment does not match', () => {
  const source = 'The scruffy park near the corner has removed brush and old tires.';
  const quote = 'The scruffy park near the corner ... an entirely invented closing span';
  assert.equal(locateQuote(quote, source), null);
});

test('sub-threshold (<8 char) fragments cannot anchor a stitch', () => {
  const source = 'the quick brown fox jumped over the lazy dog in the yard';
  assert.equal(locateQuote('the ... fox ... dog', source), null);
});

test('multi-fragment respects the bounded window (fragments too far apart)', () => {
  const filler = 'lorem ipsum dolor sit amet '.repeat(120); // ~3200 chars
  const source = `the scruffy park is here ${filler} and old tires were removed`;
  const quote = 'the scruffy park is here ... and old tires were removed';
  assert.equal(locateQuote(quote, source), null);
});

// ---------------------------------------------------------------------------
// Performance sanity — a large body must not blow up
// ---------------------------------------------------------------------------

test('locates within a 500KB body in reasonable time', () => {
  const filler = 'The archives contain many documents about local history. '.repeat(9000);
  const needle = 'The rare manuscript was catalogued in 1962 under accession number 4471.';
  const source = `${filler}${needle}${filler}`;
  assert.ok(source.length > 500_000);
  const start = process.hrtime.bigint();
  const hit = locateQuote(needle, source);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(hit, 'should locate');
  assert.ok(ms < 1000, `locate took ${ms.toFixed(0)}ms, expected < 1000ms`);
});

// ---------------------------------------------------------------------------
// Fuzzy path (SP42#25 layer 5) — ported, measured separately, OFF by default
// ---------------------------------------------------------------------------

test('fuzzy recovers a one-reworded-token quote and returns the SOURCE span', () => {
  const source =
    'In 1985 the Acme Corporation was established in Springfield by a group ' +
    'of local investors led by John Smith.';
  const quote =
    'the Acme Corporation was founded in Springfield by a group of local investors';
  assert.equal(locateQuote(quote, source), null, 'exact path must fail first');
  const hit = locateQuoteFuzzy(quote, source);
  assert.ok(hit, 'fuzzy should locate');
  assert.ok(source.slice(hit.offset).startsWith('the Acme Corporation'));
  assert.ok(hit.span.includes('established in Springfield'));
  assert.ok(!hit.span.includes('founded'), 'span is the source text, not the model wording');
});

test('fuzzy rejects a mismatched load-bearing number', () => {
  const source =
    'In 1985 the Acme Corporation was established in Springfield by a group ' +
    'of local investors led by John Smith.';
  const quote =
    'In 1958 the Acme Corporation was established in Springfield by a group of local investors';
  assert.equal(locateQuoteFuzzy(quote, source), null);
});

test('fuzzy rejects a fabricated quote', () => {
  const source = 'The committee reviewed the annual budget and approved the proposal.';
  const quote = 'the museum acquired seventeen paintings from the private collection downtown';
  assert.equal(locateQuoteFuzzy(quote, source), null);
});

test('fuzzy rejects short quotes entirely (below the token floor)', () => {
  const source = 'The bridge opened to traffic in August.';
  assert.equal(locateQuoteFuzzy('bridge opened to cars', source), null);
});

test('fuzzy rejects low similarity even with shared anchors', () => {
  const source =
    'In 1985 the Acme Corporation was established in Springfield by a group ' +
    'of local investors led by John Smith.';
  const quote =
    'several wealthy investors from Springfield reportedly demanded immediate ' +
    'control over every major decision';
  assert.equal(locateQuoteFuzzy(quote, source), null);
});

test('fuzzy outcome carries measured token counts, not a derived ratio', () => {
  const source =
    'In 1985 the Acme Corporation was established in Springfield by a group ' +
    'of local investors led by John Smith.';
  const quote =
    'the Acme Corporation was founded in Springfield by a group of local investors';
  const hit = locateQuoteFuzzy(quote, source);
  assert.ok(hit);
  assert.ok(hit.quoteTokens >= hit.matchedTokens);
  assert.ok(hit.matchedTokens > 0);
});
