import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl } from '@repo/astro-intl';
import { byDate, byFlag, byText, sortBy } from '@repo/astro-intl/sorting';
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

/** `post-0` is the pairing id in every locale. The slug stays locale-specific (`en-0`, `de-0`). */
function entries(locale: string, total: number): CollectionEntry[] {
  return Array.from({ length: total }, (_, index) => {
    const id = `post-${index}`;
    return collectionEntry('blog', `${id}-${locale}`, { id, locale, slug: `${locale}-${index}` });
  });
}

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

/** Page-1 route, then the `{page}` route. Paths are the tails that route publishes. */
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

const postRow = {
  slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
  view: 'post',
  collection: 'blog',
} as const;

describe('pairing', () => {
  it('keeps page 1 on the page-1 tail and replaces {page} after that', async () => {
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: {
            pageSize: 10,
            slug: { en: 'blog/page/{page}', de: 'artikel/seite/{page}' },
          },
        },
      ],
      [...entries('en', 25), ...entries('de', 25)],
    );

    assert.deepEqual(await listingTails(intl, '/en/blog/[...page]', '/en/blog/page/[page]'), [
      'blog',
      'blog/page/2',
      'blog/page/3',
    ]);
    assert.deepEqual(
      await listingTails(intl, '/de/artikel/[...page]', '/de/artikel/seite/[page]'),
      ['artikel', 'artikel/seite/2', 'artikel/seite/3'],
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
      entries('en', 2),
      { prefixDefaultLocale: false },
    );

    assert.deepEqual(await listingTails(intl, '/[...page]', '/[page]'), ['/', '2']);
    assert.deepEqual(await listingTails(intl, '/de/[...page]', '/de/[page]'), ['/']);
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
      [...first, ...later].map((row) => row.props.path),
      ['blog', 'blog/2', 'blog/3'],
    );
    assert.deepEqual(
      first[0]?.props.page.data.map((entry) => entry.data.slug),
      ['en-0', 'en-1', 'en-2', 'en-3', 'en-4', 'en-5', 'en-6', 'en-7', 'en-8', 'en-9'],
    );
    assert.deepEqual(
      later[1]?.props.page.data.map((entry) => entry.data.slug),
      ['en-20', 'en-21', 'en-22', 'en-23', 'en-24'],
    );
    assert.deepEqual(
      await listingTails(intl, '/de/artikel/[...page]', '/de/artikel/seite/[page]'),
      ['artikel', 'artikel/seite/2'],
    );

    assert.deepEqual(await intl.getPairedSlugs(), [
      { locale: 'de', slug: 'artikel' },
      { locale: 'de', slug: 'artikel/seite/2' },
      { locale: 'en', slug: 'blog' },
      { locale: 'en', slug: 'blog/2' },
      { locale: 'en', slug: 'blog/3' },
    ]);
    assert.deepEqual(await intl.getAlternatePathsForPath('en', 'blog/2'), {
      en: 'blog/2',
      de: 'artikel/seite/2',
    });
    assert.deepEqual(await intl.getAlternatePathsForPath('en', 'blog/3'), { en: 'blog/3' });
    assert.equal(await intl.getContentByPath('en', 'blog/2'), undefined);
    const page3 = (await intl.getSitemapEntries()).find((item) => item.path === 'blog/3');
    assert.deepEqual(page3, {
      locale: 'en',
      path: 'blog/3',
      loc: 'https://example.com/en/blog/3',
      alternates: { en: 'https://example.com/en/blog/3' },
      xDefault: 'https://example.com/en/blog/3',
    });
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

  it('publishes a literal page-1 tail and leaves the unnumbered tail free', async () => {
    const pageOne = { en: 'blog/1', de: 'artikel/1' };
    const pagination = { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } };
    const posts = entries('en', 12);
    const alone = blogIntl(
      [{ slug: pageOne, view: 'index', collection: 'blog', pagination }, postRow],
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
        postRow,
      ],
      posts,
    );
    assert.deepEqual(await listingTails(withStatic, '/en/blog/1/[...page]', '/en/blog/[page]'), [
      'blog/1',
      'blog/2',
    ]);
    const blog = await withStatic.staticPaths('/en/blog/[...index]');
    const artikel = await withStatic.staticPaths('/de/artikel/[...index]');
    assert.deepEqual(
      blog.map((row) => ({ path: row.props.path, entry: row.props.entry })),
      [{ path: 'blog', entry: undefined }],
    );
    assert.deepEqual(
      artikel.map((row) => ({ path: row.props.path, entry: row.props.entry })),
      [{ path: 'artikel', entry: undefined }],
    );
    assert.equal(await withStatic.getContentByPath('en', 'blog/1'), undefined);
    const slugs = await withStatic.getPairedSlugs();
    assert.deepEqual(
      slugs.filter((item) =>
        ['blog', 'blog/1', 'blog/2', 'artikel', 'artikel/1'].includes(item.slug),
      ),
      [
        { locale: 'de', slug: 'artikel' },
        { locale: 'de', slug: 'artikel/1' },
        { locale: 'en', slug: 'blog' },
        { locale: 'en', slug: 'blog/1' },
        { locale: 'en', slug: 'blog/2' },
      ],
    );
  });

  it('counts every entry in that locale toward listing pages', async () => {
    const posts: CollectionEntry[] = [];
    for (let index = 0; index < 15; index += 1) {
      const id = `pub-${index}`;
      posts.push(collectionEntry('blog', id, { id, locale: 'en', slug: id, status: 'published' }));
    }
    for (let index = 0; index < 10; index += 1) {
      const id = `draft-${index}`;
      posts.push(collectionEntry('blog', id, { id, locale: 'en', slug: id, status: 'draft' }));
    }
    posts.push(
      collectionEntry('blog', 'de-only', {
        id: 'de-only',
        locale: 'de',
        slug: 'de-only',
        status: 'published',
      }),
    );
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
        postRow,
      ],
      posts,
    );

    const later = await intl.listingPaths(
      '/en/blog/[page]',
      'blog',
      await astroPaginate('page'),
      keepOrder(),
    );
    assert.deepEqual(await listingTails(intl, '/en/blog/[...page]', '/en/blog/[page]'), [
      'blog',
      'blog/2',
      'blog/3',
    ]);
    assert.deepEqual(
      later[1]?.props.page.data.map((entry) => entry.data.slug),
      ['draft-5', 'draft-6', 'draft-7', 'draft-8', 'draft-9'],
    );
    assert.equal((await intl.getContentByPath('en', 'blog/draft-0'))?.data.status, 'draft');
    assert.deepEqual(await listingTails(intl, '/de/artikel/[...page]', '/de/artikel/[page]'), [
      'artikel',
    ]);
    assert.equal((await intl.getContentByPath('de', 'artikel/de-only'))?.data.id, 'de-only');
  });

  it('omits pagination and publishes the one written tail', async () => {
    const intl = blogIntl(
      [{ slug: { en: 'blog', de: 'artikel' }, view: 'index', collection: 'blog' }, postRow],
      entries('en', 25),
    );

    const blog = await intl.staticPaths('/en/blog/[...index]');
    const artikel = await intl.staticPaths('/de/artikel/[...index]');
    assert.deepEqual(
      blog.map((row) => ({ path: row.props.path, entry: row.props.entry })),
      [{ path: 'blog', entry: undefined }],
    );
    assert.deepEqual(
      artikel.map((row) => ({ path: row.props.path, entry: row.props.entry })),
      [{ path: 'artikel', entry: undefined }],
    );
    const slugs = await intl.getPairedSlugs();
    assert.deepEqual(
      slugs.filter((item) => ['blog', 'artikel', 'blog/2', 'artikel/2'].includes(item.slug)),
      [
        { locale: 'de', slug: 'artikel' },
        { locale: 'en', slug: 'blog' },
      ],
    );
  });

  it('aborts the build when an entry slug matches a published page number', async () => {
    const posts = [
      collectionEntry('blog', 'page-number', { id: 'page-number', locale: 'en', slug: '2' }),
      ...entries('en', 10),
    ];
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
        postRow,
      ],
      posts,
    );
    const paginate = await astroPaginate('...page');

    // Eleven entries fill two pages of ten, so the listing publishes blog/2.
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
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: {
            pageSize: 10,
            slug: { en: 'blog/page/{page}', de: 'artikel/seite/{page}' },
          },
        },
        postRow,
      ],
      [
        collectionEntry('blog', 'page-number', { id: 'page-number', locale: 'en', slug: '2' }),
        ...entries('en', 10),
      ],
    );

    assert.deepEqual(await listingTails(intl, '/en/blog/[...page]', '/en/blog/page/[page]'), [
      'blog',
      'blog/page/2',
    ]);
    assert.equal((await intl.getContentByPath('en', 'blog/2'))?.data.id, 'page-number');
    assert.equal(await intl.getContentByPath('en', 'blog/page/2'), undefined);
    const sitemap = await intl.getSitemapEntries();
    const entry = sitemap.find((item) => item.path === 'blog/2');
    const page = sitemap.find((item) => item.path === 'blog/page/2');
    assert.equal(entry?.entryId, 'blog/page-number');
    assert.equal(page?.entryId, undefined);
    assert.equal(page?.path, 'blog/page/2');
  });

  it('keeps a numeric slug when that page number is not published', async () => {
    const intl = blogIntl(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
        postRow,
      ],
      [collectionEntry('blog', 'two', { id: 'two', locale: 'en', slug: '2' })],
    );

    assert.deepEqual(await listingTails(intl, '/en/blog/[...page]', '/en/blog/[page]'), ['blog']);
    assert.equal((await intl.getContentByPath('en', 'blog/2'))?.id, 'two');
    const row = (await intl.getSitemapEntries()).find((item) => item.path === 'blog/2');
    assert.deepEqual(row, {
      locale: 'en',
      path: 'blog/2',
      loc: 'https://example.com/en/blog/2',
      alternates: { en: 'https://example.com/en/blog/2' },
      xDefault: 'https://example.com/en/blog/2',
      entryId: 'blog/two',
    });
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

  it('collates by locale', () => {
    const compare = byText((row: { title: string }) => row.title, 'de', 'asc');
    assert.equal('Äpfel' > 'Birnen', true);
    assert.deepEqual(
      [{ title: 'Birnen' }, { title: 'Äpfel' }].toSorted(compare).map((row) => row.title),
      ['Äpfel', 'Birnen'],
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
