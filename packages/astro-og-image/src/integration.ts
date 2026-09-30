// Wires validated project config, public route metadata, and command-specific endpoints into Astro.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IntlConfig } from '@repo/astro-intl';
import type { SiteConfig } from '@repo/astro-site/schemas/config/site.config';
import type { AstroIntegration } from 'astro';
import * as z from 'zod';
import { type OgImageConfig, ogImageConfigSchema } from './config.ts';
import { assertFontFiles, resolveFontPath } from './fonts.ts';
import { isIncludedRoute, normalizePath } from './routing.ts';

// Exclusive deploy class the app maps from its host. Anything but `production`
// shows drafts.
const DEPLOY_CLASSES = ['production', 'preview', 'local'] as const;
export type DeployClass = (typeof DEPLOY_CLASSES)[number];

const VIRTUAL_MODULE_ID = 'virtual:astro-og-image/config';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

export type OgImageOptions = {
  config: unknown;
  siteConfig: SiteConfig;
  deployClass: DeployClass;
  intlConfig: IntlConfig;
  catalogs: Record<string, unknown>;
};

type AppConfig = {
  siteConfig: SiteConfig;
  deployClass: DeployClass;
  intlConfig: IntlConfig;
  catalogs: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readAppConfig(options: OgImageOptions): AppConfig {
  if (!isRecord(options?.siteConfig)) throw new Error('siteConfig is missing.');
  if (!DEPLOY_CLASSES.includes(options.deployClass)) {
    throw new Error(`deployClass must be one of ${DEPLOY_CLASSES.join(', ')}.`);
  }
  if (!isRecord(options.intlConfig)) throw new Error('intlConfig is missing.');
  if (!isRecord(options.catalogs)) throw new Error('catalogs is missing.');

  const locales = options.intlConfig.locales;
  if (
    !Array.isArray(locales) ||
    locales.length === 0 ||
    locales.some((locale) => typeof locale !== 'string')
  ) {
    throw new Error('intlConfig.locales is missing.');
  }
  if (typeof options.intlConfig.defaultLocale !== 'string' || !options.intlConfig.defaultLocale) {
    throw new Error('intlConfig.defaultLocale is missing.');
  }
  for (const locale of locales) {
    if (!isRecord(options.catalogs[locale])) {
      throw new Error(`catalogs has no object for locale "${locale}".`);
    }
  }

  return {
    siteConfig: options.siteConfig,
    deployClass: options.deployClass,
    intlConfig: options.intlConfig,
    catalogs: options.catalogs,
  };
}

function validateRoutes(config: OgImageConfig): void {
  const fallback = config.routes['*'];
  if (!isIncludedRoute(fallback) || !fallback.template) {
    throw new Error('routes["*"] must be an inclusion object with a template.');
  }
  if (!config.templates[fallback.template]) {
    throw new Error(`routes["*"] references unknown template "${fallback.template}".`);
  }

  for (const [route, definition] of Object.entries(config.routes)) {
    if (route.includes('[')) {
      throw new Error(`route keys must not contain "[": ${route}`);
    }
    if (route !== '*' && (!route.startsWith('/') || normalizePath(route) !== route)) {
      throw new Error(`route keys must be normalized absolute paths: ${route}`);
    }
    if (definition === false) continue;
    if (definition.template && !config.templates[definition.template]) {
      throw new Error(`routes["${route}"] references unknown template "${definition.template}".`);
    }
  }
}

function virtualConfigPlugin(options: {
  config: OgImageConfig;
  app: AppConfig;
  projectRoot: string;
  publicDir: string;
  templateFiles: Record<string, string>;
}) {
  return {
    name: 'astro-og-image:virtual-config',
    resolveId(id: string) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID;
    },
    load(id: string) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) return;
      const entries = Object.entries(options.templateFiles);
      const imports = entries
        .flatMap(([, file], index) => [
          `import template${index} from ${JSON.stringify(file)};`,
          `import templateSource${index} from ${JSON.stringify(`${file}?raw`)};`,
        ])
        .join('\n');
      const templates = entries
        .map(([name], index) => `${JSON.stringify(name)}: template${index}`)
        .join(', ');
      const sources = entries
        .map(([name], index) => `${JSON.stringify(name)}: templateSource${index}`)
        .join(', ');
      return `${imports}
export const generationConfig = ${JSON.stringify(options.config)};
export const siteConfig = ${JSON.stringify(options.app.siteConfig)};
export const deployClass = ${JSON.stringify(options.app.deployClass)};
export const intlConfig = ${JSON.stringify(options.app.intlConfig)};
export const catalogs = ${JSON.stringify(options.app.catalogs)};
export const templates = { ${templates} };
export const templateSources = { ${sources} };
export const projectRoot = ${JSON.stringify(options.projectRoot)};
export const publicDir = ${JSON.stringify(options.publicDir)};
`;
    },
  };
}

function isNamespaceCollision(
  route: { pattern: string; entrypoint: string },
  basePath: string,
  ownEntrypoints: Set<string>,
  projectRoot: string,
) {
  if (ownEntrypoints.has(resolve(projectRoot, route.entrypoint))) return false;
  const pattern = normalizePath(route.pattern);
  return pattern === basePath || pattern.startsWith(`${basePath}/`);
}

