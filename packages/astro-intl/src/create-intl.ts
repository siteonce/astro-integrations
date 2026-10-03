/**
 * Binds page helpers to one authored intl config.
 * Parsing runs once, when this is called. Collections load and pair on the first
 * helper call. Concurrent first calls share that load. Each call returns its own
 * pairing; two factories do not share state.
 * `options.loaders` replaces the content and locale-url reads. Tests pass them.
 * Omitted, the first load uses `astro:content` and `astro:i18n`.
 * `entryPaths` and `listingPaths` take one translated collection, or a list of them.
 * The route row must name one of those. `staticPaths` and `fallbackPaths` take none.
 * `getRelativeEntryUrl` and `getAbsoluteEntryUrl` return undefined when that
 * entry publishes no URL in the asked locale. `localeSwitcherLinks` takes the
 * current public path. The current locale, and a locale with no sibling, have no href.
 */

import type { PaginateFunction } from 'astro';
import {
  type IntlConfigInput,
  missingContentCollection,
  parseIntlConfig,
  translatedFields,
  translatedNames,
  untranslatedNames,
} from './define-intl.ts';
import { resolveEntryId } from './entry-id.ts';
import type { EntryOf, Locale } from './intl-register.ts';
import {
  type LocaleSwitcherLink,
  localeSwitcherLinks as switcherLinks,
} from './locale-switcher.ts';
import type { CollectionEntryLike } from './pairing.ts';
import { localeUrlPath } from './path.ts';
import { createIntlQuery, type IntlQuery } from './query.ts';
import { assertRelations, type Relation, resolveRelation } from './relation.ts';
import {
  entryPathsFor,
  fallbackPathsFor,
  type ListingOrder,
  listingPathsFor,
  routeFor,
  staticPathsFor,
} from './routed-paths.ts';
import { type CompiledRoute, compileRoutes } from './routing.ts';

/** Content and locale-url reads. Production uses `astro:content` and `astro:i18n`. Intl does not call a CMS. */
export type IntlLoaders = {
  getCollection: (name: string) => Promise<CollectionEntryLike[]>;
  getAbsoluteLocaleUrl: (locale: string, path?: string) => string;
  getRelativeLocaleUrl: (locale: string, path?: string) => string;
};

type CreateIntlInput<Translated extends string> = Omit<IntlConfigInput, 'collections'> & {
  collections?: {
    translated?: Translated[];
    untranslated?: NonNullable<IntlConfigInput['collections']>['untranslated'];
    fields?: NonNullable<IntlConfigInput['collections']>['fields'];
  };
};

async function defaultLoaders(): Promise<IntlLoaders> {
  const { getCollection } = await import('astro:content');
  const { getAbsoluteLocaleUrl, getRelativeLocaleUrl } = await import('astro:i18n');
  return {
    getCollection: async (name) => (await getCollection(name)) as CollectionEntryLike[],
    getAbsoluteLocaleUrl,
    getRelativeLocaleUrl,
  };
}

async function loadNamedCollection(
  loaders: IntlLoaders,
  name: string,
  list: 'translated' | 'untranslated',
): Promise<CollectionEntryLike[]> {
  try {
    return await loaders.getCollection(name);
  } catch {
    throw new Error(`@repo/astro-intl: ${missingContentCollection(list, name)}.`);
  }
}

