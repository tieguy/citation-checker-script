import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNClassVote, computeBinaryVoteN } from '../benchmark/voting.js';

// computeNClassVote — 4-class plurality with skeptical-rank tiebreaker on
// the verdicts tied at the maximum vote count. Skeptical rank is
// Partially supported > Not supported > Source unavailable > Supported,
// mirroring wikidata-SIFT's tie-toward-reject default.

test('computeNClassVote returns the verdict when all voters agree', () => {
  const verdicts = ['Supported', 'Supported', 'Supported'];
  assert.equal(computeNClassVote(verdicts), 'Supported');
});

test('computeNClassVote returns the majority on a 3-2 split', () => {
  const verdicts = ['Supported', 'Supported', 'Supported', 'Not supported', 'Not supported'];
  assert.equal(computeNClassVote(verdicts), 'Supported');
});

test('computeNClassVote returns the plurality on a 2-1-1 split', () => {
  const verdicts = ['Supported', 'Supported', 'Not supported', 'Partially supported'];
  assert.equal(computeNClassVote(verdicts), 'Supported');
});

test('computeNClassVote on a 2-2 tie applies skeptical-rank tiebreaker (Partially beats Supported)', () => {
  const verdicts = ['Supported', 'Supported', 'Partially supported', 'Partially supported'];
  assert.equal(computeNClassVote(verdicts), 'Partially supported');
});

test('computeNClassVote on a 2-2 tie picks Not supported over Supported', () => {
  const verdicts = ['Supported', 'Supported', 'Not supported', 'Not supported'];
  assert.equal(computeNClassVote(verdicts), 'Not supported');
});

test('computeNClassVote with all-different verdicts picks highest skeptical rank', () => {
  const verdicts = ['Supported', 'Not supported', 'Source unavailable'];
  assert.equal(computeNClassVote(verdicts), 'Not supported');
});

test('computeNClassVote with all-different (4 verdicts) picks Partially over Not over Unavailable over Supported', () => {
  const verdicts = ['Supported', 'Not supported', 'Source unavailable', 'Partially supported'];
  assert.equal(computeNClassVote(verdicts), 'Partially supported');
});

test('computeNClassVote tiebreaker only ranks among tied verdicts, not lower-count ones', () => {
  // Supported has 2 votes, others 1 each. Even though Partially is higher-rank,
  // Supported wins on plurality because Partially is not tied at the max count.
  const verdicts = ['Supported', 'Supported', 'Partially supported', 'Not supported'];
  assert.equal(computeNClassVote(verdicts), 'Supported');
});

// computeBinaryVoteN — strict majority for support; ties or sub-majority
// default to "Not supported" (skeptical). isSupportClass collapses
// Supported and Partially supported into "support".

test('computeBinaryVoteN with 3 of 5 in support class returns Supported', () => {
  const verdicts = ['Supported', 'Supported', 'Partially supported', 'Not supported', 'Source unavailable'];
  assert.equal(computeBinaryVoteN(verdicts), 'Supported');
});

test('computeBinaryVoteN with 2 of 5 in support class returns Not supported', () => {
  const verdicts = ['Supported', 'Partially supported', 'Not supported', 'Not supported', 'Source unavailable'];
  assert.equal(computeBinaryVoteN(verdicts), 'Not supported');
});

test('computeBinaryVoteN on 4-voter 2-2 tie returns Not supported (skeptical default)', () => {
  const verdicts = ['Supported', 'Partially supported', 'Not supported', 'Source unavailable'];
  assert.equal(computeBinaryVoteN(verdicts), 'Not supported');
});

test('computeBinaryVoteN on 3-voter 2-of-3 returns Supported (matches legacy 3-voter rule)', () => {
  const verdicts = ['Supported', 'Partially supported', 'Not supported'];
  assert.equal(computeBinaryVoteN(verdicts), 'Supported');
});

test('computeBinaryVoteN counts Partially supported as a support vote', () => {
  // 3 partial + 2 not-support → support class wins 3-2
  const verdicts = ['Partially supported', 'Partially supported', 'Partially supported', 'Not supported', 'Not supported'];
  assert.equal(computeBinaryVoteN(verdicts), 'Supported');
});

test('computeBinaryVoteN counts Source unavailable as a not-support vote', () => {
  // 2 support + 3 unavailable → not-support wins 3-2
  const verdicts = ['Supported', 'Partially supported', 'Source unavailable', 'Source unavailable', 'Source unavailable'];
  assert.equal(computeBinaryVoteN(verdicts), 'Not supported');
});

// === case-insensitive verdict normalization (atomized pipeline emits UPPER) ===

test('computeBinaryVoteN handles uppercase verdicts (atomized pipeline emits SUPPORTED/PARTIALLY SUPPORTED/NOT SUPPORTED)', () => {
  // The atomized rollup at core/rollup.js emits upper-case; legacy single-call
  // emits title case. Without normalization, isSupportClass(SUPPORTED) returned
  // false and every binary vote collapsed to "Not supported" (bug fixed by
  // canonicalizing verdict casing in voting.js).
  const verdicts = ['SUPPORTED', 'SUPPORTED', 'NOT SUPPORTED'];
  assert.equal(computeBinaryVoteN(verdicts), 'Supported');
});

test('computeBinaryVoteN handles mixed-case verdicts in one call', () => {
  // Plurality cases where some panel members use the legacy path and others
  // use the atomized path; we should not penalize the support side.
  const verdicts = ['Supported', 'PARTIALLY SUPPORTED', 'Not supported'];
  // 2 support (Supported + PARTIALLY SUPPORTED) + 1 not = support wins.
  assert.equal(computeBinaryVoteN(verdicts), 'Supported');
});

test('computeNClassVote canonicalizes uppercase verdicts to title case', () => {
  // The 4-class vote should also return a title-cased verdict so downstream
  // string comparisons (e.g., correct-field computation against title-case
  // dataset GT) work without per-caller normalization.
  const verdicts = ['SUPPORTED', 'SUPPORTED', 'PARTIALLY SUPPORTED'];
  assert.equal(computeNClassVote(verdicts), 'Supported');
});

test('computeNClassVote handles all-uppercase NOT SUPPORTED', () => {
  const verdicts = ['NOT SUPPORTED', 'NOT SUPPORTED', 'PARTIALLY SUPPORTED'];
  assert.equal(computeNClassVote(verdicts), 'Not supported');
});
