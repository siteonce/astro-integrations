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

const relativeLocaleUrl = (locale: string, path = '') => `/${locale}${path ? `/${path}` : ''}/`;

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
        getRelativeLocaleUrl: relativeLocaleUrl,
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
          getRelativeLocaleUrl: relativeLocaleUrl,
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
      getRelativeLocaleUrl: relativeLocaleUrl,
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
          getRelativeLocaleUrl: relativeLocaleUrl,
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
        getRelativeLocaleUrl: relativeLocaleUrl,
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

type UrlCall = { locale: string; path: string | undefined };

const entryCollections: Record<string, CollectionEntryLike[]> = {
  blog: [
    { id: 'hello-en', collection: 'blog', data: { id: 'hello', locale: 'en', slug: 'hello' } },
    { id: 'hello-de', collection: 'blog', data: { id: 'hello', locale: 'de', slug: 'hallo' } },
    { id: 'only-en', collection: 'blog', data: { id: 'only', locale: 'en', slug: 'only' } },
  ],
  notes: [
    { id: 'one-en', collection: 'notes', data: { key: 'one', locale: 'en', slug: 'one' } },
    { id: 'one-de', collection: 'notes', data: { key: 'one', locale: 'de', slug: 'eins' } },
  ],
  pages: [
    { id: 'home-en', collection: 'pages', data: { id: 'home', locale: 'en' } },
    { id: 'home-de', collection: 'pages', data: { id: 'home', locale: 'de' } },
  ],
  authors: [{ id: 'ada-en', collection: 'authors', data: { id: 'ada', locale: 'en' } }],
  sources: [],
  roles: [],
};

function entryIntl(relativeCalls: UrlCall[] = [], absoluteCalls: UrlCall[] = []) {
  return createIntl(
    defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
        { slug: { en: 'notes/{slug}', de: 'notizen/{slug}' }, view: 'note', collection: 'notes' },
        { slug: { en: '/', de: '/' }, view: 'home', collection: { name: 'pages', entry: 'home' } },
      ],
      collections: {
        translated: ['blog', 'notes', 'pages', 'authors'],
        untranslated: ['sources', 'roles'],
        fields: { notes: { id: 'key' } },
      },
    }),
    {
      loaders: {
        getCollection: async (name) => {
          if (!(name in entryCollections)) throw new Error(`missing ${name}`);
          return entryCollections[name] ?? [];
        },
        getRelativeLocaleUrl: (locale, path) => {
          relativeCalls.push({ locale, path });
          return `rel:${locale}:${path ?? ''}`;
        },
        getAbsoluteLocaleUrl: (locale, path) => {
          absoluteCalls.push({ locale, path });
          return `abs:${locale}:${path ?? ''}`;
        },
      },
    },
  );
}

