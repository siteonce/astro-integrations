import { defineCollection } from 'astro:content';
import { id, locale, slug } from '@repo/astro-intl';
import { blog } from '@repo/astro-site/schemas/content/blog';
import { seo } from '@repo/astro-site/schemas/content/seo';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const pairing = { id, locale, slug };

// Glob defaults to data.slug as the collection id, which collides for paired
// entries that share a slug (homepage `/`). Pairing uses frontmatter `id`.
function entryFileId({ entry }: { entry: string }) {
  return entry.replace(/\.(md|mdx)$/u, '');
}

const pages = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/pages',
    generateId: entryFileId,
  }),
  schema: seo.extend({
    ...pairing,
    // Starter convention. intl does not know page types.
    pageType: z.enum(['home', 'listing']),
  }),
});

const posts = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/blog',
    generateId: entryFileId,
  }),
  schema: blog.extend(pairing),
});

// Term pages: marketing's locale-free tag catalog re-authored with id + locale + slug.
const tags = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/tags',
    generateId: entryFileId,
  }),
  schema: seo.extend(pairing),
});

const authors = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/authors',
    generateId: entryFileId,
  }),
  schema: z.object({
    id,
    locale,
    name: z.string().min(1),
  }),
});

export const collections = { pages, blog: posts, tags, authors };
