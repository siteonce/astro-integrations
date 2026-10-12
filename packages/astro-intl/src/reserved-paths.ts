import { resolve } from 'node:path';
import type { CompiledRoute } from './routing.ts';

/**
 * Checks against resolved routes: a project file route shaped like an injected
 * route, a route that serves `/`, and whether a resolved route is one this
 * integration injected. Also finds the literal file routes that sit where a
 * `[slug]` route publishes entries. Whether an entry publishes that slug is
 * known only when collections load.
 */

export type RouteLike = {
  pattern: string;
  pathname?: string | undefined;
};

function stripSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
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
 * True when a resolved route matches the pathname `/`.
 * `patternRegex` is Astro's matcher, so a root rest route counts.
 * The caller drops intl's own injected routes first.
 */
export function servesSiteRoot(routes: readonly { patternRegex: RegExp }[]): boolean {
  return routes.some((route) => route.patternRegex.test('/'));
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
 * A project file route shaped like an injected route. Less specific file
 * routes, such as `[locale]/[...path]`, are not hits. A literal file route
 * under a `[slug]` route is not a hit here: `literalEntryRoutes` finds it, and
 * the build refuses it when an entry publishes that slug.
 * A static route hits the file pattern `<tail>` or `<tail>/[...rest]`.
 * A `[param]` or another literal under that tail does not.
 * `file` is that file route's pattern.
 */
export function fileRouteCollision(
  fileRoutes: RouteLike[],
  injected: CompiledRoute[],
): { file: string; injected: CompiledRoute } | undefined {
  for (const projectRoute of fileRoutes) {
    for (const route of injected) {
      if (patternsCollide(projectRoute.pattern, route)) {
        return { file: projectRoute.pattern, injected: route };
      }
    }
  }
  return undefined;
}

function patternsCollide(filePattern: string, route: CompiledRoute): boolean {
  const fileSegments = segments(filePattern);
  const injectedSegments = segments(route.pattern);
  if (route.kind === 'listing' && injectedSegments.at(-1) === '[page]') {
    return pageParamCollides(fileSegments, injectedSegments);
  }
  if (route.kind === 'static' || route.kind === 'listing') {
    return spreadCollides(fileSegments, injectedSegments, route.kind === 'listing');
  }
  // `entry` and `fallback` are both a `[slug]` pattern.
  return entryCollides(fileSegments, injectedSegments);
}

/** A `[page]` listing hits a page number or a `[param]` of that same shape, not the bare tail. */
function pageParamCollides(fileSegments: string[], injectedSegments: string[]): boolean {
  if (fileSegments.length !== injectedSegments.length || fileSegments.length === 0) return false;
  for (let index = 0; index < injectedSegments.length - 1; index++) {
    const injected = injectedSegments[index];
    if (fileSegments[index] !== injected) return false;
  }
  const last = fileSegments.at(-1) ?? '';
  return isSingleParam(last) || /^\d+$/u.test(last);
}

function entryCollides(fileSegments: string[], injectedSegments: string[]): boolean {
  if (fileSegments.length !== injectedSegments.length || fileSegments.length === 0) return false;
  for (let index = 0; index < injectedSegments.length - 1; index++) {
    if (fileSegments[index] !== injectedSegments[index]) return false;
  }
  const last = fileSegments[fileSegments.length - 1];
  return last !== undefined && isSingleParam(last);
}

/** `<tail>` or `<tail>/[...rest]`. A listing also hits a page number or a `[param]`. */
function spreadCollides(
  fileSegments: string[],
  injectedSegments: string[],
  listing: boolean,
): boolean {
  const base = injectedSegments.slice(0, -1);
  if (sameSegments(fileSegments, base)) return true;
  if (fileSegments.length !== base.length + 1) return false;
  if (!sameSegments(fileSegments.slice(0, base.length), base)) return false;
  const last = fileSegments[fileSegments.length - 1] ?? '';
  if (isRestParam(last)) return true;
  return listing && (/^\d+$/u.test(last) || isSingleParam(last));
}

/** A literal project file route under an injected `[slug]` route. `slug` is its last segment. */
export type LiteralEntryRoute = {
  file: string;
  route: CompiledRoute;
  slug: string;
};

/**
 * Literal project file routes with the section of an injected entry route and one
 * more segment. Astro ranks a literal segment above `[slug]`, so that file is
 * served wherever the entry route would publish an entry with that slug.
 */
export function literalEntryRoutes(
  fileRoutes: RouteLike[],
  injected: CompiledRoute[],
): LiteralEntryRoute[] {
  const found: LiteralEntryRoute[] = [];
  for (const projectRoute of fileRoutes) {
    if (projectRoute.pattern.includes('[')) continue;
    const fileSegments = segments(projectRoute.pattern);
    for (const route of injected) {
      if (route.kind !== 'entry') continue;
      const section = segments(route.pattern).slice(0, -1);
      if (fileSegments.length !== section.length + 1) continue;
      if (!sameSegments(fileSegments.slice(0, -1), section)) continue;
      found.push({ file: projectRoute.pattern, route, slug: fileSegments.at(-1) ?? '' });
    }
  }
  return found;
}
