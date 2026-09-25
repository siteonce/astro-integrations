import { resolve } from 'node:path';
import type { CompiledRoute } from './routing.ts';

/**
 * File-route tails that must not be claimed by a compiled document `path`.
 * Catch-all `[locale]/[...path]` is ignored. The caller drops intl's own
 * injected routes before collecting tails. Optional `reservedPaths` from
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

/** Leading slash, no trailing slash. `/` stays `/`. */
function slashPattern(pattern: string): string {
  const stripped = stripSlashes(pattern);
  return stripped === '' ? '/' : `/${stripped}`;
}

function segments(pattern: string): string[] {
  return stripSlashes(pattern).split('/').filter(Boolean);
}

function sameSegments(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}

/** One bracketed segment, such as `[slug]`. A rest segment is not one. */
function isSingleParam(segment: string): boolean {
  return /^\[[^.\]]+\]$/u.test(segment);
}

function isRestParam(segment: string): boolean {
  return /^\[\.\.\.[^\]]+\]$/u.test(segment);
}

/**
 * True when this resolved route is one `astroIntl()` injected.
 * Other external routes, such as open-graph images, stay in the tail scan.
 */
export function isIntlRoute(
  route: { origin: string; entrypoint: string; pattern: string },
  ownEntrypoints: ReadonlySet<string>,
  projectRoot: string,
  injectedPatterns: ReadonlySet<string>,
): boolean {
  if (route.origin !== 'external') return false;
  if (!ownEntrypoints.has(resolve(projectRoot, route.entrypoint))) return false;
  return injectedPatterns.has(slashPattern(route.pattern));
}

/**
 * A project file route that serves a URL an injected route emits and wins
 * priority. Less specific file routes, such as the catch-all, are not hits.
 * A literal leaf under an entry section is not a hit here: pairing aborts
 * when a published entry lands on it. `file` is that file route's pattern.
 */
export function fileRouteCollision(
  fileRoutes: RouteLike[],
  injected: CompiledRoute[],
): { file: string; injected: CompiledRoute } | undefined {
  for (const fileRoute of fileRoutes) {
    for (const route of injected) {
      if (patternsCollide(fileRoute.pattern, route)) {
        return { file: fileRoute.pattern, injected: route };
      }
    }
  }
  return undefined;
}

function patternsCollide(filePattern: string, route: CompiledRoute): boolean {
  const fileSegments = segments(filePattern);
  const injectedSegments = segments(route.pattern);
  if (route.kind === 'static') return sameSegments(fileSegments, injectedSegments);
  if (route.kind === 'listing') return listingCollides(fileSegments, injectedSegments);
  return entryCollides(fileSegments, injectedSegments);
}

function entryCollides(fileSegments: string[], injectedSegments: string[]): boolean {
  if (fileSegments.length !== injectedSegments.length || fileSegments.length === 0) return false;
  for (let index = 0; index < injectedSegments.length - 1; index++) {
    if (fileSegments[index] !== injectedSegments[index]) return false;
  }
  const last = fileSegments[fileSegments.length - 1];
  return last !== undefined && isSingleParam(last);
}

function listingCollides(fileSegments: string[], injectedSegments: string[]): boolean {
  const base = injectedSegments.slice(0, -1);
  if (sameSegments(fileSegments, base)) return true;
  if (fileSegments.length !== base.length + 1) return false;
  if (!sameSegments(fileSegments.slice(0, base.length), base)) return false;
  const last = fileSegments[fileSegments.length - 1] ?? '';
  return /^\d+$/u.test(last) || isSingleParam(last) || isRestParam(last);
}
