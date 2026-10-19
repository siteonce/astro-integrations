import * as z from 'zod';
import type { EntryFields } from './define-intl.ts';
import type { Locale } from './intl-register.ts';
import type { CollectionEntryLike } from './pairing.ts';

// `intlRelationTarget` rather than `collection`: Astro checks every stored `{ collection, id }` as a
// `reference()` by collection entry id, but a relation holds the pairing id. `C` is that collection.
export type Relation<C extends string = string> = {
  intlRelationTarget: C;
  id: string;
};

export type ResolveRelationOptions = {
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
  return typeof value.intlRelationTarget === 'string' && typeof value.id === 'string';
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
  function relation<Name extends Translated | Untranslated>(name: Name) {
    const names = new Set<string>([
      ...(config.collections?.translated ?? []),
      ...(config.collections?.untranslated ?? []),
    ]);
    if (!names.has(name)) {
      throw new Error(
        `@siteonce/astro-intl: relation("${name}") is in neither collections.translated nor collections.untranslated.`,
      );
    }
    return z
      .string()
      .min(1)
      .transform((id): Relation<Name> => ({ intlRelationTarget: name, id }));
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

export function localizedValue<T>(field: Readonly<Record<string, T>>, locale: Locale): T {
  if (!(locale in field)) {
    throw new Error(`@siteonce/astro-intl: localized field missing locale "${locale}".`);
  }
  return field[locale] as T;
}

function relationTarget(rel: Relation, options: ResolveRelationOptions): string {
  const { translated, untranslated, where } = options;
  const target = rel.intlRelationTarget;
  if (!(target in translated) && !untranslated.has(target)) {
    fail(
      `@siteonce/astro-intl: relation points at "${target}", which neither collections.translated nor collections.untranslated lists`,
      where,
    );
  }
  return target;
}

function resolveUntranslated(
  target: string,
  rel: Relation,
  options: ResolveRelationOptions,
): CollectionEntryLike {
  // A target that is not translated matches the collection entry id.
  // A glob loader derives it from the filename.
  const entry = options.collections[target]?.find((item) => item.id === rel.id);
  if (!entry) {
    fail(`@siteonce/astro-intl: relation ${target}/${rel.id} is missing`, options.where);
  }
  return entry;
}

export function resolveRelation(
  locale: string,
  rel: Relation,
  options: ResolveRelationOptions,
): CollectionEntryLike {
  const { translated, getContentById, where } = options;
  const target = relationTarget(rel, options);
  if (!(target in translated)) return resolveUntranslated(target, rel, options);
  const entry = getContentById(locale, `${target}/${rel.id}`);
  if (!entry) {
    fail(`@siteonce/astro-intl: relation ${target}/${rel.id} is missing locale "${locale}"`, where);
  }
  return entry;
}

export function assertRelations(
  options: Omit<ResolveRelationOptions, 'where'> & { locales: readonly string[] },
): void {
  const { locales, translated, untranslated, collections, getContentById } = options;
  const resolve = {
    translated,
    untranslated,
    collections,
    getContentById,
  };

  for (const [name, entries] of Object.entries(collections)) {
    // An untranslated entry is checked in every locale. A locale field on it
    // does not narrow that. A translated entry is checked in its own locale.
    const localeField = translated[name]?.locale;
    for (const entry of entries) {
      const where = describeEntry(name, entry);
      const localesToCheck = localeField ? [entry.data[localeField] as string] : locales;

      for (const rel of collectRelations(entry.data)) {
        for (const code of localesToCheck) {
          resolveRelation(code, rel, { ...resolve, where });
        }
      }
    }
  }
}
