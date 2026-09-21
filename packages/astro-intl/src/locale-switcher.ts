export type LocaleSwitcherLink = {
  locale: string;
  current: boolean;
  sibling: boolean;
  href?: string;
};

/**
 * Switcher facts for chrome. A missing sibling has no href — the app decides
 * whether to disable, hide, or fall back.
 */
export function localeSwitcherLinks(
  locales: readonly string[],
  currentLocale: string,
  alternates: Record<string, string>,
  hrefFor: (locale: string, path?: string) => string,
): LocaleSwitcherLink[] {
  return locales.map((locale) => {
    const current = locale === currentLocale;
    const sibling = Object.hasOwn(alternates, locale);
    const path = sibling ? alternates[locale] : undefined;
    const item: LocaleSwitcherLink = { locale, current, sibling };
    if (sibling && !current) {
      item.href = hrefFor(locale, path === '/' ? undefined : path);
    }
    return item;
  });
}
