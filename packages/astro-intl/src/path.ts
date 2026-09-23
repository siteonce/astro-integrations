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

/** Path argument for `getAbsoluteLocaleUrl` / `getRelativeLocaleUrl`. */
export function localeUrlPath(path: string): string {
  return path === '/' ? '' : path;
}
