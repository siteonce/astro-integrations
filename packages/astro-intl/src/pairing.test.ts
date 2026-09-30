import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defineIntl, type IntlConfig, intlConfigSchema, routeConfigIssues } from './define-intl.ts';
import { id, locale, slug } from './fragments.ts';
import { type CollectionEntryLike, pairCollections } from './pairing.ts';
import { createIntlQuery } from './query.ts';

const config: IntlConfig = {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  routes: [
    { slug: { en: '/', de: '/' }, view: 'x', collection: 'pages', entry: 'home' },
    { slug: { en: 'blog', de: 'artikel' }, view: 'x', collection: 'pages', entry: 'blog' },
    { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
  ],
  collections: { translated: ['pages', 'blog', 'authors'] },
};

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
      routes: [{ slug: { en: 'blog/{slug}' }, view: 'x', collection: 'blog' }],
      collections: { translated: ['blog'] },
    });
    assert.equal(parsed.success, false);
  });

  it('accepts field name overrides on a translated collection', () => {
    const parsed = intlConfigSchema.safeParse({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'pages' },
      ],
      collections: {
        translated: ['pages'],
        fields: { pages: { id: 'uid', locale: 'lang', slug: 'path' } },
      },
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.deepEqual(parsed.data.collections?.fields?.pages, {
      id: 'uid',
      locale: 'lang',
      slug: 'path',
    });
  });

  it('rejects an empty field name', () => {
    for (const key of ['id', 'locale', 'slug'] as const) {
      const parsed = intlConfigSchema.safeParse({
        locales: ['en'],
        defaultLocale: 'en',
        collections: { translated: ['pages'], fields: { pages: { [key]: '' } } },
      });
      assert.equal(parsed.success, false, key);
    }
  });

  it('rejects a collection name used as a key of collections', () => {
    const parsed = intlConfigSchema.safeParse({
      locales: ['en'],
      defaultLocale: 'en',
      collections: { pages: { id: 'uid' } },
    });
    assert.equal(parsed.success, false);
  });

  it('rejects top-level entryId and a field named entryId', () => {
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
      collections: {
        translated: ['pages'],
        fields: { pages: { entryId: 'frontmatter' } },
      },
    });
    assert.equal(perCollection.success, false);
  });

  it('normalizes a collection string and { name, entry? } to the flat pair', () => {
    const base = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      collections: { translated: ['blog'] },
    };
    const row = { slug: { en: 'blog', de: 'artikel' }, view: 'x' };
    const asString = intlConfigSchema.safeParse({
      ...base,
      routes: [{ ...row, collection: 'blog' }],
    });
    const asName = intlConfigSchema.safeParse({
      ...base,
      routes: [{ ...row, collection: { name: 'blog' } }],
    });
    assert.equal(asString.success, true);
    assert.equal(asName.success, true);
    if (!asString.success || !asName.success) return;
    const stringRoute = asString.data.routes?.[0];
    const nameRoute = asName.data.routes?.[0];
    assert.equal(stringRoute?.collection, 'blog');
    assert.equal(stringRoute?.entry, undefined);
    assert.deepEqual(
      { collection: stringRoute?.collection, entry: stringRoute?.entry },
      { collection: nameRoute?.collection, entry: nameRoute?.entry },
    );

    const named = intlConfigSchema.safeParse({
      ...base,
      routes: [{ ...row, collection: { name: 'blog', entry: 'hello' } }],
    });
    assert.equal(named.success, true);
    if (!named.success) return;
    assert.equal(named.data.routes?.[0]?.collection, 'blog');
    assert.equal(named.data.routes?.[0]?.entry, 'hello');

    const sibling = intlConfigSchema.safeParse({
      ...base,
      routes: [{ ...row, collection: 'blog', entry: 'hello' }],
    });
    assert.equal(sibling.success, false);

    const missingName = intlConfigSchema.safeParse({
      ...base,
      routes: [{ ...row, collection: { entry: 'hello' } }],
    });
    assert.equal(missingName.success, false);

    const empty = intlConfigSchema.safeParse({
      ...base,
      routes: [{ ...row, collection: {} }],
    });
    assert.equal(empty.success, false);
  });
});

