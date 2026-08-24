// Declares integration-owned virtual modules and ambient env bindings for source typechecking.
declare module 'astro:env/server' {
  export const DEPLOY_CONTEXT: 'production' | 'preview' | 'local' | undefined;
}

declare module 'virtual:astro-lib/config' {
  export const siteConfig: import('@siteonce/astro-lib/schemas/config/siteConfig').SiteConfig;
  export const i18nConfig: import('@siteonce/astro-lib/schemas/config/i18nConfig').I18nConfig;
}

declare module 'virtual:astro-lib/i18n' {
  export const translations: Record<string, Record<string, unknown>>;
}

declare module 'virtual:astro-og-image/config' {
  export const generationConfig: import('./config.ts').OgImageConfig;
  export const templates: Record<string, import('./context.ts').Template>;
  export const templateSources: Record<string, string>;
  export const projectRoot: string;
  export const publicDir: string;
  export const projectRoutes: Array<{
    pattern: string;
    pathname?: string;
    type: 'page' | 'endpoint' | 'redirect' | 'fallback';
    origin: 'internal' | 'external' | 'project';
    entrypoint: string;
  }>;
  export const getCollection: (
    name: string,
  ) => Promise<Array<{ id: string; collection: string; data: Record<string, unknown> }>>;
}
