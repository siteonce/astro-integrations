import * as z from 'zod';
import { normalizeSlug, patternSection } from './path.ts';

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
  collections?: Readonly<Record<string, { slugField?: string | undefined }>>;
};

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
