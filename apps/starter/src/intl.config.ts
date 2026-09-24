import { defineIntl } from '@repo/astro-intl';
import { routes } from './pages/_routes.ts';
import { bindListingQuery } from './utils/listing.ts';

// Listing chunks use the starter listing query.
bindListingQuery();

export default defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: {
    prefixDefaultLocale: true,
  },
  messages: { dir: 'messages' },
  // `page` names the routed page. Intl receives tails, collection, entry, and pageSize.
  routes: routes.map(({ slug, collection, entry, pageSize }) => ({
    slug,
    ...(collection ? { collection } : {}),
    ...(entry ? { entry } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
  })),
  collections: {
    blog: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    tags: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    authors: { idField: 'id', localeField: 'locale' },
  },
});
