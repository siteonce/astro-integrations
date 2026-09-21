import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defineIntl, intlConfigSchema } from './define-intl.ts';
import { id, locale, slug } from './fragments.ts';
import { hreflangLinks } from './hreflang.ts';
import { type CollectionEntryLike, pairCollections } from './pairing.ts';
import { createIntlQuery } from './query.ts';

const config = defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  collections: {
    pages: { slugField: 'slug' },
    blog: { pathPrefix: 'blog' },
    authors: {},
  },
});

function entry(
  collection: string,
  astroId: string,
  data: Record<string, unknown>,
  filePath?: string,
): CollectionEntryLike {
  return { id: astroId, collection, data, filePath };
}

const fixtures = {
  pages: [
    entry('pages', 'home-en', { id: 'home', locale: 'en', slug: '/' }),
    entry('pages', 'home-de', { id: 'home', locale: 'de', slug: '/' }),
    entry('pages', 'solo-en', { id: 'solo', locale: 'en', slug: 'only-in-en' }),
    entry('pages', 'de-only', { id: 'de-only', locale: 'de', slug: 'nur-de' }),
  ],
  blog: [
    entry('blog', 'hello-en', { id: 'hello-world', locale: 'en', slug: 'hello-world' }),
    entry('blog', 'hello-de', { id: 'hello-world', locale: 'de', slug: 'hallo-welt' }),
  ],
  authors: [
    entry('authors', 'ada-en', { id: 'ada', locale: 'en', name: 'Ada' }),
    entry('authors', 'ada-de', { id: 'ada', locale: 'de', name: 'Ada' }),
  ],
};

const absolute = (locale: string, path = '') =>
  `https://example.com/${locale}${path ? `/${path}` : ''}`;

describe('fragments', () => {
  it('exports id, locale, and slug schemas', () => {
    assert.equal(id.parse('hello-world'), 'hello-world');
    assert.equal(locale.parse('de'), 'de');
    assert.equal(slug.parse('/'), '/');
    assert.throws(() => slug.parse(''));
  });
});

describe('intlConfigSchema collections', () => {
  it('rejects a pathPrefix map that omits a locale', () => {
    const parsed = intlConfigSchema.safeParse({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      collections: { blog: { pathPrefix: { en: 'blog' } } },
    });
    assert.equal(parsed.success, false);
  });

  it('accepts per-collection idField and localeField', () => {
    const parsed = intlConfigSchema.safeParse({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      collections: {
        pages: { idField: 'id', localeField: 'locale', slugField: 'slug' },
      },
    });
    assert.equal(parsed.success, true);
  });

  it('rejects top-level entryId and collection entryId', () => {
    const topLevel = intlConfigSchema.safeParse({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      entryId: 'collectionFolder',
    });
    assert.equal(topLevel.success, false);

    const perCollection = intlConfigSchema.safeParse({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      collections: { pages: { entryId: 'frontmatter', slugField: 'slug' } },
    });
    assert.equal(perCollection.success, false);
  });
});

describe('pairCollections', () => {
  it('compiles a path per locale for paired routed entries', () => {
    const paired = pairCollections(config, fixtures);
    const helloEn = paired.routed.find(
      (item) => item.entryId === 'blog/hello-world' && item.locale === 'en',
    );
    const helloDe = paired.routed.find(
      (item) => item.entryId === 'blog/hello-world' && item.locale === 'de',
    );
    assert.equal(helloEn?.path, 'blog/hello-world');
    assert.equal(helloDe?.path, 'blog/hallo-welt');
    const homeEn = paired.routed.find(
      (item) => item.entryId === 'pages/home' && item.locale === 'en',
    );
    assert.equal(homeEn?.path, '/');
  });

  it('keeps listed records without a URL', () => {
    const paired = pairCollections(config, fixtures);
    assert.equal(paired.records.length, 2);
    assert.ok(paired.records.every((item) => item.entryId === 'authors/ada'));
  });

  it('aborts on a (locale, path) collision', () => {
    assert.throws(
      () =>
        pairCollections(config, {
          ...fixtures,
          pages: [
            ...fixtures.pages,
            entry('pages', 'clash', { id: 'clash', locale: 'en', slug: 'blog/hello-world' }),
          ],
        }),
      /\(locale, path\) "en" \/ "blog\/hello-world" collides/,
    );
  });

  it('aborts when a file route shadows a compiled path', () => {
    assert.throws(
      () => pairCollections(config, fixtures, ['only-in-en']),
      /path "only-in-en" is shadowed by a file route/,
    );
  });

  it('warns when the default-locale sibling is missing', () => {
    const paired = pairCollections(config, fixtures);
    assert.ok(paired.warnings.some((warning) => warning.includes('entryId "pages/de-only"')));
  });

  it('aborts when a listed collection is absent', () => {
    assert.throws(
      () => pairCollections(config, { pages: [], blog: [] }),
      /collections.authors is not a content collection/,
    );
  });
});

