import { getCollection } from 'astro:content';
import { getAbsoluteLocaleUrl } from 'astro:i18n';
import rss from '@astrojs/rss';
import { getAlternatePathsForPath, getSitemapEntries, setIntlConfig } from '@repo/astro-intl';
import { persistIntlSitemapEntries } from '@repo/astro-intl-sitemap';
import type { APIRoute } from 'astro';
import intlConfig from '../../intl.config.ts';
import { siteConfig } from '../../site.config.ts';
import { t } from '../../t.ts';

// Page bundles do not share the integration's in-memory runtime.
setIntlConfig(intlConfig);

// Per-locale feed. Channel copy from catalogs; item links from intl pairing.
export const prerender = true;

export function getStaticPaths() {
  return intlConfig.locales.map((locale) => ({ params: { locale } }));
}

export const GET: APIRoute = async (context) => {
  const locale = context.params.locale ?? context.currentLocale ?? intlConfig.defaultLocale;
  const entries = await getSitemapEntries();
  persistIntlSitemapEntries(entries);

  const byPath = new Map(
    entries.filter((entry) => entry.locale === locale).map((entry) => [entry.path, entry]),
  );

  const posts = (await getCollection('blog'))
    .filter((post) => post.data.locale === locale && post.data.status === 'published')
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const items = await Promise.all(
    posts.map(async (post) => {
      const tails = await getAlternatePathsForPath(locale, post.data.slug);
      const tail = tails[locale];
      const loc = byPath.get(post.data.slug)?.loc;
      return {
        title: post.data.seoTitle,
        description: post.data.excerpt,
        pubDate: post.data.pubDate,
        link: loc ?? (tail ? getAbsoluteLocaleUrl(locale, tail) : getAbsoluteLocaleUrl(locale)),
      };
    }),
  );

  return rss({
    title: t(locale, 'blog.title'),
    description: t(locale, 'blog.description'),
    site: context.site ?? siteConfig.siteUrl,
    items,
    customData: `<language>${locale}</language>`,
  });
};
