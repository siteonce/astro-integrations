import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';
import { viewProps } from '@siteonce/astro-intl';
import type { GetStaticPathsOptions } from 'astro';
import {
  astroPaginate,
  intlHooks,
  nodeAdapter,
  renderedViews,
  renderingConfig,
  resolvedRoute,
  siteRootRoute,
  writeViews,
} from './astro.ts';

async function prepare(t: TestContext, viewRendering?: 'build' | 'request') {
  const hooks = await intlHooks(t, renderingConfig(viewRendering));
  await writeViews(hooks.root, ['about', 'post', 'blog', 'missing']);
  return hooks;
}

/**
 * Same rows with no `prerender` option.
 * That is omitted `viewRendering`, `'build'`, and `'request'` under `astro dev`.
 */
const prerenderedRoutes = [
  { pattern: '/en/about/[...index]', view: 'about.astro' },
  { pattern: '/de/ueber/[...index]', view: 'about.astro' },
  { pattern: '/en/blog/[slug]', view: 'post.astro' },
  { pattern: '/de/artikel/[slug]', view: 'post.astro' },
  { pattern: '/de/artikel/[slug]', view: 'missing.astro' },
  { pattern: '/en/blog/[...page]', view: 'blog.astro' },
  { pattern: '/de/artikel/[...page]', view: 'blog.astro' },
  { pattern: '/en/blog/[page]', view: 'blog.astro' },
  { pattern: '/de/artikel/[page]', view: 'blog.astro' },
];

