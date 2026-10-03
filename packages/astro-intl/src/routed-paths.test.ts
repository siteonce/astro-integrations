import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { PaginateFunction } from 'astro';
import type { IntlConfig } from './define-intl.ts';
import type { CollectionEntryLike } from './pairing.ts';
import { createIntlQuery, type IntlQuery } from './query.ts';
import {
  entryPathsFor,
  fallbackPathsFor,
  type ListingOrder,
  listingPathsFor,
  routeFor,
  staticPathsFor,
} from './routed-paths.ts';
import { type CompiledRoute, compileRoutes } from './routing.ts';
import { requestPaginate } from './view-props.ts';

type RouteRow = NonNullable<IntlConfig['routes']>[number];

function entry(astroId: string, data: Record<string, unknown>): CollectionEntryLike {
  return { id: astroId, collection: 'blog', data };
}

const pin = entry('pin-en', { id: 'pin', locale: 'en', slug: 'pin-slug' });
const alphaEn = entry('alpha-en', { id: 'alpha', locale: 'en', slug: 'alpha' });
const alphaDe = entry('alpha-de', { id: 'alpha', locale: 'de', slug: 'anders' });
const solo = entry('solo-en', { id: 'solo', locale: 'en', slug: 'solo' });
const mehr = entry('mehr-de', { id: 'mehr', locale: 'de', slug: 'mehr' });
const clash = entry('clash-en', { id: 'clash', locale: 'en', slug: 'mehr' });

const config: IntlConfig = {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  routes: [
    { slug: { en: 'about', de: 'ueber' }, view: 'about' },
    {
      slug: { en: 'featured', de: 'hervorgehoben' },
      view: 'featured',
      collection: 'blog',
      entry: 'pin',
    },
    {
      slug: { en: 'blog', de: 'artikel' },
      view: 'index',
      collection: 'blog',
      pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
    },
    {
      slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
      view: 'post',
      collection: 'blog',
      fallbackView: 'missing',
    },
  ],
  collections: { translated: ['blog'] },
};

const blog = [pin, alphaEn, alphaDe, solo, mehr, clash];

function queryFor(source: IntlConfig = config, posts: CollectionEntryLike[] = blog): IntlQuery {
  return createIntlQuery({
    config: source,
    collections: { blog: posts },
    getAbsoluteLocaleUrl: (locale, path = '') =>
      `https://example.com/${locale}${path ? `/${path}` : ''}`,
  });
}

function relativeUrl(locale: string, path = ''): string {
  return path === '' ? `/${locale}` : `/${locale}/${path}`;
}

function markedRelativeUrl(locale: string, path = ''): string {
  return `/${locale}/${path ?? ''}#u`;
}

function paginate(
  data: readonly unknown[],
  args: { pageSize: number; props: { locale: string; route: RouteRow } },
) {
  const lastPage = Math.max(1, Math.ceil(data.length / args.pageSize));
  return Array.from({ length: lastPage }, (_, index) => {
    const currentPage = index + 1;
    return {
      params: { page: currentPage === 1 ? undefined : String(currentPage) },
      props: {
        locale: args.props.locale,
        route: args.props.route,
        page: { currentPage, lastPage },
      },
    };
  });
}

const paginateFn = paginate as unknown as PaginateFunction;

const keepOrder: ListingOrder<CollectionEntryLike> = { sort: () => () => 0 };

function compiledRoute(pattern: string, kind: CompiledRoute['kind']): CompiledRoute {
  return routeFor(compileRoutes(config), pattern, kind);
}

