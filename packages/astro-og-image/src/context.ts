// Defines the complete render context passed to project-authored OG templates.
import type { SiteConfig } from '@repo/astro-site/schemas/config/site.config';
import type { OgImageConfig } from './config.ts';
import type { OgNode } from './jsx-runtime.ts';

export type TFn = (key: string, params?: Record<string, string | number>) => string;

export type OgEntry = {
  id: string;
  collection: string;
  data: Record<string, unknown>;
};

export type OgContext = {
  siteConfig: SiteConfig;
  locale: string;
  t: TFn;
  path: string;
  templateId: string;
  ogConfig: OgImageConfig;
  entry?: OgEntry;
};

export type Template = (ctx: OgContext) => OgNode;
