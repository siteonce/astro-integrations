import { defineIntl, setListingEntries } from '@repo/astro-intl';
import { routes } from './routes.config.ts';
import { listingQuery } from './utils/listing.ts';

// Blog listing pages: that locale's published posts, drafts in local/preview,
// newest first. Other collections keep that locale.
setListingEntries(listingQuery);

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
