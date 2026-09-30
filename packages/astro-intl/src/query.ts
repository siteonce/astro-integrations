import type { IntlConfig } from './define-intl.ts';
import {
  type CollectionEntryLike,
  localeEntryKey,
  localePathKey,
  type PairedDocument,
  type PairingIndex,
  pairCollections,
} from './pairing.ts';
import { localeUrlPath, normalizeSlug } from './path.ts';

export type AbsoluteLocaleUrl = (locale: string, path?: string) => string;

export type SitemapEntry = {
  locale: string;
  path: string;
  loc: string;
  alternates: Record<string, string>;
  entryId?: string;
};

export type HreflangLink = {
  hreflang: string;
  href: string;
};

export type PairedSlug = {
  locale: string;
  slug: string;
};

export type IntlQuery = {
  pairing: PairingIndex;
  collections: Readonly<Record<string, CollectionEntryLike[]>>;
  getContentByPath: (locale: string, path: string) => CollectionEntryLike | undefined;
  getContentById: (locale: string, entryId: string) => CollectionEntryLike | undefined;
  getAlternatePaths: (entryId: string) => Record<string, string>;
  getAlternatePathsForPath: (locale: string, path: string) => Record<string, string>;
  getPairedSlugs: () => PairedSlug[];
  getSitemapEntries: () => SitemapEntry[];
  hreflangLinks: (locale: string, path: string) => HreflangLink[];
};

export type CreateIntlQueryOptions = {
  config: IntlConfig;
  collections: Record<string, CollectionEntryLike[]>;
  getAbsoluteLocaleUrl: AbsoluteLocaleUrl;
};

function locFor(absolute: AbsoluteLocaleUrl, locale: string, path: string): string {
  return absolute(locale, localeUrlPath(path));
}

function documentsForEntryId(pairing: PairingIndex, entryId: string): PairedDocument[] {
  return pairing.routed.filter((document) => document.entryId === entryId);
}

function alternateLocs(
  documents: PairedDocument[],
  absolute: AbsoluteLocaleUrl,
): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const document of documents) {
    alternates[document.locale] = locFor(absolute, document.locale, document.path);
  }
  return alternates;
}

function compareLocalePath(
  a: { locale: string; path: string },
  b: { locale: string; path: string },
): number {
  return a.locale === b.locale ? a.path.localeCompare(b.path) : a.locale.localeCompare(b.locale);
}

/** Query helpers over a paired snapshot of collection entries. */
export function createIntlQuery(options: CreateIntlQueryOptions): IntlQuery {
  const pairing = pairCollections(options.config, options.collections);
  const absolute = options.getAbsoluteLocaleUrl;
  const { config } = options;

  function getContentByPath(locale: string, path: string): CollectionEntryLike | undefined {
    const normalized = normalizeSlug(path);
    return pairing.byLocalePath.get(localePathKey(locale, normalized))?.entry;
  }

  function getContentById(locale: string, entryId: string): CollectionEntryLike | undefined {
    return pairing.byLocaleEntryId.get(localeEntryKey(locale, entryId))?.entry;
  }

  function getAlternatePaths(entryId: string): Record<string, string> {
    const paths: Record<string, string> = {};
    for (const document of documentsForEntryId(pairing, entryId)) {
      paths[document.locale] = document.path;
    }
    return paths;
  }

  function tailPaths(tails: Record<string, string>): Record<string, string> {
    return { ...tails };
  }

  function tailLocs(tails: Record<string, string>): Record<string, string> {
    const alternates: Record<string, string> = {};
    for (const [code, tail] of Object.entries(tails)) {
      alternates[code] = locFor(absolute, code, tail);
    }
    return alternates;
  }

  function getAlternatePathsForPath(locale: string, path: string): Record<string, string> {
    const key = localePathKey(locale, normalizeSlug(path));
    const document = pairing.byLocalePath.get(key);
    if (document) return getAlternatePaths(document.entryId);
    const tail = pairing.byLocaleTail.get(key);
    if (!tail) return {};
    return tailPaths(tail.tails);
  }

  function getPairedSlugs(): PairedSlug[] {
    return [...pairing.routed, ...pairing.tails].sort(compareLocalePath).map((item) => ({
      locale: item.locale,
      slug: item.path,
    }));
  }

  function getSitemapEntries(): SitemapEntry[] {
    const entries: SitemapEntry[] = pairing.routed.map((document) => {
      const siblings = documentsForEntryId(pairing, document.entryId);
      return {
        locale: document.locale,
        path: document.path,
        loc: locFor(absolute, document.locale, document.path),
        alternates: alternateLocs(siblings, absolute),
        entryId: document.entryId,
      };
    });
    for (const tail of pairing.tails) {
      entries.push({
        locale: tail.locale,
        path: tail.path,
        loc: locFor(absolute, tail.locale, tail.path),
        alternates: tailLocs(tail.tails),
      });
    }
    return entries.sort(compareLocalePath);
  }

  /** Alternate links for one public path, plus `x-default` when the default locale has a tail. */
  function hreflangLinks(locale: string, path: string): HreflangLink[] {
    const normalized = normalizeSlug(path);
    const key = localePathKey(locale, normalized);
    const document = pairing.byLocalePath.get(key);
    const tails: Record<string, string> = document
      ? getAlternatePaths(document.entryId)
      : (pairing.byLocaleTail.get(key)?.tails ??
        Object.fromEntries(config.locales.map((code) => [code, normalized])));
    const links = Object.entries(tails)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, tail]) => ({
        hreflang: code,
        href: locFor(absolute, code, tail),
      }));
    const defaultTail = tails[config.defaultLocale];
    if (defaultTail !== undefined) {
      links.push({
        hreflang: 'x-default',
        href: locFor(absolute, config.defaultLocale, defaultTail),
      });
    }
    return links;
  }

  return {
    pairing,
    collections: options.collections,
    getContentByPath,
    getContentById,
    getAlternatePaths,
    getAlternatePathsForPath,
    getPairedSlugs,
    getSitemapEntries,
    hreflangLinks,
  };
}
