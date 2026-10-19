/**
 * String locales from Astro's `i18n` value. `astroIntl()` writes only strings.
 * A missing `i18n` means the integration is not registered.
 */
export type AstroI18nInput =
  | {
      defaultLocale?: unknown;
      locales?: unknown;
    }
  | null
  | undefined;

export function narrowAstroI18n(i18n: AstroI18nInput): {
  locales: readonly string[];
  defaultLocale: string;
} {
  if (i18n == null) {
    throw new Error(
      '@siteonce/astro-intl: Astro i18n is missing. Register astroIntl() before reading locales.',
    );
  }
  if (!Array.isArray(i18n.locales) || i18n.locales.length === 0) {
    throw new Error(
      '@siteonce/astro-intl: Astro i18n has no locales. Register astroIntl() before reading locales.',
    );
  }
  const locales: string[] = [];
  for (const locale of i18n.locales) {
    if (typeof locale !== 'string' || locale.length === 0) {
      throw new Error(
        '@siteonce/astro-intl: Astro i18n locales must be strings. astroIntl() only writes string locales.',
      );
    }
    locales.push(locale);
  }
  if (typeof i18n.defaultLocale !== 'string' || !locales.includes(i18n.defaultLocale)) {
    throw new Error(
      '@siteonce/astro-intl: Astro i18n defaultLocale is missing or not one of locales.',
    );
  }
  return { locales, defaultLocale: i18n.defaultLocale };
}
