import { join } from 'node:path';
import type { IntlConfig } from './define-intl.ts';
import { normalizeSlug } from './path.ts';

export type CompiledRoute = {
  pattern: string;
  page: string;
  locale: string;
  rowIndex: number;
  kind: 'static' | 'entry' | 'listing' | 'missing';
};

type RouteRow = NonNullable<IntlConfig['routes']>[number];

const SLUG_TOKEN = '{slug}';

/**
 * One pattern per row and locale, in that order.
 * A `{slug}` row that names `missingPage` also emits a missing route for each
 * locale that is not the default. That route's page is `missingPage`.
 * The same kind and pattern from another row throws.
 */
export function compileRoutes(config: IntlConfig): CompiledRoute[] {
  const compiled: CompiledRoute[] = [];
  const seen = new Map<string, number>();

  for (const [rowIndex, row] of (config.routes ?? []).entries()) {
    for (const locale of config.locales) {
      if (!(locale in row.slug)) continue;
      const page = pageForLocale(row.page, locale);
      if (page === undefined) continue;

      const normalized = normalizeSlug(row.slug[locale] ?? '');
      const kind = kindFor(row, normalized);
      const route: CompiledRoute = {
        pattern: patternFor(
          prefixFor(config, locale),
          normalized.replaceAll(SLUG_TOKEN, '[slug]'),
          kind === 'listing',
        ),
        page,
        locale,
        rowIndex,
        kind,
      };
      pushRoute(compiled, seen, route);
      if (kind === 'entry' && locale !== config.defaultLocale && row.missingPage) {
        pushRoute(compiled, seen, { ...route, kind: 'missing', page: row.missingPage });
      }
    }
  }

  return compiled;
}

function pageForLocale(page: RouteRow['page'], locale: string): string | undefined {
  if (typeof page === 'string') return page;
  if (!(locale in page)) return undefined;
  return page[locale];
}

function kindFor(row: RouteRow, tail: string): 'static' | 'entry' | 'listing' {
  if (tail.includes(SLUG_TOKEN)) return 'entry';
  if (row.collection && row.pageSize !== undefined && !row.entry) return 'listing';
  return 'static';
}

function prefixFor(config: IntlConfig, locale: string): string {
  if (!config.routing.prefixDefaultLocale && locale === config.defaultLocale) return '';
  return `/${locale}`;
}

function patternFor(prefix: string, tail: string, listing: boolean): string {
  const base = tail === '/' ? prefix || '/' : `${prefix}/${tail}`;
  if (!listing) return base;
  return base === '/' ? '/[...page]' : `${base}/[...page]`;
}

function pushRoute(
  compiled: CompiledRoute[],
  seen: Map<string, number>,
  route: CompiledRoute,
): void {
  const key = `${route.kind}\0${route.pattern}`;
  const previous = seen.get(key);
  if (previous !== undefined) {
    throw new Error(
      `@repo/astro-intl: route pattern "${route.pattern}" repeats (rows ${previous} and ${route.rowIndex}).`,
    );
  }
  seen.set(key, route.rowIndex);
  compiled.push(route);
}

/**
 * Absolute path of the routed page under `srcDir/routes`.
 * Exactly one of `<page>.astro` and `<page>/index.astro` must exist.
 */
export function routedPageEntrypoint(
  srcDir: string,
  page: string,
  exists: (file: string) => boolean,
): string {
  const file = join(srcDir, 'routes', `${page}.astro`);
  const index = join(srcDir, 'routes', page, 'index.astro');
  const hasFile = exists(file);
  const hasIndex = exists(index);
  if (hasFile && hasIndex) {
    throw new Error(
      `@repo/astro-intl: routed page "${page}" has both "${page}.astro" and "${page}/index.astro".`,
    );
  }
  if (hasFile) return file;
  if (hasIndex) return index;
  throw new Error(`@repo/astro-intl: routed page "${page}" has no file under src/routes/.`);
}
