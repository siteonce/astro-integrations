import type { CollectionEntryLike } from './pairing.ts';
import {
  createIntlQuery,
  type DocumentHead,
  type IntlQuery,
  type RoutedStaticPath,
  type SitemapEntry,
} from './query.ts';
import { getIntlRuntime, runtimeGeneration } from './runtime.ts';

export { hreflangLinks } from './hreflang.ts';
export type { DocumentHead, RoutedStaticPath, SitemapEntry };

export type IntlLoaders = {
  getCollection: (name: string) => Promise<CollectionEntryLike[]>;
  getAbsoluteLocaleUrl: (locale: string, path?: string) => string;
};

let loadersOverride: IntlLoaders | undefined;
let cached: IntlQuery | undefined;
let cachedGeneration = -1;

export function setIntlLoaders(loaders: IntlLoaders | undefined): void {
  loadersOverride = loaders;
  cached = undefined;
  cachedGeneration = -1;
}

export function resetIntlQuery(): void {
  cached = undefined;
  cachedGeneration = -1;
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
  cached = createIntlQuery({
    config: runtime.config,
    collections,
    reservedTails: runtime.reservedTails,
    fileRouteTails: runtime.routeTails,
    getAbsoluteLocaleUrl: loaders.getAbsoluteLocaleUrl,
  });
  cachedGeneration = generation;
  for (const warning of cached.pairing.warnings) {
    console.warn(`@repo/astro-intl: ${warning}`);
  }
  return cached;
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

export async function getRoutedStaticPaths(): Promise<RoutedStaticPath[]> {
  return (await loadQuery()).getRoutedStaticPaths();
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
