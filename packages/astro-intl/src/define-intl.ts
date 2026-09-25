import * as z from 'zod';
import { patternSection } from './path.ts';

const DEFAULT_MESSAGES_DIR = 'messages';

export const collectionConfigSchema = z.strictObject({
  idField: z.string().min(1).optional(),
  localeField: z.string().min(1).optional(),
  slugField: z.string().min(1).optional(),
});

export type CollectionConfig = z.infer<typeof collectionConfigSchema>;

export const routeConfigSchema = z.strictObject({
  collection: z.string().min(1).optional(),
  slug: z.record(z.string(), z.string()),
  /** Routed page name, or one name per locale. */
  page: z.union([z.string().min(1), z.record(z.string(), z.string().min(1))]),
  entry: z.string().min(1).optional(),
  /** Entries in one chunk of a collection tail. Omitted, the row is that one tail. */
  pageSize: z.number().int().positive().optional(),
});

export type RouteConfig = z.infer<typeof routeConfigSchema>;

type RouteRule = {
  slug: Readonly<Record<string, string>>;
  page: string | Readonly<Record<string, string>>;
  collection?: string | undefined;
  entry?: string | undefined;
  pageSize?: number | undefined;
};

type RouteRulesConfig = {
  locales: readonly string[];
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

function pageNameIssues(name: string): string[] {
  const issues: string[] = [];
  if (name.endsWith('.astro')) {
    issues.push(`routed page "${name}" includes a file extension`);
  }
  const parts = name.split('/');
  if (parts.some((part) => part.length === 0 || part === '.' || part === '..')) {
    issues.push(`routed page "${name}" is not a path`);
  }
  return issues;
}

function routedPageIssues(
  page: string | Readonly<Record<string, string>>,
  locales: readonly string[],
): string[] {
  if (typeof page === 'string') return pageNameIssues(page);
  const issues: string[] = [];
  const keys = Object.keys(page).sort();
  const expected = [...locales].sort();
  if (keys.join('\0') !== expected.join('\0')) {
    issues.push(`routed page keys must be the configured locales (${expected.join(', ')})`);
  }
  for (const name of Object.values(page)) issues.push(...pageNameIssues(name));
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

  for (const route of config.routes ?? []) {
    issues.push(...routedPageIssues(route.page, config.locales));

    const sizeIssue = pageSizeIssue(route.pageSize);
    if (sizeIssue) issues.push(sizeIssue);

    if (!route.collection) {
      if (route.entry) issues.push('entry row has no collection');
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
    collections: z.record(z.string(), collectionConfigSchema).optional(),
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

/** Typed helper for `src/intl.config.ts`. Validation runs when `astroIntl()` loads the file. */
export function defineIntl(config: IntlConfig): IntlConfig {
  return config;
}

export function messagesDir(config: IntlConfig): string {
  return config.messages?.dir ?? DEFAULT_MESSAGES_DIR;
}
