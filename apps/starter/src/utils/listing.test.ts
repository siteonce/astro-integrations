import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listingEntries } from './listing.ts';

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
