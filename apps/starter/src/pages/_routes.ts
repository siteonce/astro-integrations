import type { RouteConfig } from '@repo/astro-intl';

// Data only. `page` names a routed page under `src/pages/_pages/` and stays in the starter.
// A string names one routed page for every locale. An object names one per locale.
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
    page: 'listing',
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
