// Defines and types the consumer-owned OG image generation contract.
import * as z from 'zod';

const templateSchema = z.strictObject({
  bgImage: z.string().min(1).optional(),
});

const routeSchema = z.strictObject({
  template: z.string().min(1).optional(),
  collection: z.string().min(1).optional(),
});

const fontSchema = z.strictObject({
  name: z.string().min(1),
  weight: z.number().int().default(400),
  style: z.enum(['normal', 'italic']).default('normal'),
  path: z.string().min(1),
});

export const ogImageConfigSchema = z.strictObject({
  basePath: z
    .string()
    .regex(/^\/(?!$)(?!.*\/\/)(?!.*\/$)(?!.*[?#[\]])/, {
      error:
        'basePath must be a normalized non-root absolute path without parameters, a trailing slash, query, or hash',
    })
    .default('/_og'),
  templates: z.record(z.string(), templateSchema),
  routes: z.record(z.string(), z.union([routeSchema, z.literal(false)])),
  fonts: z.array(fontSchema).min(1, { error: 'at least one font must be configured' }),
});

export type OgImageRoute = z.infer<typeof routeSchema>;
export type OgImageConfig = z.infer<typeof ogImageConfigSchema>;
export type OgImageConfigInput = z.input<typeof ogImageConfigSchema>;
