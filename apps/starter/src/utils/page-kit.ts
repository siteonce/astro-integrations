import { type CollectionEntry, getCollection } from 'astro:content';
import { getRelativeLocaleUrl } from 'astro:i18n';
import { getAlternatePaths, localeSwitcherLinks, type Relation } from '@repo/astro-intl';
import intlConfig from '../intl.config.ts';
import { resolveFeatImage } from './feat-image.ts';
import { listingEntries } from './listing.ts';
import { localeFolder } from './locale-folder.ts';
import { useTranslations } from './t.ts';

type Post = CollectionEntry<'posts'>;

// Helpers for one view: catalog, compiled hrefs, listing posts, and the
// locale switcher. A compiled href is read on first use and reused for that id.
export function createPageKit(locale: string) {
  const t = useTranslations(locale);
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });
  // Stored before the lookup resolves so a shared tag is fetched once.
  const hrefs = new Map<string, Promise<string>>();

  function href(collection: string, id: string): Promise<string> {
    const key = `${collection}/${id}`;
    const cached = hrefs.get(key);
    if (cached) return cached;
    const pending = compiledHref(key);
    hrefs.set(key, pending);
    return pending;
  }

  async function compiledHref(key: string): Promise<string> {
    const compiled = (await getAlternatePaths(key))[locale];
    if (!compiled) {
      throw new Error(`starter: no compiled path for "${key}" in "${locale}".`);
    }
    return getRelativeLocaleUrl(locale, compiled);
  }

  async function terms(tags: readonly Relation[]) {
    return Promise.all(
      tags.map(async (tag) => {
        const catalogKey = `taxonomy.blogTags.${tag.id}`;
        const value = t(catalogKey);
        return {
          href: await href('tags', tag.id),
          label: value === catalogKey ? tag.id : value,
        };
      }),
    );
  }

  async function postItem(post: Post) {
    const src = resolveFeatImage(localeFolder(post), post.data.featImage);
    return {
      href: await href('posts', post.data.id),
      title: post.data.seoTitle,
      excerpt: post.data.excerpt,
      datetime: post.data.pubDate.toISOString(),
      dateLabel: dateFmt.format(post.data.pubDate),
      image: src ? { src, alt: post.data.featImageAlt } : undefined,
      terms: await terms(post.data.tags),
    };
  }

  async function posts() {
    return listingEntries(await getCollection('posts'), locale);
  }

  function switcher(alternates: Record<string, string>) {
    return localeSwitcherLinks(intlConfig.locales, locale, alternates, (code, tail) =>
      tail ? getRelativeLocaleUrl(code, tail) : getRelativeLocaleUrl(code),
    );
  }

  return { locale, t, href, terms, postItem, posts, switcher };
}

export type PageKit = ReturnType<typeof createPageKit>;
