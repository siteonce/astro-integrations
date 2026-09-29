import { defineIntl, type LocaleOf } from '@repo/astro-intl';
import { routes } from './routes.config.ts';

const intl = defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  // `false` (also the default): the default locale's home is `/`, and nothing else
  // may sit at `/`. Startup fails on a page or redirect there.
  // `true`: every locale is prefixed, and the app must serve `/`. For example,
  // add `redirects: { '/': '/<defaultLocale>/' }` in `astro.config.mjs`.
  // Startup fails otherwise. See `docs/product/intl.md`.
  routing: {
    prefixDefaultLocale: false,
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
    // Paired on id + locale. A collection on a `{slug}` row is routed.
    translated: ['posts', 'tags', 'authors'],
    // Relation targets looked up by file id.
    untranslated: ['sources', 'roles'],
  },
});

export type Locale = LocaleOf<typeof intl>;

export default intl;
