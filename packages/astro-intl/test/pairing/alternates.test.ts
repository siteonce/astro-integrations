import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl } from '@repo/astro-intl';
import {
  type CollectionEntry,
  collectionEntry,
  collectionLoaders,
  type IntlConfigInput,
  intlConfig,
  relation,
} from '../fixtures.ts';

type Routes = NonNullable<IntlConfigInput['routes']>;

function open(routes: Routes, collections: Readonly<Record<string, readonly CollectionEntry[]>>) {
  return createIntl(
    intlConfig({
      routes,
      collections: { translated: Object.keys(collections) },
    }),
    { loaders: collectionLoaders(collections) },
  );
}

const postRow = {
  slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
  view: 'post',
  collection: 'blog',
} as const;

function helloEntries(): CollectionEntry[] {
  return [
    collectionEntry('blog', 'hello-en', { id: 'hello-world', locale: 'en', slug: 'hello-world' }),
    collectionEntry('blog', 'hello-de', { id: 'hello-world', locale: 'de', slug: 'hallo-welt' }),
  ];
}

/** Two siblings on `blog/{slug}` and nothing else. */
function helloOnly() {
  return open([postRow], { blog: helloEntries() });
}

/**
 * Named pages at `/` and `blog`, routed blog entries, and an authors record.
 * The blog tail belongs to the named page entry.
 */
function namedPages() {
  return open(
    [
      { slug: { en: '/', de: '/' }, view: 'home', collection: { name: 'pages', entry: 'home' } },
      {
        slug: { en: 'blog', de: 'artikel' },
        view: 'index',
        collection: { name: 'pages', entry: 'blog' },
      },
      postRow,
    ],
    {
      pages: [
        collectionEntry('pages', 'home-en', { id: 'home', locale: 'en' }),
        collectionEntry('pages', 'home-de', { id: 'home', locale: 'de' }),
        collectionEntry('pages', 'blog-en', { id: 'blog', locale: 'en' }),
        collectionEntry('pages', 'blog-de', { id: 'blog', locale: 'de' }),
      ],
      blog: [
        ...helloEntries(),
        collectionEntry('blog', 'solo-en', { id: 'solo', locale: 'en', slug: 'solo' }),
      ],
      authors: [
        collectionEntry('authors', 'ada-en', { id: 'ada', locale: 'en', name: 'Ada' }),
        collectionEntry('authors', 'ada-de', { id: 'ada', locale: 'de', name: 'Ada' }),
      ],
    },
  );
}

/** `/` and `blog` publish no entry. Blog entries include one locale with no sibling. */
function openTails() {
  return open(
    [
      { slug: { en: '/', de: '/' }, view: 'home' },
      { slug: { en: 'blog', de: 'artikel' }, view: 'index' },
      postRow,
    ],
    {
      blog: [
        ...helloEntries(),
        collectionEntry('blog', 'solo-en', { id: 'solo', locale: 'en', slug: 'solo' }),
        collectionEntry('blog', 'nur-de', { id: 'nur', locale: 'de', slug: 'nur-deutsch' }),
      ],
    },
  );
}

