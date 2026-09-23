import * as z from 'zod';

/** Translation group key when pairing from a document field. Not Astro's collection `id`. */
export const id = z.string().min(1);

/** Locale on a localized entry. */
export const locale = z.string().min(1);

/** Non-empty entry slug. `leafSlug` checks that a routed leaf is one segment. */
export const slug = z.string().min(1);
