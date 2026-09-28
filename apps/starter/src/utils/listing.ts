import type { ListingEntries } from '@repo/astro-intl';
import { byDate } from './sorting.ts';

/**
 * Which entries fill a listing tail. Posts: that locale, newest `pubDate` first.
 * Other collections: that locale. The loader decides which drafts exist.
 */
export const listingQuery: ListingEntries = (collection, locale, entries) => {
  const inLocale = entries.filter((entry) => entry.data.locale === locale);
  if (collection !== 'posts') return inLocale;
  return inLocale.toSorted(
    byDate((post) => (post.data.pubDate instanceof Date ? post.data.pubDate : new Date(0)), 'desc'),
  );
};
