import * as z from 'zod';
import type { CollectionConfig } from './define-intl.ts';
import type { CollectionEntryLike } from './pairing.ts';
import { getIntlRuntime } from './runtime.ts';

// Names `relation()` has seen in this process. The build compares them with
// `relationTargets`. The server bundle does not load `content.config.ts`, so
// this set stays empty there.
const RELATED_TARGETS = Symbol.for('@repo/astro-intl/related-targets');

// `target` rather than `collection`: Astro checks every stored `{ collection, id }` as a
// `reference()` by collection entry id, but a relation holds the pairing id.
export type Relation = {
  target: string;
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

/** Collections `relationTargets` lists. Omitted means none. */
export function relatedTargetNames(): string[] {
  return [...(getIntlRuntime().config.relationTargets ?? [])];
}

/** Names `relation()` recorded in this process. Empty in the server bundle. */
export function recordedRelationNames(): string[] {
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

function isRelation(value: unknown, targets: ReadonlySet<string>): value is Relation {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (
    keys.length !== 2 ||
    typeof value.target !== 'string' ||
    value.target.length === 0 ||
    typeof value.id !== 'string' ||
    value.id.length === 0
  ) {
    return false;
  }
  return targets.has(value.target);
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
  return collectRelationsIn(value, new Set(relatedTargetNames()));
}

function collectRelationsIn(value: unknown, targets: ReadonlySet<string>): Relation[] {
  if (isRelation(value, targets)) return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectRelationsIn(item, targets));
  if (isPlainObject(value)) {
    return Object.values(value).flatMap((item) => collectRelationsIn(item, targets));
  }
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
    .transform((id): Relation => ({ target: collection, id }));
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
  if (!(rel.target in collections)) {
    fail(`@repo/astro-intl: collections.${rel.target} is not a content collection`, where);
  }
  let entry: CollectionEntryLike | undefined;
  if (rel.target in listed) {
    entry = getContentById(locale, `${rel.target}/${rel.id}`);
    if (!entry) {
      fail(
        `@repo/astro-intl: relation ${rel.target}/${rel.id} is missing locale "${locale}"`,
        where,
      );
    }
  } else {
    // Unlisted targets match the collection entry id. A glob loader derives it from the filename.
    entry = collections[rel.target]?.find((item) => item.id === rel.id);
    if (!entry) {
      fail(`@repo/astro-intl: relation ${rel.target}/${rel.id} is missing`, where);
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
        if (rel.target in listed) {
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
