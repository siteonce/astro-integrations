import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl } from '@repo/astro-intl';
import { byDate, byFlag, byNumber, byText, sortBy } from '@repo/astro-intl/sorting';
import { astroPaginate } from '../astro.ts';
import {
  type CollectionEntry,
  collectionEntry,
  collectionLoaders,
  type IntlConfigInput,
  intlConfig,
  keepOrder,
} from '../fixtures.ts';

type Routes = NonNullable<IntlConfigInput['routes']>;

/**
 * `count` blog entries in `locale`, in index order.
 * Index 0 is pairing id `post-0`, Astro id `post-0-${locale}`, slug `${locale}-0`.
 */
function entries(locale: string, count: number): CollectionEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const id = `post-${index}`;
    return collectionEntry('blog', `${id}-${locale}`, { id, locale, slug: `${locale}-${index}` });
  });
}

/** Intl for the blog collection and these routes. `routing` replaces the default when passed. */
function blogIntl(
  routes: Routes,
  posts: readonly CollectionEntry[],
  routing?: IntlConfigInput['routing'],
) {
  return createIntl(
    intlConfig({
      ...(routing === undefined ? {} : { routing }),
      routes,
      collections: { translated: ['blog'] },
    }),
    { loaders: collectionLoaders({ blog: posts }) },
  );
}

type BlogIntl = ReturnType<typeof blogIntl>;

/** Tails from the page-1 route, then the `{page}` route. `first` and `rest` are those patterns. */
async function listingTails(intl: BlogIntl, first: string, rest: string): Promise<string[]> {
  const pageOne = await intl.listingPaths(
    first,
    'blog',
    await astroPaginate('...page'),
    keepOrder(),
  );
  const later = await intl.listingPaths(rest, 'blog', await astroPaginate('page'), keepOrder());
  return [...pageOne.map((row) => row.props.path), ...later.map((row) => row.props.path)];
}

