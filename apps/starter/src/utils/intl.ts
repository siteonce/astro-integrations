import { createIntl } from '@repo/astro-intl';
import intlConfig from '../intl.config.ts';

// Intl's page helpers, bound once to this app's intl config. `viewProps`,
// `Relation`, and `localizedValue` are re-exported so views import intl from this file.
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
