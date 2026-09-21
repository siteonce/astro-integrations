import * as z from 'zod';
import type { CollectionConfig } from './define-intl.ts';
import type { CollectionEntryLike } from './pairing.ts';

const RELATED_TARGETS = Symbol.for('@repo/astro-intl/related-targets');

export type Relation = {
  collection: string;
  id: string;
};

export type ResolveRelationOptions = {
  locales: readonly string[];
  listed: Readonly<Record<string, CollectionConfig>>;
  collections: Readonly<Record<string, CollectionEntryLike[]>>;
  getContentById: (locale: string, entryId: string) => CollectionEntryLike | undefined;
  where?: string;
};

function relatedTargets(): Set<string> {
  const g = globalThis as Record<symbol, Set<string> | undefined>;
  let set = g[RELATED_TARGETS];
  if (!set) {
    set = new Set();
    g[RELATED_TARGETS] = set;
  }
  return set;
}

export function relatedTargetNames(): string[] {
  return [...relatedTargets()];
}

function describeEntry(collection: string, entry: CollectionEntryLike): string {
  return entry.filePath ?? `${collection}:${entry.id}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

function isRelation(value: unknown): value is Relation {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (
    keys.length !== 2 ||
    typeof value.collection !== 'string' ||
    value.collection.length === 0 ||
    typeof value.id !== 'string' ||
    value.id.length === 0
  ) {
    return false;
  }
  return relatedTargets().has(value.collection);
}

function isLocaleMap(value: unknown, locales: readonly string[]): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.length === locales.length && locales.every((code) => keys.includes(code));
}

function fail(message: string, where?: string): never {
  throw new Error(where ? `${message} (${where}).` : `${message}.`);
}

export function collectRelations(value: unknown): Relation[] {
  if (isRelation(value)) return [value];
  if (Array.isArray(value)) return value.flatMap(collectRelations);
  if (isPlainObject(value)) return Object.values(value).flatMap(collectRelations);
  return [];
}

export function relation(collection: string) {
  if (!collection) {
    throw new Error('@repo/astro-intl: relation() needs a collection name.');
  }
  relatedTargets().add(collection);
  return z
    .string()
    .min(1)
    .transform((id): Relation => ({ collection, id }));
}

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

function peelLocalized(
  data: Record<string, unknown>,
  locale: string,
  locales: readonly string[],
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    next[key] = isLocaleMap(value, locales) ? localizedValue(value, locale) : value;
  }
  return next;
}

export function resolveRelation(
  locale: string,
  rel: Relation,
  options: ResolveRelationOptions,
): CollectionEntryLike {
  const { listed, collections, getContentById, locales, where } = options;
  if (!(rel.collection in collections)) {
    fail(`@repo/astro-intl: collections.${rel.collection} is not a content collection`, where);
  }
  let entry: CollectionEntryLike | undefined;
  if (rel.collection in listed) {
    entry = getContentById(locale, `${rel.collection}/${rel.id}`);
    if (!entry) {
      fail(
        `@repo/astro-intl: relation ${rel.collection}/${rel.id} is missing locale "${locale}"`,
        where,
      );
    }
  } else {
    // Unlisted files key by filename (Astro entry id).
    entry = collections[rel.collection]?.find((item) => item.id === rel.id);
    if (!entry) {
      fail(`@repo/astro-intl: relation ${rel.collection}/${rel.id} is missing`, where);
    }
  }
  return { ...entry, data: peelLocalized(entry.data, locale, locales) };
}

export function assertRelations(options: Omit<ResolveRelationOptions, 'where'>): void {
  const { locales, listed, collections, getContentById } = options;
  const resolve = {
    locales,
    listed,
    collections,
    getContentById,
  };

  for (const [name, entries] of Object.entries(collections)) {
    const localeField = listed[name]?.localeField ?? 'locale';
    for (const entry of entries) {
      const sourceLocale =
        typeof entry.data[localeField] === 'string' && entry.data[localeField].length > 0
          ? entry.data[localeField]
          : undefined;
      const where = describeEntry(name, entry);

      for (const rel of collectRelations(entry.data)) {
        if (rel.collection in listed) {
          const localesToCheck = sourceLocale ? [sourceLocale] : locales;
          for (const code of localesToCheck) {
            resolveRelation(code, rel, { ...resolve, where });
          }
        } else {
          resolveRelation(sourceLocale ?? locales[0], rel, { ...resolve, where });
        }
      }
    }
  }
}
