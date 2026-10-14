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
 * Posts, authors, sources, and roles for relation expectations.
 * Blog pairing id `hello-world`: en entry `hello-en` slug `hello-world`, de entry `hello-de` slug `hallo-welt`.
 * Each post points at author `ada`, source `astro`, and role `editor`.
 * Authors are translated. Pairing id `ada`: en entry `ada-en` name `Ada`, de entry `ada-de` name `Ada DE`.
 * Source is untranslated. Its collection entry id is `astro`, and its name is `Astro`.
 * Role is untranslated. Its collection entry id is `editor`. `name` is `{ en: 'Editor', de: 'Redakteur' }`.
 * A missing source or role is reported on `blog:hello-en`, the first post.
 */
export function linkedCollections(): Record<string, CollectionEntry[]> {
  const post = (locale: 'en' | 'de', leaf: string) =>
    collectionEntry('blog', `hello-${locale}`, {
      id: 'hello-world',
      locale,
      slug: leaf,
      author: relation('authors', 'ada'),
      source: relation('sources', 'astro'),
      role: relation('roles', 'editor'),
    });
  return {
    blog: [post('en', 'hello-world'), post('de', 'hallo-welt')],
    authors: [
      collectionEntry('authors', 'ada-en', { id: 'ada', locale: 'en', name: 'Ada' }),
      collectionEntry('authors', 'ada-de', { id: 'ada', locale: 'de', name: 'Ada DE' }),
    ],
    sources: [collectionEntry('sources', 'astro', { name: 'Astro' })],
    roles: [collectionEntry('roles', 'editor', { name: { en: 'Editor', de: 'Redakteur' } })],
  };
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

/** Warnings from the first load. Later calls reuse that load and do not warn again. */
export async function warningsFrom(load: () => Promise<unknown>): Promise<string[]> {
  const lines: string[] = [];
  const original = console.warn;
  console.warn = (message?: unknown) => {
    lines.push(String(message));
  };
  try {
    await load();
    return lines;
  } finally {
    console.warn = original;
  }
}
