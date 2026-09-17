/**
 * File-route tails that must not be claimed by a compiled document `path`.
 * Catch-all `[locale]/[...path]` is ignored. Optional `reservedPaths` from
 * config are merged by the caller.
 */

export type RouteLike = {
  pattern: string;
  pathname?: string | undefined;
};

function stripSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

export function isDocumentCatchAll(pattern: string): boolean {
  const normalized = stripSlashes(pattern);
  return (
    normalized === '[locale]/[...path]' ||
    normalized === '[...path]' ||
    normalized === '[locale]/[...slug]'
  );
}

/**
 * URL tail after an optional `[locale]` segment. `undefined` when the route is
 * the document catch-all (not reserved).
 */
export function tailFromRoute(route: RouteLike): string | undefined {
  const raw = route.pathname ?? route.pattern;
  if (isDocumentCatchAll(route.pattern) || isDocumentCatchAll(raw)) return undefined;
  const parts = stripSlashes(raw).split('/').filter(Boolean);
  // Unprefixed root (`pages/index.astro` → `/`) is not a locale-prefixed
  // document tail. Homepage documents compile to path `'/'` under `[locale]/`.
  if (parts.length === 0) return undefined;
  const withoutLocale = parts[0] === '[locale]' ? parts.slice(1) : parts;
  if (withoutLocale.length === 0) return '/';
  if (withoutLocale.some((part) => part.startsWith('[') && part.endsWith(']'))) {
    return undefined;
  }
  return withoutLocale.join('/');
}

export function reservedTailsFromRoutes(routes: RouteLike[]): string[] {
  const tails = new Set<string>();
  for (const route of routes) {
    const tail = tailFromRoute(route);
    if (tail !== undefined) tails.add(tail);
  }
  return [...tails];
}
