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
  // View for a `{slug}` URL whose entry has no translation in that locale, on
  // every `{slug}` row. `views/fallback.astro` redirects to the default-locale entry.
  fallbackView: 'fallback',
  // `view` and `fallbackView` name views. Intl injects one route per row and locale.
  routes: routes.map(({ slug, view, collection, pageSize, fallbackView }) => ({
    slug,
    view,
    ...(collection ? { collection } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
    ...(fallbackView !== undefined ? { fallbackView } : {}),
  })),
  collections: {
    blog: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    tags: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    authors: { idField: 'id', localeField: 'locale' },
  },
  // Every collection a relation can point at.
  relationTargets: ['authors', 'sources', 'roles', 'tags'],
});
