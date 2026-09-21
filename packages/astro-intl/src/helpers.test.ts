import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defineIntl } from './define-intl.ts';
import {
  getAlternatePaths,
  getDocumentHead,
  getRelated,
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

  it('resolves listed and locale-free relations through getRelated', async () => {
    const config = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      collections: {
        blog: { slugField: 'slug' },
        authors: {},
      },
    });
    const collections: Record<string, CollectionEntryLike[]> = {
      blog: [
        {
          id: 'hello-en',
          data: {
            id: 'hello-world',
            locale: 'en',
            slug: 'blog/hello-world',
            author: { collection: 'authors', id: 'ada' },
            client: { collection: 'clients', id: 'acme' },
          },
        },
        {
          id: 'hello-de',
          data: {
            id: 'hello-world',
            locale: 'de',
            slug: 'artikel/hallo-welt',
            author: { collection: 'authors', id: 'ada' },
            client: { collection: 'clients', id: 'acme' },
          },
        },
      ],
      authors: [
        { id: 'ada-en', data: { id: 'ada', locale: 'en', name: 'Ada' } },
        { id: 'ada-de', data: { id: 'ada', locale: 'de', name: 'Ada DE' } },
      ],
      clients: [{ id: 'acme', data: { name: 'Acme' } }],
    };
    setIntlConfig(config);
    setIntlLoaders({
      getCollection: async (name) => {
        if (!(name in collections)) throw new Error(`missing ${name}`);
        return collections[name] ?? [];
      },
      getAbsoluteLocaleUrl: (locale, path = '') =>
        `https://example.com/${locale}${path ? `/${path}` : ''}`,
    });
    try {
      const author = await getRelated('de', { collection: 'authors', id: 'ada' });
      assert.equal(author.data.name, 'Ada DE');
      const client = await getRelated('de', { collection: 'clients', id: 'acme' });
      assert.equal(client.data.name, 'Acme');
    } finally {
      setIntlLoaders(undefined);
      setIntlConfig(undefined);
      resetIntlQuery();
    }
  });
});
