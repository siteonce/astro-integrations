import { createIntl } from '@siteonce/astro-intl';
import intlConfig from '../intl.config.ts';

// Intl's page helpers, bound once to this app's intl config. Re-exports
// `viewProps`, `Relation`, `localizedValue`, and `Locale` from `@siteonce/astro-intl`,
// and `locales` and `defaultLocale` from `@siteonce/astro-intl/runtime`. Server-only,
// since it pulls `/runtime`: client islands and the content config must not import it.
export const {
  entryPaths,
  listingPaths,
  staticPaths,
  fallbackPaths,
  getRelated,
  hreflangLinks,
  getRelativeEntryUrl,
  getAbsoluteEntryUrl,
  localeSwitcherLinks,
} = createIntl(intlConfig);

export { type Locale, localizedValue, type Relation, viewProps } from '@siteonce/astro-intl';
export { defaultLocale, locales } from '@siteonce/astro-intl/runtime';
