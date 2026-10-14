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

/** Intl for these routes. A collection named in `collections` is translated. */
function bind(
  routes: Routes,
  collections: Readonly<Record<string, readonly CollectionEntry[]>> = {},
) {
  const names = Object.keys(collections);
  return createIntl(
    intlConfig({
      routes,
      ...(names.length === 0 ? {} : { collections: { translated: names } }),
    }),
    { loaders: collectionLoaders(collections) },
  );
}

/** `{slug}` row for blog. en tail `blog/{slug}`, de tail `artikel/{slug}`. */
const postRow = {
  slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
  view: 'post',
  collection: 'blog',
} as const;

describe('alternates', () => {
  it('returns sibling tails', async () => {
    const intl = bind([postRow], {
      blog: [
        collectionEntry('blog', 'hello-en', {
          id: 'hello-world',
          locale: 'en',
          slug: 'hello-world',
        }),
        collectionEntry('blog', 'hello-de', {
          id: 'hello-world',
          locale: 'de',
          slug: 'hallo-welt',
        }),
      ],
    });

    assert.deepEqual(await intl.getAlternatePaths('blog/hello-world'), {
      en: 'blog/hello-world',
      de: 'artikel/hallo-welt',
    });
  });

  it('returns the entry at the tail that locale publishes', async () => {
    const helloEn = collectionEntry('blog', 'hello-en', {
      id: 'hello-world',
      locale: 'en',
      slug: 'hello-world',
    });
    const helloDe = collectionEntry('blog', 'hello-de', {
      id: 'hello-world',
      locale: 'de',
      slug: 'hallo-welt',
    });
    const solo = collectionEntry('blog', 'solo-en', { id: 'solo', locale: 'en', slug: 'solo' });
    const intl = bind([postRow], { blog: [helloEn, helloDe, solo] });

    assert.equal(await intl.getContentByPath('en', 'blog/hello-world'), helloEn);
    assert.equal(await intl.getContentByPath('de', 'artikel/hallo-welt'), helloDe);
    assert.equal(await intl.getContentByPath('en', 'blog/solo'), solo);
    assert.equal(await intl.getContentByPath('de', 'blog/solo'), undefined);
  });

  it('returns the entry when the path has slashes at the ends', async () => {
    const hello = collectionEntry('blog', 'hello-en', {
      id: 'hello',
      locale: 'en',
      slug: 'hello',
    });
    const intl = bind([postRow], { blog: [hello] });
    assert.equal(await intl.getContentByPath('en', '/blog/hello/'), hello);
  });

  it('publishes one sitemap row per sibling and keeps x-default out of the alternates', async () => {
    const intl = bind([postRow], {
      blog: [
        collectionEntry('blog', 'hello-en', {
          id: 'hello-world',
          locale: 'en',
          slug: 'hello-world',
        }),
        collectionEntry('blog', 'hello-de', {
          id: 'hello-world',
          locale: 'de',
          slug: 'hallo-welt',
        }),
      ],
    });
    const hello = {
      de: 'https://example.com/de/artikel/hallo-welt',
      en: 'https://example.com/en/blog/hello-world',
    };

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

  it('omits a locale with no entry', async () => {
    const intl = bind([postRow], {
      blog: [collectionEntry('blog', 'solo-en', { id: 'solo', locale: 'en', slug: 'solo' })],
    });

    assert.deepEqual(await intl.getAlternatePaths('blog/solo'), { en: 'blog/solo' });
    assert.deepEqual(await intl.getSitemapEntries(), [
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
    const intl = bind([postRow], {
      blog: [
        collectionEntry('blog', 'hello-en', {
          id: 'hello-world',
          locale: 'en',
          slug: 'hello-world',
        }),
        collectionEntry('blog', 'hello-de', {
          id: 'hello-world',
          locale: 'de',
          slug: 'hallo-welt',
        }),
        collectionEntry('blog', 'solo-en', { id: 'solo', locale: 'en', slug: 'solo' }),
      ],
    });

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
    const intl = bind([postRow], {
      blog: [collectionEntry('blog', 'nur-de', { id: 'nur', locale: 'de', slug: 'nur-deutsch' })],
    });

    assert.deepEqual(await intl.hreflangLinks('de', 'artikel/nur-deutsch'), [
      { hreflang: 'de', href: 'https://example.com/de/artikel/nur-deutsch' },
    ]);
    assert.deepEqual(await intl.getSitemapEntries(), [
      {
        locale: 'de',
        path: 'artikel/nur-deutsch',
        loc: 'https://example.com/de/artikel/nur-deutsch',
        alternates: { de: 'https://example.com/de/artikel/nur-deutsch' },
        entryId: 'blog/nur',
      },
    ]);
  });

  it('publishes a named entry at the written tail and does not reuse its slug', async () => {
    const imprintEn = collectionEntry('pages', 'imprint-en', {
      id: 'imprint',
      locale: 'en',
      slug: 'legal',
    });
    const imprintDe = collectionEntry('pages', 'imprint-de', {
      id: 'imprint',
      locale: 'de',
      slug: 'rechtliches',
    });
    const intl = bind(
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
          imprintEn,
          imprintDe,
          collectionEntry('pages', 'other-en', { id: 'other', locale: 'en', slug: 'other' }),
        ],
      },
    );

    assert.deepEqual(
      (await intl.staticPaths('/en/imprint/[...index]')).map((row) => ({
        path: row.props.path,
        id: row.props.entry?.id,
        slug: row.props.entry?.data.slug,
      })),
      [{ path: 'imprint', id: 'imprint-en', slug: 'legal' }],
    );
    assert.deepEqual(
      (await intl.staticPaths('/de/impressum/[...index]')).map((row) => ({
        path: row.props.path,
        id: row.props.entry?.id,
        slug: row.props.entry?.data.slug,
      })),
      [{ path: 'impressum', id: 'imprint-de', slug: 'rechtliches' }],
    );
    assert.deepEqual(await intl.getAlternatePaths('pages/imprint'), {
      en: 'imprint',
      de: 'impressum',
    });
    assert.equal(await intl.getContentByPath('en', 'imprint'), imprintEn);
    assert.equal(await intl.getContentByPath('en', 'pages/legal'), undefined);
    assert.equal(await intl.getContentByPath('de', 'seiten/rechtliches'), undefined);
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'impressum' },
      { locale: 'en', slug: 'imprint' },
      { locale: 'en', slug: 'pages/other' },
    ]);
  });

  it('publishes only the named entry when a {slug} row names one', async () => {
    const designerEn = collectionEntry('pages', 'designer-en', {
      id: 'designer',
      locale: 'en',
      slug: 'designer',
    });
    const designerDe = collectionEntry('pages', 'designer-de', {
      id: 'designer',
      locale: 'de',
      slug: 'gestalter',
    });
    const intl = bind(
      [
        {
          slug: { en: 'careers/{slug}', de: 'karriere/{slug}' },
          view: 'role',
          collection: { name: 'pages', entry: 'designer' },
        },
      ],
      {
        pages: [
          designerEn,
          designerDe,
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
    assert.equal(await intl.getContentByPath('en', 'careers/designer'), designerEn);
    assert.equal(await intl.getContentByPath('de', 'karriere/gestalter'), designerDe);
    assert.equal(await intl.getContentByPath('en', 'pages/other'), undefined);
  });

  it('keeps an entry the row does not name as a record', async () => {
    const other = collectionEntry('pages', 'other-en', {
      id: 'other',
      locale: 'en',
      slug: 'other',
    });
    const intl = bind(
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
          other,
        ],
      },
    );

    assert.equal(await intl.getRelated('en', relation('pages', 'other')), other);
    assert.deepEqual(await intl.getAlternatePaths('pages/other'), {});
  });

  it('returns sibling tails for a named entry', async () => {
    const intl = bind(
      [
        {
          slug: { en: '/', de: '/' },
          view: 'home',
          collection: { name: 'pages', entry: 'home' },
        },
      ],
      {
        pages: [
          collectionEntry('pages', 'home-en', { id: 'home', locale: 'en' }),
          collectionEntry('pages', 'home-de', { id: 'home', locale: 'de' }),
        ],
      },
    );

    assert.deepEqual(await intl.getAlternatePaths('pages/home'), { en: '/', de: '/' });
    assert.deepEqual(await intl.getAlternatePathsForPath('en', '/'), { en: '/', de: '/' });
  });

  it('lists a sitemap row for a named entry', async () => {
    const intl = bind(
      [
        {
          slug: { en: '/', de: '/' },
          view: 'home',
          collection: { name: 'pages', entry: 'home' },
        },
      ],
      {
        pages: [
          collectionEntry('pages', 'home-en', { id: 'home', locale: 'en' }),
          collectionEntry('pages', 'home-de', { id: 'home', locale: 'de' }),
        ],
      },
    );
    const home = { de: 'https://example.com/de', en: 'https://example.com/en' };

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
        locale: 'en',
        path: '/',
        loc: home.en,
        alternates: home,
        xDefault: home.en,
        entryId: 'pages/home',
      },
    ]);
  });

  it('returns no alternates for an id that omits the collection', async () => {
    const intl = bind(
      [
        {
          slug: { en: '/', de: '/' },
          view: 'home',
          collection: { name: 'pages', entry: 'home' },
        },
      ],
      {
        pages: [
          collectionEntry('pages', 'home-en', { id: 'home', locale: 'en' }),
          collectionEntry('pages', 'home-de', { id: 'home', locale: 'de' }),
        ],
      },
    );

    // The pairing id is pages/home.
    assert.deepEqual(await intl.getAlternatePaths('home'), {});
  });

  it('returns the locale tails of a published tail with no entry', async () => {
    const intl = bind([
      { slug: { en: '/', de: '/' }, view: 'home' },
      { slug: { en: 'blog', de: 'artikel' }, view: 'index' },
    ]);

    assert.deepEqual(await intl.getAlternatePathsForPath('en', '/'), { en: '/', de: '/' });
    assert.deepEqual(await intl.getAlternatePathsForPath('en', 'blog'), {
      en: 'blog',
      de: 'artikel',
    });
    assert.deepEqual(await intl.getAlternatePathsForPath('de', 'artikel'), {
      en: 'blog',
      de: 'artikel',
    });
  });

  it('publishes a tail with no entry', async () => {
    const intl = bind([
      { slug: { en: '/', de: '/' }, view: 'home' },
      { slug: { en: 'blog', de: 'artikel' }, view: 'index' },
    ]);

    for (const [pattern, path] of [
      ['/en/[...index]', '/'],
      ['/de/[...index]', '/'],
      ['/en/blog/[...index]', 'blog'],
      ['/de/artikel/[...index]', 'artikel'],
    ] as const) {
      assert.deepEqual(
        (await intl.staticPaths(pattern)).map((row) => ({
          path: row.props.path,
          entry: row.props.entry,
        })),
        [{ path, entry: undefined }],
        pattern,
      );
    }
    for (const [locale, path] of [
      ['en', '/'],
      ['en', 'blog'],
      ['de', 'artikel'],
    ] as const) {
      assert.equal(await intl.getContentByPath(locale, path), undefined, `${locale} ${path}`);
    }
  });

  it('returns hreflang links for a tail with no entry', async () => {
    const intl = bind([
      { slug: { en: '/', de: '/' }, view: 'home' },
      { slug: { en: 'blog', de: 'artikel' }, view: 'index' },
    ]);
    const links = [
      { hreflang: 'de', href: 'https://example.com/de/artikel' },
      { hreflang: 'en', href: 'https://example.com/en/blog' },
      { hreflang: 'x-default', href: 'https://example.com/en/blog' },
    ];

    assert.deepEqual(await intl.hreflangLinks('de', 'artikel'), links);
    assert.deepEqual(await intl.hreflangLinks('en', 'blog'), links);
  });

  it('lists a tail with no entry in the sitemap', async () => {
    const intl = bind([
      { slug: { en: '/', de: '/' }, view: 'home' },
      { slug: { en: 'blog', de: 'artikel' }, view: 'index' },
    ]);
    const home = { de: 'https://example.com/de', en: 'https://example.com/en' };
    const blog = { de: 'https://example.com/de/artikel', en: 'https://example.com/en/blog' };

    assert.deepEqual(await intl.getSitemapEntries(), [
      {
        locale: 'de',
        path: '/',
        loc: home.de,
        alternates: home,
        xDefault: home.en,
      },
      {
        locale: 'de',
        path: 'artikel',
        loc: blog.de,
        alternates: blog,
        xDefault: blog.en,
      },
      {
        locale: 'en',
        path: '/',
        loc: home.en,
        alternates: home,
        xDefault: home.en,
      },
      {
        locale: 'en',
        path: 'blog',
        loc: blog.en,
        alternates: blog,
        xDefault: blog.en,
      },
    ]);
  });

  it('lists each published tail', async () => {
    const intl = bind(
      [
        { slug: { en: '/', de: '/' }, view: 'home' },
        { slug: { en: 'blog', de: 'artikel' }, view: 'index' },
        postRow,
      ],
      {
        blog: [
          collectionEntry('blog', 'hello-en', {
            id: 'hello-world',
            locale: 'en',
            slug: 'hello-world',
          }),
          collectionEntry('blog', 'hello-de', {
            id: 'hello-world',
            locale: 'de',
            slug: 'hallo-welt',
          }),
          collectionEntry('blog', 'solo-en', { id: 'solo', locale: 'en', slug: 'solo' }),
        ],
      },
    );

    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: '/' },
      { locale: 'de', slug: 'artikel' },
      { locale: 'de', slug: 'artikel/hallo-welt' },
      { locale: 'en', slug: '/' },
      { locale: 'en', slug: 'blog' },
      { locale: 'en', slug: 'blog/hello-world' },
      { locale: 'en', slug: 'blog/solo' },
    ]);
  });

  it("returns no alternates for a path pairing doesn't know", async () => {
    const intl = bind([{ slug: { en: 'about', de: 'ueber' }, view: 'about' }]);

    assert.deepEqual(await intl.hreflangLinks('en', 'missing/path'), []);
  });
});
