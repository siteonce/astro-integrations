import { type IntlConfig, isPageTokenRow, listingPair, routeConfigIssues } from './define-intl.ts';
import { resolveEntryId } from './entry-id.ts';
import {
  compilePath,
  listingPageCount,
  listingPagePath,
  normalizeSlug,
  pageTokenSection,
  patternSection,
} from './path.ts';

/** Orders and filters the entries that fill a collection tail. The app owns draft rules. */
export type ListingEntries = (
  collection: string,
  locale: string,
  entries: readonly CollectionEntryLike[],
) => readonly CollectionEntryLike[];

let listingEntriesFn: ListingEntries | undefined;

export function setListingEntriesFn(fn: ListingEntries | undefined): void {
  listingEntriesFn = fn;
}

export function currentListingEntries(): ListingEntries | undefined {
  return listingEntriesFn;
}

/** Entry shape pairing and relations read. The content source fills `id` and `data`. `filePath` is optional. */
export type CollectionEntryLike = {
  id: string;
  collection?: string;
  data: Record<string, unknown>;
  filePath?: string;
};

export type PairedDocument = {
  collection: string;
  entryId: string;
  locale: string;
  /** Leaf for a pattern row. Public tail for an entry row. */
  slug: string;
  path: string;
  entry?: CollectionEntryLike;
};

export type PairedRecord = {
  collection: string;
  entryId: string;
  locale: string;
  entry: CollectionEntryLike;
};

/** A published tail with no collection entry and no pairing id. */
export type RouteTail = {
  locale: string;
  path: string;
  /** Public tail for every locale on the same row, including this one. */
  tails: Record<string, string>;
};

export type PairingIndex = {
  routed: PairedDocument[];
  records: PairedRecord[];
  tails: RouteTail[];
  byLocalePath: Map<string, PairedDocument>;
  byLocaleTail: Map<string, RouteTail>;
  byLocaleEntryId: Map<string, PairedDocument | PairedRecord>;
  warnings: string[];
};

export function localePathKey(locale: string, path: string): string {
  return `${locale}\0${path}`;
}

export function localeEntryKey(locale: string, entryId: string): string {
  return `${locale}\0${entryId}`;
}

