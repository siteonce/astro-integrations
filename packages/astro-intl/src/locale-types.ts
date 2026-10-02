/** Filename passed to `injectTypes`. Astro writes it under `.astro/integrations/`. */
export const LOCALE_TYPES_FILENAME = 'intl-locales.d.ts';

/**
 * Module augmentation that sets `IntlRegister['locale']` to this config's locales
 * and, when the config names collections, `IntlRegister['entries']` to those entries.
 * `export {}` keeps the file a module, so `declare module` augments `@repo/astro-intl`
 * instead of replacing it. No collection names means no `entries` key.
 */
export function localeTypeDeclaration(
  locales: readonly string[],
  collections: readonly string[],
): string {
  const localeUnion = locales.map((locale) => JSON.stringify(locale)).join(' | ');
  const lines = [
    "declare module '@repo/astro-intl' {",
    '  interface IntlRegister {',
    `    locale: ${localeUnion};`,
  ];
  if (collections.length > 0) {
    const names = collections.map((name) => JSON.stringify(name)).join(' | ');
    lines.push(`    entries: { [C in ${names}]: import('astro:content').CollectionEntry<C> };`);
  }
  lines.push('  }', '}', 'export {};', '');
  return lines.join('\n');
}
