import * as z from 'zod';
import { type EntryFields, missingContentCollection } from './define-intl.ts';
import type { CollectionEntryLike } from './pairing.ts';

// `intlRelationTarget` rather than `collection`: Astro checks every stored `{ collection, id }` as a
// `reference()` by collection entry id, but a relation holds the pairing id.
export type Relation = {
  intlRelationTarget: string;
  id: string;
};

export type ResolveRelationOptions = {
  locales: readonly string[];
  /** Translated collections. A key means the relation resolves by pairing id. */
  translated: Readonly<Record<string, EntryFields>>;
  untranslated: ReadonlySet<string>;
  collections: Readonly<Record<string, CollectionEntryLike[]>>;
  getContentById: (locale: string, entryId: string) => CollectionEntryLike | undefined;
  where?: string;
};

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
  return (
    keys.length === 2 &&
    typeof value.intlRelationTarget === 'string' &&
    value.intlRelationTarget.length > 0 &&
    typeof value.id === 'string' &&
    value.id.length > 0
  );
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
  if (Array.isArray(value)) return value.flatMap((item) => collectRelations(item));
  if (isPlainObject(value)) {
    return Object.values(value).flatMap((item) => collectRelations(item));
  }
  return [];
}

/**
 * Binds content-schema helpers to one intl config.
 * `relation` takes a name from `collections.translated` or `collections.untranslated`
 * and throws when the name is in neither. `localized` uses `config.locales`.
 */
export function createIntlSchema<
  const Translated extends string = never,
  const Untranslated extends string = never,
>(config: {
  locales: readonly string[];
  collections?: {
    translated?: readonly Translated[];
    untranslated?: readonly Untranslated[];
  };
}) {
  function relation(name: Translated | Untranslated) {
    const names = new Set<string>([
      ...(config.collections?.translated ?? []),
      ...(config.collections?.untranslated ?? []),
    ]);
    if (!names.has(name)) {
      throw new Error(
        `@repo/astro-intl: relation("${name}") is in neither collections.translated nor collections.untranslated.`,
      );
    }
    return z
      .string()
      .min(1)
      .transform((id): Relation => ({ intlRelationTarget: name, id }));
  }

  function localized<T extends z.ZodType>(value: T) {
    const shape: Record<string, T> = {};
    for (const code of config.locales) {
      shape[code] = value;
    }
    return z.strictObject(shape);
  }

  return { relation, localized };
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
  const { translated, untranslated, collections, getContentById, locales, where } = options;
  const target = rel.intlRelationTarget;
  if (!(target in translated) && !untranslated.has(target)) {
    fail(
      `@repo/astro-intl: relation points at "${target}", which neither collections.translated nor collections.untranslated lists`,
      where,
    );
  }
  if (!(target in collections)) {
    const detail =
      target in translated
        ? missingContentCollection('translated', target)
        : missingContentCollection('untranslated', target);
    fail(`@repo/astro-intl: ${detail}`, where);
  }
  let entry: CollectionEntryLike | undefined;
  if (target in translated) {
    entry = getContentById(locale, `${target}/${rel.id}`);
    if (!entry) {
      fail(`@repo/astro-intl: relation ${target}/${rel.id} is missing locale "${locale}"`, where);
    }
  } else {
    // A target that is not translated matches the collection entry id.
    // A glob loader derives it from the filename.
    entry = collections[target]?.find((item) => item.id === rel.id);
    if (!entry) {
      fail(`@repo/astro-intl: relation ${target}/${rel.id} is missing`, where);
    }
  }
  return { ...entry, data: peelLocalized(entry.data, locale, locales) };
}

export function assertRelations(options: Omit<ResolveRelationOptions, 'where'>): void {
  const { locales, translated, untranslated, collections, getContentById } = options;
  const resolve = {
    locales,
    translated,
    untranslated,
    collections,
    getContentById,
  };

  for (const [name, entries] of Object.entries(collections)) {
    const localeField = translated[name]?.locale ?? 'locale';
    for (const entry of entries) {
      const sourceLocale =
        typeof entry.data[localeField] === 'string' && entry.data[localeField].length > 0
          ? entry.data[localeField]
          : undefined;
      const where = describeEntry(name, entry);

      for (const rel of collectRelations(entry.data)) {
        if (rel.intlRelationTarget in translated) {
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
