import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defineIntl, intlConfigSchema, routeConfigIssues } from './define-intl.ts';
import { id, locale, slug } from './fragments.ts';
import { hreflangLinks } from './hreflang.ts';
import { type CollectionEntryLike, pairCollections } from './pairing.ts';
import { createIntlQuery } from './query.ts';

const config = defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  routes: [
    { slug: { en: '/', de: '/' }, page: 'x', collection: 'pages', entry: 'home' },
    { slug: { en: 'blog', de: 'artikel' }, page: 'x', collection: 'pages', entry: 'blog' },
    { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
  ],
  collections: {
    pages: {},
    blog: { slugField: 'slug' },
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
    entry('pages', 'home-en', { id: 'home', locale: 'en' }),
    entry('pages', 'home-de', { id: 'home', locale: 'de' }),
    entry('pages', 'blog-en', { id: 'blog', locale: 'en' }),
    entry('pages', 'blog-de', { id: 'blog', locale: 'de' }),
  ],
  blog: [
    entry('blog', 'hello-en', { id: 'hello-world', locale: 'en', slug: 'hello-world' }),
    entry('blog', 'hello-de', { id: 'hello-world', locale: 'de', slug: 'hallo-welt' }),
    entry('blog', 'solo-en', { id: 'solo', locale: 'en', slug: 'solo' }),
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
  it('rejects a route slug map that omits a locale', () => {
    const parsed = intlConfigSchema.safeParse({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [{ slug: { en: 'blog/{slug}' }, page: 'x', collection: 'blog' }],
      collections: { blog: { slugField: 'slug' } },
    });
    assert.equal(parsed.success, false);
  });

  it('accepts per-collection idField and localeField', () => {
    const parsed = intlConfigSchema.safeParse({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'pages' },
      ],
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

describe('routeConfigIssues', () => {
  const locales = ['en', 'de'] as const;

  it('rejects a {slug} row on a collection without slugField', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'pages' },
      ],
      collections: { pages: {} },
    });
    assert.ok(issues.some((issue) => issue.includes('pattern row') && issue.includes('pages')));
  });

  it('allows an entry row beside a {slug} row on a slugField collection', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
        { slug: { en: 'hello', de: 'hallo' }, page: 'x', collection: 'blog', entry: 'hello' },
      ],
      collections: { blog: { slugField: 'slug' } },
    });
    assert.deepEqual(issues, []);
  });

  it('allows a collection tail with pageSize beside one {slug} row', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        { slug: { en: 'blog', de: 'artikel' }, page: 'x', collection: 'blog', pageSize: 10 },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
      ],
      collections: { blog: { slugField: 'slug' } },
    });
    assert.deepEqual(issues, []);
  });

  it('rejects pageSize on a {slug} row and a non-positive pageSize', () => {
    const onPattern = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
          page: 'x',
          collection: 'blog',
          pageSize: 10,
        },
      ],
      collections: { blog: { slugField: 'slug' } },
    });
    assert.ok(onPattern.some((issue) => issue.includes('pageSize requires a collection tail')));
    const parsed = intlConfigSchema.safeParse({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [{ slug: { en: 'blog', de: 'artikel' }, page: 'x', collection: 'blog', pageSize: 0 }],
      collections: { blog: { slugField: 'slug' } },
    });
    assert.equal(parsed.success, false);
  });

  it('rejects two pattern rows for one collection', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
        { slug: { en: 'news/{slug}', de: 'neuigkeiten/{slug}' }, page: 'x', collection: 'blog' },
      ],
      collections: { blog: { slugField: 'slug' } },
    });
    assert.ok(issues.some((issue) => issue.includes('two pattern rows') && issue.includes('blog')));
  });

  it('rejects a {slug} token that is not the final segment', () => {
    for (const slug of ['{slug}', '/{slug}', 'blog/{slug}/more']) {
      const issues = routeConfigIssues({
        locales,
        routes: [{ slug: { en: slug, de: 'artikel/{slug}' }, page: 'x', collection: 'blog' }],
        collections: { blog: { slugField: 'slug' } },
      });
      assert.ok(
        issues.some((issue) => issue.includes('locale "en"') && issue.includes('{slug}')),
        slug,
      );
    }
  });

  it('rejects a {slug} pattern with no collection', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [{ slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x' }],
    });
    assert.ok(issues.some((issue) => issue === '{slug} pattern has no collection'));
  });

  it('rejects an entry with no collection', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [{ slug: { en: '/', de: '/' }, page: 'x', entry: 'home' }],
    });
    assert.ok(issues.some((issue) => issue === 'entry row has no collection'));
  });

  it('rejects a repeated section in one locale', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
        { slug: { en: 'blog/{slug}', de: 'schlagworte/{slug}' }, page: 'x', collection: 'tags' },
      ],
      collections: {
        blog: { slugField: 'slug' },
        tags: { slugField: 'slug' },
      },
    });
    assert.ok(
      issues.some((issue) => issue.includes('duplicate section "blog"') && issue.includes('"en"')),
    );
    assert.equal(
      issues.some((issue) => issue.includes('artikel') || issue.includes('schlagworte')),
      false,
    );
  });

  it('rejects a routed page name that is not a path', () => {
    const extension = routeConfigIssues({
      locales,
      routes: [{ slug: { en: '/', de: '/' }, page: 'home.astro' }],
    });
    assert.ok(
      extension.some((issue) => issue === 'routed page "home.astro" includes a file extension'),
    );

    const parent = routeConfigIssues({
      locales,
      routes: [{ slug: { en: '/', de: '/' }, page: 'blog/../post' }],
    });
    assert.ok(parent.some((issue) => issue === 'routed page "blog/../post" is not a path'));

    const empty = routeConfigIssues({
      locales,
      routes: [{ slug: { en: '/', de: '/' }, page: 'blog//post' }],
    });
    assert.ok(empty.some((issue) => issue === 'routed page "blog//post" is not a path'));
  });

  it('rejects routed page keys that are not the configured locales', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [{ slug: { en: '/', de: '/' }, page: { en: 'home', fr: 'accueil' } }],
    });
    assert.ok(
      issues.some((issue) => issue === 'routed page keys must be the configured locales (de, en)'),
    );
  });
});

