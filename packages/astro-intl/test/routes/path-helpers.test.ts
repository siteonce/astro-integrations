import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createIntl, defineIntl, type ListingOrder } from '@repo/astro-intl';
import type { PaginateFunction } from 'astro';
import { astroPaginate } from '../astro.ts';
import {
  blogEntries,
  blogRoutes,
  type CollectionEntry,
  collectionEntry,
  collectionLoaders,
  type IntlConfigInput,
  intlConfig,
  keepOrder,
} from '../fixtures.ts';

function bind(
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

function blog(also: readonly string[] = []) {
  const collections: Record<string, readonly CollectionEntry[]> = { blog: blogEntries() };
  for (const name of also) collections[name] = [];
  return bind(blogRoutes(), collections);
}

const enLeaves = [
  { slug: 'alpha', path: 'blog/alpha' },
  { slug: 'solo', path: 'blog/solo' },
  { slug: 'mehr', path: 'blog/mehr' },
];

function leaves(
  items: readonly { params: { slug: string }; props: { path: string } }[],
): { slug: string; path: string }[] {
  return items.map((item) => ({ slug: item.params.slug, path: item.props.path }));
}

describe('path helpers', () => {
  it('publishes the section and slug of each locale, and leaves out a named entry', async () => {
    const intl = blog();
    const en = await intl.entryPaths('/en/blog/[slug]', 'blog');
    const de = await intl.entryPaths('/de/artikel/[slug]', 'blog');
    assert.deepEqual(leaves(en), enLeaves);
    assert.deepEqual(leaves(de), [
      { slug: 'anders', path: 'artikel/anders' },
      { slug: 'mehr', path: 'artikel/mehr' },
    ]);
  });

  it('accepts one trailing slash on the route pattern', async () => {
    const intl = blog();
    assert.deepEqual(leaves(await intl.entryPaths('/en/blog/[slug]/', 'blog')), enLeaves);
  });

  it('rejects a route pattern that was not injected', async () => {
    const intl = blog();
    await assert.rejects(() => intl.entryPaths('/nope', 'blog'), {
      message: '@repo/astro-intl: no injected entry route for pattern "/nope".',
    });
  });

  it('aborts when entryPaths names a collection the row does not', async () => {
    const intl = blog(['tags', 'notes']);
    await assert.rejects(() => intl.entryPaths('/en/blog/[slug]', 'tags'), {
      message:
        '@repo/astro-intl: entryPaths for "/en/blog/[slug]" in view "post" got "tags", but that route row names collection "blog". Pass "blog" (or add it to the list).',
    });
  });

  it('entryPaths accepts a list that includes the collection the row names', async () => {
    const intl = blog(['tags', 'notes']);
    assert.deepEqual(leaves(await intl.entryPaths('/en/blog/[slug]', ['tags', 'blog'])), enLeaves);
  });

  it('aborts when an entryPaths list omits the collection the row names', async () => {
    const intl = blog(['tags', 'notes']);
    await assert.rejects(() => intl.entryPaths('/en/blog/[slug]', ['tags', 'notes']), {
      message:
        '@repo/astro-intl: entryPaths for "/en/blog/[slug]" in view "post" got "tags", "notes", but that route row names collection "blog". Pass "blog" (or add it to the list).',
    });
  });

  it('publishes page 1 on the spread and later pages on {page}', async () => {
    const intl = blog();
    const spread = await astroPaginate('...page');
    const numbered = await astroPaginate('page');
    const first = await intl.listingPaths('/en/blog/[...page]', 'blog', spread, keepOrder());
    const rest = await intl.listingPaths('/en/blog/[page]', 'blog', numbered, keepOrder());
    assert.deepEqual(
      first.map((item) => item.props.path),
      ['blog'],
    );
    assert.equal(first[0]?.props.page.url.next, '/en/blog/2/');
    assert.deepEqual(
      rest.map((item) => item.props.path),
      ['blog/2', 'blog/3', 'blog/4'],
    );
    assert.equal(rest[0]?.props.page.url.prev, '/en/blog/');
    assert.equal(rest[0]?.props.page.url.current, '/en/blog/2/');
  });

  it('links page 1 to a pagination.slug that adds a segment', async () => {
    const intl = bind(
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
        blog: [
          collectionEntry('blog', 'a', { id: 'a', locale: 'en' }),
          collectionEntry('blog', 'b', { id: 'b', locale: 'en' }),
        ],
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
      pageOne.map((item) => item.props.path),
      ['blog'],
    );
    assert.deepEqual(
      pageTwo.map((item) => item.props.path),
      ['blog/page/2'],
    );
    assert.equal(pageOne[0]?.props.page.url.next, '/en/blog/page/2/');
    assert.equal(pageTwo[0]?.props.page.url.prev, '/en/blog/');
  });

  it('numbers a root listing from the bare {page} segment', async () => {
    const intl = bind(
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
      pages.map((item) => item.props.path),
      ['/'],
    );
    assert.deepEqual(
      rest.map((item) => item.props.path),
      ['2'],
    );
    assert.equal(pages[0]?.props.page.url.current, '/en/');
    assert.equal(pages[0]?.props.page.url.next, '/en/2/');
    assert.equal(rest[0]?.props.page.url.prev, '/en/');
  });

  it('publishes the listing tail when another row uses a numeric tail', async () => {
    const intl = bind(
      [
        {
          slug: { en: 'blog' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}' } },
        },
        { slug: { en: 'blog/2024' }, view: 'archive' },
      ],
      { blog: [collectionEntry('blog', 'a', { id: 'a', locale: 'en' })] },
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
    const intl = blog();
    // Four en entries at page size 1 publish `blog` through `blog/4`.
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

  it('puts the higher number on page 1 when sort descends', async () => {
    const low = collectionEntry('blog', 'low', { id: 'low', locale: 'en', n: 1 });
    const high = collectionEntry('blog', 'high', { id: 'high', locale: 'en', n: 9 });
    const intl = bind(
      [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
      { blog: [low, high] },
    );
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
    assert.equal(pageOne[0]?.props.page.data[0]?.id, 'high');
    assert.equal(pageTwo[0]?.props.page.data[0]?.id, 'low');
  });

  it('passes the route locale to order', async () => {
    const intl = blog();
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
    const intl = blog();
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
    const intl = blog();
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
    const intl = blog();
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
    const intl = blog();
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
    const intl = blog();
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
    const intl = blog(['tags', 'notes']);
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

  it('listingPaths accepts a list that includes the collection the row names', async () => {
    const intl = blog(['tags', 'notes']);
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
    const intl = blog(['tags', 'notes']);
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
    const intl = blog();
    assert.deepEqual(await intl.staticPaths('/de/hervorgehoben/[...index]'), []);
  });

  it('returns the written tail when the row names no entry', async () => {
    const intl = blog();
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
