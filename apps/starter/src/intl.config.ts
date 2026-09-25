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
  // `view` and `missingView` name views. Intl injects one route per row and locale.
  routes: routes.map(({ slug, view, collection, pageSize, missingView }) => ({
    slug,
    view,
    ...(collection ? { collection } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
    ...(missingView ? { missingView } : {}),
  })),
  collections: {
    blog: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    tags: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    authors: { idField: 'id', localeField: 'locale' },
  },
});
