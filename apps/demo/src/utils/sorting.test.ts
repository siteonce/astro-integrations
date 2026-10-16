import type { CollectionEntry } from 'astro:content';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { postsNewestFirst } from './sorting.ts';

describe('postsNewestFirst', () => {
  const entry = (id: string, pubDate: string) =>
    ({ data: { id, pubDate: new Date(pubDate) } }) as CollectionEntry<'posts'>;

  it('sorts same-day posts by pairing id and a newer post before an older one', () => {
    const sameDayB = entry('beta', '2026-01-15');
    const sameDayA = entry('alpha', '2026-01-15');
    const older = entry('zzz', '2024-06-01');
    const ids = [sameDayB, older, sameDayA].toSorted(postsNewestFirst).map((post) => post.data.id);
    assert.deepEqual(ids, ['alpha', 'beta', 'zzz']);
  });
});
