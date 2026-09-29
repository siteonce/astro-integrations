import { getRelativeLocaleUrl } from 'astro:i18n';
import { getAlternatePaths } from '@repo/astro-intl';

// Compiled public hrefs for one locale. Any collection, keyed by pairing id.
export function createLinks(locale: string) {
  // Stored before the lookup resolves so a shared id is looked up once.
  const hrefs = new Map<string, Promise<string>>();

  function href(collection: string, id: string): Promise<string> {
    const key = `${collection}/${id}`;
    const cached = hrefs.get(key);
    if (cached) return cached;
    const pending = compiledHref(key);
    hrefs.set(key, pending);
    return pending;
  }

  async function compiledHref(key: string): Promise<string> {
    const compiled = (await getAlternatePaths(key))[locale];
    if (!compiled) {
      throw new Error(`starter: no compiled path for "${key}" in "${locale}".`);
    }
    return getRelativeLocaleUrl(locale, compiled);
  }

  return { href };
}
