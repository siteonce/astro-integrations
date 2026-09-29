import { type CollectionEntry, getCollection } from 'astro:content';
import type { Relation } from '@repo/astro-intl';
import type { ImageMetadata } from 'astro';
import { createLinks } from './links.ts';
import { useTranslations } from './t.ts';

type Post = CollectionEntry<'posts'>;

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
export function createPosts(locale: string) {
  const t = useTranslations(locale);
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });
  const links = createLinks(locale);

  function dateLabel(post: Post) {
    return dateFmt.format(post.data.pubDate);
  }

  /** Resolved feat image. Undefined only when the src cannot be resolved. */
  function image(post: Post) {
    const src = resolveFeatImage(localeFolder(post), post.data.featImage);
    return src ? { src, alt: post.data.featImageAlt } : undefined;
  }

  async function terms(tags: readonly Relation[]) {
    return Promise.all(
      tags.map(async (tag) => {
        const catalogKey = `taxonomy.blogTags.${tag.id}`;
        const value = t(catalogKey);
        return {
          href: await links.href('tags', tag.id),
          label: value === catalogKey ? tag.id : value,
        };
      }),
    );
  }

  /** Compiled href of a post in this locale. */
  function href(post: { data: { id: string } }) {
    return links.href('posts', post.data.id);
  }

  async function item(post: Post) {
    return {
      href: await href(post),
      title: post.data.seoTitle,
      excerpt: post.data.excerpt,
      datetime: post.data.pubDate.toISOString(),
      dateLabel: dateLabel(post),
      image: image(post),
      terms: await terms(post.data.tags),
    };
  }

  /** That locale's posts, in no order. */
  async function list() {
    return (await getCollection('posts')).filter((post) => post.data.locale === locale);
  }

  return { list, item, image, dateLabel, terms, href };
}
