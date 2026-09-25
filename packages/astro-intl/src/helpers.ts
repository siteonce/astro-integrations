import type { PaginateFunction } from 'astro';
import {
  type CollectionEntryLike,
  currentListingEntries,
  type ListingEntries,
  setListingEntriesFn,
} from './pairing.ts';
import {
  createIntlQuery,
  type DocumentHead,
  type IntlQuery,
  type PairedSlug,
  type SitemapEntry,
} from './query.ts';
import {
  assertRelations,
  collectRelations,
  type Relation,
  relatedTargetNames,
  resolveRelation,
} from './relation.ts';
import {
  entryPathsFor,
  listingPathsFor,
  missingPathsFor,
  routeFor,
  staticPathsFor,
} from './routed-paths.ts';
import { type CompiledRoute, compileRoutes } from './routing.ts';
import { getIntlRuntime, runtimeGeneration } from './runtime.ts';

export { hreflangLinks } from './hreflang.ts';
export type { DocumentHead, PairedSlug, SitemapEntry };

/** Collection read used by query helpers. Production uses `astro:content`. Intl does not call a CMS. */
export type IntlLoaders = {
  getCollection: (name: string) => Promise<CollectionEntryLike[]>;
  getAbsoluteLocaleUrl: (locale: string, path?: string) => string;
};

let loadersOverride: IntlLoaders | undefined;
let cached: IntlQuery | undefined;
let cachedGeneration = -1;
let cachedRoutes: CompiledRoute[] | undefined;
let cachedRoutesGeneration = -1;

export function setIntlLoaders(loaders: IntlLoaders | undefined): void {
  loadersOverride = loaders;
  cached = undefined;
  cachedGeneration = -1;
}

export function resetIntlQuery(): void {
  cached = undefined;
  cachedGeneration = -1;
}

/** The app registers the listing callback. Pairing uses it when a collection tail sets pageSize. */
export function setListingEntries(fn: ListingEntries | undefined): void {
  setListingEntriesFn(fn);
  resetIntlQuery();
}

export type { ListingEntries };

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
): Promise<CollectionEntryLike[]> {
  try {
    return await loaders.getCollection(name);
  } catch {
    throw new Error(`@repo/astro-intl: collections.${name} is not a content collection.`);
  }
}

function compiledRoutes(): CompiledRoute[] {
  const generation = runtimeGeneration();
  if (cachedRoutes && cachedRoutesGeneration === generation) return cachedRoutes;
  cachedRoutes = compileRoutes(getIntlRuntime().config);
  cachedRoutesGeneration = generation;
  return cachedRoutes;
}

async function loadQuery(): Promise<IntlQuery> {
  const generation = runtimeGeneration();
  if (cached && cachedGeneration === generation) return cached;
  const runtime = getIntlRuntime();
  const loaders = loadersOverride ?? (await defaultLoaders());
  const collections: Record<string, CollectionEntryLike[]> = {};
  for (const name of Object.keys(runtime.config.collections ?? {})) {
    collections[name] = await loadNamedCollection(loaders, name);
  }
  const needed = new Set(relatedTargetNames());
  for (const entries of Object.values(collections)) {
    for (const entry of entries) {
      for (const rel of collectRelations(entry.data)) {
        needed.add(rel.target);
      }
    }
  }
  for (const name of needed) {
    if (name in collections) continue;
    collections[name] = await loadNamedCollection(loaders, name);
  }
  const query = createIntlQuery({
    config: runtime.config,
    collections,
    reservedTails: runtime.reservedTails,
    fileRouteTails: runtime.routeTails,
    getAbsoluteLocaleUrl: loaders.getAbsoluteLocaleUrl,
    listingEntries: currentListingEntries(),
  });
  assertRelations({
    locales: runtime.config.locales,
    listed: runtime.config.collections ?? {},
    collections,
    getContentById: query.getContentById,
  });
  cached = query;
  cachedGeneration = generation;
  for (const warning of query.pairing.warnings) {
    console.warn(`@repo/astro-intl: ${warning}`);
  }
  return query;
}

export async function getRelated(locale: string, rel: Relation): Promise<CollectionEntryLike> {
  const query = await loadQuery();
  const runtime = getIntlRuntime();
  return resolveRelation(locale, rel, {
    locales: runtime.config.locales,
    listed: runtime.config.collections ?? {},
    collections: query.collections,
    getContentById: query.getContentById,
  });
}

export async function getContentByPath(
  locale: string,
  path: string,
): Promise<CollectionEntryLike | undefined> {
  return (await loadQuery()).getContentByPath(locale, path);
}

export async function getContentById(
  locale: string,
  entryId: string,
): Promise<CollectionEntryLike | undefined> {
  return (await loadQuery()).getContentById(locale, entryId);
}

export async function getAlternatePaths(entryId: string): Promise<Record<string, string>> {
  return (await loadQuery()).getAlternatePaths(entryId);
}

export async function getAlternatePathsForPath(
  locale: string,
  path: string,
): Promise<Record<string, string>> {
  return (await loadQuery()).getAlternatePathsForPath(locale, path);
}

export async function getPairedSlugs(): Promise<PairedSlug[]> {
  return (await loadQuery()).getPairedSlugs();
}

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  return (await loadQuery()).getSitemapEntries();
}

export async function getDocumentHead(args: {
  locale: string;
  path: string;
}): Promise<DocumentHead> {
  return (await loadQuery()).getDocumentHead(args);
}

/** Leaf paths for the injected `{slug}` route at `routePattern`. */
export async function entryPaths<T>(routePattern: string) {
  const query = await loadQuery();
  const route = routeFor(compiledRoutes(), routePattern, 'entry');
  return entryPathsFor<T>(getIntlRuntime().config, query, route);
}

/** Paginated paths for the injected listing route at `routePattern`. */
export async function listingPaths<T>(routePattern: string, paginate: PaginateFunction) {
  const query = await loadQuery();
  const route = routeFor(compiledRoutes(), routePattern, 'listing');
  const { getRelativeLocaleUrl } = await import('astro:i18n');
  return listingPathsFor<T>(
    getIntlRuntime().config,
    query,
    route,
    paginate,
    currentListingEntries(),
    getRelativeLocaleUrl,
  );
}

/**
 * `getStaticPaths` rows for the injected static route at `routePattern`.
 * `[]` when the locale does not publish it.
 */
export async function staticPaths<T>(routePattern: string) {
  const query = await loadQuery();
  const route = routeFor(compiledRoutes(), routePattern, 'static');
  return staticPathsFor<T>(getIntlRuntime().config, query, route);
}

/** Missing-translation paths for the injected route at `routePattern`. */
export async function missingPaths<T>(routePattern: string) {
  const query = await loadQuery();
  const route = routeFor(compiledRoutes(), routePattern, 'missing');
  const { getRelativeLocaleUrl } = await import('astro:i18n');
  return missingPathsFor<T>(getIntlRuntime().config, query, route, getRelativeLocaleUrl);
}
