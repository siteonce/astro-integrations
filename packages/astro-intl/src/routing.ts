import { join } from 'node:path';
import type { IntlConfig } from './define-intl.ts';
import { normalizeSlug } from './path.ts';

export type CompiledRoute = {
  pattern: string;
  view: string;
  locale: string;
  rowIndex: number;
  kind: 'static' | 'entry' | 'listing' | 'fallback';
};

type RouteRow = NonNullable<IntlConfig['routes']>[number];

const SLUG_TOKEN = '{slug}';

/**
 * One pattern per row and locale, in that order.
 * A static row compiles to an optional spread, so Astro calls its `getStaticPaths`
 * and one row can publish nothing in a locale.
 * A `{slug}` row with a fallback view also emits a fallback route for each
 * locale that is not the default. The row's `fallbackView` wins over the
 * config's; `false` means none.
 * The same kind and pattern from another row throws.
 */
export function compileRoutes(config: IntlConfig): CompiledRoute[] {
  const compiled: CompiledRoute[] = [];
  const seen = new Map<string, number>();

  for (const [rowIndex, row] of (config.routes ?? []).entries()) {
    const fallbackView = row.fallbackView ?? config.fallbackView;
    for (const locale of config.locales) {
      if (!(locale in row.slug)) continue;
      const view = viewForLocale(row.view, locale);
      if (view === undefined) continue;

      const normalized = normalizeSlug(row.slug[locale] ?? '');
      const kind = kindFor(row, normalized);
      const route: CompiledRoute = {
        pattern: patternFor(
          prefixFor(config, locale),
          normalized.replaceAll(SLUG_TOKEN, '[slug]'),
          spreadName(kind),
        ),
        view,
        locale,
        rowIndex,
        kind,
      };
      pushRoute(compiled, seen, route);
      if (kind === 'entry' && locale !== config.defaultLocale && fallbackView) {
        pushRoute(compiled, seen, { ...route, kind: 'fallback', view: fallbackView });
      }
    }
  }

  return compiled;
}

function viewForLocale(view: RouteRow['view'], locale: string): string | undefined {
  if (typeof view === 'string') return view;
  if (!(locale in view)) return undefined;
  return view[locale];
}

function kindFor(row: RouteRow, tail: string): 'static' | 'entry' | 'listing' {
  if (tail.includes(SLUG_TOKEN)) return 'entry';
  if (row.collection && row.pageSize !== undefined && !row.entry) return 'listing';
  return 'static';
}

function spreadName(kind: 'static' | 'entry' | 'listing'): 'page' | 'index' | undefined {
  if (kind === 'listing') return 'page';
  if (kind === 'static') return 'index';
  return undefined;
}

function prefixFor(config: IntlConfig, locale: string): string {
  if (!config.routing.prefixDefaultLocale && locale === config.defaultLocale) return '';
  return `/${locale}`;
}

function patternFor(prefix: string, tail: string, spread: 'page' | 'index' | undefined): string {
  const base = tail === '/' ? prefix || '/' : `${prefix}/${tail}`;
  if (spread === undefined) return base;
  const param = `/[...${spread}]`;
  return base === '/' ? param : `${base}${param}`;
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
 * Absolute path of the view under `srcDir/views`.
 * Exactly one of `<view>.astro` and `<view>/index.astro` must exist.
 */
export function viewEntrypoint(
  srcDir: string,
  view: string,
  exists: (file: string) => boolean,
): string {
  const file = join(srcDir, 'views', `${view}.astro`);
  const index = join(srcDir, 'views', view, 'index.astro');
  const hasFile = exists(file);
  const hasIndex = exists(index);
  if (hasFile && hasIndex) {
    throw new Error(
      `@repo/astro-intl: view "${view}" has both "${view}.astro" and "${view}/index.astro".`,
    );
  }
  if (hasFile) return file;
  if (hasIndex) return index;
  throw new Error(`@repo/astro-intl: view "${view}" has no file under src/views/.`);
}
