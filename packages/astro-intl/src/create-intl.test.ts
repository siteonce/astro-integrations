import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { createIntl } from './create-intl.ts';
import { defineIntl, type IntlConfigInput } from './define-intl.ts';
import type { CollectionEntryLike } from './pairing.ts';
import { localized, recordedRelationNames, relation } from './relation.ts';

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

const absoluteLocaleUrl = (locale: string, path = '') =>
  `https://example.com/${locale}${path ? `/${path}` : ''}`;

function createFixture(collections: Record<string, CollectionEntryLike[]>, loaded?: string[]) {
  return createIntl(
    defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
      collections: intlCollections,
    }),
    {
      loaders: {
        getCollection: async (name) => {
          loaded?.push(name);
          if (!(name in collections)) throw new Error(`missing ${name}`);
          return collections[name] ?? [];
        },
        getAbsoluteLocaleUrl: absoluteLocaleUrl,
      },
    },
  );
}

describe('getSitemapEntries / getAlternatePaths', () => {
  it('pairs fixture collections through the factory', async () => {
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
    const intl = createIntl(
      defineIntl({
        locales: ['en', 'de'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: true },
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
        ],
        collections: intlCollections,
      }),
      {
        loaders: {
          getCollection: async (name) => collections[name] ?? [],
          getAbsoluteLocaleUrl: absoluteLocaleUrl,
        },
      },
    );
    assert.deepEqual(await intl.getAlternatePaths('blog/hello-world'), {
      en: 'blog/hello-world',
      de: 'artikel/hallo-welt',
    });
    const sitemap = await intl.getSitemapEntries();
    assert.equal(sitemap.length, 2);
    assert.equal(sitemap[0]?.xDefault, 'https://example.com/en/blog/hello-world');
    assert.equal(sitemap[1]?.xDefault, 'https://example.com/en/blog/hello-world');
    assert.equal('x-default' in (sitemap[0]?.alternates ?? {}), false);
  });
});

describe('two factories', () => {
  it('returns different paths for different configs', async () => {
    const blog = [
      { id: 'hello-en', data: { id: 'hello', locale: 'en', slug: 'hello' } },
      { id: 'hello-de', data: { id: 'hello', locale: 'de', slug: 'hallo' } },
    ];
    const loaders = {
      getCollection: async (name: string) => (name === 'blog' ? blog : []),
      getAbsoluteLocaleUrl: absoluteLocaleUrl,
    };
    const posts = createIntl(
      defineIntl({
        locales: ['en', 'de'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: true },
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
        ],
        collections: intlCollections,
      }),
      { loaders },
    );
    const news = createIntl(
      defineIntl({
        locales: ['en', 'de'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: true },
        routes: [
          {
            slug: { en: 'news/{slug}', de: 'nachrichten/{slug}' },
            view: 'x',
            collection: 'blog',
          },
        ],
        collections: intlCollections,
      }),
      { loaders },
    );
    assert.deepEqual(await posts.getAlternatePaths('blog/hello'), {
      en: 'blog/hello',
      de: 'artikel/hallo',
    });
    assert.deepEqual(await news.getAlternatePaths('blog/hello'), {
      en: 'news/hello',
      de: 'nachrichten/hallo',
    });
  });
});

describe('first load', () => {
  it('shares one load across concurrent first calls', async () => {
    const translated = ['blog', 'authors'];
    const untranslated = ['sources', 'roles'];
    const blog = [
      { id: 'hello-en', data: { id: 'hello', locale: 'en', slug: 'hello' } },
      { id: 'hello-de', data: { id: 'hello', locale: 'de', slug: 'hallo' } },
    ];
    let calls = 0;
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const intl = createIntl(
      defineIntl({
        locales: ['en', 'de'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: true },
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
        ],
        collections: { translated, untranslated },
      }),
      {
        loaders: {
          getCollection: async (name) => {
            calls += 1;
            await gate;
            return name === 'blog' ? blog : [];
          },
          getAbsoluteLocaleUrl: absoluteLocaleUrl,
        },
      },
    );
    const first = intl.getPairedSlugs();
    const second = intl.getSitemapEntries();
    assert.equal(calls, 1);
    release();
    await Promise.all([first, second]);
    assert.equal(calls, translated.length + untranslated.length);
  });
});

describe('createIntl config', () => {
  it('throws the prettified Zod error for an invalid config', () => {
    assert.throws(
      () =>
        createIntl({
          locales: ['en'],
          defaultLocale: 'en',
          routing: { prefixDefaultLocale: 'no' },
        } as unknown as IntlConfigInput),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /^@repo\/astro-intl: intl config failed validation\.\n/);
        assert.match(error.message, /expected boolean, received string/);
        assert.match(error.message, /routing\.prefixDefaultLocale/);
        return true;
      },
    );
  });
});

