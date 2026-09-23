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

const pages = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/pages',
    generateId: entryFileId,
  }),
  schema: seo.extend({
    id,
    locale,
  }),
});

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
      client: relation('clients').optional(),
      role: relation('roles').optional(),
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

const clients = defineCollection({
  loader: glob({
    pattern: '*.json',
    base: './src/content/clients',
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

export const collections = { pages, blog: posts, tags, authors, clients, roles };
