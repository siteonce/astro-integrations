import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl, id, leafSlug, locale, slug } from '@siteonce/astro-intl';
import { astroPaginate } from '../astro.ts';
import {
  type CollectionEntry,
  collectionEntry,
  collectionLoaders,
  type IntlConfigInput,
  intlConfig,
  keepOrder,
  relation,
  warningsFrom,
} from '../fixtures.ts';

function bind(config: IntlConfigInput, collections: Record<string, readonly CollectionEntry[]>) {
  return createIntl(config, { loaders: collectionLoaders(collections) });
}

/** Issues `leafSlug` adds. A string is that slug; an object is the entry value. No issue means it is accepted. */
function leafIssues(
  value: string | { slug?: string },
  options?: { slugify?: (value: string) => string },
): string[] {
  const messages: string[] = [];
  leafSlug(options)(typeof value === 'string' ? { slug: value } : value, {
    addIssue(issue) {
      messages.push(issue.message);
    },
  });
  return messages;
}

/** Test double: the segment must already equal this spelling. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .replaceAll(' ', '-')
    .replaceAll(/[^a-z0-9-]/g, '');
}

const postsRoutes = [
  {
    slug: { en: 'blog', de: 'artikel' },
    view: 'index',
    collection: 'posts',
    pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
  },
  { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'posts' },
];

/**
 * Posts with renamed fields: pairing id `uid`, locale `lang`, slug `path`.
 * `a` is en `alpha` and de `alpha-de`. `b` is en only, slug `beta`.
 * `locale` on the en entries is a decoy (`de` or absent). Pairing reads `lang`.
 * Page size is 1, so en publishes `blog` and `blog/2`, and de publishes `artikel`.
 */
function renamedPosts() {
  const enA = collectionEntry('posts', 'a-en', {
    uid: 'a',
    lang: 'en',
    path: 'alpha',
    locale: 'de',
  });
  const enB = collectionEntry('posts', 'b-en', { uid: 'b', lang: 'en', path: 'beta' });
  const deA = collectionEntry('posts', 'a-de', {
    uid: 'a',
    lang: 'de',
    path: 'alpha-de',
    locale: 'en',
  });
  const intl = bind(
    intlConfig({
      routes: postsRoutes,
      collections: {
        translated: ['posts'],
        fields: { posts: { id: 'uid', locale: 'lang', slug: 'path' } },
      },
    }),
    { posts: [enA, enB, deA] },
  );
  return { intl, enA, enB, deA };
}