describe('listings', () => {
  it('omits pagination and publishes the one written tail', async () => {
    const intl = blogIntl(
      [{ slug: { en: 'blog', de: 'artikel' }, view: 'index', collection: 'blog' }],
      entries('en', 2),
    );

    assert.deepEqual(
      (await intl.staticPaths('/en/blog/[...index]')).map((row) => ({
        path: row.props.path,
        entry: row.props.entry,
      })),
      [{ path: 'blog', entry: undefined }],
    );
    assert.deepEqual(
      (await intl.staticPaths('/de/artikel/[...index]')).map((row) => ({
        path: row.props.path,
        entry: row.props.entry,
      })),
      [{ path: 'artikel', entry: undefined }],
    );
    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'artikel' },
      { locale: 'en', slug: 'blog' },
    ]);
  });

  it('keeps page 1 on the page-1 tail and replaces {page} after that', async () => {
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: {
            pageSize: 1,
            slug: { en: 'blog/page/{page}', de: 'artikel/seite/{page}' },
          },
        },
      ],
      [...entries('en', 2), ...entries('de', 2)],
    );

    assert.deepEqual(await listingTails(intl, '/en/blog/[...page]', '/en/blog/page/[page]'), [
      'blog',
      'blog/page/2',
    ]);
    assert.deepEqual(
      await listingTails(intl, '/de/artikel/[...page]', '/de/artikel/seite/[page]'),
      ['artikel', 'artikel/seite/2'],
    );
  });

  it('publishes the root page-1 tail and a bare page number', async () => {
    const intl = blogIntl(
      [
        {
          slug: { en: '/', de: '/' },
          view: 'home',
          collection: 'blog',
          pagination: { pageSize: 1, slug: { en: '{page}', de: '{page}' } },
        },
      ],
      [...entries('en', 2), ...entries('de', 2)],
      { prefixDefaultLocale: false },
    );

    assert.deepEqual(await listingTails(intl, '/[...page]', '/[page]'), ['/', '2']);
    assert.deepEqual(await listingTails(intl, '/de/[...page]', '/de/[page]'), ['/', '2']);
  });

  it('publishes three pages for twenty-five entries and two for twelve at page size 10', async () => {
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: {
            pageSize: 10,
            slug: { en: 'blog/{page}', de: 'artikel/seite/{page}' },
          },
        },
      ],
      [...entries('en', 25), ...entries('de', 12)],
    );

    assert.deepEqual(await listingTails(intl, '/en/blog/[...page]', '/en/blog/[page]'), [
      'blog',
      'blog/2',
      'blog/3',
    ]);
    assert.deepEqual(
      await listingTails(intl, '/de/artikel/[...page]', '/de/artikel/seite/[page]'),
      ['artikel', 'artikel/seite/2'],
    );
  });

  it('fills each chunk with pageSize entries', async () => {
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 2, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
      entries('en', 5),
    );
    const first = await intl.listingPaths(
      '/en/blog/[...page]',
      'blog',
      await astroPaginate('...page'),
      keepOrder(),
    );
    const later = await intl.listingPaths(
      '/en/blog/[page]',
      'blog',
      await astroPaginate('page'),
      keepOrder(),
    );

    // Five entries fill three pages of two, so the last page holds en-4.
    assert.deepEqual(
      [
        first[0]?.props.page.data.map((entry) => entry.data.slug),
        ...later.map((row) => row.props.page.data.map((entry) => entry.data.slug)),
      ],
      [['en-0', 'en-1'], ['en-2', 'en-3'], ['en-4']],
    );
  });

  it('publishes one page when ten entries fill a page of ten', async () => {
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
      [...entries('en', 10), ...entries('de', 10)],
    );

    const first = await intl.listingPaths(
      '/en/blog/[...page]',
      'blog',
      await astroPaginate('...page'),
      keepOrder(),
    );
    const later = await intl.listingPaths(
      '/en/blog/[page]',
      'blog',
      await astroPaginate('page'),
      keepOrder(),
    );
    assert.deepEqual(
      first.map((row) => row.props.path),
      ['blog'],
    );
    assert.equal(first[0]?.props.page.lastPage, 1);
    assert.equal(first[0]?.props.page.data.length, 10);
    assert.deepEqual(later, []);
    assert.deepEqual(await listingTails(intl, '/de/artikel/[...page]', '/de/artikel/[page]'), [
      'artikel',
    ]);
  });

  it('publishes one page when the locale has no entries', async () => {
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
      [],
    );

    const first = await intl.listingPaths(
      '/en/blog/[...page]',
      'blog',
      await astroPaginate('...page'),
      keepOrder(),
    );
    const later = await intl.listingPaths(
      '/en/blog/[page]',
      'blog',
      await astroPaginate('page'),
      keepOrder(),
    );
    assert.deepEqual(
      first.map((row) => ({
        path: row.props.path,
        lastPage: row.props.page.lastPage,
        entries: row.props.page.data.length,
      })),
      [{ path: 'blog', lastPage: 1, entries: 0 }],
    );
    assert.deepEqual(later, []);
    assert.deepEqual(await listingTails(intl, '/de/artikel/[...page]', '/de/artikel/[page]'), [
      'artikel',
    ]);
  });

  it('gives a listing page the locales that publish that page', async () => {
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
      [...entries('en', 2), ...entries('de', 1)],
    );

    assert.deepEqual(await intl.getAlternatePathsForPath('en', 'blog'), {
      en: 'blog',
      de: 'artikel',
    });
    assert.deepEqual(await intl.getAlternatePathsForPath('en', 'blog/2'), { en: 'blog/2' });
  });

  it('lists a listing page in the sitemap', async () => {
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
      [...entries('en', 2), ...entries('de', 1)],
    );
    const shared = {
      de: 'https://example.com/de/artikel',
      en: 'https://example.com/en/blog',
    };

    assert.deepEqual(await intl.getSitemapEntries(), [
      {
        locale: 'de',
        path: 'artikel',
        loc: shared.de,
        alternates: shared,
        xDefault: shared.en,
      },
      {
        locale: 'en',
        path: 'blog',
        loc: shared.en,
        alternates: shared,
        xDefault: shared.en,
      },
      {
        locale: 'en',
        path: 'blog/2',
        loc: 'https://example.com/en/blog/2',
        alternates: { en: 'https://example.com/en/blog/2' },
        xDefault: 'https://example.com/en/blog/2',
      },
    ]);
  });

  it('finds no entry on a listing page', async () => {
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
      entries('en', 2),
    );

    assert.equal(await intl.getContentByPath('en', 'blog'), undefined);
    assert.equal(await intl.getContentByPath('en', 'blog/2'), undefined);
  });

  it('publishes a literal page-1 tail and leaves the unnumbered tail free', async () => {
    const pageOne = { en: 'blog/1', de: 'artikel/1' };
    const pagination = { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } };
    const posts = entries('en', 2);
    const alone = blogIntl(
      [{ slug: pageOne, view: 'index', collection: 'blog', pagination }],
      posts,
    );

    assert.deepEqual(await listingTails(alone, '/en/blog/1/[...page]', '/en/blog/[page]'), [
      'blog/1',
      'blog/2',
    ]);
    assert.deepEqual(await listingTails(alone, '/de/artikel/1/[...page]', '/de/artikel/[page]'), [
      'artikel/1',
    ]);

    const withStatic = blogIntl(
      [
        { slug: pageOne, view: 'index', collection: 'blog', pagination },
        { slug: { en: 'blog', de: 'artikel' }, view: 'index' },
      ],
      posts,
    );
    assert.deepEqual(await listingTails(withStatic, '/en/blog/1/[...page]', '/en/blog/[page]'), [
      'blog/1',
      'blog/2',
    ]);
    assert.deepEqual(
      (await withStatic.staticPaths('/en/blog/[...index]')).map((row) => ({
        path: row.props.path,
        entry: row.props.entry,
      })),
      [{ path: 'blog', entry: undefined }],
    );
    assert.deepEqual(
      (await withStatic.staticPaths('/de/artikel/[...index]')).map((row) => ({
        path: row.props.path,
        entry: row.props.entry,
      })),
      [{ path: 'artikel', entry: undefined }],
    );
    assert.deepEqual(await withStatic.getPairedSlugs(), [
      { locale: 'de', slug: 'artikel' },
      { locale: 'de', slug: 'artikel/1' },
      { locale: 'en', slug: 'blog' },
      { locale: 'en', slug: 'blog/1' },
      { locale: 'en', slug: 'blog/2' },
    ]);
  });

  it('aborts the build when an entry slug matches a published page number', async () => {
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
      ],
      [
        collectionEntry('blog', 'page-number', { id: 'page-number', locale: 'en', slug: '2' }),
        collectionEntry('blog', 'hello', { id: 'hello', locale: 'en', slug: 'hello' }),
      ],
    );
    const paginate = await astroPaginate('...page');

    // Two entries fill two pages of one, so the listing publishes blog/2.
    await assert.rejects(
      () => intl.listingPaths('/en/blog/[...page]', 'blog', paginate, keepOrder()),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(
          error.message,
          '@repo/astro-intl: entry slug "2" matches published page 2 on section "blog".',
        );
        return true;
      },
    );
  });

  it('keeps a numeric slug when {page} uses another section', async () => {
    const pageNumber = collectionEntry('blog', 'page-number', {
      id: 'page-number',
      locale: 'en',
      slug: '2',
    });
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: {
            pageSize: 1,
            slug: { en: 'blog/page/{page}', de: 'artikel/seite/{page}' },
          },
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
      ],
      [pageNumber, collectionEntry('blog', 'hello', { id: 'hello', locale: 'en', slug: 'hello' })],
    );

    assert.deepEqual(await listingTails(intl, '/en/blog/[...page]', '/en/blog/page/[page]'), [
      'blog',
      'blog/page/2',
    ]);
    assert.equal(await intl.getContentByPath('en', 'blog/2'), pageNumber);
    assert.equal(await intl.getContentByPath('en', 'blog/page/2'), undefined);
    assert.deepEqual(
      (await intl.getSitemapEntries()).filter(
        (item) => item.path === 'blog/2' || item.path === 'blog/page/2',
      ),
      [
        {
          locale: 'en',
          path: 'blog/2',
          loc: 'https://example.com/en/blog/2',
          alternates: { en: 'https://example.com/en/blog/2' },
          xDefault: 'https://example.com/en/blog/2',
          entryId: 'blog/page-number',
        },
        {
          locale: 'en',
          path: 'blog/page/2',
          loc: 'https://example.com/en/blog/page/2',
          alternates: { en: 'https://example.com/en/blog/page/2' },
          xDefault: 'https://example.com/en/blog/page/2',
        },
      ],
    );
  });

  it('keeps a numeric slug when that page number is not published', async () => {
    const two = collectionEntry('blog', 'two', { id: 'two', locale: 'en', slug: '2' });
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
      ],
      [two],
    );

    assert.deepEqual(await listingTails(intl, '/en/blog/[...page]', '/en/blog/[page]'), ['blog']);
    assert.equal(await intl.getContentByPath('en', 'blog/2'), two);
    assert.deepEqual(
      (await intl.getSitemapEntries()).find((item) => item.path === 'blog/2'),
      {
        locale: 'en',
        path: 'blog/2',
        loc: 'https://example.com/en/blog/2',
        alternates: { en: 'https://example.com/en/blog/2' },
        xDefault: 'https://example.com/en/blog/2',
        entryId: 'blog/two',
      },
    );
  });

  it('counts every entry in that locale toward listing pages', async () => {
    const published = collectionEntry('blog', 'pub-0', {
      id: 'pub-0',
      locale: 'en',
      slug: 'pub-0',
      status: 'published',
    });
    const draft = collectionEntry('blog', 'draft-0', {
      id: 'draft-0',
      locale: 'en',
      slug: 'draft-0',
      status: 'draft',
    });
    const deOnly = collectionEntry('blog', 'de-only', {
      id: 'de-only',
      locale: 'de',
      slug: 'de-only',
      status: 'published',
    });
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'blog' },
      ],
      [published, draft, deOnly],
    );
    const later = await intl.listingPaths(
      '/en/blog/[page]',
      'blog',
      await astroPaginate('page'),
      keepOrder(),
    );

    // A draft still counts, so the two en entries fill blog and blog/2.
    assert.deepEqual(await listingTails(intl, '/en/blog/[...page]', '/en/blog/[page]'), [
      'blog',
      'blog/2',
    ]);
    assert.deepEqual(
      later[0]?.props.page.data.map((entry) => entry.data.slug),
      ['draft-0'],
    );
    assert.equal(await intl.getContentByPath('en', 'blog/draft-0'), draft);
    assert.deepEqual(await listingTails(intl, '/de/artikel/[...page]', '/de/artikel/[page]'), [
      'artikel',
    ]);
    assert.equal(await intl.getContentByPath('de', 'artikel/de-only'), deOnly);
  });
});

