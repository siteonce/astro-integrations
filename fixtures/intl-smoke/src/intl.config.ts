import { defineIntl } from '@siteonce/astro-intl';

const intl = defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: {
    prefixDefaultLocale: false,
  },
  routes: [
    {
      slug: { en: 'posts/{slug}', de: 'artikel/{slug}' },
      collection: 'posts',
      view: 'post',
    },
  ],
  collections: {
    translated: ['posts'],
  },
});

export default intl;
