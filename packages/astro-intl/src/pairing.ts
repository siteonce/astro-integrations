import { type IntlConfig, routeConfigIssues } from './define-intl.ts';
import { resolveEntryId } from './entry-id.ts';
import { compilePath, normalizeSlug, patternSection } from './path.ts';

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

export type PairingIndex = {
  routed: PairedDocument[];
  records: PairedRecord[];
  byLocalePath: Map<string, PairedDocument>;
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

function sectionsByCollection(config: IntlConfig): Map<string, Map<string, string>> {
  const sections = new Map<string, Map<string, string>>();
  for (const route of config.routes ?? []) {
    if (route.entry) continue;
    const perLocale = new Map<string, string>();
    for (const locale of config.locales) {
      const section = patternSection(route.slug[locale] ?? '');
      if (!section) {
        throw new Error(
          `@repo/astro-intl: route collection "${route.collection}" slug for locale "${locale}" must use {slug} as the final segment.`,
        );
      }
      perLocale.set(locale, section);
    }
    sections.set(route.collection, perLocale);
  }
  return sections;
}

/**
 * Pair listed collections: read id + locale from entry data, prefix the
 * collection name, and compile public tails from route rows. An entry row
 * publishes one named document. A pattern row joins a section and a leaf.
 * Aborts on route-rule, uniqueness, and reserved-path failures.
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
  const routed: PairedDocument[] = [];
  const records: PairedRecord[] = [];
  const warnings: string[] = [];
  const leaves: Leaf[] = [];
  const recordByKey = new Map<string, PairedRecord>();
  const seenIds = new Map<string, string>();
  const sections = sectionsByCollection(config);

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
      recordByKey.set(`${name}\0${locale}\0${dataId}`, record);
    }
  }

  const missingEntryRows: string[] = [];
  for (const route of config.routes ?? []) {
    if (!route.entry) continue;
    let published = false;
    for (const locale of config.locales) {
      const record = recordByKey.get(`${route.collection}\0${locale}\0${route.entry}`);
      if (!record) continue;
      published = true;
      const path = normalizeSlug(route.slug[locale] ?? '');
      const document: PairedDocument = {
        collection: route.collection,
        entryId: record.entryId,
        locale,
        slug: path,
        path,
        entry: record.entry,
      };
      claim(document, describeEntry(route.collection, record.entry));
      byLocaleEntryId.set(localeEntryKey(locale, record.entryId), document);
    }
    if (!published) missingEntryRows.push(`${route.collection}/${route.entry}`);
  }

  for (const leaf of leaves) {
    const section = sections.get(leaf.name)?.get(leaf.locale);
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

  return { routed, records, byLocalePath, byLocaleEntryId, warnings };
}
