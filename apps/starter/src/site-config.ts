// Site-wide values. Per-page or per-entry values are props or frontmatter.
//
// Parsed on import against the astro-site schema. `sitemap` and `robots`
// carry schema `.prefault()` defaults, so omitting them here is intentional.
import { siteConfigSchema } from '@repo/astro-site/schemas/config/site-config';

export const siteConfig = siteConfigSchema.parse({
  siteName: 'Astro Stack',
  siteUrl: 'https://example.com',
  social: {},
  externalLink: {
    exceptions: [],
  },
});
