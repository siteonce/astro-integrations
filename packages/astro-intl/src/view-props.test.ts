import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { GetStaticPathsOptions, PaginateFunction } from 'astro';
import { requestPaginate, viewProps } from './view-props.ts';

const require = createRequire(import.meta.url);

type AstroLike<Props> = {
  isPrerendered: boolean;
  props: Props;
  params: Record<string, string | undefined>;
  routePattern: string;
};

describe('viewProps', () => {
  it('returns Astro.props when the view is prerendered and does not call getStaticPaths', async () => {
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

  it('returns the props of the matching entry slug', async () => {
    const hello = { locale: 'en', path: 'blog/hello' };
    const other = { locale: 'en', path: 'blog/other' };
    const result = await viewProps(
      {
        isPrerendered: false,
        props: hello,
        params: { slug: 'hello' },
        routePattern: '/en/blog/[slug]',
      },
      () => [
        { params: { slug: 'hello' }, props: hello },
        { params: { slug: 'other' }, props: other },
      ],
    );
    assert.equal(result, hello);
  });

  it('returns undefined when no params match', async () => {
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

  it('returns the written tail when index is undefined or empty', async () => {
    const home = { locale: 'en', path: '/' };
    const getStaticPaths = () => [{ params: { index: undefined }, props: home }];
    const written = await viewProps(
      {
        isPrerendered: false,
        props: home,
        params: { index: undefined },
        routePattern: '/en/[...index]',
      },
      getStaticPaths,
    );
    const empty = await viewProps(
      {
        isPrerendered: false,
        props: home,
        params: { index: '' },
        routePattern: '/en/[...index]',
      },
      getStaticPaths,
    );
    assert.equal(written, home);
    assert.equal(empty, home);
  });

  it('returns listing pages 1 and 2, and undefined for page "1"', async () => {
    const posts = ['one', 'two'];
    const getStaticPaths = ({ paginate }: GetStaticPathsOptions) =>
      paginate(posts, { pageSize: 1, props: { locale: 'en' } });
    const sample = getStaticPaths({
      paginate: requestPaginate,
      routePattern: '/en/blog/[...page]',
    })[0];
    assert.ok(sample);
    const astro = (page: string | undefined): AstroLike<typeof sample.props> => ({
      isPrerendered: false,
      props: sample.props,
      params: { page },
      routePattern: '/en/blog/[...page]',
    });

    const page1 = await viewProps(astro(undefined), getStaticPaths);
    const page2 = await viewProps(astro('2'), getStaticPaths);
    const numberedOne = await viewProps(astro('1'), getStaticPaths);

    assert.deepEqual(page1?.page.data, ['one']);
    assert.equal(page1?.page.currentPage, 1);
    assert.deepEqual(page2?.page.data, ['two']);
    assert.equal(page2?.page.currentPage, 2);
    assert.equal(numberedOne, undefined);
  });
});

describe('requestPaginate', () => {
  it('matches Astro paginate apart from url', async () => {
    const astroJson = require.resolve('astro/package.json');
    const paginateHref = pathToFileURL(
      join(dirname(astroJson), 'dist/core/render/paginate.js'),
    ).href;
    const { generatePaginateFunction } = (await import(paginateHref)) as {
      generatePaginateFunction: (
        route: { params: string[]; segments: unknown[] },
        base: string,
        trailingSlash: string,
      ) => PaginateFunction;
    };
    const astroPaginate = generatePaginateFunction(
      { params: ['...page'], segments: [] },
      '/',
      'always',
    );
    const items = ['a', 'b', 'c', 'd', 'e'];
    const args = { pageSize: 2, props: { locale: 'en' } };
    const dropUrl = (rows: ReturnType<PaginateFunction>) =>
      rows.map(({ params, props }) => ({
        params,
        props: { ...props, page: { ...props.page, url: undefined } },
      }));

    assert.deepEqual(dropUrl(requestPaginate(items, args)), dropUrl(astroPaginate(items, args)));
  });
});
