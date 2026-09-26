import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listingEntries } from './listing.ts';

describe('listingEntries', () => {
  const rows = [
    { data: { id: 'old', locale: 'en', pubDate: new Date('2020-01-01') } },
    { data: { id: 'new', locale: 'en', pubDate: new Date('2024-01-01') } },
    { data: { id: 'mid', locale: 'en', pubDate: new Date('2022-01-01') } },
    { data: { id: 'de', locale: 'de', pubDate: new Date('2023-01-01') } },
  ];

  it('keeps that locale’s posts, newest first', () => {
    assert.deepEqual(
      listingEntries(rows, 'en').map((row) => row.data.id),
      ['new', 'mid', 'old'],
    );
  });
});
