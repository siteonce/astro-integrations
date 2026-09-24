import { defineIntl } from '@repo/astro-intl';
import { routes } from './pages/_routes.ts';

export default defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: {
    prefixDefaultLocale: true,
  },
  messages: { dir: 'messages' },
  // `page` names the routed page. Intl receives tails, plus collection and entry when a collection claims the tail.
  routes: routes.map(({ slug, collection, entry }) => ({
    slug,
    ...(collection ? { collection } : {}),
    ...(entry ? { entry } : {}),
  })),
  collections: {
    blog: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    tags: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    authors: { idField: 'id', localeField: 'locale' },
  },
});
