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
    { slug: { en: '/', de: '/' }, collection: 'pages', entry: 'home' },
    { slug: { en: 'blog', de: 'artikel' }, collection: 'pages', entry: 'blog' },
    { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog' },
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
      routes: [{ slug: { en: 'blog/{slug}' }, collection: 'blog' }],
      collections: { blog: { slugField: 'slug' } },
    });
    assert.equal(parsed.success, false);
  });

  it('accepts per-collection idField and localeField', () => {
    const parsed = intlConfigSchema.safeParse({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [{ slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'pages' }],
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
      routes: [{ slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'pages' }],
      collections: { pages: {} },
    });
    assert.ok(issues.some((issue) => issue.includes('pattern row') && issue.includes('pages')));
  });

  it('rejects an entry row on a collection with slugField', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog' },
        { slug: { en: 'hello', de: 'hallo' }, collection: 'blog', entry: 'hello' },
      ],
      collections: { blog: { slugField: 'slug' } },
    });
    assert.ok(issues.some((issue) => issue.includes('entry row') && issue.includes('blog')));
    assert.equal(
      issues.some((issue) => issue.includes('has no route row')),
      false,
    );
  });

  it('rejects two pattern rows for one collection', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog' },
        { slug: { en: 'news/{slug}', de: 'neuigkeiten/{slug}' }, collection: 'blog' },
      ],
      collections: { blog: { slugField: 'slug' } },
    });
    assert.ok(issues.some((issue) => issue.includes('two pattern rows') && issue.includes('blog')));
  });

  it('rejects a {slug} token that is not the final segment', () => {
    for (const slug of ['{slug}', '/{slug}', 'blog/{slug}/more']) {
      const issues = routeConfigIssues({
        locales,
        routes: [{ slug: { en: slug, de: 'artikel/{slug}' }, collection: 'blog' }],
        collections: { blog: { slugField: 'slug' } },
      });
      assert.ok(
        issues.some((issue) => issue.includes('locale "en"') && issue.includes('{slug}')),
        slug,
      );
    }
  });

  it('rejects a repeated section in one locale', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog' },
        { slug: { en: 'blog/{slug}', de: 'schlagworte/{slug}' }, collection: 'tags' },
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
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog' },
        { slug: { en: 'blog/hello-world', de: 'other' }, collection: 'pages', entry: 'clash' },
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

  it('aborts when slugField has no route row', () => {
    const bare = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      collections: { blog: { slugField: 'slug' } },
    });
    assert.throws(() => pairCollections(bare, { blog: [] }), /slugField has no route/);
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
      { slug: { en: '/', de: '/' }, collection: 'pages', entry: 'home' },
      { slug: { en: 'blog', de: 'artikel' }, collection: 'pages', entry: 'blog' },
      { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog' },
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
      routes: [{ slug: { en: '/', de: '/' }, collection: 'pages', entry: 'home' }],
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
      { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, collection: 'blog' },
      { slug: { en: 'tags/{slug}', de: 'schlagworte/{slug}' }, collection: 'tags' },
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
