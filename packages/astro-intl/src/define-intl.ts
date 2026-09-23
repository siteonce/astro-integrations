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
  collection: z.string().min(1),
  slug: z.record(z.string(), z.string()),
  entry: z.string().min(1).optional(),
});

export type RouteConfig = z.infer<typeof routeConfigSchema>;

type RouteRule = {
  slug: Readonly<Record<string, string>>;
  collection: string;
  entry?: string | undefined;
};

type RouteRulesConfig = {
  locales: readonly string[];
  routes?: readonly RouteRule[];
  collections?: Readonly<Record<string, { slugField?: string | undefined }>>;
};

function routeWhere(route: RouteRule): string {
  return route.entry
    ? `collection "${route.collection}" entry "${route.entry}"`
    : `collection "${route.collection}"`;
}

/** Structural route rules. Compiled-path collisions are checked while pairing. */
export function routeConfigIssues(config: RouteRulesConfig): string[] {
  const issues: string[] = [];
  const seenEntries = new Set<string>();
  const seenPatterns = new Set<string>();
  const seenSections = new Set<string>();
  const listed = config.collections ?? {};

  for (const route of config.routes ?? []) {
    if (route.entry) {
      const key = `${route.collection}/${route.entry}`;
      if (seenEntries.has(key)) {
        issues.push(`entry "${route.entry}" repeats in collection "${route.collection}"`);
      }
      seenEntries.add(key);
    } else if (seenPatterns.has(route.collection)) {
      issues.push(`two pattern rows name collection "${route.collection}"`);
    } else {
      seenPatterns.add(route.collection);
    }

    const collection = listed[route.collection];
    if (!collection) {
      issues.push(`collection "${route.collection}" is not listed`);
    } else if (route.entry && collection.slugField) {
      issues.push(`entry row on collection "${route.collection}" which has slugField`);
    } else if (!route.entry && !collection.slugField) {
      issues.push(`pattern row on collection "${route.collection}" which has no slugField`);
    }

    for (const locale of config.locales) {
      if (!(locale in route.slug)) {
        issues.push(`route ${routeWhere(route)} slug missing locale "${locale}"`);
        continue;
      }
      const slug = route.slug[locale] ?? '';
      if (route.entry) {
        if (slug === '' || slug.includes('{slug}')) {
          issues.push(`route ${routeWhere(route)} slug for locale "${locale}" is not a fixed tail`);
        }
        continue;
      }
      const section = patternSection(slug);
      if (!section) {
        issues.push(
          `route ${routeWhere(route)} slug for locale "${locale}" must use {slug} as the final segment`,
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
