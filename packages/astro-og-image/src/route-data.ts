// Builds one OG image route for each paired document slug.
import { getRelativeLocaleUrl } from 'astro:i18n';
import { generationConfig, intlConfig } from 'virtual:astro-og-image/config';
import { createIntl } from '@repo/astro-intl';
import type { OgEntry } from './context.ts';
import { endpointParam, matchRoute, normalizePath, templateForMatch } from './routing.ts';

export type RouteProps = {
  pagePath: string;
  routePath: string;
  locale: string;
  templateId: string;
  collection?: string;
  entry: OgEntry;
};

// Injected routes do not share the integration process, so pairing reads the serialized intl config.
const { getContentByPath, getPairedSlugs } = createIntl(intlConfig);

function pagePathFor(locale: string, slug: string): string {
  return normalizePath(getRelativeLocaleUrl(locale, slug === '/' ? undefined : slug));
}

function toOgEntry(entry: {
  id: string;
  collection?: string;
  data: Record<string, unknown>;
}): OgEntry {
  return {
    id: entry.id,
    collection: entry.collection ?? '',
    data: entry.data,
  };
}

function isVisible(entry: OgEntry, showDrafts: boolean): boolean {
  const status = entry.data.status;
  return !status || status === 'published' || showDrafts;
}

async function propsForSlug(
  locale: string,
  slug: string,
  showDrafts: boolean,
): Promise<RouteProps | undefined> {
  const entry = await getContentByPath(locale, slug);
  if (!entry) {
    throw new Error(`@repo/astro-og-image: paired slug "${locale}" "${slug}" has no entry.`);
  }
  const ogEntry = toOgEntry(entry);
  if (!isVisible(ogEntry, showDrafts)) return undefined;
  const pagePath = pagePathFor(locale, slug);
  const match = matchRoute(pagePath, generationConfig);
  const templateId = templateForMatch(match, generationConfig);
  if (!templateId) return undefined;
  return {
    pagePath,
    routePath: match.routePath,
    locale,
    templateId,
    collection: ogEntry.collection || undefined,
    entry: ogEntry,
  };
}

export async function enumerateImageRoutes(showDrafts: boolean): Promise<RouteProps[]> {
  const routes = new Map<string, RouteProps>();
  for (const { locale, slug } of await getPairedSlugs()) {
    const props = await propsForSlug(locale, slug, showDrafts);
    if (props) routes.set(props.pagePath, props);
  }
  return Array.from(routes.values()).sort((left, right) =>
    left.pagePath.localeCompare(right.pagePath),
  );
}

export async function resolveImageRoute(
  pagePath: string,
  showDrafts: boolean,
): Promise<RouteProps | undefined> {
  const requested = normalizePath(pagePath);
  for (const { locale, slug } of await getPairedSlugs()) {
    if (pagePathFor(locale, slug) !== requested) continue;
    return propsForSlug(locale, slug, showDrafts);
  }
  return undefined;
}

export function staticPathItem(props: RouteProps) {
  return { params: { path: endpointParam(props.pagePath) }, props };
}
