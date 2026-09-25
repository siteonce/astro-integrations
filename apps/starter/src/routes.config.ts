import type { RouteConfig } from '@repo/astro-intl';

// Data only. `page` names a routed page under `src/routes/`.
// A string names one routed page for every locale. An object names one per locale.
// `pageSize` is how many entries fill one chunk of a collection tail.
// `missingPage` names the routed page for a locale without a translation.
// Omitting it means those URLs 404.
export type StarterRoute = RouteConfig;

export const routes: StarterRoute[] = [
  {
    slug: { en: '/', de: '/' },
    page: 'home',
  },
  {
    // Posts that fill these pages come from `listingQuery` in `utils/listing.ts`.
    slug: { en: 'blog', de: 'artikel' },
    collection: 'blog',
    page: 'blog',
    pageSize: 1,
  },
  {
    slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
    collection: 'blog',
    page: 'blog/post',
    missingPage: 'missing',
  },
  {
    slug: { en: 'tags/{slug}', de: 'schlagworte/{slug}' },
    collection: 'tags',
    page: 'tags/term',
    missingPage: 'missing',
  },
];
