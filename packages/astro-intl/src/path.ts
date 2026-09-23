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
