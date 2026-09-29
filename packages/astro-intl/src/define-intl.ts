import * as z from 'zod';
import { normalizeSlug, patternSection } from './path.ts';

/** Field names on a translated collection. Each one defaults to the key. */
export const collectionFieldsSchema = z.strictObject({
  id: z.string().min(1).optional(),
  locale: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
});

export type CollectionFields = z.infer<typeof collectionFieldsSchema>;

const collectionsConfigSchema = z.strictObject({
  translated: z.array(z.string().min(1)).optional(),
  untranslated: z.array(z.string().min(1)).optional(),
  fields: z.record(z.string().min(1), collectionFieldsSchema).optional(),
});

export type CollectionsConfig = z.infer<typeof collectionsConfigSchema>;

export function translatedNames(collections: CollectionsConfig | undefined): readonly string[] {
  return collections?.translated ?? [];
}

export function untranslatedNames(collections: CollectionsConfig | undefined): readonly string[] {
  return collections?.untranslated ?? [];
}

/** Translated and untranslated names. A relation may point at either. */
export function relationNames(collections: CollectionsConfig | undefined): readonly string[] {
  return [...translatedNames(collections), ...untranslatedNames(collections)];
}

/** Field names a translated collection's entries use, defaults applied. */
export type EntryFields = Required<CollectionFields>;

export function fieldsFor(collections: CollectionsConfig | undefined, name: string): EntryFields {
  const fields = collections?.fields?.[name];
  return {
    id: fields?.id ?? 'id',
    locale: fields?.locale ?? 'locale',
    slug: fields?.slug ?? 'slug',
  };
}

/** Translated collections keyed by name. A key means the collection is paired. */
export function translatedFields(
  collections: CollectionsConfig | undefined,
): Record<string, EntryFields> {
  const map: Record<string, EntryFields> = {};
  for (const name of translatedNames(collections)) map[name] = fieldsFor(collections, name);
  return map;
}

export function missingContentCollection(
  list: 'translated' | 'untranslated',
  name: string,
): string {
  return `collections.${list}: "${name}" is not a content collection`;
}

const collectionRefSchema = z.union([
  z.string().min(1),
  z.strictObject({
    name: z.string().min(1),
    entry: z.string().min(1).optional(),
  }),
]);

const viewSchema = z.union([z.string().min(1), z.record(z.string(), z.string().min(1))]);

/**
 * Later listing pages. Page 1 is the row's `slug`.
 * `slug` is the full tail per locale. `{page}` is its whole final segment.
 * `view` defaults to the row's view.
 */
const paginationSchema = z.strictObject({
  /** Entries in one chunk. A positive integer. The row does not store a page count. */
  pageSize: z.number(),
  slug: z.record(z.string(), z.string()),
  view: viewSchema.optional(),
});

const routeAuthoringSchema = z.strictObject({
  /** Collection key, or `{ name, entry? }` with the pairing id. */
  collection: collectionRefSchema.optional(),
  slug: z.record(z.string(), z.string()),
  /** View name, or one name per locale. */
  view: viewSchema,
  /** Pages 2 onward. Omitted, the row stays the one tail in `slug`. */
  pagination: paginationSchema.optional(),
  /** Rejected. The chunk width lives on `pagination`. */
  pageSize: z.never({ error: 'pageSize moved to pagination.pageSize' }).optional(),
  /**
   * View for a locale that has no translation. Only on a `{slug}` row.
   * Replaces the config's `fallbackView`; `false` means those URLs 404.
   */
  fallbackView: z.union([z.string().min(1), z.literal(false)]).optional(),
});

type CollectionRef = string | { name: string; entry?: string | undefined };

type ViewName = string | Record<string, string>;

type Pagination = {
  pageSize: number;
  slug: Record<string, string>;
  view?: ViewName | undefined;
};

/** Collection key and optional pairing id. Checkers and pairing read this shape. */
type FlatRoute = {
  slug: Record<string, string>;
  view: ViewName;
  collection?: string | undefined;
  entry?: string | undefined;
  pagination?: Pagination | undefined;
  fallbackView?: string | false | undefined;
};

