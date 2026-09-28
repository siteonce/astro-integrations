import type { ListingEntries } from '@repo/astro-intl';

type DatedEntry = {
  data: {
    locale?: unknown;
    pubDate?: unknown;
  };
};

/** That locale's posts, newest first. Drafts never reach here in production. */
export function listingEntries<T extends DatedEntry>(entries: readonly T[], locale: string): T[] {
  return entries
    .filter((entry) => entry.data.locale === locale)
    .sort((a, b) => {
      const aTime = a.data.pubDate instanceof Date ? a.data.pubDate.valueOf() : 0;
      const bTime = b.data.pubDate instanceof Date ? b.data.pubDate.valueOf() : 0;
      return bTime - aTime;
    });
}

/**
 * Which posts fill a listing tail. The posts collection: that locale's posts, newest first.
 * Other collections: that locale. The loader decides which drafts exist.
 */
export const listingQuery: ListingEntries = (collection, locale, entries) => {
  if (collection !== 'posts') {
    return entries.filter((entry) => entry.data.locale === locale);
  }
  return listingEntries(entries, locale);
};
