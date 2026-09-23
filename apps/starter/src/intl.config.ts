import { defineIntl } from '@repo/astro-intl';
import { routes } from './pages/_routes.ts';

export default defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: {
    prefixDefaultLocale: true,
  },
  messages: { dir: 'messages' },
  // `page` names a starter template. Intl receives the pairing fields.
  routes: routes.map(({ slug, collection, entry }) => ({
    collection,
    slug,
    ...(entry ? { entry } : {}),
  })),
  collections: {
    pages: { idField: 'id', localeField: 'locale' },
    blog: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    tags: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    authors: { idField: 'id', localeField: 'locale' },
  },
});
