// Wires validated project config, public route metadata, and command-specific endpoints into Astro.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration, IntegrationResolvedRoute } from 'astro';
import * as z from 'zod';
import { type OgImageConfig, ogImageConfigSchema } from './config.ts';
import { assertFontFiles, resolveFontPath } from './fonts.ts';
import {
  dynamicParameterCount,
  isDynamicPattern,
  isIncludedRoute,
  normalizePath,
} from './routing.ts';

const VIRTUAL_MODULE_ID = 'virtual:astro-og-image/config';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

export type AstroOgImageOptions = {
  config: unknown;
};

type PublicRoute = Pick<
  IntegrationResolvedRoute,
  'pattern' | 'pathname' | 'type' | 'origin' | 'entrypoint'
>;

function validateRoutes(config: OgImageConfig): void {
  const fallback = config.routes['*'];
  if (!isIncludedRoute(fallback) || !fallback.template) {
    throw new Error('routes["*"] must be an inclusion object with a template.');
  }
  if (!config.templates[fallback.template]) {
    throw new Error(`routes["*"] references unknown template "${fallback.template}".`);
  }

  for (const [route, definition] of Object.entries(config.routes)) {
    if (route !== '*' && (!route.startsWith('/') || normalizePath(route) !== route)) {
      throw new Error(`route keys must be normalized absolute paths: ${route}`);
    }
    if (definition === false) continue;
    if (definition.template && !config.templates[definition.template]) {
      throw new Error(`routes["${route}"] references unknown template "${definition.template}".`);
    }
    if (!isDynamicPattern(route)) {
      if (definition.collection) {
        throw new Error(`static route "${route}" must not define collection.`);
      }
      continue;
    }
    if (dynamicParameterCount(route) !== 1) {
      throw new Error(`included dynamic route must contain exactly one parameter: ${route}`);
    }
    if (!definition.collection) {
      throw new Error(`included dynamic route "${route}" must define collection.`);
    }
  }
}

function virtualConfigPlugin(options: {
  config: OgImageConfig;
  projectRoot: string;
  publicDir: string;
  templateFiles: Record<string, string>;
  routes: PublicRoute[];
  devaluePath: string;
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
      return `import contentData from 'astro:data-layer-content';
import { unflatten } from ${JSON.stringify(options.devaluePath)};
${imports}
export const generationConfig = ${JSON.stringify(options.config)};
export const templates = { ${templates} };
export const templateSources = { ${sources} };
export const projectRoot = ${JSON.stringify(options.projectRoot)};
export const publicDir = ${JSON.stringify(options.publicDir)};
export const projectRoutes = ${JSON.stringify(options.routes)};
const contentMap = contentData instanceof Map ? contentData : unflatten(contentData);
export const getCollection = async (name) => {
  const collection = contentMap.get(name);
  if (!collection) return [];
  return Array.from(collection.values(), (entry) => ({ ...entry, collection: name }));
};
`;
    },
  };
}

function isNamespaceCollision(
  route: PublicRoute,
  basePath: string,
  ownEntrypoints: Set<string>,
  projectRoot: string,
) {
  if (ownEntrypoints.has(resolve(projectRoot, route.entrypoint))) return false;
  const pattern = normalizePath(route.pattern);
  return pattern === basePath || pattern.startsWith(`${basePath}/`);
}

