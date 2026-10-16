import type { CollectionEntry } from 'astro:content';
import { byDate, byText, type Compare, sortBy } from '@repo/astro-intl/sorting';

/**
 * Newest `pubDate` first. Same-day posts fall back to pairing id, so every build and locale
 * agrees. Collation stays `en` because pairing ids are slugs, not reader-facing text.
 */
export const postsNewestFirst: Compare<CollectionEntry<'posts'>> = sortBy(
  byDate((post) => post.data.pubDate, 'desc'),
  byText((post) => post.data.id, 'en', 'asc'),
);