function flattenRoute(route: {
  slug: FlatRoute['slug'];
  view: FlatRoute['view'];
  collection?: CollectionRef | undefined;
  pagination?: Pagination | undefined;
  fallbackView?: string | false | undefined;
}): FlatRoute {
  const { collection, slug, view, pagination, fallbackView } = route;
  const flat: FlatRoute = { slug, view };
  if (pagination !== undefined) flat.pagination = pagination;
  if (fallbackView !== undefined) flat.fallbackView = fallbackView;
  if (typeof collection === 'object' && collection !== null) {
    flat.collection = collection.name;
    if (collection.entry !== undefined) flat.entry = collection.entry;
    return flat;
  }
  if (collection !== undefined) flat.collection = collection;
  return flat;
}

export const routeConfigSchema = routeAuthoringSchema.transform((route) => flattenRoute(route));

/** Route row an app writes. A sibling `entry` key is not part of this shape. */
export type RouteConfig = z.input<typeof routeConfigSchema>;

type RouteRule = {
  slug: Readonly<Record<string, string>>;
  view: string | Readonly<Record<string, string>>;
  collection?: string | undefined;
  entry?: string | undefined;
  pagination?: {
    pageSize: number;
    slug: Readonly<Record<string, string>>;
    view?: string | Readonly<Record<string, string>> | undefined;
  };
  fallbackView?: string | false | undefined;
};

type RouteRulesConfig = {
  locales: readonly string[];
  fallbackView?: string | undefined;
  routes?: readonly RouteRule[];
  collections?: CollectionsConfig | undefined;
};

function repeatedNameIssues(
  label: 'translated' | 'untranslated',
  names: readonly string[] | undefined,
): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  const reported = new Set<string>();
  for (const name of names ?? []) {
    if (seen.has(name) && !reported.has(name)) {
      reported.add(name);
      issues.push(`collections.${label} lists "${name}" more than once`);
    }
    seen.add(name);
  }
  return issues;
}

function collectionListIssues(collections: CollectionsConfig | undefined): string[] {
  const translated = collections?.translated ?? [];
  const untranslated = collections?.untranslated ?? [];
  const issues = [
    ...repeatedNameIssues('translated', translated),
    ...repeatedNameIssues('untranslated', untranslated),
  ];
  const translatedSet = new Set(translated);
  const reported = new Set<string>();
  for (const name of untranslated) {
    if (!translatedSet.has(name) || reported.has(name)) continue;
    reported.add(name);
    issues.push(`"${name}" is in both collections.translated and collections.untranslated`);
  }
  for (const name of Object.keys(collections?.fields ?? {})) {
    if (!translatedSet.has(name)) {
      issues.push(`collections.fields key "${name}" is not in collections.translated`);
    }
  }
  return issues;
}

function routeWhere(collection: string, entry?: string): string {
  return entry ? `collection "${collection}" entry "${entry}"` : `collection "${collection}"`;
}

const PAGE_TOKEN = '{page}';

/** `{page}` as the whole final segment, and not beside `{slug}`. */
function pageTokenTailIssue(slug: string): string | undefined {
  if (slug.includes('{slug}') && slug.includes(PAGE_TOKEN)) {
    return 'a tail cannot hold both {page} and {slug}';
  }
  const normalized = normalizeSlug(slug);
  const parts = normalized === '/' ? [] : normalized.split('/');
  if (parts.at(-1) !== PAGE_TOKEN) return '{page} must be one whole final segment';
  if (parts.slice(0, -1).some((part) => part.includes('{'))) {
    return '{page} must be one whole final segment';
  }
  return undefined;
}

function localeList(slug: Readonly<Record<string, string>>): string {
  return Object.keys(slug).sort().join(', ');
}

