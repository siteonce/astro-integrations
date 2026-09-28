import type { RouteConfig } from '@repo/astro-intl';

// Data only. `view` names a view under `src/views/`.
// A string names one view for every locale. An object names one per locale.
// `pagination` publishes the later pages. Its `slug` is the full tail per locale,
// and `{page}` is the number. Page 1 is this row's `slug`. `pagination.view`
// defaults to the row's view. Omit `pagination` and the row stays that one tail.
// `fallbackView` on a `{slug}` row replaces the one in `intl.config.ts`.
// `false` means that row's untranslated URLs 404.
export type StarterRoute = RouteConfig;

export const routes: StarterRoute[] = [
  {
    slug: { en: '/', de: '/' },
    view: 'home',
  },
  {
    // Page 1 is this slug. Later pages replace `{page}`. The view orders the posts.
    slug: { en: 'blog', de: 'artikel' },
    collection: 'posts',
    view: 'blog',
    pagination: {
      pageSize: 1,
      slug: { en: 'blog/{page}', de: 'artikel/{page}' },
    },
  },
  {
    slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
    collection: 'posts',
    view: 'blog/post',
  },
  {
    slug: { en: 'tags/{slug}', de: 'schlagworte/{slug}' },
    collection: 'tags',
    view: 'tags/term',
  },
];