describe('entry urls', () => {
  it('returns the relative url of a translated routed relation', async () => {
    const relativeCalls: UrlCall[] = [];
    const intl = entryIntl(relativeCalls);
    assert.equal(
      await intl.getRelativeEntryUrl('de', { target: 'blog', id: 'hello' }),
      'rel:de:artikel/hallo',
    );
    assert.deepEqual(relativeCalls, [{ locale: 'de', path: 'artikel/hallo' }]);
  });

  it('returns the url of an entry', async () => {
    const intl = entryIntl();
    assert.equal(
      await intl.getRelativeEntryUrl('en', {
        id: 'hello-en',
        collection: 'blog',
        data: { id: 'hello', locale: 'en', slug: 'hello' },
      }),
      'rel:en:blog/hello',
    );
  });

  it('resolves an entry whose pairing id field is renamed', async () => {
    const intl = entryIntl();
    assert.equal(
      await intl.getRelativeEntryUrl('de', {
        id: 'one-de',
        collection: 'notes',
        data: { key: 'one', locale: 'de', slug: 'eins' },
      }),
      'rel:de:notizen/eins',
    );
  });

  it('returns undefined when the asked locale has no sibling', async () => {
    const relativeCalls: UrlCall[] = [];
    const intl = entryIntl(relativeCalls);
    assert.equal(await intl.getRelativeEntryUrl('de', { target: 'blog', id: 'only' }), undefined);
    assert.deepEqual(relativeCalls, []);
  });

  it('returns undefined for a record', async () => {
    const relativeCalls: UrlCall[] = [];
    const intl = entryIntl(relativeCalls);
    assert.equal(await intl.getRelativeEntryUrl('en', { target: 'authors', id: 'ada' }), undefined);
    assert.deepEqual(relativeCalls, []);
  });

  it('throws when the target is not translated or the entry has no collection', async () => {
    const intl = entryIntl();
    await assert.rejects(
      () => intl.getRelativeEntryUrl('en', { target: 'sources', id: 'astro' }),
      /@repo\/astro-intl: collection "sources" is not in collections\.translated\./,
    );
    await assert.rejects(
      () => intl.getRelativeEntryUrl('en', { target: 'ghost', id: 'x' }),
      /@repo\/astro-intl: collection "ghost" is not in collections\.translated\./,
    );
    await assert.rejects(
      () =>
        intl.getRelativeEntryUrl('en', {
          id: 'astro',
          collection: 'sources',
          data: { id: 'astro' },
        }),
      /@repo\/astro-intl: collection "sources" is not in collections\.translated\./,
    );
    await assert.rejects(
      () => intl.getRelativeEntryUrl('en', { id: 'x', data: { id: 'hello' } }),
      /@repo\/astro-intl: entry has no collection\./,
    );
  });

  it('calls the relative loader with an empty path for the home tail', async () => {
    const relativeCalls: UrlCall[] = [];
    const intl = entryIntl(relativeCalls);
    assert.equal(await intl.getRelativeEntryUrl('en', { target: 'pages', id: 'home' }), 'rel:en:');
    assert.deepEqual(relativeCalls, [{ locale: 'en', path: '' }]);
  });

  it('builds an absolute url through getAbsoluteLocaleUrl', async () => {
    const relativeCalls: UrlCall[] = [];
    const absoluteCalls: UrlCall[] = [];
    const intl = entryIntl(relativeCalls, absoluteCalls);
    assert.equal(
      await intl.getAbsoluteEntryUrl('en', { target: 'blog', id: 'hello' }),
      'abs:en:blog/hello',
    );
    assert.deepEqual(absoluteCalls, [{ locale: 'en', path: 'blog/hello' }]);
    assert.deepEqual(relativeCalls, []);
  });
});

describe('localeSwitcherLinks', () => {
  it('omits href when a sibling is missing', async () => {
    const intl = entryIntl();
    assert.deepEqual(await intl.localeSwitcherLinks('en', 'blog/only'), [
      { locale: 'en', current: true, sibling: true },
      { locale: 'de', current: false, sibling: false },
    ]);
  });

  it('omits href on the current locale', async () => {
    const intl = entryIntl();
    const links = await intl.localeSwitcherLinks('en', 'blog/hello');
    assert.deepEqual(links, [
      { locale: 'en', current: true, sibling: true },
      { locale: 'de', current: false, sibling: true, href: 'rel:de:artikel/hallo' },
    ]);
    assert.equal(links[0]?.href, undefined);
  });

  it('reports no siblings for an unknown path', async () => {
    const relativeCalls: UrlCall[] = [];
    const intl = entryIntl(relativeCalls);
    assert.deepEqual(await intl.localeSwitcherLinks('en', 'missing'), [
      { locale: 'en', current: true, sibling: false },
      { locale: 'de', current: false, sibling: false },
    ]);
    assert.deepEqual(relativeCalls, []);
  });

  it('links each other locale to its home url', async () => {
    const relativeCalls: UrlCall[] = [];
    const intl = entryIntl(relativeCalls);
    assert.deepEqual(await intl.localeSwitcherLinks('en', '/'), [
      { locale: 'en', current: true, sibling: true },
      { locale: 'de', current: false, sibling: true, href: 'rel:de:' },
    ]);
    assert.deepEqual(await intl.localeSwitcherLinks('de', '/'), [
      { locale: 'en', current: false, sibling: true, href: 'rel:en:' },
      { locale: 'de', current: true, sibling: true },
    ]);
    assert.deepEqual(relativeCalls, [
      { locale: 'de', path: '' },
      { locale: 'en', path: '' },
    ]);
  });
});
