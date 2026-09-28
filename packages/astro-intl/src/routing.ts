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
const PAGE_TOKEN = '{page}';

/**
 * One pattern per row and locale, in that order.
 * A static row compiles to an optional spread, so Astro calls its `getStaticPaths`
 * and one row can publish nothing in a locale.
 * A row with `pagination` compiles to two routes per locale. Page 1 is the row's
 * slug as `[...page]`, rendered by the row's view. Pages 2 onward replace `{page}`
 * in `pagination.slug` with `[page]`, rendered by `pagination.view` or the row's view.
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

    const pagination = row.pagination;
    if (!pagination) continue;
    for (const locale of config.locales) {
      if (!(locale in pagination.slug)) continue;
      const view = viewForLocale(pagination.view ?? row.view, locale);
      if (view === undefined) continue;
      const normalized = normalizeSlug(pagination.slug[locale] ?? '');
      pushRoute(compiled, seen, {
        pattern: patternFor(
          prefixFor(config, locale),
          normalized.replaceAll(PAGE_TOKEN, '[page]'),
          undefined,
        ),
        view,
        locale,
        rowIndex,
        kind: 'listing',
      });
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
  if (row.pagination) return 'listing';
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

function canonicalPattern(pattern: string): string {
  const stripped = pattern.replace(/^\/+|\/+$/gu, '');
  return stripped === '' ? '/' : `/${stripped}`;
}

/** One dynamic final segment, such as `[page]`. A spread is not one. */
function singleDynamicLeaf(pattern: string): { head: string; leaf: string } | undefined {
  const parts = canonicalPattern(pattern)
    .split('/')
    .filter((part) => part.length > 0);
  const leaf = parts.at(-1);
  if (!leaf || !/^\[[^.\]]+\]$/u.test(leaf)) return undefined;
  return { head: parts.slice(0, -1).join('/'), leaf };
}

/**
 * The `{page}` route at `pattern`, when a `{slug}` route has the same prefix,
 * the same section, and one dynamic final segment. `[page]` and `[slug]` tie,
 * and Astro sorts `[page]` first.
 */
export function pageSlugClash(
  routes: readonly CompiledRoute[],
  pattern: string,
): { page: CompiledRoute; entry: CompiledRoute } | undefined {
  const pageLeaf = singleDynamicLeaf(pattern);
  if (pageLeaf?.leaf !== '[page]') return undefined;
  const page = routes.find(
    (route) =>
      route.kind === 'listing' && canonicalPattern(route.pattern) === canonicalPattern(pattern),
  );
  if (!page) return undefined;
  const entry = routes.find((route) => {
    if (route.kind !== 'entry') return false;
    const leaf = singleDynamicLeaf(route.pattern);
    return leaf?.leaf === '[slug]' && leaf.head === pageLeaf.head;
  });
  if (!entry) return undefined;
  return { page, entry };
}

/** Names both routes and the ways to separate them. */
export function pageSlugClashMessage(clash: { page: CompiledRoute; entry: CompiledRoute }): string {
  const example = clash.page.pattern.replaceAll('[page]', '2');
  return (
    `@repo/astro-intl: on-demand {page} route "${clash.page.pattern}" (row ${clash.page.rowIndex}) ` +
    `has the same shape as {slug} route "${clash.entry.pattern}" (row ${clash.entry.rowIndex}). ` +
    `Give pagination its own view that exports prerender = true. ${example} stays, and page 1 stays on demand. ` +
    "Export prerender = true from the row's view. This also prerenders page 1. " +
    'Give pagination.slug its own segment (for example blog/page/{page}).'
  );
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
