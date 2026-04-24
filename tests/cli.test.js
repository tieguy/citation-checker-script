import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs } from '../cli/verify.js';

function args(...rest) {
  return ['node', 'bin/ccs', ...rest];
}

test('parseCliArgs: help flag', () => {
  const result = parseCliArgs(args('--help'));
  assert.equal(result.help, true);
});

test('parseCliArgs: short help flag', () => {
  const result = parseCliArgs(args('-h'));
  assert.equal(result.help, true);
});

test('parseCliArgs: empty argv is treated as help', () => {
  const result = parseCliArgs(args());
  assert.equal(result.help, true);
});

test('parseCliArgs: verify subcommand with url and citation number', () => {
  const result = parseCliArgs(args('verify', 'https://en.wikipedia.org/wiki/Foo', '3'));
  assert.equal(result.help, false);
  assert.equal(result.subcommand, 'verify');
  assert.equal(result.url, 'https://en.wikipedia.org/wiki/Foo');
  assert.equal(result.citationNumber, 3);
  assert.equal(result.provider, 'publicai');
  assert.equal(result.noLog, false);
});

test('parseCliArgs: --provider overrides default', () => {
  const result = parseCliArgs(args('verify', 'https://en.wikipedia.org/wiki/Foo', '3', '--provider', 'claude'));
  assert.equal(result.provider, 'claude');
});

test('parseCliArgs: --no-log sets noLog true', () => {
  const result = parseCliArgs(args('verify', 'https://en.wikipedia.org/wiki/Foo', '3', '--no-log'));
  assert.equal(result.noLog, true);
});

test('parseCliArgs: throws on unknown subcommand', () => {
  assert.throws(
    () => parseCliArgs(args('banana', 'https://en.wikipedia.org/wiki/Foo', '3')),
    /unknown subcommand: banana/i,
  );
});

test('parseCliArgs: throws on verify with missing url', () => {
  assert.throws(
    () => parseCliArgs(args('verify')),
    /usage/i,
  );
});

test('parseCliArgs: throws on verify with missing citation number', () => {
  assert.throws(
    () => parseCliArgs(args('verify', 'https://en.wikipedia.org/wiki/Foo')),
    /usage/i,
  );
});

test('parseCliArgs: throws on non-numeric citation number', () => {
  assert.throws(
    () => parseCliArgs(args('verify', 'https://en.wikipedia.org/wiki/Foo', 'abc')),
    /citation number must be a positive integer/i,
  );
});

test('parseCliArgs: throws on citation number 0 or negative', () => {
  assert.throws(
    () => parseCliArgs(args('verify', 'https://en.wikipedia.org/wiki/Foo', '0')),
    /citation number must be a positive integer/i,
  );
});

test('parseCliArgs: throws on unknown --provider value', () => {
  assert.throws(
    () => parseCliArgs(args('verify', 'https://en.wikipedia.org/wiki/Foo', '3', '--provider', 'nope')),
    /unknown provider: nope/i,
  );
});

import { parseWikiUrl, deriveRestUrl } from '../cli/verify.js';

test('parseWikiUrl: plain article URL', () => {
  const result = parseWikiUrl('https://en.wikipedia.org/wiki/Great_Migration_(African_American)');
  assert.equal(result.title, 'Great_Migration_(African_American)');
  assert.equal(result.oldid, null);
});

test('parseWikiUrl: article URL with oldid', () => {
  const result = parseWikiUrl('https://en.wikipedia.org/wiki/Foo?oldid=1234567');
  assert.equal(result.title, 'Foo');
  assert.equal(result.oldid, '1234567');
});

test('parseWikiUrl: article URL with oldid and other params', () => {
  const result = parseWikiUrl('https://en.wikipedia.org/wiki/Foo?oldid=1234567&useskin=vector');
  assert.equal(result.title, 'Foo');
  assert.equal(result.oldid, '1234567');
});

test('parseWikiUrl: percent-encoded parentheses decode to raw', () => {
  const result = parseWikiUrl('https://en.wikipedia.org/wiki/Great_Migration_%28African_American%29');
  assert.equal(result.title, 'Great_Migration_(African_American)');
});

test('parseWikiUrl: http (not https) accepted', () => {
  const result = parseWikiUrl('http://en.wikipedia.org/wiki/Foo');
  assert.equal(result.title, 'Foo');
});

test('parseWikiUrl: trailing slash on title rejected', () => {
  assert.throws(
    () => parseWikiUrl('https://en.wikipedia.org/wiki/'),
    /could not extract article title/i,
  );
});

test('parseWikiUrl: non-wikipedia host rejected', () => {
  assert.throws(
    () => parseWikiUrl('https://example.com/wiki/Foo'),
    /must be an en\.wikipedia\.org/i,
  );
});

test('parseWikiUrl: /w/index.php?title= form rejected (not supported in Phase 1)', () => {
  assert.throws(
    () => parseWikiUrl('https://en.wikipedia.org/w/index.php?title=Foo&oldid=1234567'),
    /\/wiki\/<title>/i,
  );
});

test('parseWikiUrl: garbage input rejected', () => {
  assert.throws(
    () => parseWikiUrl('not a url'),
    /invalid URL/i,
  );
});

test('deriveRestUrl: no oldid', () => {
  const result = deriveRestUrl({ title: 'Foo', oldid: null });
  assert.equal(result, 'https://en.wikipedia.org/api/rest_v1/page/html/Foo');
});

test('deriveRestUrl: with oldid', () => {
  const result = deriveRestUrl({ title: 'Foo', oldid: '1234567' });
  assert.equal(result, 'https://en.wikipedia.org/api/rest_v1/page/html/Foo/1234567');
});

test('deriveRestUrl: title with parentheses is percent-encoded', () => {
  const result = deriveRestUrl({ title: 'Great_Migration_(African_American)', oldid: null });
  assert.equal(result, 'https://en.wikipedia.org/api/rest_v1/page/html/Great_Migration_(African_American)');
});

test('deriveRestUrl: title with slash is percent-encoded', () => {
  // Wikipedia article titles can contain slashes (e.g. subpages on Meta wikis);
  // don't treat a slash as a path separator.
  const result = deriveRestUrl({ title: 'AC/DC', oldid: null });
  assert.equal(result, 'https://en.wikipedia.org/api/rest_v1/page/html/AC%2FDC');
});
