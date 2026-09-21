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
import { rehypeExternalLinks } from '@repo/astro-site/utils/rehype-external-links';
import ogImage from '@repo/og-image';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { ogConfig } from './src/og.config.ts';
import { siteConfig } from './src/site.config.ts';

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
    ogImage({ config: ogConfig }),
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
