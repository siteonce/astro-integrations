import type { RouteConfig } from '@repo/astro-intl';

// Data only. The leading underscore keeps Astro from treating this file as an endpoint.
export const routes: RouteConfig[] = [
  { id: 'home', slug: { en: '/', de: '/' } },
  { id: 'blog', slug: { en: 'blog', de: 'artikel' } },
  { id: 'posts', slug: { en: 'blog', de: 'artikel' }, collection: 'blog' },
  { id: 'terms', slug: { en: 'tags', de: 'schlagworte' }, collection: 'tags' },
];
