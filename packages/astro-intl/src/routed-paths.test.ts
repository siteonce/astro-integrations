import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PaginateFunction } from 'astro';
import { defineIntl, type IntlConfig, type RouteConfig } from './define-intl.ts';
import type { CollectionEntryLike } from './pairing.ts';
import { createIntlQuery, type IntlQuery } from './query.ts';
import {
  entryPathsFor,
  listingPathsFor,
  missingPathsFor,
  routeFor,
  staticPathsFor,
} from './routed-paths.ts';
import { type CompiledRoute, compileRoutes } from './routing.ts';

function entry(astroId: string, data: Record<string, unknown>): CollectionEntryLike {
  return { id: astroId, collection: 'blog', data };
}

const pin = entry('pin-en', { id: 'pin', locale: 'en', slug: 'pin-slug' });
const alphaEn = entry('alpha-en', { id: 'alpha', locale: 'en', slug: 'alpha' });
const alphaDe = entry('alpha-de', { id: 'alpha', locale: 'de', slug: 'anders' });
const solo = entry('solo-en', { id: 'solo', locale: 'en', slug: 'solo' });
const mehr = entry('mehr-de', { id: 'mehr', locale: 'de', slug: 'mehr' });
const clash = entry('clash-en', { id: 'clash', locale: 'en', slug: 'mehr' });

const config = defineIntl({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  routing: { prefixDefaultLocale: true },
  routes: [
    { slug: { en: 'about', de: 'ueber' }, page: 'about' },
    {
      slug: { en: 'featured', de: 'hervorgehoben' },
      page: 'featured',
      collection: 'blog',
      entry: 'pin',
    },
    { slug: { en: 'blog', de: 'artikel' }, page: 'index', collection: 'blog', pageSize: 1 },
    {
      slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
      page: 'post',
      collection: 'blog',
      missingPage: 'missing',
    },
  ],
  collections: { blog: { slugField: 'slug' } },
});

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

function paginate(
  data: readonly unknown[],
  args: { pageSize: number; props: { locale: string; route: RouteConfig } },
) {
  const lastPage = Math.max(1, Math.ceil(data.length / args.pageSize));
  return Array.from({ length: lastPage }, (_, index) => {
    const currentPage = index + 1;
    return {
      params: { page: currentPage === 1 ? undefined : String(currentPage) },
      props: {
        locale: args.props.locale,
        route: args.props.route,
        page: { currentPage },
      },
    };
  });
}

const paginateFn = paginate as unknown as PaginateFunction;

function compiledRoute(pattern: string, kind: CompiledRoute['kind']): CompiledRoute {
  return routeFor(compileRoutes(config), pattern, kind);
}

describe('routeFor', () => {
  it('resolves one pattern to entry or missing by kind', () => {
    const compiled = compileRoutes(config);
    assert.equal(routeFor(compiled, '/de/artikel/[slug]', 'entry').page, 'post');
    assert.equal(routeFor(compiled, '/de/artikel/[slug]/', 'missing').page, 'missing');
    assert.throws(() => routeFor(compiled, '/nope', 'entry'), {
      message: '@repo/astro-intl: no injected entry route for pattern "/nope".',
    });
  });

  it('does not strip the root pattern', () => {
    const root = defineIntl({
      locales: ['en'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: false },
      routes: [{ slug: { en: '/' }, page: 'home' }],
    });
    assert.equal(routeFor(compileRoutes(root), '/', 'static').pattern, '/');
  });
});

describe('entryPathsFor', () => {
  it('returns that locale’s leaves and leaves out the fixed entry', () => {
    const query = queryFor();
    const en = entryPathsFor<CollectionEntryLike>(
      config,
      query,
      compiledRoute('/en/blog/[slug]', 'entry'),
    );
    assert.deepEqual(
      en.map((item) => item.props.path),
      ['blog/alpha', 'blog/solo', 'blog/mehr'],
    );
    assert.deepEqual(
      en.map((item) => item.params.slug),
      ['alpha', 'solo', 'mehr'],
    );
    const de = entryPathsFor(config, query, compiledRoute('/de/artikel/[slug]', 'entry'));
    assert.deepEqual(
      de.map((item) => item.props.path),
      ['artikel/anders', 'artikel/mehr'],
    );
  });
});

