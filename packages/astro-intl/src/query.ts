import type { IntlConfig } from './define-intl.ts';
import {
  type CollectionEntryLike,
  type ListingEntries,
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
  /** Set for a file route the printer already discovers. Omitted for a published tail. */
  fileRoute?: boolean;
};

export type DocumentHead = {
  lang: string;
  canonical: string;
  alternates: { hreflang: string; href: string }[];
  xDefault: string | undefined;
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
  getDocumentHead: (args: { locale: string; path: string }) => DocumentHead;
};

export type CreateIntlQueryOptions = {
  config: IntlConfig;
  collections: Record<string, CollectionEntryLike[]>;
  reservedTails?: string[];
  fileRouteTails?: string[];
  getAbsoluteLocaleUrl: AbsoluteLocaleUrl;
  listingEntries?: ListingEntries;
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

function fileRouteAlternates(
  locales: string[],
  path: string,
  absolute: AbsoluteLocaleUrl,
): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const locale of locales) {
    alternates[locale] = locFor(absolute, locale, path);
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
  const pairing = pairCollections(
    options.config,
    options.collections,
    options.reservedTails ?? [],
    options.listingEntries,
  );
  const absolute = options.getAbsoluteLocaleUrl;
  const { config } = options;
  const fileRouteTails = options.fileRouteTails ?? [];

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
    const claimed = new Set<string>([
      ...pairing.routed.map((document) => document.path),
      ...pairing.tails.map((tail) => tail.path),
    ]);
    for (const tail of fileRouteTails) {
      if (claimed.has(tail)) continue;
      const alternates = fileRouteAlternates(config.locales, tail, absolute);
      for (const locale of config.locales) {
        entries.push({
          locale,
          path: tail,
          loc: locFor(absolute, locale, tail),
          alternates,
          fileRoute: true,
        });
      }
    }
    return entries.sort(compareLocalePath);
  }

  function getDocumentHead({ locale, path }: { locale: string; path: string }): DocumentHead {
    const normalized = normalizeSlug(path);
    const key = localePathKey(locale, normalized);
    const document = pairing.byLocalePath.get(key);
    if (document) {
      const siblings = documentsForEntryId(pairing, document.entryId);
      const defaultSibling = siblings.find((item) => item.locale === config.defaultLocale);
      return {
        lang: locale,
        canonical: locFor(absolute, locale, document.path),
        alternates: siblings
          .slice()
          .sort((a, b) => a.locale.localeCompare(b.locale))
          .map((item) => ({
            hreflang: item.locale,
            href: locFor(absolute, item.locale, item.path),
          })),
        xDefault: defaultSibling
          ? locFor(absolute, defaultSibling.locale, defaultSibling.path)
          : undefined,
      };
    }
    const tail = pairing.byLocaleTail.get(key);
    if (tail) {
      const defaultTail = tail.tails[config.defaultLocale];
      return {
        lang: locale,
        canonical: locFor(absolute, locale, tail.path),
        alternates: Object.entries(tail.tails)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([code, sibling]) => ({
            hreflang: code,
            href: locFor(absolute, code, sibling),
          })),
        xDefault: defaultTail ? locFor(absolute, config.defaultLocale, defaultTail) : undefined,
      };
    }
    const alternates = config.locales
      .slice()
      .sort()
      .map((code) => ({
        hreflang: code,
        href: locFor(absolute, code, normalized),
      }));
    return {
      lang: locale,
      canonical: locFor(absolute, locale, normalized),
      alternates,
      xDefault: locFor(absolute, config.defaultLocale, normalized),
    };
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
    getDocumentHead,
  };
}