describe('sorting', () => {
  it('orders dates in both directions', () => {
    const older = { at: new Date('2020-01-01T00:00:00.000Z') };
    const newer = { at: new Date('2024-06-01T00:00:00.000Z') };
    const asc = byDate((row: { at: Date }) => row.at, 'asc');
    const desc = byDate((row: { at: Date }) => row.at, 'desc');
    assert.deepEqual(
      [newer, older].toSorted(asc).map((row) => row.at.toISOString()),
      ['2020-01-01T00:00:00.000Z', '2024-06-01T00:00:00.000Z'],
    );
    assert.deepEqual(
      [older, newer].toSorted(desc).map((row) => row.at.toISOString()),
      ['2024-06-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z'],
    );
    assert.equal(asc(older, older), 0);
  });

  it('orders numbers in both directions', () => {
    const rows = [{ n: 3 }, { n: 1 }, { n: 2 }];
    const asc = byNumber((row: { n: number }) => row.n, 'asc');
    const desc = byNumber((row: { n: number }) => row.n, 'desc');
    assert.deepEqual(
      rows.toSorted(asc).map((row) => row.n),
      [1, 2, 3],
    );
    assert.deepEqual(
      rows.toSorted(desc).map((row) => row.n),
      [3, 2, 1],
    );
    assert.equal(asc({ n: 1 }, { n: 1 }), 0);
  });

  it('collates by locale', () => {
    const titles = [{ title: 'Birnen' }, { title: 'Äpfel' }];
    const asc = byText((row: { title: string }) => row.title, 'de', 'asc');
    const desc = byText((row: { title: string }) => row.title, 'de', 'desc');
    // German collation orders Ä before B. Code-point order puts Äpfel after Birnen.
    assert.deepEqual(
      titles.toSorted(asc).map((row) => row.title),
      ['Äpfel', 'Birnen'],
    );
    assert.deepEqual(
      titles.toSorted(desc).map((row) => row.title),
      ['Birnen', 'Äpfel'],
    );
  });

  it('puts true first', () => {
    const compare = byFlag((row: { on: boolean }) => row.on);
    assert.deepEqual(
      [{ on: false }, { on: true }].toSorted(compare).map((row) => row.on),
      [true, false],
    );
    assert.equal(compare({ on: true }, { on: true }), 0);
  });

  it('falls through on a tie and returns 0 when every comparator ties', () => {
    type Row = { name: string; n: number };
    const compare = sortBy(
      byText((row: Row) => row.name, 'en', 'asc'),
      (a: Row, b: Row) => a.n - b.n,
    );
    assert.equal(compare({ name: 'same', n: 1 }, { name: 'same', n: 2 }), -1);
    assert.equal(compare({ name: 'same', n: 1 }, { name: 'same', n: 1 }), 0);
  });
});
