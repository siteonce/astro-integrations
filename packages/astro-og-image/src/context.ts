import type { SiteConfig } from '@gravitysupport/astro-lib/schemas/config/siteConfig';
import type { Prose } from '@gravitysupport/astro-lib/schemas/content/prose';
import type { OgImageConfig } from './config.ts';
import type { OgNode } from './jsx-runtime.ts';

export type TFn = (key: string, params?: Record<string, string | number>) => string;

export type OgEntry = {
  id: string;
  collection: string;
  data: Prose;
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