describe('pairing fields', { concurrency: 1 }, () => {
  it('accepts a pairing id, a locale, and a slug, and rejects an empty slug', () => {
    assert.equal(id.parse('hello-world'), 'hello-world');
    assert.equal(locale.parse('de'), 'de');
    assert.equal(slug.parse('/'), '/');
    assert.throws(() => slug.parse(''));
  });

  it('accepts one slug segment', () => {
    assert.deepEqual(leafIssues('hallo-welt'), []);
    assert.deepEqual(leafIssues('hallo-welt', { slugify }), []);
  });

  it('rejects a slug that is not one segment', () => {
    assert.deepEqual(leafIssues('artikel/hallo-welt'), [
      'slug "artikel/hallo-welt" is not one segment',
    ]);
    assert.deepEqual(leafIssues('/'), ['slug "/" is not one segment']);
    assert.deepEqual(leafIssues({ slug: '' }), ['slug "" is not one segment']);
    assert.deepEqual(leafIssues({}), ['slug "" is not one segment']);
  });

  it('rejects a slug that slugify would change', () => {
    assert.deepEqual(leafIssues('über-uns', { slugify }), ['slug "über-uns" is not a slug']);
  });

  it('reads an empty public path as the homepage and builds that URL with an empty path', async () => {
    const home = collectionEntry('pages', 'home-en', { id: 'home', locale: 'en' });
    const hello = collectionEntry('blog', 'hello-en', {
      id: 'hello-world',
      locale: 'en',
      slug: 'hello-world',
    });
    const intl = bind(
      intlConfig({
        routes: [
          {
            slug: { en: '/', de: '/' },
            view: 'home',
            collection: { name: 'pages', entry: 'home' },
          },
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
        ],
        collections: { translated: ['pages', 'blog'] },
      }),
      {
        pages: [home, collectionEntry('pages', 'home-de', { id: 'home', locale: 'de' })],
        blog: [
          hello,
          collectionEntry('blog', 'hello-de', {
            id: 'hello-world',
            locale: 'de',
            slug: 'hallo-welt',
          }),
        ],
      },
    );

    assert.equal((await intl.getContentByPath('en', ''))?.id, 'home-en');
    assert.equal(await intl.getContentByPath('en', '/'), home);
    assert.deepEqual(await intl.getAlternatePathsForPath('en', ''), { en: '/', de: '/' });

    const sitemap = await intl.getSitemapEntries();
    const homeEn = sitemap.find((item) => item.entryId === 'pages/home' && item.locale === 'en');
    const helloEn = sitemap.find(
      (item) => item.entryId === 'blog/hello-world' && item.locale === 'en',
    );
    assert.equal(homeEn?.loc, 'https://example.com/en');
    assert.equal(helloEn?.loc, 'https://example.com/en/blog/hello-world');
  });

  it("publishes a leaf on that locale's section", async () => {
    const intl = bind(
      intlConfig({
        routes: [
          {
            slug: { en: '/', de: '/' },
            view: 'home',
            collection: { name: 'pages', entry: 'home' },
          },
          {
            slug: { en: 'blog', de: 'artikel' },
            view: 'blog',
            collection: { name: 'pages', entry: 'blog' },
          },
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
        ],
        collections: { translated: ['pages', 'blog'] },
      }),
      {
        pages: [
          collectionEntry('pages', 'home-en', { id: 'home', locale: 'en' }),
          collectionEntry('pages', 'home-de', { id: 'home', locale: 'de' }),
          collectionEntry('pages', 'blog-en', { id: 'blog', locale: 'en' }),
          collectionEntry('pages', 'blog-de', { id: 'blog', locale: 'de' }),
        ],
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

    assert.deepEqual(await intl.getAlternatePaths('blog/hello-world'), {
      en: 'blog/hello-world',
      de: 'artikel/hallo-welt',
    });
    assert.equal((await intl.getContentByPath('en', '/'))?.id, 'home-en');
    assert.deepEqual(await intl.getAlternatePaths('pages/home'), { en: '/', de: '/' });
  });

  it('pairs on collection/id and allows the same id in two collections', async () => {
    const intl = bind(
      intlConfig({
        routes: [
          {
            slug: { en: 'blog', de: 'artikel' },
            view: 'blog',
            collection: { name: 'pages', entry: 'blog' },
          },
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
        ],
        collections: { translated: ['pages', 'blog'] },
      }),
      {
        pages: [
          collectionEntry('pages', 'blog/en', { id: 'blog', locale: 'en' }),
          collectionEntry('pages', 'blog/de', { id: 'blog', locale: 'de' }),
          collectionEntry('pages', 'hello/en', { id: 'hello-world', locale: 'en' }),
          collectionEntry('pages', 'hello/de', { id: 'hello-world', locale: 'de' }),
        ],
        blog: [
          collectionEntry('blog', 'hello-world/en', {
            id: 'hello-world',
            locale: 'en',
            slug: 'hello-world',
          }),
          collectionEntry('blog', 'hello-world/de', {
            id: 'hello-world',
            locale: 'de',
            slug: 'hallo-welt',
          }),
        ],
      },
    );

    const warnings = await warningsFrom(() => intl.getPairedSlugs());
    assert.deepEqual(warnings, []);
    assert.equal((await intl.getContentByPath('en', 'blog'))?.id, 'blog/en');
    assert.deepEqual(await intl.getAlternatePaths('pages/blog'), { en: 'blog', de: 'artikel' });
    assert.deepEqual(await intl.getAlternatePaths('blog/hello-world'), {
      en: 'blog/hello-world',
      de: 'artikel/hallo-welt',
    });
    assert.equal((await intl.getContentByPath('de', 'artikel/hallo-welt'))?.id, 'hello-world/de');
    assert.equal((await intl.getRelated('en', relation('pages', 'hello-world')))?.id, 'hello/en');
    assert.equal((await intl.getRelated('de', relation('pages', 'hello-world')))?.id, 'hello/de');
    assert.deepEqual(await intl.getAlternatePaths('pages/hello-world'), {});
  });

  it('warns when the default-locale sibling is missing', async () => {
    const intl = bind(
      intlConfig({
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
        ],
        collections: { translated: ['blog'] },
      }),
      {
        blog: [collectionEntry('blog', 'nur-de', { id: 'nur-de', locale: 'de', slug: 'nur-de' })],
      },
    );

    const warnings = await warningsFrom(() => intl.getAlternatePaths('blog/nur-de'));
    assert.deepEqual(await intl.getAlternatePaths('blog/nur-de'), { de: 'artikel/nur-de' });
    assert.deepEqual(warnings, [
      '@siteonce/astro-intl: default-locale sibling missing for entryId "blog/nur-de" (defaultLocale "en").',
    ]);
  });

  it('aborts when the id field is missing', async () => {
    const intl = bind(
      intlConfig({
        routes: [
          {
            slug: { en: '/', de: '/' },
            view: 'home',
            collection: { name: 'pages', entry: 'home' },
          },
        ],
        collections: { translated: ['pages'] },
      }),
      { pages: [collectionEntry('pages', 'home/en', { locale: 'en' })] },
    );

    await assert.rejects(intl.getPairedSlugs(), {
      message: '@siteonce/astro-intl: id field "id" is missing. (pages:home/en)',
    });
  });

  it('aborts when the locale field is missing', async () => {
    const intl = bind(
      intlConfig({
        routes: [
          {
            slug: { en: '/', de: '/' },
            view: 'home',
            collection: { name: 'pages', entry: 'home' },
          },
        ],
        collections: { translated: ['pages'] },
      }),
      { pages: [collectionEntry('pages', 'home/en', { id: 'home' })] },
    );

    await assert.rejects(intl.getPairedSlugs(), {
      message: '@siteonce/astro-intl: locale field "locale" is missing on pages:home/en.',
    });
  });

  it('aborts when an entry locale is not in locales', async () => {
    const intl = bind(intlConfig({ collections: { translated: ['blog'] } }), {
      blog: [collectionEntry('blog', 'x', { id: 'x', locale: 'fr' })],
    });

    await assert.rejects(intl.getPairedSlugs(), {
      message: '@siteonce/astro-intl: locale "fr" on blog:x is not in locales.',
    });
  });

  it('aborts when the id field is not a string', async () => {
    const cases: {
      field: string;
      data: Record<string, unknown>;
      fields?: { blog: { id: string } };
    }[] = [
      { field: 'id', data: { id: 7, locale: 'en' } },
      // `id` is a string. Pairing reads `uid`.
      { field: 'uid', data: { id: 'x', locale: 'en', uid: 7 }, fields: { blog: { id: 'uid' } } },
    ];
    for (const item of cases) {
      const intl = bind(
        intlConfig({
          collections: {
            translated: ['blog'],
            ...(item.fields === undefined ? {} : { fields: item.fields }),
          },
        }),
        { blog: [collectionEntry('blog', 'x', item.data)] },
      );
      await assert.rejects(
        intl.getPairedSlugs(),
        {
          message: `@siteonce/astro-intl: id field "${item.field}" on blog:x is not a string. Coerce it in the collection schema, for example with z.coerce.string().`,
        },
        item.field,
      );
    }
  });

  it('aborts when the locale field is not a string', async () => {
    const cases: {
      field: string;
      data: Record<string, unknown>;
      fields?: { blog: { locale: string } };
    }[] = [
      { field: 'locale', data: { id: 'x', locale: 7 } },
      // `locale` is a configured locale. Pairing reads `lang`.
      {
        field: 'lang',
        data: { id: 'x', locale: 'en', lang: 7 },
        fields: { blog: { locale: 'lang' } },
      },
    ];
    for (const item of cases) {
      const intl = bind(
        intlConfig({
          collections: {
            translated: ['blog'],
            ...(item.fields === undefined ? {} : { fields: item.fields }),
          },
        }),
        { blog: [collectionEntry('blog', 'x', item.data)] },
      );
      await assert.rejects(
        intl.getPairedSlugs(),
        {
          message: `@siteonce/astro-intl: locale field "${item.field}" on blog:x is not a string. Coerce it in the collection schema, for example with z.coerce.string().`,
        },
        item.field,
      );
    }
  });

  it('aborts when (id, locale) is not unique', async () => {
    const intl = bind(
      intlConfig({
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
        ],
        collections: { translated: ['blog'] },
      }),
      {
        blog: [
          collectionEntry(
            'blog',
            'hello-a',
            { id: 'hello', locale: 'en', slug: 'hello' },
            'src/content/blog/hello-a.md',
          ),
          collectionEntry(
            'blog',
            'hello-b',
            { id: 'hello', locale: 'en', slug: 'again' },
            'src/content/blog/hello-b.md',
          ),
        ],
      },
    );

    await assert.rejects(intl.getPairedSlugs(), {
      message:
        '@siteonce/astro-intl: (entryId, locale) "blog/hello" / "en" is not unique (blog vs blog).',
    });
  });

  it('reads a renamed id and locale', async () => {
    const home = collectionEntry('pages', 'home-en', { docId: 'home', lang: 'en' });
    const intl = bind(
      intlConfig({
        routes: [
          {
            slug: { en: '/', de: '/' },
            view: 'home',
            collection: { name: 'pages', entry: 'home' },
          },
        ],
        collections: {
          translated: ['pages'],
          fields: { pages: { id: 'docId', locale: 'lang' } },
        },
      }),
      { pages: [home] },
    );

    assert.equal(await intl.getContentByPath('en', '/'), home);
    assert.equal(await intl.getRelated('en', relation('pages', 'home')), home);
    assert.deepEqual(await intl.getAlternatePaths('pages/home'), { en: '/' });
    assert.deepEqual(await intl.getPairedSlugs(), [{ locale: 'en', slug: '/' }]);
  });

  it("publishes the renamed slug on that locale's section and counts listing pages from the renamed locale", async () => {
    const { intl } = renamedPosts();

    assert.deepEqual(await intl.getAlternatePaths('posts/a'), {
      en: 'blog/alpha',
      de: 'artikel/alpha-de',
    });
    assert.deepEqual(await intl.getAlternatePaths('posts/b'), { en: 'blog/beta' });
    assert.equal((await intl.getContentByPath('en', 'blog/alpha'))?.id, 'a-en');
    assert.equal((await intl.getContentByPath('de', 'artikel/alpha-de'))?.id, 'a-de');
    assert.deepEqual(await intl.getAlternatePathsForPath('en', 'blog'), {
      en: 'blog',
      de: 'artikel',
    });
    assert.deepEqual(await intl.getAlternatePathsForPath('en', 'blog/2'), { en: 'blog/2' });
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'artikel' },
      { locale: 'de', slug: 'artikel/alpha-de' },
      { locale: 'en', slug: 'blog' },
      { locale: 'en', slug: 'blog/2' },
      { locale: 'en', slug: 'blog/alpha' },
      { locale: 'en', slug: 'blog/beta' },
    ]);
  });

  it('entry paths and listing pages read the renamed fields', async () => {
    const { intl, enA, enB, deA } = renamedPosts();
    const en = await intl.entryPaths('/en/blog/[slug]', 'posts');
    const de = await intl.entryPaths('/de/artikel/[slug]', 'posts');
    assert.deepEqual(
      en.map((item) => item.params.slug),
      ['alpha', 'beta'],
    );
    assert.deepEqual(
      en.map((item) => item.props.path),
      ['blog/alpha', 'blog/beta'],
    );
    assert.deepEqual(
      de.map((item) => item.params.slug),
      ['alpha-de'],
    );
    assert.equal((await intl.getContentByPath('en', 'blog/alpha'))?.id, 'a-en');
    assert.equal((await intl.getContentByPath('de', 'artikel/alpha-de'))?.id, 'a-de');

    const pageOne = await intl.listingPaths(
      '/en/blog/[...page]',
      'posts',
      await astroPaginate('...page'),
      keepOrder(),
    );
    const pageTwo = await intl.listingPaths(
      '/en/blog/[page]',
      'posts',
      await astroPaginate('page'),
      keepOrder(),
    );
    const dePage = await intl.listingPaths(
      '/de/artikel/[...page]',
      'posts',
      await astroPaginate('...page'),
      keepOrder(),
    );
    assert.equal(pageOne[0]?.props.page.data[0], enA);
    assert.equal(pageTwo[0]?.props.page.data[0], enB);
    assert.equal(dePage[0]?.props.page.data[0], deA);
  });

  it('aborts when the slug field is not a string', async () => {
    const routes = [
      { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
    ];
    const cases: {
      field: string;
      data: Record<string, unknown>;
      fields?: { blog: { slug: string } };
    }[] = [
      { field: 'slug', data: { id: 'x', locale: 'en', slug: 7 } },
      // `slug` is one segment. The row reads `path`.
      {
        field: 'path',
        data: { id: 'x', locale: 'en', slug: 'kept', path: 7 },
        fields: { blog: { slug: 'path' } },
      },
    ];
    for (const item of cases) {
      const intl = bind(
        intlConfig({
          routes,
          collections: {
            translated: ['blog'],
            ...(item.fields === undefined ? {} : { fields: item.fields }),
          },
        }),
        { blog: [collectionEntry('blog', 'x', item.data)] },
      );
      await assert.rejects(
        intl.getPairedSlugs(),
        {
          message: `@siteonce/astro-intl: slug field "${item.field}" on blog:x is not a string. Coerce it in the collection schema, for example with z.coerce.string().`,
        },
        item.field,
      );
    }
  });

  it('aborts when a routed entry has no slug', async () => {
    const intl = bind(
      intlConfig({
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
        ],
        collections: { translated: ['blog'] },
      }),
      { blog: [collectionEntry('blog', 'x', { id: 'x', locale: 'en' })] },
    );

    await assert.rejects(intl.getPairedSlugs(), {
      message: '@siteonce/astro-intl: slug is missing on routed entry blog:x.',
    });
  });

  it('aborts when a routed slug is not one segment', async () => {
    const intl = bind(
      intlConfig({
        routes: [
          { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
        ],
        collections: { translated: ['blog'] },
      }),
      {
        blog: [
          collectionEntry('blog', 'bad', { id: 'bad', locale: 'en', slug: 'blog/hello-world' }),
        ],
      },
    );

    await assert.rejects(intl.getPairedSlugs(), {
      message: '@siteonce/astro-intl: slug "blog/hello-world" is not one segment. (blog:bad)',
    });
  });
});
