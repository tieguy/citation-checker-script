// The anti-fabrication locator, ported from SP42
// (crates/sp42-citation/src/citation/locate_quote.rs, ADR-0007 §5 / SP42#25).
//
// locateQuote(quote, source) decides whether a candidate supporting passage is
// present *verbatim* in a source we actually fetched, returning the position of
// the match or null. It is the independent re-check that lets a
// non-deterministic model sit in a governed system: a Supported / Partially
// supported verdict is only trustworthy if its quote re-locates in the fetched
// text.
//
// Matching folds only *transcription / extraction artifacts*, nothing semantic:
// Unicode NFC, whitespace-run collapse, curly→straight quotes, dash unification
// (en/em/figure dash, minus → "-"), zero-width stripping, and case folding (so a
// re-cased quote — a transcription artifact, not a fabrication — still locates).
// A quote that elides the middle with an ellipsis is matched fragment-by-fragment,
// in document order, within a bounded window — still verbatim per fragment. A
// genuinely reworded quote still does not match, and a fabricated span still does
// not match, so the anti-fabrication guarantee is preserved. An empty or
// whitespace-only quote returns null (an empty string would otherwise "locate
// everywhere").
//
// The returned `offset` is a code-unit index into the ORIGINAL `source` string:
// source.slice(offset) begins the (original-cased, original-punctuated) span the
// normalized match found. The load-bearing output is the found/not-found decision.
//
// Browser-safe: no Node built-ins, so it can be injected into main.js.

// Minimum normalized length (in code points) for a fragment to anchor a
// multi-fragment match; shorter fragments can stitch spuriously, so they are dropped.
const MIN_FRAGMENT_CHARS = 8;
// Maximum normalized-char span from the first fragment's start to the last
// fragment's end — bounds a multi-fragment match to a local passage.
const MAX_FRAGMENT_SPAN_CHARS = 1500;

// Ellipsis delimiters a model uses to elide the middle of a quoted passage:
// ASCII "...", Unicode "…", or a bracketed "[...]" / "[…]". Linear-time, no
// catastrophic backtracking (the classes in the bracketed form are disjoint).
const ELLIPSIS = /\.\.\.|…|\[\s*…?\s*\.*\s*\]/g;

const ZERO_WIDTH = /[​‌‍﻿]/;
const COMBINING_MARK = /\p{M}/u;
const NON_ALNUM_EDGE_LEAD = /^[^\p{L}\p{N}]+/u;
const NON_ALNUM_EDGE_TRAIL = /[^\p{L}\p{N}]+$/u;

// Fold a typographic quote or dash character to its ASCII equivalent; all other
// characters pass through unchanged. Transcription/extraction artifacts, not
// semantic content.
function substitute(ch) {
  switch (ch) {
    case '‘':
    case '’':
    case '‚':
    case '‛':
    case '′':
      return "'";
    case '“':
    case '”':
    case '„':
    case '‟':
    case '″':
      return '"';
    // Hyphen, non-breaking hyphen, figure dash, en/em dash, horizontal bar, minus.
    case '‐':
    case '‑':
    case '‒':
    case '–':
    case '—':
    case '―':
    case '−':
      return '-';
    default:
      return ch;
  }
}

function isZeroWidth(ch) {
  return ZERO_WIDTH.test(ch);
}

// Normalize the quote side: NFC, strip zero-width, collapse whitespace runs to a
// single ASCII space, substitute curly quotes / dashes, case-fold, then trim.
function normalizeForMatch(text) {
  let out = '';
  let prevSpace = false;
  for (const ch of text.normalize('NFC')) {
    if (isZeroWidth(ch)) continue;
    if (/\s/u.test(ch)) {
      if (!prevSpace) {
        out += ' ';
        prevSpace = true;
      }
    } else {
      out += substitute(ch).toLowerCase();
      prevSpace = false;
    }
  }
  return out.trim();
}

// Normalize the source side, returning the normalized text alongside a
// per-code-unit map back to the original code-unit index. Each base character
// plus its trailing combining marks is NFC-composed as one unit so a decomposed
// source matches a precomposed quote, while the map still points each normalized
// code unit at the start of the original unit it came from.
function normalizeWithMap(source) {
  let text = '';
  const map = [];
  let prevSpace = false;
  let unit = '';
  let unitStart = 0;
  let cuIndex = 0; // code-unit index into `source`

  const flushUnit = () => {
    if (unit === '') return;
    const lowered = unit.normalize('NFC').toLowerCase();
    for (let i = 0; i < lowered.length; i++) {
      text += lowered[i];
      map.push(unitStart);
    }
    unit = '';
  };

  for (const ch of source) {
    const start = cuIndex;
    cuIndex += ch.length;

    if (isZeroWidth(ch)) continue;

    if (/\s/u.test(ch)) {
      flushUnit();
      if (!prevSpace) {
        text += ' ';
        map.push(start);
        prevSpace = true;
      }
      continue;
    }

    prevSpace = false;
    const sub = substitute(ch);
    if (unit !== '' && COMBINING_MARK.test(ch)) {
      unit += sub;
    } else {
      flushUnit();
      unit = sub;
      unitStart = start;
    }
  }
  flushUnit();

  return { text, map };
}

