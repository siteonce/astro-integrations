/**
 * getStaticPaths rows for one injected route.
 * Paths come from the pairing index. The helpers do not read a content collection.
 */

import type { PaginateFunction } from 'astro';
import type { IntlConfig } from './define-intl.ts';
import { type ListingEntries, listingSelection, localePathKey } from './pairing.ts';
import { compilePath, listingTail, localeUrlPath, normalizeSlug, patternSection } from './path.ts';
import type { IntlQuery } from './query.ts';
import type { CompiledRoute } from './routing.ts';

type RelativeUrl = (locale: string, path?: string) => string;

type RouteRow = NonNullable<IntlConfig['routes']>[number];

/**
 * The compiled route for one pattern and kind.
 * One trailing slash is ignored. `/` stays `/`.
 */
export function routeFor(
  compiled: readonly CompiledRoute[],
  routePattern: string,
  kind: CompiledRoute['kind'],
): CompiledRoute {
  const pattern =
    routePattern.length > 1 && routePattern.endsWith('/')
      ? routePattern.slice(0, -1)
      : routePattern;
  const found = compiled.find((route) => route.pattern === pattern && route.kind === kind);
  if (!found) {
    throw new Error(`@repo/astro-intl: no injected ${kind} route for pattern "${routePattern}".`);
  }
  return found;
}

/** Leaf documents for one `{slug}` route. A fixed entry's written tail is left out. */
export function entryPathsFor<T>(
  config: IntlConfig,
  query: IntlQuery,
  route: CompiledRoute,
): {
  params: { slug: string };
  props: { locale: string; route: RouteRow; path: string; entry: T };
}[] {
  const row = routeRow(config, route);
  return entryDocuments(query, row, route.locale).map((doc) => ({
    params: { slug: doc.slug },
    props: {
      locale: route.locale,
      route: row,
      path: doc.path,
      entry: doc.entry as T,
    },
  }));
}

/**
 * One paginated row per listing tail pairing published for this route.
 * `path` is added per page. `page.url` comes from `relativeUrl`, not from `paginate`.
 * `paginate` shares one props object across pages.
 */
export function listingPathsFor<T>(
  config: IntlConfig,
  query: IntlQuery,
  route: CompiledRoute,
  paginate: PaginateFunction,
  listEntries: ListingEntries | undefined,
  relativeUrl: RelativeUrl,
) {
  const row = routeRow(config, route);
  const written = normalizeSlug(row.slug[route.locale] ?? '');
  if (row.pageSize === undefined) {
    throw new Error(`@repo/astro-intl: listing "${written}" in "${route.locale}" has no pageSize.`);
  }
  const localeField = config.collections?.[row.collection ?? '']?.localeField ?? 'locale';
  const entries = listingSelection(
    query.collections,
    row.collection ?? '',
    route.locale,
    localeField,
    listEntries,
  ) as readonly T[];
  const pages = paginate(entries, {
    pageSize: row.pageSize,
    props: { locale: route.locale, route: row },
  });
  const href = (k: number) => relativeUrl(route.locale, localeUrlPath(listingTail(written, k)));
  const results = pages.map((item) => {
    const page = item.props.page;
    const n = page.currentPage;
    const last = page.lastPage;
    return {
      params: item.params,
      props: {
        ...item.props,
        path: listingTail(written, n),
        page: {
          ...page,
          url: {
            current: href(n),
            prev: n > 1 ? href(n - 1) : undefined,
            next: n < last ? href(n + 1) : undefined,
            first: n > 1 ? href(1) : undefined,
            last: n < last ? href(last) : undefined,
          },
        },
      },
    };
  });
  for (const item of results) {
    const key = localePathKey(route.locale, item.props.path);
    if (!query.pairing.byLocaleTail.has(key)) {
      throw new Error(
        `@repo/astro-intl: listing "${written}" in "${route.locale}" emits page ${item.props.page.currentPage}, which pairing did not publish.`,
      );
    }
  }
  const published = publishedListingPages(query, route.locale, written);
  if (results.length !== published) {
    throw new Error(
      `@repo/astro-intl: listing "${written}" in "${route.locale}" emits ${results.length} pages; pairing published ${published}.`,
    );
  }
  return results;
}

/**
 * The one path for this static route, or none when that tail is unpublished.
 */
export function staticPathsFor<T>(
  config: IntlConfig,
  query: IntlQuery,
  route: CompiledRoute,
): {
  params: { index: undefined };
  props: { locale: string; route: RouteRow; path: string; entry: T | undefined };
}[] {
  const row = routeRow(config, route);
  const path = normalizeSlug(row.slug[route.locale] ?? '');
  const key = localePathKey(route.locale, path);
  const doc = query.pairing.byLocalePath.get(key);
  if (!doc && !query.pairing.byLocaleTail.has(key)) return [];
  return [
    {
      params: { index: undefined },
      props: {
        locale: route.locale,
        route: row,
        path,
        entry: doc ? (doc.entry as T) : undefined,
      },
    },
  ];
}

/**
 * Default-locale leaves this locale does not publish.
 * `path` is the tail the request asked for. `target` is the default-locale URL.
 */
export function fallbackPathsFor<T>(
  config: IntlConfig,
  query: IntlQuery,
  route: CompiledRoute,
  relativeUrl: RelativeUrl,
): {
  params: { slug: string };
  props: { locale: string; route: RouteRow; path: string; target: string; entry: T };
}[] {
  const row = routeRow(config, route);
  const section = patternSection(row.slug[route.locale] ?? '');
  if (!section) return [];
  const paths = [];
  for (const doc of entryDocuments(query, row, config.defaultLocale)) {
    if (query.getAlternatePaths(doc.entryId)[route.locale] !== undefined) continue;
    const path = entryPath(section, doc.slug);
    if (!path) continue;
    const key = localePathKey(route.locale, path);
    if (query.pairing.byLocalePath.has(key) || query.pairing.byLocaleTail.has(key)) continue;
    paths.push({
      params: { slug: doc.slug },
      props: {
        locale: route.locale,
        route: row,
        path,
        target: relativeUrl(config.defaultLocale, localeUrlPath(doc.path)),
        entry: doc.entry as T,
      },
    });
  }
  return paths;
}

function routeRow(config: IntlConfig, route: CompiledRoute): RouteRow {
  const row = config.routes?.[route.rowIndex];
  if (!row) {
    throw new Error(
      `@repo/astro-intl: no route row ${route.rowIndex} for pattern "${route.pattern}".`,
    );
  }
  return row;
}

function entryDocuments(query: IntlQuery, row: RouteRow, locale: string) {
  const section = patternSection(row.slug[locale] ?? '');
  const collection = row.collection;
  if (!section || !collection) return [];
  return query.pairing.routed.filter((doc) => {
    if (doc.locale !== locale || doc.collection !== collection) return false;
    const path = entryPath(section, doc.slug);
    return path !== undefined && doc.path === path;
  });
}

/** `undefined` when `slug` is not the one segment a `{slug}` row publishes. */
function entryPath(section: string, slug: string): string | undefined {
  if (slug === '' || slug.includes('/')) return undefined;
  return compilePath(section, slug);
}

/**
 * Pages pairing published for this listing, counted up from page 1 until a tail is missing.
 * Another row's tail that looks like a page number (`blog/2024`) is not counted.
 */
function publishedListingPages(query: IntlQuery, locale: string, written: string): number {
  let page = 0;
  while (query.pairing.byLocaleTail.has(localePathKey(locale, listingTail(written, page + 1)))) {
    page += 1;
  }
  return page;
}