describe('listingPathsFor', () => {
  it('uses the written tail on page 1 and the page number after it', () => {
    const query = queryFor();
    const pages = listingPathsFor(
      config,
      query,
      compiledRoute('/en/blog/[...page]', 'listing'),
      paginateFn,
      undefined,
    );
    assert.deepEqual(
      pages.map((item) => item.props.path),
      ['blog', 'blog/2', 'blog/3', 'blog/4'],
    );
    assert.equal(pages[0]?.params.page, undefined);
    assert.equal(pages[1]?.params.page, '2');
  });

  it('numbers a root listing from the bare page', () => {
    const home = defineIntl({
      locales: ['en', 'de'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: false },
      routes: [{ slug: { en: '/', de: '/' }, page: 'home', collection: 'posts', pageSize: 1 }],
      collections: { posts: {} },
    });
    const posts = [
      { id: 'a', collection: 'posts', data: { id: 'a', locale: 'en' } },
      { id: 'b', collection: 'posts', data: { id: 'b', locale: 'en' } },
    ];
    const query = createIntlQuery({
      config: home,
      collections: { posts },
      getAbsoluteLocaleUrl: (locale, path = '') => `https://example.com/${locale}/${path}`,
    });
    const pages = listingPathsFor(
      home,
      query,
      routeFor(compileRoutes(home), '/[...page]', 'listing'),
      paginateFn,
      undefined,
    );
    assert.deepEqual(
      pages.map((item) => item.props.path),
      ['/', '2'],
    );
  });

  it('does not count another row’s numeric tail under the listing', () => {
    const archive = defineIntl({
      locales: ['en'],
      defaultLocale: 'en',
      routing: { prefixDefaultLocale: true },
      routes: [
        { slug: { en: 'blog' }, page: 'index', collection: 'blog', pageSize: 10 },
        { slug: { en: 'blog/2024' }, page: 'archive' },
      ],
      collections: { blog: {} },
    });
    const query = createIntlQuery({
      config: archive,
      collections: { blog: [entry('a-en', { id: 'a', locale: 'en' })] },
      getAbsoluteLocaleUrl: () => '',
    });
    const pages = listingPathsFor(
      archive,
      query,
      routeFor(compileRoutes(archive), '/en/blog/[...page]', 'listing'),
      paginateFn,
      undefined,
    );
    assert.deepEqual(
      pages.map((item) => item.props.path),
      ['blog'],
    );
  });

  it('throws when paginate emits a page pairing did not publish', () => {
    const extra = ((
      data: readonly unknown[],
      args: { pageSize: number; props: { locale: string; route: RouteConfig } },
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
          compiledRoute('/en/blog/[...page]', 'listing'),
          extra,
          undefined,
        ),
      /listing "blog" in "en" emits page 5, which pairing did not publish/,
    );
  });
});

describe('staticPathsFor', () => {
  it('returns nothing for an entry unpublished in that locale', () => {
    const paths = staticPathsFor(config, queryFor(), compiledRoute('/de/hervorgehoben', 'static'));
    assert.deepEqual(paths, []);
  });

  it('returns the written tail with no entry', () => {
    const paths = staticPathsFor<CollectionEntryLike>(
      config,
      queryFor(),
      compiledRoute('/en/about', 'static'),
    );
    assert.deepEqual(paths, [
      {
        params: {},
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

describe('missingPathsFor', () => {
  it('points an untranslated leaf at the default-locale url and skips a published slug', () => {
    const paths = missingPathsFor<CollectionEntryLike>(
      config,
      queryFor(),
      compiledRoute('/de/artikel/[slug]', 'missing'),
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
