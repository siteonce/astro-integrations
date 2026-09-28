/**
 * Astro integration entry — named (and default) export `astroIntl()`.
 * Loads `src/intl.config.ts`, writes locale list and prefix policy through to
 * Astro `i18n`. Injects one route per compiled route and locale. A row with
 * `pagination` compiles to two. `viewRendering: 'request'`
 * injects static, entry, and listing routes on demand and refuses to boot without
 * an adapter. Under `astro dev`,
 * `viewRendering` is treated as `'build'`. Fallback routes stay prerendered.
 * A fallback view that exports `prerender = false` fails startup outside
 * `astro dev`. An on-demand `pagination.slug` route that shares its shape with a
 * `{slug}` route fails startup outside `astro dev`. A view's `prerender`
 * export wins for the other kinds.
 * Entrypoints are the views under `src/views/`. A row's fallback view is
 * injected for locales without a translation, and nothing is injected when the
 * row names none. Records reserved
 * file-route tails for pairing collisions, excluding those injected routes.
 * When `prefixDefaultLocale` is true, startup fails unless some other route serves `/`.
 * Warns when `trailingSlash` and `build.format` disagree. Does not load catalog JSON and
 * does not create a virtual module.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { createJiti } from 'jiti';
import * as z from 'zod';
import { type IntlConfig, intlConfigSchema } from './define-intl.ts';
import {
  fileRouteCollision,
  isIntlRoute,
  reservedTailsFromRoutes,
  servesSiteRoot,
} from './reserved-paths.ts';
import {
  type CompiledRoute,
  compileRoutes,
  pageSlugClash,
  pageSlugClashMessage,
  viewEntrypoint,
} from './routing.ts';
import { setIntlConfig, setRouteTails } from './runtime.ts';
import { sitemapI18nIsSet } from './sitemap-i18n.ts';
import { urlFormatMismatch } from './url-format.ts';

export { createT } from './create-t.ts';
export {
  type CollectionConfig,
  defineIntl,
  type IntlConfig,
  type LocaleOf,
  type RouteConfig,
} from './define-intl.ts';
export { id, locale, slug } from './fragments.ts';
export type { DocumentHead, PairedSlug, SitemapEntry } from './helpers.ts';
export {
  entryPaths,
  fallbackPaths,
  getAlternatePaths,
  getAlternatePathsForPath,
  getContentById,
  getContentByPath,
  getDocumentHead,
  getPairedSlugs,
  getRelated,
  getSitemapEntries,
  hreflangLinks,
  type ListingContext,
  type ListingOrder,
  listingPaths,
  staticPaths,
} from './helpers.ts';
export { leafSlug } from './locale-section.ts';
export type { LocaleSwitcherLink } from './locale-switcher.ts';
export { localeSwitcherLinks } from './locale-switcher.ts';
export { listingPageCount } from './path.ts';
export type { Relation } from './relation.ts';
export { localized, localizedValue, relation } from './relation.ts';
export { getIntlRuntime, setIntlConfig } from './runtime.ts';
export { viewProps } from './view-props.ts';

const CONFIG_FILENAME = 'intl.config.ts';

function overlappingI18nKeys(i18n: AstroIntegrationConfigI18n | undefined): string[] {
  if (!i18n) return [];
  const keys: string[] = [];
  if (i18n.defaultLocale !== undefined) keys.push('i18n.defaultLocale');
  if (i18n.locales !== undefined) keys.push('i18n.locales');
  if (i18n.routing === 'manual') {
    keys.push('i18n.routing');
    return keys;
  }
  if (i18n.routing?.prefixDefaultLocale !== undefined) {
    keys.push('i18n.routing.prefixDefaultLocale');
  }
  if (i18n.routing?.redirectToDefaultLocale !== undefined) {
    keys.push('i18n.routing.redirectToDefaultLocale');
  }
  return keys;
}

type AstroIntegrationConfigI18n = {
  defaultLocale?: string;
  locales?: unknown;
  routing?:
    | 'manual'
    | {
        prefixDefaultLocale?: boolean;
        redirectToDefaultLocale?: boolean;
      };
};

async function loadIntlConfig(configPath: string): Promise<IntlConfig> {
  const jiti = createJiti(import.meta.url);
  const loaded = await jiti.import(configPath, { default: true });
  const parsed = intlConfigSchema.safeParse(loaded);
  if (!parsed.success) {
    throw new Error(
      `@repo/astro-intl: intl.config.ts failed validation.\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

function refusedFallbackView(): string {
  return (
    '@repo/astro-intl: a fallback view exports prerender = false. ' +
    'A fallback route shares its pattern with the {slug} route, and two on-demand routes cannot share one pattern.'
  );
}

export function astroIntl(): AstroIntegration {
  let projectRoot = '';
  let injected: CompiledRoute[] = [];
  let ownEntrypoints = new Set<string>();
  let fallbackEntrypoints = new Set<string>();
  let viewRendering: IntlConfig['viewRendering'];
  let intlConfig: IntlConfig;

  return {
    name: '@repo/astro-intl',
    hooks: {
      'astro:config:setup': async ({
        config,
        command,
        updateConfig,
        addWatchFile,
        injectRoute,
        logger,
      }) => {
        const mismatch = urlFormatMismatch(config.trailingSlash, config.build?.format);
        if (mismatch) logger.warn(mismatch);

        const configPath = fileURLToPath(new URL(CONFIG_FILENAME, config.srcDir));
        if (!existsSync(configPath)) {
          logger.error(`Missing ${CONFIG_FILENAME}. Expected: ${configPath}`);
          throw new Error(`@repo/astro-intl: ${CONFIG_FILENAME} not found.`);
        }
        addWatchFile(configPath);

        const overlapping = overlappingI18nKeys(config.i18n);
        if (overlapping.length > 0) {
          const list = overlapping.join(', ');
          logger.error(
            `Overlapping i18n keys already set on defineConfig (${list}). Author locales and prefix policy only in src/intl.config.ts.`,
          );
          throw new Error(
            `@repo/astro-intl: overlapping i18n keys are already set on defineConfig.`,
          );
        }

        if (sitemapI18nIsSet(config.root, config.integrations)) {
          logger.error(
            `@astrojs/sitemap i18n option is set. Pairing is document-owned; do not turn on the sitemap i18n option.`,
          );
          throw new Error(`@repo/astro-intl: @astrojs/sitemap i18n option is set.`);
        }

        try {
          intlConfig = await loadIntlConfig(configPath);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.startsWith('@repo/astro-intl:')) {
            logger.error(`Failed to load ${CONFIG_FILENAME}: ${message}`);
            throw new Error(`@repo/astro-intl: failed to load ${CONFIG_FILENAME}.`);
          }
          logger.error(message);
          throw error;
        }

        // Dev treats the setting as 'build': no on-demand routes and no adapter check.
        viewRendering = command === 'dev' ? 'build' : intlConfig.viewRendering;

        if (viewRendering === 'request' && !config.adapter) {
          const message =
            '@repo/astro-intl: viewRendering is "request" and the site has no adapter.';
          logger.error(message);
          throw new Error(message);
        }

        setIntlConfig(intlConfig);

        const srcDir = fileURLToPath(config.srcDir);
        const entrypointForView = new Map<string, string>();
        const entrypoints = new Set<string>();
        const fallback = new Set<string>();
        let compiled: CompiledRoute[];
        try {
          compiled = compileRoutes(intlConfig);
          for (const route of compiled) {
            let entrypoint = entrypointForView.get(route.view);
            if (entrypoint === undefined) {
              entrypoint = viewEntrypoint(srcDir, route.view, existsSync);
              entrypointForView.set(route.view, entrypoint);
            }
            const onDemand = viewRendering === 'request' && route.kind !== 'fallback';
            injectRoute({
              pattern: route.pattern,
              entrypoint,
              ...(onDemand ? { prerender: false } : {}),
            });
            entrypoints.add(entrypoint);
            if (route.kind === 'fallback') fallback.add(entrypoint);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(message);
          throw error;
        }
        projectRoot = fileURLToPath(config.root);
        injected = compiled;
        ownEntrypoints = entrypoints;
        fallbackEntrypoints = fallback;

        updateConfig({
          i18n: {
            defaultLocale: intlConfig.defaultLocale,
            locales: intlConfig.locales,
            routing: {
              prefixDefaultLocale: intlConfig.routing.prefixDefaultLocale,
              redirectToDefaultLocale: intlConfig.routing.redirectToDefaultLocale ?? false,
              fallbackType: 'redirect',
            },
          },
        });
      },
      'astro:route:setup': ({ route, logger }) => {
        if (viewRendering !== 'request' || route.prerender !== false) return;
        const component = resolve(projectRoot, route.component);
        if (!fallbackEntrypoints.has(component)) return;
        const message = refusedFallbackView();
        logger.error(message);
        throw new Error(message);
      },
      'astro:routes:resolved': ({ routes, logger }) => {
        const injectedPatterns = new Set(injected.map((route) => route.pattern));
        if (viewRendering === 'request') {
          for (const route of routes) {
            if (route.isPrerendered !== false) continue;
            if (!isIntlRoute(route, ownEntrypoints, projectRoot, injectedPatterns)) continue;
            const clash = pageSlugClash(injected, route.pattern);
            if (!clash) continue;
            const message = pageSlugClashMessage(clash);
            logger.error(message);
            throw new Error(message);
          }
        }
        const collision = fileRouteCollision(
          routes.filter((route) => route.origin === 'project'),
          injected,
        );
        if (collision) {
          const message =
            `@repo/astro-intl: file route "${collision.file}" collides with injected route ` +
            `"${collision.injected.pattern}" (view "${collision.injected.view}").`;
          logger.error(message);
          throw new Error(message);
        }
        if (intlConfig.routing.prefixDefaultLocale) {
          const appRoutes = routes.filter(
            (route) => !isIntlRoute(route, ownEntrypoints, projectRoot, injectedPatterns),
          );
          if (!servesSiteRoot(appRoutes)) {
            const message =
              `@repo/astro-intl: prefixDefaultLocale is true, and nothing serves "/". ` +
              `Add a redirect in defineConfig (redirects: { '/': '/${intlConfig.defaultLocale}/' }) or a src/pages/index file.`;
            logger.error(message);
            throw new Error(message);
          }
        }
        setRouteTails(
          reservedTailsFromRoutes(
            routes.filter(
              (route) => !isIntlRoute(route, ownEntrypoints, projectRoot, injectedPatterns),
            ),
          ),
        );
      },
    },
  };
}

export default astroIntl;
