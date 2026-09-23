import * as z from 'zod';
import { normalizePrefix } from './path.ts';

const DEFAULT_MESSAGES_DIR = 'messages';

export const collectionConfigSchema = z.strictObject({
  idField: z.string().min(1).optional(),
  localeField: z.string().min(1).optional(),
  slugField: z.string().min(1).optional(),
});

export type CollectionConfig = z.infer<typeof collectionConfigSchema>;

export const routeConfigSchema = z.strictObject({
  id: z.string().min(1),
  slug: z.record(z.string(), z.string()),
  collection: z.string().min(1).optional(),
});

export type RouteConfig = z.infer<typeof routeConfigSchema>;

type RouteRulesConfig = {
  locales: readonly string[];
  routes?: readonly {
    id: string;
    slug: Readonly<Record<string, string>>;
    collection?: string | undefined;
  }[];
  collections?: Readonly<Record<string, { slugField?: string | undefined }>>;
};

/** Structural route rules. Entry collisions are checked while pairing. */
export function routeConfigIssues(config: RouteRulesConfig): string[] {
  const issues: string[] = [];
  const seenIds = new Set<string>();
  const seenCollections = new Set<string>();
  const listed = config.collections ?? {};

  for (const route of config.routes ?? []) {
    if (seenIds.has(route.id)) {
      issues.push(`route id "${route.id}" repeats`);
    }
    seenIds.add(route.id);

    if (route.collection) {
      if (seenCollections.has(route.collection)) {
        issues.push(`two routes name collection "${route.collection}"`);
      }
      seenCollections.add(route.collection);
      const collection = listed[route.collection];
      if (!collection) {
        issues.push(`route "${route.id}" collection "${route.collection}" is not listed`);
      } else if (!collection.slugField) {
        issues.push(`route "${route.id}" collection "${route.collection}" has no slugField`);
      }
    }

    for (const locale of config.locales) {
      if (!(locale in route.slug)) {
        issues.push(`route "${route.id}" slug missing locale "${locale}"`);
        continue;
      }
      if (!route.collection) continue;
      if (!normalizePrefix(route.slug[locale] ?? '')) {
        issues.push(`route "${route.id}" prefix for locale "${locale}" is empty or "/"`);
      }
    }
  }

  for (const [name, collection] of Object.entries(listed)) {
    if (collection.slugField && !seenCollections.has(name)) {
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
