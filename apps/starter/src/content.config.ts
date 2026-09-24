import { defineCollection } from 'astro:content';
import { id, leafSlug, locale, localized, relation, slug } from '@repo/astro-intl';
import { blog } from '@repo/astro-site/schemas/content/blog';
import { seo } from '@repo/astro-site/schemas/content/seo';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import intlConfig from './intl.config.ts';
import { slugify } from './utils/slugify.ts';

// Entry id is the file path without its extension. Pairing uses data.id, not this id.
function entryFileId({ entry }: { entry: string }) {
  return entry.replace(/\.(md|mdx|json)$/u, '');
}

const posts = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/blog',
    generateId: entryFileId,
  }),
  schema: blog
    .extend({
      id,
      locale,
      slug,
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
  schema: seo.extend({ id, locale, slug }).superRefine(leafSlug({ slugify })),
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
    name: localized(z.string().min(1), intlConfig.locales),
  }),
});

export const collections = { blog: posts, tags, authors, sources, roles };
