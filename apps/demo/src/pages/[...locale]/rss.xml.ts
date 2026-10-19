import { getCollection } from 'astro:content';
import { getRelativeLocaleUrl } from 'astro:i18n';
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { siteConfig } from '../../site.config.ts';
import { getAbsoluteEntryUrl, type Locale, locales } from '../../utils/intl.ts';
import { postsNewestFirst } from '../../utils/sorting.ts';
import { t } from '../../utils/t.ts';

// The feed follows each locale's home. Channel copy from catalogs; item links from intl pairing.
export const prerender = true;

export function getStaticPaths() {
  return locales.map((locale) => {
    const segment = getRelativeLocaleUrl(locale).replace(/^\/+|\/+$/g, '');
    return {
      params: { locale: segment === '' ? undefined : segment },
      props: { locale },
    };
  });
}

export const GET: APIRoute<{ locale: Locale }> = async (context) => {
  const locale = context.props.locale;

  const posts = (await getCollection('posts'))
    .filter((post) => post.data.locale === locale && post.data.status === 'published')
    .toSorted(postsNewestFirst);

  const items = (
    await Promise.all(
      posts.map(async (post) => {
        const link = await getAbsoluteEntryUrl(locale, post);
        if (link === undefined) {
          console.warn(`demo: no url for "${post.collection}/${post.data.id}" in "${locale}".`);
          return undefined;
        }
        return {
          title: post.data.seoTitle,
          description: post.data.excerpt,
          pubDate: post.data.pubDate,
          link,
        };
      }),
    )
  ).filter((item) => item !== undefined);

  return rss({
    title: t(locale, 'blog.title'),
    description: t(locale, 'blog.description'),
    site: context.site ?? siteConfig.siteUrl,
    items,
    customData: `<language>${locale}</language>`,
  });
};
