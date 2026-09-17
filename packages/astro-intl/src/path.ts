/**
 * Compile a routed entry's runtime `path` (URL tail after the locale prefix).
 * `pathPrefix` is a compile helper, not routing config.
 */

export function normalizeSlug(slug: string): string {
  if (slug === '' || slug === '/') return '/';
  return slug.replace(/^\/+/u, '').replace(/\/+$/u, '');
}

export function prefixFor(
  pathPrefix: string | Record<string, string> | undefined,
  locale: string,
): string | undefined {
  if (pathPrefix === undefined) return undefined;
  if (typeof pathPrefix === 'string') return pathPrefix;
  return pathPrefix[locale];
}

export function compilePath(
  pathPrefix: string | Record<string, string> | undefined,
  locale: string,
  slug: string,
): string {
  const normalized = normalizeSlug(slug);
  const prefix = prefixFor(pathPrefix, locale);
  if (prefix === undefined) return normalized;
  if (normalized === '/') {
    throw new Error(`@repo/astro-intl: slug "/" cannot combine with pathPrefix "${prefix}".`);
  }
  return `${prefix.replace(/\/+$/u, '')}/${normalized}`;
}

/** Path argument for `getAbsoluteLocaleUrl` / `getRelativeLocaleUrl`. */
export function localeUrlPath(path: string): string {
  return path === '/' ? '' : path;
}
