/**
 * Locale-switcher hrefs for chrome. A missing sibling falls back to that
 * locale's homepage (`path` omitted from `hrefFor`).
 */
export function localeSwitcherLinks(
  locales: readonly string[],
  currentLocale: string,
  alternates: Record<string, string>,
  hrefFor: (locale: string, path?: string) => string,
): { locale: string; href: string; current: boolean }[] {
  return locales.map((locale) => {
    const sibling = Object.hasOwn(alternates, locale) ? alternates[locale] : undefined;
    return {
      locale,
      href: hrefFor(locale, sibling === '/' ? undefined : sibling),
      current: locale === currentLocale,
    };
  });
}
