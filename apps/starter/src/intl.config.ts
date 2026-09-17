import { defineIntl } from '@repo/astro-intl';

export default defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: {
    prefixDefaultLocale: true,
  },
  messages: { dir: 'messages' },
  collections: {
    blog: {
      pathPrefix: 'blog',
    },
  },
});
