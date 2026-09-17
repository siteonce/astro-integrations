/**
 * Default missing-locale chain for the catch-all. Redirect, never rewrite
 * another locale's document at this URL.
 *
 * 1. Default-locale sibling by entryId (the requested path may be that
 *    sibling's compiled path).
 * 2. Home in the requested locale, if that home document exists.
 * 3. Not found.
 */

export type MissingLocaleResult = { kind: 'redirect'; href: string } | { kind: 'not-found' };

type EntryLike = { data: { id?: unknown } };

export async function missingLocaleChain(args: {
  locale: string;
  path: string;
  defaultLocale: string;
  getContentByPath: (locale: string, path: string) => Promise<EntryLike | undefined>;
  getAlternatePaths: (entryId: string) => Promise<Record<string, string>>;
  hrefFor: (locale: string, path?: string) => string;
}): Promise<MissingLocaleResult> {
  const { locale, path, defaultLocale, getContentByPath, getAlternatePaths, hrefFor } = args;

  if (locale !== defaultLocale) {
    const fallback = await getContentByPath(defaultLocale, path);
    const entryId = typeof fallback?.data.id === 'string' ? fallback.data.id : undefined;
    if (entryId) {
      const sibling = (await getAlternatePaths(entryId))[defaultLocale];
      if (sibling !== undefined) {
        return {
          kind: 'redirect',
          href: hrefFor(defaultLocale, sibling === '/' ? undefined : sibling),
        };
      }
    }
  }

  if (await getContentByPath(locale, '/')) {
    return { kind: 'redirect', href: hrefFor(locale) };
  }

  return { kind: 'not-found' };
}