describe('pairCollections field id', () => {
  const fieldConfig = defineIntl({
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
    collections: {
      pages: { slugField: 'slug' },
      blog: { slugField: 'slug' },
    },
  });

  it('pairs siblings as collection/id and allows the same id in two collections', () => {
    const paired = pairCollections(fieldConfig, {
      pages: [
        entry('pages', 'blog/en', { id: 'blog', locale: 'en', slug: 'blog' }),
        entry('pages', 'blog/de', { id: 'blog', locale: 'de', slug: 'artikel' }),
      ],
      blog: [
        entry('blog', 'hello-world/en', {
          id: 'hello-world',
          locale: 'en',
          slug: 'blog/hello-world',
        }),
        entry('blog', 'hello-world/de', {
          id: 'hello-world',
          locale: 'de',
          slug: 'artikel/hallo-welt',
        }),
      ],
    });

    const listingEn = paired.routed.find(
      (item) => item.entryId === 'pages/blog' && item.locale === 'en',
    );
    const helloDe = paired.routed.find(
      (item) => item.entryId === 'blog/hello-world' && item.locale === 'de',
    );
    assert.equal(listingEn?.path, 'blog');
    assert.equal(helloDe?.path, 'artikel/hallo-welt');
    assert.equal(paired.routed.filter((item) => item.entryId === 'pages/blog').length, 2);
    assert.equal(paired.routed.filter((item) => item.entryId === 'blog/hello-world').length, 2);
  });

  it('warns when the default-locale sibling is missing', () => {
    const paired = pairCollections(fieldConfig, {
      pages: [
        entry('pages', 'home/en', { id: 'home', locale: 'en', slug: '/' }),
        entry('pages', 'home/de', { id: 'home', locale: 'de', slug: '/' }),
      ],
      blog: [entry('blog', 'nur-de/de', { id: 'nur-de', locale: 'de', slug: 'artikel/nur-de' })],
    });
    const solo = paired.routed.find((item) => item.entryId === 'blog/nur-de');
    assert.equal(solo?.locale, 'de');
    assert.equal(solo?.path, 'artikel/nur-de');
    assert.ok(paired.warnings.some((warning) => warning.includes('entryId "blog/nur-de"')));
  });

  it('aborts when id is missing', () => {
    assert.throws(
      () =>
        pairCollections(fieldConfig, {
          pages: [entry('pages', 'home/en', { locale: 'en', slug: '/' })],
          blog: [],
        }),
      /id field "id" is missing/,
    );
  });

  it('aborts when locale is missing', () => {
    assert.throws(
      () =>
        pairCollections(fieldConfig, {
          pages: [entry('pages', 'home/en', { id: 'home', slug: '/' })],
          blog: [],
        }),
      /locale field "locale" is missing/,
    );
  });

  it('reads custom idField and localeField', () => {
    const custom = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      collections: {
        pages: { idField: 'docId', localeField: 'lang', slugField: 'slug' },
      },
    });
    const paired = pairCollections(custom, {
      pages: [entry('pages', 'home-en', { docId: 'home', lang: 'en', slug: '/' })],
    });
    assert.equal(paired.routed[0]?.entryId, 'pages/home');
    assert.equal(paired.routed[0]?.locale, 'en');
  });
});

