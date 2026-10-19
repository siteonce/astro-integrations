import astroIntl from '@siteonce/astro-intl';
import { defineConfig } from 'astro/config';
import intlConfig from './src/intl.config.ts';

// This fixture is built from the packed tarball. It does not add the `source`
// condition, so Vite and Node load dist/.
const intl = astroIntl(intlConfig);

export default defineConfig({
  site: 'https://example.com',
  trailingSlash: 'always',
  integrations: [intl],
});
