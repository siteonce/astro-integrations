/**
 * Astro integration entry — named (and default) export `astroIntl(config)`.
 * Parses the intl config when called. Writes the locale list and prefix policy
 * through to Astro `i18n`. Injects one route per compiled route and locale. A
 * row with `pagination` compiles to two. `viewRendering: 'request'` injects
 * static, entry, and listing routes on demand and refuses to boot without an
 * adapter. Under `astro dev`, `viewRendering` is treated as `'build'`. Fallback
 * routes stay prerendered. A fallback view that exports `prerender = false`
 * fails startup outside `astro dev`. An on-demand `pagination.slug` route that
 * shares its shape with a `{slug}` route fails startup outside `astro dev`. A
 * view's `prerender` export wins for the other kinds. Entrypoints are the views
 * under `src/views/`. A row's fallback view is injected for locales without a
 * translation, and nothing is injected when the row names none. A project file
 * route shaped like an injected route fails startup. `prefixDefaultLocale`
 * defaults to false. When it is true, startup fails unless some other route
 * serves `/`. Warns when `trailingSlash` and `build.format` disagree. Fails
 * startup when `@astrojs/sitemap` is registered before this integration, or
 * when its `i18n` option is set. The authored config must survive a JSON round
 * trip. A key set to `undefined` survives. Otherwise startup fails and names
 * the key. The return value includes
 * `sitemap`: `{ customPages, serialize, filter }` bound to this config. During
 * `astro build`, a prerendered data route at `/_intl/sitemap-entries.json`
 * carries pairing to those options. `viewRendering` does not change it.
 * `astro:routes:resolved` writes the literal project file routes under an
 * entry route into that data route. It fails the build when one sits on an
 * entry URL. `astro dev` has no data route and serves the file route.
 * `astro:build:done` reads that route's output, adds its URLs to `customPages`,
 * and deletes the output. `astro:config:done` injects a module augmentation so
 * `Locale` is this config's locale union and `entries` maps each collection name
 * to its content entry. `astro:config:setup` fails startup
 * when the content config directly imports `@siteonce/astro-intl/runtime`. Astro
 * loads that file before page modules exist, so `astro:config/server` is
 * unavailable there. Does not load catalog JSON and does not create a virtual
 * module.
 */

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { contentConfigRuntimeError } from './content-config-runtime.ts';
import { type IntlConfig, type IntlConfigInput, parseIntlConfig } from './define-intl.ts';
import { LOCALE_TYPES_FILENAME, localeTypeDeclaration } from './locale-types.ts';
import {
  fileRouteCollision,
  isIntlRoute,
  literalEntryRoutes,
  servesSiteRoot,
} from './reserved-paths.ts';
import {
  type CompiledRoute,
  compileRoutes,
  pageSlugClash,
  pageSlugClashMessage,
  viewEntrypoint,
} from './routing.ts';
import type { ShadowCandidate } from './shadowed-entries.ts';
import { createSitemapOptions, type IntlSitemapOptions, SITEMAP_DATA_PATH } from './sitemap.ts';
import { sitemapI18nIsSet } from './sitemap-i18n.ts';
import { urlFormatMismatch } from './url-format.ts';

export { createIntl } from './create-intl.ts';
export { createT } from './create-t.ts';
export { defineIntl, type IntlConfig, type LocaleOf, type RouteConfig } from './define-intl.ts';
export { id, locale, slug } from './fragments.ts';
export type { IntlRegister, Locale } from './intl-register.ts';
export { leafSlug } from './locale-section.ts';
export type { LocaleSwitcherLink } from './locale-switcher.ts';
export type { PairedSlug, SitemapEntry } from './query.ts';
export type { Relation } from './relation.ts';
export { createIntlSchema, localizedValue } from './relation.ts';
export type { ListingContext, ListingOrder } from './routed-paths.ts';
export { viewProps } from './view-props.ts';

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

/** `@astrojs/sitemap` appears before `@siteonce/astro-intl` in the integration list. */
function sitemapRegisteredBeforeIntl(integrations: readonly { name: string }[]): boolean {
  const sitemapAt = integrations.findIndex(
    (integration) => integration.name === '@astrojs/sitemap',
  );
  if (sitemapAt === -1) return false;
  const intlAt = integrations.findIndex(
    (integration) => integration.name === '@siteonce/astro-intl',
  );
  return sitemapAt < intlAt;
}

