/**
 * Startup failure when the app's content config directly imports
 * `@siteonce/astro-intl/runtime`. Astro loads that file before page modules exist,
 * so `astro:config/server` is unavailable there. Filenames follow Astro's
 * search: modern `content.config.*` under `src`, then legacy `content/config.*`.
 * The first existing file is the content config. Transitive imports are ignored.
 */

import { join, relative, sep } from 'node:path';

/** Astro 7.3.5 `searchConfig`, then `searchLegacyConfig`. */
const CONTENT_CONFIG_FILENAMES = [
  'content.config.mjs',
  'content.config.js',
  'content.config.mts',
  'content.config.ts',
  'content/config.ts',
  'content/config.js',
  'content/config.mjs',
  'content/config.mts',
] as const;

/**
 * True when `source` directly imports `@siteonce/astro-intl/runtime`.
 * Matches static `import`, side-effect `import`, `export … from`, and `import()`,
 * with single or double quotes. Not a module graph.
 */
export function importsAstroIntlRuntime(source: string): boolean {
  const specifier = /(['"])@siteonce\/astro-intl\/runtime\1/g;
  for (const match of source.matchAll(specifier)) {
    const before = source.slice(0, match.index);
    if (isDirectRuntimeImport(before)) return true;
  }
  return false;
}

function isDirectRuntimeImport(before: string): boolean {
  if (/\bimport\s*\(\s*$/.test(before)) return true;
  if (/\bimport\s+$/.test(before)) return true;
  const from = before.match(/\bfrom\s+$/);
  if (from?.index === undefined) return false;
  return /\b(?:import|export)\b/.test(before.slice(before.lastIndexOf(';') + 1));
}

export function findContentConfig(
  srcDir: string,
  exists: (file: string) => boolean,
): string | undefined {
  for (const name of CONTENT_CONFIG_FILENAMES) {
    const file = join(srcDir, name);
    if (exists(file)) return file;
  }
  return undefined;
}

/**
 * The startup error when the content config directly imports runtime.
 * `undefined` when there is no content config, or it does not import runtime.
 */
export function contentConfigRuntimeError(
  srcDir: string,
  root: string,
  exists: (file: string) => boolean,
  read: (file: string) => string,
): string | undefined {
  const file = findContentConfig(srcDir, exists);
  if (file === undefined) return undefined;
  if (!importsAstroIntlRuntime(read(file))) return undefined;
  const relativePath = relative(root, file).split(sep).join('/');
  return (
    `@siteonce/astro-intl: ${relativePath} imports @siteonce/astro-intl/runtime. ` +
    'Astro loads the content config before page modules exist, so astro:config/server is unavailable there. ' +
    'Read locales from your intl config instead.'
  );
}
