import { type IntlConfig, routeConfigIssues } from './define-intl.ts';
import { resolveEntryId } from './entry-id.ts';
import { compilePath, normalizePrefix, normalizeSlug } from './path.ts';

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
  slug: string;
  path: string;
  /** Absent when a standalone route has no joined record. */
  entry?: CollectionEntryLike;
};

export type PairedRecord = {
  collection: string;
  entryId: string;
  locale: string;
  entry: CollectionEntryLike;
};

export type PairingIndex = {
  routed: PairedDocument[];
  records: PairedRecord[];
  byLocalePath: Map<string, PairedDocument>;
  byLocaleEntryId: Map<string, PairedDocument | PairedRecord>;
  /** Standalone routes only. Prefix rows are not indexed. */
  byLocaleRoute: Map<string, { id: string; path: string }>;
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

function describeEntry(collection: string, entry: CollectionEntryLike): string {
  return entry.filePath ?? `${collection}:${entry.id}`;
}

type Leaf = {
  name: string;
  entry: CollectionEntryLike;
  locale: string;
  entryId: string;
  slug: string;
};

type Attachable = {
  locale: string;
  dataId: string;
  record: PairedRecord;
};

function prefixesByCollection(config: IntlConfig): Map<string, Map<string, string>> {
  const prefixes = new Map<string, Map<string, string>>();
  for (const route of config.routes ?? []) {
    if (!route.collection) continue;
    const perLocale = new Map<string, string>();
    for (const locale of config.locales) {
      const prefix = normalizePrefix(route.slug[locale] ?? '');
      if (!prefix) {
        throw new Error(
          `@repo/astro-intl: route "${route.id}" prefix for locale "${locale}" is empty or "/".`,
        );
      }
      perLocale.set(locale, prefix);
    }
    prefixes.set(route.collection, perLocale);
  }
  return prefixes;
}

/**
 * Pair listed collections: read id + locale from entry data, prefix the
 * collection name, compile leaf paths from route rows, and index standalone
 * routes. Aborts on route-rule, uniqueness, and reserved-path failures.
 */
export function pairCollections(
  config: IntlConfig,
  collections: Record<string, CollectionEntryLike[]>,
  reservedTails: string[] = [],
): PairingIndex {
  const issues = routeConfigIssues(config);
  const firstIssue = issues[0];
  if (firstIssue) {
    throw new Error(`@repo/astro-intl: ${firstIssue}`);
  }

  const listed = config.collections ?? {};
  const reserved = new Set(reservedTails);
  const locales = new Set(config.locales);
  const byLocalePath = new Map<string, PairedDocument>();
  const byLocaleEntryId = new Map<string, PairedDocument | PairedRecord>();
  const byLocaleRoute = new Map<string, { id: string; path: string }>();
  const routed: PairedDocument[] = [];
  const records: PairedRecord[] = [];
  const warnings: string[] = [];
  const leaves: Leaf[] = [];
  const attachable: Attachable[] = [];
  const seenIds = new Map<string, string>();
  const prefixes = prefixesByCollection(config);

  for (const name of Object.keys(listed)) {
    if (!(name in collections)) {
      throw new Error(`@repo/astro-intl: collections.${name} is not a content collection.`);
    }
  }

  function claim(document: PairedDocument, label: string): void {
    if (reserved.has(document.path)) {
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

      if (slugField) {
        const slug = readString(entry.data, slugField);
        if (!slug) {
          throw new Error(
            `@repo/astro-intl: slug is missing on routed entry ${describeEntry(name, entry)}.`,
          );
        }
        leaves.push({ name, entry, locale, entryId, slug });
        continue;
      }

      const record: PairedRecord = { collection: name, entryId, locale, entry };
      byLocaleEntryId.set(idKey, record);
      records.push(record);
      const dataId = readString(entry.data, idField);
      if (!dataId) {
        throw new Error(
          `@repo/astro-intl: id field "${idField}" is missing on ${describeEntry(name, entry)}.`,
        );
      }
      attachable.push({ locale, dataId, record });
    }
  }

  for (const route of config.routes ?? []) {
    if (route.collection) continue;
    for (const locale of config.locales) {
      const path = normalizeSlug(route.slug[locale] ?? '');
      const matches = attachable.filter(
        (item) => item.locale === locale && item.dataId === route.id,
      );
      if (matches.length > 1) {
        throw new Error(
          `@repo/astro-intl: two records match route "${route.id}" in locale "${locale}".`,
        );
      }
      const match = matches[0];
      const document: PairedDocument = {
        collection: match?.record.collection ?? route.id,
        entryId: route.id,
        locale,
        slug: path,
        path,
        entry: match?.record.entry,
      };
      const label = match ? describeEntry(match.record.collection, match.record.entry) : route.id;
      claim(document, label);
      byLocaleRoute.set(localePathKey(locale, path), { id: route.id, path });
    }
  }

  for (const leaf of leaves) {
    const prefix = prefixes.get(leaf.name)?.get(leaf.locale);
    if (!prefix) {
      throw new Error(
        `@repo/astro-intl: collections.${leaf.name} has no prefix for locale "${leaf.locale}".`,
      );
    }
    let path: string;
    try {
      path = compilePath(prefix, leaf.slug);
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

  return { routed, records, byLocalePath, byLocaleEntryId, byLocaleRoute, warnings };
}