function refusedFallbackView(): string {
  return (
    '@siteonce/astro-intl: a fallback view exports prerender = false. ' +
    'A fallback route shares its pattern with the {slug} route, and two on-demand routes cannot share one pattern.'
  );
}

/** A JSON object. `Date`, `Map`, `Set`, and class instances are not. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

/**
 * First path where `value` differs from its JSON round trip.
 * A key set to `undefined` survives. Returns undefined when the value survives.
 */
function jsonRoundTripKey(value: unknown): string | undefined {
  try {
    const encoded = JSON.stringify(value);
    return jsonDrift(value, JSON.parse(encoded) as unknown, '');
  } catch {
    return '(root)';
  }
}

function jsonDrift(value: unknown, parsed: unknown, path: string): string | undefined {
  if (Object.is(value, parsed)) return undefined;
  if (Array.isArray(value) && Array.isArray(parsed)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = jsonDrift(
        value[index],
        parsed[index],
        path ? `${path}.${index}` : String(index),
      );
      if (found) return found;
    }
    return undefined;
  }
  if (isPlainRecord(value) && isPlainRecord(parsed)) {
    for (const key of Object.keys(value)) {
      const next = path ? `${path}.${key}` : key;
      const found = jsonDrift(value[key], parsed[key], next);
      if (found) return found;
    }
    return undefined;
  }
  return path || '(root)';
}

/**
 * The data route is a file written into the app, so it cannot import a sibling
 * of this module. A relative `./create-intl.ts` URL would miss the emitted
 * file under `dist/`. These specifiers resolve through the app's dependency
 * on the package.
 */
const createIntlSpecifier = '@siteonce/astro-intl/create-intl';
const shadowedEntriesSpecifier = '@siteonce/astro-intl/shadowed-entries';

/**
 * The data route loads collections, refuses a literal file route on an entry URL,
 * and returns the sitemap entries. `candidates` come from `astro:routes:resolved`.
 */
function dataRouteSource(config: IntlConfigInput, candidates: readonly ShadowCandidate[]): string {
  return `import { createIntl } from ${JSON.stringify(createIntlSpecifier)};
import { refuseShadowedEntries } from ${JSON.stringify(shadowedEntriesSpecifier)};

const intl = createIntl(${JSON.stringify(config)});

const shadowCandidates = ${JSON.stringify(candidates)};

export const prerender = true;

export async function GET() {
  await refuseShadowedEntries(intl, shadowCandidates);
  return new Response(JSON.stringify(await intl.getSitemapEntries()));
}
`;
}

async function writeSitemapDataRoute(dir: URL, config: IntlConfigInput): Promise<string> {
  const directory = dir.href.endsWith('/') ? dir : new URL(`${dir.href}/`);
  await mkdir(fileURLToPath(directory), { recursive: true });
  const entrypointUrl = new URL('sitemap-entries.ts', directory);
  await writeFile(entrypointUrl, dataRouteSource(config, []));
  return fileURLToPath(entrypointUrl);
}

