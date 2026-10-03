import { createIntl } from '@repo/astro-intl';
import intlConfig from '../intl.config.ts';

// Intl's page helpers, bound once to this app's intl config. Re-exports
// `viewProps`, `Relation`, and `localizedValue` from `@repo/astro-intl`,
// and `locales` and `defaultLocale` from `@repo/astro-intl/runtime`. Server-only,
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

export { localizedValue, type Relation, viewProps } from '@repo/astro-intl';
export { defaultLocale, locales } from '@repo/astro-intl/runtime';
