import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compilePath,
  listingPageCount,
  listingTail,
  localeUrlPath,
  normalizeSlug,
} from './path.ts';

describe('compilePath', () => {
  it('joins a prefix and a leaf', () => {
    assert.equal(compilePath('blog', 'hello-world'), 'blog/hello-world');
    assert.equal(compilePath('artikel', 'hallo-welt'), 'artikel/hallo-welt');
  });

  it('rejects an empty prefix, "/", and a slashed leaf', () => {
    assert.throws(() => compilePath('', 'hello-world'), /prefix "" is empty or "\/"/);
    assert.throws(() => compilePath('/', 'hello-world'), /prefix "\/" is empty or "\/"/);
    assert.throws(() => compilePath('blog', '/'), /slug "\/" is not one segment/);
    assert.throws(
      () => compilePath('artikel', 'artikel/hallo-welt'),
      /slug "artikel\/hallo-welt" is not one segment/,
    );
  });
});

describe('listingTail', () => {
  it('keeps page 1 on the written tail and appends later pages', () => {
    assert.equal(listingTail('blog', 1), 'blog');
    assert.equal(listingTail('blog', 2), 'blog/2');
    assert.equal(listingTail('artikel', 3), 'artikel/3');
    assert.equal(listingTail('/', 1), '/');
    assert.equal(listingTail('/', 2), '2');
  });

  it('counts chunks and keeps one tail when the list is empty', () => {
    assert.equal(listingPageCount(25, 10), 3);
    assert.equal(listingPageCount(12, 10), 2);
    assert.equal(listingPageCount(10, 10), 1);
    assert.equal(listingPageCount(0, 10), 1);
    assert.throws(() => listingPageCount(1, 0), /positive integer/);
  });
});

describe('normalizeSlug', () => {
  it('maps an empty slug to the homepage path', () => {
    assert.equal(normalizeSlug(''), '/');
    assert.equal(localeUrlPath('/'), '');
    assert.equal(localeUrlPath('blog/hello-world'), 'blog/hello-world');
  });
});
