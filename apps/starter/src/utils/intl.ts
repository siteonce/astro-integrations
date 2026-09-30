import { createIntl } from '@repo/astro-intl';
import intlConfig from '../intl.config.ts';

// Intl's page helpers, bound once to this app's intl config.
export const {
  entryPaths,
  listingPaths,
  staticPaths,
  fallbackPaths,
  getRelated,
  getContentByPath,
  getAlternatePaths,
  getAlternatePathsForPath,
  getPairedSlugs,
  getSitemapEntries,
  hreflangLinks,
} = createIntl(intlConfig);
