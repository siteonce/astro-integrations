import * as z from 'zod';
import { patternSection } from './path.ts';

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
  /** Entries in one chunk of a collection tail. Omitted, the row is that one tail. */
  pageSize: z.number().int().positive().optional(),
  /**
   * View for a locale that has no translation. Only on a `{slug}` row.
   * Replaces the config's `missingView`; `false` means those URLs 404.
   */
  missingView: z.union([z.string().min(1), z.literal(false)]).optional(),
});

type CollectionRef = string | { name: string; entry?: string | undefined };

/** Collection key and optional pairing id. Checkers and pairing read this shape. */
type FlatRoute = {
  slug: Record<string, string>;
  view: string | Record<string, string>;
  collection?: string | undefined;
  entry?: string | undefined;
  pageSize?: number | undefined;
  missingView?: string | false | undefined;
};

function flattenRoute(route: {
  slug: FlatRoute['slug'];
  view: FlatRoute['view'];
  collection?: CollectionRef | undefined;
  pageSize?: number | undefined;
  missingView?: string | false | undefined;
}): FlatRoute {
  const { collection, slug, view, pageSize, missingView } = route;
  const flat: FlatRoute = { slug, view };
  if (pageSize !== undefined) flat.pageSize = pageSize;
  if (missingView !== undefined) flat.missingView = missingView;
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
  missingView?: string | false | undefined;
};

type RouteRulesConfig = {
  locales: readonly string[];
  missingView?: string | undefined;
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

  if (config.missingView !== undefined) issues.push(...viewNameIssues(config.missingView));

  for (const route of config.routes ?? []) {
    issues.push(...viewIssues(route.view, config.locales));
    if (route.missingView !== undefined) {
      if (route.missingView !== false) issues.push(...viewNameIssues(route.missingView));
      const hasSlug = config.locales.some((locale) =>
        (route.slug[locale] ?? '').includes('{slug}'),
      );
      if (!hasSlug) issues.push('missingView needs a {slug} row');
    }

    const sizeIssue = pageSizeIssue(route.pageSize);
    if (sizeIssue) issues.push(sizeIssue);

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
     * static and entry routes per request. Listing and missing routes stay
     * prerendered. A view's `prerender` export wins, except a listing or missing
     * view must not export `prerender = false`. Omitted means `'build'`.
     * No effect under `astro dev`.
     */
    viewRendering: z.enum(['build', 'request']).optional(),
    /** View for a locale that has no translation, on every `{slug}` row that names none. */
    missingView: z.string().min(1).optional(),
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
