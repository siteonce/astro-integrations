import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { defineIntl } from './define-intl.ts';
import {
  getAlternatePaths,
  getDocumentHead,
  getPairedSlugs,
  getRelated,
  getSitemapEntries,
  hreflangLinks,
  resetIntlQuery,
  setIntlLoaders,
} from './helpers.ts';
import type { CollectionEntryLike } from './pairing.ts';
import { localized, recordedRelationNames, relation } from './relation.ts';
import { setIntlConfig } from './runtime.ts';

const intlCollections = {
  translated: ['blog', 'authors'],
  untranslated: ['sources', 'roles'],
};

const locales = ['en', 'de'] as const;
const authorRel = relation('authors').parse('ada');
const sourceRel = relation('sources').parse('astro');
const roleRel = relation('roles').parse('editor');
const roleName = localized(z.string().min(1), locales).parse({
  en: 'Editor',
  de: 'Redakteur',
});

function withQuery(collections: Record<string, CollectionEntryLike[]>, loaded?: string[]): void {
  const config = defineIntl({
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
    routes: [{ slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' }],
    collections: intlCollections,
  });
  setIntlConfig(config);
  setIntlLoaders({
    getCollection: async (name) => {
      loaded?.push(name);
      if (!(name in collections)) throw new Error(`missing ${name}`);
      return collections[name] ?? [];
    },
    getAbsoluteLocaleUrl: (locale, path = '') =>
      `https://example.com/${locale}${path ? `/${path}` : ''}`,
  });
}

describe('getSitemapEntries / getAlternatePaths / Hreflang', () => {
  it('pairs fixture collections through the public helpers', async () => {
    const config = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
      collections: intlCollections,
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
        de: 'artikel/hallo-welt',
      });
      const sitemap = await getSitemapEntries();
      assert.equal(sitemap.length, 2);
      const head = await getDocumentHead({ locale: 'en', path: 'blog/hello-world' });
      const links = hreflangLinks(head);
      assert.ok(links.some((link) => link.hreflang === 'x-default'));
      assert.ok(links.some((link) => link.href.includes('/de/artikel/hallo-welt')));
    } finally {
      setIntlLoaders(undefined);
      setIntlConfig(undefined);
      resetIntlQuery();
    }
  });
});

describe('getRelated', () => {
  const blog = [
    {
      id: 'hello-en',
      data: {
        id: 'hello-world',
        locale: 'en',
        slug: 'hello-world',
        author: authorRel,
        source: sourceRel,
        role: roleRel,
      },
    },
    {
      id: 'hello-de',
      data: {
        id: 'hello-world',
        locale: 'de',
        slug: 'hallo-welt',
        author: authorRel,
        source: sourceRel,
        role: roleRel,
      },
    },
  ];
  const authors = [
    { id: 'ada-en', data: { id: 'ada', locale: 'en', name: 'Ada' } },
    { id: 'ada-de', data: { id: 'ada', locale: 'de', name: 'Ada DE' } },
  ];
  const sources = [{ id: 'astro', data: { name: 'Astro' } }];
  const roles = [{ id: 'editor', data: { name: roleName } }];

  it('returns a translated target in the current locale and an untranslated target by entry id', async () => {
    withQuery({ blog, authors, sources, roles });
    try {
      const author = await getRelated('de', authorRel);
      assert.equal(author.data.name, 'Ada DE');
      const source = await getRelated('de', sourceRel);
      assert.equal(source.data.name, 'Astro');
      const role = await getRelated('de', roleRel);
      assert.equal(role.data.name, 'Redakteur');
    } finally {
      setIntlLoaders(undefined);
      setIntlConfig(undefined);
      resetIntlQuery();
    }
  });

  it('fails when a listed sibling is missing in the source locale', async () => {
    withQuery({ blog, authors: [authors[0]], sources, roles });
    try {
      await assert.rejects(getPairedSlugs, /relation authors\/ada is missing locale "de"/);
    } finally {
      setIntlLoaders(undefined);
      setIntlConfig(undefined);
      resetIntlQuery();
    }
  });

  it('fails when an untranslated entry id is missing', async () => {
    withQuery({ blog, authors, sources: [], roles });
    try {
      await assert.rejects(getPairedSlugs, /relation sources\/astro is missing/);
    } finally {
      setIntlLoaders(undefined);
      setIntlConfig(undefined);
      resetIntlQuery();
    }
  });

  it('matches an untranslated collection by entry id, not data.id', async () => {
    withQuery({
      blog,
      authors,
      sources: [{ id: 'file-astro', data: { id: 'astro', name: 'Astro' } }],
      roles,
    });
    try {
      await assert.rejects(getPairedSlugs, /relation sources\/astro is missing/);
    } finally {
      setIntlLoaders(undefined);
      setIntlConfig(undefined);
      resetIntlQuery();
    }
  });

  it('ignores an unbranded { target, id } lookalike', async () => {
    const loaded: string[] = [];
    withQuery(
      {
        blog: [
          {
            id: 'hello-en',
            data: {
              id: 'hello-world',
              locale: 'en',
              slug: 'hello-world',
              author: authorRel,
              lookalike: { target: 'ghost', id: 'nope' },
            },
          },
        ],
        authors: [authors[0]],
        sources,
        roles,
      },
      loaded,
    );
    try {
      await getPairedSlugs();
      assert.equal(loaded.includes('ghost'), false);
    } finally {
      setIntlLoaders(undefined);
      setIntlConfig(undefined);
      resetIntlQuery();
    }
  });

  it('does not fetch a collection that was not loaded at assert time', async () => {
    const loaded: string[] = [];
    withQuery({ blog, authors, sources, roles }, loaded);
    try {
      await getPairedSlugs();
      const count = loaded.length;
      await assert.rejects(
        () => getRelated('en', { target: 'ghost', id: 'x' }),
        /collection "ghost" is not a content collection/,
      );
      assert.equal(loaded.length, count);
    } finally {
      setIntlLoaders(undefined);
      setIntlConfig(undefined);
      resetIntlQuery();
    }
  });

  it('throws when relation() recorded a collection neither list names', async () => {
    relation('not-listed');
    withQuery({ blog, authors, sources, roles });
    try {
      await assert.rejects(
        getPairedSlugs,
        /relation\("not-listed"\) points at a collection neither collections\.translated nor collections\.untranslated lists/,
      );
    } finally {
      const recorded = (globalThis as Record<symbol, Set<string> | undefined>)[
        Symbol.for('@repo/astro-intl/related-targets')
      ];
      recorded?.delete('not-listed');
      setIntlLoaders(undefined);
      setIntlConfig(undefined);
      resetIntlQuery();
    }
    assert.equal(recordedRelationNames().includes('not-listed'), false);
  });
});
