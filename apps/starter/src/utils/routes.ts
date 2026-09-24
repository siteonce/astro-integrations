import type { AstroInstance } from 'astro';
import intlConfig from '../intl.config.ts';
import { routes, type StarterRoute } from '../routes.config.ts';
import { listingPageNumber } from './listing.ts';

export function publicTail(value: string): string {
  if (value === '' || value === '/') return '/';
  return value.replace(/^\/+/u, '').replace(/\/+$/u, '');
}

let cachedRoutedPages: Record<string, () => Promise<AstroInstance>> | undefined;

// Inside a function so `node --test` can import this module without Vite.
function routedPages(): Record<string, () => Promise<AstroInstance>> {
  if (!cachedRoutedPages) {
    cachedRoutedPages = import.meta.glob<AstroInstance>('../routes/**/*.astro');
  }
  return cachedRoutedPages;
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

/** Glob keys are relative to this module (`../routes/${name}.astro`). */
function moduleKey(name: string): string {
  assertPageToken(name);
  const pages = routedPages();
  const file = `../routes/${name}.astro`;
  const index = `../routes/${name}/index.astro`;
  const hasFile = file in pages;
  const hasIndex = index in pages;
  if (hasFile && hasIndex) {
    throw new Error(
      `starter: routed page "${name}" has both "${name}.astro" and "${name}/index.astro".`,
    );
  }
  if (hasFile) return file;
  if (hasIndex) return index;
  throw new Error(`starter: routed page "${name}" has no file.`);
}

export function pageName(route: StarterRoute, locale: string): string {
  if (typeof route.page === 'string') return route.page;
  const name = route.page[locale];
  if (!name) throw new Error(`starter: locale "${locale}" has a tail and no routed page.`);
  return name;
}

export function assertRoutedPages(): void {
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

export function matchRoute(
  locale: string,
  path: string,
  hasEntry: boolean,
): StarterRoute | undefined {
  const normalized = publicTail(path);
  if (!hasEntry) {
    for (const route of routes) {
      const slug = route.slug[locale];
      if (slug === undefined || slug.includes('{slug}')) continue;
      if (publicTail(slug) === normalized) return route;
    }
    for (const route of routes) {
      if (route.pageSize === undefined || route.entry) continue;
      const slug = route.slug[locale];
      if (slug === undefined || slug.includes('{slug}')) continue;
      const page = listingPageNumber(slug, normalized);
      if (page !== undefined && page > 1) return route;
    }
    return undefined;
  }

  for (const route of routes) {
    const slug = route.slug[locale];
    if (slug === undefined || !route.entry || slug.includes('{slug}')) continue;
    if (publicTail(slug) === normalized) return route;
  }
  for (const route of routes) {
    const slug = route.slug[locale];
    if (slug === undefined) continue;
    const pattern = publicTail(slug);
    const marker = '/{slug}';
    if (!pattern.endsWith(marker)) continue;
    const section = pattern.slice(0, -marker.length);
    if (!normalized.startsWith(`${section}/`)) continue;
    const leaf = normalized.slice(section.length + 1);
    if (leaf.length > 0 && !leaf.includes('/')) return route;
  }
  return undefined;
}

export function loadRoutedPage(name: string): Promise<AstroInstance> {
  return routedPages()[moduleKey(name)]();
}