export default function ogImage(options: OgImageOptions): AstroIntegration {
  let generationConfig: OgImageConfig | undefined;
  let ownEntrypoints = new Set<string>();
  let consumerRoot = '';

  return {
    name: '@repo/astro-og-image',
    hooks: {
      'astro:config:setup': ({
        config,
        command,
        updateConfig,
        injectRoute,
        addWatchFile,
        logger,
      }) => {
        let app: AppConfig;
        try {
          app = readAppConfig(options);
        } catch (error) {
          logger.error((error as Error).message);
          throw new Error(`@repo/astro-og-image: ${(error as Error).message}`);
        }

        const parsed = ogImageConfigSchema.safeParse(options.config);
        if (!parsed.success) {
          logger.error(`Invalid OG image config:\n${z.prettifyError(parsed.error)}`);
          throw new Error('@repo/astro-og-image: config validation failed.');
        }

        generationConfig = parsed.data;
        try {
          validateRoutes(generationConfig);
        } catch (error) {
          logger.error((error as Error).message);
          throw new Error(`@repo/astro-og-image: ${(error as Error).message}`);
        }

        const projectRoot = fileURLToPath(config.root);
        consumerRoot = projectRoot;
        const publicDir = fileURLToPath(config.publicDir);
        const templatesDir = fileURLToPath(new URL('og-templates/', config.srcDir));
        const templateFiles: Record<string, string> = {};
        for (const name of Object.keys(generationConfig.templates)) {
          const file = resolve(templatesDir, `${name}.tsx`);
          if (!existsSync(file)) {
            throw new Error(`@repo/astro-og-image: template "${name}" not found at ${file}.`);
          }
          templateFiles[name] = file;
          addWatchFile(file);

          const background = generationConfig.templates[name]?.bgImage;
          if (background) {
            const absolute = resolve(publicDir, background.replace(/^\/+/, ''));
            if (!existsSync(absolute)) {
              throw new Error(
                `@repo/astro-og-image: templates["${name}"].bgImage not found: ${background}.`,
              );
            }
            addWatchFile(absolute);
          }
        }

        try {
          assertFontFiles(generationConfig.fonts, projectRoot);
        } catch (error) {
          throw new Error(`@repo/astro-og-image: ${(error as Error).message}`);
        }
        for (const font of generationConfig.fonts) {
          addWatchFile(resolveFontPath(font.path, projectRoot));
        }

        updateConfig({
          vite: {
            // Astro's base TypeScript config preserves JSX. Vite 8's Oxc
            // transform must lower project-authored Satori `.tsx` templates
            // before Rolldown parses them; each template's @jsxImportSource
            // pragma selects this package's runtime.
            oxc: { jsx: { runtime: 'automatic' } },
            plugins: [
              virtualConfigPlugin({
                config: generationConfig,
                app,
                projectRoot,
                publicDir,
                templateFiles,
              }),
            ],
          },
        });

        const isDev = command === 'dev';
        const rawEntrypoint = fileURLToPath(
          new URL(isDev ? './route-dev.ts' : './route.ts', import.meta.url),
        );
        injectRoute({
          pattern: `${generationConfig.basePath}/[...path].png`,
          entrypoint: rawEntrypoint,
          prerender: !isDev,
        });

        ownEntrypoints = new Set([rawEntrypoint]);
        if (isDev) {
          const galleryEntrypoint = fileURLToPath(new URL('./gallery.ts', import.meta.url));
          const previewEntrypoint = fileURLToPath(new URL('./preview.ts', import.meta.url));
          injectRoute({
            pattern: generationConfig.basePath,
            entrypoint: galleryEntrypoint,
            prerender: false,
          });
          injectRoute({
            pattern: `${generationConfig.basePath}/preview/[...path]`,
            entrypoint: previewEntrypoint,
            prerender: false,
          });
          ownEntrypoints.add(galleryEntrypoint);
          ownEntrypoints.add(previewEntrypoint);
        }
      },
      'astro:routes:resolved': ({ routes }) => {
        if (!generationConfig) return;
        const basePath = generationConfig.basePath;
        const collision = routes.find((route) =>
          isNamespaceCollision(route, basePath, ownEntrypoints, consumerRoot),
        );
        if (collision) {
          throw new Error(
            `@repo/astro-og-image: basePath "${basePath}" collides with route "${collision.pattern}" (${collision.entrypoint}).`,
          );
        }
      },
      'astro:config:done': ({ injectTypes }) => {
        injectTypes({
          filename: 'astro-og-image.d.ts',
          content: `declare module 'virtual:astro-og-image/config' {
  export const generationConfig: import('@repo/astro-og-image/config').OgImageConfig;
  export const siteConfig: import('@repo/astro-site/schemas/config/site.config').SiteConfig;
  export const deployClass: import('@repo/astro-og-image').DeployClass;
  export const intlConfig: import('@repo/astro-intl').IntlConfig;
  export const catalogs: Record<string, unknown>;
  export const templates: Record<string, import('@repo/astro-og-image/context').Template>;
  export const templateSources: Record<string, string>;
  export const projectRoot: string;
  export const publicDir: string;
}
`,
        });
      },
    },
  };
}
