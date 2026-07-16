import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import * as z from 'zod';
import { type OgImageConfig, ogImageConfigSchema } from './config.ts';
import { assertFontFiles } from './fonts.ts';

const VIRTUAL_MODULE_ID = 'virtual:astro-og-image/config';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

export type AstroOgImageOptions = {
  config: unknown;
};

function validateRoutes(config: OgImageConfig): void {
  if (!config.templates[config.default]) {
    throw new Error(`default template "${config.default}" is not registered.`);
  }

  for (const [route, page] of Object.entries(config.pages)) {
    if (!route.startsWith('/')) throw new Error(`page route must start with "/": ${route}`);
    if (!config.templates[page.template]) {
      throw new Error(`pages["${route}"] references unknown template "${page.template}".`);
    }
    const parameters = route.match(/\[(?:\.\.\.)?[^\]]+\]/g) ?? [];
    if (parameters.length > 1) {
      throw new Error(`page route may contain at most one dynamic parameter: ${route}`);
    }
    if (parameters.length === 1 && !/^\/[^/]+\/\[(?:\.\.\.)?[^\]]+\]$/.test(route)) {
      throw new Error(
        `dynamic OG routes must use /<collection>/[param] or /<collection>/[...param]: ${route}`,
      );
    }
  }
}

function virtualConfigPlugin(options: {
  config: OgImageConfig;
  projectRoot: string;
  publicDir: string;
  templateFiles: Record<string, string>;
  bundledFonts: Array<{
    name: string;
    base64: string;
    weight: number;
    style: 'normal';
  }>;
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
        .map(([, file], index) => `import template${index} from ${JSON.stringify(file)};`)
        .join('\n');
      const templates = entries
        .map(([name], index) => `${JSON.stringify(name)}: template${index}`)
        .join(', ');
      const sources = Object.fromEntries(
        entries.map(([name, file]) => [name, readFileSync(file, 'utf8')]),
      );
      return `import contentData from 'astro:data-layer-content';
import { unflatten } from ${JSON.stringify(options.devaluePath)};
${imports}
export const generationConfig = ${JSON.stringify(options.config)};
export const templates = { ${templates} };
export const templateSources = ${JSON.stringify(sources)};
export const projectRoot = ${JSON.stringify(options.projectRoot)};
export const publicDir = ${JSON.stringify(options.publicDir)};
export const bundledFonts = ${JSON.stringify(options.bundledFonts)};
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

export default function astroOgImage(options: AstroOgImageOptions): AstroIntegration {
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

        const generationConfig = parsed.data;
        try {
          validateRoutes(generationConfig);
        } catch (error) {
          logger.error((error as Error).message);
          throw new Error(`@gravitysupport/astro-og-image: ${(error as Error).message}`);
        }

        const projectRoot = fileURLToPath(config.root);
        const publicDir = fileURLToPath(config.publicDir);
        const templatesDir = fileURLToPath(new URL('og-templates/', config.srcDir));
        const devaluePath = createRequire(import.meta.url).resolve('devalue');
        const bundledFonts = [
          {
            name: 'Inter',
            base64: readFileSync(
              fileURLToPath(new URL('./fonts/inter-latin-400-normal.woff', import.meta.url)),
            ).toString('base64'),
            weight: 400,
            style: 'normal' as const,
          },
          {
            name: 'Inter',
            base64: readFileSync(
              fileURLToPath(new URL('./fonts/inter-latin-700-normal.woff', import.meta.url)),
            ).toString('base64'),
            weight: 700,
            style: 'normal' as const,
          },
        ];
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
          }
        }

        try {
          assertFontFiles(generationConfig.fonts, projectRoot);
        } catch (error) {
          throw new Error(`@gravitysupport/astro-og-image: ${(error as Error).message}`);
        }

        updateConfig({
          vite: {
            plugins: [
              virtualConfigPlugin({
                config: generationConfig,
                projectRoot,
                publicDir,
                templateFiles,
                bundledFonts,
                devaluePath,
              }),
            ],
          },
        });

        injectRoute({
          pattern: '/og/[...path].png',
          entrypoint: fileURLToPath(
            new URL(command === 'build' ? './route.ts' : './route-dev.ts', import.meta.url),
          ),
          // Build emits static PNGs through getStaticPaths. Dev keeps the same
          // route on demand because Astro can evaluate injected getStaticPaths
          // before content collections finish their initial sync.
          prerender: command === 'build',
        });
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
  export const bundledFonts: Array<{ name: string; base64: string; weight: number; style: 'normal' | 'italic' }>;
  export const getCollection: (name: string) => Promise<Array<{ id: string; collection: string; data: Record<string, unknown> }>>;
}
`,
        });
      },
    },
  };
}
