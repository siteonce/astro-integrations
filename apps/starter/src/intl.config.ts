import { defineIntl } from '@repo/astro-intl';

export default defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: {
    prefixDefaultLocale: true,
  },
  messages: { dir: 'messages' },
  entryId: 'collectionFolder',
  collections: {
    pages: {
      slugField: 'slug',
    },
    blog: {
      slugField: 'slug',
    },
    tags: {
      slugField: 'slug',
    },
    authors: {},
  },
});