describe('pairCollections', () => {
  it('compiles a leaf onto that locale’s section', () => {
    const paired = pairCollections(config, fixtures);
    const helloEn = paired.routed.find(
      (item) => item.entryId === 'blog/hello-world' && item.locale === 'en',
    );
    const helloDe = paired.routed.find(
      (item) => item.entryId === 'blog/hello-world' && item.locale === 'de',
    );
    assert.equal(helloEn?.path, 'blog/hello-world');
    assert.equal(helloDe?.path, 'artikel/hallo-welt');
    const homeEn = paired.routed.find(
      (item) => item.entryId === 'pages/home' && item.locale === 'en',
    );
    assert.equal(homeEn?.path, '/');
    assert.equal(homeEn?.entry?.id, 'home-en');
  });

  it('keeps listed records without a URL', () => {
    const paired = pairCollections(config, fixtures);
    assert.equal(paired.records.filter((item) => item.entryId === 'authors/ada').length, 2);
    assert.ok(paired.routed.every((item) => item.entryId !== 'authors/ada'));
  });

  it('aborts when an entry row path equals a compiled leaf', () => {
    const clash = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
        {
          slug: { en: 'blog/hello-world', de: 'other' },
          page: 'x',
          collection: 'pages',
          entry: 'clash',
        },
      ],
      collections: { blog: { slugField: 'slug' }, pages: {} },
    });
    assert.throws(
      () =>
        pairCollections(clash, {
          blog: [
            entry('blog', 'hello-en', { id: 'hello-world', locale: 'en', slug: 'hello-world' }),
            entry('blog', 'hello-de', { id: 'hello-world', locale: 'de', slug: 'hallo-welt' }),
          ],
          pages: [
            entry('pages', 'clash-en', { id: 'clash', locale: 'en' }),
            entry('pages', 'clash-de', { id: 'clash', locale: 'de' }),
          ],
        }),
      /\(locale, path\) "en" \/ "blog\/hello-world" collides/,
    );
  });

  it('aborts when a leaf contains a slash', () => {
    assert.throws(
      () =>
        pairCollections(config, {
          ...fixtures,
          blog: [entry('blog', 'bad', { id: 'bad', locale: 'en', slug: 'blog/hello-world' })],
        }),
      /not one segment/,
    );
  });

  it('aborts when slugField has no {slug} row', () => {
    const bare = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      collections: { blog: { slugField: 'slug' } },
    });
    assert.throws(
      () => pairCollections(bare, { blog: [] }),
      /collections\.blog has no \{slug\} row/,
    );
  });

  it('routes an entry row only inside its collection', () => {
    const paired = pairCollections(config, {
      ...fixtures,
      authors: [
        ...fixtures.authors,
        entry('authors', 'home-author', { id: 'home', locale: 'en', name: 'Home' }),
      ],
    });
    const home = paired.routed.filter((item) => item.entryId === 'pages/home');
    assert.equal(home.length, 2);
    assert.equal(home.find((item) => item.locale === 'en')?.entry?.id, 'home-en');
    assert.ok(paired.records.some((item) => item.entryId === 'authors/home'));
    assert.equal(
      paired.routed.some((item) => item.entryId === 'authors/home'),
      false,
    );
  });

  it('warns when an entry row is missing in the default locale and claims no path for the gap', () => {
    const paired = pairCollections(config, {
      ...fixtures,
      pages: fixtures.pages.filter(
        (item) => !(item.data.id === 'home' && item.data.locale === 'en'),
      ),
    });
    const home = paired.routed.filter((item) => item.entryId === 'pages/home');
    assert.deepEqual(
      home.map((item) => item.locale),
      ['de'],
    );
    assert.equal(home[0]?.path, '/');
    assert.equal(
      paired.routed.some((item) => item.locale === 'en' && item.path === '/'),
      false,
    );
    assert.deepEqual(
      paired.warnings.filter((warning) => warning.includes('pages/home')),
      ['default-locale sibling missing for entryId "pages/home" (defaultLocale "en").'],
    );
  });

  it('warns when an entry row matches no locale and claims no path', () => {
    const paired = pairCollections(config, {
      ...fixtures,
      pages: fixtures.pages.filter((item) => item.data.id !== 'home'),
    });
    assert.equal(
      paired.routed.some((item) => item.entryId === 'pages/home' || item.path === '/'),
      false,
    );
    assert.deepEqual(
      paired.warnings.filter((warning) => warning.includes('pages/home')),
      ['default-locale sibling missing for entryId "pages/home" (defaultLocale "en").'],
    );
  });

  it('omits a missing non-default locale on an entry row without a warning', () => {
    const paired = pairCollections(config, {
      ...fixtures,
      pages: fixtures.pages.filter(
        (item) => !(item.data.id === 'blog' && item.data.locale === 'de'),
      ),
    });
    assert.equal(
      paired.routed.some((item) => item.entryId === 'pages/blog' && item.locale === 'de'),
      false,
    );
    assert.equal(
      paired.routed.some((item) => item.entryId === 'pages/blog' && item.locale === 'en'),
      true,
    );
    assert.equal(
      paired.warnings.some((warning) => warning.includes('pages/blog')),
      false,
    );
  });

  it('aborts when a file route shadows a compiled path', () => {
    assert.throws(
      () => pairCollections(config, fixtures, ['blog/solo']),
      /path "blog\/solo" is shadowed by a file route/,
    );
  });

  it('warns when the default-locale sibling is missing', () => {
    const paired = pairCollections(config, {
      ...fixtures,
      blog: [
        ...fixtures.blog,
        entry('blog', 'nur-de', { id: 'nur-de', locale: 'de', slug: 'nur-de' }),
      ],
    });
    const solo = paired.routed.find((item) => item.entryId === 'blog/nur-de');
    assert.equal(solo?.path, 'artikel/nur-de');
    assert.ok(paired.warnings.some((warning) => warning.includes('entryId "blog/nur-de"')));
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
    routes: [
      { slug: { en: '/', de: '/' }, page: 'x', collection: 'pages', entry: 'home' },
      { slug: { en: 'blog', de: 'artikel' }, page: 'x', collection: 'pages', entry: 'blog' },
      { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
    ],
    collections: {
      pages: {},
      blog: { slugField: 'slug' },
    },
  });

  it('pairs siblings as collection/id and allows the same id in two collections', () => {
    const paired = pairCollections(fieldConfig, {
      pages: [
        entry('pages', 'blog/en', { id: 'blog', locale: 'en' }),
        entry('pages', 'blog/de', { id: 'blog', locale: 'de' }),
        entry('pages', 'hello/en', { id: 'hello-world', locale: 'en' }),
        entry('pages', 'hello/de', { id: 'hello-world', locale: 'de' }),
      ],
      blog: [
        entry('blog', 'hello-world/en', { id: 'hello-world', locale: 'en', slug: 'hello-world' }),
        entry('blog', 'hello-world/de', { id: 'hello-world', locale: 'de', slug: 'hallo-welt' }),
      ],
    });

    const listingEn = paired.routed.find(
      (item) => item.entryId === 'pages/blog' && item.locale === 'en',
    );
    const helloDe = paired.routed.find(
      (item) => item.entryId === 'blog/hello-world' && item.locale === 'de',
    );
    assert.equal(listingEn?.path, 'blog');
    assert.equal(listingEn?.entry?.id, 'blog/en');
    assert.equal(helloDe?.path, 'artikel/hallo-welt');
    assert.equal(paired.routed.filter((item) => item.entryId === 'pages/blog').length, 2);
    assert.equal(
      paired.warnings.some((warning) => warning.includes('pages/hello-world')),
      false,
    );
    assert.equal(paired.routed.filter((item) => item.entryId === 'blog/hello-world').length, 2);
    assert.ok(paired.records.some((item) => item.entryId === 'pages/hello-world'));
  });

  it('warns when the default-locale sibling is missing', () => {
    const paired = pairCollections(fieldConfig, {
      pages: [
        entry('pages', 'home/en', { id: 'home', locale: 'en' }),
        entry('pages', 'home/de', { id: 'home', locale: 'de' }),
      ],
      blog: [entry('blog', 'nur-de/de', { id: 'nur-de', locale: 'de', slug: 'nur-de' })],
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
          pages: [entry('pages', 'home/en', { locale: 'en' })],
          blog: [],
        }),
      /id field "id" is missing/,
    );
  });

  it('aborts when locale is missing', () => {
    assert.throws(
      () =>
        pairCollections(fieldConfig, {
          pages: [entry('pages', 'home/en', { id: 'home' })],
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
      routes: [{ slug: { en: '/', de: '/' }, page: 'x', collection: 'pages', entry: 'home' }],
      collections: {
        pages: { idField: 'docId', localeField: 'lang' },
      },
    });
    const paired = pairCollections(custom, {
      pages: [entry('pages', 'home-en', { docId: 'home', lang: 'en' })],
    });
    assert.equal(paired.records[0]?.entryId, 'pages/home');
    assert.equal(paired.routed[0]?.entryId, 'pages/home');
    assert.equal(paired.routed[0]?.locale, 'en');
    assert.equal(paired.routed[0]?.entry, paired.records[0]?.entry);
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
      de: 'artikel/hallo-welt',
    });
    assert.deepEqual(query.getAlternatePaths('pages/home'), { en: '/', de: '/' });
    assert.deepEqual(query.getAlternatePaths('home'), {});
    assert.deepEqual(query.getAlternatePathsForPath('en', '/'), { en: '/', de: '/' });
    assert.deepEqual(query.getAlternatePaths('blog/solo'), { en: 'blog/solo' });
    assert.equal(query.getContentById('de', 'blog/solo'), undefined);
    assert.equal(query.getContentById('en', 'blog/solo')?.data.id, 'solo');
    assert.equal(query.getContentByPath('de', 'artikel/hallo-welt')?.data.id, 'hello-world');
    assert.equal(query.getContentByPath('en', '/')?.id, 'home-en');
    assert.equal(query.getContentById('en', 'pages/home')?.id, 'home-en');
    assert.equal(query.getContentById('en', 'home'), undefined);
    assert.equal(query.getContentByPath('en', 'blog')?.data.id, 'blog');
    assert.equal(query.getContentById('de', 'authors/ada')?.data.name, 'Ada');
  });

  it('lists paired locale+slug and sitemap / RSS alternates', () => {
    const slugs = query.getPairedSlugs();
    assert.equal(slugs.filter((item) => item.locale === 'en' && item.slug === '/').length, 1);
    assert.equal(slugs.filter((item) => item.locale === 'en' && item.slug === 'blog').length, 1);
    assert.equal(slugs.filter((item) => item.locale === 'de' && item.slug === 'artikel').length, 1);
    assert.ok(slugs.some((item) => item.locale === 'de' && item.slug === 'artikel/hallo-welt'));
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
      de: 'https://example.com/de/artikel/hallo-welt',
    });
    const home = sitemap.find((item) => item.locale === 'en' && item.path === '/');
    assert.equal(home?.entryId, 'pages/home');
    const listing = sitemap.find((item) => item.locale === 'en' && item.path === 'blog');
    assert.equal(listing?.entryId, 'pages/blog');
    const solo = sitemap.find((item) => item.entryId === 'blog/solo');
    assert.deepEqual(solo?.alternates, {
      en: 'https://example.com/en/blog/solo',
    });
    assert.ok(sitemap.every((item) => item.entryId !== 'ada'));
  });

  it('builds Hreflang data with per-locale URLs and x-default', () => {
    const head = query.getDocumentHead({ locale: 'de', path: 'artikel/hallo-welt' });
    assert.equal(head.lang, 'de');
    assert.equal(head.canonical, 'https://example.com/de/artikel/hallo-welt');
    assert.deepEqual(head.alternates, [
      { hreflang: 'de', href: 'https://example.com/de/artikel/hallo-welt' },
      { hreflang: 'en', href: 'https://example.com/en/blog/hello-world' },
    ]);
    assert.equal(head.xDefault, 'https://example.com/en/blog/hello-world');
    const links = hreflangLinks(head);
    assert.ok(links.some((link) => link.hreflang === 'x-default'));
    assert.ok(links.some((link) => link.hreflang === 'de'));
    assert.ok(links.some((link) => link.hreflang === 'en'));

    const missing = query.getDocumentHead({ locale: 'en', path: 'blog/solo' });
    assert.equal(missing.xDefault, 'https://example.com/en/blog/solo');
    assert.equal(missing.alternates.length, 1);
  });
});

