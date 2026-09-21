import { defineCollection } from 'astro:content';
import {
  id,
  listingLocaleSection,
  locale,
  localeSection,
  localized,
  relation,
  slug,
} from '@repo/astro-intl';
import { blog } from '@repo/astro-site/schemas/content/blog';
import { seo } from '@repo/astro-site/schemas/content/seo';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import intlConfig from './intl.config.ts';
import { slugify } from './utils/slugify.ts';

const pairing = { id, locale, slug };

// Translatable public-tail prefixes. Listing slug and post/term prefix share
// the same list so they stay aligned. Extra rows are more prefixes, not a tree.
const blogSection = [{ en: 'blog', de: 'artikel' }] as const;
const tagsSection = [{ en: 'tags', de: 'schlagworte' }] as const;

// Glob defaults to data.slug as the collection id, which collides for paired
// entries that share a slug (homepage `/`). Pairing id is data.id prefixed
// with the collection name, not this generateId.
function entryFileId({ entry }: { entry: string }) {
  return entry.replace(/\.(md|mdx|json)$/u, '');
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
  schema: blog
    .extend({
      ...pairing,
      author: relation('authors').optional(),
      client: relation('clients').optional(),
      role: relation('roles').optional(),
    })
    .superRefine(localeSection(blogSection, 'entry', { slugify })),
});

// Term pages: a routed tags collection with locale + slug.
const tags = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/tags',
    generateId: entryFileId,
  }),
  schema: seo.extend(pairing).superRefine(localeSection(tagsSection, 'entry', { slugify })),
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

// Locale-free lookup. Filename is the pairing id. Out of intl pairing.
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

// Inline locale maps on one file. Filename is the pairing id. Out of intl pairing.
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
