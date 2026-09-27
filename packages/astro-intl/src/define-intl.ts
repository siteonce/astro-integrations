import * as z from 'zod';
import { normalizeSlug, patternSection } from './path.ts';

const DEFAULT_MESSAGES_DIR = 'messages';

export const collectionConfigSchema = z.strictObject({
  idField: z.string().min(1).optional(),
  localeField: z.string().min(1).optional(),
  slugField: z.string().min(1).optional(),
});

export type CollectionConfig = z.infer<typeof collectionConfigSchema>;

const collectionRefSchema = z.union([
  z.string().min(1),
  z.strictObject({
    name: z.string().min(1),
    entry: z.string().min(1).optional(),
  }),
]);

const routeAuthoringSchema = z.strictObject({
  /** Collection key, or `{ name, entry? }` with the pairing id. */
  collection: collectionRefSchema.optional(),
  slug: z.record(z.string(), z.string()),
  /** View name, or one name per locale. */
  view: z.union([z.string().min(1), z.record(z.string(), z.string().min(1))]),
  /**
   * Entries in one chunk. The page-1 row and the `{page}` row set the same value.
   * Omitted, the row is that one tail.
   */
  pageSize: z.number().int().positive().optional(),
  /**
   * View for a locale that has no translation. Only on a `{slug}` row.
   * Replaces the config's `fallbackView`; `false` means those URLs 404.
   */
  fallbackView: z.union([z.string().min(1), z.literal(false)]).optional(),
});

type CollectionRef = string | { name: string; entry?: string | undefined };

/** Collection key and optional pairing id. Checkers and pairing read this shape. */
type FlatRoute = {
  slug: Record<string, string>;
  view: string | Record<string, string>;
  collection?: string | undefined;
  entry?: string | undefined;
  pageSize?: number | undefined;
  fallbackView?: string | false | undefined;
};

function flattenRoute(route: {
  slug: FlatRoute['slug'];
  view: FlatRoute['view'];
  collection?: CollectionRef | undefined;
  pageSize?: number | undefined;
  fallbackView?: string | false | undefined;
}): FlatRoute {
  const { collection, slug, view, pageSize, fallbackView } = route;
  const flat: FlatRoute = { slug, view };
  if (pageSize !== undefined) flat.pageSize = pageSize;
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
  pageSize?: number | undefined;
  fallbackView?: string | false | undefined;
};

type RouteRulesConfig = {
  locales: readonly string[];
  fallbackView?: string | undefined;
  routes?: readonly RouteRule[];
  collections?: Readonly<Record<string, { slugField?: string | undefined }>>;
};

function routeWhere(collection: string, entry?: string): string {
  return entry ? `collection "${collection}" entry "${entry}"` : `collection "${collection}"`;
}

function pageSizeIssue(pageSize: number | undefined): string | undefined {
  if (pageSize === undefined) return undefined;
  if (!Number.isInteger(pageSize) || pageSize < 1) return 'pageSize must be a positive integer';
  return undefined;
}

const PAGE_TOKEN = '{page}';

type ListingRoute = {
  slug: Readonly<Record<string, string>>;
  collection?: string | undefined;
  entry?: string | undefined;
  pageSize?: number | undefined;
};

/** True when any tail on the row contains `{page}`. */
export function isPageTokenRow(route: { slug: Readonly<Record<string, string>> }): boolean {
  return Object.values(route.slug).some((slug) => slug.includes(PAGE_TOKEN));
}

/**
 * The page-1 row and the `{page}` row that share `collection` and `pageSize`.
 * `undefined` when this row is not one of those, or its partner is missing.
 */
export function listingPair<T extends ListingRoute>(
  routes: readonly T[],
  row: T,
): { pageOne: T; pageRow: T } | undefined {
  if (!isListingChunk(row)) return undefined;
  const partner = routes.find(
    (other) =>
      other !== row &&
      isListingChunk(other) &&
      other.collection === row.collection &&
      other.pageSize === row.pageSize &&
      isPageTokenRow(other) !== isPageTokenRow(row),
  );
  if (!partner) return undefined;
  return isPageTokenRow(row)
    ? { pageOne: partner, pageRow: row }
    : { pageOne: row, pageRow: partner };
}