export function createIntl<const Translated extends string = never>(
  input: CreateIntlInput<Translated>,
  options?: { loaders?: IntlLoaders },
) {
  const config = parseIntlConfig(input);
  const spec = config.collections;
  const loadersOverride = options?.loaders;
  let loadersPending: Promise<IntlLoaders> | undefined;
  let pending: Promise<IntlQuery> | undefined;
  let routes: CompiledRoute[] | undefined;

  function resolveLoaders(): Promise<IntlLoaders> {
    loadersPending ??=
      loadersOverride !== undefined ? Promise.resolve(loadersOverride) : defaultLoaders();
    return loadersPending;
  }

  function translatedCollection(name: string) {
    const fields = translatedFields(spec)[name];
    if (!fields) {
      throw new Error(`@repo/astro-intl: collection "${name}" is not in collections.translated.`);
    }
    return fields;
  }

  /** Pairing id for a relation or a collection entry. Config mistakes throw. */
  function entryIdOf(ref: Relation | CollectionEntryLike): string {
    if ('intlRelationTarget' in ref) {
      translatedCollection(ref.intlRelationTarget);
      return `${ref.intlRelationTarget}/${ref.id}`;
    }
    if (!ref.collection) {
      throw new Error('@repo/astro-intl: entry has no collection.');
    }
    const fields = translatedCollection(ref.collection);
    return resolveEntryId(ref.collection, ref.data, fields.id);
  }

  function compiledRoutes(): CompiledRoute[] {
    routes ??= compileRoutes(config);
    return routes;
  }

  async function load(): Promise<IntlQuery> {
    // An override is already a value. Awaiting it would defer the first collection read.
    const pendingLoaders = resolveLoaders();
    const loaders = loadersOverride ?? (await pendingLoaders);
    const collections: Record<string, CollectionEntryLike[]> = {};
    for (const name of translatedNames(spec)) {
      collections[name] = await loadNamedCollection(loaders, name, 'translated');
    }
    const untranslated = new Set(untranslatedNames(spec));
    for (const name of untranslated) {
      collections[name] = await loadNamedCollection(loaders, name, 'untranslated');
    }
    const query = createIntlQuery({
      config,
      collections,
      getAbsoluteLocaleUrl: loaders.getAbsoluteLocaleUrl,
    });
    assertRelations({
      locales: config.locales,
      translated: translatedFields(spec),
      untranslated,
      collections,
      getContentById: query.getContentById,
    });
    for (const warning of query.pairing.warnings) {
      console.warn(`@repo/astro-intl: ${warning}`);
    }
    return query;
  }

  function loadQuery(): Promise<IntlQuery> {
    pending ??= load();
    return pending;
  }

  async function getRelated<C extends string>(
    locale: Locale,
    rel: Relation<C>,
  ): Promise<EntryOf<C>> {
    const query = await loadQuery();
    // The loaded value is the target collection's entry. The app's register types it.
    return resolveRelation(locale, rel, {
      translated: translatedFields(spec),
      untranslated: new Set(untranslatedNames(spec)),
      collections: query.collections,
      getContentById: query.getContentById,
    }) as EntryOf<C>;
  }

  async function getContentByPath(locale: Locale, path: string) {
    return (await loadQuery()).getContentByPath(locale, path);
  }

  async function getAlternatePaths(entryId: string) {
    return (await loadQuery()).getAlternatePaths(entryId);
  }

  async function getAlternatePathsForPath(locale: Locale, path: string) {
    return (await loadQuery()).getAlternatePathsForPath(locale, path);
  }

  async function getPairedSlugs() {
    return (await loadQuery()).getPairedSlugs();
  }

  async function getSitemapEntries() {
    return (await loadQuery()).getSitemapEntries();
  }

  /** Alternate links for one public path, plus `x-default` when the default locale has a tail. */
  async function hreflangLinks(locale: Locale, path: string) {
    return (await loadQuery()).hreflangLinks(locale, path);
  }

  /**
   * Leaf paths for the injected `{slug}` route at `routePattern`.
   * `collection` is one translated collection, or a list when one view serves
   * several rows. The route row must name one of them.
   */
  async function entryPaths<C extends Translated>(
    routePattern: string,
    collection: C | readonly C[],
  ) {
    const query = await loadQuery();
    const route = routeFor(compiledRoutes(), routePattern, 'entry');
    return entryPathsFor(config, query, route, collection);
  }

  /**
   * Paginated paths for the injected listing route at `routePattern`.
   * `collection` is one translated collection, or a list when one view serves
   * several rows. The route row must name one of them.
   * `sort` compares two entries. `order` reorders the whole list and must keep every entry.
   * One is required. Both receive the route's locale.
   */
  async function listingPaths<C extends Translated>(
    routePattern: string,
    collection: C | readonly C[],
    paginate: PaginateFunction,
    ordering: ListingOrder<EntryOf<C>>,
  ) {
    const query = await loadQuery();
    const route = routeFor(compiledRoutes(), routePattern, 'listing');
    const { getRelativeLocaleUrl } = await resolveLoaders();
    return listingPathsFor(
      config,
      query,
      route,
      collection,
      paginate,
      ordering,
      getRelativeLocaleUrl,
    );
  }

  /**
   * `getStaticPaths` rows for the injected static route at `routePattern`.
   * `[]` when the locale does not publish it.
   * `entry` is a translated collection's entry, or undefined when the tail names none.
   */
  async function staticPaths(routePattern: string) {
    const query = await loadQuery();
    const route = routeFor(compiledRoutes(), routePattern, 'static');
    return staticPathsFor(config, query, route).map((row) => ({
      params: row.params,
      props: {
        ...row.props,
        // Pairing only holds translated entries.
        entry: row.props.entry as EntryOf<Translated> | undefined,
      },
    }));
  }

  /**
   * Missing-translation paths for the injected route at `routePattern`.
   * `entry` is the default-locale entry from that row's translated collection.
   */
  async function fallbackPaths(routePattern: string) {
    const query = await loadQuery();
    const route = routeFor(compiledRoutes(), routePattern, 'fallback');
    const { getRelativeLocaleUrl } = await resolveLoaders();
    return fallbackPathsFor(config, query, route, getRelativeLocaleUrl).map((row) => ({
      params: row.params,
      props: {
        ...row.props,
        // Pairing only holds translated entries, and each fallback path has one.
        entry: row.props.entry as EntryOf<Translated>,
      },
    }));
  }

  async function publishedPath(
    locale: Locale,
    ref: Relation | CollectionEntryLike,
  ): Promise<string | undefined> {
    const entryId = entryIdOf(ref);
    const paths = (await loadQuery()).getAlternatePaths(entryId);
    return paths[locale];
  }

  async function getRelativeEntryUrl(
    locale: Locale,
    ref: Relation | CollectionEntryLike,
  ): Promise<string | undefined> {
    const path = await publishedPath(locale, ref);
    if (path === undefined) return undefined;
    const { getRelativeLocaleUrl } = await resolveLoaders();
    return getRelativeLocaleUrl(locale, localeUrlPath(path));
  }

  async function getAbsoluteEntryUrl(
    locale: Locale,
    ref: Relation | CollectionEntryLike,
  ): Promise<string | undefined> {
    const path = await publishedPath(locale, ref);
    if (path === undefined) return undefined;
    const { getAbsoluteLocaleUrl } = await resolveLoaders();
    return getAbsoluteLocaleUrl(locale, localeUrlPath(path));
  }

  async function localeSwitcherLinks(locale: Locale, path: string): Promise<LocaleSwitcherLink[]> {
    const query = await loadQuery();
    const { getRelativeLocaleUrl } = await resolveLoaders();
    return switcherLinks(
      config.locales,
      locale,
      query.getAlternatePathsForPath(locale, path),
      getRelativeLocaleUrl,
    );
  }

  return {
    entryPaths,
    listingPaths,
    staticPaths,
    fallbackPaths,
    getRelated,
    getContentByPath,
    getAlternatePaths,
    getAlternatePathsForPath,
    getPairedSlugs,
    getSitemapEntries,
    hreflangLinks,
    getRelativeEntryUrl,
    getAbsoluteEntryUrl,
    localeSwitcherLinks,
  };
}
