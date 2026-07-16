import * as z from 'zod';

const templateSchema = z.strictObject({
  bgImage: z.string().min(1).optional(),
});

const pageSchema = z.strictObject({
  template: z.string().min(1),
});

const fontSchema = z.strictObject({
  name: z.string().min(1),
  weight: z.number().int().default(400),
  style: z.enum(['normal', 'italic']).default('normal'),
  path: z.string().min(1),
});

export const ogImageConfigSchema = z.strictObject({
  templates: z.record(z.string(), templateSchema),
  pages: z.record(z.string(), pageSchema),
  default: z.string().min(1),
  fonts: z.array(fontSchema).default([]),
});

export type OgImageConfig = z.infer<typeof ogImageConfigSchema>;
export type OgImageConfigInput = z.input<typeof ogImageConfigSchema>;