describe('routeConfigIssues', () => {
  const locales = ['en', 'de'] as const;

  it('allows a {slug} row on a translated collection', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'pages' },
      ],
      collections: { translated: ['pages'] },
    });
    assert.deepEqual(issues, []);
  });

  it('rejects a route collection that is not translated', () => {
    const missing = routeConfigIssues({
      locales,
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'pages' },
      ],
      collections: { untranslated: ['pages'] },
    });
    assert.ok(
      missing.some((issue) => issue === 'collection "pages" is not in collections.translated'),
    );

    const parsed = intlConfigSchema.safeParse({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'pages' },
      ],
      collections: { translated: ['posts', 'posts'] },
    });
    assert.equal(parsed.success, false);
    if (parsed.success) return;
    assert.ok(
      parsed.error.issues.some(
        (issue) => issue.message === 'collections.translated lists "posts" more than once',
      ),
    );
  });

  it('rejects a name listed twice or in both lists', () => {
    const repeated = routeConfigIssues({
      locales,
      collections: { translated: ['posts', 'posts', 'posts'] },
    });
    assert.deepEqual(repeated, ['collections.translated lists "posts" more than once']);

    const twice = routeConfigIssues({
      locales,
      collections: { untranslated: ['roles', 'roles'] },
    });
    assert.ok(
      twice.some((issue) => issue === 'collections.untranslated lists "roles" more than once'),
    );

    const both = routeConfigIssues({
      locales,
      collections: { translated: ['authors'], untranslated: ['authors'] },
    });
    assert.ok(
      both.some(
        (issue) =>
          issue === '"authors" is in both collections.translated and collections.untranslated',
      ),
    );
  });

  it('rejects a fields key that is not translated', () => {
    const issues = routeConfigIssues({
      locales,
      collections: {
        translated: ['posts'],
        untranslated: ['sources'],
        fields: { sources: { id: 'uid' } },
      },
    });
    assert.ok(
      issues.some(
        (issue) => issue === 'collections.fields key "sources" is not in collections.translated',
      ),
    );
  });

  it('allows an entry row beside a {slug} row', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
          view: 'x',
          collection: 'blog',
          fallbackView: 'missing',
        },
        { slug: { en: 'hello', de: 'hallo' }, view: 'x', collection: 'blog', entry: 'hello' },
      ],
      collections: { translated: ['blog'] },
    });
    assert.deepEqual(issues, []);
  });

  it('allows pagination beside one {slug} row', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
      collections: { translated: ['blog'] },
    });
    assert.deepEqual(issues, []);
  });

  it('rejects a {page} token that is not the whole final segment', () => {
    for (const slug of ['blog/{page}/more', 'blog/x{page}', '{page}/blog', 'pre{page}']) {
      const issues = routeConfigIssues({
        locales,
        routes: [
          {
            slug: { en: 'blog', de: 'artikel' },
            view: 'x',
            collection: 'blog',
            pagination: { pageSize: 10, slug: { en: slug, de: 'artikel/{page}' } },
          },
        ],
        collections: { translated: ['blog'] },
      });
      assert.ok(
        issues.some((issue) => issue.includes('locale "en"') && issue.includes('{page}')),
        slug,
      );
    }
  });

  it('rejects a pagination tail that holds {page} and {slug}', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: {
            pageSize: 10,
            slug: { en: 'blog/{slug}/{page}', de: 'artikel/{page}' },
          },
        },
      ],
      collections: { translated: ['blog'] },
    });
    assert.ok(issues.some((issue) => issue.includes('cannot hold both {page} and {slug}')));
  });

  it('rejects {page} on the row slug', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog/{page}', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
      collections: { translated: ['blog'] },
    });
    assert.ok(issues.some((issue) => issue === '{page} belongs in pagination.slug in locale "en"'));
  });

  it('rejects pagination with no collection, an entry, or a {slug} row', () => {
    const bare = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
    });
    assert.ok(bare.some((issue) => issue === 'pagination requires a collection'));

    const named = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          entry: 'hello',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
      collections: { translated: ['blog'] },
    });
    assert.ok(named.some((issue) => issue === 'pagination cannot name an entry'));

    const pattern = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
          view: 'x',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
      collections: { translated: ['blog'] },
    });
    assert.ok(pattern.some((issue) => issue === 'pagination cannot sit on a {slug} row'));
  });

  it('rejects pagination.slug locales that differ from the row slug', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: {
            pageSize: 10,
            slug: { en: 'blog/{page}', de: 'artikel/{page}', fr: 'journal/{page}' },
          },
        },
      ],
      collections: { translated: ['blog'] },
    });
    assert.ok(issues.some((issue) => issue.includes('name different locales')));
  });

  it('allows two pagination rows on one collection', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'a',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
        {
          slug: { en: 'news', de: 'neu' },
          view: 'b',
          collection: 'blog',
          pagination: { pageSize: 5, slug: { en: 'news/{page}', de: 'neu/{page}' } },
        },
      ],
      collections: { translated: ['blog'] },
    });
    assert.deepEqual(issues, []);
  });

  it('allows a root listing and a pagination tail with its own segment', () => {
    const root = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: '/', de: '/' },
          view: 'home',
          collection: 'posts',
          pagination: { pageSize: 1, slug: { en: '{page}', de: '{page}' } },
        },
      ],
      collections: { translated: ['posts'] },
    });
    assert.deepEqual(root, []);

    const segment = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: {
            pageSize: 10,
            slug: { en: 'blog/page/{page}', de: 'artikel/seite/{page}' },
          },
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
      collections: { translated: ['blog'] },
    });
    assert.deepEqual(segment, []);
  });

  it('rejects a non-positive pagination.pageSize and a top-level pageSize', () => {
    const sized = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: { pageSize: 0, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
      collections: { translated: ['blog'] },
    });
    assert.ok(sized.some((issue) => issue === 'pagination.pageSize must be a positive integer'));

    const fractional = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: { pageSize: 1.5, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
      collections: { translated: ['blog'] },
    });
    assert.ok(
      fractional.some((issue) => issue === 'pagination.pageSize must be a positive integer'),
    );

    const parsed = intlConfigSchema.safeParse({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [{ slug: { en: 'blog', de: 'artikel' }, view: 'x', collection: 'blog', pageSize: 1 }],
      collections: { translated: ['blog'] },
    });
    assert.equal(parsed.success, false);
    if (parsed.success) return;
    assert.match(parsed.error.message, /pageSize moved to pagination\.pageSize/);
  });

  it('rejects a pagination.view that fails the view checks', () => {
    const extension = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: {
            pageSize: 10,
            slug: { en: 'blog/{page}', de: 'artikel/{page}' },
            view: 'archive.astro',
          },
        },
      ],
      collections: { translated: ['blog'] },
    });
    assert.ok(
      extension.some(
        (issue) => issue === 'pagination.view "archive.astro" includes a file extension',
      ),
    );

    const keys = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: {
            pageSize: 10,
            slug: { en: 'blog/{page}', de: 'artikel/{page}' },
            view: { en: 'archive' },
          },
        },
      ],
      collections: { translated: ['blog'] },
    });
    assert.ok(keys.some((issue) => issue.startsWith('pagination.view keys must be')));
  });

  it('rejects two pattern rows for one collection', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
        { slug: { en: 'news/{slug}', de: 'neuigkeiten/{slug}' }, view: 'x', collection: 'blog' },
      ],
      collections: { translated: ['blog'] },
    });
    assert.ok(issues.some((issue) => issue.includes('two pattern rows') && issue.includes('blog')));
  });

  it('rejects a {slug} token that is not the final segment', () => {
    for (const slug of ['{slug}', '/{slug}', 'blog/{slug}/more']) {
      const issues = routeConfigIssues({
        locales,
        routes: [{ slug: { en: slug, de: 'artikel/{slug}' }, view: 'x', collection: 'blog' }],
        collections: { translated: ['blog'] },
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
      routes: [{ slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x' }],
    });
    assert.ok(issues.some((issue) => issue === '{slug} pattern has no collection'));
  });

  it('rejects a repeated section in one locale', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
        { slug: { en: 'blog/{slug}', de: 'schlagworte/{slug}' }, view: 'x', collection: 'tags' },
      ],
      collections: { translated: ['blog', 'tags'] },
    });
    assert.ok(
      issues.some((issue) => issue.includes('duplicate section "blog"') && issue.includes('"en"')),
    );
    assert.equal(
      issues.some((issue) => issue.includes('artikel') || issue.includes('schlagworte')),
      false,
    );
  });

  it('rejects fallbackView on a row without {slug}', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about', fallbackView: 'missing' }],
    });
    assert.ok(issues.some((issue) => issue === 'fallbackView needs a {slug} row'));

    const named = routeConfigIssues({
      locales,
      routes: [
        {
          slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
          view: 'post',
          collection: 'blog',
          fallbackView: 'missing.astro',
        },
      ],
      collections: { translated: ['blog'] },
    });
    assert.ok(named.some((issue) => issue === 'view "missing.astro" includes a file extension'));
  });

  it('checks the config fallbackView and a row fallbackView of false', () => {
    const optOut = routeConfigIssues({
      locales,
      routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about', fallbackView: false }],
    });
    assert.ok(optOut.some((issue) => issue === 'fallbackView needs a {slug} row'));

    const named = routeConfigIssues({
      locales,
      fallbackView: 'missing.astro',
      routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about' }],
    });
    assert.deepEqual(named, ['view "missing.astro" includes a file extension']);

    const staticOnly = routeConfigIssues({
      locales,
      fallbackView: 'missing',
      routes: [{ slug: { en: 'about', de: 'ueber' }, view: 'about' }],
    });
    assert.deepEqual(staticOnly, []);
  });

  it('parses a row fallbackView of false and rejects true', () => {
    const base = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      collections: { translated: ['blog'] },
    };
    const row = {
      slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
      view: 'post',
      collection: 'blog',
    };
    assert.equal(
      intlConfigSchema.safeParse({ ...base, routes: [{ ...row, fallbackView: false }] }).success,
      true,
    );
    assert.equal(
      intlConfigSchema.safeParse({ ...base, routes: [{ ...row, fallbackView: true }] }).success,
      false,
    );
  });

  it('rejects a view name that is not a path', () => {
    const extension = routeConfigIssues({
      locales,
      routes: [{ slug: { en: '/', de: '/' }, view: 'home.astro' }],
    });
    assert.ok(extension.some((issue) => issue === 'view "home.astro" includes a file extension'));

    const parent = routeConfigIssues({
      locales,
      routes: [{ slug: { en: '/', de: '/' }, view: 'blog/../post' }],
    });
    assert.ok(parent.some((issue) => issue === 'view "blog/../post" is not a path'));

    const empty = routeConfigIssues({
      locales,
      routes: [{ slug: { en: '/', de: '/' }, view: 'blog//post' }],
    });
    assert.ok(empty.some((issue) => issue === 'view "blog//post" is not a path'));
  });

  it('rejects view keys that are not the configured locales', () => {
    const issues = routeConfigIssues({
      locales,
      routes: [{ slug: { en: '/', de: '/' }, view: { en: 'home', fr: 'accueil' } }],
    });
    assert.ok(
      issues.some((issue) => issue === 'view keys must be the configured locales (de, en)'),
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
    const clash: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
        {
          slug: { en: 'blog/hello-world', de: 'other' },
          view: 'x',
          collection: 'pages',
          entry: 'clash',
        },
      ],
      collections: { translated: ['blog', 'pages'] },
    };
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

  it('keeps a translated collection with no {slug} row as records', () => {
    const notes: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'about', de: 'ueber' }, view: 'x', collection: 'notes', entry: 'about' },
      ],
      collections: {
        translated: ['notes'],
        fields: { notes: { slug: 'path' } },
      },
    };
    const paired = pairCollections(notes, {
      notes: [
        entry('notes', 'about-en', { id: 'about', locale: 'en', path: 'ignored' }),
        entry('notes', 'about-de', { id: 'about', locale: 'de', path: 'ignored' }),
        entry('notes', 'other-en', { id: 'other', locale: 'en', path: 'other' }),
      ],
    });
    assert.ok(paired.records.some((item) => item.entryId === 'notes/other'));
    assert.equal(
      paired.routed.some((item) => item.entryId === 'notes/other'),
      false,
    );
    assert.deepEqual(
      paired.routed
        .filter((item) => item.entryId === 'notes/about')
        .map((item) => item.path)
        .sort(),
      ['about', 'ueber'],
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

  it('aborts when a translated collection is absent', () => {
    assert.throws(
      () => pairCollections(config, { pages: [], blog: [] }),
      /collections\.translated: "authors" is not a content collection/,
    );
  });

  it('aborts when an untranslated collection is absent', () => {
    const withSources: IntlConfig = {
      ...config,
      collections: {
        translated: ['pages', 'blog', 'authors'],
        untranslated: ['sources'],
      },
    };
    assert.throws(
      () => pairCollections(withSources, { pages: [], blog: [], authors: [] }),
      /collections\.untranslated: "sources" is not a content collection/,
    );
  });
});

