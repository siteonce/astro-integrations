// Ambient shims so the package type-checks standalone (`tsc --noEmit`).
// These modules exist only inside an Astro build. Surfaces are kept to
// exactly what this package's source imports.

declare module 'astro:content' {
  export const getCollection: (name: string) => Promise<unknown>;
}

declare module 'astro:i18n' {
  export function getAbsoluteLocaleUrl(locale: string, path?: string): string;
  export function getRelativeLocaleUrl(locale: string, path?: string): string;
}