describe('hreflangLinks', () => {
  const intl = createIntl(
    defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog', de: 'artikel' }, view: 'x' },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
      collections: intlCollections,
    }),
    {
      loaders: {
        getCollection: async (name) => {
          if (name !== 'blog') return [];
          return [
            { id: 'hello-en', data: { id: 'hello-world', locale: 'en', slug: 'hello-world' } },
            { id: 'hello-de', data: { id: 'hello-world', locale: 'de', slug: 'hallo-welt' } },
            { id: 'nur-de', data: { id: 'nur', locale: 'de', slug: 'nur-deutsch' } },
          ];
        },
        getAbsoluteLocaleUrl: absoluteLocaleUrl,
      },
    },
  );

  it('returns alternates and x-default for an entry', async () => {
    assert.deepEqual(await intl.hreflangLinks('de', 'artikel/hallo-welt'), [
      { hreflang: 'de', href: 'https://example.com/de/artikel/hallo-welt' },
      { hreflang: 'en', href: 'https://example.com/en/blog/hello-world' },
      { hreflang: 'x-default', href: 'https://example.com/en/blog/hello-world' },
    ]);
  });

  it('returns a published tail with no entry, including x-default', async () => {
    assert.deepEqual(await intl.hreflangLinks('en', 'blog'), [
      { hreflang: 'de', href: 'https://example.com/de/artikel' },
      { hreflang: 'en', href: 'https://example.com/en/blog' },
      { hreflang: 'x-default', href: 'https://example.com/en/blog' },
    ]);
  });

  it('returns every locale at an unknown path, including x-default', async () => {
    assert.deepEqual(await intl.hreflangLinks('en', 'missing/path'), [
      { hreflang: 'de', href: 'https://example.com/de/missing/path' },
      { hreflang: 'en', href: 'https://example.com/en/missing/path' },
      { hreflang: 'x-default', href: 'https://example.com/en/missing/path' },
    ]);
  });

  it('omits x-default when the default locale has no tail', async () => {
    assert.deepEqual(await intl.hreflangLinks('de', 'artikel/nur-deutsch'), [
      { hreflang: 'de', href: 'https://example.com/de/artikel/nur-deutsch' },
    ]);
    const nur = (await intl.getSitemapEntries()).find((item) => item.entryId === 'blog/nur');
    assert.equal(nur?.xDefault, undefined);
    assert.deepEqual(nur?.alternates, {
      de: 'https://example.com/de/artikel/nur-deutsch',
    });
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
    const intl = createFixture({ blog, authors, sources, roles });
    const author = await intl.getRelated('de', authorRel);
    assert.equal(author.data.name, 'Ada DE');
    const source = await intl.getRelated('de', sourceRel);
    assert.equal(source.data.name, 'Astro');
    const role = await intl.getRelated('de', roleRel);
    assert.equal(role.data.name, 'Redakteur');
  });

  it('fails when a listed sibling is missing in the source locale', async () => {
    const intl = createFixture({ blog, authors: [authors[0]], sources, roles });
    await assert.rejects(intl.getPairedSlugs(), /relation authors\/ada is missing locale "de"/);
  });

  it('fails when an untranslated entry id is missing', async () => {
    const intl = createFixture({ blog, authors, sources: [], roles });
    await assert.rejects(intl.getPairedSlugs(), /relation sources\/astro is missing/);
  });

  it('matches an untranslated collection by entry id, not data.id', async () => {
    const intl = createFixture({
      blog,
      authors,
      sources: [{ id: 'file-astro', data: { id: 'astro', name: 'Astro' } }],
      roles,
    });
    await assert.rejects(intl.getPairedSlugs(), /relation sources\/astro is missing/);
  });

  it('ignores an unbranded { target, id } lookalike', async () => {
    const loaded: string[] = [];
    const intl = createFixture(
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
    await intl.getPairedSlugs();
    assert.equal(loaded.includes('ghost'), false);
  });

  it('does not fetch a collection that was not loaded at assert time', async () => {
    const loaded: string[] = [];
    const intl = createFixture({ blog, authors, sources, roles }, loaded);
    await intl.getPairedSlugs();
    const count = loaded.length;
    await assert.rejects(
      () => intl.getRelated('en', { target: 'ghost', id: 'x' }),
      /collection "ghost" is not a content collection/,
    );
    assert.equal(loaded.length, count);
  });

  it('throws when relation() recorded a collection neither list names', async () => {
    relation('not-listed');
    const intl = createFixture({ blog, authors, sources, roles });
    try {
      await assert.rejects(
        intl.getPairedSlugs(),
        /relation\("not-listed"\) points at a collection neither collections\.translated nor collections\.untranslated lists/,
      );
    } finally {
      const recorded = (globalThis as Record<symbol, Set<string> | undefined>)[
        Symbol.for('@repo/astro-intl/related-targets')
      ];
      recorded?.delete('not-listed');
    }
    assert.equal(recordedRelationNames().includes('not-listed'), false);
  });
});