describe('intlConfigSchema prefixDefaultLocale', () => {
  it('resolves an omitted routing block to false', () => {
    const authored = defineIntl({ locales: ['en', 'de'], defaultLocale: 'en' });
    const parsed = intlConfigSchema.parse(authored);
    const flag: boolean = parsed.routing.prefixDefaultLocale;
    assert.equal(flag, false);
  });

  it('resolves an omitted prefixDefaultLocale to false and keeps an explicit true', () => {
    const omitted = intlConfigSchema.parse({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: {},
    });
    const explicit = intlConfigSchema.parse({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
    });
    assert.equal(omitted.routing.prefixDefaultLocale, false);
    assert.equal(explicit.routing.prefixDefaultLocale, true);
  });
});

describe('intlConfigSchema viewRendering', () => {
  const base = {
    locales: ['en'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
  };

  it('accepts build and request and rejects anything else', () => {
    const omitted = intlConfigSchema.safeParse(base);
    const build = intlConfigSchema.safeParse({ ...base, viewRendering: 'build' });
    const request = intlConfigSchema.safeParse({ ...base, viewRendering: 'request' });
    const other = intlConfigSchema.safeParse({ ...base, viewRendering: 'live' });
    assert.equal(omitted.success, true);
    assert.equal(build.success, true);
    assert.equal(request.success, true);
    assert.equal(other.success, false);
    if (!omitted.success || !build.success || !request.success) return;
    assert.equal(omitted.data.viewRendering, undefined);
    assert.equal(build.data.viewRendering, 'build');
    assert.equal(request.data.viewRendering, 'request');
  });
});

describe('pairCollections field id', () => {
  const fieldConfig: IntlConfig = {
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
    routes: [
      { slug: { en: '/', de: '/' }, view: 'x', collection: 'pages', entry: 'home' },
      { slug: { en: 'blog', de: 'artikel' }, view: 'x', collection: 'pages', entry: 'blog' },
      { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
    ],
    collections: { translated: ['pages', 'blog'] },
  };

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

  it('reads renamed id and locale fields', () => {
    const custom: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [{ slug: { en: '/', de: '/' }, view: 'x', collection: 'pages', entry: 'home' }],
      collections: {
        translated: ['pages'],
        fields: { pages: { id: 'docId', locale: 'lang' } },
      },
    };
    const paired = pairCollections(custom, {
      pages: [entry('pages', 'home-en', { docId: 'home', lang: 'en' })],
    });
    assert.equal(paired.records[0]?.entryId, 'pages/home');
    assert.equal(paired.routed[0]?.entryId, 'pages/home');
    assert.equal(paired.routed[0]?.locale, 'en');
    assert.equal(paired.routed[0]?.entry, paired.records[0]?.entry);
  });

  it('reads renamed id, locale, and slug fields', () => {
    const custom: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'posts',
          pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'posts' },
      ],
      collections: {
        translated: ['posts'],
        fields: { posts: { id: 'uid', locale: 'lang', slug: 'path' } },
      },
    };
    const enA = entry('posts', 'a-en', { uid: 'a', lang: 'en', path: 'alpha', locale: 'de' });
    const enB = entry('posts', 'b-en', { uid: 'b', lang: 'en', path: 'beta' });
    const deA = entry('posts', 'a-de', { uid: 'a', lang: 'de', path: 'alpha-de', locale: 'en' });
    const paired = pairCollections(custom, { posts: [enA, enB, deA] });
    assert.equal(
      paired.routed.find((item) => item.locale === 'en' && item.entryId === 'posts/a')?.path,
      'blog/alpha',
    );
    assert.equal(
      paired.routed.find((item) => item.locale === 'de' && item.entryId === 'posts/a')?.path,
      'artikel/alpha-de',
    );
    assert.deepEqual(
      paired.tails
        .filter((item) => item.locale === 'en')
        .map((item) => item.path)
        .sort(),
      ['blog', 'blog/2'],
    );
    assert.deepEqual(
      paired.tails
        .filter((item) => item.locale === 'de')
        .map((item) => item.path)
        .sort(),
      ['artikel'],
    );
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
    assert.equal(helloEn?.xDefault, 'https://example.com/en/blog/hello-world');
    const home = sitemap.find((item) => item.locale === 'en' && item.path === '/');
    assert.equal(home?.entryId, 'pages/home');
    const listing = sitemap.find((item) => item.locale === 'en' && item.path === 'blog');
    assert.equal(listing?.entryId, 'pages/blog');
    const solo = sitemap.find((item) => item.entryId === 'blog/solo');
    assert.deepEqual(solo?.alternates, {
      en: 'https://example.com/en/blog/solo',
    });
    assert.equal(solo?.xDefault, 'https://example.com/en/blog/solo');
    assert.ok(sitemap.every((item) => item.entryId !== 'ada'));
  });

  it('builds hreflang links with per-locale URLs and x-default', () => {
    assert.deepEqual(query.hreflangLinks('de', 'artikel/hallo-welt'), [
      { hreflang: 'de', href: 'https://example.com/de/artikel/hallo-welt' },
      { hreflang: 'en', href: 'https://example.com/en/blog/hello-world' },
      { hreflang: 'x-default', href: 'https://example.com/en/blog/hello-world' },
    ]);
    assert.deepEqual(query.hreflangLinks('en', 'blog/solo'), [
      { hreflang: 'en', href: 'https://example.com/en/blog/solo' },
      { hreflang: 'x-default', href: 'https://example.com/en/blog/solo' },
    ]);
  });
});

