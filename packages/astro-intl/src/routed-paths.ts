/**
 * getStaticPaths rows for one injected route.
 * Paths come from the pairing index. The helpers do not read a content collection.
 */

import type { PaginateFunction } from 'astro';
import { fieldsFor, type IntlConfig } from './define-intl.ts';
import type { EntryOf } from './intl-register.ts';
import { type CollectionEntryLike, listingSelection, localePathKey } from './pairing.ts';
import {
  compilePath,
  listingPagePath,
  localeUrlPath,
  normalizeSlug,
  patternSection,
} from './path.ts';
import type { IntlQuery } from './query.ts';
import type { CompiledRoute } from './routing.ts';
import type { Compare } from './sorting.ts';

type RelativeUrl = (locale: string, path?: string) => string;

type RouteRow = NonNullable<IntlConfig['routes']>[number];

/** Locale handed to `sort` and `order`. */
export type ListingContext = { locale: string };

/**
 * `sort` builds a comparator. `order` reorders the whole list and must keep every entry.
 * One is required.
 */
export type ListingOrder<T> =
  | { sort: (context: ListingContext) => Compare<T>; order?: never }
  | { order: (entries: readonly T[], context: ListingContext) => readonly T[]; sort?: never };

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

/**
 * The collection the route row names, when that name is one of `collection`.
 * A missing collection fails too: a listing row can name none.
 */
function requireRouteCollection(
  helper: 'entryPaths' | 'listingPaths',
  route: CompiledRoute,
  row: RouteRow,
  collection: string | readonly string[],
): string {
  const named = row.collection;
  const names = typeof collection === 'string' ? [collection] : collection;
  if (named !== undefined && names.includes(named)) return named;
  const got = names.length === 0 ? 'nothing' : names.map((name) => `"${name}"`).join(', ');
  const where = `${helper} for "${route.pattern}" in view "${route.view}" got ${got}`;
  if (named === undefined) {
    throw new Error(
      `@repo/astro-intl: ${where}, but that route row names no collection. Name a collection on that route row.`,
    );
  }
  throw new Error(
    `@repo/astro-intl: ${where}, but that route row names collection "${named}". Pass "${named}" (or add it to the list).`,
  );
}

/**
 * Leaf documents for one `{slug}` route. A fixed entry's written tail is left out.
 * Throws when the route row's collection is not one of `collection`.
 */
export function entryPathsFor<C extends string>(
  config: IntlConfig,
  query: IntlQuery,
  route: CompiledRoute,
  collection: C | readonly C[],
): {
  params: { slug: string };
  props: { locale: string; route: RouteRow; path: string; entry: EntryOf<C> };
}[] {
  const row = routeRow(config, route);
  requireRouteCollection('entryPaths', route, row, collection);
  return entryDocuments(query, row, route.locale).map((doc) => ({
    params: { slug: doc.slug },
    props: {
      locale: route.locale,
      route: row,
      path: doc.path,
      // The check above backs this cast: the row's collection is one of the names passed.
      entry: doc.entry as EntryOf<C>,
    },
  }));
}

/**
 * Paginated rows for this listing route.
 * A `[...page]` route emits page 1. A `[page]` route emits pages 2 onward.
 * The locale filter selects the entries. `ordering` sorts or reorders that selection.
 * `path` is added per page. `page.url` comes from `relativeUrl`, not from `paginate`.
 * Page 1's `next` uses `pagination.slug`. Page 2's `prev` uses the row's `slug`.
 * `paginate` shares one props object across pages.
 * Throws when the route row's collection is not one of `collection`.
 */
