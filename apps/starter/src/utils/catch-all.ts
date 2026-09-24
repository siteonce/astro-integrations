import type { AstroInstance } from 'astro';
import intlConfig from '../intl.config.ts';
import { routes, type StarterRoute } from '../pages/_routes.ts';

export type CatchAll = {
  publicTail(value: string): string;
  moduleKey(name: string): string;
  pageName(route: StarterRoute, locale: string): string;
  assertRoutedPages(): void;
  matchRoute(locale: string, path: string): StarterRoute | undefined;
};

/** `routedPages` keys come from the catch-all page glob and stay relative to that file. */
export function createCatchAll(
  routedPages: Record<string, () => Promise<AstroInstance>>,
): CatchAll {
  function publicTail(value: string): string {
    if (value === '' || value === '/') return '/';
    return value.replace(/^\/+/u, '').replace(/\/+$/u, '');
  }

  function assertPageToken(name: string): void {
    if (name.endsWith('.astro')) {
      throw new Error(`starter: routed page "${name}" includes a file extension.`);
    }
    const parts = name.split('/');
    if (parts.some((part) => part.length === 0 || part === '.' || part === '..')) {
      throw new Error(`starter: routed page "${name}" is not a path.`);
    }
  }

  function moduleKey(name: string): string {
    assertPageToken(name);
    const file = `../_pages/${name}.astro`;
    const index = `../_pages/${name}/index.astro`;
    const hasFile = file in routedPages;
    const hasIndex = index in routedPages;
    if (hasFile && hasIndex) {
      throw new Error(
        `starter: routed page "${name}" has both "${name}.astro" and "${name}/index.astro".`,
      );
    }
    if (hasFile) return file;
    if (hasIndex) return index;
    throw new Error(`starter: routed page "${name}" has no file.`);
  }

  function pageName(route: StarterRoute, locale: string): string {
    if (typeof route.page === 'string') return route.page;
    const name = route.page[locale];
    if (!name) throw new Error(`starter: locale "${locale}" has a tail and no routed page.`);
    return name;
  }

  function assertRoutedPages(): void {
    const locales = [...intlConfig.locales];
    for (const route of routes) {
      if (typeof route.page === 'string') {
        moduleKey(route.page);
        continue;
      }
      const keys = Object.keys(route.page).sort();
      const expected = [...locales].sort();
      if (keys.join('\0') !== expected.join('\0')) {
        throw new Error(
          `starter: routed page keys must be the configured locales (${expected.join(', ')}).`,
        );
      }
      for (const locale of locales) {
        const name = route.page[locale];
        if (!name) throw new Error(`starter: locale "${locale}" has a tail and no routed page.`);
        moduleKey(name);
      }
    }
  }

  function matchRoute(locale: string, path: string): StarterRoute | undefined {
    const normalized = publicTail(path);
    for (const route of routes) {
      const slug = route.slug[locale];
      if (slug === undefined) continue;
      const pattern = publicTail(slug);
      if (route.collection && !route.entry) {
        const marker = '/{slug}';
        if (!pattern.endsWith(marker)) continue;
        const section = pattern.slice(0, -marker.length);
        if (!normalized.startsWith(`${section}/`)) continue;
        const leaf = normalized.slice(section.length + 1);
        if (leaf.length > 0 && !leaf.includes('/')) return route;
        continue;
      }
      if (pattern === normalized) return route;
    }
    return undefined;
  }

  return {
    publicTail,
    moduleKey,
    pageName,
    assertRoutedPages,
    matchRoute,
  };
}