describe('query helpers collection/id', () => {
  const fieldConfig: IntlConfig = {
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
    routes: [
      { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      { slug: { en: 'tags/{slug}', de: 'schlagworte/{slug}' }, view: 'x', collection: 'tags' },
    ],
    collections: { translated: ['blog', 'tags'] },
  };
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
    assert.equal(helloEn?.xDefault, 'https://example.com/en/blog/hello-world');
  });
});

describe('published tails with no entry', () => {
  const tailConfig: IntlConfig = {
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
    routes: [
      { slug: { en: '/', de: '/' }, view: 'x' },
      { slug: { en: 'blog', de: 'artikel' }, view: 'x' },
      { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
    ],
    collections: { translated: ['blog'] },
  };
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

  it('lists the tail in hreflang links and the sitemap', () => {
    assert.deepEqual(query.hreflangLinks('de', 'artikel'), [
      { hreflang: 'de', href: 'https://example.com/de/artikel' },
      { hreflang: 'en', href: 'https://example.com/en/blog' },
      { hreflang: 'x-default', href: 'https://example.com/en/blog' },
    ]);

    const sitemap = query.getSitemapEntries();
    const listing = sitemap.find((item) => item.locale === 'en' && item.path === 'blog');
    assert.equal(listing?.entryId, undefined);
    assert.deepEqual(listing?.alternates, {
      en: 'https://example.com/en/blog',
      de: 'https://example.com/de/artikel',
    });
    assert.equal(listing?.xDefault, 'https://example.com/en/blog');
    const home = sitemap.find((item) => item.locale === 'en' && item.path === '/');
    assert.equal(home?.entryId, undefined);
    assert.deepEqual(home?.alternates, {
      en: 'https://example.com/en',
      de: 'https://example.com/de',
    });
    assert.equal(home?.xDefault, 'https://example.com/en');
    assert.ok(query.getPairedSlugs().some((item) => item.locale === 'en' && item.slug === '/'));
    assert.ok(
      query.getPairedSlugs().some((item) => item.locale === 'de' && item.slug === 'artikel'),
    );
  });

  it('publishes an entry row at the written tail and does not reuse its slug', () => {
    const imprint: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        {
          slug: { en: 'imprint', de: 'impressum' },
          view: 'x',
          collection: 'pages',
          entry: 'imprint',
        },
        { slug: { en: 'pages/{slug}', de: 'seiten/{slug}' }, view: 'x', collection: 'pages' },
      ],
      collections: { translated: ['pages'] },
    };
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
    const careers: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        {
          slug: { en: 'careers/{slug}', de: 'karriere/{slug}' },
          view: 'x',
          collection: 'pages',
          entry: 'designer',
        },
      ],
      collections: { translated: ['pages'] },
    };
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

  it('publishes a literal page-1 tail and leaves the unnumbered tail free', () => {
    const posts: ReturnType<typeof entry>[] = [];
    for (let index = 0; index < 12; index += 1) {
      posts.push(
        entry('blog', `en-${index}`, { id: `en-${index}`, locale: 'en', slug: `en-${index}` }),
      );
    }
    const listing = {
      slug: { en: 'blog/1', de: 'artikel/1' },
      view: 'x',
      collection: 'blog',
      pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
    };
    const base = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      collections: { translated: ['blog'] },
    };
    const alone: IntlConfig = {
      ...base,
      routes: [
        listing,
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
    };
    const aloneTails = pairCollections(alone, { blog: posts }).tails.map(
      (item) => `${item.locale}:${item.path}`,
    );
    assert.deepEqual(aloneTails.sort(), ['de:artikel/1', 'en:blog/1', 'en:blog/2']);

    const withStatic: IntlConfig = {
      ...base,
      routes: [
        listing,
        { slug: { en: 'blog', de: 'artikel' }, view: 'index' },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
    };
    assert.deepEqual(routeConfigIssues(withStatic), []);
    const tails = pairCollections(withStatic, { blog: posts }).tails.map(
      (item) => `${item.locale}:${item.path}`,
    );
    assert.deepEqual(tails.sort(), [
      'de:artikel',
      'de:artikel/1',
      'en:blog',
      'en:blog/1',
      'en:blog/2',
    ]);
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
    const paged: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/seite/{page}' } },
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
      collections: { translated: ['blog'] },
    };
    const query = createIntlQuery({
      config: paged,
      collections: { blog: posts },
      getAbsoluteLocaleUrl: absolute,
    });
    const slugs = query.getPairedSlugs();
    for (const path of ['blog', 'blog/2', 'blog/3', 'artikel', 'artikel/seite/2']) {
      assert.equal(
        slugs.some((item) => item.slug === path),
        true,
        path,
      );
    }
    assert.equal(
      slugs.some(
        (item) =>
          item.slug === 'blog/1' || item.slug === 'artikel/1' || item.slug === 'artikel/seite/3',
      ),
      false,
    );
    assert.deepEqual(query.getAlternatePathsForPath('en', 'blog/3'), { en: 'blog/3' });
    assert.deepEqual(query.getAlternatePathsForPath('en', 'blog/2'), {
      en: 'blog/2',
      de: 'artikel/seite/2',
    });
    assert.equal(query.getContentByPath('en', 'blog/2'), undefined);
    const page3 = query.getSitemapEntries().find((item) => item.path === 'blog/3');
    assert.deepEqual(page3?.alternates, { en: 'https://example.com/en/blog/3' });
    assert.equal(page3?.entryId, undefined);
  });

  it('counts every entry in that locale toward listing pages', () => {
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
    const paged: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
      collections: { translated: ['blog'] },
    };
    const paired = pairCollections(paged, { blog: posts });
    const tails = paired.tails.map((item) => `${item.locale}:${item.path}`).sort();
    assert.deepEqual(tails, ['de:artikel', 'en:blog', 'en:blog/2', 'en:blog/3']);
    assert.ok(paired.routed.some((item) => item.path === 'blog/draft-0'));
  });

  it('aborts when an entry slug matches a published page number', () => {
    const posts = [entry('blog', 'page-number', { id: 'page-number', locale: 'en', slug: '2' })];
    for (let index = 0; index < 10; index += 1) {
      posts.push(
        entry('blog', `en-${index}`, { id: `en-${index}`, locale: 'en', slug: `en-${index}` }),
      );
    }
    const paged: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
      collections: { translated: ['blog'] },
    };
    assert.throws(
      () => pairCollections(paged, { blog: posts }),
      /entry slug "2" matches published page 2 on section "blog"/,
    );
  });

  it('keeps a numeric slug when the {page} row uses another section', () => {
    const posts = [entry('blog', 'page-number', { id: 'page-number', locale: 'en', slug: '2' })];
    for (let index = 0; index < 10; index += 1) {
      posts.push(
        entry('blog', `en-${index}`, { id: `en-${index}`, locale: 'en', slug: `en-${index}` }),
      );
    }
    const paged: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: {
            pageSize: 10,
            slug: { en: 'blog/page/{page}', de: 'artikel/seite/{page}' },
          },
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
      collections: { translated: ['blog'] },
    };
    const paired = pairCollections(paged, { blog: posts });
    assert.equal(paired.routed.find((item) => item.entryId === 'blog/page-number')?.path, 'blog/2');
    assert.equal(
      paired.tails.some((item) => item.path === 'blog/page/2'),
      true,
    );
  });

  it('keeps a numeric slug when that page number is not published', () => {
    const paged: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'x',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
      collections: { translated: ['blog'] },
    };
    const paired = pairCollections(paged, {
      blog: [entry('blog', 'two', { id: 'two', locale: 'en', slug: '2' })],
    });
    assert.equal(paired.routed.find((item) => item.entryId === 'blog/two')?.path, 'blog/2');
    assert.equal(
      paired.tails.some((item) => item.path === 'blog/2'),
      false,
    );
  });

  it('omits pagination and publishes the one written tail', () => {
    const posts: ReturnType<typeof entry>[] = [];
    for (let index = 0; index < 25; index += 1) {
      posts.push(
        entry('blog', `en-${index}`, { id: `en-${index}`, locale: 'en', slug: `en-${index}` }),
      );
    }
    const once: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog', de: 'artikel' }, view: 'x', collection: 'blog' },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
      collections: { translated: ['blog'] },
    };
    const paired = pairCollections(once, { blog: posts });
    assert.deepEqual(paired.tails.map((item) => item.path).sort(), ['artikel', 'blog']);
  });

  it('aborts when a tail collides with an entry', () => {
    const clash: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog/hello-world', de: 'other' }, view: 'x' },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'x', collection: 'blog' },
      ],
      collections: { translated: ['blog'] },
    };
    assert.throws(
      () => pairCollections(clash, { blog }),
      /\(locale, path\) "en" \/ "blog\/hello-world" collides/,
    );
  });
});
