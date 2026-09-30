/**
 * Binds page helpers to one authored intl config.
 * Parsing runs once, when this is called. Collections load and pair on the first
 * helper call. Concurrent first calls share that load. Each call returns its own
 * pairing; two factories do not share state.
 * `options.loaders` replaces the content and locale-url reads. Tests pass them.
 * Omitted, the first load uses `astro:content` and `astro:i18n`.
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
import type { CollectionEntryLike } from './pairing.ts';
import { createIntlQuery, type IntlQuery } from './query.ts';
import {
  assertRelations,
  collectRelations,
  type Relation,
  recordedRelationNames,
  relatedTargetNames,
  resolveRelation,
} from './relation.ts';
import {
  entryPathsFor,
  fallbackPathsFor,
  type ListingOrder,
  listingPathsFor,
  routeFor,
  staticPathsFor,
} from './routed-paths.ts';
import { type CompiledRoute, compileRoutes } from './routing.ts';

/** Collection read used by query helpers. Production uses `astro:content`. Intl does not call a CMS. */
export type IntlLoaders = {
  getCollection: (name: string) => Promise<CollectionEntryLike[]>;
  getAbsoluteLocaleUrl: (locale: string, path?: string) => string;
};

async function defaultLoaders(): Promise<IntlLoaders> {
  const { getCollection } = await import('astro:content');
  const { getAbsoluteLocaleUrl } = await import('astro:i18n');
  return {
    getCollection: async (name) => (await getCollection(name)) as CollectionEntryLike[],
    getAbsoluteLocaleUrl,
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

export function createIntl(input: IntlConfigInput, options?: { loaders?: IntlLoaders }) {
  const config = parseIntlConfig(input);
  const spec = config.collections;
  const names = relatedTargetNames(spec);
  const loadersOverride = options?.loaders;
  let pending: Promise<IntlQuery> | undefined;
  let routes: CompiledRoute[] | undefined;

  function compiledRoutes(): CompiledRoute[] {
    routes ??= compileRoutes(config);
    return routes;
  }

  async function load(): Promise<IntlQuery> {
    const targets = new Set(names);
    for (const name of recordedRelationNames()) {
      if (targets.has(name)) continue;
      throw new Error(
        `@repo/astro-intl: relation("${name}") points at a collection neither collections.translated nor collections.untranslated lists.`,
      );
    }
    const loaders = loadersOverride ?? (await defaultLoaders());
    const collections: Record<string, CollectionEntryLike[]> = {};
    for (const name of translatedNames(spec)) {
      collections[name] = await loadNamedCollection(loaders, name, 'translated');
    }
    const needed = new Set(targets);
    for (const entries of Object.values(collections)) {
      for (const entry of entries) {
        for (const rel of collectRelations(entry.data, names)) {
          needed.add(rel.target);
        }
      }
    }
    const untranslated = new Set(untranslatedNames(spec));
    for (const name of needed) {
      if (name in collections) continue;
      const list = untranslated.has(name) ? 'untranslated' : 'translated';
      collections[name] = await loadNamedCollection(loaders, name, list);
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

  async function getRelated(locale: string, rel: Relation): Promise<CollectionEntryLike> {
    const query = await loadQuery();
    return resolveRelation(locale, rel, {
      locales: config.locales,
      translated: translatedFields(spec),
      untranslated: new Set(untranslatedNames(spec)),
      collections: query.collections,
      getContentById: query.getContentById,
    });
  }

  async function getContentByPath(locale: string, path: string) {
    return (await loadQuery()).getContentByPath(locale, path);
  }

  async function getAlternatePaths(entryId: string) {
    return (await loadQuery()).getAlternatePaths(entryId);
  }

  async function getAlternatePathsForPath(locale: string, path: string) {
    return (await loadQuery()).getAlternatePathsForPath(locale, path);
  }

  async function getPairedSlugs() {
    return (await loadQuery()).getPairedSlugs();
  }

  async function getSitemapEntries() {
    return (await loadQuery()).getSitemapEntries();
  }

  /** Alternate links for one public path, plus `x-default` when the default locale has a tail. */
  async function hreflangLinks(locale: string, path: string) {
    return (await loadQuery()).hreflangLinks(locale, path);
  }

  /** Leaf paths for the injected `{slug}` route at `routePattern`. */
  async function entryPaths<T>(routePattern: string) {
    const query = await loadQuery();
    const route = routeFor(compiledRoutes(), routePattern, 'entry');
    return entryPathsFor<T>(config, query, route);
  }

  /**
   * Paginated paths for the injected listing route at `routePattern`.
   * `sort` compares two entries. `order` reorders the whole list and must keep every entry.
   * One is required. Both receive the route's locale.
   */
  async function listingPaths<T>(
    routePattern: string,
    paginate: PaginateFunction,
    ordering: ListingOrder<T>,
  ) {
    const query = await loadQuery();
    const route = routeFor(compiledRoutes(), routePattern, 'listing');
    const { getRelativeLocaleUrl } = await import('astro:i18n');
    return listingPathsFor<T>(config, query, route, paginate, ordering, getRelativeLocaleUrl);
  }

  /**
   * `getStaticPaths` rows for the injected static route at `routePattern`.
   * `[]` when the locale does not publish it.
   */
  async function staticPaths<T>(routePattern: string) {
    const query = await loadQuery();
    const route = routeFor(compiledRoutes(), routePattern, 'static');
    return staticPathsFor<T>(config, query, route);
  }

  /** Missing-translation paths for the injected route at `routePattern`. */
  async function fallbackPaths<T>(routePattern: string) {
    const query = await loadQuery();
    const route = routeFor(compiledRoutes(), routePattern, 'fallback');
    const { getRelativeLocaleUrl } = await import('astro:i18n');
    return fallbackPathsFor<T>(config, query, route, getRelativeLocaleUrl);
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
  };
}
