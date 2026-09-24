import { listingPageCount, listingTail, setListingEntries } from '@repo/astro-intl';
import { isLocal, isPreview } from '@repo/astro-site/utils/deploy-env';
import { deployConfig } from '../deploy.config.ts';
import { routes, type StarterRoute } from '../routes.config.ts';

export type ListingPage<T> = {
  data: T[];
  start: number;
  end: number;
  total: number;
  currentPage: number;
  size: number;
  lastPage: number;
  url: {
    current: string;
    prev: string | undefined;
    next: string | undefined;
    first: string | undefined;
    last: string | undefined;
  };
};

type DatedEntry = {
  data: {
    locale?: unknown;
    status?: unknown;
    pubDate?: unknown;
  };
};

export function publicTail(value: string): string {
  if (value === '' || value === '/') return '/';
  return value.replace(/^\/+/u, '').replace(/\/+$/u, '');
}

/** Page 1 is the written tail. `tail/1` is not a page. */
export function listingPageNumber(tail: string, path: string): number | undefined {
  const base = publicTail(tail);
  const normalized = publicTail(path);
  if (normalized === base) return 1;
  if (base === '/') {
    if (!/^[1-9]\d*$/u.test(normalized) || normalized === '1') return undefined;
    return Number(normalized);
  }
  const prefix = `${base}/`;
  if (!normalized.startsWith(prefix)) return undefined;
  const leaf = normalized.slice(prefix.length);
  if (leaf.includes('/') || !/^[1-9]\d*$/u.test(leaf) || leaf === '1') return undefined;
  return Number(leaf);
}

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

/**
 * Astro's page object for one listing tail. `pageSize` omitted means the whole
 * list is the one written tail. Hrefs come from `hrefFor`.
 */
export function listingPage<T>(
  entries: readonly T[],
  pageSize: number | undefined,
  currentPage: number,
  hrefFor: (page: number) => string,
): ListingPage<T> {
  const total = entries.length;
  const size = pageSize ?? total;
  const lastPage = pageSize === undefined ? 1 : listingPageCount(total, pageSize);
  if (currentPage < 1 || currentPage > lastPage) {
    throw new Error(`starter: listing page ${currentPage} is past the last page ${lastPage}.`);
  }
  const start = pageSize === undefined ? 0 : (currentPage - 1) * pageSize;
  const endExclusive = pageSize === undefined ? total : Math.min(start + pageSize, total);
  return {
    data: entries.slice(start, endExclusive),
    start,
    end: endExclusive - 1,
    total,
    currentPage,
    size,
    lastPage,
    url: {
      current: hrefFor(currentPage),
      prev: currentPage === 1 ? undefined : hrefFor(currentPage - 1),
      next: currentPage === lastPage ? undefined : hrefFor(currentPage + 1),
      first: currentPage === 1 ? undefined : hrefFor(1),
      last: currentPage === lastPage ? undefined : hrefFor(lastPage),
    },
  };
}

export function matchStarterRoute(
  locale: string,
  path: string,
  hasEntry: boolean,
): StarterRoute | undefined {
  const normalized = publicTail(path);
  if (!hasEntry) {
    for (const route of routes) {
      const slug = route.slug[locale];
      if (slug === undefined || slug.includes('{slug}')) continue;
      if (publicTail(slug) === normalized) return route;
    }
    for (const route of routes) {
      if (route.pageSize === undefined || route.entry) continue;
      const slug = route.slug[locale];
      if (slug === undefined || slug.includes('{slug}')) continue;
      const page = listingPageNumber(slug, normalized);
      if (page !== undefined && page > 1) return route;
    }
    return undefined;
  }

  for (const route of routes) {
    const slug = route.slug[locale];
    if (slug === undefined || !route.entry || slug.includes('{slug}')) continue;
    if (publicTail(slug) === normalized) return route;
  }
  for (const route of routes) {
    const slug = route.slug[locale];
    if (slug === undefined) continue;
    const pattern = publicTail(slug);
    const marker = '/{slug}';
    if (!pattern.endsWith(marker)) continue;
    const section = pattern.slice(0, -marker.length);
    if (!normalized.startsWith(`${section}/`)) continue;
    const leaf = normalized.slice(section.length + 1);
    if (leaf.length > 0 && !leaf.includes('/')) return route;
  }
  return undefined;
}

/** Chunk membership for pairing. Blog uses the listing query; other collections keep that locale. */
export function bindListingQuery(): void {
  const showDrafts = isLocal(deployConfig) || isPreview(deployConfig);
  setListingEntries((collection, locale, entries) => {
    if (collection !== 'blog') {
      return entries.filter((entry) => entry.data.locale === locale);
    }
    return listingEntries(entries, locale, showDrafts);
  });
}

export { listingTail };
