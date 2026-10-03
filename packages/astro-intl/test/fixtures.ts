/**
 * Configs, collection entries, and `createIntl` loaders for intl tests.
 * URL stubs stand in for `astro:i18n`. Collection maps stand in for `astro:content`.
 */

import type { astroIntl, createIntl, Relation } from '@repo/astro-intl';

/** Authored intl config: the argument of `astroIntl` and `createIntl`. */
export type IntlConfigInput = Parameters<typeof astroIntl>[0];

/** Loaders `createIntl` accepts in place of `astro:content` and `astro:i18n`. */
export type IntlLoaders = NonNullable<NonNullable<Parameters<typeof createIntl>[1]>['loaders']>;

/** One collection entry, as `getCollection` returns it. `id` is Astro's entry id. */
export type CollectionEntry = Awaited<ReturnType<IntlLoaders['getCollection']>>[number];

/**
 * Locales `en` and `de`, default `en`, `prefixDefaultLocale: true`.
 * Fields on `extra` replace those. A nested object such as `routing` replaces the whole object.
 */
export function intlConfig(extra: Partial<IntlConfigInput> = {}): IntlConfigInput {
  return {
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: true },
    ...extra,
  };
}

/**
 * One collection entry. `id` is Astro's entry id. The pairing id lives in `data`.
 * `filePath` is set only when passed.
 */
export function collectionEntry(
  collection: string,
  id: string,
  data: Record<string, unknown>,
  filePath?: string,
): CollectionEntry {
  return filePath === undefined ? { id, collection, data } : { id, collection, data, filePath };
}

/** Blog rows: pin, alpha in en and de, solo, mehr, and an en slug that clashes with mehr. */
export function blogEntries(): CollectionEntry[] {
  return [
    collectionEntry('blog', 'pin-en', { id: 'pin', locale: 'en', slug: 'pin-slug' }),
    collectionEntry('blog', 'alpha-en', { id: 'alpha', locale: 'en', slug: 'alpha' }),
    collectionEntry('blog', 'alpha-de', { id: 'alpha', locale: 'de', slug: 'anders' }),
    collectionEntry('blog', 'solo-en', { id: 'solo', locale: 'en', slug: 'solo' }),
    collectionEntry('blog', 'mehr-de', { id: 'mehr', locale: 'de', slug: 'mehr' }),
    collectionEntry('blog', 'clash-en', { id: 'clash', locale: 'en', slug: 'mehr' }),
  ];
}

/**
 * About, the featured pin, a blog listing of page size 1, and `blog/{slug}` with a fallback view.
 * The pin row authors `collection` as `{ name, entry }`.
 */
export function blogRoutes(): NonNullable<IntlConfigInput['routes']> {
  return [
    { slug: { en: 'about', de: 'ueber' }, view: 'about' },
    {
      slug: { en: 'featured', de: 'hervorgehoben' },
      view: 'featured',
      collection: { name: 'blog', entry: 'pin' },
    },
    {
      slug: { en: 'blog', de: 'artikel' },
      view: 'index',
      collection: 'blog',
      pagination: { pageSize: 1, slug: { en: 'blog/{page}', de: 'artikel/{page}' } },
    },
    {
      slug: { en: 'blog/{slug}', de: 'artikel/{slug}' },
      view: 'post',
      collection: 'blog',
      fallbackView: 'missing',
    },
  ];
}

/** Translated `blog` and `authors`. Untranslated `sources` and `roles`. */
export function pairedCollections(): NonNullable<IntlConfigInput['collections']> {
  return {
    translated: ['blog', 'authors'],
    untranslated: ['sources', 'roles'],
  };
}

/** A relation pointer. `target` is the collection name. `id` is the id that collection stores. */
export function relation<C extends string>(target: C, id: string): Relation<C> {
  return { intlRelationTarget: target, id };
}

/**
 * `https://example.com/en/blog/hello`.
 * An empty path is the locale root, with no trailing slash.
 */
export function absoluteLocaleUrl(locale: string, path = ''): string {
  return `https://example.com/${locale}${path ? `/${path}` : ''}`;
}

/** `/en/blog/hello/`. An empty path is `/en/`. */
export function relativeLocaleUrl(locale: string, path = ''): string {
  return `/${locale}${path ? `/${path}` : ''}/`;
}

/**
 * Loaders over `collections`.
 * An absent name returns `[]`, or throws `missing ${name}` when `strict` is set.
 * Each requested name is appended to `loaded` when that array is passed.
 * URL reads default to `absoluteLocaleUrl` and `relativeLocaleUrl`.
 */
export function collectionLoaders(
  collections: Readonly<Record<string, readonly CollectionEntry[]>>,
  options?: {
    loaded?: string[];
    strict?: boolean;
    absolute?: IntlLoaders['getAbsoluteLocaleUrl'];
    relative?: IntlLoaders['getRelativeLocaleUrl'];
  },
): IntlLoaders {
  return {
    async getCollection(name: string) {
      options?.loaded?.push(name);
      if (!(name in collections)) {
        if (options?.strict) throw new Error(`missing ${name}`);
        return [];
      }
      return [...(collections[name] ?? [])];
    },
    getAbsoluteLocaleUrl: options?.absolute ?? absoluteLocaleUrl,
    getRelativeLocaleUrl: options?.relative ?? relativeLocaleUrl,
  };
}

/** Listing order that keeps the loaded order. The comparator returns 0. */
export function keepOrder() {
  return { sort: () => () => 0 as const };
}
