/**
 * `locales` and `defaultLocale` as `astroIntl()` wrote them into Astro `i18n`.
 * Server-only. Reads `astro:config/server`, which needs `virtual:astro:pages`
 * through `virtual:astro:manifest`. Do not import this module from
 * `astro.config.mjs`: `astro:` modules do not resolve while Astro loads its
 * config. Pass the intl config to `astroIntl()` instead. Do not import it from
 * a content config (`src/content.config.ts`). Astro loads that file before page
 * modules exist, so `astro:config/server` is unavailable there. Read `locales`
 * from the intl config instead. A client island that imports this module fails
 * the build with Astro's `ServerOnlyModule` error: pass `locales` in from the page.
 */
import { i18n } from 'astro:config/server';
import type { Locale } from './intl-register.ts';
import { narrowAstroI18n } from './narrow-astro-i18n.ts';

const intl = narrowAstroI18n(i18n);

// Astro types each locale as `string`. `Locale` is the injected literal union.
export const locales = intl.locales as readonly Locale[];
export const defaultLocale = intl.defaultLocale as Locale;
