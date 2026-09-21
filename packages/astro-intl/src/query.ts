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

/** Query helpers over a paired collection snapshot. Sit on `astro:content` entries. */
export function createIntlQuery(options: CreateIntlQueryOptions): IntlQuery {
  const pairing = pairCollections(options.config, options.collections, options.reservedTails ?? []);
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

  function getAlternatePathsForPath(locale: string, path: string): Record<string, string> {
    const document = pairing.byLocalePath.get(localePathKey(locale, normalizeSlug(path)));
    if (!document) return {};
    return getAlternatePaths(document.entryId);
  }

  function getPairedSlugs(): PairedSlug[] {
    return [...pairing.routed].sort(compareLocalePath).map((document) => ({
      locale: document.locale,
      slug: document.path,
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
    const claimed = new Set(pairing.routed.map((document) => document.path));
    for (const tail of fileRouteTails) {
      if (claimed.has(tail)) continue;
      const alternates = fileRouteAlternates(config.locales, tail, absolute);
      for (const locale of config.locales) {
        entries.push({
          locale,
          path: tail,
          loc: locFor(absolute, locale, tail),
          alternates,
        });
      }
    }
    return entries.sort(compareLocalePath);
  }

  function getDocumentHead({ locale, path }: { locale: string; path: string }): DocumentHead {
    const normalized = normalizeSlug(path);
    const document = pairing.byLocalePath.get(localePathKey(locale, normalized));
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