/** `{page}` stays in `pagination.slug`. The row's slug is the page-1 tail. */
function paginationIssues(route: RouteRule): string[] {
  const issues: string[] = [];
  for (const [locale, slug] of Object.entries(route.slug)) {
    if ((slug ?? '').includes(PAGE_TOKEN)) {
      issues.push(`{page} belongs in pagination.slug in locale "${locale}"`);
    }
  }
  const pagination = route.pagination;
  if (!pagination) return issues;
  if (!Number.isInteger(pagination.pageSize) || pagination.pageSize < 1) {
    issues.push('pagination.pageSize must be a positive integer');
  }
  if (!route.collection) issues.push('pagination requires a collection');
  if (route.entry) issues.push('pagination cannot name an entry');
  if (Object.values(route.slug).some((slug) => (slug ?? '').includes('{slug}'))) {
    issues.push('pagination cannot sit on a {slug} row');
  }
  const rowLocales = localeList(route.slug);
  const pageLocales = localeList(pagination.slug);
  if (rowLocales !== pageLocales) {
    issues.push(
      `pagination.slug and slug name different locales (${rowLocales} vs ${pageLocales})`,
    );
  }
  for (const [locale, slug] of Object.entries(pagination.slug)) {
    const issue = pageTokenTailIssue(slug ?? '');
    if (issue) issues.push(`${issue} in locale "${locale}"`);
  }
  return issues;
}

function viewNameIssues(name: string): string[] {
  const issues: string[] = [];
  if (name.endsWith('.astro')) {
    issues.push(`view "${name}" includes a file extension`);
  }
  const parts = name.split('/');
  if (parts.some((part) => part.length === 0 || part === '.' || part === '..')) {
    issues.push(`view "${name}" is not a path`);
  }
  return issues;
}

function viewIssues(
  view: string | Readonly<Record<string, string>>,
  locales: readonly string[],
): string[] {
  if (typeof view === 'string') return viewNameIssues(view);
  const issues: string[] = [];
  const keys = Object.keys(view).sort();
  const expected = [...locales].sort();
  if (keys.join('\0') !== expected.join('\0')) {
    issues.push(`view keys must be the configured locales (${expected.join(', ')})`);
  }
  for (const name of Object.values(view)) issues.push(...viewNameIssues(name));
  return issues;
}

/**
 * Structural route and collection-list rules.
 * Compiled-path collisions are checked while pairing.
 * Repeated route patterns throw in `compileRoutes`.
 */
export function routeConfigIssues(config: RouteRulesConfig): string[] {
  const issues: string[] = collectionListIssues(config.collections);
  const seenEntries = new Set<string>();
  const seenPatterns = new Set<string>();
  const seenSections = new Set<string>();
  const translated = new Set(config.collections?.translated ?? []);

  if (config.fallbackView !== undefined) issues.push(...viewNameIssues(config.fallbackView));

  for (const route of config.routes ?? []) {
    issues.push(...viewIssues(route.view, config.locales));
    if (route.pagination?.view !== undefined) {
      for (const issue of viewIssues(route.pagination.view, config.locales)) {
        issues.push(issue.replace(/^view /u, 'pagination.view '));
      }
    }
    issues.push(...paginationIssues(route));
    if (route.fallbackView !== undefined) {
      if (route.fallbackView !== false) issues.push(...viewNameIssues(route.fallbackView));
      const hasSlug = config.locales.some((locale) =>
        (route.slug[locale] ?? '').includes('{slug}'),
      );
      if (!hasSlug) issues.push('fallbackView needs a {slug} row');
    }

    if (!route.collection) {
      for (const locale of config.locales) {
        if (!(locale in route.slug)) {
          issues.push(`route with no collection slug missing locale "${locale}"`);
          continue;
        }
        const slug = route.slug[locale] ?? '';
        if (slug.includes('{slug}')) {
          issues.push('{slug} pattern has no collection');
          continue;
        }
        if (slug === '') {
          issues.push(`route with no collection slug for locale "${locale}" is not a fixed tail`);
        }
      }
      continue;
    }

    const collectionName = route.collection;
    const where = routeWhere(collectionName, route.entry);
    const wantsPattern = config.locales.some((locale) =>
      (route.slug[locale] ?? '').includes('{slug}'),
    );
    if (!translated.has(collectionName)) {
      issues.push(`collection "${collectionName}" is not in collections.translated`);
    }

    if (route.entry) {
      const key = `${collectionName}/${route.entry}`;
      if (seenEntries.has(key)) {
        issues.push(`entry "${route.entry}" repeats in collection "${collectionName}"`);
      }
      seenEntries.add(key);
    }

    if (!wantsPattern) {
      for (const locale of config.locales) {
        if (!(locale in route.slug)) {
          issues.push(`route ${where} slug missing locale "${locale}"`);
          continue;
        }
        const slug = route.slug[locale] ?? '';
        if (slug === '') {
          issues.push(`route ${where} slug for locale "${locale}" is not a fixed tail`);
        }
      }
      continue;
    }

    let addedPattern = false;
    if (seenPatterns.has(collectionName)) {
      issues.push(`two pattern rows name collection "${collectionName}"`);
    } else {
      seenPatterns.add(collectionName);
      addedPattern = true;
    }

    let patternOk = true;
    for (const locale of config.locales) {
      if (!(locale in route.slug)) {
        issues.push(`route ${where} slug missing locale "${locale}"`);
        patternOk = false;
        continue;
      }
      const slug = route.slug[locale] ?? '';
      const section = patternSection(slug);
      if (!section) {
        issues.push(
          `route ${where} slug for locale "${locale}" must use {slug} as the final segment`,
        );
        patternOk = false;
        continue;
      }
      const sectionKey = `${locale}\0${section}`;
      if (seenSections.has(sectionKey)) {
        issues.push(`duplicate section "${section}" for locale "${locale}"`);
      }
      seenSections.add(sectionKey);
    }
    if (!patternOk && addedPattern) seenPatterns.delete(collectionName);
  }

  return issues;
}

