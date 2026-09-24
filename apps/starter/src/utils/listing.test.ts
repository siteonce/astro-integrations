import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listingEntries, listingPage, listingPageNumber } from './listing.ts';

function href(page: number): string {
  return page === 1 ? '/en/blog' : `/en/blog/${page}`;
}

describe('listingPageNumber', () => {
  it('treats the written tail as page 1 and rejects /1', () => {
    assert.equal(listingPageNumber('blog', 'blog'), 1);
    assert.equal(listingPageNumber('artikel', 'artikel/2'), 2);
    assert.equal(listingPageNumber('blog', 'blog/1'), undefined);
    assert.equal(listingPageNumber('blog', 'blog/hello'), undefined);
    assert.equal(listingPageNumber('/', '2'), 2);
    assert.equal(listingPageNumber('/', '/'), 1);
  });
});

describe('listingEntries', () => {
  const rows = [
    { data: { id: 'old', locale: 'en', status: 'published', pubDate: new Date('2020-01-01') } },
    { data: { id: 'draft', locale: 'en', status: 'draft', pubDate: new Date('2024-01-01') } },
    { data: { id: 'mid', locale: 'en', status: 'published', pubDate: new Date('2022-01-01') } },
    { data: { id: 'de', locale: 'de', status: 'published', pubDate: new Date('2023-01-01') } },
  ];

  it('keeps that locale’s published posts, newest first', () => {
    assert.deepEqual(
      listingEntries(rows, 'en', false).map((row) => row.data.id),
      ['mid', 'old'],
    );
  });

  it('includes drafts when asked', () => {
    assert.deepEqual(
      listingEntries(rows, 'en', true).map((row) => row.data.id),
      ['draft', 'mid', 'old'],
    );
  });
});

describe('listingPage', () => {
  const entries = Array.from({ length: 25 }, (_, index) => index + 1);

  it('slices posts 11–20 on page 2 of 25', () => {
    const page = listingPage(entries, 10, 2, href);
    assert.deepEqual(page.data, entries.slice(10, 20));
    assert.equal(page.start, 10);
    assert.equal(page.end, 19);
    assert.equal(page.total, 25);
    assert.equal(page.currentPage, 2);
    assert.equal(page.size, 10);
    assert.equal(page.lastPage, 3);
    assert.equal(page.url.current, '/en/blog/2');
    assert.equal(page.url.prev, '/en/blog');
    assert.equal(page.url.next, '/en/blog/3');
    assert.equal(page.url.first, '/en/blog');
    assert.equal(page.url.last, '/en/blog/3');
  });

  it('omits next on the last page and prev on the first', () => {
    const last = listingPage(entries, 10, 3, href);
    assert.deepEqual(last.data, entries.slice(20));
    assert.equal(last.start, 20);
    assert.equal(last.end, 24);
    assert.equal(last.url.next, undefined);
    assert.equal(last.url.last, undefined);
    assert.equal(last.url.prev, '/en/blog/2');
    const first = listingPage(entries, 10, 1, href);
    assert.equal(first.url.prev, undefined);
    assert.equal(first.url.first, undefined);
    assert.equal(first.url.next, '/en/blog/2');
  });

  it('keeps one tail when pageSize is omitted', () => {
    const page = listingPage(entries, undefined, 1, href);
    assert.equal(page.lastPage, 1);
    assert.equal(page.data.length, 25);
    assert.equal(page.url.next, undefined);
  });
});
