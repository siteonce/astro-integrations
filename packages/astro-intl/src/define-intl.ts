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
  entry: z.string().min(1).optional(),
});

export type RouteConfig = z.infer<typeof routeConfigSchema>;

type RouteRule = {
  slug: Readonly<Record<string, string>>;
  collection?: string | undefined;
  entry?: string | undefined;
};

type RouteRulesConfig = {
  locales: readonly string[];
  routes?: readonly RouteRule[];
  collections?: Readonly<Record<string, { slugField?: string | undefined }>>;
};

function routeWhere(collection: string, entry?: string): string {
  return entry ? `collection "${collection}" entry "${entry}"` : `collection "${collection}"`;
}

/** Structural route rules. Compiled-path collisions are checked while pairing. */
export function routeConfigIssues(config: RouteRulesConfig): string[] {
  const issues: string[] = [];
  const seenEntries = new Set<string>();
  const seenPatterns = new Set<string>();
  const seenSections = new Set<string>();
  const listed = config.collections ?? {};

  for (const route of config.routes ?? []) {
    if (!route.collection) {
      if (route.entry) issues.push('entry row has no collection');
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
    if (route.entry) {
      const key = `${collectionName}/${route.entry}`;
      if (seenEntries.has(key)) {
        issues.push(`entry "${route.entry}" repeats in collection "${collectionName}"`);
      }
      seenEntries.add(key);
    } else if (seenPatterns.has(collectionName)) {
      issues.push(`two pattern rows name collection "${collectionName}"`);
    } else {
      seenPatterns.add(collectionName);
    }

    const collection = listed[collectionName];
    if (!collection) {
      issues.push(`collection "${collectionName}" is not listed`);
    } else if (route.entry && collection.slugField) {
      issues.push(`entry row on collection "${collectionName}" which has slugField`);
    } else if (!route.entry && !collection.slugField) {
      issues.push(`pattern row on collection "${collectionName}" which has no slugField`);
    }

    for (const locale of config.locales) {
      if (!(locale in route.slug)) {
        issues.push(`route ${where} slug missing locale "${locale}"`);
        continue;
      }
      const slug = route.slug[locale] ?? '';
      if (route.entry) {
        if (slug === '' || slug.includes('{slug}')) {
          issues.push(`route ${where} slug for locale "${locale}" is not a fixed tail`);
        }
        continue;
      }
      const section = patternSection(slug);
      if (!section) {
        issues.push(
          `route ${where} slug for locale "${locale}" must use {slug} as the final segment`,
        );
        continue;
      }
      const sectionKey = `${locale}\0${section}`;
      if (seenSections.has(sectionKey)) {
        issues.push(`duplicate section "${section}" for locale "${locale}"`);
      }
      seenSections.add(sectionKey);
    }
  }

  for (const [name, collection] of Object.entries(listed)) {
    if (collection.slugField && !seenPatterns.has(name)) {
      issues.push(`collections.${name} slugField has no route row`);
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