function isListingChunk(route: ListingRoute): boolean {
  return (
    route.collection !== undefined &&
    route.pageSize !== undefined &&
    pageSizeIssue(route.pageSize) === undefined &&
    !route.entry
  );
}

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

function pageTokenRowIssues(route: RouteRule): string[] {
  const issues: string[] = [];
  if (!route.collection) issues.push('{page} row needs a collection');
  if (route.pageSize === undefined) issues.push('{page} row needs pageSize');
  if (route.entry) issues.push('{page} row cannot name an entry');
  for (const [locale, slug] of Object.entries(route.slug)) {
    const issue = pageTokenTailIssue(slug ?? '');
    if (issue) issues.push(`${issue} in locale "${locale}"`);
  }
  return issues;
}

function isPageOneRow(route: RouteRule): boolean {
  if (!isListingChunk(route) || isPageTokenRow(route)) return false;
  return !Object.values(route.slug).some((slug) => (slug ?? '').includes('{slug}'));
}

function isValidPageRow(route: RouteRule): boolean {
  if (!isPageTokenRow(route) || !isListingChunk(route)) return false;
  return Object.values(route.slug).every((slug) => pageTokenTailIssue(slug ?? '') === undefined);
}

function localeList(route: RouteRule): string {
  return Object.keys(route.slug).sort().join(', ');
}