describe('routeFor', () => {
  it('resolves one pattern to entry or fallback by kind', () => {
    const compiled = compileRoutes(config);
    assert.equal(routeFor(compiled, '/de/artikel/[slug]', 'entry').view, 'post');
    assert.equal(routeFor(compiled, '/de/artikel/[slug]/', 'fallback').view, 'missing');
    assert.throws(() => routeFor(compiled, '/nope', 'entry'), {
      message: '@repo/astro-intl: no injected entry route for pattern "/nope".',
    });
  });

  it('does not strip the root pattern', () => {
    const compiled: CompiledRoute[] = [
      { pattern: '/', view: 'home', locale: 'en', rowIndex: 0, kind: 'static' },
    ];
    assert.equal(routeFor(compiled, '/', 'static').pattern, '/');
  });
});

describe('entryPathsFor', () => {
  it('returns that locale’s leaves and leaves out the fixed entry', () => {
    const query = queryFor();
    const en = entryPathsFor(config, query, compiledRoute('/en/blog/[slug]', 'entry'), 'blog');
    assert.deepEqual(
      en.map((item) => item.props.path),
      ['blog/alpha', 'blog/solo', 'blog/mehr'],
    );
    assert.deepEqual(
      en.map((item) => item.params.slug),
      ['alpha', 'solo', 'mehr'],
    );
    const de = entryPathsFor(config, query, compiledRoute('/de/artikel/[slug]', 'entry'), 'blog');
    assert.deepEqual(
      de.map((item) => item.props.path),
      ['artikel/anders', 'artikel/mehr'],
    );
  });

  it('throws when the name is not the row collection', () => {
    assert.throws(
      () => entryPathsFor(config, queryFor(), compiledRoute('/en/blog/[slug]', 'entry'), 'tags'),
      {
        message:
          '@repo/astro-intl: entryPaths for "/en/blog/[slug]" in view "post" got "tags", but that route row names collection "blog". Pass "blog" (or add it to the list).',
      },
    );
  });

  it('accepts a list that contains the row collection', () => {
    const query = queryFor();
    const route = compiledRoute('/en/blog/[slug]', 'entry');
    assert.deepEqual(
      entryPathsFor(config, query, route, ['tags', 'blog']),
      entryPathsFor(config, query, route, 'blog'),
    );
  });

  it('throws when a list omits the row collection', () => {
    assert.throws(
      () =>
        entryPathsFor(config, queryFor(), compiledRoute('/en/blog/[slug]', 'entry'), [
          'tags',
          'notes',
        ]),
      {
        message:
          '@repo/astro-intl: entryPaths for "/en/blog/[slug]" in view "post" got "tags", "notes", but that route row names collection "blog". Pass "blog" (or add it to the list).',
      },
    );
  });

  it('throws when the route row names no collection', () => {
    const bare: IntlConfig = {
      locales: ['en'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: false },
      routes: [{ slug: { en: 'blog/{slug}' }, view: 'post' }],
    };
    const route = routeFor(compileRoutes(bare), '/blog/[slug]', 'entry');
    assert.throws(() => entryPathsFor(bare, queryFor(), route, 'blog'), {
      message:
        '@repo/astro-intl: entryPaths for "/blog/[slug]" in view "post" got "blog", but that route row names no collection. Name a collection on that route row.',
    });
  });
});

const require = createRequire(import.meta.url);

async function astroPaginate(param: 'page' | '...page'): Promise<PaginateFunction> {
  const astroJson = require.resolve('astro/package.json');
  const paginateHref = pathToFileURL(join(dirname(astroJson), 'dist/core/render/paginate.js')).href;
  const { generatePaginateFunction } = (await import(paginateHref)) as {
    generatePaginateFunction: (
      route: { params: string[]; segments: unknown[] },
      base: string,
      trailingSlash: string,
    ) => PaginateFunction;
  };
  return generatePaginateFunction({ params: [param], segments: [] }, '/', 'always');
}

