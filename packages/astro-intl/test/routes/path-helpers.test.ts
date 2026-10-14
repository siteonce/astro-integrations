import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl, defineIntl, type ListingOrder } from '@repo/astro-intl';
import type { PaginateFunction } from 'astro';
import { astroPaginate } from '../astro.ts';
import {
  type CollectionEntry,
  collectionEntry,
  collectionLoaders,
  type IntlConfigInput,
  intlConfig,
  keepOrder,
} from '../fixtures.ts';

function intlFor(
  routes: NonNullable<IntlConfigInput['routes']>,
  collections: Readonly<Record<string, readonly CollectionEntry[]>>,
  extra: Partial<IntlConfigInput> = {},
) {
  return createIntl(
    intlConfig({
      ...extra,
      routes,
      collections: { translated: Object.keys(collections) },
    }),
    { loaders: collectionLoaders(collections) },
  );
}

function leaves(
  items: readonly { params: { slug: string }; props: { path: string } }[],
): { slug: string; path: string }[] {
  return items.map((item) => ({ slug: item.params.slug, path: item.props.path }));
}

/**
 * Blog listing, view `index`. Page size defaults to 1.
 * Page 1 is `blog` / `artikel`. Later pages are `blog/{page}` / `artikel/{page}`.
 */
function blogListing() {
  return {
    slug: { en: 'blog', de: 'artikel' },
    view: 'index',
    collection: 'blog',
    pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
  };
}

/** `{slug}` is `blog` / `artikel`, view `post`. */
function blogPosts() {
  return {
    slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
    view: 'post',
    collection: 'blog',
  };
}

/** One blog entry. The Astro id and the pairing id are both `id`. */
function post(id: string, locale: string, data: Record<string, unknown> = {}): CollectionEntry {
  return collectionEntry('blog', id, { id, locale, ...data });
}