describe('query helpers collection/id', () => {
  const fieldConfig = defineIntl({
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
    routes: [
      { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
      { slug: { en: 'tags/{slug}', de: 'schlagworte/{slug}' }, page: 'x', collection: 'tags' },
    ],
    collections: {
      blog: { slugField: 'slug' },
      tags: { slugField: 'slug' },
    },
  });
  const collections = {
    blog: [
      entry('blog', 'hello-world/en', { id: 'hello-world', locale: 'en', slug: 'hello-world' }),
      entry('blog', 'hello-world/de', { id: 'hello-world', locale: 'de', slug: 'hallo-welt' }),
    ],
    tags: [
      entry('tags', 'announcements/en', {
        id: 'announcements',
        locale: 'en',
        slug: 'announcements',
      }),
      entry('tags', 'announcements/de', {
        id: 'announcements',
        locale: 'de',
        slug: 'ankuendigungen',
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
    const slugs = query.getPairedSlugs();
    assert.equal(
      slugs.some((item) => item.slug === 'tags' || item.slug === 'schlagworte'),
      false,
    );
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

describe('published tails with no entry', () => {
  const tailConfig = defineIntl({
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
    routes: [
      { slug: { en: '/', de: '/' }, page: 'x' },
      { slug: { en: 'blog', de: 'artikel' }, page: 'x' },
      { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
    ],
    collections: { blog: { slugField: 'slug' } },
  });
  const blog = [
    entry('blog', 'hello-en', { id: 'hello-world', locale: 'en', slug: 'hello-world' }),
    entry('blog', 'hello-de', { id: 'hello-world', locale: 'de', slug: 'hallo-welt' }),
    entry('blog', 'solo-en', { id: 'solo', locale: 'en', slug: 'solo' }),
  ];
  const query = createIntlQuery({
    config: tailConfig,
    collections: { blog },
    getAbsoluteLocaleUrl: absolute,
  });

  it('returns each locale tail and no entry', () => {
    assert.deepEqual(query.getAlternatePathsForPath('en', '/'), { en: '/', de: '/' });
    assert.deepEqual(query.getAlternatePathsForPath('en', 'blog'), {
      en: 'blog',
      de: 'artikel',
    });
    assert.deepEqual(query.getAlternatePathsForPath('de', 'artikel'), {
      en: 'blog',
      de: 'artikel',
    });
    assert.equal(query.getContentByPath('en', '/'), undefined);
    assert.equal(query.getContentByPath('en', 'blog'), undefined);
    assert.equal(query.getContentByPath('de', 'artikel'), undefined);
    assert.equal(query.getContentByPath('en', 'blog/solo')?.data.id, 'solo');
    assert.equal(query.getContentByPath('de', 'blog/solo'), undefined);
  });

  it('lists the tail in the document head and the sitemap', () => {
    const head = query.getDocumentHead({ locale: 'de', path: 'artikel' });
    assert.deepEqual(head.alternates, [
      { hreflang: 'de', href: 'https://example.com/de/artikel' },
      { hreflang: 'en', href: 'https://example.com/en/blog' },
    ]);
    assert.equal(head.canonical, 'https://example.com/de/artikel');
    assert.equal(head.xDefault, 'https://example.com/en/blog');

    const sitemap = query.getSitemapEntries();
    const listing = sitemap.find((item) => item.locale === 'en' && item.path === 'blog');
    assert.equal(listing?.entryId, undefined);
    assert.deepEqual(listing?.alternates, {
      en: 'https://example.com/en/blog',
      de: 'https://example.com/de/artikel',
    });
    const home = sitemap.find((item) => item.locale === 'en' && item.path === '/');
    assert.equal(home?.entryId, undefined);
    assert.deepEqual(home?.alternates, {
      en: 'https://example.com/en',
      de: 'https://example.com/de',
    });
    assert.ok(query.getPairedSlugs().some((item) => item.locale === 'en' && item.slug === '/'));
    assert.ok(
      query.getPairedSlugs().some((item) => item.locale === 'de' && item.slug === 'artikel'),
    );
  });

  it('publishes an entry row at the written tail and does not reuse its slug', () => {
    const imprint = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        {
          slug: { en: 'imprint', de: 'impressum' },
          page: 'x',
          collection: 'pages',
          entry: 'imprint',
        },
        { slug: { en: 'pages/{slug}', de: 'seiten/{slug}' }, page: 'x', collection: 'pages' },
      ],
      collections: { pages: { slugField: 'slug' } },
    });
    const paired = pairCollections(imprint, {
      pages: [
        entry('pages', 'imprint-en', { id: 'imprint', locale: 'en', slug: 'legal' }),
        entry('pages', 'imprint-de', { id: 'imprint', locale: 'de', slug: 'rechtliches' }),
        entry('pages', 'other-en', { id: 'other', locale: 'en', slug: 'other' }),
      ],
    });
    const named = paired.routed.filter((item) => item.entryId === 'pages/imprint');
    assert.deepEqual(named.map((item) => item.path).sort(), ['impressum', 'imprint']);
    assert.equal(
      paired.routed.some(
        (item) => item.path === 'pages/legal' || item.path === 'seiten/rechtliches',
      ),
      false,
    );
    assert.equal(paired.routed.find((item) => item.entryId === 'pages/other')?.path, 'pages/other');
  });

  it('publishes one tail when {slug} names an entry', () => {
    const careers = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        {
          slug: { en: 'careers/{slug}', de: 'karriere/{slug}' },
          page: 'x',
          collection: 'pages',
          entry: 'designer',
        },
      ],
      collections: { pages: { slugField: 'slug' } },
    });
    const paired = pairCollections(careers, {
      pages: [
        entry('pages', 'designer-en', { id: 'designer', locale: 'en', slug: 'designer' }),
        entry('pages', 'designer-de', { id: 'designer', locale: 'de', slug: 'gestalter' }),
        entry('pages', 'other-en', { id: 'other', locale: 'en', slug: 'other' }),
      ],
    });
    assert.deepEqual(paired.routed.map((item) => item.path).sort(), [
      'careers/designer',
      'karriere/gestalter',
    ]);
    assert.ok(paired.records.some((item) => item.entryId === 'pages/other'));
    assert.equal(
      paired.routed.some((item) => item.entryId === 'pages/other'),
      false,
    );
  });

  it('publishes listing chunks per locale and omits page 1 as a number', () => {
    const posts: ReturnType<typeof entry>[] = [];
    for (let index = 0; index < 25; index += 1) {
      posts.push(
        entry('blog', `en-${index}`, { id: `en-${index}`, locale: 'en', slug: `en-${index}` }),
      );
    }
    for (let index = 0; index < 12; index += 1) {
      posts.push(
        entry('blog', `de-${index}`, { id: `de-${index}`, locale: 'de', slug: `de-${index}` }),
      );
    }
    const paged = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog', de: 'artikel' }, page: 'x', collection: 'blog', pageSize: 10 },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
      ],
      collections: { blog: { slugField: 'slug' } },
    });
    const query = createIntlQuery({
      config: paged,
      collections: { blog: posts },
      getAbsoluteLocaleUrl: absolute,
    });
    const slugs = query.getPairedSlugs();
    for (const path of ['blog', 'blog/2', 'blog/3', 'artikel', 'artikel/2']) {
      assert.equal(
        slugs.some((item) => item.slug === path),
        true,
        path,
      );
    }
    assert.equal(
      slugs.some(
        (item) => item.slug === 'blog/1' || item.slug === 'artikel/1' || item.slug === 'artikel/3',
      ),
      false,
    );
    assert.deepEqual(query.getAlternatePathsForPath('en', 'blog/3'), { en: 'blog/3' });
    assert.deepEqual(query.getAlternatePathsForPath('en', 'blog/2'), {
      en: 'blog/2',
      de: 'artikel/2',
    });
    assert.equal(query.getContentByPath('en', 'blog/2'), undefined);
    const page3 = query.getSitemapEntries().find((item) => item.path === 'blog/3');
    assert.deepEqual(page3?.alternates, { en: 'https://example.com/en/blog/3' });
    assert.equal(page3?.entryId, undefined);
  });

  it('counts the listing query, not every stored entry', () => {
    const posts: ReturnType<typeof entry>[] = [];
    for (let index = 0; index < 15; index += 1) {
      posts.push(
        entry('blog', `pub-${index}`, {
          id: `pub-${index}`,
          locale: 'en',
          slug: `pub-${index}`,
          status: 'published',
        }),
      );
    }
    for (let index = 0; index < 10; index += 1) {
      posts.push(
        entry('blog', `draft-${index}`, {
          id: `draft-${index}`,
          locale: 'en',
          slug: `draft-${index}`,
          status: 'draft',
        }),
      );
    }
    posts.push(
      entry('blog', 'de-only', {
        id: 'de-only',
        locale: 'de',
        slug: 'de-only',
        status: 'published',
      }),
    );
    const paged = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog', de: 'artikel' }, page: 'x', collection: 'blog', pageSize: 10 },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
      ],
      collections: { blog: { slugField: 'slug' } },
    });
    const paired = pairCollections(paged, { blog: posts }, [], (_collection, locale, entries) =>
      entries.filter((item) => item.data.locale === locale && item.data.status !== 'draft'),
    );
    const tails = paired.tails.map((item) => `${item.locale}:${item.path}`).sort();
    assert.deepEqual(tails, ['de:artikel', 'en:blog', 'en:blog/2']);
    assert.ok(paired.routed.some((item) => item.path === 'blog/draft-0'));
  });

  it('aborts when an entry slug matches a published page number', () => {
    const posts = [entry('blog', 'page-number', { id: 'page-number', locale: 'en', slug: '2' })];
    for (let index = 0; index < 10; index += 1) {
      posts.push(
        entry('blog', `en-${index}`, { id: `en-${index}`, locale: 'en', slug: `en-${index}` }),
      );
    }
    const paged = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog', de: 'artikel' }, page: 'x', collection: 'blog', pageSize: 10 },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
      ],
      collections: { blog: { slugField: 'slug' } },
    });
    assert.throws(
      () => pairCollections(paged, { blog: posts }),
      /entry slug "2" matches published page 2 on section "blog"/,
    );
  });

  it('keeps a numeric slug when that page number is not published', () => {
    const paged = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog', de: 'artikel' }, page: 'x', collection: 'blog', pageSize: 10 },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
      ],
      collections: { blog: { slugField: 'slug' } },
    });
    const paired = pairCollections(paged, {
      blog: [entry('blog', 'two', { id: 'two', locale: 'en', slug: '2' })],
    });
    assert.equal(paired.routed.find((item) => item.entryId === 'blog/two')?.path, 'blog/2');
    assert.equal(
      paired.tails.some((item) => item.path === 'blog/2'),
      false,
    );
  });

  it('omits pageSize and publishes the one written tail', () => {
    const posts: ReturnType<typeof entry>[] = [];
    for (let index = 0; index < 25; index += 1) {
      posts.push(
        entry('blog', `en-${index}`, { id: `en-${index}`, locale: 'en', slug: `en-${index}` }),
      );
    }
    const once = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog', de: 'artikel' }, page: 'x', collection: 'blog' },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
      ],
      collections: { blog: { slugField: 'slug' } },
    });
    const paired = pairCollections(once, { blog: posts });
    assert.deepEqual(paired.tails.map((item) => item.path).sort(), ['artikel', 'blog']);
  });

  it('aborts when a tail collides with an entry', () => {
    const clash = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog/hello-world', de: 'other' }, page: 'x' },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, page: 'x', collection: 'blog' },
      ],
      collections: { blog: { slugField: 'slug' } },
    });
    assert.throws(
      () => pairCollections(clash, { blog }),
      /\(locale, path\) "en" \/ "blog\/hello-world" collides/,
    );
  });
});