export function astroIntl(
  input: IntlConfigInput,
): AstroIntegration & { sitemap: IntlSitemapOptions } {
  const drift = jsonRoundTripKey(input);
  if (drift !== undefined) {
    throw new Error(
      `@siteonce/astro-intl: intl config does not survive a JSON round trip at "${drift}".`,
    );
  }
  const intlConfig = parseIntlConfig(input);
  const sitemapOptions = createSitemapOptions();

  let projectRoot = '';
  let injected: CompiledRoute[] = [];
  let ownEntrypoints = new Set<string>();
  let dataRouteFile: string | undefined;
  let fallbackEntrypoints = new Set<string>();
  let viewRendering: IntlConfig['viewRendering'];

  return {
    name: '@siteonce/astro-intl',
    sitemap: sitemapOptions.sitemap,
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        try {
          sitemapOptions.fillCustomPages(dir);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(message);
          throw error;
        }
      },
      'astro:config:setup': async ({
        config,
        command,
        updateConfig,
        injectRoute,
        createCodegenDir,
        logger,
      }) => {
        sitemapOptions.setBase(config.base);
        dataRouteFile = undefined;
        const mismatch = urlFormatMismatch(config.trailingSlash, config.build?.format);
        if (mismatch) logger.warn(mismatch);

        const overlapping = overlappingI18nKeys(config.i18n);
        if (overlapping.length > 0) {
          const list = overlapping.join(', ');
          logger.error(
            `Overlapping i18n keys already set on defineConfig (${list}). Author locales and prefix policy only in src/intl.config.ts.`,
          );
          throw new Error(
            `@siteonce/astro-intl: overlapping i18n keys are already set on defineConfig.`,
          );
        }

        if (sitemapI18nIsSet(config.root, config.integrations)) {
          logger.error(
            `@astrojs/sitemap i18n option is set. Pairing is document-owned; do not turn on the sitemap i18n option.`,
          );
          throw new Error(`@siteonce/astro-intl: @astrojs/sitemap i18n option is set.`);
        }

        if (sitemapRegisteredBeforeIntl(config.integrations)) {
          const message =
            '@siteonce/astro-intl: @astrojs/sitemap is registered before @siteonce/astro-intl. List intl first.';
          logger.error(message);
          throw new Error(message);
        }

        // Dev treats the setting as 'build': no on-demand routes and no adapter check.
        viewRendering = command === 'dev' ? 'build' : intlConfig.viewRendering;

        if (viewRendering === 'request' && !config.adapter) {
          const message =
            '@siteonce/astro-intl: viewRendering is "request" and the site has no adapter.';
          logger.error(message);
          throw new Error(message);
        }

        const srcDir = fileURLToPath(config.srcDir);
        const runtimeImport = contentConfigRuntimeError(
          srcDir,
          fileURLToPath(config.root),
          existsSync,
          (file) => readFileSync(file, 'utf8'),
        );
        if (runtimeImport !== undefined) {
          logger.error(runtimeImport);
          throw new Error(runtimeImport);
        }

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
          // Always prerendered. viewRendering does not apply. The build deletes the output.
          if (command === 'build') {
            const entrypoint = await writeSitemapDataRoute(createCodegenDir(), input);
            injectRoute({
              pattern: SITEMAP_DATA_PATH,
              entrypoint,
              prerender: true,
            });
            dataRouteFile = entrypoint;
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
              // Astro's config type requires this field.
              fallbackType: 'redirect',
            },
          },
        });
      },
      'astro:config:done': ({ injectTypes }) => {
        injectTypes({
          filename: LOCALE_TYPES_FILENAME,
          content: localeTypeDeclaration(intlConfig.locales, [
            ...(intlConfig.collections?.translated ?? []),
            ...(intlConfig.collections?.untranslated ?? []),
          ]),
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
      'astro:routes:resolved': async ({ routes, logger }) => {
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
        const projectRoutes = routes.filter((route) => route.origin === 'project');
        const collision = fileRouteCollision(projectRoutes, injected);
        if (collision) {
          const message =
            `@siteonce/astro-intl: file route "${collision.file}" collides with injected route ` +
            `"${collision.injected.pattern}" (view "${collision.injected.view}").`;
          logger.error(message);
          throw new Error(message);
        }
        if (dataRouteFile !== undefined) {
          const candidates = literalEntryRoutes(projectRoutes, injected).flatMap(
            ({ file, route, slug }): ShadowCandidate[] => {
              // Startup refuses a `{slug}` row that names no collection.
              const collection = intlConfig.routes?.[route.rowIndex]?.collection;
              if (collection === undefined) return [];
              return [{ file, pattern: route.pattern, locale: route.locale, collection, slug }];
            },
          );
          await writeFile(dataRouteFile, dataRouteSource(input, candidates));
        }
        if (intlConfig.routing.prefixDefaultLocale) {
          if (!servesSiteRoot(routes)) {
            const message =
              `@siteonce/astro-intl: prefixDefaultLocale is true, and nothing serves "/". ` +
              `Add a redirect in defineConfig (redirects: { '/': '/${intlConfig.defaultLocale}/' }) or a src/pages/index file.`;
            logger.error(message);
            throw new Error(message);
          }
        }
      },
    },
  };
}

export default astroIntl;
