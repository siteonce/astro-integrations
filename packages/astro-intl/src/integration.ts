/**
 * Astro integration entry — named (and default) export `astroIntl()`.
 * Loads `src/intl.config.ts`, writes locale list and prefix policy through to
 * Astro `i18n`, and checks catalog files. Injects one route per compiled route
 * row and locale. Entrypoints are the routed pages under `src/routes/`, plus a
 * missing-translation redirect. Records reserved file-route tails for pairing
 * collisions, excluding those injected routes. Does not load catalog JSON and
 * does not create a virtual module.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { createJiti } from 'jiti';
import * as z from 'zod';
import { type IntlConfig, intlConfigSchema, messagesDir } from './define-intl.ts';
import { fileRouteCollision, isIntlRoute, reservedTailsFromRoutes } from './reserved-paths.ts';
import { type CompiledRoute, compileRoutes, routedPageEntrypoint } from './routing.ts';
import { setIntlConfig, setRouteTails } from './runtime.ts';
import { sitemapI18nIsSet } from './sitemap-i18n.ts';

export { createT } from './create-t.ts';
export {
  type CollectionConfig,
  defineIntl,
  type IntlConfig,
  type RouteConfig,
} from './define-intl.ts';
export { id, locale, slug } from './fragments.ts';
export type { DocumentHead, PairedSlug, SitemapEntry } from './helpers.ts';
export {
  getAlternatePaths,
  getAlternatePathsForPath,
  getContentById,
  getContentByPath,
  getDocumentHead,
  getPairedSlugs,
  getRelated,
  getSitemapEntries,
  hreflangLinks,
  type ListingEntries,
  setListingEntries,
} from './helpers.ts';
export { leafSlug } from './locale-section.ts';
export type { LocaleSwitcherLink } from './locale-switcher.ts';
export { localeSwitcherLinks } from './locale-switcher.ts';
export { listingPageCount, listingTail } from './path.ts';
export type { Relation } from './relation.ts';
export { localized, localizedValue, relation } from './relation.ts';
export { getIntlRuntime, setIntlConfig } from './runtime.ts';

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

export function astroIntl(): AstroIntegration {
  let projectRoot = '';
  let injected: CompiledRoute[] = [];
  let ownEntrypoints = new Set<string>();

  return {
    name: '@repo/astro-intl',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, addWatchFile, injectRoute, logger }) => {
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

        let intlConfig: IntlConfig;
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

        const dir = messagesDir(intlConfig);
        for (const locale of intlConfig.locales) {
          const catalogPath = fileURLToPath(new URL(`${dir}/${locale}.json`, config.srcDir));
          if (!existsSync(catalogPath)) {
            logger.error(`Missing catalog file for locale "${locale}". Expected: ${catalogPath}`);
            throw new Error(`@repo/astro-intl: catalog file for locale "${locale}" not found.`);
          }
          addWatchFile(catalogPath);
        }

        setIntlConfig(intlConfig);

        const redirectEntrypoint = fileURLToPath(
          new URL('./routing/redirect.astro', import.meta.url),
        );
        const srcDir = fileURLToPath(config.srcDir);
        const entrypointForPage = new Map<string, string>();
        const entrypoints = new Set<string>();
        let compiled: CompiledRoute[];
        try {
          compiled = compileRoutes(intlConfig);
          for (const route of compiled) {
            let entrypoint = redirectEntrypoint;
            if (route.kind !== 'redirect') {
              const cached = entrypointForPage.get(route.page);
              if (cached !== undefined) {
                entrypoint = cached;
              } else {
                entrypoint = routedPageEntrypoint(srcDir, route.page, existsSync);
                entrypointForPage.set(route.page, entrypoint);
              }
            }
            injectRoute({ pattern: route.pattern, entrypoint });
            entrypoints.add(entrypoint);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(message);
          throw error;
        }
        projectRoot = fileURLToPath(config.root);
        injected = compiled;
        ownEntrypoints = entrypoints;

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
      'astro:routes:resolved': ({ routes, logger }) => {
        const collision = fileRouteCollision(
          routes.filter((route) => route.origin === 'project'),
          injected,
        );
        if (collision) {
          const message =
            `@repo/astro-intl: file route "${collision.file}" collides with injected route ` +
            `"${collision.injected.pattern}" (routed page "${collision.injected.page}").`;
          logger.error(message);
          throw new Error(message);
        }
        const injectedPatterns = new Set(injected.map((route) => route.pattern));
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
