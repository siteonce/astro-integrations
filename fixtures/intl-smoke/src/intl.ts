import { createIntl } from '@siteonce/astro-intl';
import type { IntlLoaders } from '@siteonce/astro-intl/create-intl';
import type { ShadowCandidate } from '@siteonce/astro-intl/shadowed-entries';
import intlConfig from './intl.config.ts';

// Named binding. Astro extracts `getStaticPaths` into its own module, and a
// local destructure in the view is not in scope there.
export const { entryPaths } = createIntl(intlConfig);

// Type-only, so `astro check` still loads the declarations for
// `@siteonce/astro-intl/create-intl` and `@siteonce/astro-intl/shadowed-entries`.
// The sitemap data route imports those subpaths, and that route is written
// under `.astro/`, outside this tsconfig's include.
export type { IntlLoaders, ShadowCandidate };
