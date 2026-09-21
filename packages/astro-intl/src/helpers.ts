import type { CollectionEntryLike } from './pairing.ts';
import {
  createIntlQuery,
  type DocumentHead,
  type IntlQuery,
  type PairedSlug,
  type SitemapEntry,
} from './query.ts';
import { assertRelations, collectRelations, type Relation, resolveRelation } from './relation.ts';
import { getIntlRuntime, runtimeGeneration } from './runtime.ts';

export { hreflangLinks } from './hreflang.ts';
export type { DocumentHead, PairedSlug, SitemapEntry };

export type IntlLoaders = {
  getCollection: (name: string) => Promise<CollectionEntryLike[]>;
  getAbsoluteLocaleUrl: (locale: string, path?: string) => string;
};

let loadersOverride: IntlLoaders | undefined;
let cached: IntlQuery | undefined;
let cachedGeneration = -1;
let relatedCollections: Record<string, CollectionEntryLike[]> = {};

export function setIntlLoaders(loaders: IntlLoaders | undefined): void {
  loadersOverride = loaders;
  cached = undefined;
  cachedGeneration = -1;
  relatedCollections = {};
}

export function resetIntlQuery(): void {
  cached = undefined;
  cachedGeneration = -1;
  relatedCollections = {};
}

async function defaultLoaders(): Promise<IntlLoaders> {
  const { getCollection } = await import('astro:content');
  const { getAbsoluteLocaleUrl } = await import('astro:i18n');
  return {
    getCollection: async (name) => (await getCollection(name)) as CollectionEntryLike[],
    getAbsoluteLocaleUrl,
  };
}

async function loadQuery(): Promise<IntlQuery> {
  const generation = runtimeGeneration();
  if (cached && cachedGeneration === generation) return cached;
  const runtime = getIntlRuntime();
  const loaders = loadersOverride ?? (await defaultLoaders());
  const collections: Record<string, CollectionEntryLike[]> = {};
  for (const name of Object.keys(runtime.config.collections ?? {})) {
    try {
      collections[name] = await loaders.getCollection(name);
    } catch {
      throw new Error(`@repo/astro-intl: collections.${name} is not a content collection.`);
    }
  }
  const query = createIntlQuery({
    config: runtime.config,
    collections,
    reservedTails: runtime.reservedTails,
    fileRouteTails: runtime.routeTails,
    getAbsoluteLocaleUrl: loaders.getAbsoluteLocaleUrl,
  });

  const needed = new Set<string>();
  for (const entries of Object.values(collections)) {
    for (const entry of entries) {
      for (const rel of collectRelations(entry.data)) {
        needed.add(rel.collection);
      }
    }
  }
  for (const name of needed) {
    if (name in collections) continue;
    try {
      collections[name] = await loaders.getCollection(name);
    } catch {
      throw new Error(`@repo/astro-intl: collections.${name} is not a content collection.`);
    }
  }
  assertRelations({
    locales: runtime.config.locales,
    listed: runtime.config.collections ?? {},
    pairing: query.pairing,
    collections,
  });
  relatedCollections = collections;
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
  if (!(rel.collection in relatedCollections)) {
    const loaders = loadersOverride ?? (await defaultLoaders());
    try {
      relatedCollections[rel.collection] = await loaders.getCollection(rel.collection);
    } catch {
      throw new Error(
        `@repo/astro-intl: collections.${rel.collection} is not a content collection.`,
      );
    }
  }
  return resolveRelation(locale, rel, {
    listed: runtime.config.collections ?? {},
    pairing: query.pairing,
    collections: relatedCollections,
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
