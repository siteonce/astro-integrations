import { slugify as siteSlugify } from '@repo/astro-site/utils/slugify';

const german: Readonly<Record<string, string>> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  Ä: 'ae',
  Ö: 'oe',
  Ü: 'ue',
};

/** Starter leaf slug: German map, then astro-site `slugify`. */
export function slugify(value: string): string {
  return siteSlugify(value, german);
}
