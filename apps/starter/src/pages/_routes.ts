import type { RouteConfig } from '@repo/astro-intl';

// Data only. `page` names a routed page under `src/pages/_pages/` and stays in the starter.
// A string names one routed page for every locale. An object names one per locale.
// `pageSize` is how many entries fill one chunk of a collection tail.
// The leading underscore keeps Astro from treating this file as an endpoint.
export type StarterRoute = RouteConfig & {
  page: string | Record<string, string>;
};

export const routes: StarterRoute[] = [
  {
    slug: { en: '/', de: '/' },
    page: 'home',
  },
  {
    slug: { en: 'blog', de: 'artikel' },
    collection: 'blog',
    page: 'listing',
    pageSize: 10,
  },
  {
    slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
    collection: 'blog',
    page: 'post',
  },
  {
    slug: { en: 'tags/{slug}', de: 'schlagworte/{slug}' },
    collection: 'tags',
    page: 'term',
  },
];
