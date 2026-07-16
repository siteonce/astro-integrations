// Resolves discoverable Astro pages and explicit content collections into renderable OG routes.
import { i18nConfig } from 'virtual:astro-lib/config';
import { generationConfig, getCollection, projectRoutes } from 'virtual:astro-og-image/config';
import type { OgEntry } from './context.ts';
import {
  endpointParam,
  expandPattern,
  isDynamicPattern,
  isIncludedRoute,
  matchRoute,
  normalizePath,
  parameterForPattern,
  patternRegex,
  templateForMatch,
} from './routing.ts';

export type RouteProps = {
  pagePath: string;
  routePath: string;
  locale: string;
  templateId: string;
  collection?: string;
  entry?: OgEntry;
};

type LooseEntry = {
  id: string;
  collection: string;
  data: Record<string, unknown> & { status?: string };
};

const localeCodes = i18nConfig.locales.map((locale) => locale.code);

function projectPagePatterns(dynamic: boolean): string[] {
  return Array.from(
    new Set(
      projectRoutes
        .filter(
          (route) =>
            route.origin === 'project' &&
            route.type === 'page' &&
            isDynamicPattern(route.pattern) === dynamic,
        )
        .map((route) => normalizePath(route.pattern)),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function localizePath(path: string, locale: string): string {
  const normalized = normalizePath(path);
  const prefix = i18nConfig.routing === 'prefix-always' || locale !== i18nConfig.default;
  return prefix ? `/${locale}${normalized === '/' ? '' : normalized}` : normalized;
}

function localeAndRoutePath(pagePath: string): { locale: string; routePath: string } | undefined {
  const normalized = normalizePath(pagePath);
  const first = normalized.split('/').filter(Boolean)[0];
  const matched = i18nConfig.locales.find((locale) => locale.code === first);
  if (matched) {
    if (i18nConfig.routing !== 'prefix-always' && matched.code === i18nConfig.default) {
      return undefined;
    }
    return {
      locale: matched.code,
      routePath: normalizePath(normalized.slice(matched.code.length + 1)),
    };
  }
  if (i18nConfig.routing === 'prefix-always') return undefined;
  return { locale: i18nConfig.default, routePath: normalized };
}

function isVisible(entry: LooseEntry, showDrafts: boolean): boolean {
  return !entry.data.status || entry.data.status === 'published' || showDrafts;
}

function configuredDynamicPatterns(): string[] {
  return Object.entries(generationConfig.routes)
    .filter(
      (entry): entry is [string, Exclude<(typeof entry)[1], false>] =>
        entry[1] !== false && isDynamicPattern(entry[0]) && Boolean(entry[1].collection),
    )
    .map(([pattern]) => normalizePath(pattern))
    .filter((pattern) => projectPagePatterns(true).includes(pattern))
    .sort((left, right) => left.localeCompare(right));
}

function propsFor(options: {
  pagePath: string;
  routePath: string;
  locale: string;
  entry?: LooseEntry;
  collection?: string;
}): RouteProps | undefined {
  const match = matchRoute(options.routePath, generationConfig, localeCodes);
  const templateId = templateForMatch(match, generationConfig);
  if (!templateId) return undefined;
  return {
    ...options,
    templateId,
    entry: options.entry as OgEntry | undefined,
  };
}

export async function enumerateImageRoutes(showDrafts: boolean): Promise<RouteProps[]> {
  const routes: RouteProps[] = [];

  for (const routePath of projectPagePatterns(false)) {
    for (const locale of localeCodes) {
      const pagePath = localizePath(routePath, locale);
      const props = propsFor({ pagePath, routePath, locale });
      if (props) routes.push(props);
    }
  }

  for (const pattern of configuredDynamicPatterns()) {
    const definition = generationConfig.routes[pattern];
    if (!isIncludedRoute(definition) || !definition.collection) continue;
    const entries = (await getCollection(definition.collection)) as LooseEntry[];
    for (const entry of entries) {
      if (!isVisible(entry, showDrafts)) continue;
      const routePath = expandPattern(pattern, entry.id);
      if (!patternRegex(pattern).test(routePath)) continue;
      for (const locale of localeCodes) {
        const pagePath = localizePath(routePath, locale);
        const props = propsFor({
          pagePath,
          routePath,
          locale,
          collection: definition.collection,
          entry,
        });
        if (props) routes.push(props);
      }
    }
  }

  return Array.from(new Map(routes.map((route) => [route.pagePath, route])).values()).sort(
    (left, right) => left.pagePath.localeCompare(right.pagePath),
  );
}

export async function resolveImageRoute(
  pagePath: string,
  showDrafts: boolean,
): Promise<RouteProps | undefined> {
  const localized = localeAndRoutePath(pagePath);
  if (!localized) return undefined;
  const normalizedPagePath = normalizePath(pagePath);

  if (projectPagePatterns(false).includes(localized.routePath)) {
    return propsFor({
      pagePath: normalizedPagePath,
      routePath: localized.routePath,
      locale: localized.locale,
    });
  }

  const pattern = configuredDynamicPatterns().find((candidate) =>
    patternRegex(candidate).test(localized.routePath),
  );
  if (!pattern) return undefined;
  const definition = generationConfig.routes[pattern];
  if (!isIncludedRoute(definition) || !definition.collection) return undefined;
  const id = parameterForPattern(pattern, localized.routePath);
  if (!id) return undefined;
  const entries = (await getCollection(definition.collection)) as LooseEntry[];
  const entry = entries.find(
    (candidate) => candidate.id === id && isVisible(candidate, showDrafts),
  );
  if (!entry) return undefined;
  return propsFor({
    pagePath: normalizedPagePath,
    routePath: localized.routePath,
    locale: localized.locale,
    collection: definition.collection,
    entry,
  });
}

export function staticPathItem(props: RouteProps) {
  return { params: { path: endpointParam(props.pagePath) }, props };
}
