/**
 * Astro integration entry — named (and default) export `astroIntl()`.
 * Loads `src/intl.config.ts`, writes locale list and prefix policy through to
 * Astro `i18n`, checks catalog files, and records reserved file-route tails
 * for pairing collisions. Does not load catalog JSON and does not create a
 * virtual module.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { createJiti } from 'jiti';
import * as z from 'zod';
import { type IntlConfig, intlConfigSchema, messagesDir } from './define-intl.ts';
import { reservedTailsFromRoutes } from './reserved-paths.ts';
import { setIntlConfig, setRouteTails } from './runtime.ts';
import { sitemapI18nIsSet } from './sitemap-i18n.ts';

export { createT } from './create-t.ts';
export { type CollectionConfig, defineIntl, type IntlConfig } from './define-intl.ts';
export { id, locale, slug } from './fragments.ts';
export type { DocumentHead, PairedSlug, SitemapEntry } from './helpers.ts';
export {
  getAlternatePaths,
  getAlternatePathsForPath,
  getContentById,
  getContentByPath,
  getDocumentHead,
  getPairedSlugs,
  getSitemapEntries,
  hreflangLinks,
} from './helpers.ts';
export type { LocaleSectionList, LocaleSectionMap } from './locale-section.ts';
export { listingLocaleSection, localeSection } from './locale-section.ts';
export type { LocaleSwitcherLink } from './locale-switcher.ts';
export { localeSwitcherLinks } from './locale-switcher.ts';
export type { MissingLocaleResult } from './missing-locale.ts';
export { missingLocaleChain } from './missing-locale.ts';
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
  return {
    name: '@repo/astro-intl',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, addWatchFile, logger }) => {
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
      'astro:routes:resolved': ({ routes }) => {
        setRouteTails(reservedTailsFromRoutes(routes));
      },
    },
  };
}

export default astroIntl;