describe('renamed collection fields', () => {
  it('reads id, locale, and slug from the named fields', () => {
    const renamed: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'posts',
          pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
        { slug: { en: 'blog/{slug}', de: 'artikel/{slug}' }, view: 'post', collection: 'posts' },
      ],
      collections: {
        translated: ['posts'],
        fields: { posts: { id: 'uid', locale: 'lang', slug: 'path' } },
      },
    };
    const enA = {
      id: 'a-en',
      collection: 'posts',
      data: { uid: 'a', lang: 'en', path: 'alpha', locale: 'de' },
    };
    const enB = { id: 'b-en', collection: 'posts', data: { uid: 'b', lang: 'en', path: 'beta' } };
    const deA = {
      id: 'a-de',
      collection: 'posts',
      data: { uid: 'a', lang: 'de', path: 'alpha-de', locale: 'en' },
    };
    const query = createIntlQuery({
      config: renamed,
      collections: { posts: [enA, enB, deA] },
      getAbsoluteLocaleUrl: () => '',
    });
    const compiled = compileRoutes(renamed);
    const en = entryPathsFor(
      renamed,
      query,
      routeFor(compiled, '/en/blog/[slug]', 'entry'),
      'posts',
    );
    const de = entryPathsFor(
      renamed,
      query,
      routeFor(compiled, '/de/artikel/[slug]', 'entry'),
      'posts',
    );
    assert.deepEqual(
      en.map((item) => item.params.slug),
      ['alpha', 'beta'],
    );
    assert.deepEqual(
      de.map((item) => item.params.slug),
      ['alpha-de'],
    );
    assert.equal(query.getContentById('en', 'posts/a')?.id, 'a-en');
    assert.equal(query.getContentById('de', 'posts/a')?.id, 'a-de');

    const pageOne = listingPathsFor(
      renamed,
      query,
      routeFor(compiled, '/en/blog/[...page]', 'listing'),
      'posts',
      requestPaginate,
      keepOrder,
      markedRelativeUrl,
    );
    const pageTwo = listingPathsFor(
      renamed,
      query,
      routeFor(compiled, '/en/blog/[page]', 'listing'),
      'posts',
      requestPaginate,
      keepOrder,
      markedRelativeUrl,
    );
    const dePage = listingPathsFor(
      renamed,
      query,
      routeFor(compiled, '/de/artikel/[...page]', 'listing'),
      'posts',
      requestPaginate,
      keepOrder,
      markedRelativeUrl,
    );
    assert.equal(pageOne[0]?.props.page.data[0], enA);
    assert.equal(pageTwo[0]?.props.page.data[0], enB);
    assert.equal(dePage[0]?.props.page.data[0], deA);
  });
});