function readString(data: Record<string, unknown>, field: string): string | undefined {
  const value = data[field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Entries that fill one locale of a collection tail. A callback replaces the locale filter. */
export function listingSelection(
  collections: Readonly<Record<string, readonly CollectionEntryLike[]>>,
  collection: string,
  locale: string,
  localeField: string,
  listEntries: ListingEntries | undefined,
): readonly CollectionEntryLike[] {
  const source = collections[collection] ?? [];
  if (listEntries) return listEntries(collection, locale, source);
  return source.filter((entry) => readString(entry.data, localeField) === locale);
}

function describeEntry(collection: string, entry: CollectionEntryLike): string {
  return entry.filePath ?? `${collection}:${entry.id}`;
}

type Leaf = {
  name: string;
  entry: CollectionEntryLike;
  locale: string;
  entryId: string;
  dataId: string;
  slug: string;
};

type IndexedEntry = {
  entryId: string;
  locale: string;
  entry: CollectionEntryLike;
  dataId: string;
};

type PatternRow = {
  entry?: string | undefined;
  sections: Map<string, string>;
};

function patternsByCollection(config: IntlConfig): Map<string, PatternRow> {
  const patterns = new Map<string, PatternRow>();
  for (const route of config.routes ?? []) {
    if (!route.collection) continue;
    const wantsPattern = config.locales.some((locale) =>
      (route.slug[locale] ?? '').includes('{slug}'),
    );
    if (!wantsPattern) continue;
    const sections = new Map<string, string>();
    for (const locale of config.locales) {
      const section = patternSection(route.slug[locale] ?? '');
      if (!section) {
        throw new Error(
          `@repo/astro-intl: route collection "${route.collection}" slug for locale "${locale}" must use {slug} as the final segment.`,
        );
      }
      sections.set(locale, section);
    }
    patterns.set(route.collection, { entry: route.entry, sections });
  }
  return patterns;
}

/** Entries named by a fixed tail. A `{slug}` row does not publish them again. */
function fixedEntryKeys(config: IntlConfig): Set<string> {
  const keys = new Set<string>();
  for (const route of config.routes ?? []) {
    if (!route.collection || !route.entry) continue;
    const wantsPattern = config.locales.some((locale) =>
      (route.slug[locale] ?? '').includes('{slug}'),
    );
    if (wantsPattern) continue;
    keys.add(`${route.collection}\0${route.entry}`);
  }
  return keys;
}

/**
 * Pair listed collections: read id + locale from entry data, prefix the
 * collection name, and compile public tails from route rows. An entry row
 * publishes one named entry at the written tail. A `{slug}` row joins a
 * section and a leaf, or that one named entry. A page-1 row publishes page 1
 * at its written tail. Its `{page}` row publishes later pages, with `{page}`
 * replaced by the number.
 * A row with no collection publishes those tails with no entry and no pairing id.
 * Aborts on route-rule, uniqueness, and reserved-path failures.
 */
export function pairCollections(
  config: IntlConfig,
  collections: Record<string, CollectionEntryLike[]>,
  reservedTails: string[] = [],
  listingEntries?: ListingEntries,
): PairingIndex {
  const issues = routeConfigIssues(config);
  const firstIssue = issues[0];
  if (firstIssue) {
    throw new Error(`@repo/astro-intl: ${firstIssue}`);
  }

  const listed = config.collections ?? {};
  const reserved = new Set(reservedTails);
  // A file route under a literal locale segment reserves its tail for that locale only.
  const isReserved = (locale: string, path: string): boolean =>
    reserved.has(path) || reserved.has(path === '/' ? locale : `${locale}/${path}`);
  const locales = new Set(config.locales);
  const byLocalePath = new Map<string, PairedDocument>();
  const byLocaleTail = new Map<string, RouteTail>();
  const byLocaleEntryId = new Map<string, PairedDocument | PairedRecord>();
  const routed: PairedDocument[] = [];
  const records: PairedRecord[] = [];
  const tails: RouteTail[] = [];
  const warnings: string[] = [];
  const leaves: Leaf[] = [];
  const seenIds = new Map<string, string>();
  const patterns = patternsByCollection(config);
  const fixedEntries = fixedEntryKeys(config);
  const listEntries = listingEntries ?? currentListingEntries();
  const byDataId = new Map<string, IndexedEntry>();

  for (const name of Object.keys(listed)) {
    if (!(name in collections)) {
      throw new Error(`@repo/astro-intl: collections.${name} is not a content collection.`);
    }
  }

  function claim(document: PairedDocument, label: string): void {
    if (isReserved(document.locale, document.path)) {
      throw new Error(
        `@repo/astro-intl: path "${document.path}" is shadowed by a file route (${label}).`,
      );
    }
    const pathKey = localePathKey(document.locale, document.path);
    const existing = byLocalePath.get(pathKey);
    if (existing) {
      throw new Error(
        `@repo/astro-intl: (locale, path) "${document.locale}" / "${document.path}" collides (${existing.collection} vs ${document.collection}).`,
      );
    }
    byLocalePath.set(pathKey, document);
    routed.push(document);
  }

  function claimTail(locale: string, path: string, siblings: Record<string, string>): void {
    if (isReserved(locale, path)) {
      throw new Error(`@repo/astro-intl: path "${path}" is shadowed by a file route (route tail).`);
    }
    const pathKey = localePathKey(locale, path);
    const existing = byLocalePath.get(pathKey);
    if (existing || byLocaleTail.has(pathKey)) {
      const left = existing?.collection ?? 'route tail';
      throw new Error(
        `@repo/astro-intl: (locale, path) "${locale}" / "${path}" collides (${left} vs route tail).`,
      );
    }
    const tail: RouteTail = { locale, path, tails: siblings };
    byLocaleTail.set(pathKey, tail);
    tails.push(tail);
  }

  for (const [name, collection] of Object.entries(listed)) {
    const idField = collection.idField ?? 'id';
    const localeField = collection.localeField ?? 'locale';
    const slugField = collection.slugField;

    for (const entry of collections[name] ?? []) {
      const locale = readString(entry.data, localeField);
      if (!locale) {
        throw new Error(
          `@repo/astro-intl: locale field "${localeField}" is missing on ${describeEntry(name, entry)}.`,
        );
      }
      if (!locales.has(locale)) {
        throw new Error(
          `@repo/astro-intl: locale "${locale}" on ${describeEntry(name, entry)} is not in locales.`,
        );
      }

      let entryId: string;
      try {
        entryId = resolveEntryId(name, entry.data, idField);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${message} (${describeEntry(name, entry)})`);
      }

      const idKey = localeEntryKey(locale, entryId);
      const existingName = seenIds.get(idKey);
      if (existingName) {
        throw new Error(
          `@repo/astro-intl: (entryId, locale) "${entryId}" / "${locale}" is not unique (${existingName} vs ${name}).`,
        );
      }
      seenIds.set(idKey, name);

      const dataId = entryId.slice(name.length + 1);
      byDataId.set(`${name}\0${locale}\0${dataId}`, { entryId, locale, entry, dataId });

      if (slugField) {
        const slug = readString(entry.data, slugField);
        if (!slug) {
          throw new Error(
            `@repo/astro-intl: slug is missing on routed entry ${describeEntry(name, entry)}.`,
          );
        }
        leaves.push({ name, entry, locale, entryId, dataId, slug });
        continue;
      }

      const record: PairedRecord = { collection: name, entryId, locale, entry };
      byLocaleEntryId.set(idKey, record);
      records.push(record);
    }
  }

  const missingEntryRows: string[] = [];
  for (const route of config.routes ?? []) {
    if (!route.entry || !route.collection) continue;
    if (config.locales.some((locale) => (route.slug[locale] ?? '').includes('{slug}'))) continue;
    let published = false;
    for (const locale of config.locales) {
      const found = byDataId.get(`${route.collection}\0${locale}\0${route.entry}`);
      if (!found) continue;
      published = true;
      const path = normalizeSlug(route.slug[locale] ?? '');
      const document: PairedDocument = {
        collection: route.collection,
        entryId: found.entryId,
        locale,
        slug: path,
        path,
        entry: found.entry,
      };
      claim(document, describeEntry(route.collection, found.entry));
      byLocaleEntryId.set(localeEntryKey(locale, found.entryId), document);
    }
    if (!published) missingEntryRows.push(`${route.collection}/${route.entry}`);
  }

  for (const leaf of leaves) {
    const pattern = patterns.get(leaf.name);
    if (!pattern) {
      throw new Error(
        `@repo/astro-intl: collections.${leaf.name} has no section for locale "${leaf.locale}".`,
      );
    }
    if (pattern.entry && pattern.entry !== leaf.dataId) {
      const record: PairedRecord = {
        collection: leaf.name,
        entryId: leaf.entryId,
        locale: leaf.locale,
        entry: leaf.entry,
      };
      records.push(record);
      const key = localeEntryKey(leaf.locale, leaf.entryId);
      if (!byLocaleEntryId.has(key)) byLocaleEntryId.set(key, record);
      continue;
    }
    if (!pattern.entry && fixedEntries.has(`${leaf.name}\0${leaf.dataId}`)) continue;
    const section = pattern.sections.get(leaf.locale);
    if (!section) {
      throw new Error(
        `@repo/astro-intl: collections.${leaf.name} has no section for locale "${leaf.locale}".`,
      );
    }
    let path: string;
    try {
      path = compilePath(section, leaf.slug);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${message} (${describeEntry(leaf.name, leaf.entry)})`);
    }
    const document: PairedDocument = {
      collection: leaf.name,
      entryId: leaf.entryId,
      locale: leaf.locale,
      slug: leaf.slug,
      path,
      entry: leaf.entry,
    };
    claim(document, describeEntry(leaf.name, leaf.entry));
    byLocaleEntryId.set(localeEntryKey(leaf.locale, leaf.entryId), document);
  }

  for (const [name, pattern] of patterns) {
    if (!pattern.entry) continue;
    const entryId = `${name}/${pattern.entry}`;
    if (routed.some((document) => document.entryId === entryId)) continue;
    if (!missingEntryRows.includes(entryId)) missingEntryRows.push(entryId);
  }

  for (const route of config.routes ?? []) {
    if (route.collection) continue;
    const siblings: Record<string, string> = {};
    for (const locale of config.locales) {
      siblings[locale] = normalizeSlug(route.slug[locale] ?? '');
    }
    for (const locale of config.locales) {
      claimTail(locale, siblings[locale] ?? '/', siblings);
    }
  }

  for (const route of config.routes ?? []) {
    if (!route.collection || route.entry) continue;
    const wantsPattern = config.locales.some((locale) =>
      (route.slug[locale] ?? '').includes('{slug}'),
    );
    if (wantsPattern || isPageTokenRow(route)) continue;
    const written: Record<string, string> = {};
    for (const locale of config.locales) {
      written[locale] = normalizeSlug(route.slug[locale] ?? '');
    }
    if (route.pageSize === undefined) {
      for (const locale of config.locales) {
        claimTail(locale, written[locale] ?? '/', written);
      }
      continue;
    }
    const pair = listingPair(config.routes ?? [], route);
    if (!pair) {
      throw new Error(
        `@repo/astro-intl: collection "${route.collection}" pageSize ${route.pageSize} has no {page} row.`,
      );
    }
    const pageTails: Record<string, string> = {};
    for (const locale of config.locales) {
      pageTails[locale] = normalizeSlug(pair.pageRow.slug[locale] ?? '');
    }
    const localeField = listed[route.collection]?.localeField ?? 'locale';
    const pages = new Map<string, number>();
    for (const locale of config.locales) {
      const selected = listingSelection(
        collections,
        route.collection,
        locale,
        localeField,
        listEntries,
      );
      pages.set(locale, listingPageCount(selected.length, route.pageSize));
    }
    const maxPage = Math.max(1, ...pages.values());
    for (let page = 1; page <= maxPage; page += 1) {
      const siblings: Record<string, string> = {};
      for (const locale of config.locales) {
        if ((pages.get(locale) ?? 1) < page) continue;
        siblings[locale] = listingPagePath(
          written[locale] ?? '/',
          pageTails[locale] ?? '{page}',
          page,
        );
      }
      for (const locale of config.locales) {
        const path = siblings[locale];
        if (path === undefined) continue;
        if (page > 1) {
          const existing = byLocalePath.get(localePathKey(locale, path));
          if (existing?.slug === String(page)) {
            const section = pageTokenSection(pageTails[locale] ?? '{page}');
            throw new Error(
              `@repo/astro-intl: entry slug "${existing.slug}" matches published page ${page} on section "${section}".`,
            );
          }
        }
        claimTail(locale, path, siblings);
      }
    }
  }

  const localesByEntry = new Map<string, Set<string>>();
  for (const document of routed) {
    const present = localesByEntry.get(document.entryId) ?? new Set<string>();
    present.add(document.locale);
    localesByEntry.set(document.entryId, present);
  }
  for (const [entryId, present] of localesByEntry) {
    if (present.has(config.defaultLocale)) continue;
    warnings.push(
      `default-locale sibling missing for entryId "${entryId}" (defaultLocale "${config.defaultLocale}").`,
    );
  }
  for (const entryId of missingEntryRows) {
    warnings.push(
      `default-locale sibling missing for entryId "${entryId}" (defaultLocale "${config.defaultLocale}").`,
    );
  }

  return { routed, records, tails, byLocalePath, byLocaleTail, byLocaleEntryId, warnings };
}
