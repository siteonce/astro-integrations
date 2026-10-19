const german: Readonly<Record<string, string>> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
};

/** Demo leaf slug: lowercase, German map, then runs of anything but `a-z0-9` become one `-`. */
export function slugify(value: string): string {
  let slug = value.toLowerCase();
  for (const [from, to] of Object.entries(german)) {
    slug = slug.replaceAll(from, to);
  }
  return slug.replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
}