// Locate an ellipsis-elided quote as ordered fragments: split on ellipsis,
// require each substantial (≥ MIN_FRAGMENT_CHARS) fragment to occur verbatim in
// document order within MAX_FRAGMENT_SPAN_CHARS, and return the original offset of
// the first fragment. Returns null unless at least two substantial fragments
// locate in order and in window, so a fabricated/reworded quote or out-of-order
// fragments never stitch a match.
function locateMultiFragment(quote, normalizedSource, map) {
  const fragments = quote
    .split(ELLIPSIS)
    .map(normalizeForMatch)
    .filter((fragment) => [...fragment].length >= MIN_FRAGMENT_CHARS);
  if (fragments.length < 2) return null;

  let searchFrom = 0; // code-unit index into normalizedSource
  let firstCu = null;
  let lastEndCu = 0;
  for (const fragment of fragments) {
    const relative = normalizedSource.slice(searchFrom).indexOf(fragment);
    if (relative < 0) return null;
    const cu = searchFrom + relative;
    if (firstCu === null) firstCu = cu;
    lastEndCu = cu + fragment.length;
    searchFrom = cu + fragment.length;
  }

  if (firstCu === null) return null;
  const spanChars = [...normalizedSource.slice(firstCu, lastEndCu)].length;
  if (spanChars > MAX_FRAGMENT_SPAN_CHARS) return null;
  const offset = map[firstCu];
  return offset === undefined ? null : { offset };
}

// Locate `quote` verbatim within `source`, returning { offset } (a code-unit
// index into the original source) or null.
export function locateQuote(quote, source) {
  if (typeof quote !== 'string' || typeof source !== 'string') return null;
  const trimmed = quote.trim();
  if (trimmed === '') return null;

  // Fast path: the trimmed quote occurs verbatim in the raw source.
  const raw = source.indexOf(trimmed);
  if (raw >= 0) return { offset: raw };

  // Normalized path: absorb whitespace / quote-style / NFC / case differences.
  const normalizedQuote = normalizeForMatch(trimmed);
  if (normalizedQuote === '') return null;
  const { text: normalizedSource, map } = normalizeWithMap(source);
  const hit = normalizedSource.indexOf(normalizedQuote);
  if (hit >= 0) {
    const offset = map[hit];
    return offset === undefined ? null : { offset };
  }

  // Multi-fragment fallback: the model elided the middle with an ellipsis.
  return locateMultiFragment(trimmed, normalizedSource, map);
}

// ---------------------------------------------------------------------------
// Bounded fuzzy locate (SP42#25 layer 5) — the guarded last resort. Ported but
// exported separately; locateQuote never calls it. Off by default in Phase 1.
// ---------------------------------------------------------------------------

const MIN_FUZZY_TOKENS = 5;
const FUZZY_THRESHOLD_NUM = 17;
const FUZZY_THRESHOLD_DEN = 20;
const MAX_FUZZY_WINDOWS = 50;

// Strip leading/trailing non-alphanumerics from a token; keep interior
// punctuation (hyphens, apostrophes) — it is part of the word.
function cleanToken(token) {
  return token.replace(NON_ALNUM_EDGE_LEAD, '').replace(NON_ALNUM_EDGE_TRAIL, '');
}

// Tokenize the normalized source into cleaned tokens with their code-unit ranges.
function tokenizeSource(normalizedSource) {
  const tokens = [];
  let start = null;
  let current = '';
  let cu = 0;
  for (const ch of normalizedSource) {
    if (ch === ' ') {
      if (start !== null) {
        tokens.push({ cleaned: cleanToken(current), startChar: start, endChar: cu });
        current = '';
        start = null;
      }
    } else {
      if (start === null) start = cu;
      current += ch;
    }
    cu += ch.length;
  }
  if (start !== null) {
    tokens.push({ cleaned: cleanToken(current), startChar: start, endChar: cu });
  }
  return tokens.filter((token) => token.cleaned !== '');
}