describe('listingPathsFor', () => {
  it('emits page 1 from [...page] and later pages from [page]', async () => {
    const query = queryFor();
    const first = compiledRoute('/en/blog/[...page]', 'listing');
    const rest = compiledRoute('/en/blog/[page]', 'listing');
    const spread = await astroPaginate('...page');
    const named = await astroPaginate('page');
    const list = (route: CompiledRoute, paginate: PaginateFunction) =>
      listingPathsFor(config, query, route, 'blog', paginate, keepOrder, markedRelativeUrl);
    for (const paginate of [spread, requestPaginate]) {
      const pages = list(first, paginate);
      assert.deepEqual(
        pages.map((item) => item.props.path),
        ['blog'],
      );
      assert.equal(pages[0]?.props.page.url.next, markedRelativeUrl('en', 'blog/2'));
    }
    for (const paginate of [named, requestPaginate]) {
      const pages = list(rest, paginate);
      assert.deepEqual(
        pages.map((item) => item.props.path),
        ['blog/2', 'blog/3', 'blog/4'],
      );
      assert.equal(pages[0]?.props.page.url.prev, markedRelativeUrl('en', 'blog'));
      assert.equal(pages[0]?.props.page.url.current, markedRelativeUrl('en', 'blog/2'));
    }
  });

  it('links page 1 to pagination.slug when that tail adds a segment', () => {
    const section: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
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
      collections: { translated: ['blog'] },
    };
    const posts = [
      entry('a-en', { id: 'a', locale: 'en' }),
      entry('b-en', { id: 'b', locale: 'en' }),
    ];
    const query = createIntlQuery({
      config: section,
      collections: { blog: posts },
      getAbsoluteLocaleUrl: () => '',
    });
    const compiled = compileRoutes(section);
    const pageOne = listingPathsFor(
      section,
      query,
      routeFor(compiled, '/en/blog/[...page]', 'listing'),
      'blog',
      paginateFn,
      keepOrder,
      markedRelativeUrl,
    );
    const pageTwo = listingPathsFor(
      section,
      query,
      routeFor(compiled, '/en/blog/page/[page]', 'listing'),
      'blog',
      paginateFn,
      keepOrder,
      markedRelativeUrl,
    );
    assert.deepEqual(
      pageOne.map((item) => item.props.path),
      ['blog'],
    );
    assert.deepEqual(
      pageTwo.map((item) => item.props.path),
      ['blog/page/2'],
    );
    assert.equal(pageOne[0]?.props.page.url.next, markedRelativeUrl('en', 'blog/page/2'));
    assert.equal(pageTwo[0]?.props.page.url.prev, markedRelativeUrl('en', 'blog'));
  });

  it('numbers a root listing from the bare page', () => {
    const home: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: false },
      routes: [
        {
          slug: { en: '/', de: '/' },
          view: 'home',
          collection: 'posts',
          pagination: { pageSize: 1, slug: { en: '{page}', de: '{page}' } },
        },
      ],
      collections: { translated: ['posts'] },
    };
    const posts = [
      { id: 'a', collection: 'posts', data: { id: 'a', locale: 'en' } },
      { id: 'b', collection: 'posts', data: { id: 'b', locale: 'en' } },
    ];
    const query = createIntlQuery({
      config: home,
      collections: { posts },
      getAbsoluteLocaleUrl: (locale, path = '') => `https://example.com/${locale}/${path}`,
    });
    const compiled = compileRoutes(home);
    const pages = listingPathsFor(
      home,
      query,
      routeFor(compiled, '/[...page]', 'listing'),
      'posts',
      paginateFn,
      keepOrder,
      markedRelativeUrl,
    );
    const rest = listingPathsFor(
      home,
      query,
      routeFor(compiled, '/[page]', 'listing'),
      'posts',
      paginateFn,
      keepOrder,
      markedRelativeUrl,
    );
    assert.deepEqual(
      pages.map((item) => item.props.path),
      ['/'],
    );
    assert.deepEqual(
      rest.map((item) => item.props.path),
      ['2'],
    );
    assert.equal(pages[0]?.props.page.url.current, markedRelativeUrl('en', ''));
    assert.equal(pages[0]?.props.page.url.next, markedRelativeUrl('en', '2'));
    assert.equal(rest[0]?.props.page.url.prev, markedRelativeUrl('en', ''));
  });

  it('does not count another row’s numeric tail under the listing', () => {
    const archive: IntlConfig = {
      locales: ['en'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        {
          slug: { en: 'blog' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 10, slug: { en: 'blog/{page}' } },
        },
        { slug: { en: 'blog/2024' }, view: 'archive' },
      ],
      collections: { translated: ['blog'] },
    };
    const query = createIntlQuery({
      config: archive,
      collections: { blog: [entry('a-en', { id: 'a', locale: 'en' })] },
      getAbsoluteLocaleUrl: () => '',
    });
    const pages = listingPathsFor(
      archive,
      query,
      routeFor(compileRoutes(archive), '/en/blog/[...page]', 'listing'),
      'blog',
      paginateFn,
      keepOrder,
      markedRelativeUrl,
    );
    assert.deepEqual(
      pages.map((item) => item.props.path),
      ['blog'],
    );
  });

  it('throws when paginate emits a page pairing did not publish', () => {
    const extra = ((
      data: readonly unknown[],
      args: { pageSize: number; props: { locale: string; route: RouteRow } },
    ) => {
      const pages = paginate(data, args);
      const last = pages.at(-1);
      const currentPage = (last?.props.page.currentPage ?? 0) + 1;
      return [
        ...pages,
        {
          params: { page: String(currentPage) },
          props: { ...last?.props, page: { currentPage } },
        },
      ];
    }) as unknown as PaginateFunction;
    assert.throws(
      () =>
        listingPathsFor(
          config,
          queryFor(),
          compiledRoute('/en/blog/[page]', 'listing'),
          'blog',
          extra,
          keepOrder,
          markedRelativeUrl,
        ),
      /listing "blog\/\{page\}" in "en" emits page 5, which pairing did not publish/,
    );
  });

  it('puts the higher number on page 1 when sort descends', () => {
    const low = entry('low', { id: 'low', locale: 'en', n: 1 });
    const high = entry('high', { id: 'high', locale: 'en', n: 9 });
    const section: IntlConfig = {
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        {
          slug: { en: 'blog', de: 'artikel' },
          view: 'index',
          collection: 'blog',
          pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
        },
      ],
      collections: { translated: ['blog'] },
    };
    const query = createIntlQuery({
      config: section,
      collections: { blog: [low, high] },
      getAbsoluteLocaleUrl: () => '',
    });
    const compiled = compileRoutes(section);
    const descend: ListingOrder<CollectionEntryLike> = {
      sort: () => (a, b) => Number(b.data.n) - Number(a.data.n),
    };
    const pageOne = listingPathsFor(
      section,
      query,
      routeFor(compiled, '/en/blog/[...page]', 'listing'),
      'blog',
      requestPaginate,
      descend,
      markedRelativeUrl,
    );
    const pageTwo = listingPathsFor(
      section,
      query,
      routeFor(compiled, '/en/blog/[page]', 'listing'),
      'blog',
      requestPaginate,
      descend,
      markedRelativeUrl,
    );
    assert.equal(pageOne[0]?.props.page.data[0], high);
    assert.equal(pageTwo[0]?.props.page.data[0], low);
  });

  it('passes the route locale to order', () => {
    let locale: string | undefined;
    listingPathsFor(
      config,
      queryFor(),
      compiledRoute('/de/artikel/[...page]', 'listing'),
      'blog',
      paginateFn,
      {
        order: (entries, context) => {
          locale = context.locale;
          return entries;
        },
      },
      markedRelativeUrl,
    );
    assert.equal(locale, 'de');
  });

  it('passes the route locale to sort', () => {
    let locale: string | undefined;
    listingPathsFor(
      config,
      queryFor(),
      compiledRoute('/de/artikel/[...page]', 'listing'),
      'blog',
      paginateFn,
      {
        sort: (context) => {
          locale = context.locale;
          return () => 0;
        },
      },
      markedRelativeUrl,
    );
    assert.equal(locale, 'de');
  });

  it('throws when order drops an entry', () => {
    assert.throws(
      () =>
        listingPathsFor(
          config,
          queryFor(),
          compiledRoute('/en/blog/[...page]', 'listing'),
          'blog',
          paginateFn,
          { order: (entries) => entries.slice(1) },
          markedRelativeUrl,
        ),
      /listing "blog" in "en" order must keep every entry and only reorder/,
    );
  });

  it('throws when order duplicates an entry', () => {
    assert.throws(
      () =>
        listingPathsFor(
          config,
          queryFor(),
          compiledRoute('/en/blog/[...page]', 'listing'),
          'blog',
          paginateFn,
          {
            order: (entries) => {
              const first = entries[0];
              if (first === undefined) return entries;
              return entries.map((entry, index) => (index === 1 ? first : entry));
            },
          },
          markedRelativeUrl,
        ),
      /listing "blog" in "en" order must keep every entry and only reorder/,
    );
  });

  it('throws when neither sort nor order is set', () => {
    assert.throws(
      () =>
        listingPathsFor(
          config,
          queryFor(),
          compiledRoute('/en/blog/[...page]', 'listing'),
          'blog',
          paginateFn,
          {} as ListingOrder<CollectionEntryLike>,
          markedRelativeUrl,
        ),
      /listing "blog" in "en" needs sort or order/,
    );
  });

  it('throws when both sort and order are set', () => {
    assert.throws(
      () =>
        listingPathsFor(
          config,
          queryFor(),
          compiledRoute('/en/blog/[...page]', 'listing'),
          'blog',
          paginateFn,
          {
            sort: () => () => 0,
            order: (entries: readonly CollectionEntryLike[]) => entries,
          } as unknown as ListingOrder<CollectionEntryLike>,
          markedRelativeUrl,
        ),
      /listing "blog" in "en" sets both sort and order/,
    );
  });

  it('throws when the name is not the row collection', () => {
    assert.throws(
      () =>
        listingPathsFor(
          config,
          queryFor(),
          compiledRoute('/en/blog/[...page]', 'listing'),
          'tags',
          paginateFn,
          keepOrder,
          markedRelativeUrl,
        ),
      {
        message:
          '@repo/astro-intl: listingPaths for "/en/blog/[...page]" in view "index" got "tags", but that route row names collection "blog". Pass "blog" (or add it to the list).',
      },
    );
  });

  it('accepts a list that contains the row collection', () => {
    const query = queryFor();
    const route = compiledRoute('/en/blog/[...page]', 'listing');
    const listed = listingPathsFor(
      config,
      query,
      route,
      ['notes', 'blog'],
      paginateFn,
      keepOrder,
      markedRelativeUrl,
    );
    const single = listingPathsFor(
      config,
      query,
      route,
      'blog',
      paginateFn,
      keepOrder,
      markedRelativeUrl,
    );
    assert.deepEqual(
      listed.map((item) => item.props.path),
      single.map((item) => item.props.path),
    );
  });

  it('throws when a list omits the row collection', () => {
    assert.throws(
      () =>
        listingPathsFor(
          config,
          queryFor(),
          compiledRoute('/en/blog/[...page]', 'listing'),
          ['tags', 'notes'],
          paginateFn,
          keepOrder,
          markedRelativeUrl,
        ),
      {
        message:
          '@repo/astro-intl: listingPaths for "/en/blog/[...page]" in view "index" got "tags", "notes", but that route row names collection "blog". Pass "blog" (or add it to the list).',
      },
    );
  });
});

