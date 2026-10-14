/**
 * Join one already-resolved prefix and one leaf into the public tail
 * after the locale prefix.
 */

/** Trim slashes at the ends. Lookups use this. Config validation refuses them. */
export function normalizeSlug(slug: string): string {
  if (slug === '' || slug === '/') return '/';
  return slug.replace(/^\/+/u, '').replace(/\/+$/u, '');
}

export type RouteSlugIssue = 'slash' | 'empty';

/**
 * A row `slug` or `pagination.slug` config must refuse.
 * `/` is the home. `''` is left to the fixed-tail check.
 * A leading or trailing `/` wins over an empty segment.
 */
export function routeSlugIssue(slug: string): RouteSlugIssue | undefined {
  if (slug === '' || slug === '/') return undefined;
  if (slug.startsWith('/') || slug.endsWith('/')) return 'slash';
  if (slug.includes('//')) return 'empty';
  return undefined;
}

const SLUG_TOKEN = '{slug}';

/**
 * Section in front of a final `{slug}` segment.
 * `undefined` when `{slug}` is missing, not the whole last segment, or a section
 * segment contains `{`. A leading or trailing `/`, or an empty segment, is
 * refused in config validation before this runs.
 */
export function patternSection(slug: string): string | undefined {
  const marker = `/${SLUG_TOKEN}`;
  if (!slug.endsWith(marker)) return undefined;
  const section = slug.slice(0, -marker.length);
  if (section.split('/').some((part) => part.includes('{'))) return undefined;
  return section;
}

export function compilePath(prefix: string, slug: string): string {
  if (slug.includes('/')) {
    throw new Error(`@repo/astro-intl: slug "${slug}" is not one segment.`);
  }
  return `${prefix}/${slug}`;
}

/**
 * Page 1 is `pageOne`. Later pages replace the final `{page}` segment.
 * A `/` page-1 tail and a `{page}` tail publish page 2 as `2`.
 */
export function listingPagePath(pageOne: string, pageTail: string, page: number): string {
  if (page <= 1) return normalizeSlug(pageOne);
  const parts = normalizeSlug(pageTail).split('/');
  parts[parts.length - 1] = String(page);
  return parts.join('/');
}

/** Text in front of a final `{page}`. `/` when the tail is `{page}`. */
export function pageTokenSection(pageTail: string): string {
  const tail = normalizeSlug(pageTail);
  const marker = '/{page}';
  if (tail === '{page}') return '/';
  return tail.slice(0, -marker.length);
}

/** How many tails a list fills. The written tail is always page 1. */
export function listingPageCount(entryCount: number, pageSize: number): number {
  if (entryCount <= 0) return 1;
  return Math.ceil(entryCount / pageSize);
}

/** Path argument for `getAbsoluteLocaleUrl` / `getRelativeLocaleUrl`. */
export function localeUrlPath(path: string): string {
  return path === '/' ? '' : path;
}