// Anchor tokens for candidate-window generation: every digit-bearing token plus
// the three longest tokens of at least five chars.
function anchorTokens(quoteTokens) {
  const anchors = quoteTokens.filter(
    (token) => [...token].length >= 5 || /[0-9]/.test(token),
  );
  anchors.sort((a, b) => [...b].length - [...a].length);
  return anchors.slice(0, 3);
}

// Longest common subsequence of `quoteTokens` within `window`, returning
// { matched, first, last } window indices, or null. Order is enforced by
// construction — shuffled tokens do not count.
function lcsMatch(quoteTokens, window) {
  const rows = quoteTokens.length;
  const cols = window.length;
  const table = new Array((rows + 1) * (cols + 1)).fill(0);
  const at = (row, col) => row * (cols + 1) + col;
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      table[at(row, col)] =
        quoteTokens[row - 1] === window[col - 1].cleaned
          ? table[at(row - 1, col - 1)] + 1
          : Math.max(table[at(row - 1, col)], table[at(row, col - 1)]);
    }
  }
  const matched = table[at(rows, cols)];
  if (matched === 0) return null;
  let row = rows;
  let col = cols;
  let first = null;
  let last = null;
  while (row > 0 && col > 0) {
    if (
      quoteTokens[row - 1] === window[col - 1].cleaned &&
      table[at(row, col)] === table[at(row - 1, col - 1)] + 1
    ) {
      first = col - 1;
      if (last === null) last = col - 1;
      row -= 1;
      col -= 1;
    } else if (table[at(row - 1, col)] >= table[at(row, col - 1)]) {
      row -= 1;
    } else {
      col -= 1;
    }
  }
  if (first === null || last === null) return null;
  return { matched, first, last };
}

// A guarded fuzzy match: the returned span is the SOURCE's own text (the model's
// mangled quote is never surfaced), with the measured token counts that justified
// it. Returns { offset, span, matchedTokens, quoteTokens } or null.
export function locateQuoteFuzzy(quote, source) {
  if (typeof quote !== 'string' || typeof source !== 'string') return null;
  const normalizedQuote = normalizeForMatch(quote.trim());
  const quoteTokens = normalizedQuote
    .split(' ')
    .map(cleanToken)
    .filter((token) => token !== '');
  if (quoteTokens.length < MIN_FUZZY_TOKENS) return null;

  const { text: normalizedSource, map } = normalizeWithMap(source);
  const sourceTokens = tokenizeSource(normalizedSource);
  if (sourceTokens.length === 0) return null;

  const loadBearing = quoteTokens.filter((token) => /[0-9]/.test(token));
  const anchors = anchorTokens(quoteTokens);
  if (anchors.length === 0) return null;

  const radius = quoteTokens.length + 2;
  let best = null; // { matched, firstToken, lastToken }
  let windows = 0;
  for (let index = 0; index < sourceTokens.length; index++) {
    if (!anchors.includes(sourceTokens[index].cleaned)) continue;
    windows += 1;
    if (windows > MAX_FUZZY_WINDOWS) break;
    const windowStart = Math.max(0, index - radius);
    const windowEnd = Math.min(index + radius + 1, sourceTokens.length);
    const window = sourceTokens.slice(windowStart, windowEnd);
    const lcs = lcsMatch(quoteTokens, window);
    if (lcs && (best === null || lcs.matched > best.matched)) {
      best = {
        matched: lcs.matched,
        firstToken: windowStart + lcs.first,
        lastToken: windowStart + lcs.last,
      };
    }
  }

  if (best === null) return null;
  if (best.matched * FUZZY_THRESHOLD_DEN < quoteTokens.length * FUZZY_THRESHOLD_NUM) {
    return null;
  }
  // Load-bearing (digit-bearing) tokens must occur exactly inside the matched span.
  const spanTokens = sourceTokens.slice(best.firstToken, best.lastToken + 1);
  const allPresent = loadBearing.every((needed) =>
    spanTokens.some((token) => token.cleaned === needed),
  );
  if (!allPresent) return null;

  const startChar = sourceTokens[best.firstToken].startChar;
  const endChar = sourceTokens[best.lastToken].endChar;
  const startByte = map[startChar];
  if (startByte === undefined) return null;
  const endByte = map[endChar] === undefined ? source.length : map[endChar];
  return {
    offset: startByte,
    span: source.slice(startByte, endByte).replace(/\s+$/u, ''),
    matchedTokens: best.matched,
    quoteTokens: quoteTokens.length,
  };
}
