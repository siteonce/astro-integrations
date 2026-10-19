import { defineCollection } from 'astro:content';
import { createIntlSchema, id, leafSlug, locale, slug } from '@siteonce/astro-intl';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
// `astro:config/server` does not resolve while Astro loads this file.
import intlConfig from './intl.config.ts';
import { deployClass } from './utils/deploy.ts';
import { withoutDrafts } from './utils/drafts.ts';
import { slugify } from './utils/slugify.ts';

const { relation, localized } = createIntlSchema(intlConfig);

// Entry id is the file path without its extension. Pairing uses data.id, not this id.
function entryFileId({ entry }: { entry: string }) {
  return entry.replace(/\.(md|mdx|json)$/u, '');
}

// Drafts exist in local and preview only. Everything that reads the collection sees the same set.
const keepDrafts = deployClass !== 'production';

const posts = defineCollection({
  loader: withoutDrafts(
    glob({
      pattern: '**/*.{md,mdx}',
      base: './src/content/posts',
      generateId: entryFileId,
    }),
    keepDrafts,
  ),
  // Fields the views, the feed, and the draft filter read.
  schema: z
    .object({
      id,
      locale,
      slug,
      seoTitle: z.string().min(1),
      seoDesc: z.string().min(1),
      excerpt: z.string().min(1),
      pubDate: z.coerce.date(),
      status: z.enum(['draft', 'published']),
      // A URL, or a co-located relative path (`./feat.png`), so not z.url().
      featImage: z.string().min(1),
      featImageAlt: z.string().min(1),
      author: relation('authors').optional(),
      source: relation('sources').optional(),
      role: relation('roles').optional(),
      tags: z.array(relation('tags')).default([]),
    })
    .superRefine(leafSlug({ slugify })),
});

// Term pages: a routed tags collection with locale + slug.
const tags = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/tags',
    generateId: entryFileId,
  }),
  schema: z
    .object({
      id,
      locale,
      slug,
      seoTitle: z.string().min(1),
      seoDesc: z.string().min(1),
    })
    .superRefine(leafSlug({ slugify })),
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

// Cited pages. Locale-free: the id is the filename, and name and url stay the same in every language.
const sources = defineCollection({
  loader: glob({
    pattern: '*.json',
    base: './src/content/sources',
    generateId: entryFileId,
  }),
  schema: z.object({
    name: z.string().min(1),
    url: z.string().min(1),
  }),
});

const roles = defineCollection({
  loader: glob({
    pattern: '*.json',
    base: './src/content/roles',
    generateId: entryFileId,
  }),
  schema: z.object({
    name: localized(z.string().min(1)),
  }),
});

export const collections = { posts, tags, authors, sources, roles };
