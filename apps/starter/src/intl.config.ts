import { defineIntl, type LocaleOf } from '@repo/astro-intl';
import { routes } from './routes.config.ts';

const intl = defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  // `true` means the site root is the app's (see the redirect in `astro.config.mjs`).
  // `false` means the default locale's home is `/`; remove that redirect then.
  routing: {
    prefixDefaultLocale: true,
  },
  // View for a `{slug}` URL whose entry has no translation in that locale, on
  // every `{slug}` row. `views/fallback.astro` redirects to the default-locale entry.
  fallbackView: 'fallback',
  // `view` and `fallbackView` name views. A row with `pagination` injects two routes per locale.
  routes: routes.map(({ slug, view, collection, pagination, fallbackView }) => ({
    slug,
    view,
    ...(collection ? { collection } : {}),
    ...(pagination !== undefined ? { pagination } : {}),
    ...(fallbackView !== undefined ? { fallbackView } : {}),
  })),
  collections: {
    posts: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    tags: { idField: 'id', localeField: 'locale', slugField: 'slug' },
    authors: { idField: 'id', localeField: 'locale' },
  },
  // Every collection a relation can point at.
  relationTargets: ['authors', 'sources', 'roles', 'tags'],
});

export type Locale = LocaleOf<typeof intl>;

export default intl;