describe('query helpers', () => {
  const query = createIntlQuery({
    config,
    collections: fixtures,
    getAbsoluteLocaleUrl: absolute,
  });

  it('looks up siblings and omits a missing locale', () => {
    assert.deepEqual(query.getAlternatePaths('blog/hello-world'), {
      en: 'blog/hello-world',
      de: 'blog/hallo-welt',
    });
    assert.deepEqual(query.getAlternatePaths('pages/solo'), { en: 'only-in-en' });
    assert.equal(query.getContentById('de', 'pages/solo'), undefined);
    assert.equal(query.getContentById('en', 'pages/solo')?.data.id, 'solo');
    assert.equal(query.getContentByPath('de', 'blog/hallo-welt')?.data.id, 'hello-world');
    assert.equal(query.getContentById('de', 'authors/ada')?.data.name, 'Ada');
  });

  it('lists paired locale+slug and sitemap / RSS alternates', () => {
    const slugs = query.getPairedSlugs();
    assert.ok(slugs.some((item) => item.locale === 'en' && item.slug === '/'));
    assert.ok(slugs.some((item) => item.locale === 'de' && item.slug === 'blog/hallo-welt'));
    assert.equal(
      slugs.some((item) => 'params' in item),
      false,
    );

    const sitemap = query.getSitemapEntries();
    const helloEn = sitemap.find(
      (item) => item.entryId === 'blog/hello-world' && item.locale === 'en',
    );
    assert.equal(helloEn?.path, 'blog/hello-world');
    assert.equal(helloEn?.loc, 'https://example.com/en/blog/hello-world');
    assert.deepEqual(helloEn?.alternates, {
      en: 'https://example.com/en/blog/hello-world',
      de: 'https://example.com/de/blog/hallo-welt',
    });
    const solo = sitemap.find((item) => item.entryId === 'pages/solo');
    assert.deepEqual(solo?.alternates, {
      en: 'https://example.com/en/only-in-en',
    });
    assert.ok(sitemap.every((item) => item.entryId !== 'ada'));
  });

  it('builds Hreflang data with per-locale URLs and x-default', () => {
    const head = query.getDocumentHead({ locale: 'de', path: 'blog/hallo-welt' });
    assert.equal(head.lang, 'de');
    assert.equal(head.canonical, 'https://example.com/de/blog/hallo-welt');
    assert.deepEqual(head.alternates, [
      { hreflang: 'de', href: 'https://example.com/de/blog/hallo-welt' },
      { hreflang: 'en', href: 'https://example.com/en/blog/hello-world' },
    ]);
    assert.equal(head.xDefault, 'https://example.com/en/blog/hello-world');
    const links = hreflangLinks(head);
    assert.ok(links.some((link) => link.hreflang === 'x-default'));
    assert.ok(links.some((link) => link.hreflang === 'de'));
    assert.ok(links.some((link) => link.hreflang === 'en'));

    const missing = query.getDocumentHead({ locale: 'en', path: 'only-in-en' });
    assert.equal(missing.xDefault, 'https://example.com/en/only-in-en');
    assert.equal(missing.alternates.length, 1);
  });
});

describe('query helpers collection/id', () => {
  const fieldConfig = defineIntl({
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
    collections: {
      blog: { slugField: 'slug' },
      tags: { slugField: 'slug' },
    },
  });
  const collections = {
    blog: [
      entry('blog', 'hello-world/en', {
        id: 'hello-world',
        locale: 'en',
        slug: 'blog/hello-world',
      }),
      entry('blog', 'hello-world/de', {
        id: 'hello-world',
        locale: 'de',
        slug: 'artikel/hallo-welt',
      }),
    ],
    tags: [
      entry('tags', 'announcements/en', {
        id: 'announcements',
        locale: 'en',
        slug: 'tags/announcements',
      }),
      entry('tags', 'announcements/de', {
        id: 'announcements',
        locale: 'de',
        slug: 'schlagworte/ankuendigungen',
      }),
    ],
  };
  const query = createIntlQuery({
    config: fieldConfig,
    collections,
    getAbsoluteLocaleUrl: absolute,
  });

  it('looks up by collection/id and by the sibling path', () => {
    assert.equal(query.getContentById('en', 'blog/hello-world')?.id, 'hello-world/en');
    assert.equal(query.getContentById('de', 'tags/announcements')?.id, 'announcements/de');
    assert.deepEqual(query.getAlternatePaths('blog/hello-world'), {
      en: 'blog/hello-world',
      de: 'artikel/hallo-welt',
    });
    assert.deepEqual(query.getAlternatePathsForPath('de', 'artikel/hallo-welt'), {
      en: 'blog/hello-world',
      de: 'artikel/hallo-welt',
    });
    assert.deepEqual(query.getAlternatePathsForPath('en', 'missing'), {});
    const sitemap = query.getSitemapEntries();
    const helloEn = sitemap.find(
      (item) => item.entryId === 'blog/hello-world' && item.locale === 'en',
    );
    assert.deepEqual(helloEn?.alternates, {
      en: 'https://example.com/en/blog/hello-world',
      de: 'https://example.com/de/artikel/hallo-welt',
    });
  });
});
