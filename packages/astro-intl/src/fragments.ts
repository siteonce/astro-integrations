import * as z from 'zod';

/** Translation group key. Stable across locales. Not Astro's collection `id`. */
export const id = z.string().min(1);

/** Locale on a localized entry. */
export const locale = z.string().min(1);

/**
 * Authored URL tail (or last segment when `pathPrefix` is set). Homepage is
 * `'/'`. Slashes are allowed. Empty string is rejected — author `'/'`.
 */
export const slug = z.string().min(1);