describe('staticPathsFor', () => {
  it('returns nothing for an entry unpublished in that locale', () => {
    const paths = staticPathsFor(
      config,
      queryFor(),
      compiledRoute('/de/hervorgehoben/[...index]', 'static'),
    );
    assert.deepEqual(paths, []);
  });

  it('returns the written tail with no entry', () => {
    const paths = staticPathsFor(
      config,
      queryFor(),
      compiledRoute('/en/about/[...index]', 'static'),
    );
    assert.deepEqual(paths, [
      {
        params: { index: undefined },
        props: {
          locale: 'en',
          route: config.routes?.[0],
          path: 'about',
          entry: undefined,
        },
      },
    ]);
  });
});

describe('fallbackPathsFor', () => {
  it('points an untranslated leaf at the default-locale url and skips a published slug', () => {
    const paths = fallbackPathsFor(
      config,
      queryFor(),
      compiledRoute('/de/artikel/[slug]', 'fallback'),
      relativeUrl,
    );
    assert.deepEqual(
      paths.map((item) => item.params.slug),
      ['solo'],
    );
    assert.equal(paths[0]?.props.path, 'artikel/solo');
    assert.equal(paths[0]?.props.target, '/en/blog/solo');
    assert.equal(paths[0]?.props.entry, solo);
  });
});
