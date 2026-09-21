/**
 * Default missing-locale chain for a catch-all. Redirect, never rewrite
 * another locale's document at this URL.
 *
 * 1. Default-locale document at this public tail (the requested path may be
 *    that sibling's path).
 * 2. Home in the requested locale, if that home document exists.
 * 3. Not found.
 *
 * Does not claim URLs. The app's getStaticPaths decides which paths exist.
 */

export type MissingLocaleResult = { kind: 'redirect'; href: string } | { kind: 'not-found' };

type EntryLike = { data?: unknown };

export async function missingLocaleChain(args: {
  locale: string;
  path: string;
  defaultLocale: string;
  getContentByPath: (locale: string, path: string) => Promise<EntryLike | undefined>;
  hrefFor: (locale: string, path?: string) => string;
}): Promise<MissingLocaleResult> {
  const { locale, path, defaultLocale, getContentByPath, hrefFor } = args;

  if (locale !== defaultLocale) {
    const fallback = await getContentByPath(defaultLocale, path);
    if (fallback) {
      return {
        kind: 'redirect',
        href: hrefFor(defaultLocale, path === '/' ? undefined : path),
      };
    }
  }

  if (await getContentByPath(locale, '/')) {
    return { kind: 'redirect', href: hrefFor(locale) };
  }

  return { kind: 'not-found' };
}
