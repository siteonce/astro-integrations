/** Filename passed to `injectTypes`. Astro writes it under `.astro/integrations/`. */
export const LOCALE_TYPES_FILENAME = 'intl-locales.d.ts';

/**
 * Module augmentation that sets `IntlRegister['locale']` to this config's locales.
 * `export {}` keeps the file a module, so `declare module` augments `@repo/astro-intl`
 * instead of replacing it.
 */
export function localeTypeDeclaration(locales: readonly string[]): string {
  const union = locales.map((locale) => JSON.stringify(locale)).join(' | ');
  return [
    "declare module '@repo/astro-intl' {",
    '  interface IntlRegister {',
    `    locale: ${union};`,
    '  }',
    '}',
    'export {};',
    '',
  ].join('\n');
}
