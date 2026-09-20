import { defineCollection } from 'astro:content';
import { locale, slug } from '@repo/astro-intl';
import { blog } from '@repo/astro-site/schemas/content/blog';
import { seo } from '@repo/astro-site/schemas/content/seo';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { listingLocaleSection, localeSection } from './utils/locale-section.ts';

const pairing = { locale, slug };

// Translatable public-tail prefixes. Listing slug and post/term prefix share
// the same list so they stay aligned. Extra rows are more prefixes, not a tree.
const blogSection = [{ en: 'blog', de: 'artikel' }] as const;
const tagsSection = [{ en: 'tags', de: 'schlagworte' }] as const;

// Glob defaults to data.slug as the collection id, which collides for paired
// entries that share a slug (homepage `/`). Pairing id is collection/folder,
// not this generateId.
function entryFileId({ entry }: { entry: string }) {
  return entry.replace(/\.(md|mdx)$/u, '');
}

const pages = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/pages',
    generateId: entryFileId,
  }),
  schema: seo
    .extend({
      ...pairing,
      // Starter convention. intl does not know page types.
      pageType: z.enum(['home', 'listing']),
    })
    .superRefine(listingLocaleSection({ blog: blogSection })),
});

const posts = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/blog',
    generateId: entryFileId,
  }),
  schema: blog.extend(pairing).superRefine(localeSection(blogSection, 'entry')),
});

// Term pages: marketing's locale-free tag catalog re-authored with locale + slug.
const tags = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/tags',
    generateId: entryFileId,
  }),
  schema: seo.extend(pairing).superRefine(localeSection(tagsSection, 'entry')),
});

const authors = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/authors',
    generateId: entryFileId,
  }),
  schema: z.object({
    locale,
    name: z.string().min(1),
  }),
});

export const collections = { pages, blog: posts, tags, authors };
