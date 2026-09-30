import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const SITEMAP_NAME = '@astrojs/sitemap';
const ASTRO_CONFIG_FILES = [
  'astro.config.mjs',
  'astro.config.js',
  'astro.config.ts',
  'astro.config.mts',
] as const;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function sliceBalancedParen(source: string, openIndex: number): string | undefined {
  let depth = 0;
  let quote: string | undefined;
  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === '\\') {
        i += 1;
        continue;
      }
      if (char === quote) quote = undefined;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return undefined;
}

/** True when source contains `sitemap({ … i18n: … })` (or equivalent call). */
export function sourceSetsSitemapI18n(source: string): boolean {
  const stripped = stripComments(source);
  const call = /\bsitemap\s*\(/g;
  let match: RegExpExecArray | null = call.exec(stripped);
  while (match) {
    const open = match.index + match[0].length - 1;
    const args = sliceBalancedParen(stripped, open);
    if (args !== undefined && /\bi18n\s*:/.test(args)) return true;
    match = call.exec(stripped);
  }
  return false;
}

function astroConfigSetsSitemapI18n(root: URL): boolean {
  for (const name of ASTRO_CONFIG_FILES) {
    const filePath = fileURLToPath(new URL(name, root));
    if (!existsSync(filePath)) continue;
    if (sourceSetsSitemapI18n(readFileSync(filePath, 'utf8'))) return true;
  }
  return false;
}

/**
 * True when `@astrojs/sitemap` is registered and `astro.config.*` sets its
 * `i18n` option. The integration object is not inspected: `@astrojs/sitemap`
 * keeps its options in a closure, and Astro passes each integration only as
 * `{ name, hooks }`.
 */
export function sitemapI18nIsSet(root: URL, integrations: AstroIntegration[]): boolean {
  const hasSitemap = integrations.some((integration) => integration.name === SITEMAP_NAME);
  if (!hasSitemap) return false;
  return astroConfigSetsSitemapI18n(root);
}
