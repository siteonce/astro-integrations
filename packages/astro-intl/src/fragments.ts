import * as z from 'zod';

/** Translation group key when pairing from a document field. Not Astro's collection `id`. */
export const id = z.string().min(1);

/** Locale on a localized entry. */
export const locale = z.string().min(1);

/**
 * Public tail after the locale prefix. Homepage is `'/'`. Slashes are allowed.
 * Empty string is rejected — author `'/'`.
 */
export const slug = z.string().min(1);
