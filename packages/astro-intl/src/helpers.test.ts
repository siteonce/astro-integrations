import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defineIntl } from './define-intl.ts';
import {
  getAlternatePaths,
  getDocumentHead,
  getSitemapEntries,
  hreflangLinks,
  resetIntlQuery,
  setIntlLoaders,
} from './helpers.ts';
import type { CollectionEntryLike } from './pairing.ts';
import { setIntlConfig } from './runtime.ts';

describe('getSitemapEntries / getAlternatePaths / Hreflang', () => {
  it('pairs fixture collections through the public helpers', async () => {
    const config = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      collections: {
        blog: { pathPrefix: 'blog' },
        authors: {},
      },
    });
    const collections: Record<string, CollectionEntryLike[]> = {
      blog: [
        {
          id: 'hello-en',
          data: { id: 'hello-world', locale: 'en', slug: 'hello-world' },
        },
        {
          id: 'hello-de',
          data: { id: 'hello-world', locale: 'de', slug: 'hallo-welt' },
        },
      ],
      authors: [{ id: 'ada-en', data: { id: 'ada', locale: 'en' } }],
    };
    setIntlConfig(config);
    setIntlLoaders({
      getCollection: async (name) => collections[name] ?? [],
      getAbsoluteLocaleUrl: (locale, path = '') =>
        `https://example.com/${locale}${path ? `/${path}` : ''}`,
    });
    try {
      assert.deepEqual(await getAlternatePaths('blog/hello-world'), {
        en: 'blog/hello-world',
        de: 'blog/hallo-welt',
      });
      const sitemap = await getSitemapEntries();
      assert.equal(sitemap.length, 2);
      const head = await getDocumentHead({ locale: 'en', path: 'blog/hello-world' });
      const links = hreflangLinks(head);
      assert.ok(links.some((link) => link.hreflang === 'x-default'));
      assert.ok(links.some((link) => link.href.includes('/de/blog/hallo-welt')));
    } finally {
      setIntlLoaders(undefined);
      setIntlConfig(undefined);
      resetIntlQuery();
    }
  });
});