describe('path helpers', () => {
  it('publishes the section and slug of each locale, and leaves out a named entry', async () => {
    // `pin` is named on `featured`, so it is not a leaf of `blog/{slug}`.
    const intl = intlFor(
      [
        {
          slug: { en: 'featured', de: 'hervorgehoben' },
          view: 'featured',
          collection: { name: 'blog', entry: 'pin' },
        },
        blogPosts(),
      ],
      {
        blog: [
          collectionEntry('blog', 'pin-en', { id: 'pin', locale: 'en', slug: 'pin-slug' }),
          collectionEntry('blog', 'alpha-en', { id: 'alpha', locale: 'en', slug: 'alpha' }),
          collectionEntry('blog', 'alpha-de', { id: 'alpha', locale: 'de', slug: 'anders' }),
          collectionEntry('blog', 'solo-en', { id: 'solo', locale: 'en', slug: 'solo' }),
          collectionEntry('blog', 'mehr-de', { id: 'mehr', locale: 'de', slug: 'mehr' }),
          collectionEntry('blog', 'clash-en', { id: 'clash', locale: 'en', slug: 'mehr' }),
        ],
      },
    );

    assert.deepEqual(leaves(await intl.entryPaths('/en/blog/[slug]', 'blog')), [
      { slug: 'alpha', path: 'blog/alpha' },
      { slug: 'solo', path: 'blog/solo' },
      { slug: 'mehr', path: 'blog/mehr' },
    ]);
    assert.deepEqual(leaves(await intl.entryPaths('/de/artikel/[slug]', 'blog')), [
      { slug: 'anders', path: 'artikel/anders' },
      { slug: 'mehr', path: 'artikel/mehr' },
    ]);
  });

  it('publishes only the route locale when two locales share a section', async () => {
    const intl = intlFor(
      [{ slug: { en: 'blog/{slug}', de: 'blog/{slug}' }, view: 'post', collection: 'blog' }],
      {
        blog: [
          collectionEntry('blog', 'hello-en', { id: 'hello', locale: 'en', slug: 'hello' }),
          collectionEntry('blog', 'hello-de', { id: 'hello', locale: 'de', slug: 'hallo' }),
        ],
      },
    );

    assert.deepEqual(leaves(await intl.entryPaths('/en/blog/[slug]', 'blog')), [
      { slug: 'hello', path: 'blog/hello' },
    ]);
    assert.deepEqual(leaves(await intl.entryPaths('/de/blog/[slug]', 'blog')), [
      { slug: 'hallo', path: 'blog/hallo' },
    ]);
  });

  it('accepts one trailing slash on the route pattern', async () => {
    const intl = intlFor([blogPosts()], {
      blog: [collectionEntry('blog', 'alpha-en', { id: 'alpha', locale: 'en', slug: 'alpha' })],
    });

    assert.deepEqual(leaves(await intl.entryPaths('/en/blog/[slug]/', 'blog')), [
      { slug: 'alpha', path: 'blog/alpha' },
    ]);
  });

  it('rejects a route pattern that was not injected', async () => {
    const intl = intlFor([blogListing()], {
      blog: [post('a', 'en')],
    });

    for (const pattern of ['/nope', '/en/blog/[...page]']) {
      await assert.rejects(
        () => intl.entryPaths(pattern, 'blog'),
        { message: `@repo/astro-intl: no injected entry route for pattern "${pattern}".` },
        pattern,
      );
    }
  });

  it('aborts when entryPaths names a collection the row does not', async () => {
    const intl = intlFor([blogPosts()], {
      blog: [collectionEntry('blog', 'alpha-en', { id: 'alpha', locale: 'en', slug: 'alpha' })],
      tags: [],
    });

    await assert.rejects(() => intl.entryPaths('/en/blog/[slug]', 'tags'), {
      message:
        '@repo/astro-intl: entryPaths for "/en/blog/[slug]" in view "post" got "tags", but that route row names collection "blog". Pass "blog" (or add it to the list).',
    });
  });

  it('publishes the entries when the list includes the collection the row names', async () => {
    const intl = intlFor([blogPosts()], {
      blog: [collectionEntry('blog', 'alpha-en', { id: 'alpha', locale: 'en', slug: 'alpha' })],
      tags: [],
    });

    assert.deepEqual(leaves(await intl.entryPaths('/en/blog/[slug]', ['tags', 'blog'])), [
      { slug: 'alpha', path: 'blog/alpha' },
    ]);
  });

  it('aborts when an entryPaths list omits the collection the row names', async () => {
    const intl = intlFor([blogPosts()], {
      blog: [collectionEntry('blog', 'alpha-en', { id: 'alpha', locale: 'en', slug: 'alpha' })],
      tags: [],
      notes: [],
    });

    await assert.rejects(() => intl.entryPaths('/en/blog/[slug]', ['tags', 'notes']), {
      message:
        '@repo/astro-intl: entryPaths for "/en/blog/[slug]" in view "post" got "tags", "notes", but that route row names collection "blog". Pass "blog" (or add it to the list).',
    });
  });

  it('publishes page 1 on the spread and later pages on {page}', async () => {
    // Three entries fill three pages of one, so later pages are blog/2 and blog/3.
    const intl = intlFor([blogListing()], {
      blog: [post('a', 'en'), post('b', 'en'), post('c', 'en')],
    });

    const first = await intl.listingPaths(
      '/en/blog/[...page]',
      'blog',
      await astroPaginate('...page'),
      keepOrder(),
    );
    const rest = await intl.listingPaths(
      '/en/blog/[page]',
      'blog',
      await astroPaginate('page'),
      keepOrder(),
    );

    assert.deepEqual(
      first.map((item) => item.props.path),
      ['blog'],
    );
    assert.deepEqual(
      rest.map((item) => item.props.path),
      ['blog/2', 'blog/3'],
    );
  });

  it('keeps the locale, the route, and the path on a listing page', async () => {
    const row = blogListing();
    const intl = intlFor([row], { blog: [post('a', 'en')] });
    const pages = await intl.listingPaths(
      '/en/blog/[...page]',
      'blog',
      await astroPaginate('...page'),
      keepOrder(),
    );

    assert.deepEqual(
      {
        locale: pages[0]?.props.locale,
        route: pages[0]?.props.route,
        path: pages[0]?.props.path,
      },
      { locale: 'en', route: row, path: 'blog' },
    );
  });

  it('sets previous and first from page 2, and next and last until the last page', async () => {
    // Three entries fill three pages of one, so the listing publishes blog, blog/2, and blog/3.
    const intl = intlFor([blogListing()], {
      blog: [post('a', 'en'), post('b', 'en'), post('c', 'en')],
    });
    const first = await intl.listingPaths(
      '/en/blog/[...page]',
      'blog',
      await astroPaginate('...page'),
      keepOrder(),
    );
    const rest = await intl.listingPaths(
      '/en/blog/[page]',
      'blog',
      await astroPaginate('page'),
      keepOrder(),
    );

    assert.deepEqual(first[0]?.props.page.url, {
      current: '/en/blog/',
      prev: undefined,
      next: '/en/blog/2/',
      first: undefined,
      last: '/en/blog/3/',
    });
    assert.deepEqual(
      rest.map((item) => item.props.page.url),
      [
        {
          current: '/en/blog/2/',
          prev: '/en/blog/',
          next: '/en/blog/3/',
          first: '/en/blog/',
          last: '/en/blog/3/',
        },
        {
          current: '/en/blog/3/',
          prev: '/en/blog/2/',
          next: undefined,
          first: '/en/blog/',
          last: undefined,
        },
      ],
    );
  });

  it('links page 1 to a pagination.slug that adds a segment', async () => {
    const intl = intlFor(
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
      {
        blog: [post('a', 'en'), post('b', 'en')],
      },
    );
    const pageOne = await intl.listingPaths(
      '/en/blog/[...page]',
      'blog',
      await astroPaginate('...page'),
      keepOrder(),
    );
    const pageTwo = await intl.listingPaths(
      '/en/blog/page/[page]',
      'blog',
      await astroPaginate('page'),
      keepOrder(),
    );

    assert.deepEqual(
      [
        { path: pageOne[0]?.props.path, next: pageOne[0]?.props.page.url.next },
        { path: pageTwo[0]?.props.path, prev: pageTwo[0]?.props.page.url.prev },
      ],
      [
        { path: 'blog', next: '/en/blog/page/2/' },
        { path: 'blog/page/2', prev: '/en/blog/' },
      ],
    );
  });

  it('numbers a root listing from the bare {page} segment', async () => {
    const intl = intlFor(
      [
        {
          slug: { en: '/', de: '/' },
          view: 'home',
          collection: 'posts',
          pagination: { pageSize: 1, slug: { en: '{page}', de: '{page}' } },
        },
      ],
      {
        posts: [
          collectionEntry('posts', 'a', { id: 'a', locale: 'en' }),
          collectionEntry('posts', 'b', { id: 'b', locale: 'en' }),
        ],
      },
      { routing: { prefixDefaultLocale: false } },
    );
    const pages = await intl.listingPaths(
      '/[...page]',
      'posts',
      await astroPaginate('...page'),
      keepOrder(),
    );
    const rest = await intl.listingPaths(
      '/[page]',
      'posts',
      await astroPaginate('page'),
      keepOrder(),
    );

    assert.deepEqual(
      [
        {
          path: pages[0]?.props.path,
          current: pages[0]?.props.page.url.current,
          next: pages[0]?.props.page.url.next,
        },
        { path: rest[0]?.props.path, prev: rest[0]?.props.page.url.prev },
      ],
      [
        { path: '/', current: '/en/', next: '/en/2/' },
        { path: '2', prev: '/en/' },
      ],
    );
  });

  it('publishes the listing tail when another row uses a numeric tail', async () => {
    const intl = intlFor(
      [
        {
          slug: { en: 'blog' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}' } },
        },
        { slug: { en: 'blog/2024' }, view: 'archive' },
      ],
      { blog: [post('a', 'en')] },
      { locales: ['en'], defaultLocale: 'en' },
    );
    const pages = await intl.listingPaths(
      '/en/blog/[...page]',
      'blog',
      await astroPaginate('...page'),
      keepOrder(),
    );

    assert.deepEqual(
      pages.map((item) => item.props.path),
      ['blog'],
    );
  });

  it('aborts when paginate emits a page the listing did not publish', async () => {
    // One entry fills blog only, so page 5 was not published.
    const intl = intlFor([blogListing()], { blog: [post('a', 'en')] });
    const pageFive = (() => [
      {
        params: { page: '5' },
        props: { page: { currentPage: 5, lastPage: 5 } },
      },
    ]) as unknown as PaginateFunction;

    await assert.rejects(
      async () => intl.listingPaths('/en/blog/[page]', 'blog', pageFive, keepOrder()),
      {
        message:
          '@repo/astro-intl: listing "blog/{page}" in "en" emits page 5, which pairing did not publish.',
      },
    );
  });

  it('aborts when paginate emits fewer pages than pairing published', async () => {
    // Three entries fill three pages of one. The {page} route counts blog/2 and blog/3.
    const intl = intlFor([blogListing()], {
      blog: [post('a', 'en'), post('b', 'en'), post('c', 'en')],
    });
    const onlyPageOne = (() => [
      {
        params: { page: '1' },
        props: { page: { currentPage: 1, lastPage: 1 } },
      },
    ]) as unknown as PaginateFunction;

    await assert.rejects(
      async () => intl.listingPaths('/en/blog/[page]', 'blog', onlyPageOne, keepOrder()),
      {
        message:
          '@repo/astro-intl: listing "blog/{page}" in "en" emits 0 pages; pairing published 2.',
      },
    );
  });

  it('puts the higher number on page 1 when sort descends', async () => {
    const low = post('low', 'en', { n: 1 });
    const high = post('high', 'en', { n: 9 });
    const intl = intlFor([blogListing()], { blog: [low, high] });
    const descend = {
      sort: () => (a: CollectionEntry, b: CollectionEntry) => Number(b.data.n) - Number(a.data.n),
    };
    const pageOne = await intl.listingPaths(
      '/en/blog/[...page]',
      'blog',
      await astroPaginate('...page'),
      descend,
    );
    const pageTwo = await intl.listingPaths(
      '/en/blog/[page]',
      'blog',
      await astroPaginate('page'),
      descend,
    );

    assert.deepEqual(
      [pageOne[0]?.props.page.data[0]?.id, pageTwo[0]?.props.page.data[0]?.id],
      ['high', 'low'],
    );
  });

  it('passes the route locale to order', async () => {
    const intl = intlFor([blogListing()], { blog: [post('a', 'en')] });
    let locale: string | undefined;
    await intl.listingPaths('/de/artikel/[...page]', 'blog', await astroPaginate('...page'), {
      order: (entries, context) => {
        locale = context.locale;
        return entries;
      },
    });

    assert.equal(locale, 'de');
  });

  it('passes the route locale to sort', async () => {
    const intl = intlFor([blogListing()], { blog: [post('a', 'en')] });
    let locale: string | undefined;
    await intl.listingPaths('/de/artikel/[...page]', 'blog', await astroPaginate('...page'), {
      sort: (context) => {
        locale = context.locale;
        return () => 0;
      },
    });

    assert.equal(locale, 'de');
  });

  it('aborts when order drops an entry', async () => {
    const intl = intlFor([blogListing()], { blog: [post('a', 'en'), post('b', 'en')] });

    await assert.rejects(
      async () =>
        intl.listingPaths('/en/blog/[...page]', 'blog', await astroPaginate('...page'), {
          order: (entries) => entries.slice(1),
        }),
      {
        message:
          '@repo/astro-intl: listing "blog" in "en" order must keep every entry and only reorder.',
      },
    );
  });

  it('aborts when order duplicates an entry', async () => {
    const intl = intlFor([blogListing()], { blog: [post('a', 'en'), post('b', 'en')] });

    await assert.rejects(
      async () =>
        intl.listingPaths('/en/blog/[...page]', 'blog', await astroPaginate('...page'), {
          order: (entries) => {
            const first = entries[0];
            if (first === undefined) return entries;
            return entries.map((entry, index) => (index === 1 ? first : entry));
          },
        }),
      {
        message:
          '@repo/astro-intl: listing "blog" in "en" order must keep every entry and only reorder.',
      },
    );
  });

  it('aborts when a listing sets neither sort nor order', async () => {
    const intl = intlFor([blogListing()], { blog: [post('a', 'en')] });

    await assert.rejects(
      async () =>
        intl.listingPaths(
          '/en/blog/[...page]',
          'blog',
          await astroPaginate('...page'),
          {} as ListingOrder<CollectionEntry>,
        ),
      { message: '@repo/astro-intl: listing "blog" in "en" needs sort or order.' },
    );
  });

  it('aborts when a listing sets both sort and order', async () => {
    const intl = intlFor([blogListing()], { blog: [post('a', 'en')] });

    await assert.rejects(
      async () =>
        intl.listingPaths('/en/blog/[...page]', 'blog', await astroPaginate('...page'), {
          sort: () => () => 0,
          order: (entries: readonly CollectionEntry[]) => entries,
        } as unknown as ListingOrder<CollectionEntry>),
      { message: '@repo/astro-intl: listing "blog" in "en" sets both sort and order.' },
    );
  });

  it('aborts when listingPaths names a collection the row does not', async () => {
    const intl = intlFor([blogListing()], { blog: [post('a', 'en')], tags: [] });

    await assert.rejects(
      async () =>
        intl.listingPaths(
          '/en/blog/[...page]',
          'tags',
          await astroPaginate('...page'),
          keepOrder(),
        ),
      {
        message:
          '@repo/astro-intl: listingPaths for "/en/blog/[...page]" in view "index" got "tags", but that route row names collection "blog". Pass "blog" (or add it to the list).',
      },
    );
  });

  it('publishes the listing when the list includes the collection the row names', async () => {
    const intl = intlFor([blogListing()], {
      blog: [post('pin-en', 'en'), post('alpha-en', 'en')],
      notes: [],
    });
    const pages = await intl.listingPaths(
      '/en/blog/[...page]',
      ['notes', 'blog'],
      await astroPaginate('...page'),
      keepOrder(),
    );

    assert.deepEqual(
      pages.map((item) => ({
        path: item.props.path,
        next: item.props.page.url.next,
        entry: item.props.page.data[0]?.id,
      })),
      [{ path: 'blog', next: '/en/blog/2/', entry: 'pin-en' }],
    );
  });

  it('aborts when a listingPaths list omits the collection the row names', async () => {
    const intl = intlFor([blogListing()], {
      blog: [post('a', 'en')],
      tags: [],
      notes: [],
    });

    await assert.rejects(
      async () =>
        intl.listingPaths(
          '/en/blog/[...page]',
          ['tags', 'notes'],
          await astroPaginate('...page'),
          keepOrder(),
        ),
      {
        message:
          '@repo/astro-intl: listingPaths for "/en/blog/[...page]" in view "index" got "tags", "notes", but that route row names collection "blog". Pass "blog" (or add it to the list).',
      },
    );
  });

  it('returns nothing for a locale that does not publish the named entry', async () => {
    const intl = intlFor(
      [
        {
          slug: { en: 'featured', de: 'hervorgehoben' },
          view: 'featured',
          collection: { name: 'blog', entry: 'pin' },
        },
      ],
      { blog: [collectionEntry('blog', 'pin-en', { id: 'pin', locale: 'en' })] },
    );

    assert.deepEqual(await intl.staticPaths('/de/hervorgehoben/[...index]'), []);
  });

  it('returns the written tail when the row names no entry', async () => {
    const intl = intlFor([{ slug: { en: 'about', de: 'ueber' }, view: 'about' }], {});

    assert.deepEqual(await intl.staticPaths('/en/about/[...index]'), [
      {
        params: { index: undefined },
        props: {
          locale: 'en',
          path: 'about',
          entry: undefined,
          route: {
            slug: { en: 'about', de: 'ueber' },
            view: 'about',
          },
        },
      },
    ]);
  });

  it('types the collection argument from collections.translated', () => {
    const intl = createIntl(
      defineIntl({
        locales: ['en'],
        defaultLocale: 'en',
        routes: [{ slug: { en: 'blog/{slug}' }, view: 'post', collection: 'posts' }],
        collections: { translated: ['posts', 'tags'] },
      }),
    );
    const accept = () => intl.entryPaths('/blog/[slug]', 'posts');
    const listed = () => intl.entryPaths('/blog/[slug]', ['posts', 'tags']);
    const rejected = () => {
      // @ts-expect-error collection name is not in collections.translated
      return intl.entryPaths('/blog/[slug]', 'postz');
    };
    assert.equal(typeof accept, 'function');
    assert.equal(typeof listed, 'function');
    assert.equal(typeof rejected, 'function');
  });
});
