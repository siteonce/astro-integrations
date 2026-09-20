import * as z from 'zod';

const DEFAULT_MESSAGES_DIR = 'messages';

export type EntryIdContext = {
  id: string;
  collection: string;
  slug: string | undefined;
  locale: string;
  filePath: string | undefined;
  data: Record<string, unknown>;
};

export type EntryIdStrategy =
  | 'frontmatter'
  | 'slug'
  | 'astroId'
  | 'fileStem'
  | 'parentDir'
  | 'collectionFolder';

export type EntryIdResolver = EntryIdStrategy | ((ctx: EntryIdContext) => string);

const entryIdStrategySchema = z.enum([
  'frontmatter',
  'slug',
  'astroId',
  'fileStem',
  'parentDir',
  'collectionFolder',
]);

const entryIdResolverSchema: z.ZodType<EntryIdResolver> = z.union([
  entryIdStrategySchema,
  z.custom<(ctx: EntryIdContext) => string>((value) => typeof value === 'function'),
]);

export const collectionConfigSchema = z.strictObject({
  entryId: entryIdResolverSchema.optional(),
  entryIdField: z.string().min(1).optional(),
  slugField: z.string().min(1).optional(),
  pathPrefix: z.union([z.string().min(1), z.record(z.string(), z.string().min(1))]).optional(),
});

export type CollectionConfig = z.infer<typeof collectionConfigSchema>;

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
    entryId: entryIdResolverSchema.optional(),
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
    for (const [name, collection] of Object.entries(config.collections ?? {})) {
      const prefix = collection.pathPrefix;
      if (prefix && typeof prefix === 'object') {
        for (const locale of config.locales) {
          if (!(locale in prefix)) {
            ctx.addIssue({
              code: 'custom',
              message: `collections.${name}.pathPrefix missing locale "${locale}"`,
            });
          }
        }
      }
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
