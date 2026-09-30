import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import astroIntl from '@repo/astro-intl';
import {
  collectIntlSitemapPages,
  intlSitemapPages,
  serializeSitemap,
  sitemapFilter,
} from '@repo/astro-intl-sitemap';
// biome-ignore lint/correctness/noUnusedImports: used by the commented-out ogImage integration
import ogImage from '@repo/astro-og-image';
import { rehypeExternalLinks } from '@repo/astro-site/utils/rehype-external-links';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
// biome-ignore lint/correctness/noUnusedImports: used by the commented-out ogImage integration
import intlConfig from './src/intl.config.ts';
// biome-ignore lint/correctness/noUnusedImports: used by the commented-out ogImage integration
import { ogConfig } from './src/og.config.ts';
import { siteConfig } from './src/site.config.ts';
// biome-ignore lint/correctness/noUnusedImports: used by the commented-out ogImage integration
import { deployClass } from './src/utils/deploy.ts';
// biome-ignore lint/correctness/noUnusedImports: used by the commented-out ogImage integration
import { catalogs } from './src/utils/t.ts';

// Allow the editorial-media host when MEDIA_BASE_URL is a valid origin.
function mediaRemotePatterns() {
  const base = process.env.MEDIA_BASE_URL;
  if (!base) return [];
  try {
    const url = new URL(base);
    if (!url.protocol || !url.hostname) return [];
    return [{ protocol: url.protocol.replace(/:$/, ''), hostname: url.hostname }];
  } catch {
    return [];
  }
}

export default defineConfig({
  site: siteConfig.siteUrl,
  trailingSlash: 'always',
  image: {
    remotePatterns: mediaRemotePatterns(),
  },
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    processor: unified({
      rehypePlugins: [
        [
          rehypeExternalLinks,
          {
            siteUrl: siteConfig.siteUrl,
            exceptions: siteConfig.externalLink.exceptions,
          },
        ],
      ],
    }),
  },
  integrations: [
    astroIntl(),
    // TODO: Add ogImage back in once fixed
    // ogImage({
    //   config: ogConfig,
    //   siteConfig,
    //   deployClass,
    //   intlConfig,
    //   catalogs,
    // }),
    mdx(),
    svelte(),
    partytown({
      config: {
        forward: ['dataLayer.push'],
      },
    }),
    collectIntlSitemapPages,
    sitemap({
      customPages: intlSitemapPages,
      filter: sitemapFilter,
      serialize: serializeSitemap,
    }),
  ],
});
