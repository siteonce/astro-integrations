import type { RouteConfig } from '@repo/astro-intl';

// Data only. `page` names a file under `_pages/` and stays in the starter.
// The leading underscore keeps Astro from treating this file as an endpoint.
type StarterRoute = RouteConfig & { page: string };

export const routes: StarterRoute[] = [
  {
    slug: { en: '/', de: '/' },
    collection: 'pages',
    entry: 'home',
    page: 'home',
  },
  {
    slug: { en: 'blog', de: 'artikel' },
    collection: 'pages',
    entry: 'blog',
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