export default function astroOgImage(options: AstroOgImageOptions): AstroIntegration {
  let generationConfig: OgImageConfig | undefined;
  const publicRoutes: PublicRoute[] = [];
  let ownEntrypoints = new Set<string>();
  let consumerRoot = '';

  return {
    name: '@gravitysupport/astro-og-image',
    hooks: {
      'astro:config:setup': ({
        config,
        command,
        updateConfig,
        injectRoute,
        addWatchFile,
        logger,
      }) => {
        if (
          !config.integrations.some(
            (integration) => integration.name === '@gravitysupport/astro-lib',
          )
        ) {
          throw new Error(
            '@gravitysupport/astro-og-image requires @gravitysupport/astro-lib to be registered first.',
          );
        }

        const parsed = ogImageConfigSchema.safeParse(options.config);
        if (!parsed.success) {
          logger.error(`Invalid OG image config:\n${z.prettifyError(parsed.error)}`);
          throw new Error('@gravitysupport/astro-og-image: config validation failed.');
        }

        generationConfig = parsed.data;
        try {
          validateRoutes(generationConfig);
        } catch (error) {
          logger.error((error as Error).message);
          throw new Error(`@gravitysupport/astro-og-image: ${(error as Error).message}`);
        }

        const projectRoot = fileURLToPath(config.root);
        consumerRoot = projectRoot;
        const publicDir = fileURLToPath(config.publicDir);
        const templatesDir = fileURLToPath(new URL('og-templates/', config.srcDir));
        const devaluePath = createRequire(import.meta.url).resolve('devalue');
        const templateFiles: Record<string, string> = {};
        for (const name of Object.keys(generationConfig.templates)) {
          const file = resolve(templatesDir, `${name}.tsx`);
          if (!existsSync(file)) {
            throw new Error(
              `@gravitysupport/astro-og-image: template "${name}" not found at ${file}.`,
            );
          }
          templateFiles[name] = file;
          addWatchFile(file);

          const background = generationConfig.templates[name]?.bgImage;
          if (background) {
            const absolute = resolve(publicDir, background.replace(/^\/+/, ''));
            if (!existsSync(absolute)) {
              throw new Error(
                `@gravitysupport/astro-og-image: templates["${name}"].bgImage not found: ${background}.`,
              );
            }
            addWatchFile(absolute);
          }
        }

        try {
          assertFontFiles(generationConfig.fonts, projectRoot);
        } catch (error) {
          throw new Error(`@gravitysupport/astro-og-image: ${(error as Error).message}`);
        }
        for (const font of generationConfig.fonts) {
          addWatchFile(resolveFontPath(font.path, projectRoot));
        }

        updateConfig({
          vite: {
            plugins: [
              virtualConfigPlugin({
                config: generationConfig,
                projectRoot,
                publicDir,
                templateFiles,
                routes: publicRoutes,
                devaluePath,
              }),
            ],
          },
        });

        const rawEntrypoint = fileURLToPath(
          new URL(command === 'build' ? './route.ts' : './route-dev.ts', import.meta.url),
        );
        injectRoute({
          pattern: `${generationConfig.basePath}/[...path].png`,
          entrypoint: rawEntrypoint,
          prerender: command === 'build',
        });

        ownEntrypoints = new Set([rawEntrypoint]);
        if (command === 'dev') {
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
        const mapped = routes.map(({ pattern, pathname, type, origin, entrypoint }) => ({
          pattern,
          pathname,
          type,
          origin,
          entrypoint,
        }));
        const collision = mapped.find((route) =>
          isNamespaceCollision(route, basePath, ownEntrypoints, consumerRoot),
        );
        if (collision) {
          throw new Error(
            `@gravitysupport/astro-og-image: basePath "${basePath}" collides with route "${collision.pattern}" (${collision.entrypoint}).`,
          );
        }
        publicRoutes.splice(0, publicRoutes.length, ...mapped);
      },
      'astro:config:done': ({ injectTypes }) => {
        injectTypes({
          filename: 'astro-og-image.d.ts',
          content: `declare module 'virtual:astro-og-image/config' {
  export const generationConfig: import('@gravitysupport/astro-og-image/config').OgImageConfig;
  export const templates: Record<string, import('@gravitysupport/astro-og-image/context').Template>;
  export const templateSources: Record<string, string>;
  export const projectRoot: string;
  export const publicDir: string;
  export const projectRoutes: Array<{ pattern: string; pathname?: string; type: 'page' | 'endpoint' | 'redirect' | 'fallback'; origin: 'internal' | 'external' | 'project'; entrypoint: string }>;
  export const getCollection: (name: string) => Promise<Array<{ id: string; collection: string; data: Record<string, unknown> }>>;
}
`,
        });
      },
    },
  };
}
