import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
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

const srcDir = fileURLToPath(new URL('.', import.meta.url));

const printerImport = /(?:from|import)\s*\(?['"]@astrojs\/(?:sitemap|rss)['"]/;
const siteImport = /@repo\/astro-site/;

describe('intl helpers source', () => {
  it('does not import @astrojs/sitemap, @astrojs/rss, or @repo/astro-site', () => {
    for (const name of readdirSync(srcDir)) {
      if (name.endsWith('.test.ts')) continue;
      const source = readFileSync(new URL(name, import.meta.url), 'utf8');
      assert.doesNotMatch(source, printerImport, name);
      assert.doesNotMatch(source, siteImport, name);
      assert.doesNotMatch(source, /github-slugger/, name);
    }
  });

  it('emits alternate and x-default from Hreflang', () => {
    const source = readFileSync(new URL('./hreflang.astro', import.meta.url), 'utf8');
    assert.match(source, /rel="alternate"/);
    assert.match(source, /hreflang/);
    assert.match(source, /hreflangLinks/);
    assert.match(source, /getDocumentHead/);
  });
});

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
