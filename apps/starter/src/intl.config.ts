import { defineIntl } from '@repo/astro-intl';

export default defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: {
    prefixDefaultLocale: true,
  },
  messages: { dir: 'messages' },
  collections: {
    pages: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    blog: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    tags: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    authors: { idField: 'id', localeField: 'locale' },
  },
});
