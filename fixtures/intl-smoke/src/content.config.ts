import { defineCollection } from 'astro:content';
import { id, leafSlug, locale, slug } from '@siteonce/astro-intl';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Entry id is the file path without its extension. Pairing uses data.id, not this id.
function entryFileId({ entry }: { entry: string }) {
  return entry.replace(/\.(md|mdx|json)$/u, '');
}

const posts = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/posts',
    generateId: entryFileId,
  }),
  schema: z
    .object({
      id,
      locale,
      slug,
      title: z.string().min(1),
    })
    .superRefine(leafSlug()),
});

export const collections = { posts };
