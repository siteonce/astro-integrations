import type { RouteConfig } from '@repo/astro-intl';

// Data only. `view` names a view under `src/views/`.
// A string names one view for every locale. An object names one per locale.
// `pageSize` is how many entries fill one chunk. The page-1 row publishes
// that tail. The `{page}` row publishes the later pages. Omit `pageSize`
// and the row stays that one tail.
// `fallbackView` on a `{slug}` row replaces the one in `intl.config.ts`.
// `false` means that row's untranslated URLs 404.
export type StarterRoute = RouteConfig;

export const routes: StarterRoute[] = [
  {
    slug: { en: '/', de: '/' },
    view: 'home',
  },
  {
    // Page 1. Posts that fill these pages come from `listingQuery` in `utils/listing.ts`.
    slug: { en: 'blog', de: 'artikel' },
    collection: 'blog',
    view: 'blog',
    pageSize: 1,
  },
  {
    // Pages 2 onward. The number replaces `{page}`.
    slug: { en: 'blog/{page}', de: 'artikel/{page}' },
    collection: 'blog',
    view: 'blog',
    pageSize: 1,
  },
  {
    slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
    collection: 'blog',
    view: 'blog/post',
  },
  {
    slug: { en: 'tags/{slug}', de: 'schlagworte/{slug}' },
    collection: 'tags',
    view: 'tags/term',
  },
];
