import * as z from 'zod';

const DEFAULT_MESSAGES_DIR = 'messages';

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
  })
  .refine((config) => config.locales.includes(config.defaultLocale), {
    error: 'defaultLocale must be one of locales',
  })
  .refine((config) => new Set(config.locales).size === config.locales.length, {
    error: 'locales values must be unique',
  });

export type IntlConfig = z.infer<typeof intlConfigSchema>;

/** Typed helper for `src/intl.config.ts`. Validation runs when `astroIntl()` loads the file. */
export function defineIntl(config: IntlConfig): IntlConfig {
  return config;
}

export function messagesDir(config: IntlConfig): string {
  return config.messages?.dir ?? DEFAULT_MESSAGES_DIR;
}
