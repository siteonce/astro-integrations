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
  // `page` names the routed page. Intl receives the tails, page, collection, entry, and pageSize.
  routes: routes.map(({ slug, page, collection, entry, pageSize }) => ({
    slug,
    page,
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
