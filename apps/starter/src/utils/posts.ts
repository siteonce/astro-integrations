import { type CollectionEntry, getCollection } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { getRelativeEntryUrl, type Locale, type Relation } from './intl.ts';
import { useTranslations } from './t.ts';

type Post = CollectionEntry<'posts'>;

// An entry ref intl can turn into a URL. `collection` is set on collection entries.
type EntryRef = {
  id: string;
  collection: string;
  data: { id: string };
};

// Editorial media is a URL in frontmatter. The demo may store a co-located
// relative path (`./feat.png`) so preview needs no cloud account.
const images = import.meta.glob<ImageMetadata>(
  '/src/content/posts/**/*.{png,jpg,jpeg,webp,avif,gif}',
  { eager: true, import: 'default' },
);

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function mediaBaseUrl(): string {
  return (process.env.MEDIA_BASE_URL ?? '').trim();
}

function joinMediaUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * Resolve featImage for a string `src`: local metadata URL, remote URL, or
 * undefined. `id` is the pairing folder (`hello-world`), not the collection
 * id (`hello-world/en`) — co-located files sit next to the locale files.
 */
function resolveFeatImage(id: string, featImage: string): string | undefined {
  if (isAbsoluteHttpUrl(featImage)) {
    return featImage;
  }

  // Demo co-located relative path — glob; do not invent a host.
  if (featImage.startsWith('./') || featImage.startsWith('../')) {
    const rel = featImage.replace(/^\.\//, '');
    const local = images[`/src/content/posts/${id}/${rel}`];
    return typeof local === 'string' ? local : local?.src;
  }

  const base = mediaBaseUrl();
  if (!base) return undefined;
  return joinMediaUrl(base, featImage);
}

/** Parent folder of a locale file (`hello-world/en.mdx` → `hello-world`). */
function localeFolder(entry: { id: string; filePath?: string }): string {
  const fromPath = parentDir(entry.filePath);
  if (fromPath) return fromPath;
  const parts = entry.id.replaceAll('\\', '/').split('/').filter(Boolean);
  const fromId = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  if (!fromId) {
    throw new Error(`starter: locale folder missing on ${entry.id}`);
  }
  return fromId;
}

function parentDir(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  const parts = filePath.replaceAll('\\', '/').split('/').filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : undefined;
}

// Dates, feat images, tag links, and list items for one locale's posts.
// A term, related post, or list item with no URL in this locale is omitted.
export function createPosts(locale: Locale) {
  const t = useTranslations(locale);
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });

  function omit(ref: string): undefined {
    console.warn(`starter: no url for "${ref}" in "${locale}".`);
    return undefined;
  }

  function dateLabel(post: Post) {
    return dateFmt.format(post.data.pubDate);
  }

  /** Resolved feat image. Undefined only when the src cannot be resolved. */
  function image(post: Post) {
    const src = resolveFeatImage(localeFolder(post), post.data.featImage);
    return src ? { src, alt: post.data.featImageAlt } : undefined;
  }

  /** URL of this entry in this locale. Undefined when the locale publishes none. */
  function href(post: EntryRef) {
    return getRelativeEntryUrl(locale, post);
  }

  async function terms(tags: readonly Relation[]) {
    const links = await Promise.all(
      tags.map(async (tag) => {
        const link = await getRelativeEntryUrl(locale, tag);
        if (link === undefined) return omit(`${tag.intlRelationTarget}/${tag.id}`);
        const catalogKey = `taxonomy.blogTags.${tag.id}`;
        const value = t(catalogKey);
        return {
          href: link,
          label: value === catalogKey ? tag.id : value,
        };
      }),
    );
    return links.filter((link) => link !== undefined);
  }

  async function item(post: Post) {
    const link = await href(post);
    if (link === undefined) return omit(`${post.collection}/${post.data.id}`);
    return {
      href: link,
      title: post.data.seoTitle,
      excerpt: post.data.excerpt,
      datetime: post.data.pubDate.toISOString(),
      dateLabel: dateLabel(post),
      image: image(post),
      terms: await terms(post.data.tags),
    };
  }

  /** List items for the posts in `list` that publish a URL in this locale. */
  async function items(list: readonly Post[]) {
    return (await Promise.all(list.map((post) => item(post)))).filter((post) => post !== undefined);
  }

  /** Related-post links. An entry with no URL in this locale is omitted. */
  async function related(entries: readonly (EntryRef & { data: { seoTitle: string } })[]) {
    return (
      await Promise.all(
        entries.map(async (entry) => {
          const link = await href(entry);
          if (link === undefined) return omit(`${entry.collection}/${entry.data.id}`);
          return { href: link, title: entry.data.seoTitle };
        }),
      )
    ).filter((entry) => entry !== undefined);
  }

  /** That locale's posts, in no order. */
  async function list() {
    return (await getCollection('posts')).filter((post) => post.data.locale === locale);
  }

  return { list, items, image, dateLabel, terms, related };
}
