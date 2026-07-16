import { resolve } from 'node:path';
import { i18nConfig, siteConfig } from 'virtual:astro-lib/config';
import {
  bundledFonts,
  generationConfig,
  getCollection,
  projectRoot,
  publicDir,
  templateSources,
  templates,
} from 'virtual:astro-og-image/config';
import { isLocal, isPreview } from '@gravitysupport/astro-lib/helpers/deployEnv';
import { useTranslations } from '@gravitysupport/astro-lib/i18n';
import type { APIRoute, GetStaticPaths } from 'astro';
import { computeHash, readCached, writeCached } from './cache.ts';
import type { OgEntry } from './context.ts';
import { fontRegistryDigest, loadFonts } from './fonts.ts';
import { renderImage } from './renderer.ts';

const PACKAGE_VERSION = '0.0.1';

type RouteProps = {
  pagePath: string;
  locale: string;
  templateId: string;
  entry?: OgEntry;
};

type LooseEntry = {
  id: string;
  collection: string;
  data: Record<string, unknown> & { status?: string };
};

function normalizePath(path: string): string {
  return `/${path}`.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
}

function localizePath(path: string, locale: string): string {
  const normalized = normalizePath(path);
  const prefix = i18nConfig.routing === 'prefix-always' || locale !== i18nConfig.default;
  return prefix ? `/${locale}${normalized === '/' ? '' : normalized}` : normalized;
}

function endpointParam(path: string): string {
  const normalized = normalizePath(path);
  return normalized === '/' ? 'index' : normalized.slice(1);
}

function collectionFor(pattern: string): string {
  return pattern.split('/').filter(Boolean)[0] ?? '';
}

function expandPattern(pattern: string, id: string): string {
  return normalizePath(pattern.replace(/\[(?:\.\.\.)?[^\]]+\]/, id));
}

function localeAndPath(pagePath: string): { locale: string; routePath: string } {
  const normalized = normalizePath(pagePath);
  const firstSegment = normalized.split('/').filter(Boolean)[0];
  const matchedLocale = i18nConfig.locales.find((locale) => locale.code === firstSegment);
  if (matchedLocale) {
    const routePath = normalizePath(normalized.slice(matchedLocale.code.length + 1));
    return { locale: matchedLocale.code, routePath };
  }
  return { locale: i18nConfig.default, routePath: normalized };
}

async function resolveDevProps(pathParam: string): Promise<RouteProps | undefined> {
  const pagePath = pathParam === 'index' ? '/' : normalizePath(pathParam);
  const { locale, routePath } = localeAndPath(pagePath);
  const getEntries = getCollection as unknown as (collection: string) => Promise<LooseEntry[]>;
  const showDrafts = isPreview() || isLocal();

  for (const [pattern, page] of Object.entries(generationConfig.pages)) {
    if (!pattern.includes('[') && normalizePath(pattern) === routePath) {
      return { pagePath, locale, templateId: page.template };
    }
    if (!pattern.includes('[')) continue;

    const expression = new RegExp(
      `^${normalizePath(pattern).replace(/\[(?:\.\.\.)?[^\]]+\]/, '(.+)')}$`,
    );
    const id = expression.exec(routePath)?.[1];
    if (!id) continue;
    const entries = await getEntries(collectionFor(pattern));
    const entry = entries.find(
      (candidate) =>
        candidate.id === id &&
        (!candidate.data.status || candidate.data.status === 'published' || showDrafts),
    );
    if (entry) {
      return { pagePath, locale, templateId: page.template, entry: entry as OgEntry };
    }
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths: Array<{ params: { path: string }; props: RouteProps }> = [];
  const showDrafts = isPreview() || isLocal();
  const getEntries = getCollection as unknown as (collection: string) => Promise<LooseEntry[]>;

  for (const [pattern, page] of Object.entries(generationConfig.pages)) {
    if (!pattern.includes('[')) {
      for (const locale of i18nConfig.locales) {
        const pagePath = localizePath(pattern, locale.code);
        paths.push({
          params: { path: endpointParam(pagePath) },
          props: { pagePath, locale: locale.code, templateId: page.template },
        });
      }
      continue;
    }

    const entries = await getEntries(collectionFor(pattern));
    for (const entry of entries) {
      if (entry.data.status && entry.data.status !== 'published' && !showDrafts) continue;
      for (const locale of i18nConfig.locales) {
        const pagePath = localizePath(expandPattern(pattern, entry.id), locale.code);
        paths.push({
          params: { path: endpointParam(pagePath) },
          props: {
            pagePath,
            locale: locale.code,
            templateId: page.template,
            entry: entry as OgEntry,
          },
        });
      }
    }
  }

  return paths;
};

export const GET: APIRoute<Partial<RouteProps>> = async ({ props, params }) => {
  const routeProps = props.pagePath
    ? (props as RouteProps)
    : await resolveDevProps(params.path ?? '');
  if (!routeProps) return new Response('OG image route not found.', { status: 404 });

  const template = templates[routeProps.templateId];
  if (!template) {
    throw new Error(`@gravitysupport/astro-og-image: unknown template "${routeProps.templateId}".`);
  }

  const fonts = loadFonts(generationConfig.fonts, projectRoot, bundledFonts);
  const hash = computeHash({
    path: routeProps.pagePath,
    templateId: routeProps.templateId,
    templateSource: templateSources[routeProps.templateId] ?? '',
    templateConfig: generationConfig.templates[routeProps.templateId],
    locale: routeProps.locale,
    entryData: routeProps.entry?.data,
    siteConfig,
    fontDigest: fontRegistryDigest(fonts),
    packageVersion: PACKAGE_VERSION,
  });
  const cacheDir = resolve(projectRoot, 'node_modules/.cache/astro-og-image');

  let image: Buffer | undefined;
  try {
    image = readCached(cacheDir, hash);
  } catch {
    // Cache reads are an optimization; render normally if the cache is unavailable.
  }

  if (!image) {
    image = await renderImage({
      template,
      context: {
        siteConfig,
        locale: routeProps.locale,
        t: useTranslations(routeProps.locale),
        path: routeProps.pagePath,
        templateId: routeProps.templateId,
        ogConfig: generationConfig,
        entry: routeProps.entry,
      },
      fonts,
      publicDir,
      log: (message) => console.warn(`astro-og-image: ${message}`),
    });
    try {
      writeCached(cacheDir, hash, image);
    } catch {
      // A read-only cache location must not prevent the endpoint from rendering.
    }
  }

  return new Response(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