export function listingPathsFor<C extends string>(
  config: IntlConfig,
  query: IntlQuery,
  route: CompiledRoute,
  collection: C | readonly C[],
  paginate: PaginateFunction,
  ordering: ListingOrder<EntryOf<C>>,
  relativeUrl: RelativeUrl,
) {
  const row = routeRow(config, route);
  const named = requireRouteCollection('listingPaths', route, row, collection);
  const pagination = row.pagination;
  const span = listingSpan(route.pattern);
  const written = normalizeSlug(row.slug[route.locale] ?? '');
  const pageTail = normalizeSlug(pagination?.slug[route.locale] ?? '');
  const label = span === 'rest' ? pageTail : written;
  if (!pagination) {
    throw new Error(`@repo/astro-intl: listing "${label}" in "${route.locale}" has no pagination.`);
  }
  const pathFor = (page: number) => listingPagePath(written, pageTail, page);
  const localeField = fieldsFor(config.collections, named).locale;
  // The check above backs this cast: `named` is one of the collections passed.
  const selected = listingSelection(
    query.collections,
    named,
    route.locale,
    localeField,
  ) as readonly EntryOf<C>[];
  const entries = listingOrder(selected, ordering, route.locale, label);
  const pages = paginate(entries, {
    pageSize: pagination.pageSize,
    props: { locale: route.locale, route: row },
  });
  const href = (page: number) => relativeUrl(route.locale, localeUrlPath(pathFor(page)));
  const results = pages
    .map((item) => {
      const page = item.props.page;
      const n = page.currentPage;
      const last = page.lastPage;
      return {
        params: item.params,
        props: {
          ...item.props,
          path: pathFor(n),
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
    })
    .filter((item) =>
      span === 'first' ? item.props.page.currentPage === 1 : item.props.page.currentPage > 1,
    );
  for (const item of results) {
    const key = localePathKey(route.locale, item.props.path);
    if (!query.pairing.byLocaleTail.has(key)) {
      throw new Error(
        `@repo/astro-intl: listing "${label}" in "${route.locale}" emits page ${item.props.page.currentPage}, which pairing did not publish.`,
      );
    }
  }
  const published = publishedListingPages(query, route.locale, pathFor, span);
  if (results.length !== published) {
    throw new Error(
      `@repo/astro-intl: listing "${label}" in "${route.locale}" emits ${results.length} pages; pairing published ${published}.`,
    );
  }
  return results;
}

/**
 * Applies `sort` or `order` to the locale selection.
 * Aborts when neither or both are set, or when the result is not a reorder of that selection.
 */
function listingOrder<T>(
  selected: readonly T[],
  ordering: ListingOrder<T>,
  locale: string,
  label: string,
): readonly T[] {
  const sort = ordering.sort;
  const order = ordering.order;
  const context: ListingContext = { locale };
  let ordered: readonly T[];
  if (typeof sort === 'function' && typeof order !== 'function') {
    ordered = selected.toSorted(sort(context));
  } else if (typeof order === 'function' && typeof sort !== 'function') {
    ordered = order(selected, context);
  } else if (typeof sort === 'function' && typeof order === 'function') {
    throw new Error(
      `@repo/astro-intl: listing "${label}" in "${locale}" sets both sort and order.`,
    );
  } else {
    throw new Error(`@repo/astro-intl: listing "${label}" in "${locale}" needs sort or order.`);
  }
  if (!Array.isArray(ordered) || !sameEntries(selected, ordered)) {
    throw new Error(
      `@repo/astro-intl: listing "${label}" in "${locale}" order must keep every entry and only reorder.`,
    );
  }
  return ordered;
}

/** Same entries, by object identity, with no duplicates. */
function sameEntries<T>(selected: readonly T[], ordered: readonly T[]): boolean {
  if (ordered.length !== selected.length) return false;
  const allowed = new Set(selected);
  const seen = new Set<T>();
  for (const entry of ordered) {
    if (!allowed.has(entry) || seen.has(entry)) return false;
    seen.add(entry);
  }
  return true;
}

/** `[...page]` is page 1. `[page]` is pages 2 onward. */
function listingSpan(pattern: string): 'first' | 'rest' {
  const leaf = pattern
    .split('/')
    .filter((part) => part.length > 0)
    .at(-1);
  if (leaf === '[...page]') return 'first';
  if (leaf === '[page]') return 'rest';
  throw new Error(`@repo/astro-intl: listing route "${pattern}" is not a page pattern.`);
}

/**
 * The one path for this static route, or none when that tail is unpublished.
 */
export function staticPathsFor(
  config: IntlConfig,
  query: IntlQuery,
  route: CompiledRoute,
): {
  params: { index: undefined };
  props: { locale: string; route: RouteRow; path: string; entry: CollectionEntryLike | undefined };
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
        entry: doc?.entry,
      },
    },
  ];
}

/**
 * Default-locale leaves this locale does not publish.
 * `path` is the tail the request asked for. `target` is the default-locale URL.
 */
export function fallbackPathsFor(
  config: IntlConfig,
  query: IntlQuery,
  route: CompiledRoute,
  relativeUrl: RelativeUrl,
): {
  params: { slug: string };
  props: {
    locale: string;
    route: RouteRow;
    path: string;
    target: string;
    entry: CollectionEntryLike | undefined;
  };
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
        entry: doc.entry,
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
 * Pages pairing published for this route, until a tail is missing.
 * The page-1 route counts page 1. The `{page}` route counts from page 2.
 * Another row's tail that looks like a page number (`blog/2024`) is not counted.
 */
function publishedListingPages(
  query: IntlQuery,
  locale: string,
  pathFor: (page: number) => string,
  span: 'first' | 'rest',
): number {
  if (span === 'first') {
    return query.pairing.byLocaleTail.has(localePathKey(locale, pathFor(1))) ? 1 : 0;
  }
  let count = 0;
  let page = 2;
  while (query.pairing.byLocaleTail.has(localePathKey(locale, pathFor(page)))) {
    count += 1;
    page += 1;
  }
  return count;
}