/** Page-1 rows and `{page}` rows that share a collection and `pageSize` must pair. */
function listingPairIssues(routes: readonly RouteRule[]): string[] {
  const issues: string[] = [];
  const pageOnes = new Map<string, RouteRule[]>();
  const pageRows = new Map<string, RouteRule[]>();
  for (const route of routes) {
    if (!route.collection || route.pageSize === undefined) continue;
    const key = `${route.collection}\0${route.pageSize}`;
    if (isValidPageRow(route)) {
      const list = pageRows.get(key) ?? [];
      list.push(route);
      pageRows.set(key, list);
    } else if (isPageOneRow(route)) {
      const list = pageOnes.get(key) ?? [];
      list.push(route);
      pageOnes.set(key, list);
    }
  }
  for (const key of new Set([...pageOnes.keys(), ...pageRows.keys()])) {
    const separator = key.indexOf('\0');
    const collection = key.slice(0, separator);
    const size = key.slice(separator + 1);
    const ones = pageOnes.get(key) ?? [];
    const pages = pageRows.get(key) ?? [];
    if (ones.length > 1) {
      issues.push(`two page-1 rows name collection "${collection}" pageSize ${size}`);
    }
    if (pages.length > 1) {
      issues.push(`two {page} rows name collection "${collection}" pageSize ${size}`);
    }
    if (ones.length === 0) {
      issues.push(`{page} row for collection "${collection}" pageSize ${size} has no page-1 row`);
    }
    if (pages.length === 0) {
      issues.push(
        `page-1 row for collection "${collection}" pageSize ${size} has no {page} row. Add a {page} row.`,
      );
    }
    const pageOne = ones[0];
    const pageRow = pages[0];
    if (ones.length === 1 && pages.length === 1 && pageOne && pageRow) {
      const left = localeList(pageOne);
      const right = localeList(pageRow);
      if (left !== right) {
        issues.push(
          `page-1 row and {page} row for collection "${collection}" pageSize ${size} name different locales (${left} vs ${right})`,
        );
      }
    }
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
 * Structural route rules. Compiled-path collisions are checked while pairing.
 * Repeated route patterns throw in `compileRoutes`.
 */
export function routeConfigIssues(config: RouteRulesConfig): string[] {
  const issues: string[] = [];
  const seenEntries = new Set<string>();
  const seenPatterns = new Set<string>();
  const seenSections = new Set<string>();
  const listed = config.collections ?? {};

  if (config.fallbackView !== undefined) issues.push(...viewNameIssues(config.fallbackView));

  for (const route of config.routes ?? []) {
    issues.push(...viewIssues(route.view, config.locales));
    if (route.fallbackView !== undefined) {
      if (route.fallbackView !== false) issues.push(...viewNameIssues(route.fallbackView));
      const hasSlug = config.locales.some((locale) =>
        (route.slug[locale] ?? '').includes('{slug}'),
      );
      if (!hasSlug) issues.push('fallbackView needs a {slug} row');
    }

    const sizeIssue = pageSizeIssue(route.pageSize);
    if (sizeIssue) issues.push(sizeIssue);
    if (isPageTokenRow(route)) issues.push(...pageTokenRowIssues(route));

    if (!route.collection) {
      if (route.pageSize !== undefined) issues.push('pageSize requires a collection tail');
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
    const collection = listed[collectionName];
    if (!collection) issues.push(`collection "${collectionName}" is not listed`);

    if (route.entry) {
      const key = `${collectionName}/${route.entry}`;
      if (seenEntries.has(key)) {
        issues.push(`entry "${route.entry}" repeats in collection "${collectionName}"`);
      }
      seenEntries.add(key);
    }

    if (!wantsPattern) {
      if (route.pageSize !== undefined && route.entry) {
        issues.push(`pageSize requires a collection tail (${where})`);
      }
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

    if (route.pageSize !== undefined) {
      issues.push(`pageSize requires a collection tail (${where})`);
    }
    if (collection && !collection.slugField) {
      issues.push(`pattern row on collection "${collectionName}" which has no slugField`);
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

  for (const [name, collection] of Object.entries(listed)) {
    if (collection.slugField && !seenPatterns.has(name)) {
      issues.push(`collections.${name} has no {slug} row`);
    }
  }

  issues.push(...listingPairIssues(config.routes ?? []));
  return issues;
}

export const intlConfigSchema = z
  .strictObject({
    locales: z.array(z.string().min(1)).min(1),
    defaultLocale: z.string().min(1),
    routing: z.strictObject({
      prefixDefaultLocale: z.boolean(),
      redirectToDefaultLocale: z.boolean().optional(),
    }),
    messages: z
      .strictObject({
        dir: z.string().min(1),
      })
      .optional(),
    routes: z.array(routeConfigSchema).optional(),
    /**
     * When injected views render. `'build'` prerenders them. `'request'` renders
     * static, entry, and listing routes per request. Fallback routes stay
     * prerendered. A view's `prerender` export wins. A fallback view must not
     * export `prerender = false`. An on-demand `{page}` route that shares its
     * shape with a `{slug}` route fails startup. Omitted means `'build'`.
     * No effect under `astro dev`.
     */
    viewRendering: z.enum(['build', 'request']).optional(),
    /** View for a locale that has no translation, on every `{slug}` row that names none. */
    fallbackView: z.string().min(1).optional(),
    collections: z.record(z.string(), collectionConfigSchema).optional(),
    /**
     * Collections a relation can point at.
     * `{ target, id }` is a relation only when `target` is in this list.
     * Omitted means none.
     */
    relationTargets: z.array(z.string().min(1)).optional(),
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

/**
 * Stores a collection object as its key and optional pairing id.
 * A config that is already that pair is returned unchanged.
 */
export function flattenIntlConfig(config: IntlConfigInput | IntlConfig): IntlConfig {
  if (
    !config.routes?.some(
      (route) => typeof route.collection === 'object' && route.collection !== null,
    )
  ) {
    return config as IntlConfig;
  }
  return {
    ...config,
    routes: config.routes.map((route) => flattenRoute(route)),
  } as IntlConfig;
}

/** Typed helper for `src/intl.config.ts`. Validation runs when `astroIntl()` loads the file. */
export function defineIntl(config: IntlConfigInput): IntlConfigInput {
  return config;
}

export function messagesDir(config: IntlConfig): string {
  return config.messages?.dir ?? DEFAULT_MESSAGES_DIR;
}
