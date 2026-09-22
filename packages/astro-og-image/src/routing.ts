// Centralizes public-path normalization and exact/dynamic/default route precedence.
import type { OgImageConfig, OgImageConfigInput, OgImageRoute } from './config.ts';

type ConfigForRouting = Pick<OgImageConfigInput, 'routes'> & { basePath?: string };

export type RouteMatch = {
  pattern: string;
  routePath: string;
  definition: OgImageRoute | false;
};

export function isIncludedRoute(
  definition: OgImageRoute | false | undefined,
): definition is OgImageRoute {
  return definition !== undefined && definition !== false;
}

export function normalizePath(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0] ?? path;
  return `/${pathname}`.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
}

export function normalizeBasePath(basePath = '/_og'): string {
  return normalizePath(basePath);
}

export function isDynamicPattern(pattern: string): boolean {
  return /\[(?:\.\.\.)?[^\]]+\]/.test(pattern);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function patternRegex(pattern: string): RegExp {
  const parts = normalizePath(pattern)
    .split('/')
    .filter(Boolean)
    .map((part) => {
      if (/^\[\.\.\.[^\]]+\]$/.test(part)) return '(.+)';
      if (/^\[[^\]]+\]$/.test(part)) return '([^/]+)';
      return escapeRegex(part);
    });
  return new RegExp(`^/${parts.join('/')}/?$`);
}

function dynamicPatterns(config: ConfigForRouting): string[] {
  return Object.keys(config.routes)
    .filter((pattern) => pattern !== '*' && isDynamicPattern(pattern))
    .sort((left, right) => {
      const leftStatic = left.split('/').filter((part) => part && !part.includes('[')).length;
      const rightStatic = right.split('/').filter((part) => part && !part.includes('[')).length;
      if (leftStatic !== rightStatic) return rightStatic - leftStatic;
      const leftSpread = left.includes('[...');
      const rightSpread = right.includes('[...');
      if (leftSpread !== rightSpread) return leftSpread ? 1 : -1;
      return left.localeCompare(right);
    });
}

export function routePathForLocale(
  pathname: string,
  localeCodes: readonly string[],
): { localePrefix?: string; routePath: string } {
  const normalized = normalizePath(pathname);
  const first = normalized.split('/').filter(Boolean)[0];
  if (!first || !localeCodes.includes(first)) return { routePath: normalized };
  return {
    localePrefix: first,
    routePath: normalizePath(normalized.slice(first.length + 1)),
  };
}

export function matchRoute(
  pathname: string,
  config: ConfigForRouting,
  localeCodes: readonly string[] = [],
): RouteMatch {
  const normalized = normalizePath(pathname);
  const candidates = [routePathForLocale(normalized, localeCodes).routePath];
  if (localeCodes.length === 0) {
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length > 1) candidates.push(normalizePath(segments.slice(1).join('/')));
  }

  for (const routePath of candidates) {
    const exact = config.routes[routePath];
    if (exact !== undefined) return { pattern: routePath, routePath, definition: exact };

    for (const pattern of dynamicPatterns(config)) {
      if (patternRegex(pattern).test(routePath)) {
        return { pattern, routePath, definition: config.routes[pattern] ?? false };
      }
    }
  }

  return { pattern: '*', routePath: candidates[0], definition: config.routes['*'] ?? false };
}

export function templateForMatch(match: RouteMatch, config: ConfigForRouting): string | undefined {
  if (match.definition === false) return undefined;
  const fallback = config.routes['*'];
  return match.definition.template ?? (fallback === false ? undefined : fallback?.template);
}

export function endpointParam(pathname: string): string {
  const normalized = normalizePath(pathname);
  return normalized === '/' ? 'index' : normalized.slice(1);
}

export function pagePathFromEndpointParam(path: string): string {
  return path === 'index' ? '/' : normalizePath(path);
}

export function rawImagePath(pathname: string, config: Pick<OgImageConfig, 'basePath'>): string {
  return `${normalizeBasePath(config.basePath)}/${endpointParam(pathname)}.png`;
}

export function previewPath(pathname: string, config: Pick<OgImageConfig, 'basePath'>): string {
  return `${normalizeBasePath(config.basePath)}/preview/${endpointParam(pathname)}`;
}
