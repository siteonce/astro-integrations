import type { ListingEntries } from '@repo/astro-intl';
import { isLocal, isPreview } from '@repo/astro-site/utils/deploy-env';
import { deployConfig } from '../deploy.config.ts';

type DatedEntry = {
  data: {
    locale?: unknown;
    status?: unknown;
    pubDate?: unknown;
  };
};

/** That locale, published posts, drafts only when `showDrafts`, newest first. */
export function listingEntries<T extends DatedEntry>(
  entries: readonly T[],
  locale: string,
  showDrafts: boolean,
): T[] {
  return entries
    .filter((entry) => {
      if (entry.data.locale !== locale) return false;
      const { status } = entry.data;
      if (status === undefined) return true;
      return status === 'published' || showDrafts;
    })
    .sort((a, b) => {
      const aTime = a.data.pubDate instanceof Date ? a.data.pubDate.valueOf() : 0;
      const bTime = b.data.pubDate instanceof Date ? b.data.pubDate.valueOf() : 0;
      return bTime - aTime;
    });
}

const showDrafts = isLocal(deployConfig) || isPreview(deployConfig);

/**
 * Which posts fill a listing tail. Blog: that locale's published posts, drafts
 * in local or preview, newest first. Other collections: that locale.
 */
export const listingQuery: ListingEntries = (collection, locale, entries) => {
  if (collection !== 'blog') {
    return entries.filter((entry) => entry.data.locale === locale);
  }
  return listingEntries(entries, locale, showDrafts);
};
