/**
 * Props for the view that is rendering, in both modes.
 * A prerendered view already has `Astro.props`. An on-demand view does not:
 * Astro skips `getStaticPaths`, and `Astro.props` is empty. This runs the view's
 * own `getStaticPaths` and returns the path whose params match the request.
 * No match returns `undefined`.
 */

import type {
  GetStaticPaths,
  GetStaticPathsResult,
  InferGetStaticPropsType,
  PaginateFunction,
  Params,
} from 'astro';

type ViewAstro<T extends GetStaticPaths> = {
  isPrerendered: boolean;
  props: InferGetStaticPropsType<T>;
  params: Params;
  routePattern: string;
};

type PaginateArgs = {
  pageSize?: number | undefined;
  params?: Params | undefined;
  props?: Record<string, unknown> | undefined;
  format?: ((url: string) => string) | undefined;
};

/**
 * `paginate` for an on-demand `getStaticPaths`.
 * Listing routes are `[...page]`, so page 1's `page` param is `undefined`.
 * `end` is the last item's index. `listingPaths` replaces `page.url`.
 */
function paginateRequest<T>(data: readonly T[], args: PaginateArgs = {}) {
  const pageSize = args.pageSize || 10;
  const additionalParams = args.params ?? {};
  const additionalProps = args.props ?? {};
  const formatUrl = args.format ?? ((url: string) => url);
  const total = data.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return Array.from({ length: lastPage }, (_, num) => {
    const currentPage = num + 1;
    const start = pageSize === Number.POSITIVE_INFINITY ? 0 : (currentPage - 1) * pageSize;
    const sliceEnd = Math.min(start + pageSize, total);
    const page = currentPage > 1 ? String(currentPage) : undefined;
    const href = (n: number) => formatUrl(n > 1 ? String(n) : '');
    return {
      params: { ...additionalParams, page },
      props: {
        ...additionalProps,
        page: {
          data: data.slice(start, sliceEnd),
          start,
          end: sliceEnd - 1,
          size: pageSize,
          total,
          currentPage,
          lastPage,
          url: {
            current: href(currentPage),
            next: currentPage === lastPage ? undefined : href(currentPage + 1),
            prev: currentPage === 1 ? undefined : href(currentPage - 1),
            first: currentPage === 1 ? undefined : href(1),
            last: currentPage === lastPage ? undefined : href(lastPage),
          },
        },
      },
    };
  });
}

export const requestPaginate = paginateRequest as PaginateFunction;

/** One trailing slash is ignored. `/` stays `/`. `undefined` and `''` are the same. */
function paramValue(value: string | undefined): string {
  if (value === undefined || value === '') return '';
  if (value.length > 1 && value.endsWith('/')) return value.slice(0, -1);
  return value;
}

function sameParams(pathParams: Params, requestParams: Params): boolean {
  const keys = new Set([...Object.keys(pathParams), ...Object.keys(requestParams)]);
  for (const key of keys) {
    if (paramValue(pathParams[key]) !== paramValue(requestParams[key])) return false;
  }
  return true;
}

export async function viewProps<T extends GetStaticPaths>(
  astro: ViewAstro<T>,
  getStaticPaths: T,
): Promise<InferGetStaticPropsType<T> | undefined> {
  if (astro.isPrerendered) return astro.props;
  const paths: GetStaticPathsResult = await getStaticPaths({
    paginate: requestPaginate,
    routePattern: astro.routePattern,
  });
  const found = paths.find((item) => sameParams(item.params, astro.params));
  if (!found?.props) return undefined;
  return found.props as InferGetStaticPropsType<T>;
}
