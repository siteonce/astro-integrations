// Ambient shims so the package type-checks standalone (`tsc --noEmit`).
// `@repo/astro-intl` ships TypeScript, so its `astro:content` and `astro:i18n`
// imports are part of this check. This package calls `getRelativeLocaleUrl`.

declare module 'astro:content' {
  export const getCollection: (name: string) => Promise<unknown>;
}

declare module 'astro:i18n' {
  export function getAbsoluteLocaleUrl(locale: string, path?: string): string;
  export function getRelativeLocaleUrl(locale: string, path?: string): string;
}

declare module 'virtual:astro-og-image/config' {
  export const generationConfig: import('./config.ts').OgImageConfig;
  export const siteConfig: import('@repo/astro-site/schemas/config/site.config').SiteConfig;
  export const deployClass: import('./integration.ts').DeployClass;
  export const intlConfig: import('@repo/astro-intl').IntlConfig;
  export const catalogs: Record<string, unknown>;
  export const templates: Record<string, import('./context.ts').Template>;
  export const templateSources: Record<string, string>;
  export const projectRoot: string;
  export const publicDir: string;
}
