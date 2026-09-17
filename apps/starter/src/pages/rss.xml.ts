import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { siteConfig } from '../site-config.ts';

// Printer only — item data is not wired yet.
export const GET: APIRoute = (context) =>
  rss({
    title: siteConfig.siteName,
    description: siteConfig.siteName,
    site: context.site ?? siteConfig.siteUrl,
    items: [],
  });
