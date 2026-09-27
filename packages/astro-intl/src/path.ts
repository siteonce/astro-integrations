/**
 * Join one already-resolved prefix and one leaf into the public tail
 * after the locale prefix.
 */

export function normalizeSlug(slug: string): string {
  if (slug === '' || slug === '/') return '/';
  return slug.replace(/^\/+/u, '').replace(/\/+$/u, '');
}

/** Section prefix. `undefined` when the value is empty or `/`. */
export function normalizePrefix(value: string): string | undefined {
  if (value === '/') return undefined;
  const stripped = value.replace(/^\/+|\/+$/gu, '');
  return stripped === '' ? undefined : stripped;
}

const SLUG_TOKEN = '{slug}';

/**
 * Section in front of a final `{slug}` segment.
 * `undefined` when `{slug}` is missing, repeated, or not the whole last segment.
 */
export function patternSection(slug: string): string | undefined {
  const normalized = normalizeSlug(slug);
  const marker = `/${SLUG_TOKEN}`;
  if (!normalized.endsWith(marker)) return undefined;
  if (normalized.indexOf(SLUG_TOKEN) !== normalized.length - SLUG_TOKEN.length) return undefined;
  const section = normalizePrefix(normalized.slice(0, -marker.length));
  if (!section || section.split('/').some((part) => part.length === 0 || part.includes('{'))) {
    return undefined;
  }
  return section;
}

export function compilePath(prefix: string, slug: string): string {
  const normalized = normalizePrefix(prefix);
  if (!normalized) {
    throw new Error(`@repo/astro-intl: prefix "${prefix}" is empty or "/".`);
  }
  if (slug === '' || slug === '/' || slug.includes('/')) {
    throw new Error(`@repo/astro-intl: slug "${slug}" is not one segment.`);
  }
  return `${normalized}/${slug}`;
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
  if (tail.endsWith(marker)) return tail.slice(0, -marker.length);
  return tail;
}

/** Page 1 is the written tail. Later pages append the number. A `/` tail’s page 2 is `2`. */
export function listingTail(tail: string, page: number): string {
  const base = normalizeSlug(tail);
  if (page <= 1) return base;
  if (base === '/') return String(page);
  return `${base}/${page}`;
}

/** How many tails a list fills. The written tail is always page 1. */
export function listingPageCount(entryCount: number, pageSize: number): number {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(`@repo/astro-intl: pageSize "${pageSize}" must be a positive integer.`);
  }
  if (entryCount <= 0) return 1;
  return Math.ceil(entryCount / pageSize);
}

/** Path argument for `getAbsoluteLocaleUrl` / `getRelativeLocaleUrl`. */
export function localeUrlPath(path: string): string {
  return path === '/' ? '' : path;
}