describe('pairing', () => {
  it('publishes one sitemap row per sibling and keeps x-default out of the alternates', async () => {
    const intl = helloOnly();
    const hello = {
      de: 'https://example.com/de/artikel/hallo-welt',
      en: 'https://example.com/en/blog/hello-world',
    };

    assert.deepEqual(await intl.getAlternatePaths('blog/hello-world'), {
      en: 'blog/hello-world',
      de: 'artikel/hallo-welt',
    });
    assert.deepEqual(await intl.getSitemapEntries(), [
      {
        locale: 'de',
        path: 'artikel/hallo-welt',
        loc: hello.de,
        alternates: hello,
        xDefault: hello.en,
        entryId: 'blog/hello-world',
      },
      {
        locale: 'en',
        path: 'blog/hello-world',
        loc: hello.en,
        alternates: hello,
        xDefault: hello.en,
        entryId: 'blog/hello-world',
      },
    ]);
  });

  it('returns sibling tails and omits a locale with no entry', async () => {
    const intl = namedPages();

    assert.deepEqual(await intl.getAlternatePaths('blog/hello-world'), {
      en: 'blog/hello-world',
      de: 'artikel/hallo-welt',
    });
    assert.deepEqual(await intl.getAlternatePaths('pages/home'), { en: '/', de: '/' });
    assert.deepEqual(await intl.getAlternatePaths('home'), {});
    assert.deepEqual(await intl.getAlternatePathsForPath('en', '/'), { en: '/', de: '/' });
    assert.deepEqual(await intl.getAlternatePaths('blog/solo'), { en: 'blog/solo' });
    assert.equal((await intl.getContentByPath('en', 'blog/solo'))?.data.id, 'solo');
    assert.equal((await intl.getContentByPath('de', 'artikel/hallo-welt'))?.data.id, 'hello-world');
    assert.equal((await intl.getContentByPath('en', '/'))?.id, 'home-en');
    assert.equal((await intl.getContentByPath('en', 'blog'))?.data.id, 'blog');

    const ada = await intl.getRelated('de', relation('authors', 'ada'));
    assert.equal(ada.id, 'ada-de');
    assert.equal(ada.data.name, 'Ada');
    assert.deepEqual(await intl.getAlternatePaths('authors/ada'), {});
  });

  it('lists each published tail and one sitemap row per sibling', async () => {
    const intl = namedPages();
    const home = { de: 'https://example.com/de', en: 'https://example.com/en' };
    const blog = { de: 'https://example.com/de/artikel', en: 'https://example.com/en/blog' };
    const hello = {
      de: 'https://example.com/de/artikel/hallo-welt',
      en: 'https://example.com/en/blog/hello-world',
    };

    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: '/' },
      { locale: 'de', slug: 'artikel' },
      { locale: 'de', slug: 'artikel/hallo-welt' },
      { locale: 'en', slug: '/' },
      { locale: 'en', slug: 'blog' },
      { locale: 'en', slug: 'blog/hello-world' },
      { locale: 'en', slug: 'blog/solo' },
    ]);
    assert.deepEqual(await intl.getSitemapEntries(), [
      {
        locale: 'de',
        path: '/',
        loc: home.de,
        alternates: home,
        xDefault: home.en,
        entryId: 'pages/home',
      },
      {
        locale: 'de',
        path: 'artikel',
        loc: blog.de,
        alternates: blog,
        xDefault: blog.en,
        entryId: 'pages/blog',
      },
      {
        locale: 'de',
        path: 'artikel/hallo-welt',
        loc: hello.de,
        alternates: hello,
        xDefault: hello.en,
        entryId: 'blog/hello-world',
      },
      {
        locale: 'en',
        path: '/',
        loc: home.en,
        alternates: home,
        xDefault: home.en,
        entryId: 'pages/home',
      },
      {
        locale: 'en',
        path: 'blog',
        loc: blog.en,
        alternates: blog,
        xDefault: blog.en,
        entryId: 'pages/blog',
      },
      {
        locale: 'en',
        path: 'blog/hello-world',
        loc: hello.en,
        alternates: hello,
        xDefault: hello.en,
        entryId: 'blog/hello-world',
      },
      {
        locale: 'en',
        path: 'blog/solo',
        loc: 'https://example.com/en/blog/solo',
        alternates: { en: 'https://example.com/en/blog/solo' },
        xDefault: 'https://example.com/en/blog/solo',
        entryId: 'blog/solo',
      },
    ]);
  });

  it('returns hreflang links for the published sibling tails', async () => {
    const intl = openTails();

    assert.deepEqual(await intl.hreflangLinks('de', 'artikel/hallo-welt'), [
      { hreflang: 'de', href: 'https://example.com/de/artikel/hallo-welt' },
      { hreflang: 'en', href: 'https://example.com/en/blog/hello-world' },
      { hreflang: 'x-default', href: 'https://example.com/en/blog/hello-world' },
    ]);
    assert.deepEqual(await intl.hreflangLinks('en', 'blog/solo'), [
      { hreflang: 'en', href: 'https://example.com/en/blog/solo' },
      { hreflang: 'x-default', href: 'https://example.com/en/blog/solo' },
    ]);
  });

  it('omits x-default when the default locale has no tail', async () => {
    const intl = openTails();

    assert.deepEqual(await intl.hreflangLinks('de', 'artikel/nur-deutsch'), [
      { hreflang: 'de', href: 'https://example.com/de/artikel/nur-deutsch' },
    ]);
    const nur = (await intl.getSitemapEntries()).find((item) => item.entryId === 'blog/nur');
    assert.deepEqual(nur, {
      locale: 'de',
      path: 'artikel/nur-deutsch',
      loc: 'https://example.com/de/artikel/nur-deutsch',
      alternates: { de: 'https://example.com/de/artikel/nur-deutsch' },
      entryId: 'blog/nur',
    });
  });

  it('returns each locale tail for a published tail with no entry', async () => {
    const intl = openTails();
    const home = { de: 'https://example.com/de', en: 'https://example.com/en' };
    const blog = { de: 'https://example.com/de/artikel', en: 'https://example.com/en/blog' };
    const links = [
      { hreflang: 'de', href: blog.de },
      { hreflang: 'en', href: blog.en },
      { hreflang: 'x-default', href: blog.en },
    ];

    assert.deepEqual(await intl.getAlternatePathsForPath('en', '/'), { en: '/', de: '/' });
    assert.deepEqual(await intl.getAlternatePathsForPath('en', 'blog'), {
      en: 'blog',
      de: 'artikel',
    });
    assert.deepEqual(await intl.getAlternatePathsForPath('de', 'artikel'), {
      en: 'blog',
      de: 'artikel',
    });
    assert.equal(await intl.getContentByPath('en', '/'), undefined);
    assert.equal(await intl.getContentByPath('en', 'blog'), undefined);
    assert.equal(await intl.getContentByPath('de', 'artikel'), undefined);
    assert.equal((await intl.getContentByPath('en', 'blog/solo'))?.data.id, 'solo');
    assert.equal(await intl.getContentByPath('de', 'blog/solo'), undefined);

    const root = await intl.staticPaths('/en/[...index]');
    const index = await intl.staticPaths('/en/blog/[...index]');
    assert.deepEqual(
      root.map((row) => ({ path: row.props.path, entry: row.props.entry })),
      [{ path: '/', entry: undefined }],
    );
    assert.deepEqual(
      index.map((row) => ({ path: row.props.path, entry: row.props.entry })),
      [{ path: 'blog', entry: undefined }],
    );

    assert.deepEqual(await intl.hreflangLinks('de', 'artikel'), links);
    assert.deepEqual(await intl.hreflangLinks('en', 'blog'), links);

    const sitemap = await intl.getSitemapEntries();
    assert.deepEqual(
      sitemap.find((item) => item.locale === 'en' && item.path === 'blog'),
      {
        locale: 'en',
        path: 'blog',
        loc: blog.en,
        alternates: blog,
        xDefault: blog.en,
      },
    );
    assert.deepEqual(
      sitemap.find((item) => item.locale === 'en' && item.path === '/'),
      {
        locale: 'en',
        path: '/',
        loc: home.en,
        alternates: home,
        xDefault: home.en,
      },
    );
    const slugs = await intl.getPairedSlugs();
    assert.deepEqual(
      slugs.filter((item) => item.slug === '/' || item.slug === 'blog' || item.slug === 'artikel'),
      [
        { locale: 'de', slug: '/' },
        { locale: 'de', slug: 'artikel' },
        { locale: 'en', slug: '/' },
        { locale: 'en', slug: 'blog' },
      ],
    );
  });

  it('publishes a named entry at the written tail and does not reuse its slug', async () => {
    const intl = open(
      [
        {
          slug: { en: 'imprint', de: 'impressum' },
          view: 'imprint',
          collection: { name: 'pages', entry: 'imprint' },
        },
        { slug: { en: 'pages/{slug}', de: 'seiten/{slug}' }, view: 'page', collection: 'pages' },
      ],
      {
        pages: [
          collectionEntry('pages', 'imprint-en', { id: 'imprint', locale: 'en', slug: 'legal' }),
          collectionEntry('pages', 'imprint-de', {
            id: 'imprint',
            locale: 'de',
            slug: 'rechtliches',
          }),
          collectionEntry('pages', 'other-en', { id: 'other', locale: 'en', slug: 'other' }),
        ],
      },
    );

    const imprint = await intl.staticPaths('/en/imprint/[...index]');
    const impressum = await intl.staticPaths('/de/impressum/[...index]');
    assert.equal(imprint[0]?.props.path, 'imprint');
    assert.equal(imprint[0]?.props.entry?.id, 'imprint-en');
    assert.equal(imprint[0]?.props.entry?.data.slug, 'legal');
    assert.equal(impressum[0]?.props.path, 'impressum');
    assert.equal(impressum[0]?.props.entry?.id, 'imprint-de');
    assert.equal(impressum[0]?.props.entry?.data.slug, 'rechtliches');
    assert.deepEqual(await intl.getAlternatePaths('pages/imprint'), {
      en: 'imprint',
      de: 'impressum',
    });
    assert.equal((await intl.getContentByPath('en', 'imprint'))?.data.id, 'imprint');
    assert.equal(await intl.getContentByPath('en', 'pages/legal'), undefined);
    assert.equal(await intl.getContentByPath('de', 'seiten/rechtliches'), undefined);
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'impressum' },
      { locale: 'en', slug: 'imprint' },
      { locale: 'en', slug: 'pages/other' },
    ]);
  });

  it('publishes only the named entry when a {slug} row names one', async () => {
    const intl = open(
      [
        {
          slug: { en: 'careers/{slug}', de: 'karriere/{slug}' },
          view: 'role',
          collection: { name: 'pages', entry: 'designer' },
        },
      ],
      {
        pages: [
          collectionEntry('pages', 'designer-en', {
            id: 'designer',
            locale: 'en',
            slug: 'designer',
          }),
          collectionEntry('pages', 'designer-de', {
            id: 'designer',
            locale: 'de',
            slug: 'gestalter',
          }),
          collectionEntry('pages', 'other-en', { id: 'other', locale: 'en', slug: 'other' }),
        ],
      },
    );

    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'karriere/gestalter' },
      { locale: 'en', slug: 'careers/designer' },
    ]);
    assert.deepEqual(await intl.getAlternatePaths('pages/designer'), {
      en: 'careers/designer',
      de: 'karriere/gestalter',
    });
    assert.equal((await intl.getContentByPath('en', 'careers/designer'))?.id, 'designer-en');
    assert.equal((await intl.getContentByPath('de', 'karriere/gestalter'))?.id, 'designer-de');
    assert.equal(await intl.getContentByPath('en', 'pages/other'), undefined);
    const other = await intl.getRelated('en', relation('pages', 'other'));
    assert.equal(other.id, 'other-en');
    assert.deepEqual(await intl.getAlternatePaths('pages/other'), {});
  });
});
