// Prerenders configured OG image routes during builds and serves their shared render handler.
import { resolve } from 'node:path';
import { siteConfig } from 'virtual:astro-lib/config';
import {
  generationConfig,
  projectRoot,
  publicDir,
  templateSources,
  templates,
} from 'virtual:astro-og-image/config';
import { isLocal, isPreview } from '@gravitysupport/astro-lib/helpers/deployEnv';
import { useTranslations } from '@gravitysupport/astro-lib/i18n';
import type { APIContext, APIRoute, GetStaticPaths } from 'astro';
import { computeHash, readCached, writeCached } from './cache.ts';
import { fontRegistryDigest, loadFonts } from './fonts.ts';
import { renderImage } from './renderer.ts';
import {
  enumerateImageRoutes,
  type RouteProps,
  resolveImageRoute,
  staticPathItem,
} from './route-data.ts';
import { pagePathFromEndpointParam } from './routing.ts';

const PACKAGE_VERSION = '0.0.1';

export const getStaticPaths: GetStaticPaths = async () =>
  (await enumerateImageRoutes(isPreview() || isLocal())).map(staticPathItem);

export async function handleImageRequest(
  context: APIContext<Partial<RouteProps>>,
  showDrafts: boolean,
): Promise<Response> {
  const routeProps = context.props.pagePath
    ? (context.props as RouteProps)
    : await resolveImageRoute(pagePathFromEndpointParam(context.params.path ?? ''), showDrafts);
  if (!routeProps) return new Response('OG image route not found.', { status: 404 });

  const template = templates[routeProps.templateId];
  if (!template) {
    throw new Error(`@gravitysupport/astro-og-image: unknown template "${routeProps.templateId}".`);
  }

  const fonts = loadFonts(generationConfig.fonts, projectRoot);
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
}

export const GET: APIRoute<Partial<RouteProps>> = (context) =>
  handleImageRequest(context, isPreview() || isLocal());
