import type { CollectionConfig, IntlConfig } from './define-intl.ts';
import { resolveEntryId } from './entry-id.ts';
import { compilePath, normalizeSlug } from './path.ts';

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
  entry: CollectionEntryLike;
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

export function isRoutedCollection(collection: CollectionConfig): boolean {
  return collection.pathPrefix !== undefined || collection.slugField !== undefined;
}

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

/**
 * Pair listed collections: resolve entryId + locale, compile routed `path`,
 * and abort on uniqueness / reserved-path collisions.
 */
export function pairCollections(
  config: IntlConfig,
  collections: Record<string, CollectionEntryLike[]>,
  reservedTails: string[] = [],
): PairingIndex {
  const listed = config.collections ?? {};
  const reserved = new Set(reservedTails);
  const locales = new Set(config.locales);
  const byLocalePath = new Map<string, PairedDocument>();
  const byLocaleEntryId = new Map<string, PairedDocument | PairedRecord>();
  const routed: PairedDocument[] = [];
  const records: PairedRecord[] = [];
  const warnings: string[] = [];

  for (const name of Object.keys(listed)) {
    if (!(name in collections)) {
      throw new Error(`@repo/astro-intl: collections.${name} is not a content collection.`);
    }
  }

  for (const [name, collection] of Object.entries(listed)) {
    const routedCollection = isRoutedCollection(collection);
    const slugField = collection.slugField ?? 'slug';
    const entryIdField = collection.entryIdField ?? 'id';
    const resolver = collection.entryId ?? config.entryId ?? 'frontmatter';

    for (const entry of collections[name] ?? []) {
      const locale = readString(entry.data, 'locale');
      if (!locale) {
        throw new Error(`@repo/astro-intl: locale is missing on ${describeEntry(name, entry)}.`);
      }
      if (!locales.has(locale)) {
        throw new Error(
          `@repo/astro-intl: locale "${locale}" on ${describeEntry(name, entry)} is not in locales.`,
        );
      }

      const slugValue = readString(entry.data, slugField);
      const slug = slugValue === undefined ? undefined : normalizeSlug(slugValue);

      let entryId: string;
      try {
        entryId = resolveEntryId(
          resolver,
          {
            id: entry.id,
            collection: name,
            slug,
            locale,
            filePath: entry.filePath,
            data: entry.data,
          },
          entryIdField,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${message} (${describeEntry(name, entry)})`);
      }

      const idKey = localeEntryKey(locale, entryId);
      const existingId = byLocaleEntryId.get(idKey);
      if (existingId) {
        throw new Error(
          `@repo/astro-intl: (entryId, locale) "${entryId}" / "${locale}" is not unique (${existingId.collection} vs ${name}).`,
        );
      }

      if (routedCollection) {
        if (slug === undefined) {
          throw new Error(
            `@repo/astro-intl: slug is missing on routed entry ${describeEntry(name, entry)}.`,
          );
        }
        const path = compilePath(collection.pathPrefix, locale, slug);
        if (reserved.has(path)) {
          throw new Error(
            `@repo/astro-intl: path "${path}" is shadowed by a file route (${describeEntry(name, entry)}).`,
          );
        }
        const pathKey = localePathKey(locale, path);
        const existingPath = byLocalePath.get(pathKey);
        if (existingPath) {
          throw new Error(
            `@repo/astro-intl: (locale, path) "${locale}" / "${path}" collides (${existingPath.collection} vs ${name}).`,
          );
        }
        const document: PairedDocument = {
          collection: name,
          entryId,
          locale,
          slug,
          path,
          entry,
        };
        byLocalePath.set(pathKey, document);
        byLocaleEntryId.set(idKey, document);
        routed.push(document);
      } else {
        const record: PairedRecord = {
          collection: name,
          entryId,
          locale,
          entry,
        };
        byLocaleEntryId.set(idKey, record);
        records.push(record);
      }
    }
  }

  const seenEntryIds = new Set<string>();
  for (const document of routed) {
    if (seenEntryIds.has(document.entryId)) continue;
    seenEntryIds.add(document.entryId);
    const defaultKey = localeEntryKey(config.defaultLocale, document.entryId);
    if (!byLocaleEntryId.has(defaultKey)) {
      warnings.push(
        `default-locale sibling missing for entryId "${document.entryId}" (defaultLocale "${config.defaultLocale}").`,
      );
    }
  }

  return { routed, records, byLocalePath, byLocaleEntryId, warnings };
}