describe('view rendering', () => {
  it('injects static, {slug}, and listing routes on demand and leaves fallback routes prerendered', async (t) => {
    const hooks = await prepare(t, 'request');
    await hooks.setup({ adapter: nodeAdapter });

    assert.deepEqual(renderedViews(hooks.root, hooks.injected), [
      { pattern: '/en/about/[...index]', view: 'about.astro', prerender: false },
      { pattern: '/de/ueber/[...index]', view: 'about.astro', prerender: false },
      { pattern: '/en/blog/[slug]', view: 'post.astro', prerender: false },
      { pattern: '/de/artikel/[slug]', view: 'post.astro', prerender: false },
      { pattern: '/de/artikel/[slug]', view: 'missing.astro' },
      { pattern: '/en/blog/[...page]', view: 'blog.astro', prerender: false },
      { pattern: '/de/artikel/[...page]', view: 'blog.astro', prerender: false },
      { pattern: '/en/blog/[page]', view: 'blog.astro', prerender: false },
      { pattern: '/de/artikel/[page]', view: 'blog.astro', prerender: false },
    ]);
  });

  it('sets no prerender option when viewRendering is build', async (t) => {
    const hooks = await prepare(t, 'build');
    await hooks.setup();

    const views = renderedViews(hooks.root, hooks.injected);
    assert.ok(views.length > 0);
    assert.deepEqual(views, prerenderedRoutes);
  });

  it('sets no prerender option when viewRendering is omitted', async (t) => {
    const hooks = await prepare(t);
    await hooks.setup();

    const views = renderedViews(hooks.root, hooks.injected);
    assert.ok(views.length > 0);
    assert.deepEqual(views, prerenderedRoutes);
  });

  it('treats viewRendering request as build under astro dev', async (t) => {
    const hooks = await prepare(t, 'request');
    await hooks.setup({ command: 'dev' });

    const views = renderedViews(hooks.root, hooks.injected);
    assert.equal(hooks.injected.length, views.length);
    assert.equal(
      hooks.injected.some((route) => Object.hasOwn(route, 'prerender')),
      false,
    );
    assert.deepEqual(views, prerenderedRoutes);
  });

  it('does not refuse an on-demand {page} route beside {slug} under astro dev', async (t) => {
    const hooks = await prepare(t, 'request');
    await hooks.setup({ command: 'dev' });
    const entrypoint = (pattern: string) => {
      const route = hooks.injected.find((item) => item.pattern === pattern);
      assert.ok(route, pattern);
      return String(route.entrypoint);
    };

    // Both routes are on demand. Under astro dev the clash is not checked.
    await hooks.routesResolved([
      resolvedRoute({
        entrypoint: entrypoint('/en/blog/[slug]'),
        pattern: '/en/blog/[slug]',
        isPrerendered: false,
      }),
      resolvedRoute({
        entrypoint: entrypoint('/en/blog/[page]'),
        pattern: '/en/blog/[page]',
        isPrerendered: false,
      }),
      siteRootRoute(),
    ]);
    assert.equal(hooks.error, undefined);
  });

  it('returns Astro.props when the view is prerendered', async () => {
    const props = { locale: 'en', path: 'blog/hello' };
    const getStaticPaths = (): { params: { slug: string }; props: typeof props }[] => {
      throw new Error('getStaticPaths should not run');
    };
    const result = await viewProps(
      {
        isPrerendered: true,
        props,
        params: { slug: 'hello' },
        routePattern: '/en/blog/[slug]',
      },
      getStaticPaths,
    );
    assert.equal(result, props);
  });

  it('returns the props of the path whose params match the request', async () => {
    const hello = { locale: 'en', path: 'blog/hello' };
    const other = { locale: 'en', path: 'blog/other' };
    let routePattern: string | undefined;
    const getStaticPaths = (options: GetStaticPathsOptions) => {
      routePattern = options.routePattern;
      return [
        { params: { slug: 'hello' }, props: hello },
        { params: { slug: 'other' }, props: other },
      ];
    };
    const result = await viewProps(
      {
        isPrerendered: false,
        props: { locale: 'de', path: 'ignored' },
        params: { slug: 'hello' },
        routePattern: '/en/blog/[slug]',
      },
      getStaticPaths,
    );
    assert.equal(routePattern, '/en/blog/[slug]');
    assert.equal(result, hello);
  });

  it('returns undefined when no path matches the request', async () => {
    const hello = { locale: 'en', path: 'blog/hello' };
    const result = await viewProps(
      {
        isPrerendered: false,
        props: hello,
        params: { slug: 'missing' },
        routePattern: '/en/blog/[slug]',
      },
      () => [{ params: { slug: 'hello' }, props: hello }],
    );
    assert.equal(result, undefined);
  });

  it('returns the written tail when the spread param is undefined or empty', async () => {
    const home = { locale: 'en', path: '/' };
    const getStaticPaths = () => [{ params: { index: undefined }, props: home }];
    const written = await viewProps(
      {
        isPrerendered: false,
        props: { locale: 'de', path: 'ignored' },
        params: { index: undefined },
        routePattern: '/en/[...index]',
      },
      getStaticPaths,
    );
    const empty = await viewProps(
      {
        isPrerendered: false,
        props: { locale: 'de', path: 'ignored' },
        params: { index: '' },
        routePattern: '/en/[...index]',
      },
      getStaticPaths,
    );
    assert.equal(written, home);
    assert.equal(empty, home);
  });

  it('returns page 1 for an empty page param, page 2 for "2", and nothing for "1"', async () => {
    const posts = ['one', 'two'];
    let routePattern: string | undefined;
    const getStaticPaths = ({ paginate, routePattern: pattern }: GetStaticPathsOptions) => {
      routePattern = pattern;
      return paginate(posts, { pageSize: 1, props: { locale: 'en' } });
    };
    const demand = (page: string | undefined) =>
      viewProps(
        {
          isPrerendered: false,
          props: {
            locale: 'en',
            page: {
              data: ['ignored'],
              start: 0,
              end: 0,
              size: 1,
              total: 1,
              currentPage: 0,
              lastPage: 1,
              url: {
                current: '/ignored',
                prev: undefined,
                next: undefined,
                first: undefined,
                last: undefined,
              },
            },
          },
          params: { page },
          routePattern: '/en/blog/[...page]',
        },
        getStaticPaths,
      );

    const page1 = await demand(undefined);
    const page2 = await demand('2');
    const numberedOne = await demand('1');

    assert.equal(routePattern, '/en/blog/[...page]');
    assert.deepEqual(page1?.page.data, ['one']);
    assert.equal(page1?.page.currentPage, 1);
    assert.deepEqual(page2?.page.data, ['two']);
    assert.equal(page2?.page.currentPage, 2);
    assert.equal(numberedOne, undefined);
  });

  it('returns the same listing page as Astro paginate, apart from the page url', async () => {
    // Five entries at page size 2. Page 1's intl url is empty; later pages use the number.
    // Astro's paginate, given no route segments, uses `/`.
    const items = ['a', 'b', 'c', 'd', 'e'];
    const args = { pageSize: 2, props: { locale: 'en' } };
    const astroPages = (await astroPaginate('...page'))(items, args);
    const ignored = {
      locale: 'ignored',
      page: {
        data: ['ignored'],
        start: 0,
        end: 0,
        size: 0,
        total: 0,
        currentPage: 0,
        lastPage: 0,
        url: {
          current: '/ignored',
          prev: undefined,
          next: undefined,
          first: undefined,
          last: undefined,
        },
      },
    };
    const getStaticPaths = ({ paginate }: GetStaticPathsOptions) => paginate(items, args);
    const demand = (page: string | undefined) =>
      viewProps(
        {
          isPrerendered: false,
          props: ignored,
          params: { page },
          routePattern: '/en/blog/[...page]',
        },
        getStaticPaths,
      );

    const pages = [
      {
        param: undefined,
        data: ['a', 'b'],
        start: 0,
        end: 1,
        currentPage: 1,
        url: { current: '', next: '2', prev: undefined, first: undefined, last: '3' },
        astroUrl: { current: '/', next: '/', prev: undefined, first: undefined, last: '/' },
      },
      {
        param: '2',
        data: ['c', 'd'],
        start: 2,
        end: 3,
        currentPage: 2,
        url: { current: '2', next: '3', prev: '', first: '', last: '3' },
        astroUrl: { current: '/', next: '/', prev: '/', first: '/', last: '/' },
      },
      {
        param: '3',
        data: ['e'],
        start: 4,
        end: 4,
        currentPage: 3,
        url: { current: '3', next: undefined, prev: '2', first: '', last: undefined },
        astroUrl: { current: '/', next: undefined, prev: '/', first: '/', last: undefined },
      },
    ];

    assert.equal(astroPages.length, pages.length);
    for (const [index, spec] of pages.entries()) {
      const props = await demand(spec.param);
      const astro = astroPages[index];
      assert.ok(props);
      assert.ok(astro);
      const body = {
        data: spec.data,
        start: spec.start,
        end: spec.end,
        size: 2,
        total: 5,
        currentPage: spec.currentPage,
        lastPage: 3,
      };
      assert.deepEqual(props, { locale: 'en', page: { ...body, url: spec.url } });
      assert.deepEqual(astro.props, { locale: 'en', page: { ...body, url: spec.astroUrl } });
    }

    // Astro keeps `lang` on the path. The request carries it, so the page matches.
    const langItems = ['a', 'b'];
    const langArgs = { params: { lang: 'en' } };
    const langPaths = ({ paginate }: GetStaticPathsOptions) => paginate(langItems, langArgs);
    const langAstro = (await astroPaginate('...page'))(langItems, langArgs);
    const langProps = await viewProps(
      {
        isPrerendered: false,
        props: ignored,
        params: { lang: 'en', page: undefined },
        routePattern: '/en/blog/[...page]',
      },
      langPaths,
    );
    const langPage = {
      data: ['a', 'b'],
      start: 0,
      end: 1,
      size: 10,
      total: 2,
      currentPage: 1,
      lastPage: 1,
    };
    const emptyUrl = {
      current: '',
      next: undefined,
      prev: undefined,
      first: undefined,
      last: undefined,
    };
    assert.deepEqual(langAstro[0]?.params, { lang: 'en', page: undefined });
    assert.deepEqual(langProps, { page: { ...langPage, url: emptyUrl } });
    assert.deepEqual(langAstro[0]?.props, {
      page: { ...langPage, url: { ...emptyUrl, current: '/' } },
    });

    // pageSize Infinity is one page of every item, starting at 0.
    const infPaths = ({ paginate }: GetStaticPathsOptions) =>
      paginate(items, { pageSize: Infinity });
    const infAstro = (await astroPaginate('...page'))(items, { pageSize: Infinity });
    const infProps = await viewProps(
      {
        isPrerendered: false,
        props: ignored,
        params: { page: undefined },
        routePattern: '/en/blog/[...page]',
      },
      infPaths,
    );
    const infPage = {
      data: ['a', 'b', 'c', 'd', 'e'],
      start: 0,
      end: 4,
      size: Infinity,
      total: 5,
      currentPage: 1,
      lastPage: 1,
    };
    assert.deepEqual(infProps, { page: { ...infPage, url: emptyUrl } });
    assert.deepEqual(infAstro[0]?.props, {
      page: { ...infPage, url: { ...emptyUrl, current: '/' } },
    });
  });
});
