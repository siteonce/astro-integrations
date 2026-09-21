/**
 * **relation** helper: authored pairing `id`, parsed `{ collection, id }`,
 * resolved in the current locale. Locale-free and inline-map collections sit
 * on `astro:content`; listed targets use pairing.
 */

import * as z from 'zod';
import type { CollectionConfig } from './define-intl.ts';
import { type CollectionEntryLike, localeEntryKey, type PairingIndex } from './pairing.ts';

export type Relation = {
  collection: string;
  id: string;
};

function describeEntry(collection: string, entry: CollectionEntryLike): string {
  return entry.filePath ?? `${collection}:${entry.id}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

export function isRelation(value: unknown): value is Relation {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === 2 &&
    typeof value.collection === 'string' &&
    value.collection.length > 0 &&
    typeof value.id === 'string' &&
    value.id.length > 0
  );
}

/** Walk parsed entry data for `{ collection, id }` objects. */
export function collectRelations(value: unknown): Relation[] {
  if (isRelation(value)) return [value];
  if (Array.isArray(value)) return value.flatMap(collectRelations);
  if (isPlainObject(value)) return Object.values(value).flatMap(collectRelations);
  return [];
}

/** Authored pairing `id` string → `{ collection, id }`. */
export function relation(collection: string) {
  if (!collection) {
    throw new Error('@repo/astro-intl: relation() needs a collection name.');
  }
  return z
    .string()
    .min(1)
    .transform((id): Relation => ({ collection, id }));
}

/**
 * Locale-keyed object for inline translation. Keys are `locales`.
 * Missing or extra keys fail parse.
 */
export function localized<T extends z.ZodType>(value: T, locales: readonly string[]) {
  if (locales.length === 0) {
    throw new Error('@repo/astro-intl: localized() needs at least one locale.');
  }
  if (new Set(locales).size !== locales.length) {
    throw new Error('@repo/astro-intl: localized() locales must be unique.');
  }
  const shape: Record<string, T> = {};
  for (const code of locales) {
    if (!code) {
      throw new Error('@repo/astro-intl: localized() locale codes must be non-empty.');
    }
    shape[code] = value;
  }
  return z.strictObject(shape);
}

export function localizedValue<T>(field: Readonly<Record<string, T>>, locale: string): T {
  if (!(locale in field)) {
    throw new Error(`@repo/astro-intl: localized field missing locale "${locale}".`);
  }
  return field[locale] as T;
}

export function findLocaleFreeEntry(
  entries: readonly CollectionEntryLike[],
  id: string,
): CollectionEntryLike | undefined {
  return entries.find((entry) => {
    if (entry.id === id) return true;
    const dataId = entry.data.id;
    return typeof dataId === 'string' && dataId === id;
  });
}

function listedEntryId(collection: string, id: string): string {
  return `${collection}/${id}`;
}

export type AssertRelationsOptions = {
  locales: readonly string[];
  listed: Readonly<Record<string, CollectionConfig>>;
  pairing: PairingIndex;
  collections: Readonly<Record<string, CollectionEntryLike[]>>;
};

export function resolveRelation(
  locale: string,
  rel: Relation,
  options: Pick<AssertRelationsOptions, 'listed' | 'pairing' | 'collections'>,
): CollectionEntryLike {
  const target = options.collections[rel.collection];
  if (!target) {
    throw new Error(`@repo/astro-intl: collections.${rel.collection} is not a content collection.`);
  }
  if (rel.collection in options.listed) {
    const entry = options.pairing.byLocaleEntryId.get(
      localeEntryKey(locale, listedEntryId(rel.collection, rel.id)),
    )?.entry;
    if (!entry) {
      throw new Error(
        `@repo/astro-intl: relation ${rel.collection}/${rel.id} is missing locale "${locale}".`,
      );
    }
    return entry;
  }
  const found = findLocaleFreeEntry(target, rel.id);
  if (!found) {
    throw new Error(`@repo/astro-intl: relation ${rel.collection}/${rel.id} is missing.`);
  }
  return found;
}

/** Fail when a parsed **relation** has no target in the source locale. */
export function assertRelations(options: AssertRelationsOptions): void {
  const { locales, listed, pairing, collections } = options;

  for (const [name, entries] of Object.entries(collections)) {
    const localeField = listed[name]?.localeField ?? 'locale';
    for (const entry of entries) {
      const sourceLocale =
        typeof entry.data[localeField] === 'string' && entry.data[localeField].length > 0
          ? entry.data[localeField]
          : undefined;
      const where = describeEntry(name, entry);

      for (const rel of collectRelations(entry.data)) {
        if (!(rel.collection in collections)) {
          throw new Error(
            `@repo/astro-intl: collections.${rel.collection} is not a content collection (${where}).`,
          );
        }
        if (rel.collection in listed) {
          const localesToCheck = sourceLocale ? [sourceLocale] : locales;
          for (const locale of localesToCheck) {
            const key = localeEntryKey(locale, listedEntryId(rel.collection, rel.id));
            if (!pairing.byLocaleEntryId.has(key)) {
              throw new Error(
                `@repo/astro-intl: relation ${rel.collection}/${rel.id} is missing locale "${locale}" (${where}).`,
              );
            }
          }
        } else if (!findLocaleFreeEntry(collections[rel.collection] ?? [], rel.id)) {
          throw new Error(
            `@repo/astro-intl: relation ${rel.collection}/${rel.id} is missing (${where}).`,
          );
        }
      }
    }
  }
}