export const intlConfigSchema = z
  .strictObject({
    locales: z.array(z.string().min(1)).min(1),
    defaultLocale: z.string().min(1),
    /**
     * Locale prefix policy, written through to Astro `i18n`.
     * Omitted means `prefixDefaultLocale: false`: the default locale lives at `/`.
     */
    routing: z
      .strictObject({
        prefixDefaultLocale: z.boolean().default(false),
        redirectToDefaultLocale: z.boolean().optional(),
      })
      .prefault({}),
    routes: z.array(routeConfigSchema).optional(),
    /**
     * When injected views render. `'build'` prerenders them. `'request'` renders
     * static, entry, and listing routes per request. Fallback routes stay
     * prerendered. A view's `prerender` export wins. A fallback view must not
     * export `prerender = false`. An on-demand `pagination.slug` route that shares
     * its shape with a `{slug}` route fails startup. Omitted means `'build'`.
     * No effect under `astro dev`.
     */
    viewRendering: z.enum(['build', 'request']).optional(),
    /** View for a locale that has no translation, on every `{slug}` row that names none. */
    fallbackView: z.string().min(1).optional(),
    /**
     * Translated collections are paired on id and locale.
     * Untranslated collections are relation targets looked up by entry id.
     * `fields` renames id, locale, or slug on a translated collection.
     * Omitted means none.
     */
    collections: collectionsConfigSchema.optional(),
    reservedPaths: z.array(z.string().min(1)).optional(),
  })
  .refine((config) => config.locales.includes(config.defaultLocale), {
    error: 'defaultLocale must be one of locales',
  })
  .refine((config) => new Set(config.locales).size === config.locales.length, {
    error: 'locales values must be unique',
  })
  .superRefine((config, ctx) => {
    for (const message of routeConfigIssues(config)) {
      ctx.addIssue({ code: 'custom', message });
    }
  });

export type IntlConfig = z.infer<typeof intlConfigSchema>;

export type IntlConfigInput = z.input<typeof intlConfigSchema>;

/** Objects returned by `safeParseIntlConfig`. */
const parsedIntlConfigs = new WeakSet<object>();

/** Whether `config` was returned by `safeParseIntlConfig`. */
export function isParsedIntlConfig(config: object): config is IntlConfig {
  return parsedIntlConfigs.has(config);
}

/**
 * Parses an authored intl config and records the returned object.
 * Returns the Zod issues instead of throwing.
 */
export function safeParseIntlConfig(input: unknown): ReturnType<typeof intlConfigSchema.safeParse> {
  const parsed = intlConfigSchema.safeParse(input);
  if (parsed.success) parsedIntlConfigs.add(parsed.data);
  return parsed;
}

/** Locale union of a config that lists `locales`. */
export type LocaleOf<C extends { locales: readonly string[] }> = C['locales'][number];

/** Typed helper for `src/intl.config.ts`. Validation runs when `astroIntl()` loads the file. */
export function defineIntl<const L extends string>(
  config: Omit<IntlConfigInput, 'locales' | 'defaultLocale'> & {
    locales: L[];
    defaultLocale: NoInfer<L>;
  },
) {
  return config;
}
