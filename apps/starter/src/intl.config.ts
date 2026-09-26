import { defineIntl, setListingEntries } from '@repo/astro-intl';
import { routes } from './routes.config.ts';
import { listingQuery } from './utils/listing.ts';

// Blog listing pages: that locale's posts, newest first. Other collections keep
// that locale. The blog loader drops drafts outside local and preview.
setListingEntries(listingQuery);

export default defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: {
    prefixDefaultLocale: true,
  },
  messages: { dir: 'messages' },
  // View for a locale without a translation, on every `{slug}` row.
  missingView: 'missing',
  // `view` and `missingView` name views. Intl injects one route per row and locale.
  routes: routes.map(({ slug, view, collection, pageSize, missingView }) => ({
    slug,
    view,
    ...(collection ? { collection } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
    ...(missingView !== undefined ? { missingView } : {}),
  })),
  collections: {
    blog: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    tags: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    authors: { idField: 'id', localeField: 'locale' },
  },
});
