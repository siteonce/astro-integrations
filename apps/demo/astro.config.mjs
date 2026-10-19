import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import astroIntl from '@siteonce/astro-intl';
import { defineConfig } from 'astro/config';
import intlConfig from './src/intl.config.ts';
import { siteConfig } from './src/site.config.ts';

// The demo runs intl from src/ so edits show without a build. The smoke test
// covers dist/. `source` is added in front of the conditions Vite and Astro
// already set for each environment, including client and SSR. Replacing the
// list would drop conditions such as `astro`.
function sourceCondition() {
  return {
    name: 'intl-source-condition',
    enforce: 'post',
    configEnvironment(_name, environment) {
      const conditions = environment.resolve?.conditions;
      if (conditions == null || conditions.includes('source')) return;
      conditions.unshift('source');
    },
  };
}

// Pages the sitemap leaves out: feeds and robots.txt.
function sitemapFilter(page) {
  const path = new URL(page).pathname;
  if (/(?:^|\/)rss\.xml\/?$/u.test(path)) return false;
  if (/(?:^|\/)robots\.txt\/?$/u.test(path)) return false;
  return true;
}

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

const intl = astroIntl(intlConfig);

export default defineConfig({
  site: siteConfig.siteUrl,
  trailingSlash: 'always',
  image: {
    remotePatterns: mediaRemotePatterns(),
  },
  vite: {
    plugins: [sourceCondition()],
  },
  integrations: [
    intl,
    mdx(),
    svelte(),
    sitemap({
      ...intl.sitemap,
      filter: (page) => intl.sitemap.filter(page) && sitemapFilter(page),
    }),
  ],
});
